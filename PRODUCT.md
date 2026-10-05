# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + React, shadcn/ui (New York) + Tailwind CSS, lucide-react icons. Clerk (auth) and Supabase (Postgres + Storage) are the target backend but are not wired yet: the first surfaces run on a typed mock data layer that mirrors the planned schema. Full stack and boundaries live in `context/architecture.md`.

## Users

US-based job seekers using NovaJobs self-serve, actively job hunting. They check in daily (often more) to see what the platform applied to on their behalf, what is still in the queue, and what failed or needs their manual attention. A meaningful share need visa sponsorship, so sponsorship availability is a first-class fact, not a footnote.

## Product Purpose

NovaJobs is an auto-apply job platform. A candidate builds a profile once (resume, preferences, work authorization, sponsorship, EEO answers); the platform matches them against a centralized pool of real, currently open US jobs and, on the candidate's click, fills and submits the real application on the real ATS (Greenhouse, Lever, Ashby, etc.). Success means every Apply click ends in either a real submitted application or a specific, honest reason why not.

## Positioning

The candidate stays in control: jobs are applied to one click at a time through a visible, serial per-candidate queue, never a blind bulk loop, and every failure carries its actual reason. Sensitive answers (sponsorship, EEO) are always the candidate's own stored answer, never AI-guessed.

## Operating Context

- Core loop: onboarding → matched jobs (30% minimum match) → click Apply → queued → applying → applied / failed / needs review.
- Apply is a per-candidate serial queue: one job in flight at a time.
- A bottom-docked "Workbench" queue panel (In Progress / Applied / Failed-or-Needs-Review) is a persistent part of the app shell.
- Job pool filters that matter: location, experience level (Entry / Mid / Senior), company, sponsorship.
- ATS targets: Greenhouse, Lever, Ashby, Workday and similar.

## Capabilities and Constraints

- US-only jobs, enforced at ingestion.
- Match statuses: `not_applied`, `queued`, `applying`, `applied`, `failed`, `needs_review`, each with a failure-reason string where relevant.
- EEO fields are never inferred or generated.
- No destructive database operation without explicit per-instance user confirmation.
- Spec-driven development: every unit of work is a `specs/NNN-*.md` file written before its code.
- Undecided: pricing/payment model, Hyperbrowser vs. the old no-evasion principle, RLS strategy, Chrome extension timeline, meaning of the "like Tsenta" reference.

## Brand Commitments

- Name: NovaJobs (operated by NovaStaffs).
- Visual system is pinned by `context/ui-context.md`: shadcn/ui New York variant exclusively, Inter, primary `#3B82F6` / hover `#2563EB`, `--radius: 0px` (square corners everywhere), status colors applied = green, queued/applying = primary blue, failed/needs review = red, not applied = muted gray. Light and dark mode from day one. lucide-react only.
- Voice: minimal, honest, specific. Failures are stated with their real reason, never a generic error.

## Evidence on Hand

No real candidate data, customers, testimonials, or metrics exist yet. Any data shown in early builds is synthetic demonstration data and must be labeled as such; never present it as real usage figures.

## Product Principles

1. The candidate always knows what is in progress, what succeeded, and exactly why something failed.
2. Control over automation: the candidate decides what gets applied to.
3. Stored truth over guessing, especially for sponsorship and EEO answers.
4. One consistent system across every page; a new page never needs one-off styling.

## Accessibility & Inclusion

Status must never be conveyed by color alone (label + color). Full light and dark mode support.
