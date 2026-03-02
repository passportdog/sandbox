"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DbJob, DbPodInstance, DbTemplate, DbJobEvent } from "@/lib/db-types";

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
    return () => { supabase.removeChannel(ch); };
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
