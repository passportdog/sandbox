// Database row types (matches Supabase schema)

export interface DbJob {
  id: string;
  status: "pending" | "planning" | "planned" | "approved" | "provisioning" | "bootstrapping" | "executing" | "completed" | "failed" | "cancelled";
  input_text: string | null;
  plan: Record<string, unknown> | null;
  template_id: string | null;
  params: Record<string, unknown> | null;
  pod_instance_id: string | null;
  prompt_id: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  gpu_seconds: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  workflow_templates?: { name: string; slug: string; category: string } | null;
  pod_instances?: { status: string; gpu_type: string; comfyui_url: string } | null;
  events?: DbJobEvent[];
  outputs?: DbOutput[];
}

export interface DbJobEvent {
  id: string;
  job_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export interface DbOutput {
  id: string;
  job_id: string;
  file_type: string;
  storage_path: string | null;
  public_url: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbPodInstance {
  id: string;
  runpod_pod_id: string;
  template_name: string | null;
  gpu_type: string | null;
  status: string;
  ip_address: string | null;
  comfyui_port: number;
  comfyui_url: string | null;
  volume_id: string | null;
  cost_per_hour: number | null;
  last_used_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  required_models: string[];
  required_node_packs: string[];
  param_schema: Record<string, unknown> | null;
  is_active: boolean;
}

// Status colors and labels
export const JOB_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-slate-400", label: "Pending" },
  planning: { color: "bg-blue-400 animate-pulse", label: "Planning..." },
  planned: { color: "bg-indigo-400", label: "Planned" },
  approved: { color: "bg-cyan-400", label: "Approved" },
  provisioning: { color: "bg-yellow-400 animate-pulse", label: "Provisioning..." },
  bootstrapping: { color: "bg-orange-400 animate-pulse", label: "Bootstrapping..." },
  executing: { color: "bg-amber-400 animate-pulse", label: "Executing..." },
  completed: { color: "bg-emerald-400", label: "Completed" },
  failed: { color: "bg-red-400", label: "Failed" },
  cancelled: { color: "bg-slate-300", label: "Cancelled" },
};

export const POD_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  creating: { color: "bg-yellow-400 animate-pulse", label: "Starting..." },
  running: { color: "bg-blue-400", label: "Running" },
  bootstrapping: { color: "bg-orange-400 animate-pulse", label: "Bootstrapping..." },
  ready: { color: "bg-emerald-400", label: "Ready" },
  stopping: { color: "bg-yellow-400", label: "Stopping..." },
  stopped: { color: "bg-slate-400", label: "Stopped" },
  terminated: { color: "bg-red-400", label: "Terminated" },
  error: { color: "bg-red-500", label: "Error" },
};
