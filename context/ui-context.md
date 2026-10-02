# 5. UI Context

## Theme

- Minimal, clean SaaS aesthetic — matches the explicit "Minimal UI" spec
  for the rebuild. Light and dark mode both supported from the start via
  CSS variables (shadcn's standard theming approach), not bolted on later.
- shadcn style baseline: **New York** variant (tighter, more neutral
  default than shadcn's "Default" style) — a starting choice, revisit in
  `progress-tracker.md` if it doesn't fit once real screens are built.

## Colors

Carried forward from the current app's already-validated primary action
color (established and tested across every page this session), mapped to
shadcn/Tailwind CSS variables rather than hard-coded hex values anywhere
in component code:

| Token | Value | Usage |
|---|---|---|
| `--primary` | `#3B82F6` | Primary buttons, active/selected states, links |
| `--primary-hover` | `#2563EB` | Hover state for primary actions |
| `--foreground` / `--background` | neutral gray/white (light), inverted (dark) | Base text/page |
| `--success` | green (`#16a34a` family) | Applied status |
| `--warning` | amber/blue-mid (`#2563eb`-adjacent "in progress" tone) | Queued/Applying status |
| `--destructive` | red (`#dc2626` family) | Failed status, destructive actions |
| `--muted` | gray | Secondary text, borders, disabled states |

Status colors specifically (jobs table, Workbench queue panel):
- **Applied** → success green
- **Queued / Applying** → primary blue (mid-emphasis, in-progress)
- **Failed / Needs Review** → destructive red
- **Not Applied** → muted gray

## Typography

- **Inter**, the typeface already used throughout the existing app —
  keep it for continuity and because it's a solid, neutral choice for a
  data-dense dashboard product.
- A single consistent type scale defined once (Tailwind's default scale
  is sufficient — don't invent custom font-size values per component).
- Weight usage: 400 body, 500–600 UI labels/buttons, 700–800 headings —
  matches the weight pattern already established across the current
  site's buttons and headings.

## Border Radius

- `--radius: 6px` as the base token (matches the button radius already
  validated across the current app's entire button system this session).
- Cards, inputs, and dialogs/sheets can use a slightly larger radius
  (e.g. `--radius-lg: 10–12px`) for visual hierarchy, but everything
  derives from the one base token — never a one-off radius value typed
  into a component.

## Component Library

**shadcn/ui exclusively.** Core components this product needs:

- `Button` — all actions, all pages, one visual system (no per-page
  reinvented buttons).
- `Card` — job cards (top matches), profile sections, dashboard stat
  tiles.
- `Table` — the full matched-jobs list, applications history.
- `Sheet` (side="bottom") — the Stripe-Workbench-style Auto-Apply Queue
  panel: slides up from the bottom, covers roughly half the screen when
  expanded, pinned/collapsible, with an internal `Tabs` split of
  In Progress / Applied / Failed-or-Needs-Review.
- `Tabs` — Workbench panel sections; onboarding step content if tabbed
  rather than fully linear.
- `Badge` — status pills (Applied / Queued / Failed / Not Applied), match
  score indicators.
- `Progress` — the onboarding progress bar (deliberately "psychology"-
  paced: small, frequent steps that feel like fast progress rather than a
  few large, slow ones).
- `Dialog` — confirmations, job detail preview.
- `Select`, `Input`, `Textarea`, `RadioGroup`, `Checkbox` — profile form,
  onboarding questions (including the Yes/No/Prefer-not-to-answer EEO and
  sponsorship/work-authorization questions).
- `Avatar`, `DropdownMenu` — top nav / account menu.
- `Toast` (sonner, shadcn's recommended pairing) — save confirmations,
  apply-action feedback.

## Layout Patterns

- **App shell**: persistent sidebar (primary nav) + topbar (account,
  notifications, global Auto-Apply on/off), matching the structure already
  proven usable in the current dashboard — carry the pattern forward, not
  necessarily the old markup.
- **Jobs page**: top matches as a card grid (highest-scoring jobs, each
  with an Apply button), full matched pool as a table below it, with
  filter controls (Location, Experience level, Company, Sponsorship) above
  the table.
- **Auto-Apply Queue panel**: bottom-docked `Sheet`, pinned/always
  accessible (a slim always-visible bar, expandable to the full panel),
  never overlapping the sidebar horizontally, tabbed into In Progress /
  Applied / Failed-or-Needs-Review — each entry shows company, title,
  location, and (for failed/needs-review) the actual reason.
- **Onboarding**: single linear flow with a visible step progress
  indicator, short steps, one clear topic per step (resume → details →
  preferences/sponsorship/EEO → review).
- **Profile page**: its own standalone route, not a popup/dropdown —
  view and edit in place.

## Icons

- **lucide-react** — shadcn's standard icon set. No mixing in a second
  icon library; if a needed icon doesn't exist in Lucide, prefer an
  existing close match over adding a new dependency.
