-- NovaJobs (new app) on the existing live database (spec 007).
-- ADDITIVE ONLY: the old Flask app shares these tables and must keep working.
-- No renames, no dropped columns, no changed types, no data rewritten.
-- Reused as-is: users, profiles, jobs, job_matches, qa_cache, storage bucket "resumes".
-- Left to the old app: job_queue, engine_runs, applications, scraped_urls.

begin;

-- Profiles: fields the new onboarding collects that the old table lacks.
alter table public.profiles
  add column if not exists portfolio_url        text,
  add column if not exists earliest_start_date  text,
  add column if not exists resume_text          text,
  -- Per-candidate: the engine clicks Submit itself. Off = candidate submits in the live view.
  add column if not exists auto_submit          boolean not null default false;

-- Jobs: freshness ranking (spec 015), logos (spec 011), ingest bookkeeping.
alter table public.jobs
  add column if not exists posted_at            timestamptz,
  add column if not exists board_slug           text,
  add column if not exists company_logo         text,
  add column if not exists company_logo_source  text,
  -- Tech family the scraper filed it under: software, ai_ml, data, product_project, devops_cloud, security, qa.
  add column if not exists job_family           text;

create index if not exists idx_jobs_status_posted     on public.jobs (status, posted_at desc nulls last);
create index if not exists idx_jobs_status_first_seen on public.jobs (status, first_seen_at desc);
create index if not exists idx_jobs_board             on public.jobs (source_ats, board_slug);

-- Matches: show which skills matched (spec 006).
alter table public.job_matches
  add column if not exists matched_skills  text[] not null default '{}',
  add column if not exists skill_total     integer;

-- One row per Apply click (spec 014). Job details are snapshotted so a run
-- outlives its posting being expired or removed from the pool.
create table if not exists public.application_runs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  bigint not null references public.users (id) on delete cascade,
  job_id                   bigint references public.jobs (id) on delete set null,
  company                  text not null,
  title                    text not null,
  location                 text not null default '',
  url                      text not null,
  ats                      text not null,
  company_logo             text,
  match_score              real,
  status                   text not null default 'queued' check (status in (
                             'queued', 'running', 'awaiting_captcha', 'awaiting_submit', 'paused',
                             'applied', 'needs_review', 'failed', 'cancelled')),
  reason                   text,
  adapter                  text,
  auto_submit              boolean not null default false,
  control                  text check (control in ('pause', 'cancel')),
  live_url                 text,
  hyperbrowser_session_id  text,
  queued_at                timestamptz not null default now(),
  started_at               timestamptz,
  finished_at              timestamptz,
  updated_at               timestamptz not null default now()
);

create index if not exists idx_application_runs_user_queued on public.application_runs (user_id, queued_at desc);
create index if not exists idx_application_runs_user_status on public.application_runs (user_id, status);
-- One application in flight per candidate (architecture.md invariant).
create unique index if not exists application_runs_one_in_flight
  on public.application_runs (user_id)
  where status in ('running', 'awaiting_captcha', 'awaiting_submit');

-- Live progress of a run. The engine also broadcasts each event on the
-- Realtime channel run:<run_id> (spec 007, until Clerk JWT RLS exists).
create table if not exists public.application_events (
  id       bigint generated always as identity primary key,
  run_id   uuid not null references public.application_runs (id) on delete cascade,
  at       timestamptz not null default now(),
  kind     text not null check (kind in ('status', 'step', 'field', 'question', 'captcha', 'live_view', 'submitted', 'review_flag', 'error')),
  message  text not null,
  data     jsonb not null default '{}'
);

create index if not exists idx_application_events_run on public.application_events (run_id, id);

-- RLS on, no policies: only the service role (app server + engine) reads or writes.
alter table public.application_runs   enable row level security;
alter table public.application_events enable row level security;

-- Company logos are public brand images, served straight from Storage.
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

commit;
