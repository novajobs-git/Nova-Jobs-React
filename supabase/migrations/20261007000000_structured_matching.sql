-- Spec 014: structured matching. Additive only: the database is shared with
-- the old app, so nothing existing is altered or dropped.
begin;

-- pgvector, in Supabase's extensions schema (approved by the user 2026-10-07).
create extension if not exists vector with schema extensions;

-- Requirements extracted once per job at ingestion (scripts/extract_requirements.py).
alter table public.jobs
  add column if not exists seniority_level       text check (seniority_level in ('new_grad','entry','mid','senior','staff','vp')),
  add column if not exists min_years_experience  smallint check (min_years_experience between 0 and 20),
  add column if not exists degree_required       text check (degree_required in ('none','bachelor','master','phd')),
  add column if not exists degree_preferred      text check (degree_preferred in ('none','bachelor','master','phd')),
  add column if not exists salary_min            integer,
  add column if not exists salary_max            integer,
  add column if not exists requirements_source   text check (requirements_source in ('title','regex','llm','default')),
  add column if not exists requirements_version  smallint,
  add column if not exists title_normalized      text,
  -- gemini-embedding-001, 768 dims, L2-normalized (scripts/embed_titles.py)
  add column if not exists title_embedding       extensions.vector(768);

create index if not exists jobs_seniority_level_idx on public.jobs (seniority_level);

-- Candidate fields matching reads (onboarding / My Details).
alter table public.profiles
  add column if not exists highest_degree             text,
  add column if not exists target_level               text,
  add column if not exists years_experience_computed  numeric(4,1),
  -- { normalized target title: base64 float32 vector }, recomputed only when titles change
  add column if not exists target_title_embeddings    jsonb;

-- Why a match needed relaxed filters (spec 014 pool-starvation fallback).
alter table public.job_matches
  add column if not exists relaxed_by  text[] not null default '{}';

commit;
