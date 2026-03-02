"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ModelEntry, ImportReport } from "@/lib/import-types";

// ─── Models ───

export function useModels() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (res.ok) setModels(await res.json());
    } catch {
      // API not yet implemented — gracefully no-op
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
    const ch = supabase
      .channel("models-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "model_registry" }, () => fetchModels())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchModels]);

  const importModel = async (url: string): Promise<ImportReport> => {
    const res = await fetch("/api/models/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `Import failed (${res.status})`);
    }
    return res.json();
  };

  const downloadModel = async (modelId: string): Promise<void> => {
    const res = await fetch(`/api/models/${modelId}/download`, { method: "POST" });
    if (res.ok) fetchModels();
  };

  return { models, loading, importModel, downloadModel, refetch: fetchModels };
}

// ─── Workflow Import ───

export function useWorkflowImport() {
  const importWorkflow = async (
    workflow: Record<string, unknown>,
    name: string
  ): Promise<ImportReport> => {
    const res = await fetch("/api/workflows/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `Workflow import failed (${res.status})`);
    }
    return res.json();
  };

  return { importWorkflow };
}
