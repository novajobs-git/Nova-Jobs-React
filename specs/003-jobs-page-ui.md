# 003 — Jobs page UI (mock data)

**Status:** Done (2026-09-30)

## Goal

Give the candidate the page they land on (user flow step 3): their
highest-scoring matches as cards with an Apply button, and the full
matched pool below as a searchable, filterable table. Clicking Apply
queues that one job and it shows up in the Workbench.

## Scope

In:
- `/jobs` route inside the existing app shell. The sidebar's Jobs entry
  becomes live, and `/` now redirects to `/jobs` (the candidate lands on
  matched jobs, per `project-overview.md`).
- Header with a one-line summary (matches ≥30%, new in the last 24h,
  top match).
- **Top matches:** up to 6 not-yet-applied jobs with the highest match
  score, as cards. Each card shows: match %, role, company, location,
  work mode, level, sponsorship, salary (when known), two match reasons,
  posted time, Apply and a posting link.
- **All matches:** a table with search (role/company) and filters for
  Location, Experience level (Entry / Mid / Senior), Company and
  Sponsorship. Columns: role + company, match, location, level,
  sponsorship, posted, action. The action is Apply, or the job's current
  status if it's already in the pipeline. Includes a row cap with
  "Show more", a result count, and an empty state with Clear filters.
- **Apply:** adds a `queued` application to a client-side applications
  store shared by the Jobs page, the Applications page and the Workbench
  dock. It shows a toast with the job's place in line. The Apply button
  becomes the status. The store resets on reload until spec 005 wires
  real queue APIs.
- The Workbench lists queued jobs in the order they were queued (oldest
  first = next in line).

Out:
- Real job pool, matching, and the queue API (specs 004–005).
- Job detail view or dialog.

## Interface

`lib/jobs/types.ts`:

```ts
type ExperienceLevel = "Entry" | "Mid" | "Senior"
type WorkMode = "Remote" | "Hybrid" | "On-site"
interface Job {
  id: string; company: string; role: string; location: string
  workMode: WorkMode; level: ExperienceLevel; ats: Ats
  sponsorship: Sponsorship; matchScore: number   // always >= MATCH_THRESHOLD (30)
  salary?: { min: number; max: number }          // USD / year
  matchReasons: string[]; postedAt: string; postingUrl: string
}
```

- `Application` gains `jobId: string`, which links an application to its
  job in the pool.
- `lib/jobs/mock-data.ts` exposes `getJobs()`. It already applies the 30%
  threshold, as the real service must.
- `components/applications/applications-provider.tsx` provides
  `useApplications()` → `{ applications, apply(job) }`.

## Acceptance criteria

- [x] `/` redirects to `/jobs`, and the sidebar Jobs entry is active there.
- [x] No job below 30% match is ever rendered.
- [x] Top matches exclude jobs already in the pipeline.
- [x] Each filter narrows the table, the count updates, and Clear filters resets them.
- [x] Apply → toast with place in line; the card or row switches to "Queued";
      the Workbench and Applications page show the new job.
- [x] A candidate who needs sponsorship can see at a glance which jobs sponsor.
- [x] Works in light and dark, at desktop and mobile widths.

## Open questions

- The real schema (spec 004) decides where `level`, `workMode` and
  `salary` come from (scraped vs. inferred).
