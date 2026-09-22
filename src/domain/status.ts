/**
 * 状态计算模块（纯函数）
 * 只负责根据 Cue 数据推导复核状态与锁定标记，不做任何放行判断与界面渲染。
 * 与放行校验（release.ts）分开维护。
 */
import type { Cue, CueStatus, RunRecord } from "../types";

/** 偏差阈值：偏差绝对值超过 8 秒即待复核 */
export const DEVIATION_LIMIT_SEC = 8;

/** 时间码 mm:ss（或 m:ss）转秒；无法解析返回 null */
export function parseTimeCode(value: string): number | null {
  const text = value.trim();
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(text);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 秒转 mm:ss */
export function formatTimeCode(totalSec: number): string {
  const safe = Math.max(0, Math.round(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 计算一次试运行的偏差秒数（实际 - 计划）；时间码非法返回 null */
export function calcDeviationSec(planned: string, actual: string): number | null {
  const p = parseTimeCode(planned);
  const a = parseTimeCode(actual);
  if (p === null || a === null) return null;
  return a - p;
}

/** 单次试运行是否触发待复核：偏差超过 8 秒，或操作人为空 */
export function isRunFlagged(run: Pick<RunRecord, "deviationSec" | "operator">): boolean {
  return Math.abs(run.deviationSec) > DEVIATION_LIMIT_SEC || run.operator.trim() === "";
}

/** 取最近一次试运行（复演也算） */
export function latestRun(cue: Pick<Cue, "runs">): RunRecord | null {
  return cue.runs.length === 0 ? null : cue.runs[cue.runs.length - 1];
}

/**
 * 推导 Cue 当前复核状态：
 * - 无试运行记录：normal（尚未排练，无需复核）
 * - 最近一次是已放行的复演：released
 * - 最近一次试运行被标记：
 *   - 导演已填写处理结论 → awaiting_rerun
 *   - 否则 → pending_review
 * - 最近一次试运行合规：normal（历史偏差仍保留在 runs 中）
 */
export function getCueStatus(cue: Cue): CueStatus {
  const run = latestRun(cue);
  if (!run) return "normal";
  if (cue.releasedRunId === run.id && run.isRerun) return "released";
  if (!isRunFlagged(run)) return "normal";
  return cue.review ? "awaiting_rerun" : "pending_review";
}

/** 处于待复核/待复演阶段时，亮度、焦点及灯位调整一律锁定 */
export function isCueLocked(cue: Cue): boolean {
  const status = getCueStatus(cue);
  return status === "pending_review" || status === "awaiting_rerun";
}

/** 舞台图 / 预览 / 筛选统一使用的锁定标记（未复核即锁定显示） */
export function isCueVisuallyLocked(cue: Cue): boolean {
  return isCueLocked(cue);
}

/** 该 Cue 是否存在历史偏差（即使已放行，历史偏差仍保留） */
export function hasDeviationHistory(cue: Cue): boolean {
  return cue.runs.some((run) => isRunFlagged(run));
}

/** 最近一次被标记的偏差（供复核面板定位） */
export function latestFlaggedRun(cue: Cue): RunRecord | null {
  for (let i = cue.runs.length - 1; i >= 0; i -= 1) {
    if (isRunFlagged(cue.runs[i])) return cue.runs[i];
  }
  return null;
}

export const STATUS_LABEL: Record<CueStatus, string> = {
  normal: "正常",
  pending_review: "待复核",
  awaiting_rerun: "待复演",
  released: "已放行",
};

/** 偏差的带符号展示，如 +12s / -9s / +3s */
export function formatDeviation(sec: number): string {
  const sign = sec > 0 ? "+" : sec < 0 ? "-" : "";
  return `${sign}${Math.abs(sec)}s`;
}
