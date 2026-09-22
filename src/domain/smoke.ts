/**
 * 纯逻辑冒烟测试：node --import tsx 运行（可选，devDependency 缺失时可跳过）。
 * 重点验证：状态计算、放行校验、复演只解除当前 Cue、历史偏差保留。
 */
import assert from "node:assert";
import type { Cue, RunRecord } from "../types";
import { getCueStatus, isCueLocked, isRunFlagged, calcDeviationSec } from "../domain/status";
import {
  canAdjustLighting,
  canRegisterRerun,
  canReleaseAfterRerun,
  canSubmitReview,
  validateRunForm,
} from "../domain/release";

function makeCue(partial: Partial<Cue> = {}): Cue {
  return {
    id: "c",
    code: "Cue 1",
    name: "t",
    order: 1,
    fixtureIds: [],
    brightness: 50,
    focusX: 50,
    focusY: 50,
    runs: [],
    review: null,
    releasedRunId: null,
    note: "",
    ...partial,
  };
}

function run(partial: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "r" + Math.random(),
    plannedTime: "01:00",
    actualTime: "01:00",
    deviationSec: 0,
    operator: "甲",
    reason: "",
    isRerun: false,
    createdAt: "",
    ...partial,
  };
}

// 偏差判定
assert.equal(isRunFlagged(run({ deviationSec: 8 })), false, "=8s 不标记");
assert.equal(isRunFlagged(run({ deviationSec: 9 })), true, ">8s 标记");
assert.equal(isRunFlagged(run({ deviationSec: -9 })), true, "早触发 9s 也标记");
assert.equal(isRunFlagged(run({ deviationSec: 1, operator: " " })), true, "无操作人标记");
assert.equal(calcDeviationSec("01:10", "01:00"), -10);
assert.equal(calcDeviationSec("bad", "01:00"), null);
assert.equal(validateRunForm({ plannedTime: "1:60", actualTime: "01:00" }).ok, false);

// 无记录 → 正常、不锁
let cue = makeCue();
assert.equal(getCueStatus(cue), "normal");
assert.equal(isCueLocked(cue), false);
assert.equal(canAdjustLighting(cue).ok, true);

// 超差 → 待复核、锁定、禁止调灯
cue = makeCue({ runs: [run({ deviationSec: 12 })] });
assert.equal(getCueStatus(cue), "pending_review");
assert.equal(isCueLocked(cue), true);
assert.equal(canAdjustLighting(cue).ok, false);
assert.equal(canSubmitReview(cue).ok, true);
assert.equal(canRegisterRerun(cue).ok, false);

// 导演结论 → 待复演，可调灯，不能重复提交结论
cue = { ...cue, review: { conclusion: "改跟口令", director: "导演", filledAt: "" } };
assert.equal(getCueStatus(cue), "awaiting_rerun");
assert.equal(isCueLocked(cue), true, "待复演仍锁定");
assert.equal(canAdjustLighting(cue).ok, true, "已有结论可调整灯位");
assert.equal(canSubmitReview(cue).ok, false);
assert.equal(canRegisterRerun(cue).ok, true);

// 复演仍超差 → 不放行，结论保留
const badRerun = run({ deviationSec: 10, isRerun: true });
assert.equal(canReleaseAfterRerun(cue, badRerun).ok, false);

// 复演合规 → 放行，仅当前 Cue
const goodRerun = run({ deviationSec: 1, isRerun: true });
assert.equal(canReleaseAfterRerun(cue, goodRerun).ok, true);
cue = { ...cue, runs: [...cue.runs, goodRerun], releasedRunId: goodRerun.id };
assert.equal(getCueStatus(cue), "released");
assert.equal(isCueLocked(cue), false);
assert.equal(canAdjustLighting(cue).ok, true);

// 历史偏差仍保留
assert.equal(cue.runs.length, 2);
assert.equal(isRunFlagged(cue.runs[0]), true);

// 只解除当前 Cue：另一个 Cue 不受影响
const other = makeCue({ id: "c2", runs: [run({ deviationSec: 20, operator: "" })] });
assert.equal(getCueStatus(other), "pending_review");
assert.equal(isCueLocked(other), true);

// 新的试运行会重新进入流程
cue = { ...cue, runs: [...cue.runs, run({ deviationSec: 20 })], review: null, releasedRunId: null };
assert.equal(getCueStatus(cue), "pending_review");

console.log("domain smoke tests passed");
