"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useJobs, useJobDetail } from "@/lib/hooks";
import { JOB_STATUS_CONFIG, STEP_DISPLAY, isActive, isFailed, isTerminal } from "@/lib/db-types";
import type { DbJob, DbJobEvent } from "@/lib/db-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsed(iso: string | null): string {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Step Timeline (self-contained) ──────────────────────────────────────────

function StepTimeline({ events }: { events: DbJobEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="space-y-1 mt-3">
      {events.map((ev, i) => {
        const key = ev.step ?? ev.event_type;
        const display = STEP_DISPLAY[key] ?? { icon: "solar:record-circle-linear", label: key };
        const isErr  = key.includes("fail") || key.includes("timeout");
        const isDone = key.includes("completed") || key === "job.completed";
        const isLast = i === events.length - 1;

        return (
          <div key={ev.id} className="flex gap-3 items-start">
            <div className="flex flex-col items-center w-5 shrink-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                isErr ? "bg-red-50 text-red-500" :
                isDone ? "bg-emerald-50 text-emerald-500" :
                isLast ? "bg-neutral-900 text-white" :
                "bg-neutral-100 text-neutral-400"
              }`}>
                <Icon icon={display.icon} width={11} height={11} />
              </div>
              {i < events.length - 1 && <div className="w-px flex-1 min-h-[14px] bg-neutral-100 mt-0.5" />}
            </div>
            <div className="pb-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-medium ${isErr ? "text-red-600" : isDone ? "text-emerald-600" : "text-neutral-600"}`}>
                  {display.label}
                </span>
                {ev.duration_ms != null && (
                  <span className="text-[10px] text-neutral-400 font-geist-mono">
                    {ev.duration_ms >= 1000 ? `${(ev.duration_ms / 1000).toFixed(1)}s` : `${ev.duration_ms}ms`}
                  </span>
                )}
              </div>
              {ev.event_data?.error && (
                <p className="text-[11px] text-red-400 font-geist-mono mt-0.5 break-all">{String(ev.event_data.error)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Active Job Card (calls useJobDetail internally for events) ───────────────

function ActiveJobCard({ job, onCancel }: { job: DbJob; onCancel: (id: string) => void }) {
  const { events } = useJobDetail(job.id);
  const cfg = JOB_STATUS_CONFIG[job.status] ?? { label: job.status };

  return (
    <div className="bg-white/80 border border-neutral-200/60 rounded-2xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium text-neutral-900 truncate">{job.input_text?.slice(0, 80) || "Untitled"}</p>
          <div className="flex items-center gap-2 text-[10px] font-geist-mono">
            {job.workflow_templates?.name && (
              <span className="text-neutral-500">{job.workflow_templates.name}</span>
            )}
            {job.started_at && (
              <span className="text-neutral-400">· {elapsed(job.started_at)} elapsed</span>
            )}
            {job.attempt > 1 && (
              <span className="text-amber-500">· retry {job.attempt}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Animated status pill */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-neutral-100">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-medium font-geist-mono text-neutral-600">{cfg.label}</span>
          </div>
          {/* Cancel */}
          <button
            onClick={() => onCancel(job.id)}
            className="p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Cancel job"
          >
            <Icon icon="solar:stop-circle-linear" width={14} height={14} />
          </button>
        </div>
      </div>

      {/* Step timeline (collapsible if many events) */}
      {events.length > 0 && (
        <details className="bg-neutral-50/80 border border-neutral-100 rounded-xl overflow-hidden" open>
          <summary className="px-3 py-2 text-[10px] font-medium text-neutral-400 font-geist-mono uppercase tracking-widest cursor-pointer flex items-center gap-2 select-none hover:bg-neutral-100/60 transition-colors">
            <Icon icon="solar:timeline-up-linear" width={12} height={12} /> Step Timeline
            <span className="text-neutral-300">({events.length} events)</span>
          </summary>
          <div className="px-4 py-3">
            <StepTimeline events={events} />
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Compact completed job row ────────────────────────────────────────────────

function CompletedJobRow({ job }: { job: DbJob }) {
  const [expanded, setExpanded] = useState(false);
  const { job: detail } = useJobDetail(expanded ? job.id : null);

  const failed  = isFailed(job.status);
  const cfg     = JOB_STATUS_CONFIG[job.status] ?? { label: job.status };
  const outputs  = detail?.outputs ?? [];

  return (
    <div className="border border-neutral-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50/60 transition-colors text-left"
      >
        {/* Status icon */}
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
          failed          ? "bg-red-50 text-red-500"
          : job.status === "canceled" ? "bg-neutral-100 text-neutral-400"
          : "bg-emerald-50 text-emerald-500"
        }`}>
          <Icon
            icon={failed ? "solar:close-circle-linear"
                : job.status === "canceled" ? "solar:stop-circle-linear"
                : "solar:check-circle-linear"}
            width={12}
            height={12}
          />
        </div>

        {/* Text */}
        <p className="flex-1 text-xs font-medium text-neutral-700 truncate">{job.input_text?.slice(0, 60) || "Untitled"}</p>

        {/* Status + template + time */}
        <div className="flex items-center gap-3 shrink-0 text-[10px] font-geist-mono text-neutral-400">
          {job.workflow_templates?.name && <span>{job.workflow_templates.name}</span>}
          <span className={failed ? "text-red-400" : ""}>{cfg.label}</span>
          <span>{timeAgo(job.created_at)}</span>
          <Icon icon={expanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} height={12} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-neutral-100 px-4 py-3 space-y-3">
          {/* Error */}
          {job.last_error && (
            <p className="text-xs text-red-500 font-geist-mono bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {job.last_error}
            </p>
          )}
          {/* Outputs */}
          {outputs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {outputs.map((o) => (
                <a
                  key={o.id}
                  href={o.public_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-24 h-24 rounded-xl overflow-hidden border border-neutral-200 hover:border-neutral-400 hover:shadow-md transition-all"
                >
                  <img src={o.public_url ?? ""} alt={o.filename ?? ""} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
          {outputs.length === 0 && !job.last_error && (
            <p className="text-xs text-neutral-400 font-geist-mono">No outputs recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Failed job row ───────────────────────────────────────────────────────────

function FailedJobRow({ job, onRetry }: { job: DbJob; onRetry: (id: string) => void }) {
  const cfg = JOB_STATUS_CONFIG[job.status] ?? { label: job.status };
  return (
    <div className="flex items-start gap-3 px-4 py-3 border border-red-100 rounded-xl bg-red-50/30">
      <Icon icon="solar:close-circle-linear" width={16} height={16} className="text-red-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs font-medium text-neutral-700 truncate">{job.input_text?.slice(0, 60) || "Untitled"}</p>
        <p className="text-[10px] font-geist-mono text-red-400">{cfg.label}</p>
        {job.last_error && <p className="text-[11px] font-geist-mono text-neutral-500 truncate">{job.last_error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-neutral-400 font-geist-mono">{timeAgo(job.created_at)}</span>
        {job.retryable && job.attempt < 3 && (
          <button
            onClick={() => onRetry(job.id)}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-medium hover:bg-amber-500 transition-colors"
          >
            <Icon icon="solar:refresh-circle-linear" width={11} height={11} />
            Retry {job.attempt}/3
          </button>
        )}
      </div>
    </div>
  );
}

// ─── JobsSection ──────────────────────────────────────────────────────────────

export function JobsSection() {
  const { jobs, cancelJob, retryJob, planJob, executeJob } = useJobs();

  const activeJobs    = jobs.filter((j) => isActive(j.status));
  const failedJobs    = jobs.filter((j) => isFailed(j.status));
  const completedJobs = jobs.filter((j) => isTerminal(j.status));

  const handleRetry = async (jobId: string) => {
    const { ok, data } = await retryJob(jobId);
    if (ok) {
      if (data.status === "created") await planJob(jobId);
      if (data.status === "queued")  await executeJob(jobId);
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon icon="solar:play-circle-linear" width={16} height={16} className="text-neutral-400" />
          <span className="text-sm font-medium text-neutral-900">Jobs</span>
        </div>
        <div className="bg-white/40 border border-dashed border-neutral-200 rounded-2xl h-24 flex items-center justify-center">
          <p className="text-sm text-neutral-400">No jobs yet. Run a template above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon icon="solar:play-circle-linear" width={16} height={16} className="text-neutral-400" />
        <span className="text-sm font-medium text-neutral-900">Jobs</span>
        <span className="text-[10px] font-geist-mono text-neutral-400 ml-1">
          {activeJobs.length > 0 && `${activeJobs.length} active`}
          {activeJobs.length > 0 && (failedJobs.length > 0 || completedJobs.length > 0) && " · "}
          {failedJobs.length > 0 && `${failedJobs.length} failed`}
          {failedJobs.length > 0 && completedJobs.length > 0 && " · "}
          {completedJobs.length > 0 && `${completedJobs.length} done`}
        </span>
      </div>

      {/* Active */}
      {activeJobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono px-1">Active</p>
          {activeJobs.map((j) => (
            <ActiveJobCard key={j.id} job={j} onCancel={cancelJob} />
          ))}
        </div>
      )}

      {/* Failed */}
      {failedJobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono px-1">Failed</p>
          {failedJobs.map((j) => (
            <FailedJobRow key={j.id} job={j} onRetry={handleRetry} />
          ))}
        </div>
      )}

      {/* Completed */}
      {completedJobs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono px-1">History</p>
          {completedJobs.map((j) => (
            <CompletedJobRow key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}
