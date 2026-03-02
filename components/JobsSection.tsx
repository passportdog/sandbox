"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useJobs } from "@/lib/hooks";
import { JOB_STATUS_CONFIG, STEP_DISPLAY, isActive, isFailed, isTerminal } from "@/lib/db-types";
import type { DbJobEvent, DbOutput } from "@/lib/db-types";
import type { DbJob } from "@/lib/db-types";

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "Now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StepTimeline({ events }: { events: DbJobEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="space-y-1 mt-4">
      {events.map((ev, i) => {
        const key = ev.step || ev.event_type;
        const display = STEP_DISPLAY[key] || {
          icon: "solar:record-circle-linear",
          label: key,
        };
        const isErr = key.includes("fail") || key.includes("timeout");
        const isDone = key.includes("completed") || key === "job.completed";
        const isLast = i === events.length - 1;

        return (
          <div key={ev.id} className="flex gap-3 items-start">
            <div className="flex flex-col items-center w-5 shrink-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  isErr
                    ? "bg-red-50 text-red-500"
                    : isDone
                    ? "bg-emerald-50 text-emerald-500"
                    : isLast
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-400"
                }`}
              >
                <Icon icon={display.icon} width={12} height={12} />
              </div>
              {i < events.length - 1 && (
                <div className="w-px flex-1 min-h-[16px] bg-neutral-100" />
              )}
            </div>
            <div className="pb-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-medium ${
                    isErr ? "text-red-600" : isDone ? "text-emerald-600" : "text-neutral-700"
                  }`}
                >
                  {display.label}
                </span>
                {ev.duration_ms != null && (
                  <span className="text-[10px] text-neutral-400 font-geist-mono">
                    {ev.duration_ms >= 1000
                      ? `${(ev.duration_ms / 1000).toFixed(1)}s`
                      : `${ev.duration_ms}ms`}
                  </span>
                )}
              </div>
              {Boolean(ev.event_data?.error) && (
                <p className="text-[11px] text-red-400 font-geist-mono mt-0.5 break-all">
                  {String(ev.event_data.error)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JobCard({
  job,
  onRetry,
  onCancel,
}: {
  job: DbJob;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const active = isActive(job.status);
  const failed = isFailed(job.status);
  const done = isTerminal(job.status) && !isFailed(job.status);
  const cfg = JOB_STATUS_CONFIG[job.status] || { color: "bg-neutral-400", label: job.status };
  const outputs = (job.outputs || []) as DbOutput[];
  const events = (job.events || []) as DbJobEvent[];

  const statusDot = active
    ? "bg-blue-500"
    : done
    ? "bg-emerald-500"
    : "bg-red-400";

  const cardBorder = active
    ? "border-blue-200/80 bg-blue-50/10"
    : done
    ? "border-neutral-200/60 bg-white/40"
    : "border-red-200/60 bg-red-50/10";

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${cardBorder}`}>
      {/* Summary row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Dot */}
        <div className="shrink-0 w-4 flex items-center justify-center">
          <span className="relative flex items-center justify-center">
            <span className={`w-2 h-2 rounded-full ${statusDot} block`} />
            {active && (
              <span className={`animate-ping absolute inset-0 rounded-full ${statusDot} opacity-40`} />
            )}
          </span>
        </div>

        {/* Text info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-neutral-800 truncate">
            {job.input_text?.slice(0, 70) || "Untitled job"}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className={`text-[10px] font-medium font-geist-mono px-1.5 py-0.5 rounded-full ${
                done
                  ? "bg-emerald-50 text-emerald-600"
                  : failed
                  ? "bg-red-50 text-red-600"
                  : "bg-blue-50 text-blue-600"
              }`}
            >
              {cfg.label}
            </span>
            {job.workflow_templates?.name && (
              <span className="text-[10px] text-neutral-400 font-geist-mono">
                {job.workflow_templates.name}
              </span>
            )}
            {job.attempt > 1 && (
              <span className="text-[10px] text-amber-500 font-geist-mono">
                retry {job.attempt}/3
              </span>
            )}
          </div>
        </div>

        {/* Thumbnails */}
        {outputs.length > 0 && !expanded && (
          <div className="flex gap-1.5 shrink-0">
            {outputs.slice(0, 3).map((o) => (
              <img
                key={o.id}
                src={o.public_url || ""}
                alt=""
                className="w-9 h-9 rounded-lg object-cover border border-neutral-200/60"
              />
            ))}
          </div>
        )}

        {/* Time + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-neutral-400 font-geist-mono hidden sm:block">
            {timeAgo(job.created_at)}
          </span>
          <Icon
            icon={expanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
            width={14}
            height={14}
            className="text-neutral-400"
          />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-neutral-200/60 space-y-4">
          {/* Step timeline */}
          {events.length > 0 && <StepTimeline events={events} />}

          {/* Image outputs */}
          {outputs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {outputs.map((o) => (
                <a
                  key={o.id}
                  href={o.public_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl overflow-hidden border border-neutral-200/60 hover:shadow-lg transition-all"
                >
                  <img
                    src={o.public_url || ""}
                    alt={o.filename || ""}
                    className="w-full aspect-square object-cover"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Error */}
          {job.last_error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-geist-mono">
              <span className="font-medium">Error:</span> {job.last_error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {failed && job.retryable && job.attempt < 3 && (
              <button
                onClick={() => onRetry(job.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-medium hover:bg-amber-500 transition-colors shadow-sm"
              >
                <Icon icon="solar:refresh-circle-linear" width={14} height={14} />
                Retry (attempt {job.attempt + 1}/3)
              </button>
            )}
            {active && (
              <button
                onClick={() => onCancel(job.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-neutral-400 hover:text-red-500 rounded-xl text-xs font-medium transition-colors"
              >
                <Icon icon="solar:stop-circle-linear" width={14} height={14} />
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function JobsSection() {
  const { jobs, retryJob, cancelJob, planJob, executeJob } = useJobs();

  const activeJobs = jobs.filter((j) => isActive(j.status));
  const doneJobs = jobs.filter((j) => !isActive(j.status));

  const handleRetry = async (jobId: string) => {
    const { ok, data } = await retryJob(jobId);
    if (ok) {
      if (data.status === "created") await planJob(jobId);
      if (data.status === "queued") await executeJob(jobId);
    }
  };

  if (jobs.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-medium text-neutral-900 mb-4">Jobs</h2>

      <div className="space-y-2">
        {activeJobs.length > 0 && (
          <>
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-2">
              Active
            </p>
            {activeJobs.map((j) => (
              <JobCard key={j.id} job={j} onRetry={handleRetry} onCancel={() => cancelJob(j.id)} />
            ))}
          </>
        )}

        {doneJobs.length > 0 && (
          <div className={activeJobs.length > 0 ? "pt-4" : ""}>
            {activeJobs.length > 0 && (
              <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-2">
                History
              </p>
            )}
            {doneJobs.slice(0, 20).map((j) => (
              <JobCard key={j.id} job={j} onRetry={handleRetry} onCancel={() => cancelJob(j.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
