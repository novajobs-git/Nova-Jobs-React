# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Source of truth

`context/` (six docs) and `specs/` define this project, not chat history. Read `context/` before starting a new unit of work. The workflow (from `context/ai-workflow-rules.md`):

- **Spec-driven.** Every unit of work is a `specs/NNN-*.md` file (Goal / Scope / Interface / Acceptance criteria / Open questions) written *before* its code. If implementation diverges, update the spec first.
- One spec = one feature or page. Schema, API, and UI for the same feature are separate specs, done in that order.
- Ambiguous or undecided requirements (pricing, Hyperbrowser vs. no-evasion, RLS strategy, Chrome extension): stop and ask. Minor defaults taken to keep moving get recorded in `context/progress-tracker.md` → Architecture Decisions.
- At the end of a session, update `context/progress-tracker.md` (Completed / In Progress / Next Up, named by spec).
- Visual system: `context/ui-context.md`, `DESIGN.md`, `PRODUCT.md`.

## Commands

- `npm run dev`: dev server on http://localhost:3000 (Next.js 16, Turbopack)
- `npm run build`: production build
- `npm run lint`: ESLint
- There is no JS test runner. The only test is Python: `.venv\Scripts\python -m scripts.ats.test_us_filter`

Python job ingestion (venv at `.venv` from `scripts/requirements.txt`, plus `python -m playwright install chromium`):
- `.venv\Scripts\python -m scripts.scrape_jobs --boards 15` (options: `--ats`, `--slug`, `--concurrency`, `--seed`, `--headed`) writes `data/jobs/us-jobs.json`, merged and deduped across runs
- `.venv\Scripts\python -m scripts.enrich_descriptions` adds job descriptions, which keyword matching needs. It's resumable.
- `.venv\Scripts\python -m scripts.extract_requirements` extracts seniority, years, degree and salary once per job; Gemini runs only when the rules find neither a level nor years. Then `.venv\Scripts\python -m scripts.embed_titles` embeds new titles. Both skip work already done.
- `.venv\Scripts\python -m scripts.daily_ingest [--skip-scrape]` runs all of the above in order.

## Architecture

The target stack is Clerk + Supabase + a Python apply engine. **None of it is wired yet.** Everything currently runs on local stand-ins whose function signatures are meant to survive the Supabase migration (spec 007/008), so the UI shouldn't need to change:

| Data | Stand-in | Accessor |
|---|---|---|
| Candidate profile + resume | `data/profiles/candidate.json`, `data/resumes/<uuid>.pdf/.txt` | `lib/profile/store.ts` → `getProfile()`, `saveProfile()`, `saveResume()` |
| Job pool (central, shared by all candidates) | `data/jobs/us-jobs.json` from the Python scrapers; logos downloaded to `data/logos/`, served at `/logos/<file>` | `lib/jobs/pool.ts` → `loadPool()` |
| Candidate matches | `data/matches/candidate.json`, written on onboarding and resume save, recomputed when the pool or skills change; empty if no pool | `lib/jobs/matches.ts` → `matchCandidate()`, `getMatchedJobs(profile)` |
| Applications + queue (per candidate) | `data/applications/<id>.json`, changed by the app and that candidate's Python engine under `<id>.lock`; Auto-Apply settings/status/log in `data/engine/{settings,status,logs}/<id>`; id from `lib/candidate.ts` | `lib/applications/store.ts`, `lib/applications/queue.ts`, `lib/engine/store.ts`, `engine/` (spec 012) |

`data/` is generated at runtime. To restart onboarding, delete `data/profiles/candidate.json`.

**Flow:** `/` → `/login` (UI only: validates the form and goes to `/dashboard`; no real auth) → `app/(dashboard)/`: `/dashboard` (application stats and history), `/jobs` (matched jobs), `/resume`, `/resume-analysis`. Finishing onboarding lands on `/jobs`. The dashboard layout *and* pages that read the profile redirect to `/onboarding` until `onboarding_complete`; pages need their own check because layouts and pages render in parallel.

**Onboarding** (`components/onboarding/onboarding-flow.tsx`) is a client-side multi-step form. Each step validates against `stepSchemas[step]` in `lib/profile/schema.ts`. The resume PDF goes to `POST /api/resume`, which extracts text with `unpdf`, parses contact info and skills, and returns a `resumeId`. Finishing posts the full `onboardingSchema` payload to `POST /api/profile`. `store.ts` is the single place that maps camelCase to snake_case. Profiles are stored in the snake_case shape the Python engine reads.

**Matching** (spec 014, `lib/matching/structured.ts` + `lib/jobs/matches.ts`) has two stages:
- **Hard filters:** title-embedding similarity ≥ 0.89; seniority from target − 1 to target + 1; required years ≤ candidate years + 2; a required Master's or PhD the candidate doesn't hold excludes the job.
- **Relaxation:** when fewer than 15 jobs survive, filters relax one step at a time: level, then degree, then title. Relaxed jobs carry `relaxedBy`, and the Jobs page shows a banner plus a text tag on each one.
- **Score:** 0.30 title + 0.30 skills (keyword overlap, spec 006) + 0.20 freshness + 0.10 location + 0.10 salary. Unknown components are dropped and the rest rescaled.
- **Inputs computed once:** job requirements (`scripts/extract_requirements.py`) and title embeddings (`scripts/embed_titles.py`) at ingestion, and the candidate's target-title embeddings on save (`data/embeddings/`). Opening the Jobs page doesn't call Gemini.
- `normalizeTitle` (`lib/matching/titles.ts`) mirrors `normalize_title` in `scripts/ats/requirements.py`. Change both together.

**API routes** return the envelope `{ success, data?, error? }`, validate with Zod, and stay thin (logic lives in `lib/`). They have a placeholder comment where the Clerk auth check will go.

## Rules that aren't obvious from the code

- **EEO fields** (gender, race/ethnicity, veteran, disability) and **sponsorship** answers are never inferred, guessed, or AI-generated. Only the candidate's stored answer is used.
- US-only jobs, enforced at ingestion (`scripts/ats/us_filter.py`). Apply is a serial queue with one job in flight per candidate.
- No destructive DB/data operation (DELETE/TRUNCATE/DROP, bulk removal) without explicit per-instance user confirmation.
- Styling uses shadcn/ui (New York) + Tailwind tokens only: no inline `style` except computed values, no per-component CSS, no one-off hex values, and dark mode must work. Status is never conveyed by color alone.
- Don't hand-edit `components/ui/`, which is generated by the shadcn CLI.
- Server Components by default, and modules that touch disk or secrets import `server-only`.
- Synthetic data shown in the UI must be labeled as demo data.
