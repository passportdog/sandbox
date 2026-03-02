-- Phase 3: Extended Models Registry + Workflow Templates
-- Run in Supabase SQL Editor after 002_phase2_reliability.sql

-- ─── New columns on models_registry ───

alter table models_registry
  add column if not exists base_model         text,
  add column if not exists model_type         text,
  add column if not exists preview_url        text,
  add column if not exists download_status    text not null default 'pending',
  add column if not exists download_error     text,
  add column if not exists civitai_model_id   integer,
  add column if not exists civitai_version_id integer;

-- ─── New columns on workflow_templates ───

alter table workflow_templates
  add column if not exists raw_workflow  jsonb,
  add column if not exists source       text,
  add column if not exists source_url   text;

-- ─── Indexes ───

create index if not exists models_registry_source_id_idx on models_registry (source_id);
create index if not exists models_registry_filename_idx  on models_registry (filename);
create index if not exists models_registry_download_status_idx on models_registry (download_status);
create index if not exists models_registry_civitai_model_id_idx on models_registry (civitai_model_id) where civitai_model_id is not null;

-- ─── Enable realtime for models_registry ───
-- (jobs, job_events, pod_instances should already be enabled from 001)

alter publication supabase_realtime add table models_registry;
