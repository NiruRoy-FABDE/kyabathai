// FeedCard.jsx — one viral video / news item in the live feed
import { useState } from "react";
import { explainItem } from "../lib/api.js";
import { timeAgo } from "../lib/util.js";
import VideoModal, { getYouTubeId } from "./VideoModal.jsx";

export default function FeedCard({ item }) {
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const kind = item.kind || "video";
  const badgeLabel = kind === "video" ? "Video" : kind === "news" ? "News" : "Reel";
  const ytId = kind === "video" ? getYouTubeId(item.url) : null;

  async function onExplain() {
    if (explanation || loading) return;
    setLoading(true);
    try {
      const data = await explainItem(item.id);
      setExplanation(data.explanation || "No explanation available.");
    } catch {
      setExplanation("Couldn't reach the AI right now — try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function onMediaClick(e) {
    if (ytId) {
      e.preventDefault();
      setPlaying(true);
    }
    // else: no recognizable YouTube ID (e.g. news link) — let the <a> open normally in a new tab
  }

  return (
    <article className="feed-card">
      <a
        className="feed-card-media"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onMediaClick}
      >
        <span className={`feed-badge ${kind}`}>{badgeLabel}</span>
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="noimg">{kind === "video" ? "▶️" : "📰"}</div>
        )}
        <div className="play">{kind === "video" ? "▶" : "↗"}</div>
      </a>

      <div className="feed-card-body">
        <h3>{item.title}</h3>
        <div className="feed-meta">
          {item.channel && <span>{item.channel}</span>}
          {item.channel && <span className="dot-sep">•</span>}
          <span>{timeAgo(item.published_at || item.ingested_at)}</span>
        </div>

        {item.ai_summary && (
          <div className="feed-ai"><span className="spark">✨</span>{item.ai_summary}</div>
        )}

        <div className="feed-actions">
          {ytId ? (
            <button className="feed-btn primary" onClick={() => setPlaying(true)}>
              Watch →
            </button>
          ) : (
            <a className="feed-btn primary" href={item.url} target="_blank" rel="noopener noreferrer">
              {kind === "video" ? "Watch →" : "Read →"}
            </a>
          )}
          <button className="feed-btn ghost" onClick={onExplain} disabled={loading}>
            {loading ? <span className="spin" /> : "✨ Why it's wow"}
          </button>
        </div>

        {explanation && <div className="feed-explain">{explanation}</div>}
      </div>

      {playing && (
        <VideoModal videoId={ytId} title={item.title} onClose={() => setPlaying(false)} />
      )}
    </article>
  );
}

