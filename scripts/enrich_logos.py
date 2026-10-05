"""Add company logos to jobs already in the pool (spec 010).

New scrapes record `companyLogo` themselves; this fills it in for jobs
scraped before that. Each board's page is fetched once and its logo is read
from the HTML (see scrapers.logo_from_html). A board with no logo is stored
as `null` so re-runs skip it; pass --retry to try those again.

Run from the repo root:
    .venv\\Scripts\\python -m scripts.enrich_logos [--concurrency 8] [--retry]
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from scripts.ats.boards import ATS
from scripts.ats.browser import browser_context
from scripts.ats.models import Board
from scripts.ats.scrapers import board_logo, board_url

POOL = Path(__file__).resolve().parent.parent / "data" / "jobs" / "us-jobs.json"
ATS_KEY = {name: key for key, name in ATS.items()}


def board_page(job: dict) -> str | None:
    key = ATS_KEY.get(job["ats"])
    if key == "workday":
        # Workday job URLs are the board URL plus /job/...; there's no slug-only URL.
        site, sep, _ = job["url"].partition("/job/")
        return site if sep else None
    return board_url(key, Board(ats=job["ats"], company=job["company"], slug=job["boardSlug"])) if key else None


async def run(concurrency: int, retry: bool, headed: bool) -> None:
    pool = json.loads(POOL.read_text(encoding="utf-8"))
    todo = [j for j in pool["jobs"] if "companyLogo" not in j or (retry and j["companyLogo"] is None)]

    boards: dict[tuple[str, str], list[dict]] = {}
    for job in todo:
        boards.setdefault((job["ats"], job.get("boardSlug", "")), []).append(job)
    print(f"{len(todo)} jobs on {len(boards)} boards need a logo ({len(pool['jobs'])} in pool)")

    gate = asyncio.Semaphore(concurrency)

    async def fetch(jobs: list[dict]) -> str | None:
        url = board_page(jobs[0])
        if not url:
            return None
        async with gate:
            return await board_logo(context.request, ATS_KEY[jobs[0]["ats"]], url)

    async with browser_context(headed=headed) as context:
        logos = await asyncio.gather(*(fetch(jobs) for jobs in boards.values()))

    for jobs, logo in zip(boards.values(), logos):
        for job in jobs:
            job["companyLogo"] = logo
    POOL.write_text(json.dumps(pool, indent=1, ensure_ascii=False), encoding="utf-8")

    by_ats: dict[str, list[int]] = {}
    for (ats, _), logo in zip(boards, logos):
        stats = by_ats.setdefault(ats, [0, 0])
        stats[0] += 1
        stats[1] += bool(logo)
    for ats, (total, found) in sorted(by_ats.items()):
        print(f"  {ats:16} {found}/{total} boards with a logo")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--retry", action="store_true", help="retry boards previously found to have no logo")
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.concurrency, args.retry, args.headed))


if __name__ == "__main__":
    main()
