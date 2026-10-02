---
version: 1
slug: "app-dashboard-applications-page-tsx"
primary_target: "app/(dashboard)/applications/page.tsx"
related_targets: []
---

## Scope

Applications dashboard (`/applications`), inside the authenticated app shell. Visitor mode: Operate.

## Audience and task

US job seeker, self-serve, checking in daily. Task: learn in seconds what NovaJobs applied to, what is still queued, and what needs them — then act on it (retry, open the posting, fix a profile answer).

## Direction contract

THESIS: The page opens on what needs the candidate, not on vanity totals. It refuses the four-stat-card hero plus generic chart that every SaaS dashboard ships.

OWN-WORLD: The pinned NovaJobs system: shadcn/ui, Inter, primary #3B82F6, 6px radius, cool-tinted neutrals. Status is carried by color plus label plus icon: applied green, queued/applying blue, failed/needs review red. Tabular numerals, hairline borders, no decorative shadows.

STORY: Understand ("14 sent this week, 2 need you"), believe (every failure has its real reason), do (retry or fix, then scan history).

FIRST VIEWPORT: Page title with a one-line outcome sentence; a full-width segmented outcome bar with a legend of counts; directly below, the "Needs your attention" list, each row carrying company, role, the verbatim failure reason and inline Retry / Open posting actions. The Workbench dock is pinned at the bottom of the viewport showing the job currently applying.

FORM: Attention-first triage, grounded candidate #3, seed key 158368d6.

SIGNATURE INTERACTION: Clicking a segment of the outcome bar filters the history table to that status (and the tabs follow); the Workbench dock expands into the queue sheet.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Real data source (Supabase schema spec) not yet written; the page runs on labeled synthetic data.
