"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useJobs, useTemplates, usePods } from "@/lib/hooks";
import { POD_STATUS_CONFIG } from "@/lib/db-types";
import type { ImportReportParam } from "@/lib/import-types";

interface TemplateRunPanelProps {
  templateId: string;
}

export function TemplateRunPanel({ templateId }: TemplateRunPanelProps) {
  const { templates } = useTemplates();
  const { createJob, planJob, executeJob } = useJobs();
  const { pods } = usePods();
  const [params, setParams] = useState<Record<string, string | number>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId);
  const readyPods = pods.filter((p) => p.status === "ready");
  const hasReadyPod = readyPods.length > 0;
  const primaryPod = readyPods[0];

  if (!template) return null;

  const schema = template.param_schema as Record<string, ImportReportParam> | null;

  const getParamValue = (key: string, def: ImportReportParam): string | number => {
    if (params[key] !== undefined) return params[key];
    if (def.default !== undefined) return def.default;
    if (def.type === "integer" || def.type === "number") return def.min ?? 0;
    return "";
  };

  const setParam = (key: string, value: string | number) =>
    setParams((prev) => ({ ...prev, [key]: value }));

  const handleGenerate = async () => {
    if (!hasReadyPod || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const paramParts = schema
        ? Object.entries(schema)
            .map(([key, def]) => `${def.label || key}: ${getParamValue(key, def)}`)
            .join(", ")
        : String(params.prompt || "");

      const inputText = `[template:${template.slug}] ${paramParts}`;

      const { data: job, ok } = await createJob(inputText);
      if (!ok) {
        setError("Failed to create job.");
        return;
      }
      await planJob(job.id);
      await executeJob(job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const textParams = schema
    ? Object.entries(schema).filter(([, def]) => def.type === "string")
    : [];
  const numParams = schema
    ? Object.entries(schema).filter(([, def]) => def.type === "integer" || def.type === "number")
    : [];

  const podCfg = primaryPod
    ? POD_STATUS_CONFIG[primaryPod.status] || { color: "bg-neutral-400", label: primaryPod.status }
    : null;
  const dotColor = podCfg?.color.split(" ")[0] || "bg-neutral-400";

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-neutral-200/60 rounded-2xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-1">
            Template
          </p>
          <h3 className="text-sm font-medium text-neutral-900">{template.name}</h3>
          {template.description && (
            <p className="text-xs text-neutral-500 font-geist-mono mt-0.5">{template.description}</p>
          )}
        </div>
        {primaryPod && podCfg && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200/80 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className="text-[11px] font-medium text-neutral-700 font-geist-mono">
              {podCfg.label}
            </span>
          </div>
        )}
      </div>

      {/* Text params — full-width */}
      {textParams.map(([key, def]) => {
        const isNegative = key.toLowerCase().includes("negative");
        return (
          <div key={key} className="mb-4">
            <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono block mb-1.5">
              {def.label || key}
            </label>
            <textarea
              value={String(getParamValue(key, def))}
              onChange={(e) => setParam(key, e.target.value)}
              placeholder={`Enter ${def.label || key}...`}
              rows={isNegative ? 2 : 3}
              className="w-full bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-colors resize-none"
            />
          </div>
        );
      })}

      {/* No schema fallback prompt */}
      {!schema && (
        <div className="mb-4">
          <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono block mb-1.5">
            Prompt
          </label>
          <textarea
            value={String(params.prompt || "")}
            onChange={(e) => setParam("prompt", e.target.value)}
            placeholder="Describe what you want to generate..."
            rows={3}
            className="w-full bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-colors resize-none"
          />
        </div>
      )}

      {/* Numeric params — two-column grid */}
      {numParams.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {numParams.map(([key, def]) => (
            <div key={key}>
              <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono block mb-1.5">
                {def.label || key}
              </label>
              <input
                type="number"
                value={String(getParamValue(key, def))}
                onChange={(e) =>
                  setParam(
                    key,
                    def.type === "integer"
                      ? parseInt(e.target.value, 10)
                      : parseFloat(e.target.value)
                  )
                }
                min={def.min}
                max={def.max}
                step={def.type === "number" ? 0.1 : 1}
                className="w-full bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-colors font-geist-mono"
              />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-geist-mono">
          {error}
        </div>
      )}

      {/* Generate row */}
      <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
        {!hasReadyPod && (
          <span className="text-xs text-amber-600 font-geist-mono">
            Launch a pod first to generate
          </span>
        )}
        <button
          onClick={handleGenerate}
          disabled={!hasReadyPod || generating}
          className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {generating ? (
            <Icon icon="solar:loading-linear" width={16} height={16} className="animate-spin" />
          ) : (
            <Icon icon="solar:play-circle-linear" width={16} height={16} />
          )}
          {generating ? "Generating..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
