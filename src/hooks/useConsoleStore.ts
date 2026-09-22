// 状态层：reducer + 持久化
// 只管状态如何变化；"能不能做"由 clearance.ts 决定，界面层调用前先问门禁。

import { useEffect, useMemo, useReducer } from "react";
import type {
  ConsoleState,
  Fixture,
  ReviewInput,
  TrialInput,
  TrialRun,
} from "../types";
import { createInitialState } from "../lib/initialData";
import { loadState, saveState, clearState } from "../lib/storage";
import { assessRegistration } from "../lib/clearance";
import { deriveStatus, type ConsoleStatus } from "../lib/deviation";

let seq = 0;
/** 单调递增 + 时间戳，保证同毫秒登记也有稳定先后（状态计算依赖 createdAt 排序） */
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

type Action =
  | { type: "register"; input: TrialInput }
  | { type: "submit-review"; input: ReviewInput }
  | { type: "select-cue"; cueId: string }
  | { type: "toggle-type"; fixtureType: Fixture["type"] }
  | { type: "update-fixture"; fixtureId: string; patch: Partial<Pick<Fixture, "brightness" | "focus" | "x" | "y" | "gel">> }
  | { type: "update-show"; patch: Partial<ConsoleState["show"]> }
  | { type: "reset" };

function reducer(state: ConsoleState, action: Action): ConsoleState {
  switch (action.type) {
    case "register": {
      const { input } = action;
      const assessment = assessRegistration(input);
      const preStatus = deriveStatus(state.cues, state.trials, input.cueId);
      const active = preStatus.cueStatuses[input.cueId]?.activeTrial ?? null;
      const replayPasses =
        input.kind === "replay" && !assessment.flagged && active !== null;
      const run: TrialRun = {
        id: nextId("t"),
        cueId: input.cueId,
        kind: input.kind,
        plannedAt: input.plannedAt,
        actualAt: input.actualAt,
        operator: input.operator.trim(),
        reason: input.reason.trim(),
        deviationSec: assessment.deviation ?? 0,
        flagged: assessment.flagged,
        flagReasons: assessment.reasons,
        review: null,
        // 复演通过只解除当前 Cue：记录它关闭的是哪条待复核登记
        closesTrialId: replayPasses ? active.id : null,
        createdAt: new Date().toISOString(),
      };
      return { ...state, trials: [...state.trials, run] };
    }

    case "submit-review": {
      const { input } = action;
      // 结论只能挂在该 Cue 当前活跃的待复核记录上，历史记录不动
      const cs = deriveStatus(state.cues, state.trials, input.cueId)
        .cueStatuses[input.cueId];
      const activeId = cs?.activeTrial?.id ?? null;
      if (!activeId) return state;
      return {
        ...state,
        trials: state.trials.map((t) =>
          t.id === activeId
            ? {
                ...t,
                review: {
                  director: input.director.trim(),
                  conclusion: input.conclusion.trim(),
                  allowReplay: input.allowReplay,
                  decidedAt: new Date().toISOString(),
                },
              }
            : t,
        ),
      };
    }

    case "select-cue":
      return { ...state, selectedCueId: action.cueId };

    case "toggle-type": {
      const exists = state.activeTypes.includes(action.fixtureType);
      return {
        ...state,
        activeTypes: exists
          ? state.activeTypes.filter((t) => t !== action.fixtureType)
          : [...state.activeTypes, action.fixtureType],
      };
    }

    case "update-fixture":
      return {
        ...state,
        fixtures: state.fixtures.map((f) =>
          f.id === action.fixtureId ? { ...f, ...action.patch } : f,
        ),
      };

    case "update-show":
      return { ...state, show: { ...state.show, ...action.patch } };

    case "reset":
      return createInitialState();

    default:
      return state;
  }
}

export interface ConsoleStore {
  state: ConsoleState;
  status: ConsoleStatus;
  registerTrial: (input: TrialInput) => void;
  submitReview: (input: ReviewInput) => void;
  selectCue: (cueId: string) => void;
  toggleType: (fixtureType: Fixture["type"]) => void;
  updateFixture: (
    fixtureId: string,
    patch: Partial<Pick<Fixture, "brightness" | "focus" | "x" | "y" | "gel">>,
  ) => void;
  updateShow: (patch: Partial<ConsoleState["show"]>) => void;
  reset: () => void;
}

export function useConsoleStore(): ConsoleStore {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  // 持久化：每次状态变化都落盘，刷新后待复核与历史偏差仍在
  useEffect(() => {
    saveState(state);
  }, [state]);

  // 状态计算与状态存储分开维护：派生结果在这里统一得出
  const status = useMemo(
    () => deriveStatus(state.cues, state.trials, state.selectedCueId),
    [state.cues, state.trials, state.selectedCueId],
  );

  return {
    state,
    status,
    registerTrial: (input) => dispatch({ type: "register", input }),
    submitReview: (input) => dispatch({ type: "submit-review", input }),
    selectCue: (cueId) => dispatch({ type: "select-cue", cueId }),
    toggleType: (fixtureType) => dispatch({ type: "toggle-type", fixtureType }),
    updateFixture: (fixtureId, patch) =>
      dispatch({ type: "update-fixture", fixtureId, patch }),
    updateShow: (patch) => dispatch({ type: "update-show", patch }),
    reset: () => {
      clearState();
      dispatch({ type: "reset" });
    },
  };
}
