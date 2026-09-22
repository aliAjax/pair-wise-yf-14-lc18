// 舞台平面灯位图
// 待复核 Cue 涉及的灯具显示锁定，调整灯位（拖动）前由 clearance 门禁拦截。

import { useRef, useState } from "react";
import type { Fixture } from "../types";
import type { ConsoleStatus, CueStatus } from "../lib/deviation";
import { canAdjustFixture, type GateResult } from "../lib/clearance";
import { LockOverlay } from "./LockOverlay";

interface StageMapProps {
  fixtures: Fixture[];
  selectedCue: CueStatus | null;
  status: ConsoleStatus;
  onMove: (fixtureId: string, x: number, y: number) => void;
  onGateDeny: (gate: GateResult) => void;
}

export function StageMap({
  fixtures,
  selectedCue,
  status,
  onMove,
  onGateDeny,
}: StageMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const locked = status.anyLock;
  const selectedIds = new Set(selectedCue?.cue.fixtureIds ?? []);

  // fixtureId -> 锁定它的 Cue（徽标提示用）
  const lockSource = new Map<string, string>();
  for (const cs of Object.values(status.cueStatuses)) {
    if (cs.lock !== "open") {
      for (const id of cs.cue.fixtureIds) lockSource.set(id, cs.cue.no);
    }
  }

  function toStagePoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    // 渲染约定：fy = (f.y / 58) * 56 + 2，这里做逆换算
    const fx = ((clientX - rect.left) / rect.width) * 100;
    const fy = ((clientY - rect.top) / rect.height) * 58;
    const rawY = ((fy - 2) / 56) * 58;
    return {
      x: Math.min(98, Math.max(2, Math.round(fx))),
      y: Math.min(56, Math.max(2, Math.round(rawY))),
    };
  }

  function startDrag(e: React.PointerEvent<SVGGElement>, fixture: Fixture) {
    const gate = canAdjustFixture(fixture.id, status);
    if (!gate.allowed) {
      onGateDeny(gate);
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragId(fixture.id);
  }

  function onPointerMove(e: React.PointerEvent<SVGGElement>) {
    if (!dragId) return;
    const p = toStagePoint(e.clientX, e.clientY);
    if (p) onMove(dragId, p.x, p.y);
  }

  return (
    <section className="panel stage-panel">
      <div className="heading">
        <div>
          <p>舞台平面</p>
          <h2>灯位图</h2>
        </div>
        <span className="hint">拖动光点调整灯位 · 待复核灯具锁定</span>
      </div>

      <div className={`stage-wrap${locked ? " is-locked" : ""}`}>
        <svg
          ref={svgRef}
          viewBox="0 0 100 58"
          className="stage-svg"
          preserveAspectRatio="none"
        >
          <rect x="1" y="1" width="98" height="56" rx="2" className="stage-frame" />
          <line x1="1" y1="10" x2="99" y2="10" className="stage-line" />
          <text x="50" y="5.6" textAnchor="middle" className="stage-label">
            台口 / AUDIENCE
          </text>
          <text x="50" y="14.5" textAnchor="middle" className="stage-sublabel">
            面光 · 追光
          </text>
          <line x1="1" y1="30" x2="99" y2="30" className="stage-line faint" />
          <text x="50" y="33" textAnchor="middle" className="stage-sublabel">
            侧光
          </text>
          <text x="50" y="54" textAnchor="middle" className="stage-sublabel">
            逆光 · 效果光（后演区）
          </text>

          {selectedIds.size > 0 && (
            <rect x="2" y="16" width="96" height="38" rx="2" className="cue-highlight" />
          )}

          {fixtures.map((f) => {
            const lockedBy = lockSource.get(f.id);
            const inCue = selectedIds.has(f.id);
            const fy = (f.y / 58) * 56 + 2;
            return (
              <g
                key={f.id}
                transform={`translate(${f.x} ${fy})`}
                className={`fixture${inCue ? " in-cue" : ""}${lockedBy ? " fixture-locked" : ""}${
                  dragId === f.id ? " dragging" : ""
                }`}
                onPointerDown={(e) => startDrag(e, f)}
                onPointerMove={onPointerMove}
                onPointerUp={() => setDragId(null)}
              >
                <circle r={inCue ? 3.2 : 2.4} fill={f.color} className="fixture-dot" />
                <text y={-4} textAnchor="middle" className="fixture-id">
                  {f.id}
                </text>
                {lockedBy && (
                  <text y={1.6} textAnchor="middle" className="fixture-lock">🔒</text>
                )}
              </g>
            );
          })}
        </svg>

        {locked && (
          <LockOverlay
            title="舞台灯位图已锁定"
            detail="存在待复核 Cue：导演填写处理结论且复演通过前，不能拖动灯具或调整灯位。"
          />
        )}
      </div>

      <ul className="legend">
        <li><i className="legend-dot" style={{ background: "#f59e0b" }} />当前 Cue 灯具高亮</li>
        <li><i className="legend-dot lock" />🔒 待复核锁定（灯位不可拖动）</li>
      </ul>
    </section>
  );
}
