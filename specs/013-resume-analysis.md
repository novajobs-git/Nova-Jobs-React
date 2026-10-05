# 013 Resume analysis

**Status:** Done (2026-10-05). Numbered after 012 (Auto-Apply engine, on hold).

## Goal

Score a resume for how well ATS software reads it and how strong its content is, with fixes that quote the candidate's own text.

## Scope

In:
- `/resume-analysis` (sidebar "Resume Analysis"): upload (drag and drop or browse; PDF or .docx, max 5 MB) or "Analyze this one" for the resume on file. Client-side file errors show as sonner toasts.
- Scanning state: five stages (Reading the file, Finding sections, Checking spelling and grammar, Measuring impact in your bullets, Scoring), about 6s each. Each stage reveals its real finding from the analysis. The client controls the pacing; a slow server holds the current stage. Cancel always works; "Show results" appears after the candidate's first full analysis (localStorage).
- Results: overall score (count-up), summary line from the weakest category, "Fix in Resume Builder" and "Analyze another". Three category panels with a Progress meter colored by band, a band word, a Tooltip explanation, and findings (first 3 shown, the rest in an Accordion).
- `POST /api/resume/analyze`, synchronous: multipart `resume` or JSON `{ "source": "stored" }` → `{ success, data: Analysis }` or 4xx `{ success: false, error }`. Nothing is stored.

## Scoring (`lib/resume/analyze.ts`)

- Text: PDF via unpdf (`pdfToText`), DOCX via mammoth. Sections via the Resume Builder's parser (`lib/resume/seed.ts`, now also reading Title Case headings and Skills).
- **Resume Parsed:** weighted checks (full name 10, email 10, phone 10, Experience 20, dated roles 15, Education 15, skills 15, summary 5).
- **Spelling & Grammar:** nspell + dictionary-en, extended with the skills dictionary and common tech/resume words; lowercase words only (capitalized words are mostly proper names). Also repeated words, stray punctuation, first person in bullets, present tense on ended roles. 100 minus 4 per spelling issue, 3 per other.
- **Quantifiable Impact:** % of experience and project bullets with a number, %, $, or count word; null when there are no bullets.
- **Overall:** 30% parsed, 30% grammar, 40% impact (50/50 without bullets). Bands: Strong >= 75, Fair 50-74, Needs work < 50.

## Acceptance criteria

- [x] Upload, stored-resume, wrong-type and too-large paths each work or fail with a specific reason.
- [x] Every stage finding and every result finding comes from the analysis of the candidate's file.
- [x] Results never change the profile, the stored resume or job matching.
- [x] Reduced motion stops the spinner, sweep, slide-ins and count-up; pacing stays.

## Open questions

- Score weights are defaults pending the user's call. Bands and colors set by the user: 75-100 green (Strong), 50-74 yellow (Fair, `--score-fair`), 0-49 red (Needs work).
- "Fix in Resume Builder" opens the builder at the top, not at the weakest section.
