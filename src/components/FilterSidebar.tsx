import { useState } from "react";
import type { CueFilterKey, FixtureCategory, VersionNote } from "../types";

const CATEGORIES: FixtureCategory[] = ["面光", "侧光", "逆光", "效果光"];

const STATUS_FILTERS: { key: CueFilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "locked", label: "🔒 未复核锁定" },
  { key: "pending_review", label: "待复核" },
  { key: "awaiting_rerun", label: "待复演" },
  { key: "released", label: "已放行" },
  { key: "normal", label: "正常" },
];

interface FilterSidebarProps {
  categoryFilter: FixtureCategory | null;
  onCategoryChange: (cat: FixtureCategory | null) => void;
  statusFilter: CueFilterKey;
  onStatusChange: (key: CueFilterKey) => void;
  counts: Record<CueFilterKey, number>;
  notes: VersionNote[];
  onAddNote: (version: string, content: string) => void;
}

/**
 * 灯具筛选 + 复核状态筛选 + 演出版本备注
 * 注意：当存在未复核锁定 Cue 时，筛选结果中的灯位仍统一显示锁定（在舞台图与列表处理）。
 */
export function FilterSidebar({
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  counts,
  notes,
  onAddNote,
}: FilterSidebarProps) {
  const [version, setVersion] = useState("");
  const [content, setContent] = useState("");

  return (
    <aside className="sidebar">
      <section className="panel">
        <h2>灯具筛选</h2>
        <div className="chips">
          <button
            type="button"
            className={categoryFilter === null ? "chip-on" : ""}
            onClick={() => onCategoryChange(null)}
          >
            全部灯具
          </button>
          {CATEGORIES.map((cat) => (
            <button
              type="button"
              key={cat}
              className={categoryFilter === cat ? "chip-on" : ""}
              onClick={() => onCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>复核状态筛选</h2>
        <div className="filter-list">
          {STATUS_FILTERS.map((f) => (
            <button
              type="button"
              key={f.key}
              className={"filter-item" + (statusFilter === f.key ? " on" : "")}
              onClick={() => onStatusChange(f.key)}
            >
              <span>{f.label}</span>
              <b>{counts[f.key] ?? 0}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="panel notes-panel">
        <h2>演出版本备注</h2>
        <div className="note-list">
          {notes.map((note) => (
            <article key={note.id}>
              <b>{note.version}</b>
              <p>{note.content}</p>
            </article>
          ))}
        </div>
        <div className="note-form">
          <input
            placeholder="版本号，如 联排 v1.0"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <textarea
            rows={2}
            placeholder="本版调整与复核结论摘要"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (version.trim() && content.trim()) {
                onAddNote(version, content);
                setVersion("");
                setContent("");
              }
            }}
          >
            添加备注
          </button>
        </div>
      </section>
    </aside>
  );
}
