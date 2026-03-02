"use client";

import { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import { useJobs, usePods, useTemplates } from "@/lib/hooks";
import type { DbTemplate } from "@/lib/db-types";

// ─── Param display helpers ────────────────────────────────────────────────────

const PARAM_LABEL: Record<string, string> = {
  prompt:          "Prompt",
  negative_prompt: "Negative Prompt",
  seed:            "Seed",
  steps:           "Steps",
  cfg:             "CFG Scale",
  width:           "Width",
  height:          "Height",
  denoise:         "Denoise",
  batch_size:      "Batch Size",
};

interface ParamMeta { min?: number; max?: number; step?: number }

const PARAM_META: Record<string, ParamMeta> = {
  seed:        { min: 0, max: 4294967295 },
  steps:       { min: 1, max: 150 },
  cfg:         { min: 1, max: 30,   step: 0.5 },
  width:       { min: 256, max: 2048, step: 64 },
  height:      { min: 256, max: 2048, step: 64 },
  denoise:     { min: 0, max: 1, step: 0.05 },
  batch_size:  { min: 1, max: 8 },
};

type ParamEntry = { node: string; field: string; type: "string" | "integer" | "number"; default?: unknown };

// ─── TemplateRunPanel ─────────────────────────────────────────────────────────

interface TemplateRunPanelProps {
  templateId: string;
  onClose: () => void;
}

export function TemplateRunPanel({ templateId, onClose }: TemplateRunPanelProps) {
  const { templates } = useTemplates();
  const { pods } = usePods();
  const { createJob, planJob, executeJob } = useJobs();

  const template = templates.find((t) => t.id === templateId) ?? null;
  const readyPods = pods.filter((p) => p.status === "ready");
  const hasReadyPod = readyPods.length > 0;

  const [formValues, setFormValues] = useState<Record<string, unknown>>(() =>
    buildDefaults(template?.param_schema as Record<string, ParamEntry> | null | undefined)
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  const paramEntries = useMemo(
    () => Object.entries((template?.param_schema ?? {}) as Record<string, ParamEntry>),
    [template]
  );

  // Split into text params and numeric params
  const textParams    = paramEntries.filter(([, e]) => e.type === "string");
  const numericParams = paramEntries.filter(([, e]) => e.type !== "string");

  if (!template) {
    return (
      <div className="bg-white/60 backdrop-blur-xl border border-neutral-200/60 rounded-2xl p-6 flex items-center justify-center h-32">
        <Icon icon="solar:loading-linear" width={20} height={20} className="text-neutral-300 animate-spin" />
      </div>
    );
  }

  const handleGenerate = async () => {
    if (generating || !hasReadyPod) return;
    setGenerating(true);
    setError(null);
    setLaunched(false);

    try {
      // Build a structured input the planning agent can parse
      const inputText = buildInputText(template, formValues);

      const { data: job, ok } = await createJob(inputText);
      if (!ok) { setError(job.error ?? "Failed to create job"); return; }

      const { ok: planOk, data: planData } = await planJob(job.id);
      if (!planOk) { setError(planData?.error ?? "Planning failed"); return; }

      const { ok: execOk, data: execData } = await executeJob(job.id);
      if (!execOk) { setError(execData?.error ?? "Execution failed"); return; }

      setLaunched(true);
    } finally {
      setGenerating(false);
    }
  };

  const setValue = (key: string, val: unknown) =>
    setFormValues((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="bg-white/95 backdrop-blur-2xl border border-neutral-200/80 rounded-3xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-600">
            <Icon icon="solar:play-circle-linear" width={18} height={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">{template.name}</h3>
            {template.category && (
              <span className="text-[10px] text-neutral-400 font-geist-mono">{template.category}</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
          <Icon icon="solar:close-square-linear" width={16} height={16} />
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">
        {paramEntries.length === 0 ? (
          <p className="text-sm text-neutral-400 font-geist-mono">No parameters detected for this template.</p>
        ) : (
          <>
            {/* Text / prompt params — full width */}
            {textParams.map(([key, entry]) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">
                  {PARAM_LABEL[key] ?? key}
                </label>
                <textarea
                  rows={key.includes("prompt") ? 3 : 1}
                  value={String(formValues[key] ?? "")}
                  onChange={(e) => setValue(key, e.target.value)}
                  placeholder={`Enter ${PARAM_LABEL[key] ?? key}…`}
                  className="w-full bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-all resize-none placeholder:text-neutral-400"
                />
                <span className="text-[10px] text-neutral-300 font-geist-mono">node {entry.node} · {entry.field}</span>
              </div>
            ))}

            {/* Numeric params — 2-column grid */}
            {numericParams.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {numericParams.map(([key, entry]) => {
                  const meta = PARAM_META[key] ?? {};
                  return (
                    <div key={key} className="space-y-1.5">
                      <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">
                        {PARAM_LABEL[key] ?? key}
                      </label>
                      <input
                        type="number"
                        value={String(formValues[key] ?? "")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setValue(key, entry.type === "integer" ? parseInt(raw, 10) : parseFloat(raw));
                        }}
                        min={meta.min}
                        max={meta.max}
                        step={meta.step ?? (entry.type === "integer" ? 1 : 0.1)}
                        className="w-full bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-all font-geist-mono"
                      />
                    </div>
                  );
                })}

                {/* Random seed shortcut */}
                {Object.keys(formValues).includes("seed") && (
                  <div className="col-span-full flex items-center gap-2">
                    <button
                      onClick={() => setValue("seed", Math.floor(Math.random() * 4294967295))}
                      className="text-[10px] font-geist-mono text-neutral-400 hover:text-neutral-600 flex items-center gap-1 transition-colors"
                    >
                      <Icon icon="solar:refresh-linear" width={11} height={11} /> Random seed
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-500 font-geist-mono bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <Icon icon="solar:danger-circle-linear" width={14} height={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Success */}
        {launched && !error && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 font-geist-mono bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
            <Icon icon="solar:check-circle-linear" width={14} height={14} />
            Job queued — see progress below in Active Jobs
          </div>
        )}

        {/* Generate button + pod status */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handleGenerate}
            disabled={generating || !hasReadyPod}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {generating
              ? <Icon icon="solar:loading-linear" width={16} height={16} className="animate-spin" />
              : <Icon icon="solar:play-circle-linear" width={16} height={16} />}
            {generating ? "Launching…" : "Generate ▶"}
          </button>

          {!hasReadyPod && (
            <span className="text-xs text-amber-600 font-geist-mono flex items-center gap-1.5">
              <Icon icon="solar:danger-triangle-linear" width={13} height={13} />
              Launch a pod first
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDefaults(schema: Record<string, ParamEntry> | null | undefined): Record<string, unknown> {
  if (!schema) return {};
  return Object.fromEntries(
    Object.entries(schema).map(([key, entry]) => [key, entry.default ?? defaultForType(entry.type)])
  );
}

function defaultForType(type: string): unknown {
  if (type === "string")  return "";
  if (type === "integer") return 0;
  return 0;
}

function buildInputText(template: DbTemplate, params: Record<string, unknown>): string {
  return JSON.stringify({
    _template: template.slug,
    ...params,
  });
}
