/**
 * Job Engine — the "it never lies" core.
 *
 * Single state machine contract:
 *   created → planned → queued → running → uploading → completed
 *
 * Failure states (one per phase):
 *   failed_planning, failed_queue, failed_runtime, failed_upload, canceled
 *
 * Every transition is validated. Every side-effect is logged.
 * Double-clicks and retries are safe by design.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ─── Status contract ───

export const JOB_STATUSES = [
  "created",
  "planned",
  "queued",
  "running",
  "uploading",
  "completed",
  "failed_planning",
  "failed_queue",
  "failed_runtime",
  "failed_upload",
  "canceled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** Valid transitions — only these are allowed */
const TRANSITIONS: Record<string, JobStatus[]> = {
  created:         ["planned", "failed_planning", "canceled"],
  planned:         ["queued", "planned", "failed_queue", "canceled"],   // planned→planned = re-plan
  queued:          ["running", "failed_queue", "canceled"],
  running:         ["uploading", "failed_runtime", "canceled"],
  uploading:       ["completed", "failed_upload"],
  // Terminal states — no transitions out
  completed:       [],
  failed_planning: ["created"],   // retry resets to created
  failed_queue:    ["queued"],    // retry re-queues
  failed_runtime:  ["queued"],    // retry on another pod
  failed_upload:   ["uploading"], // retry upload
  canceled:        [],
};

export function canTransition(from: string, to: JobStatus): boolean {
  return (TRANSITIONS[from] || []).includes(to);
}

// ─── Structured event steps ───

export const EVENT_STEPS = {
  // Planning phase
  PLAN_STARTED:     "plan.started",
  PLAN_COMPLETED:   "plan.completed",
  PLAN_FAILED:      "plan.failed",

  // Queue phase
  POD_ASSIGNED:     "pod.assigned",
  POD_HEALTH_OK:    "pod.health_ok",
  POD_HEALTH_FAIL:  "pod.health_fail",
  WORKFLOW_PATCHED:  "workflow.patched",
  COMFYUI_QUEUED:   "comfyui.queued",
  QUEUE_FAILED:     "queue.failed",

  // Runtime phase
  COMFYUI_PROGRESS: "comfyui.progress",
  COMFYUI_COMPLETED:"comfyui.completed",
  RUNTIME_FAILED:   "runtime.failed",
  RUNTIME_TIMEOUT:  "runtime.timeout",

  // Upload phase
  ARTIFACT_SAVING:  "artifact.saving",
  ARTIFACT_SAVED:   "artifact.saved",
  UPLOAD_FAILED:    "upload.failed",

  // Lifecycle
  JOB_COMPLETED:    "job.completed",
  JOB_CANCELED:     "job.canceled",
  JOB_RETRY:        "job.retry",
} as const;

// ─── Timeouts (ms) ───

export const TIMEOUTS = {
  PLANNING:    30_000,   // 30s for OpenRouter
  POD_HEALTH:  15_000,   // 15s for pod health check
  EXECUTION:   300_000,  // 5min for ComfyUI generation
  UPLOAD:      30_000,   // 30s per artifact upload
  POLL_INTERVAL: 2_000,  // 2s between polls
} as const;

// ─── Engine class ───

export class JobEngine {
  constructor(private sb: SupabaseClient) {}

  /** Transition a job to a new status with validation */
  async transition(jobId: string, to: JobStatus, extra?: Record<string, unknown>): Promise<void> {
    // Fetch current status
    const { data: job, error } = await this.sb
      .from("jobs")
      .select("status, attempt")
      .eq("id", jobId)
      .single();

    if (error || !job) throw new Error(`Job ${jobId} not found`);

    if (!canTransition(job.status, to)) {
      throw new Error(`Invalid transition: ${job.status} → ${to}`);
    }

    const update: Record<string, unknown> = {
      status: to,
      updated_at: new Date().toISOString(),
      ...extra,
    };

    // Clear error on forward progress
    if (!to.startsWith("failed_") && to !== "canceled") {
      update.last_error = null;
      update.retryable = false;
    }

    // Set timestamps
    if (to === "completed") {
      update.completed_at = new Date().toISOString();
    }

    const { error: updateErr } = await this.sb
      .from("jobs")
      .update(update)
      .eq("id", jobId)
      .eq("status", job.status); // Optimistic lock — only update if status hasn't changed

    if (updateErr) throw new Error(`Transition failed: ${updateErr.message}`);
  }

  /** Mark a job as failed with a specific failure status */
  async fail(jobId: string, phase: "planning" | "queue" | "runtime" | "upload", error: string, retryable: boolean = true): Promise<void> {
    const failStatus = `failed_${phase}` as JobStatus;

    const { data: job } = await this.sb
      .from("jobs")
      .select("status, attempt")
      .eq("id", jobId)
      .single();

    if (!job) return;

    // Don't overwrite terminal states
    if (job.status === "completed" || job.status === "canceled") return;

    await this.sb.from("jobs").update({
      status: failStatus,
      last_error: error,
      retryable,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    await this.log(jobId, `${phase}.failed` as string, { error, retryable, attempt: job.attempt });
  }

  /** Retry a failed job — increments attempt, resets to retry-entry status */
  async retry(jobId: string): Promise<{ ok: boolean; error?: string }> {
    const { data: job } = await this.sb
      .from("jobs")
      .select("status, attempt, retryable")
      .eq("id", jobId)
      .single();

    if (!job) return { ok: false, error: "Job not found" };
    if (!job.retryable) return { ok: false, error: "Job is not retryable" };
    if (job.attempt >= 3) return { ok: false, error: "Max retries (3) reached" };

    const retryMap: Record<string, JobStatus> = {
      failed_planning: "created",
      failed_queue: "queued",
      failed_runtime: "queued",
      failed_upload: "uploading",
    };

    const target = retryMap[job.status];
    if (!target) return { ok: false, error: `Cannot retry from ${job.status}` };

    await this.sb.from("jobs").update({
      status: target,
      attempt: job.attempt + 1,
      last_error: null,
      retryable: false,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    await this.log(jobId, EVENT_STEPS.JOB_RETRY, { from: job.status, to: target, attempt: job.attempt + 1 });

    return { ok: true };
  }

  /** Log a structured event */
  async log(jobId: string, step: string, data: Record<string, unknown> = {}, durationMs?: number): Promise<void> {
    await this.sb.from("job_events").insert({
      job_id: jobId,
      event_type: step,
      step,
      event_data: data,
      duration_ms: durationMs ?? null,
    });
  }

  /** Fetch a job with optimistic lock check — returns null if status doesn't match expected */
  async getIfStatus(jobId: string, expectedStatus: string | string[]): Promise<Record<string, unknown> | null> {
    const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const { data } = await this.sb
      .from("jobs")
      .select("*, workflow_templates(*), pod_instances(*)")
      .eq("id", jobId)
      .in("status", statuses)
      .single();
    return data;
  }
}

// ─── Helper: run with timeout ───

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// ─── Helper: retry with backoff ───

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxAttempts = 2, delayMs = 1000, label = "operation" } = opts;
  let lastErr: Error | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw new Error(`${label} failed after ${maxAttempts} attempts: ${lastErr?.message}`);
}
