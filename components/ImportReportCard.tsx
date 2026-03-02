"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useModels } from "@/lib/import-hooks";
import type { ImportReport } from "@/lib/import-types";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const MODEL_STATUS_ICON: Record<string, string> = {
  cached: "✅",
  registered: "🔵",
  missing: "❌",
};

const MODEL_STATUS_BADGE: Record<string, string> = {
  cached:     "bg-emerald-50 text-emerald-600",
  registered: "bg-blue-50 text-blue-600",
  missing:    "bg-red-50 text-red-500",
};

interface ImportReportCardProps {
  report: ImportReport;
}

export function ImportReportCard({ report }: ImportReportCardProps) {
  const { downloadModel, importModel } = useModels();
  const [civitaiUrls, setCivitaiUrls] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  // ── Model import report ──────────────────────────────────────────

  if (report.type === "model") {
    return (
      <div className="bg-white/60 backdrop-blur-xl border border-neutral-200/60 rounded-2xl shadow-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-sm font-medium text-neutral-900">{report.modelName || "Imported Model"}</h3>
            {report.modelFilename && (
              <p className="text-xs text-neutral-500 font-geist-mono mt-0.5">{report.modelFilename}</p>
            )}
          </div>
          <span className="text-[10px] font-medium font-geist-mono px-2 py-1 rounded-full bg-blue-50 text-blue-600">
            Model
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs mb-5">
          {report.baseModel && (
            <div>
              <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-1">Base Model</p>
              <p className="text-neutral-700">{report.baseModel}</p>
            </div>
          )}
          {report.modelFolder && (
            <div>
              <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-1">Folder</p>
              <p className="text-neutral-700 font-geist-mono">{report.modelFolder}</p>
            </div>
          )}
          {report.modelSize != null && (
            <div>
              <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-1">Size</p>
              <p className="text-neutral-700">{formatBytes(report.modelSize)}</p>
            </div>
          )}
        </div>

        {report.downloadStatus !== "completed" && report.modelId && (
          <button
            onClick={async () => {
              if (report.modelId) await downloadModel(report.modelId);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors shadow-sm"
          >
            <Icon icon="solar:download-linear" width={14} height={14} />
            Download to Pod
          </button>
        )}
      </div>
    );
  }

  // ── Workflow import report ───────────────────────────────────────

  const models = report.models || [];
  const cachedCount = models.filter((m) => m.status === "cached").length;
  const missingModels = models.filter((m) => m.status === "missing");

  const handleDownload = async (registryId: string) => {
    setDownloading((prev) => new Set(prev).add(registryId));
    try {
      await downloadModel(registryId);
    } finally {
      setDownloading((prev) => { const next = new Set(prev); next.delete(registryId); return next; });
    }
  };

  const handleMissingImport = async (filename: string) => {
    const url = civitaiUrls[filename];
    if (!url) return;
    try {
      await importModel(url);
      setCivitaiUrls((prev) => ({ ...prev, [filename]: "" }));
    } catch {
      // error handled by parent or silently
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-neutral-200/60 rounded-2xl shadow-sm p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-neutral-900">
            {report.templateName || "Imported Workflow"}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {report.nodeCount != null && (
              <span className="text-[11px] text-neutral-500 font-geist-mono">{report.nodeCount} nodes</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {report.category && (
            <span className="text-[10px] font-medium font-geist-mono px-2 py-1 rounded-full bg-neutral-100 text-neutral-500 uppercase tracking-wide">
              {report.category}
            </span>
          )}
          <span className="text-[10px] font-medium font-geist-mono px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">
            Workflow
          </span>
        </div>
      </div>

      {/* Models Required */}
      {models.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">
              Models Required
            </p>
            <p className="text-[10px] text-neutral-400 font-geist-mono">
              {cachedCount}/{models.length} cached
            </p>
          </div>

          <div className="space-y-1">
            {models.map((model, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-sm shrink-0">{MODEL_STATUS_ICON[model.status] || "❓"}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-700 font-geist-mono truncate">{model.filename}</p>
                    <p className="text-[10px] text-neutral-400 font-geist-mono">{model.folder}</p>
                  </div>
                </div>
                <div className="shrink-0 ml-3">
                  {model.status === "cached" && (
                    <span className={`text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full ${MODEL_STATUS_BADGE.cached}`}>
                      Cached
                    </span>
                  )}
                  {model.status === "registered" && model.registryId && (
                    <button
                      onClick={() => model.registryId && handleDownload(model.registryId)}
                      disabled={model.registryId ? downloading.has(model.registryId) : false}
                      className="flex items-center gap-1 text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      <Icon icon={downloading.has(model.registryId ?? "") ? "solar:loading-linear" : "solar:download-linear"} width={10} height={10} className={downloading.has(model.registryId ?? "") ? "animate-spin" : ""} />
                      Download
                    </button>
                  )}
                  {model.status === "missing" && (
                    <span className={`text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full ${MODEL_STATUS_BADGE.missing}`}>
                      Missing
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Missing model import inputs */}
          {missingModels.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">
                Import Missing via Civitai
              </p>
              {missingModels.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-500 font-geist-mono shrink-0 w-40 truncate" title={m.filename}>
                    {m.filename}
                  </span>
                  <input
                    type="url"
                    placeholder="https://civitai.com/models/..."
                    value={civitaiUrls[m.filename] || ""}
                    onChange={(e) => setCivitaiUrls((prev) => ({ ...prev, [m.filename]: e.target.value }))}
                    className="flex-1 bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-xs rounded-xl px-3 py-2 outline-none transition-colors font-geist-mono"
                  />
                  <button
                    onClick={() => handleMissingImport(m.filename)}
                    disabled={!civitaiUrls[m.filename]}
                    className="px-3 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40"
                  >
                    Import
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom Nodes */}
      <div>
        <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-3">
          Custom Nodes
        </p>
        {report.customNodes && report.customNodes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {report.customNodes.map((node, i) => (
              <span
                key={i}
                className="text-[10px] font-geist-mono px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600"
              >
                {node}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-600 font-geist-mono">No custom nodes required ✅</p>
        )}
      </div>

      {/* Detected Parameters */}
      {report.paramSchema && Object.keys(report.paramSchema).length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-3">
            Detected Parameters
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(report.paramSchema).map(([key, param]) => (
              <span
                key={key}
                className="text-[10px] font-geist-mono px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600"
              >
                {param.label || key}
                {(param.type === "integer" || param.type === "number")
                  ? ` (${param.type}${param.min !== undefined ? `, ${param.min}–${param.max}` : ""})`
                  : ` (${param.type})`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
        {report.templateId && (
          <span className="text-xs text-emerald-600 font-geist-mono flex items-center gap-1.5">
            <Icon icon="solar:check-circle-linear" width={14} height={14} />
            Saved as template
          </span>
        )}
        {missingModels.length > 0 && (
          <button className="ml-auto flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors shadow-sm">
            <Icon icon="solar:download-linear" width={14} height={14} />
            Resolve All Missing
          </button>
        )}
      </div>
    </div>
  );
}
