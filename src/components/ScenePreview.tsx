import type { Cue, Fixture } from "../types";
import { STATUS_LABEL, formatDeviation, getCueStatus, isCueLocked, latestRun } from "../domain/status";

interface ScenePreviewProps {
  cue: Cue | null;
  fixtures: Fixture[];
}

/**
 * 当前场景预览
 * Cue 未复核时预览整体锁定：遮罩 + 🔒，亮度/焦点只展示锁定前快照。
 */
export function ScenePreview({ cue, fixtures }: ScenePreviewProps) {
  if (!cue) {
    return (
      <section className="panel preview-panel">
        <div className="heading">
          <div>
            <p>当前场景预览</p>
            <h2>未选择 Cue</h2>
          </div>
        </div>
        <div className="preview-empty">从 Cue 列表或舞台图选择一个 Cue</div>
      </section>
    );
  }

  const locked = isCueLocked(cue);
  const status = getCueStatus(cue);
  const run = latestRun(cue);
  const cueFixtures = fixtures.filter((fx) => cue.fixtureIds.includes(fx.id));
  const glow = Math.round((cue.brightness / 100) * (locked ? 0.35 : 1) * 10) / 10;

  return (
    <section className="panel preview-panel">
      <div className="heading">
        <div>
          <p>当前场景预览</p>
          <h2>
            {cue.code} · {cue.name}
          </h2>
        </div>
        <span className={`status-badge status-${status}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className={"preview-stage" + (locked ? " is-locked" : "")}>
        <div
          className="light-wash"
          style={{
            opacity: locked ? 0.25 : 0.25 + cue.brightness / 200,
            background: `radial-gradient(circle at ${cue.focusX}% ${cue.focusY}%, rgba(245,158,11,${glow}), rgba(124,58,237,0.18) 45%, transparent 72%)`,
          }}
        />
        {cueFixtures.map((fx) => (
          <div
            key={fx.id}
            className="beam"
            style={{
              left: `${fx.x}%`,
              top: `${fx.y}%`,
              opacity: locked ? 0.15 : 0.3 + cue.brightness / 250,
            }}
          />
        ))}

        <dl className="preview-readout">
          <div>
            <dt>亮度预设</dt>
            <dd>{cue.brightness}%</dd>
          </div>
          <div>
            <dt>焦点位置</dt>
            <dd>
              {cue.focusX.toFixed(0)}, {cue.focusY.toFixed(0)}
            </dd>
          </div>
          <div>
            <dt>最近偏差</dt>
            <dd>{run ? formatDeviation(run.deviationSec) : "—"}</dd>
          </div>
        </dl>

        {locked && (
          <div className="lock-overlay">
            <strong>🔒 预览锁定</strong>
            <span>待导演填写处理结论并复演通过后解锁</span>
          </div>
        )}
      </div>

      <p className="preview-fixtures">
        {cueFixtures.map((fx) => fx.code).join("、") || "未关联灯具"}
      </p>
    </section>
  );
}
