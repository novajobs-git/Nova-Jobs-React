# 012 Auto-Apply engine

**Status:** Built (2026-10-05); live runs to be tested by the user.

## Goal

Run the candidate's job applications through the ported engine.py, one at a time, controlled from the app.

## Scope

- `engine/apply.py`: engine.py v11's form filling, answer cache + Gemini, EEO rule and submit detection, ported unchanged. Browser: a Hyperbrowser session (`HYPERBROWSER_API_KEY`) with stealth and CAPTCHA solving OFF, or local Chromium without a key. CAPTCHAs are solved by the candidate in the session's live view (`liveUrl`); otherwise the job goes to Needs review. No NopeCHA.
- `engine/worker.py`: started by the app when Auto-Apply turns on; one job at a time; exits after the current job when turned off; heartbeat in `data/engine/status.json`; `DAILY_LIMIT` (default 40); queues best matches when "Apply to matches automatically" is on.
- Shared store `data/applications/candidate.json`, changed by app and engine only under `candidate.lock` (`engine/store.py`, `lib/applications/store.ts`).
- Pause / resume / cancel (`POST /api/applications/control`): queued and paused jobs change at once; the job being applied to gets a `control` request the engine honors at its next step. Pause keeps the job's place; cancel removes it so it can be applied to again.
- App: Apply → `POST /api/applications`; the Auto-Apply toggle and Settings → `PUT /api/engine`; the provider polls `GET /api/applications` every 3s while the engine runs.
- **Per candidate, not app-wide:** settings (`enabled`, `autoApplyMatches`, `autoSubmit`, all off by default) live in `data/engine/settings/<id>.json`; status, spawn record and log in `data/engine/{status,spawn,logs}/<id>`; applications in `data/applications/<id>.json`. The app starts one worker per candidate (`engine.worker --candidate <id>`). The id comes from `lib/candidate.ts` (`"candidate"` until Clerk).
- "Submit applications automatically" (Settings, per candidate) replaces the old `AUTO_SUBMIT` env var: off, the engine fills the form and waits for the candidate to submit in the live view.
- Env (app-wide): `HYPERBROWSER_API_KEY`, `GEMINI_API_KEY`, optional `CAPTCHA_WAIT_S`, `DAILY_LIMIT`.

## Open questions

- Retry/dismiss actions on failed and needs-review applications aren't wired yet.
