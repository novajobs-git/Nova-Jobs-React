# 004 — ATS scrapers (Playwright, US-only) → local job pool

**Status:** Done (2026-10-02)

## Goal

Fill the shared job pool with real, currently open, **US-only** jobs by
scraping company job boards on Greenhouse, Lever, Ashby, Workday and
SmartRecruiters with a Playwright browser. Until Supabase exists (spec
007), the pool is written to a local file, and the Jobs page reads it
instead of demo data.

## Approach (decided with the user)

**Hybrid.** The `ats-scrapers` package's public company directory (~63k
companies, with columns `ats`, `name`, `slug`, `url`) decides *which*
boards exist. Our own Playwright scrapers then open each board live in a
local Chromium and read its jobs. The browser runs with no stealth or
fingerprint spoofing. That matches the old app's principle and doesn't
pre-decide the open Hyperbrowser question.

Ported from the old app (`Nova Jobs Main (Error)/ingest_job_pool.py` and
`engine.py`), not rewritten:
- `_is_us_location` → `scripts/ats/us_filter.py`. Same policy: an
  explicit country wins; otherwise "United States/USA", a state
  abbreviation after a comma, or a full state name. A bare "Remote" is
  excluded. **Changed:** a location that names only non-US countries is
  rejected even when it contains a US-looking token (e.g. "Georgia" the
  country). A multi-location posting is kept when any of its locations is
  US.
- `_content_hash` → dedupe key (company | title | location | url).
- `tfidf_match_score` → `lib/jobs/matching.ts` (TypeScript, used by the
  Jobs page against the candidate's target titles). The logic is
  unchanged; only the language moved.

## Scope

In:
- `scripts/ats/`: one scraper module per ATS, a shared browser helper, the
  board directory, the US filter and the models.
- `scripts/scrape_jobs.py` CLI: choose the ATS, boards per ATS and
  concurrency, with a headed/headless toggle. Writes
  `data/jobs/us-jobs.json` (deduped, US-only) and logs counts (scraped /
  non-US skipped / dupes / failed boards).
- A polite crawl: bounded concurrency, per-board timeout, and one failed
  board never stops the run.
- The Jobs page reads `data/jobs/us-jobs.json` when present, scores each
  job with the ported matcher, and shows only jobs at 30% or higher. It
  falls back to demo data when the file doesn't exist.

Out:
- Supabase upsert (spec 008); scheduling/cron; job descriptions beyond
  what the board list exposes; Hyperbrowser.

## Interface

Scraped record (JSON, camelCase to match `lib/jobs/types.ts`):

```json
{ "id": "job_<hash16>", "contentHash": "<sha256>", "ats": "Greenhouse",
  "company": "Stripe", "boardSlug": "stripe", "title": "…", "location": "…",
  "url": "https://…", "postedAt": "ISO | null", "scrapedAt": "ISO" }
```

CLI: `.venv\Scripts\python scripts\scrape_jobs.py --ats greenhouse lever --boards 25 --concurrency 4 [--headed] [--slug stripe]`

## Acceptance criteria

- [x] Each of the 5 ATS scrapers returns real jobs from at least one live board.
- [x] No non-US job reaches the output file. Spot-checked against the US filter's tests.
- [x] Output is deduped by content hash; a re-run doesn't duplicate.
- [x] A failing or slow board is logged and skipped; the run completes.
- [x] With the file present, the Jobs page shows real scraped jobs, each ≥30% match.

## Open questions

- Hyperbrowser vs. local Chromium for scraping at scale (tracker Open Questions).
- How often to re-scrape, and how to mark jobs closed (needs the schema).
