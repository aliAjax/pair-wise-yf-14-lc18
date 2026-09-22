import { useMemo, useState } from "react";
import "./styles.css";
import { useConsoleStore } from "./hooks/useConsoleStore";
import { visibleFixtures } from "./lib/deviation";
import { FIXTURE_TYPES, type FixtureType } from "./types";
import { LockBanner } from "./components/LockOverlay";
import { FilterPanel } from "./components/FilterPanel";
import { StageMap } from "./components/StageMap";
import { PreviewPanel } from "./components/PreviewPanel";
import { CueConsole } from "./components/CueConsole";
import { RunHistory } from "./components/RunHistory";

function App() {
  const store = useConsoleStore();
  const { state, status } = store;
  const [toast, setToast] = useState<string[] | null>(null);

  const shownFixtures = useMemo(
    () => visibleFixtures(state.fixtures, state.activeTypes),
    [state.fixtures, state.activeTypes],
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(FIXTURE_TYPES.map((t) => [t, 0])) as Record<FixtureType, number>;
    for (const f of state.fixtures) c[f.type] += 1;
    return c;
  }, [state.fixtures]);

  const deny = (gate: { blockers: string[] }) => {
    setToast(gate.blockers);
    window.setTimeout(() => setToast(null), 4200);
  };

  const metrics = [
    { label: "灯具数量", value: state.fixtures.length },
    { label: "Cue 数量", value: state.cues.length },
    { label: "待复核 Cue", value: status.pendingCount, alert: status.pendingCount > 0 },
    { label: "待复演 Cue", value: status.replayReadyCount, alert: status.replayReadyCount > 0 },
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62002 · 排练偏差复核台 · Port 62002</p>
        <h1>剧场灯光 Cue 排练偏差复核台</h1>
        <span>
          每次试运行登记计划/实际触发时间、操作人与偏差原因；偏差超过 8 秒或操作人为空即标记待复核。
          待复核 Cue 锁定亮度与焦点，须导演填写处理结论、复演通过后方可调整灯位。
          复演通过只解除当前 Cue，历史偏差保留，刷新后仍在。
        </span>
        <div className="show-line">
          <input
            value={state.show.showName}
            onChange={(e) => store.updateShow({ showName: e.target.value })}
            aria-label="演出名称"
          />
          <input
            value={state.show.versionNote}
            onChange={(e) => store.updateShow({ versionNote: e.target.value })}
            aria-label="演出版本备注"
          />
        </div>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label} className={m.alert ? "alert" : ""}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      {status.anyLock && (
        <LockBanner pendingCount={status.pendingCount} replayReadyCount={status.replayReadyCount} />
      )}

      {toast && (
        <div className="toast" role="alert">
          {toast.map((t) => <p key={t}>⛔ {t}</p>)}
        </div>
      )}

      <section className="workspace">
        <div className="side-col">
          <FilterPanel
            activeTypes={state.activeTypes}
            counts={counts}
            locked={status.anyLock}
            onToggle={store.toggleType}
          />
          <PreviewPanel
            fixtures={state.fixtures}
            selectedCue={status.selectedCue}
            status={status}
            onAdjust={(id, patch) => store.updateFixture(id, patch)}
            onGateDeny={deny}
          />
        </div>

        <CueConsole
          state={state}
          status={status}
          onRegister={store.registerTrial}
          onSubmitReview={store.submitReview}
          onSelect={store.selectCue}
          onGateDeny={deny}
        />
      </section>

      <StageMap
        fixtures={shownFixtures}
        selectedCue={status.selectedCue}
        status={status}
        onMove={(id, x, y) => store.updateFixture(id, { x, y })}
        onGateDeny={deny}
      />

      <RunHistory state={state} status={status} />

      <footer className="foot-panel panel">
        <div>
          <p className="foot-title">演出版本备注（自动保存在本机，刷新后仍在）</p>
          <textarea
            value={state.show.versionNote}
            onChange={(e) => store.updateShow({ versionNote: e.target.value })}
            rows={2}
          />
        </div>
        <button
          className="danger"
          onClick={() => {
            if (window.confirm("确定重置为初始演示数据？本机所有登记与结论将被清除。")) {
              store.reset();
            }
          }}
        >
          重置演示数据
        </button>
      </footer>
    </main>
  );
}

export default App;
