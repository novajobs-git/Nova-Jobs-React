# 4. AI Workflow Rules

## Approach

This project is built with Claude Code using **spec-driven development**:
no feature is implemented until it exists as a written spec, and work
proceeds spec by spec, not by improvising directly from a chat prompt.

- Read all six files in `context/` before starting any new unit of work in
  a fresh session — they are the source of truth, not this conversation's
  memory.
- Every unit of work starts as a spec file under `specs/` before any code
  is written. A spec is small enough to implement and verify in one pass.
  Minimum shape for a spec:
  - **Goal** — what this unit does and why, one or two sentences.
  - **Scope** — exactly what's in and out for this spec (see Scoping
    Rules below).
  - **Interface** — the shape of what it touches: API routes/params,
    DB columns/tables, component props — whatever the boundary is.
  - **Acceptance criteria** — a concrete, checkable list of "this is done
    when...". No spec is "done" until every criterion is met.
  - **Open questions** — anything not yet decided; blocks implementation
    of the parts that depend on it, not the whole spec.
- Implementation follows the spec as written. If reality forces a change
  (the spec's approach doesn't work, a dependency wasn't what was assumed),
  update the spec file first, then continue — the spec and the code should
  never silently drift apart.
- A spec is only started once its prerequisite specs (schema it depends
  on, an API route it calls) are done — see When to Split Work.
- Prefer adapting proven logic over rewriting from zero. `engine.py`'s
  scraping/matching/form-filling logic has already been debugged against
  real ATS forms (label-extraction quirks, EEO handling, CAPTCHA flow,
  the serial per-user queue model) — a spec that touches this should say
  explicitly what it's porting/adapting versus what it's changing, not
  discard it and start over just because the web app around it is being
  rebuilt.
- When the new stack's spec conflicts with something the old app proved
  the hard way (e.g. a matching threshold, a queue design, an EEO-handling
  rule), surface the conflict rather than silently picking one — see
  Handling Missing Requirements below.

## Scoping Rules

- One spec = one feature or one page, never an unrelated bundle. A spec
  that starts growing a second, unrelated concern should be split instead
  of expanded.
- If a task naturally spans both a schema change and UI that depends on
  it, that's two specs: schema/migration first (implemented and confirmed
  working), then the UI spec that depends on it — never guess at a schema
  shape while writing a UI spec.
- Don't touch styling/structure on a page a spec doesn't cover, even if
  it's inconsistent with `ui-context.md` — flag it as a candidate for its
  own spec instead, unless the spec in hand is explicitly a consistency
  pass.

## When to Split Work

Split into multiple specs when a single one would otherwise touch more
than one of: database schema, API layer, and UI, for more than one feature
area at once. Example: "add job filtering" is three specs — schema
(indexed columns), API (filter params), UI (filter controls) — implemented
and verified in that order, each depending on the last being done.

## Handling Missing Requirements

- If a requirement is ambiguous or not yet decided (pricing/payment model,
  Chrome extension timeline, the Hyperbrowser-vs-no-evasion stance, exact
  RLS strategy — see `progress-tracker.md` → Open Questions), stop and ask
  rather than assume.
- If a reasonable default has to be taken to keep moving on something
  minor (e.g. a specific shadcn theme variant), take it, but record it in
  `progress-tracker.md` under Architecture Decisions so it's visible and
  revisitable — never leave an unstated assumption buried only in code.

## Protected Files

- `engine.py` (and its eventual `engine/` successor)'s core fill/apply
  logic — adapt incrementally with clear reasoning for each change; don't
  wholesale-rewrite a function that's already been debugged against real
  form-filling edge cases without a specific reason tied to the rebuild.
- Database migrations / `supabase_setup.sql` and its successor — additive
  by default; any destructive change requires explicit user confirmation
  first, every time, no exceptions for "it's just test data."
- `.env` / any secrets file — never printed, never committed, never
  included in a response verbatim.
- `components/ui/` (shadcn-generated) — customize only through supported
  theme/config mechanisms, not by hand-editing generated internals, so
  `shadcn` CLI upgrades stay painless.

## Keeping Docs in Sync

- Update `progress-tracker.md` at the end of every work session:
  Completed / In Progress / Next Up, at minimum — named by spec, not just
  by vague feature description (e.g. "`specs/003-job-filtering-api.md`
  done", not "did the filtering thing").
- Update `architecture.md` the moment a structural decision is actually
  made (not deferred) — e.g. the RLS strategy gets decided, or the
  Hyperbrowser question gets resolved.
- These six files, plus the `specs/` folder, should always be enough, on
  their own, for a new session with zero conversation history to
  understand the project and continue it correctly. If something
  important isn't captured in them, that's a gap to close before moving
  on, not something to leave in chat history.

## Before Moving to the Next Unit

- Every acceptance criterion in the spec is actually met — not "close
  enough" or "mostly working."
- The build/dev server runs clean — no type errors, no console errors.
- The change matches `code-standards.md` (styling exclusively via
  shadcn/Tailwind, typed boundaries, no dead code).
- If it's UI-facing, it's been manually checked in the browser — a
  passing type-check is not the same as a working feature.
- The spec file reflects what was actually built (update it if
  implementation diverged from the original plan) and is marked done.
- `progress-tracker.md` reflects what actually happened, including
  anything that came up but wasn't resolved (goes into Open Questions).
