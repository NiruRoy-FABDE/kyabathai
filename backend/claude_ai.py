"""
claude_ai.py — all calls to the Claude API live here, on the SERVER.

Your Anthropic key never reaches the browser. The frontend asks this backend,
the backend asks Claude. That single rule is what keeps your key (and your bill)
safe.
"""
import os
from typing import Optional

import anthropic

_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")

# Client is created lazily so a missing key doesn't crash import / health checks.
_client: Optional[anthropic.Anthropic] = None


def _get_client() -> Optional[anthropic.Anthropic]:
    global _client
    if not _API_KEY:
        return None
    if _client is None:
        _client = anthropic.Anthropic(api_key=_API_KEY)
    return _client


def is_enabled() -> bool:
    return bool(_API_KEY)


def summarise(title: str, description: str = "", kind: str = "video") -> str:
    """
    One punchy 'kya baat hai' line for a feed item. Used at ingest time.
    Returns "" on any failure so ingestion never breaks because of AI.
    """
    client = _get_client()
    if client is None:
        return ""
    thing = "viral video" if kind == "video" else "news story"
    prompt = (
        f"Write ONE short, lively caption (max 15 words) for this {thing}, in the "
        f"playful 'kya baat hai' spirit — fun, Hinglish-friendly, no hashtags, no quotes.\n\n"
        f"Title: {title}\n"
        f"Details: {description[:500]}"
    )
    try:
        msg = client.messages.create(
            model=_MODEL,
            max_tokens=60,
            messages=[{"role": "user", "content": prompt}],
        )
        return _text_of(msg).strip().strip('"')
    except Exception:
        return ""


def explain(title: str, description: str = "", kind: str = "video") -> str:
    """
    A longer, on-demand 'why this is wow / what's going on here' explainer,
    triggered when a visitor taps the ✨ button on a card.
    """
    client = _get_client()
    if client is None:
        return "AI explainer is not configured yet."
    thing = "viral video" if kind == "video" else "news story"
    prompt = (
        f"In 2-3 friendly sentences, explain to a casual reader what this {thing} is "
        f"about and why people find it interesting. Keep it light and clear.\n\n"
        f"Title: {title}\nDetails: {description[:1200]}"
    )
    try:
        msg = client.messages.create(
            model=_MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return _text_of(msg).strip()
    except Exception as e:
        return f"Could not generate an explanation right now. ({type(e).__name__})"


def _text_of(message) -> str:
    """Pull plain text out of a Claude response, ignoring non-text blocks."""
    parts = []
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "\n".join(parts)
