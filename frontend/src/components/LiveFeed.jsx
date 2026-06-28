// LiveFeed.jsx — replaces the old reels section. Auto-ingested viral videos +
// news, newest first, vertically scrollable, with filters and "load more".
import { useCallback, useEffect, useState } from "react";
import { fetchFeed, isConfigured } from "../lib/api.js";
import FeedCard from "./FeedCard.jsx";

const PAGE = 12;

export default function LiveFeed() {
  const [items, setItems] = useState([]);
  const [kind, setKind] = useState(null);   // null | 'video' | 'news'
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

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

  // (re)load whenever the filter changes
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
            <p>
              Set <code>VITE_API_BASE</code> in Netlify to your Render backend URL,
              then redeploy. Until then the rest of your site works exactly as before.
            </p>
          </div>
        )}

        {isConfigured() && items.map((it) => <FeedCard key={it.id} item={it} />)}

        {isConfigured() && loading && items.length === 0 && (
          <div className="feed-loading"><span className="spin" /> &nbsp;Loading the latest…</div>
        )}

        {isConfigured() && !loading && items.length === 0 && !error && (
          <div className="feed-empty">
            <p><strong>The feed is empty for now.</strong></p>
            <p>
              It fills automatically once the ingest job runs (every 3 hours), or instantly
              when you trigger <code>/api/ingest</code>. Trending videos and news will appear
              here, newest first.
            </p>
          </div>
        )}

        {error && <div className="feed-empty"><p>{error}</p></div>}

        {isConfigured() && items.length > 0 && !done && (
          <button className="feed-loadmore" onClick={() => load(false)} disabled={loading}>
            {loading ? <span className="spin" /> : "Load more ↓"}
          </button>
        )}
      </div>
    </section>
  );
}
