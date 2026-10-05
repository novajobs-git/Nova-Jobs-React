---
name: NovaJobs
description: Auto-apply to real, matched US jobs, one click at a time.
colors:
  primary: "#3b82f6"
  primary-hover: "#2563eb"
  primary-foreground: "oklch(0.99 0 0)"
  warning: "#2563eb"
  success: "#16a34a"
  success-text: "#15803d"
  needs-review: "#f87171"
  destructive: "#dc2626"
  background: "lab(91.2882% -0.491798 -2.20391)"
  foreground: "oklch(0.21 0.015 255)"
  muted: "oklch(0.967 0.004 255)"
  muted-foreground: "oklch(0.5 0.015 255)"
  accent: "oklch(0.955 0.012 255)"
  border: "oklch(0.925 0.006 255)"
  input: "oklch(0.9 0.008 255)"
  sidebar: "oklch(1 0 0)"
  sidebar-accent: "oklch(0.945 0.012 255)"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  numeral:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.333
    fontFeature: "\"tnum\""
rounded:
  md: "0px"
  lg: "0px"
  pill: "0px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-sm:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
    height: "36px"
  tabs-list:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.lg}"
    padding: "3px"
    height: "36px"
  tabs-trigger-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  badge-count:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "0 6px"
    height: "18px"
  panel:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  nav-item-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
---

# Design System: NovaJobs

## Overview

**Creative North Star: "The Honest Ledger"**

NovaJobs is an operating surface a job seeker checks every day, so the system reads like a well-kept ledger: white paper, cool-grey rules, one blue for action, and three status colors that always mean the same thing. It is shadcn/ui (radix-vega primitives) on Inter at hue-255 cool-tinted neutrals. Density is data-dense but calm, with 14px body text, hairline-divided rows, and tabular numerals everywhere a number appears.

Hierarchy comes from weight and position, not ornament. Sections are hairline-bordered panels, not raised cards. Status is never carried by color alone: it is always color, word, and a lucide icon together. The status palette is the product's promise that every attempt ends in a real submission or a stated reason, so it is exact and never reused for decoration.

Light and dark themes are both first-class, switched by class (`.dark`) through the same CSS custom properties. Dark mode lifts the status hues one step (green 500, red 400) so they stay legible on the near-black blue-grey ground.

**Key Characteristics:**
- One blue (`--primary`) for actions, links, and the in-progress state; no second accent hue.
- Status triad: green applied, blue queued/applying, red failed or needs review, each paired with a label and icon.
- Cool neutrals at OKLCH hue 255, very low chroma, never pure grey.
- Flat panels on 1px hairlines with square corners; shadows only on floating overlays and form controls.
- Inter throughout, Tailwind's default type scale, tabular numerals for every count, percent, and timestamp.

## Colors

A cool, quiet neutral field with one saturated blue and a strict three-hue status vocabulary.

### Primary
- **Signal Blue** (`primary`): Primary buttons, the active wordmark half ("Nova"), links on hover, the Workbench trigger, focus rings (`--ring`), and the Queued status. Pinned by `context/ui-context.md`.
- **Pressed Blue** (`primary-hover`): Hover state for primary buttons only. In dark mode it lightens instead (see sidecar `colorMeta.primary-hover.dark`).
- **In-Progress Blue** (`warning`): The Applying status (text, dot, and the live pulse in the Workbench bar). The token keeps the `--warning` name inherited from ui-context, but its value is blue, not amber; treat it as "in progress", never as a caution color.

### Secondary (status)
- **Applied Green** (`success`): Fills only: outcome-bar segment, legend dots, chart bars, ATS success meters, the "All clear" icon.
- **Applied Green, Text** (`success-text`): The Applied status label and icon. One step darker than the fill so 14px text holds contrast on white.
- **Review Coral** (`needs-review`): Fill only, for the Needs-review segment, dot, and chart stack. Its text counterpart is Failure Red.
- **Failure Red** (`destructive`): Failed fills, and all red text: Failed and Needs-review labels, the "N need you" lede count, failure reasons in the Workbench, the sidebar attention badge.

### Neutral
- **Paper** (`background`): The light-grey page ground behind the content column in light mode. Panels, the top bar, the Workbench bar, table and form fields sit on white `card` above it.
- **Ink** (`foreground`): Primary text; blue-grey at hue 255, never pure black.
- **Mist** (`muted`): Tabs track, table header wash (at 50%), hover wash on rows and legend buttons, count badges.
- **Slate Text** (`muted-foreground`): Secondary text: company names, timestamps, captions, helper sentences.
- **Frost** (`accent`): Avatar fallback and menu highlights.
- **Hairline** (`border`): Every panel border, row divider, header and dock rule.
- **Field Line** (`input`): Input and select strokes, a half-step heavier than Hairline.
- **Rail** (`sidebar`, white in light mode) and **Rail Selected** (`sidebar-accent`): The navigation sidebar surface and its active item.

### Named Rules
**The Triple-Signal Status Rule.** Every status renders as color plus its word plus its lucide icon (CircleCheck applied, LoaderCircle applying, CircleDashed queued, CircleAlert needs review, CircleX failed). A colored dot alone is allowed only where the word sits beside it in a legend.

**The Fill-Versus-Text Rule.** Status fills and status text are separate tokens. Green text uses `success-text`, never `success`. Review Coral is never used for text; Needs-review text is Failure Red.

**The One Blue Rule.** Blue means "act here" or "in progress". Do not introduce another accent hue, and do not use status colors for decoration, section theming, or emphasis.

## Typography

**Body Font:** Inter (with ui-sans-serif, system-ui fallback), loaded via `next/font` as `--font-sans`; headings use the same family.
**Label/Mono Font:** Geist Mono is loaded as `--font-mono` but no built surface uses it yet.

**Character:** One neutral grotesque carrying everything; hierarchy comes from weight (400 body, 500 labels, 600 section titles and numerals, 700 page title) and from Tailwind's default size scale.

### Hierarchy
- **Headline** (700, 1.5rem, tight tracking): The page title, one per route.
- **Numeral** (600, 1.5rem, tight tracking, tabular): Headline counts in the outcome legend.
- **Title** (600, 1rem): Section headings ("Needs your attention", "History", "Last 14 days").
- **Body** (400, 0.875rem): Rows, reasons, descriptions. Failure reasons cap at 75ch. The page lede under the title steps up to 1rem.
- **Label** (500, 0.875rem): Buttons, status labels, role names, tab triggers.
- **Caption** (400, 0.75rem, tabular): Relative timestamps, queue position, truncated reasons in the table.

### Named Rules
**The Tabular Numerals Rule.** Every count, percentage, match score, and timestamp is set with tabular figures so columns and legends do not jitter as data changes.

**The Default Scale Rule.** Sizes come from Tailwind's default scale only. No per-component font sizes.

## Layout

The app shell is a collapsible icon sidebar (16rem expanded, 3rem collapsed) plus a 56px sticky white top bar over a hairline. Page content sits in a centered column capped at 72rem, with 16px gutters under 768px and 24px above, 32px top padding and 48px bottom.

Sections stack in a single column with a 32px gap. Inside panels, horizontal padding is 16px, widening to 20px at 768px; list rows use 16px vertical padding; table rows follow the shadcn table defaults. Legends and two-up panels use a 16-24px grid gap.

Responsive behavior is progressive disclosure by column, not reflow. The outcome legend goes 2-up to 4-up at 640px. Attention rows become a three-column grid (8rem status, flexible text, actions) at 768px. Table columns appear by breakpoint (Updated at 640px, Match at 768px, Sponsorship and ATS at 1024px), and the history filters move beside the tabs at 1280px. On narrow screens the tabs scroll horizontally behind a fade mask.

The Workbench dock is a sticky bottom bar inside the content area. Its expanded sheet opens from the bottom at min(560px, 70svh) and starts at the sidebar's edge. It never covers the sidebar.

## Elevation & Depth

The system is flat with hairlines. Panels, tables, and lists sit on the page at rest, separated by 1px Hairline borders and dividers, with Mist washes for headers and hover. The only elevation belongs to the shadcn primitives: a hairline-level shadow on outline buttons, inputs, and select triggers; a small shadow under the active tab; a medium shadow on select menus; a large shadow on the Workbench sheet. Sticky bars get their separation from translucency, blur, and a rule, not a shadow.

### Named Rules
**The Hairline Rule.** Content containers are bordered, never shadowed. Only floating layers (sheet, popover, menu) cast a real shadow.

## Shapes

Every corner is square. The single `--radius` base is `0px`, so every step of the scale (`sm` through `4xl`, plus `panel`) computes to 0. Buttons, inputs, panels, tabs, pills, status dots, avatars, checkboxes, radios, switches, progress meters and chart bars all meet at 90°. Where a component would otherwise reach for `rounded-full`, it uses `rounded-none`.

**The Derived Radius Rule.** Radii come from the `--radius` scale. Never type a one-off radius into a component.

## Components

### Buttons
Compact and quiet; blue is spent only where the user acts.
- **Shape:** Square corners (0px, the base radius), 36px tall by default, 32px at `sm` (the size used in lists).
- **Primary:** Signal Blue with near-white label; used for the one resolving action per row (Retry, Answer question, Update profile).
- **Hover / Focus:** Hover swaps to Pressed Blue. Focus shows a 3px ring at 50% ring color. Pressing nudges the button down 1px.
- **Outline:** Paper fill, Hairline border, Mist on hover; for low-stakes actions (Dismiss, Clear filters).
- **Ghost:** No fill, Mist on hover; for secondary links (Posting with an external-link icon, Show all / Show fewer toggles).

### Chips / Badges
- **Count badge:** Mist fill, 18px tall pill, tabular caption numerals, inside tab triggers.
- **Outline badge:** Hairline border, Slate Text; used for the "Demo data" marker in the top bar.

### Cards / Containers
- **Corner Style:** Square (0px).
- **Background:** Paper, with an optional Mist header band at 50%.
- **Shadow Strategy:** None (see The Hairline Rule).
- **Border:** 1px Hairline; internal rows divided by Hairline rules.
- **Internal Padding:** 16px, rising to 20px at 768px. Section headers sit in their own ruled band with 12px vertical padding.

### Inputs / Fields
- **Style:** 36px tall, square corners, Field Line stroke, transparent fill (a 30% Field Line wash in dark mode), search inputs with a 16px leading lucide icon.
- **Focus:** Border turns Signal Blue with a 3px 50% ring.
- **Error / Disabled:** Failure Red border with a 20% red ring; disabled at 50% opacity.

### Tabs
- **Style:** A Mist track (square corners, 3px inset) holding triggers at 60% Ink. The active trigger lifts to Paper with full Ink and a small shadow. Each trigger carries a count badge.

### Navigation
- **Style:** Rail-colored sidebar, icon-collapsible, lucide icon plus 14px label per item. Active item is Rail Selected with Ink text. Unbuilt routes are aria-disabled with a "Soon" badge. The Applications item carries a red attention count. The wordmark is 16px bold, with "Nova" in Signal Blue and "Jobs" in Ink. On mobile the sidebar becomes an off-canvas sheet.

### Status Label (signature)
16px lucide icon plus 14px medium word, both in the status text color, with a 6px gap. It is the unit reused by the attention list, history table, and Workbench queue.

### Outcome Bar (signature)
A 12px full-width pill made of status-fill segments, sized proportionally with 2px gaps. Below it sits a legend of dot, label, a 1.5rem tabular count, and a percent that always sums to 100%. Selecting a segment or legend item dims the other segments to 25% and filters the history.

### Workbench Dock (signature)
A sticky translucent bottom bar: a live In-Progress Blue dot (pinging while applying, static under reduced motion), "Applying now:" with the role and company, a queued count, and a blue "Workbench" trigger. It expands into a non-modal bottom sheet with In progress / Applied / Failed-or-Needs-review tabs.

## Do's and Don'ts

### Do:
- **Do** pair every status color with its word and its lucide icon (The Triple-Signal Status Rule).
- **Do** use `success-text` for green text and `success` for green fills; use Failure Red for all Needs-review text.
- **Do** set every number in tabular figures.
- **Do** separate content with 1px Hairline borders and dividers with square corners.
- **Do** reference color only through the CSS custom properties; component code carries no hex values.
- **Do** keep the Workbench sheet to the right of the sidebar edge.
- **Do** respect `prefers-reduced-motion` for pulses and scroll-into-view.

### Don't:
- **Don't** use Review Coral for text.
- **Don't** add a second accent hue, or use status colors decoratively.
- **Don't** put drop shadows on panels, tables, or list containers; shadows belong to floating layers.
- **Don't** type one-off font sizes or radii into components.
- **Don't** mix a second icon library into lucide-react.
