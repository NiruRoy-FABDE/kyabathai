// lib/api.js — talks to your Python backend (set VITE_API_BASE to the Render URL)
const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

// Returns "" when the backend isn't configured yet, so the UI can show a
// friendly "not connected" message instead of crashing.
export function isConfigured() {
  return BASE.length > 0;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export function fetchFeed({ limit = 12, offset = 0, kind = null } = {}) {
  const p = new URLSearchParams({ limit, offset });
  if (kind) p.set("kind", kind);
  return get(`/api/feed?${p.toString()}`);
}

export function fetchArchive({ limit = 24, offset = 0, q = "", kind = null } = {}) {
  const p = new URLSearchParams({ limit, offset });
  if (q) p.set("q", q);
  if (kind) p.set("kind", kind);
  return get(`/api/archive?${p.toString()}`);
}

export function explainItem(id) {
  return post(`/api/explain`, { id });
}
