/**
 * 状态管理与持久化
 * 所有写操作在此集中处理；能否操作调用 domain/release 的纯函数校验，
 * 状态推导交给 domain/status；本模块不承载业务规则与界面逻辑。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Cue, DirectorReview, RehearsalState, RunRecord } from "./types";
import { createSeedState } from "./seed";
import { calcDeviationSec } from "./domain/status";
import {
  canAdjustLighting,
  canRegisterRerun,
  canReleaseAfterRerun,
  canSubmitReview,
  validateReviewForm,
  validateRunForm,
  type ValidationResult,
} from "./domain/release";

const STORAGE_KEY = "hxyfront-62002-rehearsal-review-v1";

function loadState(): RehearsalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RehearsalState;
      if (parsed && Array.isArray(parsed.cues) && Array.isArray(parsed.fixtures)) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回落到示例数据
  }
  return createSeedState();
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export interface RegisterRunInput {
  plannedTime: string;
  actualTime: string;
  operator: string;
  reason: string;
}

interface StoreValue {
  state: RehearsalState;
  /** 登记一次试运行（普通排练；偏差超 8s 或操作人为空会自动标记待复核） */
  registerRun: (cueId: string, input: RegisterRunInput) => ValidationResult;
  /** 登记导演处理结论（只有 pending_review 阶段允许） */
  submitReview: (
    cueId: string,
    input: { conclusion: string; director: string }
  ) => ValidationResult;
  /**
   * 登记复演；若复演合规则直接放行当前 Cue（只解除这一个 Cue），
   * 若仍超差则保留导演结论、维持锁定，需继续复演。
   */
  registerRerun: (cueId: string, input: RegisterRunInput) => ValidationResult;
  /** 调整亮度/焦点（待复核未处理时被锁定） */
  adjustLighting: (
    cueId: string,
    patch: Partial<Pick<Cue, "brightness" | "focusX" | "focusY">>
  ) => ValidationResult;
  updateShowName: (name: string) => void;
  addNote: (version: string, content: string) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function mapCue(state: RehearsalState, cueId: string, fn: (cue: Cue) => Cue): RehearsalState {
  return {
    ...state,
    cues: state.cues.map((cue) => (cue.id === cueId ? fn(cue) : cue)),
  };
}

function buildRun(input: RegisterRunInput, isRerun: boolean): RunRecord {
  const deviationSec = calcDeviationSec(input.plannedTime, input.actualTime) ?? 0;
  return {
    id: nextId("run"),
    plannedTime: input.plannedTime.trim(),
    actualTime: input.actualTime.trim(),
    deviationSec,
    operator: input.operator.trim(),
    reason: input.reason.trim(),
    isRerun,
    createdAt: new Date().toISOString(),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RehearsalState>(loadState);

  // 持久化：历史偏差与导演结论刷新后仍在
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储空间不足时忽略，不影响当前会话
    }
  }, [state]);

  const registerRun = useCallback((cueId: string, input: RegisterRunInput) => {
    const form = validateRunForm(input);
    if (!form.ok) return form;
    let result: ValidationResult = { ok: true, reason: "" };
    setState((prev) => {
      const cue = prev.cues.find((c) => c.id === cueId);
      if (!cue) return prev;
      const run = buildRun(input, false);
      // 登记新试运行后，针对本次运行重新进入复核流程
      result = { ok: true, reason: "" };
      return mapCue(prev, cueId, (c) => ({
        ...c,
        runs: [...c.runs, run],
        review: null,
        releasedRunId: null,
      }));
    });
    return result;
  }, []);

  const submitReview = useCallback(
    (cueId: string, input: { conclusion: string; director: string }) => {
      const form = validateReviewForm(input);
      if (!form.ok) return form;
      let result: ValidationResult = { ok: true, reason: "" };
      setState((prev) => {
        const cue = prev.cues.find((c) => c.id === cueId);
        if (!cue) return prev;
        const check = canSubmitReview(cue);
        if (!check.ok) {
          result = check;
          return prev;
        }
        const review: DirectorReview = {
          conclusion: input.conclusion.trim(),
          director: input.director.trim(),
          filledAt: new Date().toISOString(),
        };
        return mapCue(prev, cueId, (c) => ({ ...c, review }));
      });
      return result;
    },
    []
  );

  const registerRerun = useCallback((cueId: string, input: RegisterRunInput) => {
    const form = validateRunForm(input);
    if (!form.ok) return form;
    let result: ValidationResult = { ok: true, reason: "" };
    setState((prev) => {
      const cue = prev.cues.find((c) => c.id === cueId);
      if (!cue) return prev;
      const gate = canRegisterRerun(cue);
      if (!gate.ok) {
        result = gate;
        return prev;
      }
      const rerun = buildRun(input, true);
      const release = canReleaseAfterRerun(cue, rerun);
      if (release.ok) {
        // 复演通过：只解除当前 Cue；历史偏差全部保留
        result = { ok: true, reason: "复演通过，已解除该 Cue 锁定" };
        return mapCue(prev, cueId, (c) => ({
          ...c,
          runs: [...c.runs, rerun],
          releasedRunId: rerun.id,
        }));
      }
      // 复演仍超差：保留导演结论，继续锁定，等待再次复演
      result = { ok: false, reason: release.reason };
      return mapCue(prev, cueId, (c) => ({
        ...c,
        runs: [...c.runs, rerun],
        releasedRunId: null,
      }));
    });
    return result;
  }, []);

  const adjustLighting = useCallback(
    (cueId: string, patch: Partial<Pick<Cue, "brightness" | "focusX" | "focusY">>) => {
      let result: ValidationResult = { ok: true, reason: "" };
      setState((prev) => {
        const cue = prev.cues.find((c) => c.id === cueId);
        if (!cue) return prev;
        const gate = canAdjustLighting(cue);
        if (!gate.ok) {
          result = gate;
          return prev;
        }
        const next: Partial<Pick<Cue, "brightness" | "focusX" | "focusY">> = {};
        if (patch.brightness !== undefined) {
          next.brightness = Math.min(100, Math.max(0, Math.round(patch.brightness)));
        }
        if (patch.focusX !== undefined) next.focusX = Math.min(100, Math.max(0, patch.focusX));
        if (patch.focusY !== undefined) next.focusY = Math.min(100, Math.max(0, patch.focusY));
        return mapCue(prev, cueId, (c) => ({ ...c, ...next }));
      });
      return result;
    },
    []
  );

  const updateShowName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, showName: name }));
  }, []);

  const addNote = useCallback((version: string, content: string) => {
    if (!version.trim() || !content.trim()) return;
    setState((prev) => ({
      ...prev,
      notes: [
        {
          id: nextId("note"),
          version: version.trim(),
          content: content.trim(),
          updatedAt: new Date().toISOString(),
        },
        ...prev.notes,
      ],
    }));
  }, []);

  const resetAll = useCallback(() => {
    setState(createSeedState());
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      registerRun,
      submitReview,
      registerRerun,
      adjustLighting,
      updateShowName,
      addNote,
      resetAll,
    }),
    [state, registerRun, submitReview, registerRerun, adjustLighting, updateShowName, addNote, resetAll]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必须在 StoreProvider 内使用");
  return ctx;
}
