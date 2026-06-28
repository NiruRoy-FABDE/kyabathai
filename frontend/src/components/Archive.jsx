// Archive.jsx — the permanent archive of everything ever ingested.
import { useCallback, useEffect, useState } from "react";
import { fetchArchive, isConfigured } from "../lib/api.js";
import { timeAgo } from "../lib/util.js";

const PAGE = 24;

export default function Archive() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [kind, setKind] = useState(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async (reset) => {
    setLoading(true);
    const nextOffset = reset ? 0 : offset;
    try {
      const data = await fetchArchive({ limit: PAGE, offset: nextOffset, q: submittedQ, kind });
      const fresh = data.items || [];
      setItems((prev) => (reset ? fresh : [...prev, ...fresh]));
      setOffset(nextOffset + fresh.length);
      setDone(fresh.length < PAGE);
    } catch {
      /* leave list as-is */
    } finally {
      setLoading(false);
    }
  }, [offset, submittedQ, kind]);

  useEffect(() => {
    if (!isConfigured()) return;
    setItems([]); setOffset(0); setDone(false);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedQ, kind]);

  function chip(value, label) {
    return (
      <button className={`archive-chip ${kind === value ? "active" : ""}`} onClick={() => setKind(value)}>
        {label}
      </button>
    );
  }

  return (
    <div className="archive-wrap">
      <div className="archive-head">
        <a className="back-home" href="#/">← Back to kyabathai</a>
        <h1>Archive</h1>
        <p>Every viral video and news story we've ever pulled — searchable, kept forever.</p>
      </div>

      <div className="archive-tools">
        <input
          type="text"
          placeholder="Search the archive…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSubmittedQ(q.trim()); }}
        />
        <button className="archive-chip" onClick={() => setSubmittedQ(q.trim())}>Search</button>
        {chip(null, "All")}
        {chip("video", "Videos")}
        {chip("news", "News")}
      </div>

      {!isConfigured() && (
        <div className="archive-head"><p>Connect the backend (set <code>VITE_API_BASE</code>) to browse the archive.</p></div>
      )}

      <div className="archive-grid">
        {items.map((it) => (
          <a key={it.id} className="arch-card" href={it.url} target="_blank" rel="noopener noreferrer">
            <div className="thumb">
              {it.thumbnail
                ? <img src={it.thumbnail} alt={it.title} loading="lazy" onError={(e)=>{e.currentTarget.style.display="none";}} />
                : <div className="noimg">{it.kind === "video" ? "▶️" : "📰"}</div>}
            </div>
            <div className="pad">
              <h3>{it.title}</h3>
              <div className="m">{it.channel ? it.channel + " • " : ""}{timeAgo(it.published_at || it.ingested_at)}</div>
            </div>
          </a>
        ))}
      </div>

      {isConfigured() && items.length === 0 && !loading && (
        <div className="archive-head"><p>Nothing here yet — the archive fills as content is ingested.</p></div>
      )}

      {isConfigured() && !done && items.length > 0 && (
        <button className="feed-loadmore" style={{ borderColor: "var(--ink)", color: "var(--ink)" }}
          onClick={() => load(false)} disabled={loading}>
          {loading ? "Loading…" : "Load more ↓"}
        </button>
      )}
    </div>
  );
}
