# 005 — Onboarding flow + candidate profile (local storage)

**Status:** Done (2026-10-02)

## Goal

Collect, once, everything the job matcher and the auto-apply engine
(`engine.py`) need: the resume (stored, with its skills/keywords
extracted), personal details, job preferences, and the three US job-search
questions: work authorization, sponsorship and EEO. It should be short and
calm, with one topic per step and a progress bar.

## Steps

1. **Resume.** Upload a PDF. It is stored, its text extracted, and its
   skills/keywords detected. Contact details found in it pre-fill step 2.
2. **About you.** First name, last name, email, phone, city and state.
3. **Links.** LinkedIn, GitHub, portfolio (all optional).
4. **What you're looking for.** Target job titles, preferred locations,
   work modes (Remote/Hybrid/On-site), years of experience, current or
   most recent title, desired salary, earliest start date.
5. **Skills.** The skills/keywords found in the resume, as chips the
   candidate can remove or add to. These drive job matching (spec 006).
6. **"Are you authorized to work in the United States?"** Yes / No.
7. **"Will you now or in the future require visa sponsorship?"** Yes / No.
8. **Voluntary self-identification (EEO).** Gender, race/ethnicity,
   veteran status, disability status. Each offers a decline option, and
   "decline" is the default.
9. **Review.** A summary of every answer with an Edit link per section,
   then Finish → `/jobs`.

The dashboard redirects to `/onboarding` until a profile exists.

## Data contract with the engine

The profile is stored in the shape `engine.py` reads (`profiles` columns,
snake_case): `full_name, email, phone, location, linkedin_url, github_url,
portfolio_url, job_title, years_experience, desired_salary,
earliest_start_date, work_authorization, needs_sponsorship,
veteran_status, disability_status, gender, race_ethnicity,
target_job_title[], target_locations[], work_modes[], resume_pdf,
resume_skills[], resume_keywords[]`.

EEO and authorization values are stored as the **start of the common
ATS option wording** ("Yes", "No", "I am not a protected veteran", "I
don't wish to answer", "Decline to self-identify"). That is what the
engine's `_fuzzy_match_choice` matches, by prefix or word, against real
form options. These answers are only ever the candidate's own; the engine
never infers them (architecture invariant).

Storage, until Supabase (spec 007):
- `data/resumes/<id>.pdf`
- `data/profiles/candidate.json` (single demo candidate until Clerk)

API (envelope `{ success, data?, error? }`, Zod-validated):
- `POST /api/resume`: multipart PDF (≤ 5 MB) → stores it, returns
  `{ resumeId, fileName, skills, keywords, contact }`.
- `POST /api/profile`: the full onboarding payload → writes the profile.

## Acceptance criteria

- [x] 9 steps with a progress bar; Back keeps answers; Continue validates only the current step.
- [x] Resume upload stores the PDF and pre-fills name/email/phone/links when found.
- [x] Extracted skills are shown and editable before saving.
- [x] All three US questions are required; EEO defaults to "decline", never blank.
- [x] The saved profile has every field `engine._build_field_map` reads.
- [x] With no profile, `/jobs` redirects to `/onboarding`; after Finish, `/jobs` loads.
- [x] Matches the dashboard's visual system (tokens, Plus Jakarta Sans, 16px panels, blue primary).

## Open questions

- Accounts/auth (Clerk) and multi-candidate storage arrive with spec 008.
