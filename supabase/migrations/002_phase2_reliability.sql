-- Phase 2: Reliability & Retry Schema
-- Run in Supabase SQL Editor after 001_initial_schema.sql

-- ─── New columns on jobs ───

alter table jobs
  add column if not exists attempt        integer not null default 1,
  add column if not exists plan_version   integer not null default 0,
  add column if not exists last_error     text,
  add column if not exists retryable      boolean not null default false,
  add column if not exists idempotency_key text unique;

-- Phase 2 expands the status set:
--   created → planned → queued → running → uploading → completed
--   failed_planning | failed_queue | failed_runtime | failed_upload | canceled
-- Drop old check constraint (if any) and add the new one.

alter table jobs drop constraint if exists jobs_status_check;

alter table jobs add constraint jobs_status_check check (status in (
  'created',
  'planned',
  'queued',
  'running',
  'uploading',
  'completed',
  'failed_planning',
  'failed_queue',
  'failed_runtime',
  'failed_upload',
  'canceled',
  -- Legacy values kept for backwards compatibility during rollout
  'pending',
  'planning',
  'planned',
  'approved',
  'provisioning',
  'bootstrapping',
  'executing',
  'failed',
  'cancelled'
));

-- ─── New columns on job_events ───

alter table job_events
  add column if not exists step        text,
  add column if not exists duration_ms integer;

-- ─── Indexes ───

create index if not exists jobs_idempotency_key_idx on jobs (idempotency_key) where idempotency_key is not null;
create index if not exists jobs_status_attempt_idx  on jobs (status, attempt);
create index if not exists job_events_step_idx      on job_events (step);
