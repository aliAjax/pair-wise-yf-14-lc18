import { useEffect, useState } from "react";
import type { Cue } from "../types";
import { useStore, type RegisterRunInput } from "../store";
import { canRegisterRerun, canSubmitReview } from "../domain/release";
import {
  STATUS_LABEL,
  formatDeviation,
  getCueStatus,
  hasDeviationHistory,
  isCueLocked,
  latestFlaggedRun,
  latestRun,
} from "../domain/status";

interface CueDetailProps {
  cue: Cue | null;
  notify: (msg: string, ok?: boolean) => void;
}

const emptyRunForm: RegisterRunInput = {
  plannedTime: "",
  actualTime: "",
  operator: "",
  reason: "",
};

function RunForm({
  title,
  submitLabel,
  disabled,
  disabledHint,
  onSubmit,
  notify,
}: {
  title: string;
  submitLabel: string;
  disabled: boolean;
  disabledHint?: string;
  onSubmit: (input: RegisterRunInput) => { ok: boolean; reason: string };
  notify: (msg: string, ok?: boolean) => void;
}) {
  const [form, setForm] = useState<RegisterRunInput>(emptyRunForm);

  function submit() {
    const result = onSubmit(form);
    notify(result.ok ? `${submitLabel}登记成功` : result.reason, result.ok);
    if (result.ok) setForm(emptyRunForm);
  }

  return (
    <fieldset className="sub-form" disabled={disabled}>
      <legend>{title}</legend>
      {disabled && disabledHint && <p className="form-hint warn">{disabledHint}</p>}
      <div className="form-grid">
        <label>
          <span>计划触发时间 (mm:ss)</span>
          <input
            value={form.plannedTime}
            placeholder="02:10"
            onChange={(e) => setForm({ ...form, plannedTime: e.target.value })}
          />
        </label>
        <label>
          <span>实际触发时间 (mm:ss)</span>
          <input
            value={form.actualTime}
            placeholder="02:18"
            onChange={(e) => setForm({ ...form, actualTime: e.target.value })}
          />
        </label>
        <label>
          <span>操作人</span>
          <input
            value={form.operator}
            placeholder="留空将标记待复核"
            onChange={(e) => setForm({ ...form, operator: e.target.value })}
          />
        </label>
        <label className="span-2">
          <span>偏差原因</span>
          <input
            value={form.reason}
            placeholder="说明本次触发偏差原因"
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </label>
      </div>
      <button type="button" className="primary" onClick={submit}>
        {submitLabel}
      </button>
    </fieldset>
  );
}

/** 单个 Cue 的试运行登记 / 导演复核 / 复演 / 灯位调整工作台 */
export function CueDetail({ cue, notify }: CueDetailProps) {
  const { registerRun, submitReview, registerRerun, adjustLighting } = useStore();
  const [conclusion, setConclusion] = useState("");
  const [director, setDirector] = useState("");

  // 切换 Cue 时重置导演表单
  useEffect(() => {
    setConclusion(cue?.review?.conclusion ?? "");
    setDirector(cue?.review?.director ?? "");
  }, [cue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cue) {
    return (
      <section className="panel detail-panel">
        <div className="heading">
          <div>
            <p>排练偏差复核台</p>
            <h2>请选择一个 Cue</h2>
          </div>
        </div>
        <p className="empty-tip">选择左侧 Cue 后可登记试运行、填写导演处理结论并复演放行。</p>
      </section>
    );
  }

  const status = getCueStatus(cue);
  const cueId = cue.id;
  const locked = isCueLocked(cue);
  const lastRun = latestRun(cue);
  const flagged = latestFlaggedRun(cue);
  const reviewGate = canSubmitReview(cue);
  const rerunGate = canRegisterRerun(cue);

  function saveReview() {
    const result = submitReview(cueId, { conclusion, director });
    notify(
      result.ok ? "导演处理结论已登记，进入待复演" : result.reason,
      result.ok
    );
  }

  return (
    <section className="panel detail-panel">
      <div className="heading">
        <div>
          <p>排练偏差复核台</p>
          <h2>
            {cue.code} · {cue.name}
          </h2>
        </div>
        <span className={`status-badge status-${status}`}>{STATUS_LABEL[status]}</span>
      </div>

      {/* 灯位调整：未复核时锁定 */}
      <fieldset className="sub-form lighting-form" disabled={locked}>
        <legend>亮度与焦点（灯位调整）</legend>
        {locked && (
          <p className="form-hint warn">
            🔒 该 Cue 未复核，亮度与焦点已锁定；须由导演先填写处理结论。
          </p>
        )}
        <div className="form-grid">
          <label>
            <span>亮度预设：{cue.brightness}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={cue.brightness}
              onChange={(e) => {
                const r = adjustLighting(cue.id, { brightness: Number(e.target.value) });
                if (!r.ok) notify(r.reason, false);
              }}
            />
          </label>
          <label>
            <span>焦点 X：{cue.focusX.toFixed(0)}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={cue.focusX}
              onChange={(e) => {
                const r = adjustLighting(cue.id, {
                  focusX: Number(e.target.value),
                  focusY: cue.focusY,
                });
                if (!r.ok) notify(r.reason, false);
              }}
            />
          </label>
          <label>
            <span>焦点 Y：{cue.focusY.toFixed(0)}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={cue.focusY}
              onChange={(e) => {
                const r = adjustLighting(cue.id, {
                  focusX: cue.focusX,
                  focusY: Number(e.target.value),
                });
                if (!r.ok) notify(r.reason, false);
              }}
            />
          </label>
          <label className="span-2">
            <span>备注</span>
            <input value={cue.note} readOnly />
          </label>
        </div>
      </fieldset>

      {/* 导演处理结论 */}
      <fieldset className="sub-form review-form" disabled={!reviewGate.ok}>
        <legend>导演处理结论</legend>
        {!reviewGate.ok && <p className="form-hint">{reviewGate.reason}</p>}
        <div className="form-grid">
          <label className="span-2">
            <span>处理结论（调整灯位前必须填写）</span>
            <textarea
              rows={2}
              value={conclusion}
              placeholder="如：跟随指挥口令触发，亮度下调 5%"
              onChange={(e) => setConclusion(e.target.value)}
            />
          </label>
          <label>
            <span>导演姓名</span>
            <input value={director} placeholder="导演签字" onChange={(e) => setDirector(e.target.value)} />
          </label>
        </div>
        <button type="button" className="primary" onClick={saveReview}>
          提交处理结论
        </button>
        {cue.review && reviewGate.ok === false && status === "awaiting_rerun" && (
          <p className="form-hint ok">
            已由 {cue.review.director} 填写结论：{cue.review.conclusion}
          </p>
        )}
      </fieldset>

      {/* 试运行登记 */}
      <RunForm
        title="试运行登记"
        submitLabel="登记试运行"
        disabled={false}
        onSubmit={(input) => registerRun(cue.id, input)}
        notify={notify}
      />

      {/* 复演登记：只有待复演阶段开放 */}
      <RunForm
        title="复演登记（通过后仅解除当前 Cue）"
        submitLabel="登记复演并判定放行"
        disabled={!rerunGate.ok}
        disabledHint={rerunGate.reason}
        onSubmit={(input) => registerRerun(cue.id, input)}
        notify={notify}
      />

      {/* 试运行历史：偏差永久保留 */}
      <div className="run-history">
        <h3>
          试运行历史
          {hasDeviationHistory(cue) && <em className="history-tag">含历史偏差，永久保留</em>}
        </h3>
        {cue.runs.length === 0 && <p className="empty-tip">尚无试运行记录</p>}
        <div className="run-list">
          {[...cue.runs].reverse().map((run) => {
            const flaggedRun = Math.abs(run.deviationSec) > 8 || run.operator.trim() === "";
            return (
              <article key={run.id} className={"run-item" + (flaggedRun ? " flagged" : "")}>
                <header>
                  <span className={"run-badge" + (run.isRerun ? " rerun" : "")}>
                    {run.isRerun ? "复演" : "试运行"}
                  </span>
                  <b>
                    计划 {run.plannedTime} / 实际 {run.actualTime}
                  </b>
                  <span className={"dev" + (flaggedRun ? " bad" : "")}>
                    {formatDeviation(run.deviationSec)}
                  </span>
                  {cue.releasedRunId === run.id && <span className="released-tag">已放行</span>}
                </header>
                <p>
                  操作人：{run.operator.trim() || <em className="no-operator">空缺（待复核）</em>}
                </p>
                <p>偏差原因：{run.reason || "—"}</p>
              </article>
            );
          })}
        </div>
        {flagged && status !== "pending_review" && status !== "awaiting_rerun" && (
          <p className="form-hint">
            最近一次待复核偏差：{formatDeviation(flagged.deviationSec)}（{flagged.operator || "无操作人"}）
          </p>
        )}
        {lastRun && status === "released" && (
          <p className="form-hint ok">
            复演已通过，当前 Cue 锁定解除；此前历史偏差仍完整保留。
          </p>
        )}
      </div>
    </section>
  );
}
