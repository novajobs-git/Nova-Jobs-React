"""One Playwright scraper per ATS.

Each takes an open page and a Board and returns that board's jobs. Where a
board renders from its own JSON (Ashby, Workday) the scraper reads those
responses; otherwise it reads the rendered DOM. Selectors were taken from
live boards on 2026-10-02.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable
from urllib.parse import urlparse

from playwright.async_api import Page, TimeoutError as PlaywrightTimeout

from scripts.ats.browser import NAV_TIMEOUT_MS, capture_json
from scripts.ats.models import Board, ScrapedJob
from scripts.ats.us_filter import is_us_location

MAX_PAGES = 25  # Greenhouse pagination / Workday result pages per board
WORKDAY_PAGE_SIZE = 20
WORKDAY_MAX_DETAIL_LOOKUPS = 40  # "N Locations" postings resolved per board
SMARTRECRUITERS_MAX_DETAIL_LOOKUPS = 80  # job pages opened on department-grouped boards


class BoardSkipped(Exception):
    """The board can't be scraped as an ATS board (e.g. it redirects to the company's own site)."""


def _require_host(page: Page, host: str, board: Board) -> None:
    if host not in urlparse(page.url).netloc:
        raise BoardSkipped(f"{board.slug} redirects to {page.url}")


def _job(board: Board, title: str, location: str, url: str, **extra: str | None) -> ScrapedJob:
    return ScrapedJob(
        ats=board.ats,
        company=board.company,
        board_slug=board.slug,
        title=" ".join(title.split()),
        location=" ".join(location.split()),
        url=url,
        **extra,
    )


# Greenhouse: job-boards.greenhouse.io renders rows server-side, paginated.
async def scrape_greenhouse(page: Page, board: Board) -> list[ScrapedJob]:
    await page.goto(board.url or f"https://job-boards.greenhouse.io/{board.slug}", wait_until="networkidle", timeout=NAV_TIMEOUT_MS)
    _require_host(page, "greenhouse.io", board)

    jobs: list[ScrapedJob] = []
    for _ in range(MAX_PAGES):
        rows = await page.eval_on_selector_all(
            "tr.job-post a",
            """els => els.map(a => ({
                url: a.href,
                title: a.querySelector('.body--medium')?.textContent ?? '',
                location: a.querySelector('.body--metadata')?.textContent ?? '',
            }))""",
        )
        jobs += [_job(board, r["title"], r["location"], r["url"]) for r in rows if r["title"]]

        next_button = page.locator("button.pagination__next[aria-disabled='false']")
        if not rows or await next_button.count() == 0:
            break
        first_url = rows[0]["url"]
        await next_button.first.click()
        await page.wait_for_function(
            "first => document.querySelector('tr.job-post a')?.href !== first", arg=first_url, timeout=NAV_TIMEOUT_MS
        )
    return jobs


# Lever: every posting is on one server-rendered page.
async def scrape_lever(page: Page, board: Board) -> list[ScrapedJob]:
    await page.goto(board.url or f"https://jobs.lever.co/{board.slug}", wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
    _require_host(page, "lever.co", board)
    rows = await page.eval_on_selector_all(
        ".posting",
        """els => els.map(p => ({
            url: p.querySelector('a.posting-title')?.href ?? '',
            title: p.querySelector('[data-qa="posting-name"], h5')?.textContent ?? '',
            location: p.querySelector('.posting-categories .location')?.textContent ?? '',
        }))""",
    )
    return [_job(board, r["title"], r["location"], r["url"]) for r in rows if r["url"] and r["title"]]


# Ashby: the board page loads its postings from a GraphQL call; read that.
async def scrape_ashby(page: Page, board: Board) -> list[ScrapedJob]:
    url = board.url or f"https://jobs.ashbyhq.com/{board.slug}"
    payloads = await capture_json(page, url, "op=ApiJobBoardWithTeams")
    _require_host(page, "ashbyhq.com", board)
    jobs: list[ScrapedJob] = []
    for payload in payloads:
        job_board = ((payload or {}).get("data") or {}).get("jobBoard") or {}
        for post in job_board.get("jobPostings") or []:
            names = [post.get("locationName") or ""]
            names += [loc.get("locationName", "") for loc in post.get("secondaryLocations") or [] if isinstance(loc, dict)]
            location = "; ".join(n for n in names if n)
            if post.get("workplaceType") == "Remote" and "remote" not in location.lower():
                location = f"Remote - {location}" if location else "Remote"
            jobs.append(_job(board, post.get("title", ""), location, f"{url.rstrip('/')}/{post['id']}"))
    return jobs


# Workday: the page POSTs to /wday/cxs/{tenant}/{site}/jobs. Capture that,
# then page through the same endpoint from inside the browser session.
async def scrape_workday(page: Page, board: Board) -> list[ScrapedJob]:
    if not board.url:
        raise BoardSkipped(f"{board.slug} has no Workday URL")
    payloads = await capture_json(page, board.url, "/jobs")
    _require_host(page, "myworkdayjobs.com", board)
    cxs = next((p for p in payloads if isinstance(p, dict) and "jobPostings" in p), None)
    if cxs is None:
        return []

    origin = f"https://{urlparse(page.url).netloc}"
    match = re.search(r"/wday/cxs/[^/]+/[^/?]+", await _workday_endpoint(page))
    endpoint = f"{origin}{match.group(0)}" if match else None
    postings = list(cxs.get("jobPostings") or [])
    total = int(cxs.get("total") or len(postings))

    offset = len(postings)
    while endpoint and offset < total and offset < WORKDAY_PAGE_SIZE * MAX_PAGES:
        response = await page.request.post(
            f"{endpoint}/jobs",
            data={"appliedFacets": {}, "limit": WORKDAY_PAGE_SIZE, "offset": offset, "searchText": ""},
        )
        if not response.ok:
            break
        batch = (await response.json()).get("jobPostings") or []
        if not batch:
            break
        postings += batch
        offset += len(batch)

    site_url = board.url.rstrip("/")
    jobs: list[ScrapedJob] = []
    lookups = 0
    for post in postings:
        path = post.get("externalPath")
        if not path:
            continue
        location = post.get("locationsText") or ""
        # "3 Locations" says nothing about the country; ask the posting itself.
        if endpoint and re.fullmatch(r"\d+ Locations?", location) and lookups < WORKDAY_MAX_DETAIL_LOOKUPS:
            lookups += 1
            location = await _workday_locations(page, endpoint, path) or location
        jobs.append(_job(board, post.get("title", ""), location, f"{site_url}{path}", posted_at=_workday_posted(post.get("postedOn"))))
    return jobs


def _workday_posted(label: str | None) -> str | None:
    """'Posted Today' / 'Posted Yesterday' / 'Posted 3 Days Ago' -> ISO date. '30+ Days' is left unknown."""
    if not label:
        return None
    text = label.lower()
    days = 0 if "today" in text else 1 if "yesterday" in text else None
    if days is None and "+" not in text and (m := re.search(r"(\d+)\s+days?", text)):
        days = int(m.group(1))
    if days is None:
        return None
    return (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()


async def _workday_endpoint(page: Page) -> str:
    """The cxs base path the page itself used, e.g. /wday/cxs/acme/External."""
    return await page.evaluate(
        "() => performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('/wday/cxs/') && n.endsWith('/jobs')) || ''"
    )


async def _workday_locations(page: Page, endpoint: str, path: str) -> str | None:
    response = await page.request.get(f"{endpoint}{path}")
    if not response.ok:
        return None
    info = (await response.json()).get("jobPostingInfo") or {}
    names = [info.get("location") or ""] + list(info.get("additionalLocations") or [])
    country = (info.get("country") or {}).get("descriptor") if isinstance(info.get("country"), dict) else None
    joined = "; ".join(n for n in names if n)
    return f"{joined}; {country}" if country and joined else joined or country


# SmartRecruiters: openings render in groups with per-group "show more"
# links. Boards group by location *or* by department; in the second case the
# heading is not a location, so each job page is asked for its address.
async def scrape_smartrecruiters(page: Page, board: Board) -> list[ScrapedJob]:
    await page.goto(board.url or f"https://careers.smartrecruiters.com/{board.slug}", wait_until="networkidle", timeout=NAV_TIMEOUT_MS)
    _require_host(page, "smartrecruiters.com", board)

    for _ in range(MAX_PAGES):
        more = page.locator("#st-openings a[data-more]")
        if await more.count() == 0:
            break
        before = await page.locator("#st-openings li.opening-job").count()
        await more.first.click()
        try:
            await page.wait_for_function(
                "n => document.querySelectorAll('#st-openings li.opening-job').length > n", arg=before, timeout=10_000
            )
        except PlaywrightTimeout:
            break  # the link didn't load anything new

    grouped_by_location = await page.evaluate(
        "() => /browse by:\\s*location/i.test(document.querySelector('#st-openings')?.innerText ?? '')"
    )
    rows = await page.eval_on_selector_all(
        "#st-openings li.opening-job a",
        """els => els.map(a => ({
            url: a.href.split('?')[0],
            title: a.querySelector('.job-title')?.textContent ?? '',
            heading: a.closest('ul')?.parentElement?.querySelector('h3')?.textContent ?? '',
        }))""",
    )

    jobs: list[ScrapedJob] = []
    for i, r in enumerate(row for row in rows if row["title"]):
        location, country = r["heading"], None
        if not grouped_by_location:
            if i >= SMARTRECRUITERS_MAX_DETAIL_LOOKUPS:
                break  # without a location the job can't pass the US filter anyway
            location, country = await _smartrecruiters_location(page, r["url"])
        jobs.append(_job(board, r["title"], location, r["url"], country=country))
    return jobs


async def _smartrecruiters_location(page: Page, job_url: str) -> tuple[str, str | None]:
    response = await page.request.get(job_url)
    if not response.ok:
        return "", None
    html = await response.text()
    address = re.search(r'formattedAddress="([^"]*)"', html)
    country = re.search(r'itemprop="addressCountry" content="([^"]*)"', html)
    return (address.group(1) if address else ""), (country.group(1) if country else None)


SCRAPERS: dict[str, Callable[[Page, Board], Awaitable[list[ScrapedJob]]]] = {
    "greenhouse": scrape_greenhouse,
    "lever": scrape_lever,
    "ashby": scrape_ashby,
    "workday": scrape_workday,
    "smartrecruiters": scrape_smartrecruiters,
}


def us_only(jobs: list[ScrapedJob]) -> list[ScrapedJob]:
    return [j for j in jobs if is_us_location(j.location, j.country)]
