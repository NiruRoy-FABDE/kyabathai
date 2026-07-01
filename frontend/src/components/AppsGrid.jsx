// AppsGrid.jsx — renders app/site cards added from the admin panel, using the
// exact same markup/classes as the hand-built cards above it, so they sit in
// the same grid, same size, same look. Nothing about the existing static
// cards is touched; this only adds more <article class="proj-card"> items.
import { useEffect, useState } from "react";
import { fetchBlocks, isConfigured } from "../lib/api.js";

const GRADIENTS = [
  "linear-gradient(150deg,#1a0d2e,#2e1a3e)",
  "linear-gradient(150deg,#0d1a2e,#1a2e3e)",
  "linear-gradient(150deg,#1a0d1a,#2e1a2e)",
  "linear-gradient(150deg,#0d1a0d,#1a2e1a)",
  "linear-gradient(150deg,#2e1a0d,#3e2e1a)",
];

function AppCard({ block, index }) {
  const extra = block.extra || {};
  const domain = extra.domain || (block.url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const tagline = extra.tagline || block.caption || block.description || "";
  const status = extra.status || "live";
  const isBeta = status === "beta";
  const icon = extra.icon || "🚀";
  const bg = GRADIENTS[index % GRADIENTS.length];
  const whoFor = extra.who_for
    ? String(extra.who_for).split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <article
      className="proj-card"
      style={{ cursor: "pointer" }}
      onClick={(e) => { if (!e.target.closest("a")) window.open(block.url, "_blank", "noopener"); }}
    >
      <div className="proj-card-top" style={{ padding: 0 }}>
        <div className="app-bg-mockup">
          <div style={{ background: bg, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div className="mockup-id-overlay">
              <div className="mid-icon">{icon}</div>
              <div className="mid-name">{block.title}</div>
              <div className="mid-badge">{tagline}</div>
            </div>
          </div>
        </div>
        <div className="proj-card-top-meta">
          <span className="proj-id" style={{ position: "static", display: "inline-block", marginBottom: 4 }}>
            ✦ NEW
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div className="proj-icon tint-2" style={{ marginBottom: 0 }}>{icon}</div>
            <div>
              <h3 style={{ marginBottom: 2 }}>{block.title}</h3>
              <div className="domain">{domain}</div>
            </div>
          </div>
          {tagline && <p className="proj-tagline">{tagline}</p>}
          <a href={block.url} target="_blank" rel="noopener noreferrer" className={`proj-top-visit ${isBeta ? "beta" : ""}`}>
            {isBeta ? "Request Access →" : "Visit Site →"}
          </a>
        </div>
      </div>
      <div className="proj-card-body">
        {isBeta && <span className="beta-flag"><span className="blink"></span>Private Beta</span>}
        {extra.problem && (
          <div className="proj-block">
            <span className="label">The problem</span>
            <p>{extra.problem}</p>
          </div>
        )}
        {extra.what_it_does && (
          <div className="proj-block">
            <span className="label">What it does</span>
            <p>{extra.what_it_does}</p>
          </div>
        )}
        {whoFor.length > 0 && (
          <div className="proj-block">
            <span className="label">Who it's for</span>
            <div className="who-tags">
              {whoFor.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="proj-card-cta">
        <a href={block.url} target="_blank" rel="noopener noreferrer" className={`proj-visit-btn ${isBeta ? "beta-btn" : ""}`}>
          {isBeta ? "Request Access →" : "Visit Site →"}
        </a>
      </div>
    </article>
  );
}

export default function AppsGrid() {
  const [apps, setApps] = useState([]);

  useEffect(() => {
    if (!isConfigured()) return;
    fetchBlocks()
      .then((d) => setApps((d.items || []).filter((b) => b.block_type === "app")))
      .catch(() => {});
  }, []);

  if (apps.length === 0) return null;

  return (
    <>
      {apps.map((b, i) => <AppCard key={b.id} block={b} index={i} />)}
    </>
  );
}
