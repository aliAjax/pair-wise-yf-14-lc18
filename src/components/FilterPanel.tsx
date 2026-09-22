// 灯具筛选：灯位类型 chips。存在待复核 Cue 时统一显示锁定（不可切换）。

import type { FixtureType } from "../types";
import { FIXTURE_TYPES } from "../types";
import { LockOverlay } from "./LockOverlay";

interface FilterPanelProps {
  activeTypes: FixtureType[];
  counts: Record<FixtureType, number>;
  locked: boolean;
  onToggle: (t: FixtureType) => void;
}

export function FilterPanel({ activeTypes, counts, locked, onToggle }: FilterPanelProps) {
  return (
    <section className="panel filter-panel">
      <div className="heading">
        <div>
          <p>灯位类型</p>
          <h2>灯具筛选</h2>
        </div>
      </div>
      <div className={`chips-wrap${locked ? " is-locked" : ""}`}>
        <div className="chips">
          {FIXTURE_TYPES.map((t) => {
            const active = activeTypes.includes(t);
            return (
              <button
                key={t}
                className={`chip${active ? " active" : ""}`}
                disabled={locked}
                aria-pressed={active}
                onClick={() => onToggle(t)}
              >
                {t}
                <em>{counts[t] ?? 0}</em>
              </button>
            );
          })}
        </div>
        {activeTypes.length > 0 && !locked && (
          <span className="filter-hint">已选 {activeTypes.length} 类，再点一次取消</span>
        )}
        {locked && (
          <LockOverlay
            title="筛选已锁定"
            detail="存在待复核 Cue，复核完成前灯具筛选不可切换。"
          />
        )}
      </div>
    </section>
  );
}
