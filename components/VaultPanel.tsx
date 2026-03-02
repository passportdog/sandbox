"use client";

import { useState, useRef } from "react";
import { Icon } from "@iconify/react";
import { useModels, useTemplates, useWorkflowImport } from "@/lib/hooks";
import { MODEL_STATUS_CONFIG } from "@/lib/db-types";
import type { DbModel, DbTemplate } from "@/lib/db-types";

interface VaultPanelProps {
  open: boolean;
  onClose: () => void;
}

export function VaultPanel({ open, onClose }: VaultPanelProps) {
  const [tab, setTab] = useState<"models" | "workflows">("models");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white/95 backdrop-blur-2xl border border-neutral-200/80 rounded-3xl shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white">
              <Icon icon="solar:safe-square-linear" width={18} height={18} />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">Vault</h2>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors">
            <Icon icon="solar:close-circle-linear" width={20} height={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          <TabButton active={tab === "models"} onClick={() => setTab("models")} icon="solar:box-minimalistic-linear" label="Models" />
          <TabButton active={tab === "workflows"} onClick={() => setTab("workflows")} icon="solar:code-square-linear" label="Workflows" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "models" ? <ModelsTab /> : <WorkflowsTab />}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Button ───

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
        active
          ? "bg-neutral-900 text-white shadow-sm"
          : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
      }`}
    >
      <Icon icon={icon} width={16} height={16} />
      {label}
    </button>
  );
}

// ═══════════════════  MODELS TAB  ═══════════════════

function ModelsTab() {
  const { models, importModel, downloadModel } = useModels();
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!url.trim() || importing) return;
    setImporting(true);
    setImportError(null);
    const { ok, data } = await importModel(url);
    if (!ok) setImportError(data.error || "Import failed");
    else setUrl("");
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      {/* Import form */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-widest font-geist-mono">Import from Civitai</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleImport(); }}
            placeholder="https://civitai.com/models/12345"
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl text-sm px-4 py-2.5 outline-none focus:border-neutral-300 focus:bg-white transition-all text-neutral-800 placeholder:text-neutral-400"
          />
          <button
            onClick={handleImport}
            disabled={importing || !url.trim()}
            className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importing ? <Icon icon="solar:loading-linear" width={16} height={16} className="animate-spin" /> : <Icon icon="solar:download-minimalistic-linear" width={16} height={16} />}
            Import
          </button>
        </div>
        {importError && <p className="text-xs text-red-500 font-geist-mono">{importError}</p>}
      </div>

      {/* Model list */}
      {models.length === 0 ? (
        <div className="text-center py-12 text-sm text-neutral-400 font-geist-mono">
          No models imported yet. Paste a Civitai URL above to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {models.map((model) => (
            <ModelRow key={model.id} model={model} onDownload={downloadModel} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelRow({ model, onDownload }: { model: DbModel; onDownload: (id: string) => Promise<unknown> }) {
  const cfg = MODEL_STATUS_CONFIG[model.download_status] || MODEL_STATUS_CONFIG.pending;
  const sizeMb = model.size_bytes ? (model.size_bytes / 1024 / 1024).toFixed(0) : null;

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-neutral-100 hover:border-neutral-200 transition-colors bg-white">
      {/* Preview */}
      {model.preview_url ? (
        <img src={model.preview_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
          <Icon icon="solar:box-minimalistic-linear" width={20} height={20} className="text-neutral-300" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-900 truncate">{model.name}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400 font-geist-mono">
          <span>{model.target_folder}</span>
          {model.base_model && <><span className="text-neutral-200">|</span><span>{model.base_model}</span></>}
          {sizeMb && <><span className="text-neutral-200">|</span><span>{sizeMb} MB</span></>}
        </div>
      </div>

      {/* Status / Action */}
      <div className="shrink-0">
        {model.download_status === "completed" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-medium font-geist-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Cached
          </span>
        )}
        {model.download_status === "downloading" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-medium font-geist-mono">
            <Icon icon="solar:loading-linear" width={12} height={12} className="animate-spin" />
            Downloading
          </span>
        )}
        {model.download_status === "failed" && (
          <button
            onClick={() => onDownload(model.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-medium font-geist-mono hover:bg-red-100 transition-colors"
          >
            <Icon icon="solar:refresh-circle-linear" width={12} height={12} />
            Retry
          </button>
        )}
        {model.download_status === "pending" && (
          <button
            onClick={() => onDownload(model.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-medium font-geist-mono hover:bg-neutral-200 transition-colors"
          >
            <Icon icon="solar:download-minimalistic-linear" width={12} height={12} />
            Download to Pod
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════  WORKFLOWS TAB  ═══════════════════

function WorkflowsTab() {
  const { templates } = useTemplates();
  const { importWorkflow, importing } = useWorkflowImport();
  const [name, setName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!jsonText.trim() || importing) return;
    setImportError(null);
    setImportResult(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setImportError("Invalid JSON. Please paste a valid ComfyUI API-format workflow.");
      return;
    }

    const { ok, data } = await importWorkflow(parsed, name || undefined);
    if (ok) {
      setImportResult(data);
      setJsonText("");
      setName("");
    } else {
      setImportError(data.error || "Import failed");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setJsonText(reader.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Import form */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-widest font-geist-mono">Import Workflow</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (optional)"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl text-sm px-4 py-2.5 outline-none focus:border-neutral-300 focus:bg-white transition-all text-neutral-800 placeholder:text-neutral-400"
        />
        <div className="relative">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Paste ComfyUI API-format JSON here..."
            rows={6}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl text-xs px-4 py-3 outline-none focus:border-neutral-300 focus:bg-white transition-all text-neutral-800 placeholder:text-neutral-400 font-geist-mono resize-none"
          />
          <button
            onClick={() => fileInput.current?.click()}
            className="absolute top-2 right-2 p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <Icon icon="solar:upload-linear" width={16} height={16} />
          </button>
          <input ref={fileInput} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
        </div>
        <button
          onClick={handleImport}
          disabled={importing || !jsonText.trim()}
          className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {importing ? <Icon icon="solar:loading-linear" width={16} height={16} className="animate-spin" /> : <Icon icon="solar:code-square-linear" width={16} height={16} />}
          Analyze & Import
        </button>
        {importError && <p className="text-xs text-red-500 font-geist-mono">{importError}</p>}

        {/* Import result */}
        {importResult && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Icon icon="solar:check-circle-linear" width={16} height={16} />
              Imported: {importResult.name as string}
            </div>
            <div className="text-xs text-emerald-600 font-geist-mono space-y-1">
              <p>{(importResult.analysis as Record<string, unknown>)?.node_count as number} nodes | Category: {importResult.category as string}</p>
              {((importResult.missing_models as string[]) || []).length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 mt-2 text-amber-600">
                  <p className="font-medium">Missing models:</p>
                  {(importResult.missing_models as string[]).map((m) => <p key={m}>{m}</p>)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Template list */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-widest font-geist-mono">Registered Templates</label>
        {templates.length === 0 ? (
          <div className="text-center py-8 text-sm text-neutral-400 font-geist-mono">
            No templates yet. Import a ComfyUI workflow above.
          </div>
        ) : (
          templates.map((t) => <TemplateRow key={t.id} template={t} />)
        )}
      </div>
    </div>
  );
}

function TemplateRow({ template }: { template: DbTemplate }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-neutral-100 hover:border-neutral-200 transition-colors bg-white">
      <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
        <Icon icon="solar:code-square-linear" width={18} height={18} className="text-neutral-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-900 truncate">{template.name}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400 font-geist-mono">
          <span>{template.slug}</span>
          {template.category && <><span className="text-neutral-200">|</span><span>{template.category}</span></>}
          <span className="text-neutral-200">|</span>
          <span>{template.required_models?.length || 0} models</span>
        </div>
      </div>
      <span className={`text-[10px] font-medium font-geist-mono px-2 py-0.5 rounded-full ${
        template.is_active ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-400"
      }`}>
        {template.is_active ? "Active" : "Inactive"}
      </span>
    </div>
  );
}
