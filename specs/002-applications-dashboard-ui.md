# 002 — Applications dashboard UI (mock data)

**Status:** Done (2026-09-29)

## Goal

Give the candidate one page that answers, in seconds: what did NovaJobs
apply to, what is in the queue right now, and what needs me, with the
real reason for every failure (user flow step 7, plus the Workbench panel
from step 5).

## Scope

In:
- App shell: sidebar (Jobs, Applications, Resume, Profile) + topbar
  (theme toggle, account menu). Only Applications is built. The other nav
  items render as disabled "soon" entries.
- `/applications` page, "attention first" layout (chosen in the design
  round):
  1. Header with a one-line outcome sentence.
  2. Segmented outcome bar (applied / in queue / needs review / failed)
     with counts. Clicking a segment filters the history table.
  3. "Needs your attention" list: failed + needs-review items with the
     verbatim reason and Retry / Open posting actions. An "all clear" state
     when empty.
  4. Activity chart: applications per day over the last 14 days, stacked
     by outcome.
  5. History table: status tabs, search (company/role), ATS filter,
     sponsorship column, match score, date. An empty state for no results.
- Workbench queue dock: slim bar pinned to the bottom of the content area
  (never over the sidebar) showing the job currently applying. It expands
  into a bottom `Sheet` with In Progress / Applied / Failed-or-Needs-Review
  tabs.
- Typed synthetic data in `lib/applications/mock-data.ts`, labeled as demo
  data in the UI.
- Light + dark, responsive down to 390px wide.

Out:
- Real Supabase reads, Clerk auth, Retry actually re-queuing (buttons show
  a toast only). These come after the schema spec.
- Jobs, Resume, Profile pages.

## Interface

`lib/applications/types.ts`:

```ts
type ApplicationStatus = "queued" | "applying" | "applied" | "failed" | "needs_review"
interface Application {
  id: string; company: string; role: string; location: string
  ats: "Greenhouse" | "Lever" | "Ashby" | "Workday"
  matchScore: number        // 30–100, never below the 30% threshold
  sponsorship: "offered" | "not_offered" | "unknown"
  status: ApplicationStatus
  reason?: string           // required for failed / needs_review
  queuedAt: string; updatedAt: string  // ISO
  postingUrl: string
}
```

The mock-data module exposes `getApplications()` with the same signature a
future `lib/supabase` service will have, so the page swaps sources without
UI changes.

## Acceptance criteria

- [x] `/` redirects to `/applications`; page renders with no console errors.
- [x] Outcome counts in the bar, the tabs and the table all agree.
- [x] Every failed / needs-review row shows its specific reason.
- [x] Status is never color-only (label + icon + color).
- [x] Clicking a bar segment filters the table; the tabs reflect it.
- [x] The Workbench dock sits over the content area only and opens a
      bottom sheet with the three tabs.
- [x] Works in light and dark, and at 1440px and 390px widths.
- [x] `npm run build` passes (strict TS, no `any`).

## As built (divergences from the plan above)

- The attention list shows 4 items, then "Show all N". The history table
  shows 15 rows, then "Show N more", with a "Showing X of Y" count.
- Actions vary per item (Retry / Answer question / Update profile /
  Dismiss), because each failure has a different fix. They show a toast
  until the queue API exists.
- The Workbench `Sheet` is non-modal and offset by the sidebar width so it
  never covers the sidebar.
- Needs review has its own `--needs-review` token (lighter red), separate
  from Failed. Applied text uses `--success-text` (#15803d) for 4.5:1
  contrast. The fills keep #16a34a.
- No looping motion except the Workbench "applying now" pulse, which is
  disabled under `prefers-reduced-motion`.
- On mobile, the Match / Sponsorship / ATS / Updated columns are hidden.
  The update time sits under the status instead.
- Also added the "Success by ATS" panel next to the 14-day chart.
- Known, not changed: white 14px text on the pinned `#3B82F6` is about
  3.7:1, below WCAG AA 4.5:1. Raised with the user as a decision, because
  the color is pinned by `ui-context.md`.

## Open questions

- The Supabase schema (spec 003) decides the real field names. The mock
  types above are the proposal it should confirm or amend.
