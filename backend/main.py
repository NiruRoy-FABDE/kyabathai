"""
main.py — the FastAPI app the React site talks to.

Endpoints
  GET  /api/health              quick liveness check
  GET  /api/feed                newest-first live feed (paginated, ?kind=video|news)
  GET  /api/archive             everything ever ingested (?q= search, ?kind=, paginated)
  GET  /api/stats               counts for your own monitoring
  POST /api/explain             Claude explainer for one item ({ "id": "..."} or raw text)
  POST /api/ingest              trigger a pull now (needs X-Ingest-Secret header)
"""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

import claude_ai  # noqa: E402
import db          # noqa: E402
import ingest      # noqa: E402

INGEST_SECRET = os.environ.get("INGEST_SECRET", "")
# Allow all origins so admin panel and frontend always work without CORS errors
CORS_ORIGINS = ["*"]
ENABLE_INPROCESS_SCHEDULER = os.environ.get("ENABLE_INPROCESS_SCHEDULER", "false").lower() == "true"

_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_pool()
    global _scheduler
    if ENABLE_INPROCESS_SCHEDULER:
        # Optional: run the pull inside the web process every 3 hours.
        # On Render, the cleaner option is a separate Cron Job (see render.yaml).
        from apscheduler.schedulers.background import BackgroundScheduler
        _scheduler = BackgroundScheduler(timezone="UTC")
        _scheduler.add_job(ingest.run, "interval", hours=3, id="ingest")
        _scheduler.start()
    yield
    if _scheduler:
        _scheduler.shutdown(wait=False)
    db.close_pool()


app = FastAPI(title="kyabathai API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


# ---- security headers on every response (defence in depth) -----------------
@app.middleware("http")
async def security_headers(request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return resp


# ---- global safety net -----------------------------------------------------
# A plain 500 error in FastAPI is returned by an OUTER layer that sits outside
# the CORS middleware, so the error response has NO Access-Control-Allow-Origin
# header. The browser then reports it as a CORS failure / "Failed to fetch" and
# hides the real error. This handler catches ANY unexpected error, returns it as
# clean JSON, and attaches the CORS header itself — so the browser can always
# read the real message instead of a dead "Failed to fetch".
@app.exception_handler(Exception)
async def all_errors(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"ok": False, "error": f"{type(exc).__name__}: {exc}"},
        headers={"Access-Control-Allow-Origin": "*"},
    )


@app.get("/api/health")
def health():
    return {"ok": True, "ai": claude_ai.is_enabled()}


@app.get("/api/feed")
def feed(
    limit: int = Query(30, ge=1, le=60),
    offset: int = Query(0, ge=0),
    kind: str | None = Query(None),
):
    return {"items": db.fetch_feed(limit=limit, offset=offset, kind=kind)}


@app.get("/api/archive")
def archive(
    limit: int = Query(40, ge=1, le=60),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=120),
    kind: str | None = Query(None),
):
    return {"items": db.fetch_archive(limit=limit, offset=offset, q=q, kind=kind)}


@app.get("/api/stats")
def get_stats():
    return db.stats()


class ExplainBody(BaseModel):
    id: str | None = None
    title: str | None = None
    description: str | None = None
    kind: str | None = "video"


@app.post("/api/explain")
def explain(body: ExplainBody):
    if body.id:
        item = db.fetch_one(body.id)
        if not item:
            raise HTTPException(404, "Item not found")
        text = claude_ai.explain(
            item.get("title", ""), item.get("description", ""), item.get("kind", "video")
        )
        return {"explanation": text}
    if body.title:
        return {"explanation": claude_ai.explain(body.title, body.description or "", body.kind or "video")}
    raise HTTPException(400, "Provide an item id or a title.")


@app.post("/api/ingest")
def trigger_ingest(x_ingest_secret: str | None = Header(None)):
    if not INGEST_SECRET or x_ingest_secret != INGEST_SECRET:
        raise HTTPException(401, "Unauthorized")
    try:
        return ingest.run()
    except Exception as e:
        # Return the real reason as clean JSON (with CORS headers via the app),
        # so the admin panel shows what's wrong instead of "Failed to fetch".
        return JSONResponse(
            status_code=200,
            content={"ok": False, "error": f"{type(e).__name__}: {e}"},
            headers={"Access-Control-Allow-Origin": "*"},
        )


# ── Manual blocks (admin panel) ──────────────────────────────────────────────

class BlockBody(BaseModel):
    block_type: str
    title: str
    url: str
    thumbnail: str | None = None
    caption: str | None = None
    description: str | None = None
    source_label: str | None = None
    sort_order: int = 0
    visible: bool = True


@app.get("/api/blocks")
def get_blocks():
    return {"items": db.fetch_blocks()}


@app.post("/api/blocks")
def create_block(body: BlockBody, x_ingest_secret: str | None = Header(None)):
    if not INGEST_SECRET or x_ingest_secret != INGEST_SECRET:
        raise HTTPException(401, "Unauthorized")
    valid_types = {"youtube", "instagram", "news", "document", "app"}
    if body.block_type not in valid_types:
        raise HTTPException(400, f"block_type must be one of {valid_types}")
    block_id = db.insert_block(body.model_dump())
    return {"id": block_id, "ok": True}


@app.delete("/api/blocks/{block_id}")
def delete_block(block_id: str, x_ingest_secret: str | None = Header(None)):
    if not INGEST_SECRET or x_ingest_secret != INGEST_SECRET:
        raise HTTPException(401, "Unauthorized")
    db.delete_block(block_id)
    return {"ok": True}
