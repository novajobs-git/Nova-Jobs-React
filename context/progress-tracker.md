# 6. Progress Tracker

## Current Phase

Early implementation. The Next.js + shadcn skeleton exists at the repo
root. New candidates go through onboarding (spec 005), which stores their
profile + resume skills; the Jobs page then shows real scraped US jobs
(spec 004) ranked by resume keyword match (spec 006). Applications still
runs on typed synthetic data. Storage is local files until Supabase. Clerk and Supabase are not wired yet. The existing Flask
app (`app.py` + `engine.py` + Jinja2 templates) is still the live, working
reference implementation and should keep running unaffected while the
rebuild is built alongside it.

## Current Goal

Move profiles, resumes, the job pool and applications to Supabase: write
the schema spec (007), then the Clerk + Supabase + queue API wiring (008),
keeping the `getProfile()` / `getJobs()` / `getApplications()`
signatures so the UI doesn't change.

## How to Run

- `npm install` then `npm run dev` → http://localhost:3000 (redirects to
  `/jobs`). `npm run build` must pass before any spec is marked
  done.
- Scrape jobs (Python 3.14 venv at `.venv`, set up from
  `scripts/requirements.txt` + `python -m playwright install chromium`):
  `.venv\Scripts\python -m scripts.scrape_jobs --boards 15` (all 5 ATSs;
  `--ats`, `--slug`, `--concurrency`, `--seed`, `--headed`). Output:
  `data/jobs/us-jobs.json` (gitignored), merged and deduped across runs.
  US filter tests: `.venv\Scripts\python -m scripts.ats.test_us_filter`.
- After scraping, add job descriptions (needed for keyword matching):
  `.venv\Scripts\python -m scripts.enrich_descriptions` (resumable).
- Onboarding: http://localhost:3000/onboarding (the dashboard redirects
  there until a profile exists). To start over, delete
  `data/profiles/candidate.json`.

## Completed

- The six `context/` documents (this set) created, capturing the product
  spec, target architecture, code standards, AI workflow rules, UI system,
  and this tracker.
- (Reference, from the existing Flask app — not part of the new stack, but
  proven logic to carry forward):
  - Centralized job pool + per-candidate match table with a 30% match
    threshold, fed by a US-only filter at ingestion.
  - Click-to-apply flow backed by a real per-user serial queue (one job
    worked on at a time, others wait their turn) with live status.
  - Bottom-docked Workbench-style queue panel (In Progress / Applied /
    Failed-Needs-Review tabs), pinned to the screen, not the page.
  - Root-caused and fixed a label-extraction bug in the form filler
    (auto-generated `id`/`name` attributes were shadowing the real
    `<label>` text, causing every field to fall back to "N/A").
  - Added real work-authorization/sponsorship/veteran/disability/gender/
    race fields collected at onboarding and on the profile page, wired so
    the engine uses the candidate's own stated answer (including for
    radio-group and custom-combobox EEO questions), never a guess.
  - Consolidated profile editing onto one standalone `/profile` page,
    removing a duplicate popup-based editing flow.

- `specs/001-project-skeleton.md` done: Next.js 16 (App Router, TS
  strict, Turbopack) + shadcn/ui (Radix base, `vega` style) + Tailwind v4
  at the repo root. NovaJobs tokens (primary `#3B82F6` / hover `#2563EB`,
  success/warning/destructive status colors, 6px radius, cool-tinted
  neutrals, light + dark) live in `app/globals.css`. Inter via
  `next/font`. Theme toggle via `next-themes`.
- `specs/002-applications-dashboard-ui.md` done: `/applications`
  dashboard built with the Impeccable skill ("attention first" structure,
  chosen by the user on the decision page):
  - App shell: collapsible sidebar (Applications live; Jobs, Resume and
    Profile shown as "Soon"), topbar with a "Demo data" label and theme
    toggle.
  - One-line outcome sentence; a clickable segmented outcome bar (applied
    / in queue / needs review / failed) that filters the history table.
  - "Needs your attention" list: each failed or needs-review item shows
    its verbatim reason and its action (Retry / Answer question / Update
    profile / Dismiss). Actions only show a toast until the queue API
    exists. Shows 4 items, then "Show all".
  - A 14-day stacked activity chart and a success rate per ATS.
  - History table: status tabs, search, ATS filter, match %, sponsorship,
    relative time, and an empty state.
  - Workbench dock pinned to the bottom of the content area; expands into
    a non-modal bottom `Sheet` (In progress / Applied / Failed-Needs
    review) that is offset so it never covers the sidebar.
  - Data: `lib/applications/mock-data.ts` (42 synthetic applications,
    fictional companies, fixed `DEMO_NOW`) behind `getApplications()`,
    the same signature the Supabase service will expose. Types are in
    `lib/applications/types.ts`; derived stats are in
    `lib/applications/stats.ts`.
  - Checked in the browser at 1440px and a true 390px viewport, light and
    dark. `npm run build` passes, and the Impeccable detector reports no
    findings.
- Impeccable finish review: first pass `fix` (7 findings: contrast of
  green text, motion under reduced-motion, needs-review color, history
  length, mobile controls, percent rounding, chart legend), all fixed;
  verdict pass `ship`. `DESIGN.md` + `.impeccable/design.json` written
  from the built system.
- `specs/003-jobs-page-ui.md` done: `/jobs` page, now the landing page
  (`/` redirects here, per the user flow in `project-overview.md`):
  - Header summary: matches at 30% or higher, new in the last 24h, not
    applied yet, and how many sponsor visas.
  - Top matches: the 6 highest-scoring jobs not yet in the pipeline, as
    cards. Each shows match %, role, company, location, level, work mode,
    sponsorship (prominent, since the demo candidate needs it), two match
    reasons, salary, posting link and Apply.
  - All matches table: search plus Location, Experience level, Company
    and Sponsorship filters, a result count, Clear filters, 15 rows then
    "Show more". The action column shows Apply, or the job's current
    status if it's already in the pipeline.
  - Apply adds a queued application to a shared client store
    (`components/applications/applications-provider.tsx`), so the Jobs
    page, the Applications page and the Workbench stay in sync. A toast
    shows the place in line. The Workbench orders the queue by queued
    time. The store resets on reload until spec 005.
  - Data: `lib/jobs/mock-data.ts` → `getJobs()` (64 matches: 22 new plus
    the 42 already applied to; one sub-30% job exists in the pool and is
    filtered out). `Application` gained `jobId`.
  - Checked in the browser: apply → toast, card and row switch to Queued,
    the Workbench and Applications page show the job; filters and search
    narrow correctly; no console errors; 390px has no horizontal scroll.
- `specs/004-ats-scrapers.md` done: Playwright scrapers for Greenhouse,
  Lever, Ashby, Workday and SmartRecruiters (`scripts/ats/`, CLI
  `scripts/scrape_jobs.py`). Which boards to visit comes from the
  `ats-scrapers` company directory (~18k boards across these 5 ATSs);
  jobs are read live in a local Chromium (no stealth). Greenhouse, Lever
  and SmartRecruiters are read from the DOM; Ashby (GraphQL) and Workday
  (cxs API) from the board's own JSON responses. Workday "N Locations"
  and department-grouped SmartRecruiters boards are resolved from each
  posting. US-only filter ported from the old `ingest_job_pool.py`,
  extended with major US metros ("San Francisco Bay Area") and stricter
  non-US rejection; 27 test cases pass. First runs produced 960 unique
  US jobs with 0 failed boards. The old `tfidf_match_score` is ported
  unchanged to `lib/jobs/matching.ts`; the Jobs page scores the pool
  against the candidate's target titles and shows matches ≥30% (falls
  back to demo jobs when no pool file exists). *Superseded by spec 006:
  matching is now resume-keyword based and `lib/jobs/matching.ts` is
  removed.*
- `specs/005-onboarding.md` done: 9-step onboarding at `/onboarding`
  with a progress bar (resume → about you → links → preferences →
  skills → work authorization → sponsorship → EEO → review). The resume
  PDF is stored (`data/resumes/`), its text is extracted (unpdf), and its
  skills are detected; contact details and links pre-fill the next
  steps. The profile is saved to `data/profiles/candidate.json` in the
  snake_case shape `engine.py` reads (`full_name, phone, location,
  linkedin_url, work_authorization, needs_sponsorship, veteran_status,
  disability_status, gender, race_ethnicity, target_job_title,
  resume_skills, ...`). EEO/authorization values are stored as the start
  of common ATS option wording so the engine's `_fuzzy_match_choice`
  matches them; EEO defaults to "decline". APIs: `POST /api/resume`,
  `POST /api/profile` (Zod-validated, `{success,data,error}`). The
  dashboard redirects to onboarding until a profile exists; the greeting
  and avatar use the real name. Tested end to end in the browser (resume
  upload, prefill, per-step validation, review, finish → /jobs).
- `specs/006-keyword-matching.md` done: one skills dictionary
  (`lib/matching/skills.ts`, ~250 skills across tech, data, design,
  product, marketing, sales, finance, ops and healthcare, with aliases)
  used for both resumes and jobs. Score = matched job keywords ÷ job
  keywords; shown at ≥30% and ≥2 matched keywords; generic soft skills
  are never scored. `scripts/enrich_descriptions.py` adds descriptions
  to the pool (JSON-LD for Lever/Ashby/Workday, the description element
  for Greenhouse/SmartRecruiters): 953/960 jobs. Cards show "N of M
  skills match" and the matched skills. Replaces the title-only TF-IDF
  port from spec 004 (removed).
- Applications page reworked on request: stats first (outcome bar, 14-day
  chart, success by ATS), then Needs your attention, then History. Full
  width with a 16px gutter. Light theme swapped: page ground is
  `lab(91.2882% -0.491798 -2.20391)`; sidebar, top bar, Workbench bar and
  panels are white.
- **Jobs page + app shell rebuilt from the user's design image** (via the
  `image-to-code` skill, 2026-10-02), replacing the spec 003 look:
  - Sidebar: "NovaJobs" wordmark; text-only nav Dashboard (= `/jobs`),
    Jobs, Applications, Resume Builder, Resume Analysis, Settings; My
    Details + Log out at the bottom. Unbuilt items show a "coming soon"
    toast.
  - Top bar: My Details, Auto-Apply switch, notifications, avatar. The
    theme toggle and "Demo data" badge were removed.
  - Page: "Good afternoon, Parth" + plan pill, Auto-Apply status pill,
    View analytics (→ `/applications`), 4 top-match cards, and an "All
    matched jobs" table. The bottom bar is now "Auto-Apply Queue" + count.
  - Company logos come from the ATS boards (spec 010), with a building placeholder when a board has none;
    companies are still fictional demo data.
  - **Removed vs. spec 003:** the Location / Experience / Company /
    Sponsorship filters and search, and the sponsorship and salary
    details on cards, because the design doesn't show them. The
    filtering requirement in `project-overview.md` still stands, so it
    needs a place in this design.
- Added `PRODUCT.md` (Impeccable product record) and the Impeccable
  skill/hooks under `.claude/`. The dashboard's direction contract is in
  `.impeccable/surfaces/`.
- `specs/009-resume-builder.md` done: `/resume` (sidebar "Resume
  Builder") with live US Letter preview, Accordion section editor, Tiptap
  rich text, three templates, suggest-then-accept "Write with AI"
  (placeholder until Gemini), save to `data/resume/candidate.json`
  (replaces `resume_skills`), PDF export via print. `/` now redirects to a
  UI-only `/login` page (no auth until Clerk).

## In Progress

- Nothing.

## Next Up

Development proceeds spec-by-spec (see `ai-workflow-rules.md`) — each item
below becomes its own `specs/NNN-*.md` file, written and agreed before its
code is implemented.

1. `specs/007-*`: Supabase schema (candidate/profile, job pool,
   job_matches/queue, applications, resume data), using the old app's
   schema as a reference, not a direct copy — adjust for Clerk user ids
   and the indexed search/filter columns (location, experience level,
   company, sponsorship). Confirm or amend the `Application` type in
   `lib/applications/types.ts` (spec 002) and the `Job` type in
   `lib/jobs/types.ts` (spec 003), including where `level`, `workMode`
   and `salary` come from.
2. `specs/008-*`: Clerk auth + typed Supabase client wrapper; swap
   `getJobs()` / `getApplications()` to the real tables; replace the
   client-side applications store with real queue API routes (Apply,
   Retry / Answer / Update profile / Dismiss).
3. Decide and document the Hyperbrowser integration approach for the
   automation engine (see Open Questions) before writing its spec.
4. Spec + port the EEO-aware field-filling logic (title/location
   matching is already ported in spec 004) from `engine.py` into the new engine
   structure.
5. Spec: hand the stored profile to the auto-apply engine (`engine.py`
   reads the same snake_case fields; it needs a `user_id` and the
   Supabase tables from spec 007 instead of the local JSON file).
6. Spec + build Profile and Resume pages (sidebar entries already exist
   as "Soon").

## Open Questions

- **Auto-Apply switch and "Performance Plan" pill.** Both come from the
  user's design. The switch is demo-only UI state. A fully autonomous
  apply mode is listed as out of scope in `project-overview.md`, and
  pricing/plans are still undecided. Decide what the switch actually
  controls and whether plans exist before wiring either.
- **Scraper scale and freshness.** How often to re-scrape, how many
  boards per run, and how to mark jobs closed (needs the schema). Local
  Chromium handles ~60 boards in a few minutes; the Hyperbrowser question
  above decides how this scales.
- **Keyword-match tuning.** The spec 006 rule (≥30% of a job's keywords,
  min 2 matched) is deliberately simple. Watch for jobs with few
  recognised keywords scoring high on a small overlap, and grow the
  skills dictionary for non-tech candidates as real profiles arrive.
- **Where the job filters go** in the new Jobs design (see Completed).

- **Primary button contrast.** White 14px text on the pinned `#3B82F6`
  is about 3.7:1, below WCAG AA (4.5:1). In dark mode the hover `#60a5fa` is
  about 2.5:1. Options: keep it as pinned, or use `#2563EB` as the resting
  fill for small buttons (and a darker dark-mode hover). Needs the user's
  call, since the color is pinned in `ui-context.md`.

- **Hyperbrowser vs. the old "no automation-detection evasion" principle.**
  The old `engine.py` deliberately used a visible local Chromium with no
  stealth/fingerprint spoofing, for compliance/ToS reasons. The new stack
  spec calls for Hyperbrowser, which is a stealth/anti-detection browsing
  service. This is a real reversal with real legal/ToS exposure and needs
  an explicit decision, not a default.
- **Pricing / payment model.** The old app had a Stripe-based paid-plan
  model (daily application quotas per plan). The new spec doesn't mention
  pricing at all — carry it forward, redesign it, or drop it for now?
- **Chrome extension timeline.** Listed as a needed capability (login-
  gated ATS platforms) but not scoped with the same detail as the rest —
  is it part of this phase or a fast-follow?
- **RLS strategy.** Service-role-bypass (matching the old app's proven,
  pragmatic pattern) vs. true per-row RLS keyed off a Clerk-issued JWT —
  the former is simpler and already proven; the latter is more "correct"
  Supabase practice. Needs a decision before the schema is finalized.
- **"Core principle should be like Tsenta."** This reference came up in
  the original spec but its meaning wasn't established in this
  conversation — needs the user to clarify what specifically about it
  should guide this rebuild before it can inform any decision here.

## Architecture Decisions

- Keep and evolve `engine.py`'s core logic rather than rewriting the
  automation engine from zero — its matching, form-filling, and EEO
  handling have already been debugged against real ATS forms.
- Centralized job pool, matched per-candidate with a persisted match
  score and status, rather than re-scraping per apply run.
- 30% minimum match score to surface a job to a candidate at all.
- Apply is a per-user **serial** queue (one job in flight per candidate at
  a time), not parallel bulk processing.
- EEO fields are always the candidate's own stated answer, collected once
  at onboarding/profile — never inferred or AI-guessed, including when
  the question renders as a radio group or custom combobox rather than a
  plain `<select>`.
- shadcn/ui + Tailwind is the only styling system for the new frontend;
  `#3B82F6` / `#2563EB` primary blue and `6px` base radius carried forward
  from the current app's already-validated button system.
- Profile editing lives on one standalone page — no popup/dropdown
  duplicate of it.
- **shadcn style `vega` instead of "New York"** (2026-09-29): current
  shadcn no longer ships New York; `vega` is its classic-look successor.
  Revisit if it doesn't fit.
- **`components/ui/button.tsx` hand-edited in two places** so buttons
  match ui-context exactly: the default hover is `hover:bg-primary-hover`
  (`#2563EB`), and every size uses `rounded-lg` (6px) instead of the
  vega 4.8px. These are the only hand edits to a generated primitive;
  re-apply them after a shadcn upgrade. `hooks/use-mobile.ts` was also
  rewritten with `useSyncExternalStore` to pass lint.
- **Next.js app lives at the repo root** (not a subfolder), per
  `code-standards.md` file organization.
- **Workbench panel = non-modal bottom `Sheet`** offset by the sidebar
  width, so it never covers the sidebar (ui-context requirement).
- **Needs review is shown in red at reduced strength** (55% destructive)
  to tell it apart from Failed while keeping ui-context's "failed / needs
  review = red" rule. Always paired with its own icon and label.
- **Jobs is the landing page** (`/` → `/jobs`), matching user flow step
  3 in `project-overview.md`.
- **One client-side applications store** (`ApplicationsProvider` in the
  dashboard layout) is the single source for the Jobs page, Applications
  page and Workbench, so Apply shows up everywhere at once. It is
  temporary: spec 005 replaces it with server data + queue API routes.
- **Type changed from Inter to Plus Jakarta Sans** (Inter 700 kept for
  the wordmark only) and the light palette now follows the user's design
  image (`#f3f6fa` ground, `#0f172a` text, white sidebar and panels,
  16px panel radius). This supersedes the Inter and background notes in
  `ui-context.md` and `DESIGN.md`; both docs need updating to match.
- **Scrapers are Python + Playwright, run as a standalone script**
  (`scripts/`), per architecture.md, and write a file until Supabase
  exists. Board discovery comes from `ats-scrapers` (the same open
  dataset the old app used); fetching jobs is our own Playwright code.
  Sponsorship is never inferred from a listing (always "unknown" until a
  real signal exists).
- **Job matching is resume-keyword based** (user decision, spec 006),
  not title similarity. The candidate's skills are the ones they confirm
  in onboarding step 5, not every word in the resume.
- **Pages that read the profile render per request**
  (`connection()` in `getProfile()`), so nothing candidate-specific is
  ever prerendered at build time.
- **Mock data uses a fixed `DEMO_NOW`** so relative times match between
  server and client (no hydration mismatch). It is removed when real data
  lands.
- **Resume builder defaults** (spec 009, taken from the confirmed brief):
  three single-column templates (Classic, Compact, Modern), fixed section
  order, rich text stored as Tiptap JSON and rendered as React (never
  HTML), the resume paper uses its own template typography and `--paper*`
  tokens (white in both themes), and saving replaces the profile's
  `resume_skills`. The uploaded PDF is still what applications would send.

## Session Notes

- **2026-09-29** — User provided the full rebuild spec (product + tech
  stack: Clerk, Supabase, Next.js/React with shadcn, Python scripts,
  Gemini, Hyperbrowser) and asked for the six `context/` files to be
  created in this exact structure, to serve as the persistent planning
  reference for the rebuild. Files created; no rebuild code written yet.
  Explicit instruction to keep `engine.py` as the starting point for the
  automation core rather than discarding it.
- **2026-09-29** — User specified the project will be developed with
  Claude Code using **spec-driven development**: every unit of work is
  written as a spec file (goal, scope, interface, acceptance criteria,
  open questions) under `specs/` before any code is written, and
  implementation proceeds spec by spec. `ai-workflow-rules.md` and
  `code-standards.md` updated to make this the actual required
  methodology rather than a loose guideline; `specs/` folder itself not
  yet created.
- **2026-09-29** — Installed the Impeccable design skill
  (`npx impeccable install`, project scope, Claude only). Ran its flow
  for the first dashboard: wrote `PRODUCT.md`; confirmed stack (Next.js +
  shadcn, mock data), focus (applications history + stats) and user (US
  job seekers, self-serve); the user picked the "attention first"
  structure on the decision page. Created `specs/`, wrote and completed
  specs 001 and 002. Dev server runs on http://localhost:3000.
- **2026-09-30** — Built the Jobs page (`specs/003-jobs-page-ui.md`) per
  the layout pinned in `ui-context.md` (cards + filtered table), so no
  layout round was needed. Reworked the Applications layout and light
  theme colors on the user's request. Renumbered upcoming specs: schema
  is now 004 and backend wiring 005.
- **2026-10-02** — Built the ATS scrapers (`specs/004-ats-scrapers.md`):
  hybrid approach chosen by the user (ats-scrapers directory + our own
  Playwright scrapers), 5 ATSs, output to a local file the Jobs page
  reads. Schema/wiring specs renumbered to 005/006.
- **2026-10-02** — Built onboarding (spec 005) and resume keyword
  matching (spec 006) on the user's request, with the three US questions
  (work authorization, sponsorship, EEO) as their own steps. Found and
  fixed a Greenhouse description-extraction bug that leaked page CSS/JS
  into descriptions (caused nonsense matches). Schema/wiring specs
  renumbered to 007/008.
- **2026-10-05** — Added a UI-only login page as the default route. Shaped
  (Impeccable) and built the resume builder (spec 009, numbered after the
  reserved 007/008). Seeding parses the uploaded resume's headings, dated
  entry lines and wrapped bullets. User asked not to run typecheck/lint;
  they test changes themselves.
- **2026-10-05** — Square corners app-wide (`--radius: 0px`). Top matches
  became one divided strip. Company logos (spec 010): the scrapers now
  read each board's own logo (Greenhouse/Workday/SmartRecruiters
  `og:image`, Lever header img, Ashby `logoSquareImageUrl`) into
  `companyLogo`; `scripts/enrich_logos.py` backfills the existing pool;
  the UI falls back to a building placeholder icon. Numbered 010: 007/008 are
  reserved for the schema/wiring specs and 009 is the resume builder.
