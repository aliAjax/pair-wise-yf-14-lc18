// 放行校验层（纯函数）
// 职责：把"什么条件下放行"集中在这里，界面层与状态层都不自己写规则。
// 规则来源：
//  1. 偏差 > 8s 或操作人为空 -> 待复核；
//  2. 待复核 Cue 锁定亮度与焦点，导演必须先填写处理结论；
//  3. 未复核时舞台图/预览/筛选统一显示锁定；
//  4. 复演通过只解除当前 Cue，历史偏差保留。

import type { TrialInput, TrialRun } from "../types";
import {
  evaluateTrial,
  type ConsoleStatus,
  type CueStatus,
} from "./deviation";
import { deviationSeconds } from "./time";

export interface GateResult {
  allowed: boolean;
  /** 阻止原因（界面原样展示）；allowed 时为空数组 */
  blockers: string[];
}

const pass: GateResult = { allowed: true, blockers: [] };
const deny = (...blockers: string[]): GateResult => ({ allowed: false, blockers });

/** 登记前的表单校验（计划/实际时间必须可解析） */
export function validateTrialInput(input: TrialInput): GateResult {
  const blockers: string[] = [];
  if (!input.plannedAt.trim()) blockers.push("计划触发时间必填");
  if (!input.actualAt.trim()) blockers.push("实际触发时间必填");
  if (blockers.length === 0) {
    const dev = deviationSeconds(input.plannedAt, input.actualAt);
    if (dev === null) blockers.push("时间码格式应为 HH:MM:SS");
  }
  return blockers.length ? deny(...blockers) : pass;
}

/** 登记试运行时的即时评估结果（供 reducer 落库 flagged/deviation） */
export function assessRegistration(input: TrialInput): {
  deviation: number | null;
  flagged: boolean;
  reasons: string[];
} {
  const dev = deviationSeconds(input.plannedAt, input.actualAt);
  return evaluateTrial(input.plannedAt, input.actualAt, input.operator, dev);
}

/**
 * 能否登记"复演"：
 * - 该 Cue 必须已被导演准予复演（replay-ready）；
 * - 普通试运行（run）任何时候都可以登记。
 */
export function canRegister(input: TrialInput, status: ConsoleStatus): GateResult {
  const form = validateTrialInput(input);
  if (!form.allowed) return form;
  if (input.kind !== "replay") return pass;

  const cs = status.cueStatuses[input.cueId];
  if (!cs) return deny("Cue 不存在");
  if (cs.lock === "open") return deny("该 Cue 当前不在锁定状态，无需复演，直接登记试运行即可");
  if (cs.lock === "awaiting-review") return deny("导演尚未填写处理结论，不能复演");
  return pass; // replay-ready
}

/** 导演能否提交处理结论：Cue 必须处于待复核状态 */
export function canSubmitReview(
  cueId: string,
  status: ConsoleStatus,
  review: { director: string; conclusion: string },
): GateResult {
  const blockers: string[] = [];
  const cs = status.cueStatuses[cueId];
  if (!cs) return deny("Cue 不存在");
  if (cs.lock !== "awaiting-review") {
    blockers.push("该 Cue 没有待复核偏差，无需处理结论");
  }
  if (!review.director.trim()) blockers.push("导演签名必填");
  if (!review.conclusion.trim()) blockers.push("处理结论必填");
  return blockers.length ? deny(...blockers) : pass;
}

/** 复演是否合格：复演记录本身不命中任何待复核规则才算通过 */
export function isReplayPassed(trial: TrialRun): boolean {
  return trial.kind === "replay" && !trial.flagged;
}

/**
 * 调整亮度/焦点门禁：
 * 只要有任意待复核（未结）Cue 锁定该灯具，就禁止调整。
 * 舞台图、预览共用此结果，保证"统一显示锁定"。
 */
export function canAdjustFixture(
  fixtureId: string,
  status: ConsoleStatus,
): GateResult {
  const hit = Object.values(status.cueStatuses).find(
    (cs) => cs.lock !== "open" && cs.cue.fixtureIds.includes(fixtureId),
  );
  if (!hit) return pass;
  return deny(
    `灯具被 ${hit.cue.no} ${hit.cue.name} 的待复核 Cue 锁定，` +
      `须导演填写处理结论并复演通过后才能调整`,
  );
}

/** Cue 行内的状态描述（界面徽标文案） */
export function lockLabel(cs: CueStatus): string {
  switch (cs.lock) {
    case "awaiting-review":
      return "待复核 · 已锁定";
    case "replay-ready":
      return "待复演 · 已锁定";
    case "open":
      return "放行";
  }
}
