"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useModels } from "@/lib/hooks";
import type { DbModel } from "@/lib/db-types";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, string> = {
  cached:      "solar:check-circle-linear",
  downloading: "solar:loading-linear",
  queued:      "solar:clock-circle-linear",
  error:       "solar:close-circle-linear",
  registered:  "solar:box-minimalistic-linear",
};

const STATUS_COLOR: Record<string, string> = {
  cached:      "text-emerald-500",
  downloading: "text-blue-500",
  queued:      "text-amber-500",
  error:       "text-red-400",
  registered:  "text-neutral-400",
};

const STATUS_LABEL: Record<string, string> = {
  cached:      "Cached",
  downloading: "Downloading",
  queued:      "Queued",
  error:       "Error",
  registered:  "Registered",
};

// ─── ModelRow ─────────────────────────────────────────────────────────────────

function ModelRow({ model, onDownload, downloading }: {
  model: DbModel;
  onDownload: (id: string) => void;
  downloading: boolean;
}) {
  const status = model.download_status ?? "registered";
  const icon   = STATUS_ICON[status]  ?? "solar:box-minimalistic-linear";
  const color  = STATUS_COLOR[status] ?? "text-neutral-400";
  const label  = STATUS_LABEL[status] ?? status;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-neutral-50 last:border-0">
      {/* Status icon */}
      <Icon
        icon={icon}
        width={14}
        height={14}
        className={`shrink-0 ${color} ${status === "downloading" ? "animate-spin" : ""}`}
      />

      {/* Filename + folder */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-geist-mono text-neutral-700 truncate">{model.filename}</p>
        <p className="text-[10px] font-geist-mono text-neutral-400">{model.folder}/</p>
      </div>

      {/* Chips */}
      <div className="flex items-center gap-1.5 shrink-0">
        {model.base_model && (
          <span className="text-[10px] font-geist-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            {model.base_model}
          </span>
        )}
        {model.size_mb && (
          <span className="text-[10px] font-geist-mono text-neutral-400">{model.size_mb} MB</span>
        )}
        <span className={`text-[10px] font-geist-mono ${color}`}>{label}</span>
      </div>

      {/* Download button if registered but not cached */}
      {status === "registered" && (
        <button
          onClick={() => onDownload(model.id)}
          disabled={downloading}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-neutral-900 text-white rounded-lg text-[10px] font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40"
        >
          {downloading
            ? <Icon icon="solar:loading-linear" width={10} height={10} className="animate-spin" />
            : <Icon icon="solar:download-minimalistic-linear" width={10} height={10} />}
          Download
        </button>
      )}
    </div>
  );
}

// ─── ModelsSection ────────────────────────────────────────────────────────────

export function ModelsSection() {
  const { models, importModel, downloadModel } = useModels();
  const [expanded, setExpanded]    = useState(false);
  const [civitaiUrl, setCivitaiUrl] = useState("");
  const [importing, setImporting]  = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const cachedCount = models.filter((m) => m.download_status === "cached").length;

  const handleImport = async () => {
    const trimmed = civitaiUrl.trim();
    if (!trimmed || importing) return;
    setImporting(true);
    setImportError(null);

    const { ok, data } = await importModel(trimmed);
    if (ok) {
      setCivitaiUrl("");
    } else {
      setImportError(data?.error ?? "Import failed");
    }
    setImporting(false);
  };

  const handleDownload = async (id: string) => {
    setDownloading((d) => ({ ...d, [id]: true }));
    await downloadModel(id);
    setDownloading((d) => ({ ...d, [id]: false }));
  };

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-neutral-200/60 rounded-2xl overflow-hidden">
      {/* Summary header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-neutral-50/60 transition-colors text-left"
      >
        <Icon icon="solar:box-minimalistic-linear" width={16} height={16} className="text-neutral-400 shrink-0" />
        <span className="text-sm font-medium text-neutral-900">Model Registry</span>
        <span className="text-[10px] font-geist-mono text-neutral-400 flex-1">
          {models.length === 0
            ? "No models yet"
            : `${models.length} registered · ${cachedCount} cached on pod`}
        </span>
        <Icon
          icon={expanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
          width={14}
          height={14}
          className="text-neutral-300 shrink-0"
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-neutral-100 px-5 py-4 space-y-4">
          {/* Import form */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">
              Import from Civitai
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={civitaiUrl}
                onChange={(e) => setCivitaiUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleImport()}
                placeholder="https://civitai.com/models/…"
                className="flex-1 bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-xs rounded-xl px-4 py-2 outline-none transition-all font-geist-mono placeholder:text-neutral-400"
              />
              <button
                onClick={handleImport}
                disabled={importing || !civitaiUrl.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                {importing
                  ? <Icon icon="solar:loading-linear" width={13} height={13} className="animate-spin" />
                  : <Icon icon="solar:import-linear" width={13} height={13} />}
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
            {importError && (
              <p className="text-[11px] text-red-500 font-geist-mono flex items-center gap-1.5">
                <Icon icon="solar:danger-circle-linear" width={12} height={12} />
                {importError}
              </p>
            )}
          </div>

          {/* Model list */}
          {models.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-neutral-300">
              <Icon icon="solar:box-minimalistic-linear" width={28} height={28} />
              <p className="text-xs font-geist-mono">No models imported yet.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {models.map((m) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  onDownload={handleDownload}
                  downloading={!!downloading[m.id]}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
