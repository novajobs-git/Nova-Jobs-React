# 3. Code Standards

## General

- Consistency beats cleverness. If the codebase already does something one
  way, do it that way again — don't introduce a second pattern for the
  same problem.
- No dead code, no commented-out blocks left "just in case," no unused
  exports/imports.
- Comments explain **why**, not what — only when the reason isn't obvious
  from the code itself (a workaround, a non-obvious constraint, a
  deliberate tradeoff). Well-named code doesn't need a comment restating
  it.
- No premature abstraction. Three similar lines is fine; don't build a
  generic helper for a pattern that's only used twice.
- Don't add error handling, fallbacks, or validation for cases that can't
  actually happen. Validate at real boundaries (user input, external API
  responses) — trust your own internal code.

## TypeScript

- Strict mode on, always.
- No `any`. If a type is genuinely unknown, use `unknown` and narrow it.
- Prefer `interface` for object shapes that represent entities; `type` for
  unions, intersections, and utility compositions.
- Runtime-validate anything crossing a real boundary (API request bodies,
  webhook payloads, environment variables) with Zod — don't just cast.
- Shared types live in `types/` or colocated with the domain they belong
  to (e.g. `lib/jobs/types.ts`), not duplicated per component.

## Next.js

- App Router only. Server Components by default; a component only becomes
  a Client Component when it genuinely needs interactivity, state, or a
  browser API — mark that boundary explicitly and keep it as small/deep
  in the tree as possible.
- Data mutations go through Server Actions or API routes — never fetch
  Supabase directly from a Client Component.
- Route handlers (`app/api/*/route.ts`) are thin: auth check → validate
  input → call a `lib/` service function → return a response. No business
  logic inline in the route handler.
- Loading and error states use Next's `loading.tsx` / `error.tsx`
  conventions where the route structure supports it, rather than ad-hoc
  spinners scattered through page code.

## Styling

- **shadcn/ui + Tailwind, exclusively.** No inline `style={}` for anything
  that isn't a genuinely dynamic, computed value (e.g. a progress bar's
  width). No component-specific `.css`/`.module.css` files.
- All color, spacing, and radius values come from the Tailwind config /
  CSS variables defined in `ui-context.md` — never a one-off hex code or
  pixel value typed directly into a component.
- Every new UI element is built from an existing shadcn primitive first;
  only build a custom component when no shadcn primitive fits, and then
  compose it from shadcn primitives rather than raw HTML where possible.
- Dark mode is supported from day one via the same CSS variables — a
  component is not "done" if it only looks right in light mode.

## API Routes

- Consistent response envelope: `{ success: boolean, data?: T, error?: string }`.
- Auth check is the first thing in every handler; if it belongs to a
  specific candidate, verify the Clerk user id owns the row before
  reading/writing it.
- Input validated with Zod before touching the database; return a 400
  with a clear message on failure, not a raw stack trace.
- No raw SQL strings inside route handlers — use the typed Supabase client
  wrapper (see Data and Storage below) or a migration file.

## Data and Storage

- One typed Supabase client wrapper (`lib/supabase/`), used everywhere —
  no route or component creates its own client instance ad hoc.
- Database columns are `snake_case`; the API/TypeScript boundary is
  `camelCase`. The mapping happens in one place (the service layer), not
  scattered per call site.
- All schema changes go through a migration file, never a manual change
  applied only in the Supabase dashboard.
- **Never** run a destructive operation (`DELETE`, `TRUNCATE`, `DROP`, or
  any bulk row removal) without explicit, per-instance confirmation from
  the user first — this applies even during testing/debugging.
- The Supabase service-role key never leaves server-side code — not in a
  client bundle, not logged, not returned in an API response.

## File Organization

```
app/                     # Next.js App Router routes + layouts
  (marketing)/            # public pages
  (auth)/                 # sign-in/sign-up (Clerk)
  (dashboard)/            # authenticated app: jobs, profile, resume, applications
  api/                     # route handlers
components/
  ui/                      # shadcn-generated primitives — do not hand-edit generated internals
  <feature>/               # feature-specific composed components (JobCard, QueueDrawer, etc.)
lib/
  supabase/                # typed client + query/service functions
  gemini/                  # Gemini API wrapper (scoring, screening answers)
  clerk/                   # auth helpers
  jobs/                    # matching/scoring logic shared between app and scripts
  types/                   # shared TypeScript types
engine/                   # Python automation engine (evolved from engine.py)
scripts/                  # standalone Python scripts (ingestion, maintenance)
extension/                # Chrome extension, separate build
context/                  # the six planning/context docs (this folder)
specs/                    # one file per unit of work — written before its code,
                           # numbered in build order (e.g. 001-job-pool-schema.md);
                           # see ai-workflow-rules.md for required spec shape
```

- A file's location should make its role obvious without opening it.
- Nothing in `components/ui/` is hand-written from scratch — it's
  generated by the shadcn CLI and only customized where the CLI supports
  customization (theme tokens), to keep upgrades painless.
