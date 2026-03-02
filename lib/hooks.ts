"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DbJob, DbPodInstance, DbTemplate, DbJobEvent, DbModel } from "@/lib/db-types";

// ─── Jobs ───

export function useJobs() {
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    const res = await fetch("/api/jobs");
    if (res.ok) setJobs(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
    const ch = supabase
      .channel("jobs-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => fetchJobs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchJobs]);

  const createJob = async (inputText: string, idempotencyKey?: string) => {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input_text: inputText, idempotency_key: idempotencyKey }),
    });
    const job = await res.json();
    if (res.ok) setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
    return { data: job, ok: res.ok, status: res.status };
  };

  const planJob = async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}/plan`, { method: "POST" });
    return { data: await res.json(), ok: res.ok, status: res.status };
  };

  const executeJob = async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}/execute`, { method: "POST" });
    return { data: await res.json(), ok: res.ok, status: res.status };
  };

  const retryJob = async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
    return { data: await res.json(), ok: res.ok, status: res.status };
  };

  const cancelJob = async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
    return { data: await res.json(), ok: res.ok, status: res.status };
  };

  return { jobs, loading, createJob, planJob, executeJob, retryJob, cancelJob, refetch: fetchJobs };
}

// ─── Job Detail ───

export function useJobDetail(jobId: string | null) {
  const [job, setJob] = useState<DbJob | null>(null);
  const [events, setEvents] = useState<DbJobEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    const res = await fetch(`/api/jobs/${jobId}`);
    if (res.ok) {
      const data = await res.json();
      setJob(data);
      setEvents(data.events || []);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    setLoading(true);
    fetchJob();
    if (!jobId) return;

    const ch = supabase
      .channel(`job-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${jobId}` }, () => fetchJob())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "job_events", filter: `job_id=eq.${jobId}` }, () => fetchJob())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [jobId, fetchJob]);

  return { job, events, loading, refetch: fetchJob };
}

// ─── Pods ───

export function usePods() {
  const [pods, setPods] = useState<DbPodInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPods = useCallback(async () => {
    const res = await fetch("/api/pods");
    if (res.ok) setPods(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPods();
    const ch = supabase
      .channel("pods-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_instances" }, () => fetchPods())
      .subscribe();

    // Poll non-terminal pods every 15s for fast bootstrap feedback
    const pollInterval = setInterval(async () => {
      try { await fetch("/api/pods/poll"); } catch {}
    }, 15000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(pollInterval);
    };
  }, [fetchPods]);

  const createPod = async (options?: { gpu?: string; name?: string; image?: string }) => {
    const res = await fetch("/api/pods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options || {}),
    });
    const pod = await res.json();
    if (res.ok) setPods((prev) => [pod, ...prev]);
    return pod;
  };

  const podAction = async (podId: string, action: string) => {
    const res = await fetch("/api/pods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pod_id: podId, action }),
    });
    if (res.ok) fetchPods();
    return res.json();
  };

  return { pods, loading, createPod, podAction, refetch: fetchPods };
}

// ─── Templates ───

export function useTemplates() {
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates").then(async (res) => {
      if (res.ok) setTemplates(await res.json());
      setLoading(false);
    });
  }, []);

  return { templates, loading };
}

// ─── Models ───

export interface ModelEntry {
  id: string;
  name: string;
  filename: string;
  target_folder: string;
  model_type: string | null;
  base_model: string | null;
  is_cached: boolean;
  download_status: string;
  download_error: string | null;
  preview_url: string | null;
  size_bytes: number | null;
}

export function useModels() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    const res = await fetch("/api/models");
    if (res.ok) setModels(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchModels();
    const ch = supabase
      .channel("models-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "models_registry" }, () => fetchModels())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchModels]);

  const importModel = async (url: string) => {
    const res = await fetch("/api/models/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (res.ok || res.status === 200) fetchModels();
    return { data, ok: res.ok || res.status === 200, status: res.status };
  };

  const downloadModel = async (modelId: string, podId?: string) => {
    const res = await fetch(`/api/models/${modelId}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(podId ? { pod_id: podId } : {}),
    });
    const data = await res.json();
    if (res.ok) fetchModels();
    return { data, ok: res.ok, status: res.status };
  };

  return { models, loading, importModel, downloadModel, refetch: fetchModels };
}

// ─── Workflow Import ───

export function useWorkflowImport() {
  const importWorkflow = async (workflow: Record<string, unknown>, name?: string, description?: string) => {
    const res = await fetch("/api/workflows/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow, name, description }),
    });
    return { data: await res.json(), ok: res.ok, status: res.status };
  };

  return { importWorkflow };
}

// ─── Workflow Run (the core product action) ───

export function useWorkflowRun() {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);

  const runWorkflow = async (
    slug: string,
    params: Record<string, unknown>,
    options?: { wait?: boolean; pod_id?: string }
  ) => {
    setRunning(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/workflows/${slug}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, ...options }),
      });
      const data = await res.json();
      setLastResult(data);
      return { data, ok: res.ok, status: res.status };
    } catch (err) {
      const errorResult = { error: err instanceof Error ? err.message : "Run failed" };
      setLastResult(errorResult);
      return { data: errorResult, ok: false, status: 0 };
    } finally {
      setRunning(false);
    }
  };

  return { runWorkflow, running, lastResult };
}
