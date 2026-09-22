import type { Cue } from "../types";
import {
  STATUS_LABEL,
  formatDeviation,
  getCueStatus,
  hasDeviationHistory,
  isCueLocked,
  latestRun,
} from "../domain/status";

interface CueListProps {
  cues: Cue[];
  selectedCueId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Cue 列表（已按触发顺序与筛选条件排好序传入）
 * 未复核 Cue 统一带 🔒；已放行但有历史偏差的 Cue 带 ● 标记。
 */
export function CueList({ cues, selectedCueId, onSelect }: CueListProps) {
  return (
    <section className="panel cue-list-panel">
      <div className="heading">
        <div>
          <p>Cue 触发顺序</p>
          <h2>试运行与复核</h2>
        </div>
        <span className="hint">🔒 = 未复核锁定 · ● = 保留有历史偏差</span>
      </div>

      <div className="cue-rows">
        {cues.length === 0 && <p className="empty-tip">当前筛选条件下没有 Cue</p>}
        {cues.map((cue) => {
          const status = getCueStatus(cue);
          const run = latestRun(cue);
          const locked = isCueLocked(cue);
          return (
            <button
              type="button"
              key={cue.id}
              className={"cue-row status-row-" + status + (cue.id === selectedCueId ? " active" : "")}
              onClick={() => onSelect(cue.id)}
            >
              <span className="cue-order">{String(cue.order).padStart(2, "0")}</span>
              <span className="cue-main">
                <b>
                  {locked && <em className="row-lock">🔒</em>}
                  {cue.code}
                </b>
                <small>{cue.name}</small>
              </span>
              <span className="cue-meta">
                <small className={run && Math.abs(run.deviationSec) > 8 ? "deviation-bad" : ""}>
                  {run ? formatDeviation(run.deviationSec) : "未试运行"}
                  {run && run.operator.trim() === "" && <em className="no-operator"> · 无操作人</em>}
                </small>
                <span className={`status-badge status-${status}`}>{STATUS_LABEL[status]}</span>
              </span>
              {hasDeviationHistory(cue) && (
                <em className="history-dot" title="历史偏差已保留">●</em>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
