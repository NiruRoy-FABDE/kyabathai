"""
db.py — thin PostgreSQL access layer (psycopg 3 + connection pool).

Why psycopg and not the supabase client?  You asked for a Postgres backend in
Python; psycopg talks to Supabase's Postgres directly with plain SQL, which is
the most standard, debuggable, framework-free way to do it.
"""
import os
from contextlib import contextmanager
from typing import Any, Optional

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_DATABASE_URL = os.environ.get("DATABASE_URL", "")

# A small pool is plenty for a content site. open=False so importing this module
# never crashes when DATABASE_URL is missing (e.g. during `py_compile` checks).
pool: Optional[ConnectionPool] = None
if _DATABASE_URL:
    pool = ConnectionPool(
        conninfo=_DATABASE_URL,
        min_size=1,
        max_size=5,
        open=False,
        kwargs={"row_factory": dict_row},
    )


def init_pool() -> None:
    """Open the pool. Called once on FastAPI startup."""
    if pool is not None:
        pool.open()


def close_pool() -> None:
    if pool is not None:
        pool.close()


@contextmanager
def get_conn():
    if pool is None:
        raise RuntimeError("DATABASE_URL is not set — cannot reach the database.")
    with pool.connection() as conn:
        yield conn


# ---------------------------------------------------------------------------
#  Reads
# ---------------------------------------------------------------------------
def fetch_feed(limit: int = 30, offset: int = 0, kind: Optional[str] = None) -> list[dict[str, Any]]:
    """Newest-first feed (the live, non-archived items)."""
    where = "where archived = false"
    params: list[Any] = []
    if kind in ("video", "news", "reel"):
        where += " and kind = %s"
        params.append(kind)
    params.extend([limit, offset])
    sql = f"""
        select id, kind, source, title, url, thumbnail, channel,
               description, ai_summary, score, published_at, ingested_at
        from feed_items
        {where}
        order by coalesce(published_at, ingested_at) desc
        limit %s offset %s
    """
    with get_conn() as conn:
        return conn.execute(sql, params).fetchall()


def fetch_archive(limit: int = 40, offset: int = 0, q: Optional[str] = None,
                  kind: Optional[str] = None) -> list[dict[str, Any]]:
    """Everything ever ingested — searchable, paginated."""
    where = "where true"
    params: list[Any] = []
    if kind in ("video", "news", "reel"):
        where += " and kind = %s"
        params.append(kind)
    if q:
        where += " and to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')) @@ plainto_tsquery('simple', %s)"
        params.append(q)
    params.extend([limit, offset])
    sql = f"""
        select id, kind, source, title, url, thumbnail, channel,
               description, ai_summary, score, published_at, ingested_at, archived
        from feed_items
        {where}
        order by coalesce(published_at, ingested_at) desc
        limit %s offset %s
    """
    with get_conn() as conn:
        return conn.execute(sql, params).fetchall()


def fetch_one(item_id: str) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        return conn.execute(
            "select * from feed_items where id = %s", [item_id]
        ).fetchone()


def stats() -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute(
            """
            select count(*)                                 as total,
                   count(*) filter (where kind = 'video')   as videos,
                   count(*) filter (where kind = 'news')     as news,
                   count(*) filter (where archived = false)  as live,
                   max(ingested_at)                          as last_ingest
            from feed_items
            """
        ).fetchone()
    return row or {}


# ---------------------------------------------------------------------------
#  Writes (used by the ingestion job only)
# ---------------------------------------------------------------------------
def upsert_item(item: dict[str, Any]) -> bool:
    """
    Insert one item. On (source, external_id) conflict, do nothing.
    Returns True if a NEW row was inserted (so we only AI-summarise new stuff).
    """
    sql = """
        insert into feed_items
            (kind, source, external_id, title, url, thumbnail, channel,
             description, ai_summary, score, published_at)
        values
            (%(kind)s, %(source)s, %(external_id)s, %(title)s, %(url)s,
             %(thumbnail)s, %(channel)s, %(description)s, %(ai_summary)s,
             %(score)s, %(published_at)s)
        on conflict (source, external_id) do nothing
        returning id
    """
    with get_conn() as conn:
        row = conn.execute(sql, item).fetchone()
        return row is not None


def set_ai_summary(item_id: str, summary: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "update feed_items set ai_summary = %s where id = %s", [summary, item_id]
        )


def archive_old(keep_live: int = 60) -> int:
    """
    Keep the newest `keep_live` items live; mark the rest archived.
    They stay in the table forever — nothing is ever deleted.
    """
    sql = """
        with ranked as (
          select id, row_number() over (
            order by coalesce(published_at, ingested_at) desc
          ) as rn
          from feed_items where archived = false
        )
        update feed_items f
        set archived = true
        from ranked r
        where f.id = r.id and r.rn > %s
    """
    with get_conn() as conn:
        cur = conn.execute(sql, [keep_live])
        return cur.rowcount
