"""
add_reel.py — manually add an Instagram reel (or any link) to the feed.

Instagram has no legit auto-feed API, so reels are added by hand. They then show
up in the live feed and archive exactly like the auto-ingested items.

Usage:
  python add_reel.py "https://www.instagram.com/reel/XXXX/" "Funny cat does a backflip"
  python add_reel.py "<url>" "<title>" --kind reel --thumb "<image_url>" --channel "@handle"
"""
import argparse

import db
import ingest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("title")
    ap.add_argument("--kind", default="reel", choices=["reel", "video", "news"])
    ap.add_argument("--thumb", default="")
    ap.add_argument("--channel", default="")
    ap.add_argument("--desc", default="")
    args = ap.parse_args()

    db.init_pool()
    try:
        added = ingest.add_manual(
            kind=args.kind, url=args.url, title=args.title,
            thumbnail=args.thumb, channel=args.channel, description=args.desc,
        )
        print("✓ added" if added else "• already in the feed (skipped)")
    finally:
        db.close_pool()


if __name__ == "__main__":
    main()
