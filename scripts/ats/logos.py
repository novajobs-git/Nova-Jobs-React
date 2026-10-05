"""Download company logos into the central logo store (spec 011).

Hot-linked ATS logos break when a CDN rotates URLs or blocks other sites, so
each board's logo is downloaded once and stored in data/logos/, named by a
hash of its bytes (identical logos are stored once). The Next.js app serves
them at /logos/<file>. A failed download is never a failed board: the job
just has no logo.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from playwright.async_api import APIRequestContext

from scripts.ats.browser import NAV_TIMEOUT_MS

LOGO_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "logos"
MAX_BYTES = 1_000_000

# Content types we trust only when the bytes can't be sniffed (icons, AVIF).
FALLBACK_TYPES = {"image/x-icon": "ico", "image/vnd.microsoft.icon": "ico", "image/avif": "avif"}


def sniff(body: bytes) -> str | None:
    """The image format from the file's own bytes; servers mislabel often."""
    if body.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if body.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if body[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "webp"
    head = body[:512].lstrip().lower()
    if head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in head):
        return "svg"
    return None


async def save_logo(request: APIRequestContext, url: str) -> str | None:
    """Download `url` into the logo store; returns its app path (/logos/<file>) or None."""
    try:
        response = await request.get(url, timeout=NAV_TIMEOUT_MS)
        if not response.ok:
            return None
        body = await response.body()
    except Exception:
        return None
    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
    ext = sniff(body) or FALLBACK_TYPES.get(content_type)
    if not ext or not body or len(body) > MAX_BYTES:
        return None
    name = f"{hashlib.sha256(body).hexdigest()[:20]}.{ext}"
    path = LOGO_DIR / name
    if not path.exists():
        LOGO_DIR.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    return f"/logos/{name}"
