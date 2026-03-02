"use client";

import { useState, useRef } from "react";
import { Icon } from "@iconify/react";
import { useModels, useWorkflowImport } from "@/lib/import-hooks";
import type { ImportReport } from "@/lib/import-types";

type ImportType = "civitai_url" | "workflow_api" | "workflow_ui" | "unknown";

function detectImportType(input: string): ImportType {
  const trimmed = input.trim();

  if (trimmed.match(/^https?:\/\/(www\.)?civitai\.com\/models\//)) {
    return "civitai_url";
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) return "unknown";
    if (Array.isArray(parsed.nodes)) return "workflow_ui";
    const keys = Object.keys(parsed);
    if (keys.length > 0) {
      const first = parsed[keys[0]];
      if (first?.class_type) return "workflow_api";
    }
  } catch {
    // Not JSON
  }

  return "unknown";
}

const TYPE_BADGE: Record<ImportType, { label: string; color: string }> = {
  civitai_url:  { label: "Civitai URL",              color: "bg-blue-50 text-blue-600" },
  workflow_api: { label: "Workflow JSON (API format)", color: "bg-emerald-50 text-emerald-600" },
  workflow_ui:  { label: "Workflow JSON (UI format)",  color: "bg-amber-50 text-amber-600" },
  unknown:      { label: "Unknown format",             color: "bg-neutral-100 text-neutral-500" },
};

interface ImportPanelProps {
  onReport: (report: ImportReport) => void;
}

export function ImportPanel({ onReport }: ImportPanelProps) {
  const [input, setInput] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importModel } = useModels();
  const { importWorkflow } = useWorkflowImport();

  const trimmed = input.trim();
  const detectedType = trimmed ? detectImportType(trimmed) : null;
  const badge = detectedType ? TYPE_BADGE[detectedType] : null;
  const showNameInput = detectedType === "workflow_api";

  const canImport =
    !!trimmed &&
    !loading &&
    detectedType !== "unknown" &&
    detectedType !== "workflow_ui" &&
    detectedType !== null;

  const handleImport = async () => {
    if (!canImport) return;
    setLoading(true);
    setError(null);

    try {
      if (detectedType === "civitai_url") {
        const result = await importModel(trimmed);
        onReport(result);
      } else if (detectedType === "workflow_api") {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const name = workflowName.trim() || "Untitled Workflow";
        const result = await importWorkflow(parsed, name);
        onReport(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      setError("Only .json files are supported.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setInput(e.target?.result as string ?? "");
      setError(null);
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white/95 backdrop-blur-2xl border border-neutral-200/80 rounded-3xl shadow-lg p-8">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">Import Anything</h2>
        <p className="text-sm text-neutral-500 mt-1 font-geist-mono">
          Paste a Civitai model URL or ComfyUI workflow JSON
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className={`relative rounded-2xl border-2 transition-all ${
          isDragging
            ? "border-neutral-400 bg-neutral-50"
            : "border-dashed border-neutral-200 hover:border-neutral-300"
        }`}
      >
        <textarea
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleImport(); } }}
          placeholder="Paste a Civitai model URL, ComfyUI workflow JSON, or drag a .json file here"
          className="w-full bg-transparent px-6 pt-5 pb-5 outline-none text-sm text-neutral-800 placeholder:text-neutral-400 min-h-[140px] resize-none rounded-2xl font-geist-mono leading-relaxed"
        />
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-50/80 rounded-2xl">
            <div className="flex flex-col items-center gap-2 text-neutral-500">
              <Icon icon="solar:upload-linear" width={32} height={32} />
              <span className="text-sm font-medium">Drop .json file here</span>
            </div>
          </div>
        )}
      </div>

      {/* Workflow name input (appears when API workflow detected) */}
      {showNameInput && (
        <div className="mt-3">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Workflow name (optional)"
            className="w-full bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-colors"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-geist-mono">
          {error}
        </div>
      )}

      {/* UI format warning */}
      {detectedType === "workflow_ui" && (
        <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 font-geist-mono">
          This is UI format. Export as API format in ComfyUI: Settings → Enable Dev Mode → &ldquo;Save (API Format)&rdquo;
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-3">
          {badge && trimmed && (
            <span className={`text-[10px] font-medium font-geist-mono px-2 py-1 rounded-full ${badge.color}`}>
              {badge.label}
            </span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors font-geist-mono"
          >
            <Icon icon="solar:file-linear" width={14} height={14} />
            Browse .json
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        <button
          onClick={handleImport}
          disabled={!canImport}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Icon icon="solar:loading-linear" width={16} height={16} className="animate-spin" />
          ) : (
            <Icon icon="solar:import-linear" width={16} height={16} />
          )}
          {loading ? "Analyzing..." : "Import & Analyze"}
        </button>
      </div>
    </div>
  );
}
