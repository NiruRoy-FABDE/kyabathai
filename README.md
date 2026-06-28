# kyabathai.com — v2

> Your site, modernised. Same look, now with an **auto-updating viral feed**
> (videos + news, newest first), **Claude AI** explainers, a permanent
> **archive**, and a real, secure backend.

**Live site:** https://kyabathai.com

---

## What changed (in plain words)

| | Before (v1) | Now (v2) |
|---|---|---|
| Front end | One hand-written `index.html` | **React + Vite** (your design preserved exactly) |
| Back end | None (Supabase only) | **Python / FastAPI** on Render |
| Database | Supabase | **Supabase Postgres** (same project, kept) |
| Content | Added by hand | **Auto-pulled** trending YouTube + news every 3 hrs |
| AI | None | **Claude** writes a "kya baat hai" line + on-demand "Why it's wow" |
| Archive | None | Every item kept forever, searchable |
| Security | Free SSL + headers | Same SSL + stricter headers + server-side keys |

Your original files are untouched in **`/legacy`** (the old `index.html`,
`admin.html`, images, video) in case you ever want anything back.

> **One honest note about Instagram:** there is no legitimate public API for
> "viral reels," and scraping breaks constantly and violates Instagram's terms.
> So the *automatic* feed covers **YouTube + news**. You add Instagram reels by
> hand (one command — see step 6); they then appear in the feed like everything else.

---

## Project structure

```
kyabathai/
├── frontend/          ← React app → deploys to Netlify
│   └── src/...        (your design is in src/lib/staticHtml.js + src/styles.css)
├── backend/           ← Python FastAPI → deploys to Render
│   ├── main.py        (the API)
│   ├── ingest.py      (pulls viral videos + news)
│   ├── claude_ai.py   (Claude calls — key stays here, never in the browser)
│   ├── db.py          (Postgres access)
│   ├── schema.sql     (run this once in Supabase)
│   ├── render.yaml    (one-click Render setup)
│   └── add_reel.py    (manually add an Instagram reel)
├── legacy/            ← your original site, preserved
├── netlify.toml       ← tells Netlify to build the frontend
└── README.md          ← this file
```

---

## Deploy — do this once (about 30–40 minutes)

You'll set up **3 things**: the database (Supabase), the backend (Render), and the
frontend (Netlify). Take them in order.

### Step 1 — Push this to GitHub
Replace your old repo contents with this whole folder and push (or upload the ZIP
via GitHub's web UI as you usually do). Nothing deploys yet — that's fine.

### Step 2 — Set up the database (Supabase)
1. Open your existing project at https://supabase.com → **SQL Editor**.
2. Open `backend/schema.sql` from this repo, copy everything, paste it in, and click **Run**.
   (Safe to re-run; it only creates the `feed_items` table + indexes.)
3. Get your database connection string: **Project Settings → Database → Connection string → URI**.
   It looks like
   `postgresql://postgres:YOUR_PASSWORD@db.lnbwqctcdwthpggrxukp.supabase.co:5432/postgres`.
   Keep it handy for Step 3.

### Step 3 — Get your API keys (free)
- **Claude:** https://console.anthropic.com → API Keys → create one (`sk-ant-…`). You already subscribe.
- **YouTube:** https://console.cloud.google.com → create a project → enable **"YouTube Data API v3"** → Credentials → API key.
- **News (pick one):** https://newsapi.org/register *(free)* — or https://gnews.io.

### Step 4 — Deploy the backend (Render)
1. Go to https://render.com → sign in with GitHub → **New → Blueprint**.
2. Pick this repo. Render reads `backend/render.yaml` and creates two services:
   `kyabathai-api` (the web API) and `kyabathai-ingest` (the every-3-hours puller).
3. It will ask you to fill in the secret env vars. Paste these into **both** services
   where they appear:
   - `DATABASE_URL` → the URI from Step 2
   - `ANTHROPIC_API_KEY` → your Claude key
   - `YOUTUBE_API_KEY` → your YouTube key
   - `NEWSAPI_KEY` → your NewsAPI key (or `GNEWS_KEY` if you chose GNews)
   - `INGEST_SECRET` → make up a long random password (web service only)
4. Click **Apply**. When `kyabathai-api` is live, copy its URL —
   it looks like `https://kyabathai-api.onrender.com`. You need it in Step 5.
5. Test it: open `https://kyabathai-api.onrender.com/api/health` — you should see
   `{"ok": true, "ai": true}`.

### Step 5 — Deploy the frontend (Netlify)
1. https://app.netlify.com → **Add new site → Import an existing project** → pick this repo.
2. Netlify reads the root `netlify.toml` automatically (base = `frontend`). Leave build settings as detected.
3. **Site settings → Environment variables → Add:**
   `VITE_API_BASE = https://kyabathai-api.onrender.com`  *(your URL from Step 4, no trailing slash)*
4. **Deploys → Trigger deploy** so it picks up that variable.
5. Re-point your domain if needed (**Domain management** → `kyabathai.com`). HTTPS is automatic.

### Step 6 — Fill the feed for the first time
The cron job runs every 3 hours, but to see content immediately, trigger one pull:
```bash
curl -X POST https://kyabathai-api.onrender.com/api/ingest \
  -H "X-Ingest-Secret: THE_INGEST_SECRET_YOU_CHOSE"
```
Refresh kyabathai.com — trending videos and news now fill the feed, newest first. 🎉

---

## Everyday use

**Add an Instagram reel (or any link) by hand** — from the `backend/` folder:
```bash
python add_reel.py "https://www.instagram.com/reel/XXXX/" "My funny reel caption"
```
(You can run this locally after `pip install -r requirements.txt` and creating a `.env`,
or add it as a one-off Render "Job".)

**Change how often it pulls:** edit the `schedule` line in `backend/render.yaml`
(`0 */3 * * *` = every 3 hours).

**Update the site design or text:** the preserved design lives in
`frontend/src/lib/staticHtml.js` and `frontend/src/styles.css`. Edit, commit, push —
Netlify redeploys in ~30 seconds, same as before.

---

## Security — what protects you and your visitors

- **HTTPS / SSL:** auto-provisioned and auto-renewed by both Netlify and Render
  (Let's Encrypt — the same TLS standard banks use). No certificate is literally
  "unbreakable," but this is the real-world gold standard, and it's free and automatic.
- **Your Claude key is never in the browser.** The React app only ever talks to your
  backend; the backend talks to Claude. This is the single most important rule and it's
  built in.
- **The public can only read.** Database Row-Level Security lets visitors read the feed
  but never write. All writes go through your backend using a service connection.
- **Abuse protection:** the `/api/ingest` endpoint needs your secret header, so nobody
  can run up your Claude bill by spamming it. CORS is locked to your domains.
- **Hardened headers** on both the site and the API (no clickjacking, no MIME sniffing,
  strict referrer policy, HSTS).

---

## Costs (all free tiers are enough to start)
- Netlify: free. Render: free (the API sleeps after ~15 min idle, wakes in a few seconds).
- Supabase: free tier. YouTube + NewsAPI: free tiers cover hourly pulls easily.
- Claude: pay-as-you-go on your existing subscription. Summaries are tiny; budget is small.

---

## Troubleshooting
- **Feed says "not connected":** `VITE_API_BASE` isn't set in Netlify, or you didn't
  redeploy after setting it.
- **Feed is empty:** run the Step 6 ingest command, or wait for the next cron run.
- **`/api/health` shows `"ai": false`:** `ANTHROPIC_API_KEY` isn't set on the API service.
- **First request is slow:** the free Render service was asleep — it wakes in a few seconds.
