# 011 Central job pool, saved logos, auto-matching

**Status:** Done (2026-10-05)

## Goal

Keep one central pool of scraped jobs that every candidate is matched against, store each company's logo with the pool instead of hot-linking it, and match a new candidate automatically when they finish onboarding.

## Scope

In:
- **Central pool:** `data/jobs/us-jobs.json` stays the single pool for all candidates (`lib/jobs/pool.ts` → `loadPool()`); jobs are never copied per candidate.
- **Saved logos:** `scripts/ats/logos.py` → `save_logo()` downloads each board's logo once into `data/logos/<sha256[:20]>.<ext>` (identical logos stored once; the format is sniffed from the bytes; max 1 MB). Records carry `companyLogo: "/logos/<file>"` and `companyLogoSource` (the original URL). `scrape_jobs.py` does this for every board; `enrich_logos.py` backfills old pools and converts hot-linked URLs.
- **Serving:** `app/logos/[file]/route.ts` serves `data/logos/` with immutable caching, `nosniff`, and a sandboxing CSP so an SVG can't run script on our origin.
- **Matches:** `lib/jobs/matches.ts` is the file-backed `job_matches` table (`data/matches/<candidate>.json`: pool version, skills, and each matched job's score and skills). `matchCandidate(profile)` runs when onboarding finishes (`POST /api/profile`, which returns `matchedJobs`) and when the resume builder saves. `getMatchedJobs(profile)` reads the stored matches and recomputes them when the pool was re-scraped or the skills changed.

Out: match statuses (queued/applied…) on the match rows, and moving files to Supabase Storage/tables (spec 008).

## Acceptance criteria

- [x] A fresh scrape writes logos into `data/logos/` and `/logos/<file>` paths into the pool.
- [x] Finishing onboarding writes `data/matches/candidate.json` before the Jobs page opens.
- [x] Re-scraping the pool re-matches the candidate on their next visit, without re-onboarding.
- [x] Jobs without a logo still show the placeholder.
