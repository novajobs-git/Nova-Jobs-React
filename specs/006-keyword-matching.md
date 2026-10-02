# 006 — Resume keyword matching

**Status:** Done (2026-10-02)

## Goal

Rank jobs by how many of the job's skills/keywords appear in the
candidate's resume. Show a job only when at least 30% of its keywords
match.

## Rule (as specified by the user)

- **Candidate keywords** = the skills/keywords from the resume, as
  reviewed in onboarding step 5 (`resume_skills`).
- **Job keywords** = the skills/keywords found in the job's title +
  description, using the same skills dictionary.
- **Score** = matched job keywords ÷ job keywords, as a %. It is shown
  with the counts ("7 of 12 skills") and the matched skills themselves.
- **Shown** when score ≥ 30% **and** at least 2 keywords match. The
  2-match floor stops a job with a single recognised keyword from scoring
  100% on one coincidence.
- Generic soft skills ("communication", "teamwork") are recognised but
  never scored, because almost every posting and resume contains them.

## Scope

In:
- `lib/matching/skills.ts`: one skills dictionary (~400 terms across
  engineering, data, design, product, marketing, sales, finance, ops and
  healthcare) with aliases ("JS" → JavaScript, "k8s" → Kubernetes).
- `lib/matching/extract.ts`: `extractKeywords(text)`, used for both
  resumes (spec 005) and jobs.
- `lib/matching/score.ts`: `scoreJob(candidateKeywords, jobKeywords)`.
- `scripts/enrich_descriptions.py`: fetches each pooled job's
  description in the Playwright browser context (JSON-LD `JobPosting` →
  ATS-specific JSON → page text) and stores `description` on the record.
  Jobs are matched on title + description; a job without a description
  is matched on its title alone.
- The Jobs page uses this score; cards and rows show the match %, and
  cards list the matched skills.
- Replaces the title-only TF-IDF port from spec 004
  (`lib/jobs/matching.ts`, removed).

Out:
- Semantic/embedding matching; weighting skills by importance.

## Acceptance criteria

- [x] Same dictionary and extraction for resumes and jobs.
- [x] No job under 30% or with fewer than 2 matched keywords is shown.
- [x] Cards show "N of M skills" and the matched skills.
- [x] The description enricher runs across all 5 ATSs and is resumable (skips jobs that already have a description).
