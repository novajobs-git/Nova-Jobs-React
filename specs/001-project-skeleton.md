# 001 — Project skeleton (Next.js + shadcn)

**Status:** Done (2026-09-29)

## Goal

Stand up the Next.js App Router + shadcn/ui + Tailwind project at the repo
root, themed with the pinned NovaJobs tokens from `context/ui-context.md`,
so every later page spec builds on one design system.

## Scope

In:
- Next.js (App Router, TypeScript strict, Turbopack dev) at repo root,
  matching the file organization in `context/code-standards.md`.
- shadcn/ui initialized (Radix base, `vega` style, neutral base color,
  CSS variables, lucide icons) with the primitives the dashboard needs.
- Theme tokens: `--primary #3B82F6`, `--primary-hover #2563EB`,
  `--success`, `--warning` (in-progress blue), `--destructive`, `--muted`,
  `--radius: 6px`, light + dark.
- Inter via `next/font` as the only UI face.

Out:
- Clerk auth, Supabase client, API routes (later specs).
- Marketing, auth and onboarding routes.

## Interface

- `app/globals.css` — all tokens; no hex values in components.
- `components/ui/*` — shadcn-generated, not hand-edited.
- `lib/utils.ts` — shadcn `cn` helper.

## Acceptance criteria

- [x] `npm run dev` starts clean; `npm run build` passes with no type errors.
- [x] Primary buttons render `#3B82F6`, hover `#2563EB`.
- [x] Base radius is 6px and all component radii derive from it.
- [x] Light and dark themes both defined via CSS variables.
- [x] Inter is the rendered UI font.

## Decisions taken

- shadcn no longer ships a "New York" style; `vega` (the classic shadcn
  look) is the closest successor and is used instead. Recorded in
  `progress-tracker.md` → Architecture Decisions.

## Open questions

- None blocking.
