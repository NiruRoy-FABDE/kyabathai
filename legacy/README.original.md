# kyabathai

> A daily dose of internet wow — funny reels, weird tech, useful life hacks — plus a tour of every platform I've built.

**Live site:** https://kyabathai.com

---

## 🚀 Deploy to Netlify via GitHub

### Step 1 — Create GitHub repo
1. Go to https://github.com/new
2. Name the repo: `kyabathai`
3. Set to **Public** (or Private — Netlify works with both)
4. Do NOT initialize with README (you already have these files)
5. Click **Create repository**

### Step 2 — Push files to GitHub
Open terminal / Git Bash in the project folder and run:

```bash
git init
git add .
git commit -m "Initial commit — kyabathai.com"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kyabathai.git
git push -u origin main
```
Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 3 — Connect to Netlify
1. Go to https://app.netlify.com
2. Click **Add new site → Import an existing project**
3. Choose **GitHub** → authorize → select the `kyabathai` repo
4. Build settings:
   - Build command: *(leave blank)*
   - Publish directory: `.`
5. Click **Deploy site**

### Step 4 — Connect custom domain kyabathai.com
1. In Netlify → Site settings → **Domain management**
2. Click **Add custom domain** → type `kyabathai.com`
3. Go to your domain registrar (GoDaddy / Namecheap / wherever you bought kyabathai.com)
4. Update DNS:
   - Add a **CNAME** record: `www` → `your-netlify-site.netlify.app`
   - Add an **A** record: `@` → `75.2.60.5` (Netlify's load balancer IP)
5. Back in Netlify → click **Verify DNS** → **Enable HTTPS** (free SSL auto-provisioned)

DNS propagation takes 10–60 minutes typically.

---

## ✏️ How to update content

### Add YouTube video embeds (Reels section)
In `index.html`, find the reel card with `data-slot="reel-1"` (or reel-2, reel-3...) and replace the placeholder div with:

```html
<div class="embed-slot" data-slot="reel-1">
  <iframe 
    src="https://www.youtube.com/embed/YOUR_VIDEO_ID" 
    title="Your caption here"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>
```
Replace `YOUR_VIDEO_ID` with the 11-character ID from the YouTube URL (e.g. `dQw4w9WgXcQ`).

### Add Instagram Reel embeds
Instagram embeds require their script. Add this once before `</body>`:
```html
<script async src="//www.instagram.com/embed.js"></script>
```
Then in the reel slot, paste the Instagram embed blockquote code (from Instagram → Share → Embed).

### Update project card descriptions
Each card is an `<article class="proj-card">` block. The ones marked `(best-guess description — confirming exact details soon)` are for **drapyfy.com** and **eaiin.com** — just edit the `<p>` text inside those cards.

### Update ad slots
Find the three `<div class="ad-slot">` blocks in the ad section and replace the placeholder content with your MADAIX-generated ad creative (image + CTA button linking to the target site).

---

## 📁 File structure

```
kyabathai/
├── index.html      ← the entire site (single file)
├── netlify.toml    ← Netlify config (do not delete)
└── README.md       ← this file
```

---

## 🔄 Updating the live site
After any edit:
```bash
git add .
git commit -m "Update: describe what you changed"
git push
```
Netlify auto-deploys within ~30 seconds of every push to `main`.
