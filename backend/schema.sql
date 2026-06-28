-- ============================================================================
--  kyabathai.com  —  database schema  (PostgreSQL / Supabase)
--  Run this ONCE in Supabase → SQL Editor (or via psql) before first deploy.
--  It is safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto (already enabled on Supabase, but be safe)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
--  feed_items  —  every viral video / news item ever ingested (this IS the archive)
-- ---------------------------------------------------------------------------
create table if not exists feed_items (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('video','news','reel')),
  source       text not null,                 -- 'youtube' | 'newsapi' | 'gnews' | 'manual'
  external_id  text not null,                 -- youtube videoId / hashed article url
  title        text not null,
  url          text not null,
  thumbnail    text,
  channel      text,                          -- channel name / publisher
  description  text,
  ai_summary   text,                          -- short "kya baat hai" line written by Claude
  score        numeric default 0,             -- views / popularity, used for ranking ties
  published_at timestamptz,                   -- when the video/article went live
  ingested_at  timestamptz not null default now(),
  archived     boolean not null default false,-- rotated out of the live feed but kept forever
  -- one row per (source, external_id) → ingestion is idempotent, no duplicates
  unique (source, external_id)
);

-- newest-first is the most common query → index it
create index if not exists feed_items_recent_idx
  on feed_items (coalesce(published_at, ingested_at) desc);

create index if not exists feed_items_kind_idx     on feed_items (kind);
create index if not exists feed_items_archived_idx on feed_items (archived);

-- full-text search for the archive search box
create index if not exists feed_items_search_idx
  on feed_items using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')));

-- ---------------------------------------------------------------------------
--  Row Level Security
--  The PUBLIC (anon) site only ever READS. All writes happen from the Python
--  backend using the SERVICE-ROLE connection string, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table feed_items enable row level security;

drop policy if exists "public can read feed" on feed_items;
create policy "public can read feed"
  on feed_items for select
  to anon, authenticated
  using (true);

-- NOTE: no insert/update/delete policy for anon → the public can never write.
-- The backend connects with the service role and is exempt from RLS.

-- ---------------------------------------------------------------------------
--  manual_blocks  —  content added manually via /admin panel
--  block_type: 'youtube' | 'instagram' | 'news' | 'document' | 'app'
-- ---------------------------------------------------------------------------
create table if not exists manual_blocks (
  id           uuid primary key default gen_random_uuid(),
  block_type   text not null check (block_type in ('youtube','instagram','news','document','app')),
  title        text not null,
  url          text not null,
  thumbnail    text,
  caption      text,
  description  text,
  source_label text,
  sort_order   int not null default 0,
  visible      boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists manual_blocks_visible_idx on manual_blocks (visible, sort_order);

alter table manual_blocks enable row level security;

drop policy if exists "public can read blocks" on manual_blocks;
create policy "public can read blocks"
  on manual_blocks for select
  to anon, authenticated
  using (visible = true);
