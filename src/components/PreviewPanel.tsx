// 当前场景预览 + 灯具亮度/焦点调整
// 调整前统一走 clearance.canAdjustFixture；有待复核 Cue 时整个面板显示锁定。

import type { Fixture } from "../types";
import type { ConsoleStatus, CueStatus } from "../lib/deviation";
import { canAdjustFixture, type GateResult, lockLabel } from "../lib/clearance";
import { LockOverlay } from "./LockOverlay";

interface PreviewPanelProps {
  fixtures: Fixture[];
  selectedCue: CueStatus | null;
  status: ConsoleStatus;
  onAdjust: (fixtureId: string, patch: Partial<Pick<Fixture, "brightness" | "focus">>) => void;
  onGateDeny: (gate: GateResult) => void;
}

export function PreviewPanel({
  fixtures,
  selectedCue,
  status,
  onAdjust,
  onGateDeny,
}: PreviewPanelProps) {
  const cue = selectedCue?.cue ?? null;
  const cueFixtures = cue
    ? fixtures.filter((f) => cue.fixtureIds.includes(f.id))
    : [];
  const locked = status.anyLock;

  function guard(fixtureId: string): boolean {
    const gate = canAdjustFixture(fixtureId, status);
    if (!gate.allowed) {
      onGateDeny(gate);
      return false;
    }
    return true;
  }

  return (
    <section className="panel preview-panel">
      <div className="heading">
        <div>
          <p>当前场景预览</p>
          <h2>{cue ? `${cue.no} ${cue.name}` : "未选择 Cue"}</h2>
        </div>
        {selectedCue && (
          <span className={`lock-chip ${selectedCue.lock}`}>{lockLabel(selectedCue)}</span>
        )}
      </div>

      <div className={`preview-stage${locked ? " is-locked" : ""}`}>
        <svg viewBox="0 0 100 58" preserveAspectRatio="none" className="preview-svg">
          <rect x="1" y="1" width="98" height="56" rx="2" className="preview-frame" />
          {cueFixtures.map((f) => {
            const fy = (f.y / 58) * 56 + 2;
            const opacity = 0.12 + (f.brightness / 100) * 0.55;
            return (
              <g key={f.id}>
                <polygon
                  points={`${f.x - 3},${fy} ${f.x + 3},${fy} 50,48`}
                  fill={f.color}
                  opacity={opacity}
                />
                <line x1={f.x} y1={fy} x2="50" y2="46" stroke={f.color} strokeWidth="0.3" opacity={opacity} />
                <circle cx={f.x} cy={fy} r="1.6" fill={f.color} />
              </g>
            );
          })}
          <ellipse cx="50" cy="47" rx="16" ry="3.4" className="focus-zone" />
          <text x="50" y="53" textAnchor="middle" className="preview-label">
            焦点汇聚区
          </text>
        </svg>
        {locked && (
          <LockOverlay
            title="场景预览已锁定"
            detail="未复核 Cue 锁定亮度与焦点，预览中光束与数值不可调整。"
          />
        )}
      </div>

      <div className="fixture-controls">
        {cue && cueFixtures.length === 0 && <p className="empty">该 Cue 未关联灯具</p>}
        {!cue && <p className="empty">从左侧 Cue 列表选择一条记录查看场景</p>}
        {cueFixtures.map((f) => {
          // 统一锁定：存在待复核 Cue 时，亮度与焦点全部冻结；
          // 即使灯具不归属被锁 Cue，也走同一道门禁保持界面一致
          const gate = locked
            ? { allowed: false, blockers: ["存在待复核 Cue，亮度/焦点已统一锁定"] }
            : canAdjustFixture(f.id, status);
          return (
            <div key={f.id} className={`fixture-row${gate.allowed ? "" : " disabled"}`}>
              <div className="fixture-row-head">
                <b style={{ color: f.color }}>{f.id}</b>
                <span>{f.channel} · {f.gel} · {f.type}</span>
                {!gate.allowed && <span className="mini-lock">🔒 锁定</span>}
              </div>
              <label className="brightness">
                亮度 {f.brightness}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={f.brightness}
                  disabled={!gate.allowed}
                  onChange={(e) => {
                    if (guard(f.id)) onAdjust(f.id, { brightness: Number(e.target.value) });
                  }}
                />
              </label>
              <label className="focus-input">
                焦点位置
                <input
                  value={f.focus}
                  disabled={!gate.allowed}
                  onChange={(e) => {
                    if (guard(f.id)) onAdjust(f.id, { focus: e.target.value });
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
