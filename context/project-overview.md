# 1. Project Overview

## NovaJobs

## Overview

NovaJobs is an auto-apply job platform. A candidate creates a profile once
(contact info, resume, job preferences, sponsorship/work-authorization and
EEO answers), and the platform then finds real, US-based job postings that
match their profile, shows them ranked by match score, and — on the
candidate's click — automatically fills and submits the actual application
on the real ATS (Greenhouse, Lever, Ashby, etc.) on their behalf.

This is a **from-scratch rebuild** of an existing working Flask app. The
automation core (`engine.py` — job scraping, resume-to-job matching, form
filling, submission) is being kept and carried forward. Everything else
(frontend, auth, page structure, styling) is being rebuilt on a new stack
for consistency, maintainability, and a modern, uniform UI across every
page — no more one-off per-page CSS and duplicated logic.

## Goals

- One consistent design system (shadcn/ui) across every page — marketing
  site, auth, onboarding, dashboard, admin. No page should look or behave
  like it was built by a different team.
- A codebase that's easy to extend without re-learning it each time:
  predictable file structure, typed boundaries, one way to do each kind of
  thing (one data-fetch pattern, one form pattern, one status pattern).
- Stronger job coverage and matching quality than the current app,
  including ATS platforms that require the candidate to be logged in
  (via a companion Chrome extension).
- A visible, honest apply pipeline: the candidate always knows what's
  in progress, what succeeded, and exactly why something failed.
- A foundation solid enough that a fully autonomous "just turn it on and
  it applies for you" mode is a later, additive phase — not something the
  initial rebuild has to solve.

## Core User Flow

1. **Sign up** (Clerk) → redirected into onboarding.
2. **Onboarding** — short, progress-bar-driven steps: resume upload,
   contact/profile details, job preferences, and the standard
   sponsorship/work-authorization/EEO questions asked once so the engine
   never has to guess them later.
3. **Dashboard** — candidate lands on their matched jobs: a small set of
   the highest-scoring matches shown as cards (with an Apply button), and
   the full matched pool below as a searchable/filterable table.
4. **Apply** — clicking Apply queues that one job. The engine (Python,
   Hyperbrowser, Gemini for screening questions) processes the queue one
   job at a time per candidate.
5. **Track** — a Stripe-Workbench-style panel slides up from the bottom of
   the screen showing what's currently being worked on, what's next in
   line, what's been successfully applied, and what failed or needs the
   candidate's manual review — with the actual reason shown, not a
   generic error.
6. **Profile & Resume** — candidate can view/edit their profile at any
   time, preview/edit their resume, and see a Gemini-scored resume/ATS
   score.
7. **Applications dashboard** — history and stats of everything sent.

## Features

- Centralized, shared job pool (scraped once, matched against every
  candidate, not re-scraped per apply run).
- Match scoring against each candidate's resume/profile; only jobs at or
  above a **30% match score** are shown to that candidate.
- Jobs UI: top matches as cards with an Apply button, full list below as
  a table.
- Click-to-apply, per-job queue (not a bulk daily-goal loop) — the
  candidate decides which jobs to apply to.
- Auto-apply queue panel ("Workbench" drawer): In Progress / Applied /
  Failed-or-Needs-Review, each with real detail (job, company, reason).
- Profile view/edit page, independent (not a popup/dropdown).
- Resume preview/edit, plus a Gemini-generated resume/ATS score.
- Applications dashboard with history and stats.
- Search/filtering over the indexed job pool: Location, Experience level
  (Entry / Mid / Senior), Company, and — importantly — Sponsorship
  availability.
- Onboarding collects sponsorship/authorization/EEO/personal details up
  front so the apply engine can answer real application questions from
  stored candidate data instead of guessing or leaving fields blank.
- Chrome extension (companion project) to handle ATS platforms that
  require the candidate to already be logged in.

## Scope

### In Scope

- Full rebuild of the web app: marketing pages, auth, onboarding,
  dashboard (jobs, profile, resume, applications, queue panel).
- Centralized job pool + matching pipeline (US-only).
- Click-to-apply engine integration, ported from/around the existing
  `engine.py` logic, moved onto Hyperbrowser.
- Resume scoring and screening-question answering via Gemini.
- Search/filter indexing for the job pool (location, experience level,
  company, sponsorship).
- A consistent shadcn-based design system used on every page.
- Companion Chrome extension for login-gated ATS platforms (tracked as
  its own sub-project, same overall program).

### Out of Scope (for this phase)

- Fully autonomous apply-without-a-click mode. Requires materially
  stronger matching confidence than a 30% threshold provides; deferred
  until the matching pipeline has been proven at the click-to-apply
  stage first.
- Non-US jobs.
- Anything not already listed above (e.g. team/recruiter-facing
  features) unless it comes up and gets added here deliberately.

## Success Criteria

- A candidate only ever sees real, currently-open, US-based jobs at or
  above 30% match — no noise.
- Clicking Apply reliably results in either a real submitted application
  or a clear, specific, honest reason why not.
- Every page shares the same visual language, components, and
  interaction patterns — a new page never needs new one-off styling.
- Sponsorship/EEO/work-authorization questions are answered from the
  candidate's own stored data, never fabricated or guessed by AI.
- The codebase can be picked up in a new session using only the six
  `context/` files and reach the same understanding this one has.
