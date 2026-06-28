// lib/util.js — tiny shared helpers
export function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const units = [
    ["y", 31536000], ["mo", 2592000], ["d", 86400],
    ["h", 3600], ["m", 60], ["s", 1],
  ];
  for (const [label, secs] of units) {
    if (s >= secs) return `${Math.floor(s / secs)}${label} ago`;
  }
  return "just now";
}
