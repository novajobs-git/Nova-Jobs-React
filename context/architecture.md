# 2. Architecture Context

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + React | Minimal, consistent UI — see `ui-context.md` |
| Component library | shadcn/ui + Tailwind CSS | Exclusive styling system — no ad-hoc CSS per page |
| Auth | Clerk | Replaces the old Flask session/Werkzeug-hash auth |
| Database | Supabase (Postgres) | Same provider as the old app; schema carried forward conceptually, not copied 1:1 |
| File storage | Supabase Storage | Resume PDFs (private bucket), same pattern as before |
| Automation engine | `engine.py` (Python), evolved | Scraping, matching, form-filling, submission — kept and adapted, not rewritten from zero |
| Automation browser | Hyperbrowser | **Replaces** the old app's local, visible Playwright Chromium + NopeCHA — see Invariants below, this is a deliberate reversal that needs to be made explicit wherever it matters |
| AI | Google Gemini | Resume/ATS scoring, screening-question answers — same role as before |
| Scripts | Python | Job ingestion, one-off maintenance, matching jobs — standalone, same pattern as the old app's `ingest_job_pool.py` |
| Browser extension | Chrome extension (separate codebase) | Handles ATS platforms that require the candidate to already be logged in |
| Icons | lucide-react | shadcn's standard icon set |

## System Boundaries

- **Next.js app** is the only thing the browser talks to directly. It owns
  the UI and a thin API-route layer (`app/api/*/route.ts`) that is the only
  thing allowed to touch Supabase with elevated privileges. No Supabase
  service-role key ever reaches the client.
- **Python engine** is a separate process/service, not part of the Next.js
  request/response cycle. It is triggered by rows appearing in a queue
  table (the "click Apply → queued row → worker picks it up" pattern
  proven in the old app), not by a direct HTTP call from Next.js that
  blocks on a browser-automation run.
- **Chrome extension** is a separate client. It authenticates against the
  same backend (via an API token/session bridge, not by sharing the
  Next.js session cookie directly) and is scoped to ATS platforms that
  need the candidate's own logged-in browser session — it does not have
  general access to the rest of the platform's data.
- **Gemini and Hyperbrowser** are only ever called from server-side code
  (Next.js API routes or the Python engine) — never from the browser.

## Storage Model

Carried forward conceptually from the old app's proven schema (see the old
`supabase_setup.sql` for the full reference), re-cut for the new stack:

- A **shared, centralized job pool** — scraped once, not per-candidate.
  US-only at ingestion time, deduplicated by a content hash.
- A **per-candidate match table** joining candidate ↔ job with a computed
  match score, a status (`not_applied` / `queued` / `applying` / `applied`
  / `failed` / `needs_review`), and a failure reason string — this is what
  both the jobs table/cards UI and the Workbench queue panel read from.
- **Profile data**: contact info, resume pointer(s), job preferences,
  and — critically — sponsorship/work-authorization/EEO answers as their
  own real columns, collected once at onboarding, always the candidate's
  own stated answer.
- **Resume storage** in Supabase Storage (private bucket), with a
  structured extraction (skills, experience, education) stored alongside
  it for matching and scoring.
- **Applications/history** table for the dashboard's stats and list.
- Indexing for search/filtering: location, experience level, company, and
  sponsorship must be queryable columns (not buried in free text) on the
  job pool table — this is a hard requirement of the search/filter
  feature, not an optimization to add later.

## Auth and Access Model

- **Clerk** owns identity: sign up, log in, session management, password
  reset. The Next.js app reads the Clerk session server-side on every
  protected route/API call.
- **Supabase RLS stays enabled** on every table (matching the old app's
  security posture), but the working access pattern is the same
  pragmatic one the old app used successfully: all reads/writes go
  through server-side code (Next.js API routes, the Python engine) using
  the Supabase **service role**, which bypasses RLS by design. RLS is a
  defense-in-depth backstop against a leaked anon key, not the primary
  access-control mechanism.
- Each Supabase row that belongs to a candidate is keyed by their Clerk
  user id (stored as a plain column, e.g. `clerk_user_id`), not by
  Supabase's own `auth.uid()` — there is no Supabase Auth user in this
  model, only Clerk.
- **Open decision**: whether to eventually wire true per-row RLS keyed off
  a Clerk-issued JWT (Supabase supports third-party JWT auth) instead of
  the service-role-bypass pattern. Not required for the initial rebuild;
  tracked in `progress-tracker.md`.

## Invariants

Things that must hold regardless of who implements what, or they need to
be raised and resolved explicitly before proceeding:

- **US-only jobs.** Enforced at ingestion, not just at display time.
- **30% minimum match score** to show a job to a candidate at all.
- **EEO fields (veteran status, disability status, gender, race/ethnicity)
  are never inferred, guessed, or AI-generated.** The only value ever
  filled into one of these fields on a real application is the
  candidate's own stored answer, or "prefer not to answer." This was a
  hard-won correctness fix in the old app and must not regress.
- **One job processed at a time per candidate.** Apply is a serial
  per-user queue, not N browsers running in parallel for the same person.
- **No destructive database operation (DELETE/TRUNCATE/DROP, or any bulk
  data removal) without explicit user confirmation first** — standing
  rule, not a per-task judgment call.
- **The automation-evasion stance is an open, explicit decision, not a
  silent default.** The old app's `engine.py` documented and followed a
  strict "no automation-detection evasion of any kind" principle (visible
  local browser, no fingerprint spoofing). This rebuild's stated stack
  swaps in Hyperbrowser, which is a stealth/anti-detection browsing
  service — that is a deliberate reversal of the old principle, carries
  real ToS/legal exposure, and should be treated as a conscious,
  documented choice (see `progress-tracker.md` → Open Questions), not
  something later code quietly assumes.
