import { useRef } from "react";
import type { Cue, Fixture, FixtureCategory } from "../types";
import { STATUS_LABEL, getCueStatus, isCueLocked } from "../domain/status";
import { canAdjustLighting } from "../domain/release";

const CATEGORY_COLOR: Record<FixtureCategory, string> = {
  面光: "#f59e0b",
  侧光: "#7c3aed",
  逆光: "#06b6d4",
  效果光: "#e11d48",
};

interface StageMapProps {
  fixtures: Fixture[];
  cues: Cue[];
  selectedCueId: string | null;
  activeCategory: FixtureCategory | null;
  onSelectCue: (id: string) => void;
  onAdjustFocus: (cueId: string, x: number, y: number) => void;
  notify: (msg: string, ok?: boolean) => void;
}

/**
 * 舞台平面灯位图
 * 未复核 Cue 的焦点在图上统一显示锁定遮罩，不允许拖动调整。
 */
export function StageMap({
  fixtures,
  cues,
  selectedCueId,
  activeCategory,
  onSelectCue,
  onAdjustFocus,
  notify,
}: StageMapProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragCueId = useRef<string | null>(null);

  const lockedFixtureIds = new Set(
    cues.filter(isCueLocked).flatMap((cue) => cue.fixtureIds)
  );
  const selectedCue = cues.find((c) => c.id === selectedCueId) ?? null;

  function eventToPercent(event: React.PointerEvent) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(100, Math.max(0, Number(x.toFixed(1)))),
      y: Math.min(100, Math.max(0, Number(y.toFixed(1)))),
    };
  }

  function startDrag(cue: Cue, event: React.PointerEvent) {
    if (isCueLocked(cue)) {
      const gate = canAdjustLighting(cue);
      notify(gate.ok ? "该 Cue 已锁定" : gate.reason, false);
      return;
    }
    event.preventDefault();
    dragCueId.current = cue.id;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!dragCueId.current) return;
    const point = eventToPercent(event);
    if (point) onAdjustFocus(dragCueId.current, point.x, point.y);
  }

  function endDrag() {
    dragCueId.current = null;
  }

  return (
    <section className="panel stage-panel">
      <div className="heading">
        <div>
          <p>舞台平面灯位图</p>
          <h2>灯位与焦点</h2>
        </div>
        <span className="hint">拖动焦点圆盘调整灯位 · 锁定 Cue 显示🔒</span>
      </div>

      <div
        ref={boardRef}
        className="stage-board"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        <div className="stage-audience">观众席方向</div>

        {/* 灯具 */}
        {fixtures.map((fx) => {
          const dim = activeCategory !== null && fx.category !== activeCategory;
          const locked = lockedFixtureIds.has(fx.id);
          return (
            <div
              key={fx.id}
              className={"fixture" + (dim ? " dimmed" : "")}
              style={{ left: `${fx.x}%`, top: `${fx.y}%` }}
              title={`${fx.code} ${fx.channel} ${fx.gel}（${fx.category}）`}
            >
              <span className="fixture-dot" style={{ background: CATEGORY_COLOR[fx.category] }} />
              <small>
                {fx.code}
                {locked && <em className="mini-lock">🔒</em>}
              </small>
            </div>
          );
        })}

        {/* 各 Cue 焦点：未复核统一显示锁定 */}
        {cues.map((cue) => {
          const status = getCueStatus(cue);
          const locked = isCueLocked(cue);
          const selected = cue.id === selectedCueId;
          return (
            <button
              key={cue.id}
              type="button"
              className={
                "focus-marker" +
                (selected ? " selected" : "") +
                (locked ? " locked" : "") +
                (status === "released" ? " released" : "")
              }
              style={{ left: `${cue.focusX}%`, top: `${cue.focusY}%` }}
              onPointerDown={(e) => startDrag(cue, e)}
              onClick={() => onSelectCue(cue.id)}
              title={`${cue.code} 焦点 · ${STATUS_LABEL[status]}`}
            >
              {locked ? "🔒" : status === "released" ? "✓" : "◎"}
              <span>{cue.code}</span>
            </button>
          );
        })}
      </div>

      <div className="legend">
        {(Object.keys(CATEGORY_COLOR) as FixtureCategory[]).map((cat) => (
          <span key={cat}>
            <i style={{ background: CATEGORY_COLOR[cat] }} />
            {cat}
          </span>
        ))}
      </div>
    </section>
  );
}
