// 纯 Node 状态机测试：验证状态计算层 + 放行校验层的完整复核流程
import { createInitialState } from "../src/lib/initialData";
import { deriveStatus } from "../src/lib/deviation";
import {
  canAdjustFixture,
  canRegister,
  canSubmitReview,
} from "../src/lib/clearance";
import type { ConsoleState, TrialInput, ReviewInput } from "../src/types";

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${msg}`);
  }
}

function status(s: ConsoleState) {
  return deriveStatus(s.cues, s.trials, s.selectedCueId);
}

// 给登记时间加可控毫秒数，保证同批登记先后稳定
let clock = Date.UTC(2026, 8, 22, 20, 0, 0);
function makeTrial(s: ConsoleState, input: TrialInput): ConsoleState {
  // 复刻 reducer 中 register 的落库逻辑（不经 UI）
  const deviations: Record<string, number> = {};
  const parts = (v: string) => {
    const [h, m, sec] = v.split(":").map(Number);
    return h * 3600 + m * 60 + sec;
  };
  const dev = parts(input.actualAt) - parts(input.plannedAt);
  void deviations;
  const reasons: string[] = [];
  if (Math.abs(dev) > 8) reasons.push(`偏差 ${dev > 0 ? "+" : ""}${dev}s，超过 8 秒`);
  if (!input.operator.trim()) reasons.push("操作人为空");
  const flagged = reasons.length > 0;

  const pre = status(s);
  const active = pre.cueStatuses[input.cueId]?.activeTrial ?? null;
  const closes = input.kind === "replay" && !flagged && active ? active.id : null;

  clock += 1000;
  return {
    ...s,
    trials: [
      ...s.trials,
      {
        id: `t-test-${clock}`,
        cueId: input.cueId,
        kind: input.kind,
        plannedAt: input.plannedAt,
        actualAt: input.actualAt,
        operator: input.operator.trim(),
        reason: input.reason.trim(),
        deviationSec: dev,
        flagged,
        flagReasons: reasons,
        review: null,
        closesTrialId: closes,
        createdAt: new Date(clock).toISOString(),
      },
    ],
  };
}

function review(s: ConsoleState, input: ReviewInput): ConsoleState {
  const st = status(s);
  const activeId = st.cueStatuses[input.cueId]?.activeTrial?.id ?? null;
  if (!activeId) return s;
  clock += 1000;
  return {
    ...s,
    trials: s.trials.map((t) =>
      t.id === activeId
        ? {
            ...t,
            review: {
              director: input.director,
              conclusion: input.conclusion,
              allowReplay: input.allowReplay,
              decidedAt: new Date(clock).toISOString(),
            },
          }
        : t,
    ),
  };
}

// ---------- 场景 A：偏差 11s 全流程 ----------
console.log("场景 A：偏差 +11s -> 待复核 -> 锁定 -> 导演结论 -> 复演通过 -> 仅解本 Cue");
let s = createInitialState();
const cue24 = "cue-24";
const foh1 = "FOH-01"; // 属于 Cue24
const s01 = "S-01"; // 不属于 Cue24

assert(status(s).cueStatuses[cue24].lock === "open", "Cue24 初始放行");
assert(canAdjustFixture(foh1, status(s)).allowed, "初始可调整 FOH-01");

s = makeTrial(s, {
  cueId: cue24, kind: "run",
  plannedAt: "00:22:40", actualAt: "00:22:51",
  operator: "阿敏", reason: "晚起光",
});
let st = status(s);
assert(st.cueStatuses[cue24].lock === "awaiting-review", "+11s 标记待复核");
assert(st.anyLock && st.pendingCount >= 2, "存在锁定（含初始 Cue18 + Cue24）");
assert(!canAdjustFixture(foh1, st).allowed, "FOH-01 被锁定，canAdjustFixture 拒绝");
assert(canAdjustFixture(s01, st).allowed, "不归属锁定 Cue 的 S-01 单灯门禁仍允许（界面统一另锁）");

// 未复核直接复演 -> 拒绝
const regBlocked = canRegister(
  { cueId: cue24, kind: "replay", plannedAt: "00:22:40", actualAt: "00:22:42", operator: "阿敏", reason: "" },
  st,
);
assert(!regBlocked.allowed && regBlocked.blockers.join("").includes("导演"), "未复核不能复演");

// 导演结论校验
const badReview = canSubmitReview(cue24, st, { director: "", conclusion: "" });
assert(!badReview.allowed, "导演签名/结论为空时拒绝提交");

s = review(s, { cueId: cue24, director: "导演·周", conclusion: "晚起光，提前一拍", allowReplay: true });
st = status(s);
assert(st.cueStatuses[cue24].lock === "replay-ready", "准予复演后进入待复演（仍锁定）");
assert(!canAdjustFixture(foh1, st).allowed, "待复演期间仍锁定亮度焦点");

// 复演偏差 2s，操作人齐全 -> 通过
s = makeTrial(s, {
  cueId: cue24, kind: "replay",
  plannedAt: "00:22:40", actualAt: "00:22:42",
  operator: "阿敏", reason: "复演",
});
st = status(s);
assert(st.cueStatuses[cue24].lock === "open", "复演通过，解除 Cue24");
assert(st.pendingCount === 1, "只解除当前 Cue：Cue18 仍待复核");
assert(st.cueStatuses["cue-18"].lock === "awaiting-review", "Cue18 锁定不受影响");
assert(st.anyLock, "因 Cue18 仍在，全局仍处锁定");

// 历史保留：+11s 那条仍在且状态为 resolved
const flagRow = s.trials.find((t) => t.cueId === cue24 && t.deviationSec === 11)!;
assert(!!flagRow, "历史 +11s 偏差记录保留");
assert(st.trialViews[flagRow.id].status === "resolved", "原 flagged 记录状态=复演已解除");

// ---------- 场景 B：操作人为空 ----------
console.log("场景 B：偏差合格但操作人为空 -> 待复核");
let b = createInitialState();
b = makeTrial(b, {
  cueId: "cue-20", kind: "run",
  plannedAt: "00:14:05", actualAt: "00:14:06",
  operator: "  ", reason: "",
});
const bst = status(b);
assert(bst.cueStatuses["cue-20"].lock === "awaiting-review", "操作人为空标记待复核");
assert(
  bst.cueStatuses["cue-20"].activeTrial!.flagReasons.includes("操作人为空"),
  "命中原因写明操作人为空",
);

// ---------- 场景 C：偏差恰好 8s 不算超标 ----------
console.log("场景 C：边界 8s");
let c = createInitialState();
c = makeTrial(c, {
  cueId: "cue-24", kind: "run",
  plannedAt: "00:22:40", actualAt: "00:22:48",
  operator: "小林", reason: "",
});
assert(status(c).cueStatuses["cue-24"].lock === "open", "恰好 +8s 不超标（>8 才算）");
c = makeTrial(c, {
  cueId: "cue-20", kind: "run",
  plannedAt: "00:14:05", actualAt: "00:14:14",
  operator: "小林", reason: "",
});
assert(status(c).cueStatuses["cue-20"].lock === "awaiting-review", "+9s 超标锁定");

// ---------- 场景 D：导演不准予复演 ----------
console.log("场景 D：导演结论暂不放行");
let d = createInitialState();
d = makeTrial(d, {
  cueId: "cue-24", kind: "run",
  plannedAt: "00:22:40", actualAt: "00:23:00",
  operator: "小林", reason: "",
});
d = review(d, { cueId: "cue-24", director: "导演·周", conclusion: "重来", allowReplay: false });
const dst = status(d);
assert(dst.cueStatuses["cue-24"].lock === "awaiting-review", "不准予复演则继续待复核锁定");
const replayDenied = canRegister(
  { cueId: "cue-24", kind: "replay", plannedAt: "00:22:40", actualAt: "00:22:41", operator: "小林", reason: "" },
  dst,
);
assert(!replayDenied.allowed, "待复核（未准复演）不能登记复演");

// ---------- 场景 E：复演又超标 -> 不解除，成为新待办 ----------
console.log("场景 E：复演本身超标");
let e = createInitialState();
e = makeTrial(e, {
  cueId: "cue-24", kind: "run",
  plannedAt: "00:22:40", actualAt: "00:22:51",
  operator: "小林", reason: "",
});
e = review(e, { cueId: "cue-24", director: "导演·周", conclusion: "再来", allowReplay: true });
e = makeTrial(e, {
  cueId: "cue-24", kind: "replay",
  plannedAt: "00:22:40", actualAt: "00:22:50",
  operator: "小林", reason: "复演仍晚",
});
const est = status(e);
assert(est.cueStatuses["cue-24"].lock === "awaiting-review", "复演 +10s 不解除，重新待复核");
const reps = e.trials.filter((t) => t.cueId === "cue-24");
const first = reps.find((t) => t.deviationSec === 11 && t.kind === "run")!;
assert(est.trialViews[first.id].status === "superseded", "原待复核记录被新的 flagged 复演覆盖（保留）");
assert(
  canSubmitReview("cue-24", est, { director: "导演·周", conclusion: "再处理" }).allowed,
  "新待办可再次提交导演结论",
);

// ---------- 场景 F：刷新持久化由 storage 保证（这里只验证纯状态可序列化） ----------
console.log("场景 F：可持久化");
const json = JSON.stringify(e);
const reparsed = JSON.parse(json) as ConsoleState;
assert(status(reparsed).cueStatuses["cue-24"].lock === "awaiting-review", "序列化往返后状态一致（刷新后仍在）");

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
