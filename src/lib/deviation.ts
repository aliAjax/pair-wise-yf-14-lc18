// 状态计算层（纯函数，无 React、无副作用）
// 职责：根据登记数据派生 待复核标记、Cue 状态、锁定状态、可见灯具。
// 界面层只读这里的结果；放行规则见 clearance.ts。

import type { Cue, Fixture, FixtureType, TrialRun } from "../types";

/** 偏差容忍上限：超过（含等于判定时按"超过"语义取 >）8 秒即待复核 */
export const DEVIATION_TOLERANCE_SEC = 8;

export interface Evaluation {
  deviation: number | null;
  flagged: boolean;
  reasons: string[];
}

/**
 * 单条试运行的偏差评估：
 * - 偏差超过 8 秒（绝对偏差 > 8）-> 待复核
 * - 操作人为空 -> 待复核
 */
export function evaluateTrial(
  plannedAt: string,
  actualAt: string,
  operator: string,
  deviation: number | null,
): Evaluation {
  const reasons: string[] = [];
  if (deviation !== null && Math.abs(deviation) > DEVIATION_TOLERANCE_SEC) {
    reasons.push(`偏差 ${deviation > 0 ? "+" : ""}${deviation}s，超过 ${DEVIATION_TOLERANCE_SEC} 秒`);
  }
  if (!operator.trim()) {
    reasons.push("操作人为空");
  }
  return { deviation, flagged: reasons.length > 0, reasons };
}

/** 一条登记记录当前的生命周期状态（历史视角） */
export type TrialStatus = "flagged" | "reviewed" | "resolved" | "superseded" | "cleared";

export interface TrialView extends TrialRun {
  status: TrialStatus;
}

export type CueLockState = "open" | "awaiting-review" | "replay-ready";

export interface CueStatus {
  cue: Cue;
  lock: CueLockState;
  activeTrial: TrialView | null; // 当前挂在该 Cue 上的待办（待复核 / 待复演）
  trialCount: number;
  flagCount: number;
  lastRun: TrialView | null;
}

export interface ConsoleStatus {
  cueStatuses: Record<string, CueStatus>;
  trialViews: Record<string, TrialView>;
  resolvedTrialIds: Set<string>;
  selectedCue: CueStatus | null;
  pendingCount: number; // 待复核（等待导演结论）的 Cue 数
  replayReadyCount: number; // 已结准予复演、等待复演通过的 Cue 数
  lockedCueCount: number; // 所有被锁定的 Cue 数
  /** 当前是否存在任意被锁定的 Cue —— 舞台图/预览/筛选统一锁定的依据 */
  anyLock: boolean;
}

/**
 * 核心状态派生。
 *
 * 记录按 createdAt 顺序处理：
 * - flagged 试运行：成为该 Cue 的活跃待办（待复核），历史偏差保留；
 * - 导演提交"准予复演"结论：活跃待办进入 replay-ready，Cue 仍锁定；
 * - 该 Cue 之后出现一条未命中待复核规则的"复演"：复演通过，
 *   只解除当前 Cue（关闭活跃待办与原 flagged 记录）；
 * - flagged 的复演不解除任何东西，本身成为新的活跃待办。
 */
export function deriveStatus(
  cues: Cue[],
  trials: TrialRun[],
  selectedCueId: string,
): ConsoleStatus {
  const ordered = [...trials].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const activeByCue = new Map<string, TrialRun>();
  const resolvedIds = new Set<string>();

  for (const t of ordered) {
    if (t.kind === "replay" && !t.flagged) {
      // 复演通过：只解除当前 Cue，历史偏差保留
      const active = activeByCue.get(t.cueId);
      if (active) {
        resolvedIds.add(active.id);
        if (active.id !== t.id) resolvedIds.add(t.id);
        activeByCue.delete(t.cueId);
      } else {
        resolvedIds.add(t.id);
      }
      continue;
    }
    if (t.flagged) {
      activeByCue.set(t.cueId, t); // 后一条覆盖前一条（前一条留在历史里）
    }
  }

  const trialViews: Record<string, TrialView> = {};
  for (const t of ordered) {
    const active = activeByCue.get(t.cueId);
    let status: TrialStatus;
    if (active && active.id === t.id) {
      status = t.review ? "reviewed" : "flagged";
    } else if (resolvedIds.has(t.id)) {
      status = "resolved";
    } else if (t.flagged) {
      // 命中过待复核但已被更新的 flagged 登记取代：Cue 仍锁，旧记录保留
      status = "superseded";
    } else {
      status = "cleared"; // 普通通过的试运行
    }
    trialViews[t.id] = { ...t, status };
  }

  const cueStatuses: Record<string, CueStatus> = {};
  let pendingCount = 0;
  let replayReadyCount = 0;

  for (const cue of cues) {
    const cueTrials = ordered.filter((t) => t.cueId === cue.id);
    const activeRaw = activeByCue.get(cue.id) ?? null;
    const activeTrial = activeRaw ? trialViews[activeRaw.id] : null;

    let lock: CueLockState = "open";
    if (activeTrial) {
      if (activeTrial.status === "reviewed" && activeTrial.review?.allowReplay) {
        lock = "replay-ready";
        replayReadyCount += 1;
      } else {
        lock = "awaiting-review";
        pendingCount += 1;
      }
    }

    cueStatuses[cue.id] = {
      cue,
      lock,
      activeTrial,
      trialCount: cueTrials.length,
      flagCount: cueTrials.filter((t) => t.flagged).length,
      lastRun: cueTrials.length ? trialViews[cueTrials[cueTrials.length - 1].id] : null,
    };
  }

  const lockedCueCount = pendingCount + replayReadyCount;

  return {
    cueStatuses,
    trialViews,
    resolvedTrialIds: resolvedIds,
    selectedCue: cueStatuses[selectedCueId] ?? null,
    pendingCount,
    replayReadyCount,
    lockedCueCount,
    anyLock: lockedCueCount > 0,
  };
}

/** 筛选：按灯位类型；无任何类型选中时视为全部可见 */
export function visibleFixtures(
  fixtures: Fixture[],
  activeTypes: FixtureType[],
): Fixture[] {
  if (activeTypes.length === 0) return fixtures;
  return fixtures.filter((f) => activeTypes.includes(f.type));
}

/** 待复核 Cue 锁定时，统一用该集合决定"哪些灯不能动" */
export function lockedFixtureIds(status: ConsoleStatus): Set<string> {
  const ids = new Set<string>();
  for (const cs of Object.values(status.cueStatuses)) {
    if (cs.lock !== "open") {
      cs.cue.fixtureIds.forEach((id) => ids.add(id));
    }
  }
  return ids;
}
