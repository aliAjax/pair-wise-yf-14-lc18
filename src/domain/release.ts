/**
 * 放行校验模块（纯函数）
 * 只管"能不能调整灯位 / 能不能登记复演 / 能不能放行"，不计算状态、不碰界面。
 * 规则：
 *  - Cue 未复核（待复核）时锁定亮度、焦点，灯位调整一律拒绝；
 *  - 导演必须填写处理结论（结论非空），才能调整灯位、登记复演；
 *  - 复演通过只解除当前 Cue：本次复演必须合规（偏差 ≤ 8s 且操作人非空）；
 *  - 历史偏差保留，放行后刷新仍在。
 */
import type { Cue, DirectorReview, RunRecord } from "../types";
import { getCueStatus, isRunFlagged } from "./status";

export interface ValidationResult {
  ok: boolean;
  reason: string;
}

export const PASS: ValidationResult = { ok: true, reason: "" };

export function fail(reason: string): ValidationResult {
  return { ok: false, reason };
}

/** 试运行登记表单校验：时间码合法、计划/实际齐全 */
export function validateRunForm(input: {
  plannedTime: string;
  actualTime: string;
}): ValidationResult {
  const planned = input.plannedTime.trim();
  const actual = input.actualTime.trim();
  if (!planned || !actual) return fail("请填写计划触发时间与实际触发时间（mm:ss）");
  const mm = /^(\d{1,2}):([0-5]\d)$/;
  if (!mm.test(planned)) return fail("计划触发时间格式应为 mm:ss");
  if (!mm.test(actual)) return fail("实际触发时间格式应为 mm:ss");
  return PASS;
}

/** 导演结论是否有效（处理结论与导演姓名均非空） */
export function isReviewFilled(review: DirectorReview | null): boolean {
  if (!review) return false;
  return review.conclusion.trim().length > 0 && review.director.trim().length > 0;
}

/**
 * 调整灯位（亮度 / 焦点 / 灯具位置）前的放行校验。
 * - Cue 处于正常或已放行：允许；
 * - 待复核：导演未填写处理结论，拒绝；
 * - 待复演：导演已填写处理结论，允许调整（调整后仍需复演通过才放行）。
 */
export function canAdjustLighting(cue: Cue): ValidationResult {
  const status = getCueStatus(cue);
  if (status === "normal" || status === "released") return PASS;
  if (status === "pending_review") {
    return fail("Cue 待复核：须由导演先填写处理结论，才能调整灯位");
  }
  if (!isReviewFilled(cue.review)) {
    return fail("导演处理结论缺失，不能调整灯位");
  }
  return PASS;
}

/** 是否可以登记导演处理结论（必须存在被标记的偏差且尚未填写） */
export function canSubmitReview(cue: Cue): ValidationResult {
  const status = getCueStatus(cue);
  if (status === "normal" || status === "released") return fail("该 Cue 没有待处理的偏差");
  if (status === "awaiting_rerun") return fail("处理结论已填写，请直接登记复演");
  return PASS;
}

/** 导演结论表单校验 */
export function validateReviewForm(input: {
  conclusion: string;
  director: string;
}): ValidationResult {
  if (!input.conclusion.trim()) return fail("请填写处理结论");
  if (!input.director.trim()) return fail("请填写导演姓名");
  return PASS;
}

/** 是否可以登记复演（导演结论已填写后才允许复演） */
export function canRegisterRerun(cue: Cue): ValidationResult {
  const status = getCueStatus(cue);
  if (status !== "awaiting_rerun") {
    return fail("须先由导演填写处理结论，才能登记复演");
  }
  return PASS;
}

/**
 * 复演通过放行校验：复演记录必须合规，且当前处于待复演阶段。
 * 放行只解除当前 Cue（调用方只更新该 Cue 的 releasedRunId）。
 */
export function canReleaseAfterRerun(cue: Cue, rerun: RunRecord): ValidationResult {
  if (getCueStatus(cue) !== "awaiting_rerun") {
    return fail("仅在导演结论后的待复演阶段可放行");
  }
  if (!rerun.isRerun) return fail("放行必须基于一次复演记录");
  if (isRunFlagged(rerun)) {
    return fail("复演仍超差（偏差超过 8 秒或操作人为空），继续锁定，保留导演结论并重新复演");
  }
  return PASS;
}
