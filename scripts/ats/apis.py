"""Public job-board APIs for Greenhouse, Ashby and Lever (spec 015).

Big employers often redirect their board *page* to their own careers site,
or have boards so large the page times out, but these public JSON APIs keep
working. They also return the description and posting date, so those jobs
need no separate enrichment pass. Requests go through Playwright's request
client (plain Playwright, never Hyperbrowser). Each fetcher returns None when
the API isn't usable, and the caller falls back to the browser scraper.
"""

from __future__ import annotations

import html
from datetime import datetime, timezone
from typing import Awaitable, Callable

from playwright.async_api import APIRequestContext

from scripts.ats.models import Board, ScrapedJob

API_TIMEOUT_MS = 60_000
MAX_DESCRIPTION_CHARS = 8000


def _text(fragment: str | None) -> str | None:
    if not fragment:
        return None
    from scripts.enrich_descriptions import html_to_text  # same cleanup as the enrichment script

    text = html_to_text(html.unescape(fragment))
    return text[:MAX_DESCRIPTION_CHARS] or None


def _job(board: Board, title: str, location: str, url: str, **extra) -> ScrapedJob:
    return ScrapedJob(
        ats=board.ats,
        company=board.company,
        board_slug=board.slug,
        title=" ".join(title.split()),
        location=" ".join(location.split()),
        url=url,
        **extra,
    )


async def _json(request: APIRequestContext, url: str):
    try:
        response = await request.get(url, timeout=API_TIMEOUT_MS)
        return await response.json() if response.ok else None
    except Exception:
        return None


async def greenhouse(request: APIRequestContext, board: Board) -> list[ScrapedJob] | None:
    data = await _json(request, f"https://boards-api.greenhouse.io/v1/boards/{board.slug}/jobs?content=true")
    if not isinstance(data, dict) or "jobs" not in data:
        return None
    return [
        _job(
            board,
            j.get("title") or "",
            (j.get("location") or {}).get("name") or "",
            j.get("absolute_url") or "",
            posted_at=j.get("first_published") or j.get("updated_at"),
            description=_text(j.get("content")),
        )
        for j in data["jobs"]
        if j.get("absolute_url")
    ]


async def ashby(request: APIRequestContext, board: Board) -> list[ScrapedJob] | None:
    data = await _json(request, f"https://api.ashbyhq.com/posting-api/job-board/{board.slug}")
    if not isinstance(data, dict) or "jobs" not in data:
        return None
    jobs = []
    for j in data["jobs"]:
        if j.get("isListed") is False or not j.get("jobUrl"):
            continue
        places = [j.get("location") or ""] + [s.get("location") or "" for s in j.get("secondaryLocations") or []]
        country = ((j.get("address") or {}).get("postalAddress") or {}).get("addressCountry")
        jobs.append(_job(
            board,
            j.get("title") or "",
            " / ".join(p for p in places if p) or ("Remote" if j.get("isRemote") else ""),
            j["jobUrl"],
            country=country,
            posted_at=j.get("publishedAt"),
            description=(j.get("descriptionPlain") or "")[:MAX_DESCRIPTION_CHARS] or _text(j.get("descriptionHtml")),
        ))
    return jobs


async def lever(request: APIRequestContext, board: Board) -> list[ScrapedJob] | None:
    data = await _json(request, f"https://api.lever.co/v0/postings/{board.slug}?mode=json")
    if not isinstance(data, list):
        return None
    jobs = []
    for j in data:
        if not j.get("hostedUrl"):
            continue
        created = j.get("createdAt")
        jobs.append(_job(
            board,
            j.get("text") or "",
            (j.get("categories") or {}).get("location") or "",
            j["hostedUrl"],
            country=j.get("country"),
            posted_at=datetime.fromtimestamp(created / 1000, timezone.utc).isoformat() if isinstance(created, (int, float)) else None,
            description=(j.get("descriptionPlain") or "")[:MAX_DESCRIPTION_CHARS] or None,
        ))
    return jobs


API_FETCHERS: dict[str, Callable[[APIRequestContext, Board], Awaitable[list[ScrapedJob] | None]]] = {
    "greenhouse": greenhouse,
    "ashby": ashby,
    "lever": lever,
}
