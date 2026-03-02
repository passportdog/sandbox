"use client";

import { useState, useRef } from "react";
import { Icon } from "@iconify/react";
import { useModels, useWorkflowImport, useTemplates } from "@/lib/hooks";

export function VaultPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"models" | "workflows">("models");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white/95 backdrop-blur-2xl border border-neutral-200/80 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white">
              <Icon icon="solar:safe-square-linear" width={18} height={18} />
            </div>
            <h2 className="text-lg font-medium text-neutral-900">Vault</h2>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors">
            <Icon icon="solar:close-circle-linear" width={20} height={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pb-4">
          {(["models", "workflows"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                tab === t
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {t === "models" ? "Models" : "Workflows"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {tab === "models" ? <ModelsTab /> : <WorkflowsTab />}
        </div>
      </div>
    </div>
  );
}

// ─── Models Tab ───

function ModelsTab() {
  const { models, importModel, downloadModel } = useModels();
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleImport = async () => {
    if (!url.trim()) return;
    setImporting(true);
    setResult(null);
    const { data, ok, status } = await importModel(url);
    setResult({
      ok: ok || status === 200,
      message: ok ? `Imported: ${data.name || data.filename} (${data.size_mb}MB)` : data.error || "Import failed",
    });
    if (ok) setUrl("");
    setImporting(false);
  };

  const handleDownload = async (modelId: string) => {
    const { data, ok } = await downloadModel(modelId);
    if (!ok) alert(data.error || "Download failed");
  };

  return (
    <div className="space-y-6">
      {/* Import form */}
      <div className="space-y-3">
        <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">Import from Civitai</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleImport()}
            placeholder="https://civitai.com/models/12345"
            className="flex-1 bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-all text-neutral-800 placeholder:text-neutral-400"
          />
          <button
            onClick={handleImport}
            disabled={importing || !url.trim()}
            className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Icon icon={importing ? "solar:loading-linear" : "solar:download-minimalistic-linear"} width={14} height={14} className={importing ? "animate-spin" : ""} />
            Import
          </button>
        </div>
        {result && (
          <p className={`text-xs font-geist-mono ${result.ok ? "text-emerald-600" : "text-red-500"}`}>{result.message}</p>
        )}
      </div>

      {/* Model list */}
      <div className="space-y-2">
        <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">Registered Models ({models.length})</label>
        {models.length === 0 ? (
          <p className="text-xs text-neutral-400 font-geist-mono py-4 text-center">No models yet. Import one from Civitai above.</p>
        ) : (
          <div className="space-y-2">
            {models.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-white transition-colors">
                {/* Preview */}
                {m.preview_url ? (
                  <img src={m.preview_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-neutral-200 flex items-center justify-center shrink-0">
                    <Icon icon="solar:box-minimalistic-linear" width={16} height={16} className="text-neutral-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-800 truncate">{m.name}</div>
                  <div className="text-[10px] text-neutral-400 font-geist-mono flex items-center gap-2 mt-0.5">
                    <span>{m.target_folder}</span>
                    {m.base_model && <span>· {m.base_model}</span>}
                    {m.size_bytes && <span>· {Math.round(m.size_bytes / 1024 / 1024)}MB</span>}
                  </div>
                </div>

                {/* Status / Action */}
                {m.is_cached ? (
                  <span className="text-[10px] font-medium font-geist-mono px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">Cached</span>
                ) : m.download_status === "downloading" ? (
                  <span className="text-[10px] font-medium font-geist-mono px-2 py-1 rounded-full bg-blue-50 text-blue-600 flex items-center gap-1">
                    <Icon icon="solar:loading-linear" width={10} height={10} className="animate-spin" /> Downloading
                  </span>
                ) : m.download_status === "failed" ? (
                  <button
                    onClick={() => handleDownload(m.id)}
                    className="text-[10px] font-medium font-geist-mono px-2 py-1 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    title={m.download_error || ""}
                  >
                    Retry
                  </button>
                ) : (
                  <button
                    onClick={() => handleDownload(m.id)}
                    className="text-[10px] font-medium font-geist-mono px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                  >
                    Download to Pod
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workflows Tab ───

function WorkflowsTab() {
  const { templates } = useTemplates();
  const { importWorkflow } = useWorkflowImport();
  const [name, setName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; analysis?: Record<string, unknown> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!jsonText.trim()) return;
    setImporting(true);
    setResult(null);

    let workflow: Record<string, unknown>;
    try {
      workflow = JSON.parse(jsonText);
    } catch {
      setResult({ ok: false, message: "Invalid JSON" });
      setImporting(false);
      return;
    }

    const { data, ok } = await importWorkflow(workflow, name || undefined);
    setResult({
      ok,
      message: ok
        ? `Created template: ${data.name} (${data.analysis?.node_count} nodes, ${data.analysis?.models?.length} models)`
        : data.error || "Import failed",
      analysis: ok ? data.analysis : undefined,
    });
    if (ok) { setJsonText(""); setName(""); }
    setImporting(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonText(ev.target?.result as string || "");
      if (!name) setName(file.name.replace(/\.json$/, ""));
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Import form */}
      <div className="space-y-3">
        <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">Import Workflow</label>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workflow name (optional)"
          className="w-full bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-sm rounded-xl px-4 py-2.5 outline-none transition-all text-neutral-800 placeholder:text-neutral-400"
        />

        <div className="relative">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='Paste ComfyUI workflow JSON (API format)...'
            className="w-full bg-neutral-50 border border-neutral-200 focus:border-neutral-300 focus:bg-white text-xs font-geist-mono rounded-xl px-4 py-3 outline-none transition-all text-neutral-800 placeholder:text-neutral-400 min-h-[120px] resize-y"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute top-2 right-2 p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <Icon icon="solar:upload-linear" width={16} height={16} />
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleFile} className="hidden" />
        </div>

        <button
          onClick={handleImport}
          disabled={importing || !jsonText.trim()}
          className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Icon icon={importing ? "solar:loading-linear" : "solar:import-linear"} width={14} height={14} className={importing ? "animate-spin" : ""} />
          Analyze &amp; Import
        </button>

        {result && (
          <div className={`text-xs font-geist-mono p-3 rounded-xl ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {result.message}
            <MissingModels analysis={result.analysis} />
          </div>
        )}
      </div>

      {/* Template list */}
      <div className="space-y-2">
        <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest font-geist-mono">Templates ({templates.length})</label>
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 bg-neutral-50/50">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
              <Icon icon="solar:document-text-linear" width={16} height={16} className="text-neutral-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-neutral-800 truncate">{t.name}</div>
              <div className="text-[10px] text-neutral-400 font-geist-mono flex items-center gap-2 mt-0.5">
                <span>{t.slug}</span>
                <span>· {t.category}</span>
                {t.required_models?.length > 0 && <span>· {t.required_models.length} models</span>}
              </div>
            </div>
            <span className={`text-[10px] font-medium font-geist-mono px-2 py-1 rounded-full ${t.is_active ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-400"}`}>
              {t.is_active ? "Active" : "Disabled"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissingModels({ analysis }: { analysis?: Record<string, unknown> }) {
  if (!analysis) return null;
  const mm = analysis.missing_models;
  if (!Array.isArray(mm) || mm.length === 0) return null;
  const filenames = mm.map((m: Record<string, string>) => m.filename).join(", ");
  return <div className="mt-2 text-amber-600">Missing models: {filenames}</div>;
}
