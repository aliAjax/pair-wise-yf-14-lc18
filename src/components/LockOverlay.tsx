// 统一锁定遮罩：舞台图、预览、筛选在未复核时共用同一种锁定展示

interface LockOverlayProps {
  title: string;
  detail: string;
}

export function LockOverlay({ title, detail }: LockOverlayProps) {
  return (
    <div className="lock-overlay" role="status" aria-live="polite">
      <div className="lock-card">
        <span className="lock-icon" aria-hidden>🔒</span>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export function LockBanner({
  pendingCount,
  replayReadyCount,
}: {
  pendingCount: number;
  replayReadyCount: number;
}) {
  return (
    <div className="lock-banner" role="alert">
      <strong>🔒 复核锁定中</strong>
      <span>
        {pendingCount > 0 && `${pendingCount} 个 Cue 待导演填写处理结论`}
        {pendingCount > 0 && replayReadyCount > 0 && "；"}
        {replayReadyCount > 0 && `${replayReadyCount} 个 Cue 待复演通过`}
        。舞台图、场景预览与灯具筛选已统一锁定，历史偏差保留可查。
      </span>
    </div>
  );
}
