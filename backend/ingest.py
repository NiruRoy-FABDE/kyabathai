"""
ingest.py — pulls VIRAL content into the database, then archives the overflow.

Sources that work automatically and legitimately:
  • YouTube Data API v3  → chart=mostPopular (real trending videos for a region)
  • NewsAPI.org OR GNews → top headlines for a country

Instagram is deliberately NOT auto-scraped: there is no public API for "viral
reels", and scraping breaks constantly and violates their terms. Add reels by
hand instead (see add_manual() / your admin page) and they'll appear in the feed
exactly like everything else.

Run it:
  • locally / cron:  python -m ingest        (or  python ingest.py)
  • on a schedule:   Render Cron Job  (see render.yaml)
  • on demand:       POST /api/ingest  with the X-Ingest-Secret header
"""
import hashlib
import os
from datetime import datetime, timezone

import httpx

import claude_ai
import db

REGION_CODE = os.environ.get("REGION_CODE", "IN")
NEWS_COUNTRY = os.environ.get("NEWS_COUNTRY", "in")
VIDEO_COUNT = int(os.environ.get("INGEST_VIDEO_COUNT", "15"))
NEWS_COUNT = int(os.environ.get("INGEST_NEWS_COUNT", "15"))

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "")
GNEWS_KEY = os.environ.get("GNEWS_KEY", "")


def _hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:20]


def _parse_dt(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


# ---------------------------------------------------------------------------
#  YouTube trending
# ---------------------------------------------------------------------------
def fetch_youtube() -> list[dict]:
    if not YOUTUBE_API_KEY:
        return []
    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "snippet,statistics",
        "chart": "mostPopular",
        "regionCode": REGION_CODE,
        "maxResults": str(min(VIDEO_COUNT, 50)),
        "key": YOUTUBE_API_KEY,
    }
    items = []
    try:
        r = httpx.get(url, params=params, timeout=30)
        r.raise_for_status()
        for v in r.json().get("items", []):
            snip = v.get("snippet", {})
            stats = v.get("statistics", {})
            vid = v.get("id", "")
            thumbs = snip.get("thumbnails", {})
            thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
            items.append({
                "kind": "video",
                "source": "youtube",
                "external_id": vid,
                "title": snip.get("title", "")[:500],
                "url": f"https://www.youtube.com/watch?v={vid}",
                "thumbnail": thumb,
                "channel": snip.get("channelTitle", ""),
                "description": snip.get("description", "")[:2000],
                "score": float(stats.get("viewCount", 0) or 0),
                "published_at": _parse_dt(snip.get("publishedAt")),
            })
    except Exception as e:
        print(f"[ingest] youtube error: {type(e).__name__}: {e}")
    return items


# ---------------------------------------------------------------------------
#  News  (NewsAPI preferred; GNews fallback)
# ---------------------------------------------------------------------------
def fetch_news() -> list[dict]:
    if NEWSAPI_KEY:
        return _fetch_newsapi()
    if GNEWS_KEY:
        return _fetch_gnews()
    return []


def _fetch_newsapi() -> list[dict]:
    url = "https://newsapi.org/v2/top-headlines"
    params = {"country": NEWS_COUNTRY, "pageSize": str(NEWS_COUNT), "apiKey": NEWSAPI_KEY}
    items = []
    try:
        r = httpx.get(url, params=params, timeout=30)
        r.raise_for_status()
        for a in r.json().get("articles", []):
            link = a.get("url", "")
            if not link:
                continue
            items.append({
                "kind": "news",
                "source": "newsapi",
                "external_id": _hash(link),
                "title": (a.get("title") or "")[:500],
                "url": link,
                "thumbnail": a.get("urlToImage"),
                "channel": (a.get("source") or {}).get("name", ""),
                "description": (a.get("description") or "")[:2000],
                "score": 0,
                "published_at": _parse_dt(a.get("publishedAt")),
            })
    except Exception as e:
        print(f"[ingest] newsapi error: {type(e).__name__}: {e}")
    return items


def _fetch_gnews() -> list[dict]:
    url = "https://gnews.io/api/v4/top-headlines"
    params = {"country": NEWS_COUNTRY, "max": str(NEWS_COUNT), "lang": "en", "token": GNEWS_KEY}
    items = []
    try:
        r = httpx.get(url, params=params, timeout=30)
        r.raise_for_status()
        for a in r.json().get("articles", []):
            link = a.get("url", "")
            if not link:
                continue
            items.append({
                "kind": "news",
                "source": "gnews",
                "external_id": _hash(link),
                "title": (a.get("title") or "")[:500],
                "url": link,
                "thumbnail": a.get("image"),
                "channel": (a.get("source") or {}).get("name", ""),
                "description": (a.get("description") or "")[:2000],
                "score": 0,
                "published_at": _parse_dt(a.get("publishedAt")),
            })
    except Exception as e:
        print(f"[ingest] gnews error: {type(e).__name__}: {e}")
    return items


# ---------------------------------------------------------------------------
#  Manual add (for Instagram reels or anything you want to feature by hand)
# ---------------------------------------------------------------------------
def add_manual(*, kind: str, url: str, title: str, thumbnail: str = "",
               channel: str = "", description: str = "") -> bool:
    item = {
        "kind": kind, "source": "manual", "external_id": _hash(url),
        "title": title[:500], "url": url, "thumbnail": thumbnail or None,
        "channel": channel, "description": description[:2000], "score": 0,
        "published_at": datetime.now(timezone.utc),
    }
    item["ai_summary"] = claude_ai.summarise(title, description, kind) if claude_ai.is_enabled() else ""
    return db.upsert_item(item)


# ---------------------------------------------------------------------------
#  Main run
# ---------------------------------------------------------------------------
def run(keep_live: int = 60) -> dict:
    candidates = fetch_youtube() + fetch_news()
    inserted = 0
    summarised = 0
    for it in candidates:
        it.setdefault("ai_summary", "")
        if db.upsert_item(it):                      # only True for brand-new rows
            inserted += 1
            if claude_ai.is_enabled():
                summary = claude_ai.summarise(it["title"], it.get("description", ""), it["kind"])
                if summary:
                    # re-find the row id by source+external_id via a cheap query
                    with db.get_conn() as conn:
                        row = conn.execute(
                            "select id from feed_items where source=%s and external_id=%s",
                            [it["source"], it["external_id"]],
                        ).fetchone()
                    if row:
                        db.set_ai_summary(row["id"], summary)
                        summarised += 1
    archived = db.archive_old(keep_live=keep_live)
    result = {
        "fetched": len(candidates),
        "inserted": inserted,
        "summarised": summarised,
        "archived": archived,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    print(f"[ingest] {result}")
    return result


if __name__ == "__main__":
    db.init_pool()
    try:
        run()
    finally:
        db.close_pool()
