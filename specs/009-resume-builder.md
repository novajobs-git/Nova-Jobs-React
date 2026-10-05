# 009 Resume Builder

Status: done (UI + local storage). Numbered 009 because 007/008 are reserved for the Supabase schema and wiring.

## Goal

Let a candidate edit their resume section by section next to a live document preview, and save it so job matching uses the skills they confirm.

## Scope

In:
- `/resume` inside the dashboard shell; the sidebar "Resume Builder" entry links to it.
- Two panels: live US Letter preview (left), section editor (right). Below `lg`, an Edit / Preview switch.
- Sections (Radix Accordion, single-open): Contact, Summary, Experience, Education, Skills, Projects. Experience, Education and Projects entries can be added, removed and reordered.
- Tiptap rich text for Summary, Experience, Education details and Projects: bold, italic, bullet and numbered lists, link, undo, redo.
- Link insertion in a Popover (Dialog under 768px).
- Three single-column, ATS-safe templates switched with Tabs: Classic, Compact, Modern.
- First open is seeded from the profile plus the uploaded resume's text (headings, dated entry lines, bullets).
- "Write with AI" for Summary, Experience entries, Projects entries and Skills: suggest, then Accept / Accept and edit / Discard. Mocked until Gemini is wired, and labeled as a placeholder.
- Save (sonner toast) writes the document and replaces the profile's `resume_skills`, so job matches update.
- Export PDF via the browser print dialog with a print stylesheet.

Out: real Gemini calls, server-side PDF rendering, section reordering, replacing the uploaded PDF used on applications, Supabase.

## Interface

- `lib/resume/types.ts`: `ResumeDoc` (Zod `resumeDocSchema`), rich text stored as Tiptap JSON (`RichNode`), never HTML.
- `lib/resume/store.ts`: `getBuiltResume(profile)` returns the saved document or a seed; `saveBuiltResume(doc)`. File: `data/resume/candidate.json`.
- `lib/profile/store.ts`: `updateResumeSkills(skills)`.
- `PUT /api/resume/builder` body `ResumeDoc` → `{ success, data: { updatedAt } }`.
- `POST /api/resume/suggest` body `{ kind: "summary" | "entry" | "skills", doc?, skills? }` → `{ success, data: { placeholder: true, doc? , skills? } }`.

## Acceptance criteria

- Opening `/resume` after onboarding shows the seeded resume with a "Pre-filled from your uploaded resume" note.
- Every edit shows in the preview immediately; the open section is outlined in the preview, and clicking a preview section opens it.
- Switching templates restyles the preview without losing content.
- AI suggestions never change the document until accepted; they never invent facts (they rewrite the candidate's own notes or use stored profile data) and never touch Contact or Education.
- Save shows "Resume saved" and the Jobs page re-scores against the saved skills. Failures show the real reason.
- Leaving with unsaved changes asks for confirmation.
- Export opens the print dialog showing only the resume page.
- Light and dark mode; reduced motion disables the accordion and highlight animations.

## Open questions

- Should the built resume replace the uploaded PDF sent with applications?
- Should candidates reorder sections?
