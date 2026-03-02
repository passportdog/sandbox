"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useModels } from "@/lib/import-hooks";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const FOLDER_ICON: Record<string, string> = {
  checkpoints: "solar:cpu-bolt-linear",
  loras:       "solar:layers-linear",
  controlnet:  "solar:code-scan-linear",
  vae:         "solar:box-minimalistic-linear",
  upscale_models: "solar:maximize-square-2-linear",
};

export function ModelsSection() {
  const { models, loading, importModel, downloadModel } = useModels();
  const [expanded, setExpanded] = useState(false);
  const [civitaiUrl, setCivitaiUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  const cachedCount = models.filter((m) => m.is_cached).length;

  const handleImport = async () => {
    if (!civitaiUrl.trim() || importing) return;
    setImporting(true);
    setImportError(null);
    try {
      await importModel(civitaiUrl.trim());
      setCivitaiUrl("");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleDownload = async (modelId: string) => {
    setDownloading((prev) => new Set(prev).add(modelId));
    try {
      await downloadModel(modelId);
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-neutral-200/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Summary / toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Icon icon="solar:safe-square-linear" width={18} height={18} className="text-neutral-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-neutral-900">Models Registry</p>
            <p className="text-[11px] text-neutral-500 font-geist-mono">
              {loading
                ? "Loading..."
                : `${models.length} model${models.length !== 1 ? "s" : ""} registered · ${cachedCount} cached on pod`}
            </p>
          </div>
        </div>
        <Icon
          icon={expanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
          width={16}
          height={16}
          className="text-neutral-400 shrink-0"
        />
      </button>

      {expanded && (
        <div className="border-t border-neutral-200/60 p-5 space-y-6">
          {/* Import from Civitai */}
          <div>
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-2">
              Import from Civitai
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={civitaiUrl}
                onChange={(e) => setCivitaiUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleImport(); }}
                placeholder="https://civitai.com/models/..."
                className="flex-1 bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-colors font-geist-mono"
              />
              <button
                onClick={handleImport}
                disabled={!civitaiUrl.trim() || importing}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-40"
              >
                {importing ? (
                  <Icon icon="solar:loading-linear" width={16} height={16} className="animate-spin" />
                ) : (
                  <Icon icon="solar:import-linear" width={16} height={16} />
                )}
                Import
              </button>
            </div>
            {importError && (
              <p className="text-xs text-red-500 font-geist-mono mt-2">{importError}</p>
            )}
          </div>

          {/* Models list */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-neutral-100/60 animate-pulse" />
              ))}
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-8">
              <Icon icon="solar:safe-square-linear" width={28} height={28} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">No models registered yet.</p>
              <p className="text-xs text-neutral-400 font-geist-mono mt-1">
                Import a Civitai model above to get started.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono mb-3">
                All Models
              </p>
              <div className="space-y-0.5">
                {models.map((model) => {
                  const folderIcon = FOLDER_ICON[model.target_folder] || "solar:file-linear";
                  const isDownloading = downloading.has(model.id) || model.download_status === "downloading";

                  return (
                    <div
                      key={model.id}
                      className="flex items-center gap-3 py-2.5 border-b border-neutral-100 last:border-0"
                    >
                      {/* Preview or icon */}
                      {model.preview_url ? (
                        <img
                          src={model.preview_url}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover border border-neutral-200/60 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                          <Icon icon={folderIcon} width={16} height={16} className="text-neutral-400" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-neutral-800 truncate">
                          {model.name || model.filename}
                        </p>
                        <p className="text-[10px] text-neutral-400 font-geist-mono truncate">
                          {model.target_folder}
                          {model.base_model ? ` · ${model.base_model}` : ""}
                          {model.size_bytes ? ` · ${formatBytes(model.size_bytes)}` : ""}
                        </p>
                      </div>

                      {/* Status badge / action */}
                      <div className="shrink-0">
                        {model.is_cached ? (
                          <span className="text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                            Cached
                          </span>
                        ) : isDownloading ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            <Icon icon="solar:loading-linear" width={10} height={10} className="animate-spin" />
                            Downloading
                          </span>
                        ) : model.download_status === "failed" ? (
                          <button
                            onClick={() => handleDownload(model.id)}
                            className="flex items-center gap-1 text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                          >
                            <Icon icon="solar:refresh-circle-linear" width={10} height={10} />
                            Retry
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDownload(model.id)}
                            className="flex items-center gap-1 text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                          >
                            <Icon icon="solar:download-linear" width={10} height={10} />
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
