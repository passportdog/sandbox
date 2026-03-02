-- Sandbox.fun Phase 1 Schema
-- Run in Supabase SQL Editor for project xdwlomnypsoddgiicsdt

create table if not exists workflow_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  category text,
  workflow_json jsonb not null,
  required_models text[] default '{}',
  required_node_packs text[] default '{}',
  param_schema jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists models_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null,
  source_id text,
  download_url text,
  target_folder text not null,
  filename text not null,
  sha256 text,
  size_bytes bigint,
  format text default 'safetensors',
  virus_scan_status text,
  pickle_scan_status text,
  is_cached boolean default false,
  cached_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists pod_instances (
  id uuid primary key default gen_random_uuid(),
  runpod_pod_id text not null unique,
  template_name text,
  gpu_type text,
  status text not null default 'creating',
  ip_address text,
  comfyui_port integer default 8188,
  comfyui_url text,
  volume_id text,
  cost_per_hour numeric,
  last_used_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  input_text text,
  plan jsonb,
  template_id uuid references workflow_templates(id),
  params jsonb default '{}',
  pod_instance_id uuid references pod_instances(id),
  prompt_id text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  gpu_seconds integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  event_type text not null,
  event_data jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  file_type text default 'image',
  storage_path text,
  public_url text,
  filename text,
  width integer,
  height integer,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists config (
  key text primary key,
  value text not null,
  is_secret boolean default false,
  description text,
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_jobs_created on jobs(created_at desc);
create index if not exists idx_job_events_job_id on job_events(job_id);
create index if not exists idx_job_events_created on job_events(created_at desc);
create index if not exists idx_outputs_job_id on outputs(job_id);
create index if not exists idx_pod_instances_status on pod_instances(status);

-- RLS with open policies (single user, service key for V1)
alter table workflow_templates enable row level security;
alter table models_registry enable row level security;
alter table pod_instances enable row level security;
alter table jobs enable row level security;
alter table job_events enable row level security;
alter table outputs enable row level security;
alter table config enable row level security;

create policy "allow_all" on workflow_templates for all using (true) with check (true);
create policy "allow_all" on models_registry for all using (true) with check (true);
create policy "allow_all" on pod_instances for all using (true) with check (true);
create policy "allow_all" on jobs for all using (true) with check (true);
create policy "allow_all" on job_events for all using (true) with check (true);
create policy "allow_all" on outputs for all using (true) with check (true);
create policy "allow_all" on config for all using (true) with check (true);

-- Enable realtime on jobs and job_events
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table job_events;
alter publication supabase_realtime add table pod_instances;

-- Seed a basic txt2img template
insert into workflow_templates (name, slug, description, category, workflow_json, required_models, param_schema)
values (
  'SDXL Text to Image',
  'txt2img_sdxl',
  'Basic SDXL text-to-image generation',
  'txt2img',
  '{
    "6": {
      "inputs": { "text": "beautiful landscape, masterpiece", "clip": ["11", 0] },
      "class_type": "CLIPTextEncode"
    },
    "7": {
      "inputs": { "text": "ugly, blurry, low quality", "clip": ["11", 0] },
      "class_type": "CLIPTextEncode"
    },
    "3": {
      "inputs": {
        "seed": 42,
        "steps": 25,
        "cfg": 7.0,
        "sampler_name": "euler_ancestral",
        "scheduler": "normal",
        "denoise": 1.0,
        "model": ["11", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    "5": {
      "inputs": { "width": 1024, "height": 1024, "batch_size": 1 },
      "class_type": "EmptyLatentImage"
    },
    "8": {
      "inputs": { "samples": ["3", 0], "vae": ["11", 2] },
      "class_type": "VAEDecode"
    },
    "9": {
      "inputs": { "filename_prefix": "sandbox", "images": ["8", 0] },
      "class_type": "SaveImage"
    },
    "11": {
      "inputs": { "ckpt_name": "sd_xl_base_1.0.safetensors" },
      "class_type": "CheckpointLoaderSimple"
    }
  }'::jsonb,
  ARRAY['sd_xl_base_1.0.safetensors'],
  '{
    "prompt": { "node": "6", "field": "inputs.text", "type": "string" },
    "negative_prompt": { "node": "7", "field": "inputs.text", "type": "string" },
    "seed": { "node": "3", "field": "inputs.seed", "type": "integer" },
    "steps": { "node": "3", "field": "inputs.steps", "type": "integer", "min": 1, "max": 100 },
    "cfg": { "node": "3", "field": "inputs.cfg", "type": "number", "min": 1, "max": 30 },
    "width": { "node": "5", "field": "inputs.width", "type": "integer" },
    "height": { "node": "5", "field": "inputs.height", "type": "integer" },
    "checkpoint": { "node": "11", "field": "inputs.ckpt_name", "type": "string" }
  }'::jsonb
);
