"""Scrape ATS job boards with Playwright into the US-only job pool.

Boards come from the ats-scrapers company directory; jobs are read live from
each board. Output: data/jobs/us-jobs.json (deduped by content hash, merged
with previous runs). Supabase upsert replaces the file in spec 008.

Run from the repo root:
    .venv\\Scripts\\python -m scripts.scrape_jobs --ats greenhouse lever --boards 20
    .venv\\Scripts\\python -m scripts.scrape_jobs --ats workday --slug 23andme/23 --headed
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from datetime import date, datetime, timezone
from pathlib import Path

from scripts.ats.boards import ATS, load_boards
from scripts.ats.browser import browser_context
from scripts.ats.models import Board, ScrapedJob
from scripts.ats.scrapers import SCRAPERS, BoardSkipped, board_logo, board_url, us_only

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "jobs" / "us-jobs.json"
BOARD_TIMEOUT_S = 120


async def scrape_board(context, ats: str, board: Board, gate: asyncio.Semaphore, stats: dict) -> list[ScrapedJob]:
    async with gate:
        page = await context.new_page()
        started = time.monotonic()
        try:
            jobs = await asyncio.wait_for(SCRAPERS[ats](page, board), BOARD_TIMEOUT_S)
        except BoardSkipped as e:
            stats["skipped"] += 1
            print(f"  [{board.ats}] skip   {board.slug}: {e}")
            return []
        except Exception as e:  # one broken board never stops the run
            stats["failed"] += 1
            print(f"  [{board.ats}] FAILED {board.slug}: {type(e).__name__}: {str(e).splitlines()[0][:120]}")
            return []
        finally:
            await page.close()
        kept = us_only(jobs)
        stats["scraped"] += len(jobs)
        stats["non_us"] += len(jobs) - len(kept)
        logo = await board_logo(context.request, ats, board_url(ats, board)) if kept else None
        for job in kept:
            job.company_logo = logo
        stats["logos"] += bool(logo)
        print(
            f"  [{board.ats}] {board.slug}: {len(jobs)} jobs, {len(kept)} US, "
            f"{'logo' if logo else 'no logo'} ({time.monotonic() - started:.1f}s)"
        )
        return kept


async def run(args: argparse.Namespace) -> None:
    seed = args.seed if args.seed is not None else int(date.today().strftime("%Y%m%d"))
    gate = asyncio.Semaphore(args.concurrency)
    new_jobs: list[ScrapedJob] = []
    summary: dict[str, dict] = {}

    async with browser_context(headed=args.headed) as context:
        for ats in args.ats:
            boards = load_boards(ats, args.boards, seed, args.slug)
            stats = {"boards": len(boards), "scraped": 0, "non_us": 0, "skipped": 0, "failed": 0, "logos": 0}
            print(f"[{ATS[ats]}] {len(boards)} boards")
            results = await asyncio.gather(*(scrape_board(context, ats, b, gate, stats) for b in boards))
            for jobs in results:
                new_jobs += jobs
            stats["us"] = sum(len(r) for r in results)
            summary[ATS[ats]] = stats

    existing = json.loads(OUTPUT.read_text(encoding="utf-8")).get("jobs", []) if OUTPUT.exists() else []
    pool = {job["contentHash"]: job for job in existing}
    before = len(pool)
    for job in new_jobs:
        pool[job.content_hash] = job.to_record()  # re-seen jobs get a fresh scrapedAt

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(
            {"generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "jobs": list(pool.values())},
            indent=1,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print("\nSummary")
    for name, s in summary.items():
        print(
            f"  {name:16} boards {s['boards']:>4} | scraped {s['scraped']:>5} | US {s['us']:>5} | "
            f"non-US dropped {s['non_us']:>5} | skipped {s['skipped']:>3} | failed {s['failed']:>3} | logos {s['logos']:>3}"
        )
    print(f"  pool: {before} -> {len(pool)} jobs ({len(pool) - before} new) in {OUTPUT}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ats", nargs="+", choices=list(ATS), default=list(ATS))
    parser.add_argument("--boards", type=int, default=15, help="boards per ATS (default 15)")
    parser.add_argument("--slug", nargs="+", help="scrape these board slugs instead of a sample")
    parser.add_argument("--concurrency", type=int, default=4, help="boards open at once (default 4)")
    parser.add_argument("--seed", type=int, help="sample seed (default: today's date, so runs rotate boards)")
    parser.add_argument("--headed", action="store_true", help="show the browser")
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
