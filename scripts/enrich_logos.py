"""Download company logos for jobs already in the pool (specs 010, 011).

New scrapes download `companyLogo` themselves; this fills it in for jobs
that have none, and converts old hot-linked logo URLs into downloaded files
in data/logos/. Each board is handled once. A board with no logo is stored
as `null` so re-runs skip it; pass --retry to try those again.

Run from the repo root:
    .venv\Scripts\python -m scripts.enrich_logos [--concurrency 8] [--retry]
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from scripts.ats.boards import ATS
from scripts.ats.browser import browser_context
from scripts.ats.logos import save_logo
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


def needs_logo(job: dict, retry: bool) -> bool:
    logo = job.get("companyLogo", ...)
    if logo is ...:
        return True  # never looked
    if logo is None:
        return retry  # looked, none found
    return logo.startswith("http")  # hot-linked before spec 011


async def run(concurrency: int, retry: bool, headed: bool) -> None:
    pool = json.loads(POOL.read_text(encoding="utf-8"))
    todo = [j for j in pool["jobs"] if needs_logo(j, retry)]

    boards: dict[tuple[str, str], list[dict]] = {}
    for job in todo:
        boards.setdefault((job["ats"], job.get("boardSlug", "")), []).append(job)
    print(f"{len(todo)} jobs on {len(boards)} boards need a logo ({len(pool['jobs'])} in pool)")

    gate = asyncio.Semaphore(concurrency)

    async def fetch(jobs: list[dict]) -> tuple[str | None, str | None]:
        first = jobs[0]
        async with gate:
            source = first.get("companyLogoSource") or (first["companyLogo"] if (first.get("companyLogo") or "").startswith("http") else None)
            if not source and (url := board_page(first)):
                source = await board_logo(context.request, ATS_KEY[first["ats"]], url)
            return source, (await save_logo(context.request, source) if source else None)

    async with browser_context(headed=headed) as context:
        results = await asyncio.gather(*(fetch(jobs) for jobs in boards.values()))

    for jobs, (source, logo) in zip(boards.values(), results):
        for job in jobs:
            job["companyLogo"] = logo
            job["companyLogoSource"] = source
    POOL.write_text(json.dumps(pool, indent=1, ensure_ascii=False), encoding="utf-8")

    by_ats: dict[str, list[int]] = {}
    for (ats, _), (_, logo) in zip(boards, results):
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
