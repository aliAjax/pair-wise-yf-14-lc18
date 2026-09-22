import { useCallback, useMemo, useState } from "react";
import "./styles.css";
import { StoreProvider, useStore } from "./store";
import { StageMap } from "./components/StageMap";
import { ScenePreview } from "./components/ScenePreview";
import { CueList } from "./components/CueList";
import { CueDetail } from "./components/CueDetail";
import { FilterSidebar } from "./components/FilterSidebar";
import type { CueFilterKey, FixtureCategory } from "./types";
import { getCueStatus, isCueLocked } from "./domain/status";

interface Toast {
  id: number;
  text: string;
  ok: boolean;
}

function Workspace() {
  const { state, adjustLighting, addNote, updateShowName, resetAll } = useStore();
  const [selectedCueId, setSelectedCueId] = useState<string | null>(
    state.cues[0]?.id ?? null
  );
  const [categoryFilter, setCategoryFilter] = useState<FixtureCategory | null>(null);
  const [statusFilter, setStatusFilter] = useState<CueFilterKey>("all");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((text: string, ok = true) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, ok }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // 状态筛选计数
  const counts = useMemo(() => {
    const base: Record<CueFilterKey, number> = {
      all: state.cues.length,
      locked: 0,
      pending_review: 0,
      awaiting_rerun: 0,
      released: 0,
      normal: 0,
    };
    for (const cue of state.cues) {
      const status = getCueStatus(cue);
      base[status] += 1;
      if (isCueLocked(cue)) base.locked += 1;
    }
    return base;
  }, [state.cues]);

  // 同时按灯具类别与复核状态筛选；锁定 Cue 在舞台图 / 列表 / 预览统一显示 🔒
  const visibleCues = useMemo(() => {
    return state.cues
      .filter((cue) => {
        const status = getCueStatus(cue);
        if (statusFilter === "locked" && !isCueLocked(cue)) return false;
        if (statusFilter !== "all" && statusFilter !== "locked" && status !== statusFilter) {
          return false;
        }
        if (categoryFilter && !cue.fixtureIds.some((fid) => {
          const fx = state.fixtures.find((f) => f.id === fid);
          return fx?.category === categoryFilter;
        })) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [state.cues, state.fixtures, statusFilter, categoryFilter]);

  const selectedCue = state.cues.find((c) => c.id === selectedCueId) ?? null;

  const metrics = [
    { label: "灯具数量", value: state.fixtures.length },
    { label: "Cue 数量", value: state.cues.length },
    { label: "未复核锁定", value: counts.locked },
    { label: "待复演", value: counts.awaiting_rerun },
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62002 · 排练偏差复核台 · Port 62002</p>
        <h1>
          <input
            className="show-name-input"
            value={state.showName}
            onChange={(e) => updateShowName(e.target.value)}
            aria-label="演出名称"
          />
        </h1>
        <span>
          每次试运行登记计划/实际触发时间、操作人与偏差原因；偏差超过 8 秒或操作人为空即标记待复核。
          待复核 Cue 锁定亮度与焦点，导演填写处理结论后方可调整灯位，复演通过只解除当前 Cue，历史偏差永久保留。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong className={m.label === "未复核锁定" && m.value > 0 ? "alert-num" : ""}>
              {m.value}
            </strong>
          </article>
        ))}
      </section>

      <div className="layout">
        <FilterSidebar
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          counts={counts}
          notes={state.notes}
          onAddNote={addNote}
        />

        <div className="main-col">
          <StageMap
            fixtures={state.fixtures}
            cues={visibleCues.length > 0 ? visibleCues : []}
            selectedCueId={selectedCueId}
            activeCategory={categoryFilter}
            onSelectCue={setSelectedCueId}
            onAdjustFocus={(cueId, x, y) => {
              const r = adjustLighting(cueId, { focusX: x, focusY: y });
              if (!r.ok) notify(r.reason, false);
            }}
            notify={notify}
          />
          <ScenePreview cue={selectedCue} fixtures={state.fixtures} />
          <CueList
            cues={visibleCues}
            selectedCueId={selectedCueId}
            onSelect={setSelectedCueId}
          />
          <CueDetail cue={selectedCue} notify={notify} />
        </div>
      </div>

      <footer className="app-footer">
        <span>数据保存在本机浏览器（localStorage），刷新后历史偏差与复核记录仍在</span>
        <button type="button" onClick={() => {
          resetAll();
          setSelectedCueId(null);
          notify("已恢复示例数据");
        }}>
          重置示例数据
        </button>
      </footer>

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={"toast" + (t.ok ? " ok" : " err")}>
            {t.ok ? "✓ " : "⛔ "}
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}
