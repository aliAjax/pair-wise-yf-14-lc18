// 全局试运行历史：历史偏差保留，不可删除。支持按状态筛选。

import { useMemo, useState } from "react";
import type { ConsoleState } from "../types";
import type { ConsoleStatus, TrialStatus } from "../lib/deviation";
import { formatSigned, normalizeClock } from "../lib/time";

const FILTERS: { key: TrialStatus | "all" | "flagged-open"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "flagged-open", label: "待处理" },
  { key: "reviewed", label: "待复演" },
  { key: "resolved", label: "复演已解除" },
  { key: "cleared", label: "正常通过" },
];

export function RunHistory({
  state,
  status,
}: {
  state: ConsoleState;
  status: ConsoleStatus;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const cueById = useMemo(
    () => new Map(state.cues.map((c) => [c.id, c])),
    [state.cues],
  );

  const rows = useMemo(() => {
    return [...state.trials]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((t) => {
        const view = status.trialViews[t.id];
        if (onlyFlagged && !t.flagged) return false;
        if (filter === "all") return true;
        if (filter === "flagged-open") return view?.status === "flagged";
        return view?.status === filter;
      });
  }, [state.trials, status.trialViews, filter, onlyFlagged]);

  return (
    <section className="panel history-panel">
      <div className="heading">
        <div>
          <p>试运行台账</p>
          <h2>历史偏差记录</h2>
        </div>
        <div className="history-tools">
          <label className="inline-check">
            <input
              type="checkbox"
              checked={onlyFlagged}
              onChange={(e) => setOnlyFlagged(e.target.checked)}
            />
            只看命中偏差
          </label>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip small${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="empty">暂无符合条件的登记</p>
      ) : (
        <div className="history-table">
          {rows.map((t) => {
            const cue = cueById.get(t.cueId);
            const view = status.trialViews[t.id];
            return (
              <article key={t.id} className={`history-row ${t.flagged ? "is-flagged" : ""}`}>
                <div className="hr-main">
                  <span className={`kind ${t.kind}`}>{t.kind === "replay" ? "复演" : "试运行"}</span>
                  <b>{cue ? `${cue.no} ${cue.name}` : "未知 Cue"}</b>
                  <span className={`status-tag ${view?.status}`}>{historyStatusLabel(view?.status)}</span>
                </div>
                <div className="hr-facts">
                  <span>登记 {new Date(t.createdAt).toLocaleString("zh-CN")}</span>
                  <span>计划 {normalizeClock(t.plannedAt)}</span>
                  <span>实际 {normalizeClock(t.actualAt)}</span>
                  <span className={t.flagged || t.deviationSec !== 0 ? "deviate" : ""}>
                    偏差 {formatSigned(t.deviationSec)}
                  </span>
                  <span>操作人：{t.operator || <b className="warn">空</b>}</span>
                </div>
                {t.flagReasons.length > 0 && (
                  <p className="hr-reasons">
                    {t.flagReasons.map((r) => `⚠️ ${r}`).join("；")}
                  </p>
                )}
                {t.reason && <p className="hr-reason">偏差原因：{t.reason}</p>}
                {t.review && (
                  <p className="hr-review">
                    🎭 {t.review.director} 结论：{t.review.conclusion}
                    （{t.review.allowReplay ? "准予复演" : "暂不放行"}）
                  </p>
                )}
                {t.closesTrialId && <p className="hr-closes">✓ 复演通过，仅解除本 Cue，历史偏差保留</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function historyStatusLabel(status: TrialStatus | undefined): string {
  switch (status) {
    case "flagged":
      return "待复核";
    case "reviewed":
      return "待复演";
    case "resolved":
      return "复演已解除";
    case "superseded":
      return "已被后续登记覆盖";
    case "cleared":
      return "正常通过";
    default:
      return "";
  }
}
