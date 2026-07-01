// LiveFeed.jsx — auto-ingested viral videos + news + manually added blocks
import { useCallback, useEffect, useState } from "react";
import { fetchFeed, fetchBlocks, isConfigured } from "../lib/api.js";
import FeedCard from "./FeedCard.jsx";
import VideoModal, { getYouTubeId } from "./VideoModal.jsx";

const PAGE = 12;

// ── Manual block card component ─────────────────────────────────────────────
function ManualBlock({ block }) {
  const [playing, setPlaying] = useState(false);
  const typeIcon = { youtube: "▶", instagram: "📸", news: "📰", document: "📄", app: "🚀" };
  const typeLabel = { youtube: "YouTube", instagram: "Instagram", news: "News", document: "Document", app: "App" };

  function getYTThumb(url) {
    const m = url.match(/(?:shorts\/|youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
  }

  const ytId = block.block_type === "youtube" ? getYouTubeId(block.url) : null;
  const thumb = block.thumbnail || (block.block_type === "youtube" ? getYTThumb(block.url) : null);
  const icon = typeIcon[block.block_type] || "•";
  const label = typeLabel[block.block_type] || block.block_type;

  const docIcon = block.url?.endsWith(".pdf") ? "📕" : block.url?.endsWith(".docx") ? "📘" : "📄";

  function onClick(e) {
    if (ytId) {
      e.preventDefault();
      setPlaying(true);
    }
    // else: not a recognizable YouTube link (Instagram/News/Doc/App) — open normally in a new tab
  }

  return (
    <>
      <a href={block.url} target="_blank" rel="noopener noreferrer" className="feed-card manual-block" onClick={onClick}>
        <div className="fc-thumb">
          {block.block_type === "document" ? (
            <div className="fc-doc-placeholder">{docIcon}</div>
          ) : thumb ? (
            <img src={thumb} alt={block.title} />
          ) : block.block_type === "instagram" ? (
            <div className="fc-ig-placeholder">📸</div>
          ) : (
            <div className="fc-app-placeholder">{block.block_type === "app" ? "🚀" : "📰"}</div>
          )}
          <span className="fc-kind-badge">{icon} {label}</span>
        </div>
        <div className="fc-body">
          <p className="fc-title">{block.title}</p>
          {block.caption && <p className="fc-desc">{block.caption}</p>}
          {block.description && !block.caption && <p className="fc-desc">{block.description}</p>}
          <span className="fc-source">{block.source_label || label}</span>
        </div>
      </a>
      {playing && (
        <VideoModal videoId={ytId} title={block.title} onClose={() => setPlaying(false)} />
      )}
    </>
  );
}

// ── Main LiveFeed ────────────────────────────────────────────────────────────
export default function LiveFeed() {
  const [items, setItems]       = useState([]);
  const [blocks, setBlocks]     = useState([]);
  const [kind, setKind]         = useState(null);
  const [offset, setOffset]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  // Load manual blocks once (excluding "app" type — those render in the Apps grid instead)
  useEffect(() => {
    if (!isConfigured()) return;
    fetchBlocks().then(d => setBlocks((d.items || []).filter(b => b.block_type !== "app"))).catch(() => {});
  }, []);

  const load = useCallback(async (reset) => {
    if (loading) return;
    setLoading(true);
    setError("");
    const nextOffset = reset ? 0 : offset;
    try {
      const data = await fetchFeed({ limit: PAGE, offset: nextOffset, kind });
      const fresh = data.items || [];
      setItems((prev) => (reset ? fresh : [...prev, ...fresh]));
      setOffset(nextOffset + fresh.length);
      setDone(fresh.length < PAGE);
    } catch {
      setError("Couldn't load the feed. The backend may be waking up — try Refresh.");
    } finally {
      setLoading(false);
    }
  }, [loading, offset, kind]);

  useEffect(() => {
    if (!isConfigured()) return;
    setItems([]); setOffset(0); setDone(false);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function chip(value, label) {
    return (
      <button
        className={`feed-chip ${kind === value ? "active" : ""}`}
        onClick={() => setKind(value)}
      >
        {label}
      </button>
    );
  }

  // Filter manual blocks by kind selector
  const filteredBlocks = kind
    ? blocks.filter(b => {
        if (kind === "video") return b.block_type === "youtube" || b.block_type === "instagram";
        if (kind === "news")  return b.block_type === "news";
        return true;
      })
    : blocks;

  return (
    <section className="section feed-section" id="reels">
      <div className="section-head">
        <span className="section-tag jade" style={{ background: "#2A2436", color: "var(--jade)" }}>
          Daily Wow — Live Feed
        </span>
        <h2>Trending right now — videos &amp; news, freshest on top</h2>
        <p>
          Auto-updated viral videos and headlines, newest first. Scroll the feed up and down,
          and tap ✨ for a quick AI take. Everything is kept forever in the{" "}
          <a href="#/archive" style={{ color: "var(--marigold)", fontWeight: 700 }}>Archive</a>.
        </p>
      </div>

      <div className="feed-controls">
        {chip(null, "All")}
        {chip("video", "▶ Videos")}
        {chip("news", "📰 News")}
        <button className="feed-refresh" onClick={() => { setItems([]); setOffset(0); setDone(false); load(true); }}>
          ↻ Refresh
        </button>
      </div>

      <div className="feed-scroll">
        {!isConfigured() && (
          <div className="feed-empty">
            <p><strong>Feed not connected yet.</strong></p>
            <p>Set <code>VITE_API_BASE</code> in Netlify to your Render backend URL, then redeploy.</p>
          </div>
        )}

        {/* Manual blocks shown at top */}
        {isConfigured() && filteredBlocks.map(b => <ManualBlock key={b.id} block={b} />)}

        {/* Auto-ingested items */}
        {isConfigured() && items.map((it) => <FeedCard key={it.id} item={it} />)}

        {isConfigured() && loading && items.length === 0 && filteredBlocks.length === 0 && (
          <div className="feed-loading"><span className="spin" /> &nbsp;Loading the latest…</div>
        )}

        {isConfigured() && !loading && items.length === 0 && filteredBlocks.length === 0 && !error && (
          <div className="feed-empty">
            <p><strong>The feed is empty for now.</strong></p>
            <p>Add blocks from <strong>kyabathai.com/admin</strong> or wait for the auto-ingest to run.</p>
          </div>
        )}

        {error && <div className="feed-empty"><p>{error}</p></div>}
      </div>

      {isConfigured() && items.length > 0 && !done && (
        <div className="feed-loadmore-wrap">
          <button className="feed-loadmore" onClick={() => load(false)} disabled={loading}>
            {loading ? <span className="spin" /> : "Load more ↓"}
          </button>
        </div>
      )}
    </section>
  );
}
