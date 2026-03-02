"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useModels } from "@/lib/hooks";
import type { ImportReport, WorkflowModelRef } from "@/components/ImportPanel";
import type { DbModel } from "@/lib/db-types";

// ─── Category badge colours ──────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  txt2img:    "bg-blue-50 text-blue-600",
  controlnet: "bg-purple-50 text-purple-600",
  upscale:    "bg-cyan-50 text-cyan-600",
  lora:       "bg-indigo-50 text-indigo-600",
};

// ─── Main card ───────────────────────────────────────────────────────────────

interface ImportReportCardProps {
  report: ImportReport;
  onDismiss?: () => void;
}

export function ImportReportCard({ report, onDismiss }: ImportReportCardProps) {
  return (
    <div className="bg-white/60 backdrop-blur-xl border border-neutral-200/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Icon icon="solar:check-circle-linear" width={18} height={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              {report.type === "workflow" ? report.templateName : report.modelName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {report.type === "workflow" && (
                <>
                  <span className="text-[10px] font-medium text-neutral-400 font-geist-mono">
                    {report.nodeCount} nodes
                  </span>
                  {report.category && (
                    <span className={`text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full ${CATEGORY_COLORS[report.category] ?? "bg-neutral-100 text-neutral-500"}`}>
                      {report.category}
                    </span>
                  )}
                </>
              )}
              {report.type === "model" && (
                <>
                  {report.baseModel && <span className="text-[10px] text-neutral-400 font-geist-mono">{report.baseModel}</span>}
                  {report.modelSizeMb && <span className="text-[10px] text-neutral-400 font-geist-mono">· {report.modelSizeMb} MB</span>}
                </>
              )}
            </div>
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="p-1.5 text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
            <Icon icon="solar:close-square-linear" width={16} height={16} />
          </button>
        )}
      </div>

      {report.type === "workflow" ? (
        <WorkflowReport report={report} />
      ) : (
        <ModelReport report={report} />
      )}
    </div>
  );
}

// ─── Workflow report ──────────────────────────────────────────────────────────

function WorkflowReport({ report }: { report: ImportReport }) {
  const { models: registry, downloadModel } = useModels();
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [manualUrls, setManualUrls] = useState<Record<string, string>>({});

  const registryByFilename = new Map<string, DbModel>(registry.map((m) => [m.filename, m]));

  const handleDownload = async (registryId: string) => {
    setDownloading((d) => ({ ...d, [registryId]: true }));
    await downloadModel(registryId);
    setDownloading((d) => ({ ...d, [registryId]: false }));
  };

  const hasMissing = (report.missingModels?.length ?? 0) > 0;
  const paramEntries = Object.entries(report.paramSchema ?? {});

  return (
    <div className="px-6 py-4 space-y-5">
      {/* Models table */}
      {(report.models?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <SectionLabel icon="solar:box-minimalistic-linear" label="Models Required" />
          <div className="space-y-1.5">
            {report.models!.map((m, i) => {
              const reg = registryByFilename.get(m.filename);
              // Re-derive live status from registry
              const liveStatus: WorkflowModelRef["status"] =
                !reg                      ? "missing"
                : reg.is_cached           ? "cached"
                :                           "registered";
              return (
                <ModelStatusRow
                  key={`${m.filename}-${i}`}
                  model={m}
                  liveStatus={liveStatus}
                  registryModel={reg}
                  downloading={reg ? !!downloading[reg.id] : false}
                  onDownload={reg ? () => handleDownload(reg.id) : undefined}
                  manualUrl={manualUrls[m.filename] ?? ""}
                  onManualUrlChange={(url) => setManualUrls((u) => ({ ...u, [m.filename]: url }))}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Custom nodes */}
      <div className="space-y-2">
        <SectionLabel icon="solar:cpu-bolt-linear" label="Custom Nodes" />
        {(report.customNodes?.length ?? 0) === 0 ? (
          <span className="text-xs text-emerald-600 font-geist-mono flex items-center gap-1.5">
            <Icon icon="solar:check-circle-linear" width={13} height={13} /> None required
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {report.customNodes!.map((n) => (
              <span key={n} className="text-[10px] font-geist-mono px-2 py-1 rounded-lg bg-neutral-100 text-neutral-500">
                {n}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Detected params */}
      {paramEntries.length > 0 && (
        <div className="space-y-2">
          <SectionLabel icon="solar:settings-linear" label="Params Detected" />
          <div className="flex flex-wrap gap-2">
            {paramEntries.map(([key, entry]) => (
              <span key={key} className="text-[10px] font-geist-mono px-2 py-1 rounded-lg bg-neutral-100 text-neutral-500">
                {key} <span className="text-neutral-300">({entry.type}{entry.default !== undefined ? `, default: ${String(entry.default)}` : ""})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-geist-mono">
          <Icon icon="solar:check-circle-linear" width={14} height={14} />
          Template saved as <span className="font-medium text-emerald-700">{report.templateSlug}</span>
        </div>
        {hasMissing && (
          <span className="text-[10px] font-geist-mono text-amber-600 ml-auto flex items-center gap-1">
            <Icon icon="solar:danger-triangle-linear" width={12} height={12} />
            {report.missingModels!.length} model{report.missingModels!.length > 1 ? "s" : ""} missing
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Single model row ─────────────────────────────────────────────────────────

interface ModelStatusRowProps {
  model: WorkflowModelRef;
  liveStatus: WorkflowModelRef["status"];
  registryModel?: DbModel;
  downloading: boolean;
  onDownload?: () => void;
  manualUrl: string;
  onManualUrlChange: (url: string) => void;
}

function ModelStatusRow({ model, liveStatus, downloading, onDownload, manualUrl, onManualUrlChange }: ModelStatusRowProps) {
  const statusIcon = liveStatus === "cached"     ? "solar:check-circle-linear"
                   : liveStatus === "registered" ? "solar:download-minimalistic-linear"
                   :                               "solar:close-circle-linear";
  const statusColor = liveStatus === "cached"     ? "text-emerald-500"
                    : liveStatus === "registered" ? "text-blue-500"
                    :                               "text-red-400";
  const statusLabel = liveStatus === "cached"     ? "Cached"
                    : liveStatus === "registered" ? "Not on pod"
                    :                               "Missing";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 py-1.5">
        <Icon icon={statusIcon} width={14} height={14} className={statusColor} />
        <span className="text-xs font-geist-mono text-neutral-700 flex-1 truncate">{model.filename}</span>
        <span className="text-[10px] text-neutral-400 font-geist-mono shrink-0">{model.folder}/</span>
        {liveStatus === "registered" && onDownload && (
          <button
            onClick={onDownload}
            disabled={downloading}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-neutral-900 text-white rounded-lg text-[10px] font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40"
          >
            {downloading ? <Icon icon="solar:loading-linear" width={11} height={11} className="animate-spin" /> : <Icon icon="solar:download-minimalistic-linear" width={11} height={11} />}
            Download to Pod
          </button>
        )}
        {liveStatus === "missing" && (
          <span className={`shrink-0 text-[10px] font-geist-mono ${statusColor}`}>{statusLabel}</span>
        )}
        {liveStatus === "cached" && (
          <span className={`shrink-0 text-[10px] font-geist-mono ${statusColor}`}>{statusLabel}</span>
        )}
      </div>
      {/* Manual import for missing models */}
      {liveStatus === "missing" && (
        <div className="ml-5 flex items-center gap-2">
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => onManualUrlChange(e.target.value)}
            placeholder="Paste Civitai URL to import this model"
            className="flex-1 text-[11px] font-geist-mono bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 outline-none focus:border-neutral-300 placeholder:text-neutral-300"
          />
        </div>
      )}
    </div>
  );
}

// ─── Model (Civitai) report ───────────────────────────────────────────────────

function ModelReport({ report }: { report: ImportReport }) {
  const { downloadModel } = useModels();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!report.modelId) return;
    setDownloading(true);
    await downloadModel(report.modelId);
    setDownloading(false);
  };

  return (
    <div className="px-6 py-4 flex items-start gap-5">
      {/* Preview */}
      {report.previewUrl ? (
        <img src={report.previewUrl} alt="" className="w-20 h-20 rounded-xl object-cover border border-neutral-100 shrink-0" />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-300 shrink-0">
          <Icon icon="solar:box-minimalistic-linear" width={28} height={28} />
        </div>
      )}

      <div className="flex-1 space-y-3">
        <div className="space-y-0.5">
          {report.modelFolder && (
            <p className="text-[10px] font-geist-mono text-neutral-400">{report.modelFolder}/</p>
          )}
          <p className="text-xs font-geist-mono text-neutral-600">{report.modelFilename}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {report.baseModel && <Chip label={report.baseModel} color="bg-blue-50 text-blue-600" />}
          {report.modelSizeMb && <Chip label={`${report.modelSizeMb} MB`} color="bg-neutral-100 text-neutral-500" />}
          <Chip
            label={report.downloadStatus === "completed" ? "Cached" : "Pending Download"}
            color={report.downloadStatus === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}
          />
        </div>

        {report.downloadStatus !== "completed" && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40"
          >
            {downloading
              ? <Icon icon="solar:loading-linear" width={13} height={13} className="animate-spin" />
              : <Icon icon="solar:download-minimalistic-linear" width={13} height={13} />}
            Download to Pod
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon icon={icon} width={13} height={13} className="text-neutral-400" />
      <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">{label}</span>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full ${color}`}>{label}</span>
  );
}
