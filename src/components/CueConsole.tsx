// Cue 列表 + 试运行登记 + 导演处理结论 + 复演放行
// 这里只负责收集输入与展示；是否允许由 clearance.ts 的门禁决定。

import { useMemo, useState } from "react";
import type { ConsoleState, ReviewInput, TrialInput } from "../types";
import type { ConsoleStatus, CueStatus } from "../lib/deviation";
import {
  canRegister,
  canSubmitReview,
  isReplayPassed,
  lockLabel,
  type GateResult,
} from "../lib/clearance";
import { DEVIATION_TOLERANCE_SEC } from "../lib/deviation";
import { formatSigned, normalizeClock } from "../lib/time";

interface CueConsoleProps {
  state: ConsoleState;
  status: ConsoleStatus;
  onRegister: (input: TrialInput) => void;
  onSubmitReview: (input: ReviewInput) => void;
  onSelect: (cueId: string) => void;
  onGateDeny: (gate: GateResult) => void;
}

export function CueConsole({
  state,
  status,
  onRegister,
  onSubmitReview,
  onSelect,
  onGateDeny,
}: CueConsoleProps) {
  const orderedCues = useMemo(
    () => [...state.cues].sort((a, b) => a.order - b.order),
    [state.cues],
  );

  return (
    <section className="panel cue-panel">
      <div className="heading">
        <div>
          <p>Cue 触发顺序</p>
          <h2>偏差复核台</h2>
        </div>
        <span className="hint">
          判定线：偏差 &gt; {DEVIATION_TOLERANCE_SEC}s 或操作人为空 → 待复核
        </span>
      </div>

      <div className="cue-list">
        {orderedCues.map((cue) => (
          <CueCard
            key={cue.id}
            cs={status.cueStatuses[cue.id]}
            selected={cue.id === state.selectedCueId}
            state={state}
            status={status}
            onSelect={() => onSelect(cue.id)}
            onRegister={onRegister}
            onSubmitReview={onSubmitReview}
            onGateDeny={onGateDeny}
          />
        ))}
      </div>
    </section>
  );
}

interface CardProps {
  cs: CueStatus;
  selected: boolean;
  state: ConsoleState;
  status: ConsoleStatus;
  onSelect: () => void;
  onRegister: CueConsoleProps["onRegister"];
  onSubmitReview: CueConsoleProps["onSubmitReview"];
  onGateDeny: (gate: GateResult) => void;
}

function CueCard({
  cs,
  selected,
  state,
  status,
  onSelect,
  onRegister,
  onSubmitReview,
  onGateDeny,
}: CardProps) {
  const { cue } = cs;
  const [plannedAt, setPlannedAt] = useState(cue.plannedAt);
  const [actualAt, setActualAt] = useState("");
  const [operator, setOperator] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const [director, setDirector] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [allowReplay, setAllowReplay] = useState(true);
  const [reviewErrors, setReviewErrors] = useState<string[]>([]);

  const active = cs.activeTrial;
  const cueTrials = state.trials
    .filter((t) => t.cueId === cue.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function submit(kind: "run" | "replay") {
    const input = { cueId: cue.id, kind, plannedAt, actualAt, operator, reason };
    const gate = canRegister(input, status);
    if (!gate.allowed) {
      onGateDeny(gate);
      setErrors(gate.blockers);
      return;
    }
    onRegister(input);
    setErrors([]);
    setActualAt("");
    setReason("");
    // 操作人保留，方便同一灯光师连续登记；计划时间回到 Cue 基准
    setPlannedAt(cue.plannedAt);
  }

  function submitDirector() {
    const gate = canSubmitReview(cue.id, status, { director, conclusion });
    if (!gate.allowed) {
      onGateDeny(gate);
      setReviewErrors(gate.blockers);
      return;
    }
    onSubmitReview({ cueId: cue.id, director, conclusion, allowReplay });
    setReviewErrors([]);
    setDirector("");
    setConclusion("");
  }

  return (
    <article className={`cue-card ${cs.lock} ${selected ? "selected" : ""}`}>
      <button className="cue-head" onClick={onSelect}>
        <span className="cue-no">{cue.no}</span>
        <span className="cue-name">{cue.name}</span>
        <span className={`lock-chip ${cs.lock}`}>{lockLabel(cs)}</span>
        <span className="cue-meta">
          计划 {normalizeClock(cue.plannedAt)} · {cue.fixtureIds.length} 灯 · 登记 {cs.trialCount} 次
        </span>
      </button>

      {selected && (
        <div className="cue-body">
          <p className="cue-memo">{cue.memo}</p>

          {active && (
            <div className={`active-trial ${cs.lock}`}>
              <h4>
                {cs.lock === "awaiting-review" ? "⚠️ 当前待复核偏差" : "🎭 导演已结，等待复演"}
              </h4>
              <div className="trial-facts">
                <span>登记时间 {new Date(active.createdAt).toLocaleString("zh-CN")}</span>
                <span>计划 {normalizeClock(active.plannedAt)}</span>
                <span>实际 {normalizeClock(active.actualAt)}</span>
                <span className={active.deviationSec === 0 ? "" : "deviate"}>
                  偏差 {formatSigned(active.deviationSec)}
                </span>
                <span>操作人：{active.operator || <b className="warn">未填写</b>}</span>
              </div>
              <ul className="flag-reasons">
                {active.flagReasons.map((r) => <li key={r}>⚠️ {r}</li>)}
              </ul>
              {active.reason && <p className="reason">偏差原因：{active.reason}</p>}

              {active.review && (
                <div className="review-box">
                  <p>
                    <b>导演 {active.review.director}</b>
                    <em>{new Date(active.review.decidedAt).toLocaleString("zh-CN")}</em>
                  </p>
                  <p>{active.review.conclusion}</p>
                  <span className={`verdict ${active.review.allowReplay ? "allow" : "deny"}`}>
                    结论：{active.review.allowReplay ? "准予复演，复演通过后解锁本 Cue" : "暂不放行，需重新排练"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 登记区：待复核时只能登记复演，且必须先有导演"准予复演"结论 */}
          <div className="trial-form">
            <h4>{cs.lock === "replay-ready" ? "复演登记" : "试运行登记"}</h4>
            <div className="form-grid">
              <label>
                <span>计划触发时间</span>
                <input value={plannedAt} onChange={(e) => setPlannedAt(e.target.value)} placeholder="HH:MM:SS" />
              </label>
              <label>
                <span>实际触发时间</span>
                <input value={actualAt} onChange={(e) => setActualAt(e.target.value)} placeholder="HH:MM:SS" />
              </label>
              <label>
                <span>操作人{cs.lock === "awaiting-review" && "（留空将再次标记待复核）"}</span>
                <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="如：小林" />
              </label>
              <label className="wide">
                <span>偏差原因</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：追光跟手慢、机械推杆卡顿" />
              </label>
            </div>
            {errors.length > 0 && (
              <ul className="form-errors">{errors.map((e2) => <li key={e2}>{e2}</li>)}</ul>
            )}
            <div className="form-actions">
              {cs.lock === "replay-ready" ? (
                <>
                  <button className="primary" onClick={() => submit("replay")}>
                    登记复演（偏差≤{DEVIATION_TOLERANCE_SEC}s 且操作人齐全即通过，只解锁本 Cue）
                  </button>
                  <button onClick={() => submit("run")}>作为新试运行登记</button>
                </>
              ) : cs.lock === "awaiting-review" ? (
                <button disabled title="导演未填写处理结论">
                  🔒 复演已锁定：等待导演处理结论
                </button>
              ) : (
                <button className="primary" onClick={() => submit("run")}>
                  登记试运行
                </button>
              )}
            </div>
          </div>

          {/* 导演处理结论：调整灯位前必须完成 */}
          {cs.lock === "awaiting-review" && (
            <div className="review-form">
              <h4>🎭 导演处理结论（调整灯位前必填）</h4>
              <div className="form-grid">
                <label>
                  <span>导演签名</span>
                  <input value={director} onChange={(e) => setDirector(e.target.value)} placeholder="如：导演·周" />
                </label>
                <label className="wide">
                  <span>处理结论</span>
                  <input value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="原因判断、修正措施、是否准予复演" />
                </label>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={allowReplay}
                  onChange={(e) => setAllowReplay(e.target.checked)}
                />
                准予复演（不勾选则保持锁定，退回重新排练）
              </label>
              {reviewErrors.length > 0 && (
                <ul className="form-errors">{reviewErrors.map((e2) => <li key={e2}>{e2}</li>)}</ul>
              )}
              <div className="form-actions">
                <button className="primary" onClick={submitDirector}>提交处理结论</button>
              </div>
            </div>
          )}

          {/* 该 Cue 的历史登记：偏差记录保留，刷新后仍在 */}
          <details className="history" open={selected}>
            <summary>本 Cue 登记历史（{cueTrials.length}）</summary>
            <ul>
              {cueTrials.map((t) => {
                const view = status.trialViews[t.id];
                return (
                  <li key={t.id} className={t.flagged ? "flagged-row" : ""}>
                    <span className={`kind ${t.kind}`}>{t.kind === "replay" ? "复演" : "试运行"}</span>
                    <span>{new Date(t.createdAt).toLocaleString("zh-CN")}</span>
                    <span>{normalizeClock(t.actualAt)}</span>
                    <span className={t.flagged || t.deviationSec !== 0 ? "deviate" : ""}>
                      {formatSigned(t.deviationSec)}
                    </span>
                    <span>{t.operator || <b className="warn">操作人缺失</b>}</span>
                    <span className={`status-tag ${view?.status}`}>
                      {view && statusLabel(view.status, t.flagged, isReplayPassed(t))}
                    </span>
                    {t.review && <span className="reviewed-tag">已结：{t.review.director}</span>}
                    {t.closesTrialId && <span className="closes-tag">复演通过，解除本 Cue</span>}
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      )}
    </article>
  );
}

function statusLabel(
  status: "flagged" | "reviewed" | "resolved" | "superseded" | "cleared",
  flagged: boolean,
  replayPassed: boolean,
): string {
  switch (status) {
    case "flagged":
      return "待复核";
    case "reviewed":
      return "待复演";
    case "resolved":
      return replayPassed || flagged ? "复演通过已解除" : "已闭环";
    case "superseded":
      return "被新偏差登记覆盖";
    case "cleared":
      return "通过";
  }
}
