# 014 — Structured matching: hard filters + soft ranking

**Status:** Built 2026-10-07. Migration applied. The pool is extracted (2,754 jobs: rules 2,432, Gemini 157, default Mid 165) and its titles embedded (2,052). The demo candidate now gets 237 matches (was 1,982), with no Staff or VP roles. The fallback path is untested because the pool never ran short. Decisions confirmed by the user 2026-10-07. Replaces the ranking in spec 011 (0.7 × skills + 0.3 × freshness) and the 30% skills floor in spec 006.

## Goal

Stop showing candidates jobs above their level, jobs that require a degree they don't have, and jobs outside their target role. Matching becomes two stages: hard filters remove jobs outright, then a weighted score ranks what's left. Anything expensive (requirement extraction, embeddings) is computed once per job or once per profile change and cached, so matching itself stays cheap.

## Scope

1. **Requirement extraction, once per job at ingestion** (`scripts/extract_requirements.py`, rules in `scripts/ats/requirements.py`). Each pass runs only if the previous one found nothing:
   - a. Title keywords → seniority level.
   - b. Description regex → minimum years required, degree required/preferred, salary range. If the title had no level, the years decide it.
   - c. Gemini (`gemini-flash-lite-latest`, via `engine/gemini.py`) only when both level and years are still unknown. A missing degree is a normal answer ("none") and never triggers a call.
   - The result is stored on the job with `requirementsSource` (`title` | `regex` | `llm` | `default`) and `requirementsVersion`. Jobs already at the current version are skipped.
2. **Title embeddings, once per normalized title** (`scripts/embed_titles.py`): `gemini-embedding-001`, 768 dimensions, task `SEMANTIC_SIMILARITY`, L2-normalized. Level words, roman numerals, parentheses and location words are stripped before embedding ("Senior AI Engineer (Remote)" → "ai engineer"). Cached by normalized title, so a title is embedded again only when it changes.
3. **Candidate profile:**
   - New fields `highestDegree` and `targetLevel` (onboarding Preferences step and My Details). The degree is pre-filled from the resume; the level defaults from years of experience.
   - `years_experience_computed`: months of work from the resume's date ranges (overlaps merged, education dates ignored), clamped into the self-reported range.
   - Target-title embeddings are cached in `data/embeddings/candidate.json` and recomputed only for titles that changed.
4. **Matching** (`lib/jobs/matches.ts`, rules in `lib/matching/structured.ts`): filter, then score, then relax if too few, then spread across companies.
5. **Pool-starvation fallback** with a banner and a per-card tag.
6. **Supabase (additive):** the `vector` extension plus requirement, salary and embedding columns on `jobs`, and degree, level, computed years and title embeddings on `profiles`. Syncing data into them is spec 008.

## Seniority tiers (confirmed)

`New Grad < Entry / Junior < Mid Level < Senior < Staff < VP` (keys `new_grad`, `entry`, `mid`, `senior`, `staff`, `vp`).

| Title signal | Tier |
|---|---|
| Intern, Co-op, Apprentice, New Grad, University Grad, Graduate, Early Career, Campus | new_grad |
| Junior, Jr, Associate (not Associate Director), Entry-level, Engineer I / 1 | entry |
| Mid-level, Intermediate, Engineer II / 2 | mid |
| Senior, Sr, Lead, Tech Lead, Engineer III / 3, Engineering Manager | senior |
| Staff, Principal, Distinguished, Fellow, Senior Manager, Group Product Manager, Engineer IV-V | staff |
| Director, Head of, VP, Vice President, CTO, Chief | vp |

- When a title has several signals, the highest one wins ("Senior Staff" is staff).
- "Manager" alone is a role name, not a level ("Product Manager" has no level signal).
- With no title signal, the level comes from the required years: 0 → new_grad, 1 → entry, 2–4 → mid, 5–7 → senior, 8+ → staff.
- If Gemini also returns nothing, the level defaults to mid (source `default`).
- **Default target level from years of experience:** 0–1 New Grad, 1–3 Entry / Junior, 3–5 Mid Level, 5–8 Senior, 8–12 Staff, 12+ Staff.

## Hard filters (stage 1)

| Filter | Strict | Relaxed |
|---|---|---|
| Title similarity: the best cosine over the candidate's target titles | ≥ 0.89 | ≥ 0.87 (step 3) |
| Seniority | target − 1 … target + 1 | upper bound target + 2 (step 1) |
| Years: `minYears ≤ candidateYears + buffer` (a job that states no years always passes) | buffer 2 | buffer 4 (step 1) |
| Degree: only *required* Master's or PhD can exclude | required ≤ candidate | required ≤ candidate + 1 (step 2) |

- Degree scale: none (High school or none, Associate) < Bachelor's < Master's < PhD.
- `candidateYears` = `years_experience_computed`, or the midpoint of the self-reported range (12 for 12+).

## Soft ranking (stage 2)

```
score = 0.30·title + 0.30·skills + 0.20·freshness + 0.10·location + 0.10·salary
```

Each component is scored 0–100:

- **title:** (similarity − 0.89) / (1 − 0.89), clamped to 0–100. A job let in only by the relaxed title cutoff scores 0 here.
- **skills:** matched ÷ job keywords (the spec 006 overlap), with no floor.
- **freshness:** 100 × 0.5^(age_days / 7), age from the posting date, or from when it was first seen.
- **location:**
  - Remote job and the candidate accepts Remote → 100.
  - The job matches a target location (city, state code or state name) and its work mode is accepted → 100.
  - It matches but the mode isn't accepted → 50.
  - The candidate gave no target locations → 50.
  - Otherwise → 0.
- **salary:**
  - The job's maximum is at or above the desired salary → 100.
  - Otherwise linear down to 0 at 30% below the desired salary.
  - Unknown on either side → this weight is dropped and the other four are rescaled to add up to 1.

The card's match % is this score. The company round-robin (spec 011) runs after ranking.

## Pool-starvation fallback (stage 1b)

- If fewer than **15** jobs pass the strict filters, relax one step at a time, cumulatively, stopping once there are 15:
  1. Seniority +1 tier and years buffer +2.
  2. Education.
  3. Title cutoff.
- Every relaxed-in job carries `relaxedBy: ("level" | "degree" | "title")[]`.
- `getMatchedJobs` returns `{ jobs, relaxed }`. The Jobs page shows one banner listing the applied steps, and each relaxed card or row shows a text tag ("Above your level", "Higher degree", "Related role"), so it's never conveyed by color alone.
- Copy:
  - level: "Showing some roles a level above your experience — we didn't find enough exact matches today."
  - degree: "Including roles that ask for a higher degree than yours — we didn't find enough exact matches today."
  - title: "Including roles further from your target titles — we didn't find enough exact matches today."

## Interface

- Pool record (`data/jobs/us-jobs.json`) gains:
  - `seniorityLevel`, `minYearsExperience`, `degreeRequired`, `degreePreferred`, `salaryMin`, `salaryMax`, `requirementsSource`, `requirementsVersion`, `titleNormalized`.
  - The scraper now merges re-seen jobs into the existing record, so these fields and enriched descriptions survive a re-scrape.
- `data/jobs/title-embeddings.json`: `{ model, dims, titles: { [normalized]: base64 float32 } }`.
- `.venv\Scripts\python -m scripts.extract_requirements [--limit N] [--no-llm]`, then `.venv\Scripts\python -m scripts.embed_titles`.
- `.venv\Scripts\python -m scripts.daily_ingest` runs scrape → descriptions → requirements → embeddings. Stale marking and the scheduler stay in the ingestion spec.
- `ParsedResume` gains `highestDegree?`. `OnboardingData` gains `targetLevel` and `highestDegree` (both required; existing profiles get defaults in `profileToDraft`).
- Migration `supabase/migrations/20261007000000_structured_matching.sql`:
  - `create extension if not exists vector`.
  - `jobs` + `seniority_level`, `min_years_experience`, `degree_required`, `degree_preferred`, `salary_min`, `salary_max`, `requirements_source`, `requirements_version`, `title_normalized`, `title_embedding vector(768)`.
  - `profiles` + `highest_degree`, `target_level`, `years_experience_computed`, `target_title_embeddings jsonb`.
  - `job_matches` + `relaxed_by text[]`.

## Acceptance criteria

- For the demo candidate (Mid Level, 3–5 years, "AI Engineer"), no Staff or VP job appears unless the fallback ran, and those cards are tagged.
- Running `extract_requirements` twice calls Gemini only on the first run. Running `embed_titles` twice embeds nothing the second time.
- Opening the Jobs page makes no Gemini calls. Saving My Details with unchanged titles makes none either.
- The Gemini prompt never includes EEO or sponsorship data (only the job description is sent).

## Open questions

- The Gemini project hit its monthly spend cap on 2026-10-07. Until it's raised, new target titles can't be embedded: matching then runs without the title filter and retries on the next load. New jobs can't be embedded or LLM-extracted either.
- Some scraped titles end in " New" with a space ("Public Sector New"). The normalizer only strips a glued "New". Fix it in both normalizers with a `REQUIREMENTS_VERSION` bump once the quota allows re-embedding.

- Re-calibrate the 0.89 cutoff once candidates have more varied target titles. It was calibrated on "AI Engineer" only.
