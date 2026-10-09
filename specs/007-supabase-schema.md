# 007 Supabase schema (reuse the live database, additive)

**Status:** Applied 2026-10-07 with the user's approval. Verified: new columns, tables, RLS and bucket present; existing row counts unchanged (150,364 jobs, 3,000 job_matches, 6 profiles, 10 users).

## Goal

Run the new app on the existing Supabase project, which the old Flask app still uses live, without breaking the old app.

## Decisions (user, 2026-10-06)

- **Reuse + additive.** Reuse `users`, `profiles`, `jobs`, `job_matches`, `qa_cache` and the `resumes` bucket. Only add columns and new tables. `job_queue`, `engine_runs`, `applications` and `scraped_urls` stay the old app's, untouched.
- **Identity:** the local candidate is the existing `users` row with the candidate's email. Candidate-owned rows key on `users.id` (`bigint`); `lib/candidate.ts` resolves it. Clerk later adds a `clerk_user_id` column.
- **Jobs pool:** rebuilt with tech roles only (Software, AI/ML, Data & Analytics, Product/Project, DevOps/Cloud, Security, QA), from a fresh scrape (`scripts/ats/job_family.py`). What happens to the existing 150,364 rows is pending the user's confirmation (see Open questions).
- RLS stays on with no policies on the new tables; the service role (app server + engine) does all reads and writes. Live progress goes through the Realtime broadcast channel `run:<run_id>` until Clerk JWT RLS exists.

## Existing facts (inspected 2026-10-06)

- Postgres 17.6. Reachable over IPv4 only through the pooler `aws-0-us-west-1.pooler.supabase.com:5432`, user `postgres.<project-ref>`.
- `jobs`: 150,364 rows, all `status='active'`, Greenhouse/Lever/Ashby, `content_hash` UNIQUE (the same formula as `ScrapedJob.content_hash`), last seen 2026-09-23.
- `job_matches.job_id` → `jobs.id` is **ON DELETE CASCADE**, so deleting jobs deletes the old app's matches.
- List fields in `profiles` (targets, skills) are JSON stored in `text` columns.

## Interface: `supabase/migrations/20261006000000_novajobs_additive.sql`

- `profiles` + `portfolio_url`, `earliest_start_date`, `resume_text`, `auto_submit` (default false).
- `jobs` + `posted_at`, `board_slug`, `company_logo`, `company_logo_source`, `job_family`; indexes on (status, posted_at) and (status, first_seen_at).
- `job_matches` + `matched_skills text[]`, `skill_total`.
- New `application_runs` (user_id → users, job_id → jobs ON DELETE SET NULL, job snapshot columns, status, reason, adapter, auto_submit, control, live_url, Hyperbrowser session id). The database allows one in-flight run per user.
- New `application_events` (run_id, kind, message, data, at).
- New public bucket `company-logos`.

## Acceptance criteria

- [x] The migration applies in one transaction; row counts of existing tables are unchanged.
- [ ] The old app still loads and runs after it.
- [ ] A second in-flight run for the same user is rejected.

## Open questions

- Existing 150,364 jobs: mark them `expired` (reversible; matches kept) or hard-delete (cascades into the old app's 3,000 `job_matches`). Needs explicit per-instance confirmation.
- Clerk → Supabase third-party JWT (browser-side RLS / postgres_changes).
