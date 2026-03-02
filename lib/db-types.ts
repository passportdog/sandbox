import type { JobStatus } from "@/lib/engine";

// ─── Database row types (matches Supabase schema after phase2_reliability migration) ───

export interface DbJob {
  id: string;
  status: JobStatus;
  input_text: string | null;
  plan: Record<string, unknown> | null;
  plan_version: number;
  template_id: string | null;
  params: Record<string, unknown> | null;
  pod_instance_id: string | null;
  prompt_id: string | null;
  error: string | null;
  last_error: string | null;
  attempt: number;
  retryable: boolean;
  idempotency_key: string | null;
  started_at: string | null;
  completed_at: string | null;
  gpu_seconds: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  workflow_templates?: { name: string; slug: string; category: string } | null;
  pod_instances?: { status: string; gpu_type: string; comfyui_url: string } | null;
  events?: DbJobEvent[];
  outputs?: DbOutput[];
}

export interface DbJobEvent {
  id: string;
  job_id: string;
  event_type: string;
  step: string | null;
  event_data: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

export interface DbOutput {
  id: string;
  job_id: string;
  file_type: string;
  storage_path: string | null;
  public_url: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbPodInstance {
  id: string;
  runpod_pod_id: string;
  template_name: string | null;
  gpu_type: string | null;
  status: string;
  ip_address: string | null;
  comfyui_port: number;
  comfyui_url: string | null;
  volume_id: string | null;
  cost_per_hour: number | null;
  last_used_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  required_models: string[];
  required_node_packs: string[];
  param_schema: Record<string, unknown> | null;
  is_active: boolean;
}

// ─── Status display config ───

export const JOB_STATUS_CONFIG: Record<string, { color: string; label: string; phase?: string }> = {
  created:         { color: "bg-neutral-400",  label: "Created",         phase: "init" },
  planned:         { color: "bg-indigo-400",   label: "Planned",         phase: "plan" },
  queued:          { color: "bg-blue-400",     label: "Queued",          phase: "queue" },
  running:         { color: "bg-amber-400",    label: "Running",         phase: "run" },
  uploading:       { color: "bg-cyan-400",     label: "Uploading",       phase: "upload" },
  completed:       { color: "bg-emerald-500",  label: "Completed",       phase: "done" },
  failed_planning: { color: "bg-red-400",      label: "Plan Failed",     phase: "plan" },
  failed_queue:    { color: "bg-red-400",      label: "Queue Failed",    phase: "queue" },
  failed_runtime:  { color: "bg-red-400",      label: "Runtime Failed",  phase: "run" },
  failed_upload:   { color: "bg-red-400",      label: "Upload Failed",   phase: "upload" },
  canceled:        { color: "bg-neutral-300",  label: "Canceled",        phase: "done" },
};

export const POD_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  creating:       { color: "bg-yellow-400 animate-pulse", label: "Starting..." },
  running:        { color: "bg-blue-400", label: "Running" },
  bootstrapping:  { color: "bg-orange-400 animate-pulse", label: "Bootstrapping..." },
  ready:          { color: "bg-emerald-400", label: "Ready" },
  stopping:       { color: "bg-yellow-400", label: "Stopping..." },
  stopped:        { color: "bg-neutral-400", label: "Stopped" },
  terminated:     { color: "bg-red-400", label: "Terminated" },
  error:          { color: "bg-red-500", label: "Error" },
};

// ─── Step timeline helpers ───

export const STEP_DISPLAY: Record<string, { icon: string; label: string }> = {
  "plan.started":       { icon: "solar:routing-linear",        label: "Planning started" },
  "plan.completed":     { icon: "solar:check-circle-linear",   label: "Plan ready" },
  "plan.failed":        { icon: "solar:close-circle-linear",   label: "Planning failed" },
  "pod.assigned":       { icon: "solar:cpu-bolt-linear",       label: "Pod assigned" },
  "pod.health_ok":      { icon: "solar:shield-check-linear",   label: "Pod healthy" },
  "pod.health_fail":    { icon: "solar:shield-warning-linear", label: "Pod unhealthy" },
  "workflow.patched":   { icon: "solar:code-square-linear",    label: "Workflow patched" },
  "comfyui.queued":     { icon: "solar:queue-linear",          label: "Prompt queued" },
  "comfyui.progress":   { icon: "solar:loading-linear",        label: "Generating" },
  "comfyui.completed":  { icon: "solar:check-circle-linear",   label: "Generation done" },
  "runtime.failed":     { icon: "solar:close-circle-linear",   label: "Runtime error" },
  "runtime.timeout":    { icon: "solar:clock-circle-linear",   label: "Timed out" },
  "artifact.saving":    { icon: "solar:upload-linear",         label: "Saving outputs" },
  "artifact.saved":     { icon: "solar:gallery-check-linear",  label: "Output saved" },
  "upload.failed":      { icon: "solar:close-circle-linear",   label: "Upload failed" },
  "job.completed":      { icon: "solar:verified-check-linear", label: "Job completed" },
  "job.canceled":       { icon: "solar:stop-circle-linear",    label: "Job canceled" },
  "job.retry":          { icon: "solar:refresh-circle-linear", label: "Retrying" },
  "queue.failed":       { icon: "solar:close-circle-linear",   label: "Queue failed" },
};

/** Is this status an active/in-progress state? */
export function isActive(status: string): boolean {
  return ["created", "planned", "queued", "running", "uploading"].includes(status);
}

/** Is this status a failure state? */
export function isFailed(status: string): boolean {
  return status.startsWith("failed_");
}

/** Is this status terminal (no more transitions possible)? */
export function isTerminal(status: string): boolean {
  return status === "completed" || status === "canceled";
}
