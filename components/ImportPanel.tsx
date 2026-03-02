"use client";

import { useState, useRef, useCallback } from "react";
import { Icon } from "@iconify/react";
import { useModels, useWorkflowImport } from "@/lib/hooks";

// ─── Shared ImportReport type ───────────────────────────────────────────────

export interface WorkflowModelRef {
  filename: string;
  folder: string;
  nodeType: string;
  status: "cached" | "registered" | "missing";
  registryId?: string;
}

export interface ImportReport {
  type: "model" | "workflow";

  // Workflow fields
  templateId?: string;
  templateName?: string;
  templateSlug?: string;
  category?: string;
  nodeCount?: number;
  models?: WorkflowModelRef[];
  customNodes?: string[];
  paramSchema?: Record<string, {
    node: string;
    field: string;
    type: "string" | "integer" | "number";
    default?: unknown;
  }>;
  missingModels?: string[];

  // Model fields
  modelId?: string;
  modelName?: string;
  modelFilename?: string;
  modelFolder?: string;
  modelSizeMb?: number;
  baseModel?: string;
  downloadStatus?: string;
  previewUrl?: string;
}

// ─── Detection ─────────────────────────────────────────────────────────────

type ImportType = "civitai_url" | "workflow_api" | "workflow_ui" | "unknown";

function detectImportType(input: string): ImportType {
  const trimmed = input.trim();
  if (trimmed.match(/^https?:\/\/(www\.)?civitai\.com\/models\//)) return "civitai_url";
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object") return "unknown";
    if (Array.isArray((parsed as Record<string, unknown>).nodes)) return "workflow_ui";
    const keys = Object.keys(parsed);
    if (keys.length > 0) {
      const first = (parsed as Record<string, unknown>)[keys[0]];
      if (first && typeof first === "object" && "class_type" in (first as Record<string, unknown>)) return "workflow_api";
    }
  } catch { /* not JSON */ }
  return "unknown";
}

const TYPE_LABELS: Record<ImportType, string> = {
  civitai_url:  "Civitai URL",
  workflow_api: "ComfyUI Workflow (API format)",
  workflow_ui:  "ComfyUI Workflow (UI format — needs export)",
  unknown:      "Unknown",
};

const TYPE_COLORS: Record<ImportType, string> = {
  civitai_url:  "bg-blue-50 text-blue-600",
  workflow_api: "bg-emerald-50 text-emerald-600",
  workflow_ui:  "bg-amber-50 text-amber-600",
  unknown:      "bg-neutral-100 text-neutral-400",
};

// ─── ImportPanel Component ──────────────────────────────────────────────────

interface ImportPanelProps {
  onReport: (report: ImportReport) => void;
}

export function ImportPanel({ onReport }: ImportPanelProps) {
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { importModel } = useModels();
  const { importWorkflow } = useWorkflowImport();

  const detected = input.trim() ? detectImportType(input) : null;

  // ── Drag + drop ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setInput(reader.result); };
    reader.readAsText(file);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setInput(reader.result); };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Import action ──
  const handleImport = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const type = detectImportType(input.trim());

      if (type === "workflow_ui") {
        setError("This looks like ComfyUI UI format. Open ComfyUI → menu → Save (API Format) to get the right file.");
        return;
      }

      if (type === "civitai_url") {
        const { data, ok } = await importModel(input.trim());
        if (!ok) { setError(data.error ?? "Import failed"); return; }
        onReport({
          type: "model",
          modelId: data.id,
          modelName: data.name,
          modelFilename: data.filename,
          modelFolder: data.folder,
          modelSizeMb: data.size_mb,
          baseModel: data.base_model,
          downloadStatus: data.download_status,
          previewUrl: data.preview_url,
        });
        setInput("");
        return;
      }

      if (type === "workflow_api") {
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(input.trim()); }
        catch { setError("Invalid JSON"); return; }

        const { data, ok } = await importWorkflow(parsed, name.trim() || undefined);
        if (!ok) { setError(data.error ?? "Import failed"); return; }

        // Build model status from API response
        const missingSet  = new Set<string>(data.missing_models ?? []);
        const uncachedSet = new Set<string>(data.uncached_models ?? []);
        const models = (data.analysis?.models ?? []).map((m: { filename: string; folder: string; loaderNode: string }) => ({
          filename: m.filename,
          folder:   m.folder,
          nodeType: m.loaderNode,
          status: missingSet.has(m.filename) ? "missing"
                : uncachedSet.has(m.filename) ? "registered"
                : "cached",
        } as WorkflowModelRef));

        onReport({
          type: "workflow",
          templateId:   data.id,
          templateName: data.name,
          templateSlug: data.slug,
          category:     data.category,
          nodeCount:    data.analysis?.node_count,
          models,
          customNodes:  data.analysis?.custom_nodes ?? [],
          paramSchema:  data.analysis?.param_schema,
          missingModels: data.missing_models ?? [],
        });
        setInput("");
        setName("");
        return;
      }

      setError("Couldn't detect the input type. Paste a Civitai URL or ComfyUI API-format JSON.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-2xl border border-neutral-200/80 rounded-3xl shadow-lg p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white shrink-0">
          <Icon icon="solar:import-linear" width={18} height={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Import Anything</h2>
          <p className="text-xs text-neutral-400 font-geist-mono">Civitai model URL · ComfyUI workflow JSON · .json file</p>
        </div>
      </div>

      {/* Optional name for workflows */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Template name (optional, for workflows)"
        className="w-full bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-all placeholder:text-neutral-400"
      />

      {/* Main input + drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 transition-colors ${
          dragging
            ? "border-neutral-400 bg-neutral-50"
            : "border-dashed border-neutral-200 hover:border-neutral-300"
        }`}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Paste a Civitai model URL, ComfyUI workflow JSON, or drag a .json file here…`}
          rows={6}
          className="w-full bg-transparent px-5 py-4 outline-none text-sm text-neutral-800 placeholder:text-neutral-400 font-geist-mono resize-none rounded-2xl"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute top-3 right-3 p-2 text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          title="Upload .json file"
        >
          <Icon icon="solar:upload-linear" width={16} height={16} />
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />

        {/* Drag overlay */}
        {dragging && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-neutral-50/80">
            <div className="flex flex-col items-center gap-2 text-neutral-400">
              <Icon icon="solar:upload-linear" width={28} height={28} />
              <span className="text-sm font-medium">Drop .json file</span>
            </div>
          </div>
        )}
      </div>

      {/* Type badge */}
      {detected && (
        <div className="flex items-center gap-2">
          <Icon
            icon={detected === "workflow_api" ? "solar:check-circle-linear"
                : detected === "civitai_url"   ? "solar:link-circle-linear"
                : detected === "workflow_ui"    ? "solar:danger-triangle-linear"
                : "solar:question-circle-linear"}
            width={14}
            height={14}
            className={detected === "workflow_ui" ? "text-amber-500" : detected === "workflow_api" ? "text-emerald-500" : "text-neutral-400"}
          />
          <span className={`text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full ${TYPE_COLORS[detected]}`}>
            {TYPE_LABELS[detected]}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-500 font-geist-mono bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <Icon icon="solar:danger-circle-linear" width={14} height={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={loading || !input.trim() || detected === "workflow_ui" || detected === "unknown"}
        className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {loading
          ? <Icon icon="solar:loading-linear" width={16} height={16} className="animate-spin" />
          : <Icon icon="solar:magnifer-linear" width={16} height={16} />}
        {loading ? "Analyzing…" : "Import & Analyze"}
      </button>
    </div>
  );
}
