// RunPod REST API Client
// Docs: https://docs.runpod.io/api-reference

const RUNPOD_API_URL = "https://api.runpod.io/graphql";
const RUNPOD_REST_URL = "https://rest.runpod.io/v1";

function getApiKey(): string {
  const key = process.env.RUNPOD_API_KEY;
  if (!key) throw new Error("RUNPOD_API_KEY not set");
  return key;
}

async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(RUNPOD_API_URL + `?api_key=${getApiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

/** REST API helper — more reliable than GraphQL for pod operations */
async function rest(path: string, options?: RequestInit) {
  const res = await fetch(`${RUNPOD_REST_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
      ...options?.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`RunPod REST ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

// ---------- Pod operations ----------

export interface PodConfig {
  name: string;
  imageId?: string; // Docker image — not needed if templateId is set
  gpuTypeId: string; // e.g. "NVIDIA RTX A5000"
  templateId?: string;
  volumeInGb?: number;
  containerDiskInGb?: number;
  ports?: string; // e.g. "8188/http,22/tcp"
  env?: Record<string, string>;
  networkVolumeId?: string;
  volumeMountPath?: string;
}

export interface Pod {
  id: string;
  name: string;
  runtime: {
    uptimeInSeconds: number;
    ports: { ip: string; isIpPublic: boolean; privatePort: number; publicPort: number; type: string }[];
    gpus: { id: string; gpuUtilPercent: number; memoryUtilPercent: number }[];
  } | null;
  desiredStatus: string;
  imageName: string;
  machine: { gpuDisplayName: string } | null;
  costPerHr: number;
}

export async function createPod(config: PodConfig): Promise<Pod> {
  // Use REST API — better error messages than GraphQL
  const body: Record<string, unknown> = {
    name: config.name,
    gpuTypeIds: [config.gpuTypeId],
    gpuCount: 1,
    containerDiskInGb: config.containerDiskInGb ?? 30,
    volumeInGb: config.volumeInGb ?? 50,
  };

  if (config.templateId) {
    body.templateId = config.templateId;
  } else if (config.imageId) {
    body.imageName = config.imageId;
    if (config.ports) {
      body.ports = config.ports.split(",").map((p: string) => p.trim());
    }
    if (config.volumeMountPath) body.volumeMountPath = config.volumeMountPath;
  }

  if (config.networkVolumeId) body.networkVolumeId = config.networkVolumeId;

  if (config.env) {
    body.env = config.env;
  }

  const data = await rest("/pods", {
    method: "POST",
    body: JSON.stringify(body),
  });

  // Normalize REST response to match our Pod interface
  return {
    id: data.id,
    name: data.name,
    runtime: data.runtime || null,
    desiredStatus: data.desiredStatus || "RUNNING",
    imageName: data.imageName || "",
    machine: data.machine || null,
    costPerHr: data.costPerHr || 0,
  };
}

export async function getPod(podId: string): Promise<Pod> {
  const query = `
    query {
      pod(input: { podId: "${podId}" }) {
        id name desiredStatus imageName costPerHr
        machine { gpuDisplayName }
        runtime {
          uptimeInSeconds
          ports { ip isIpPublic privatePort publicPort type }
          gpus { id gpuUtilPercent memoryUtilPercent }
        }
      }
    }
  `;
  const data = await gql(query);
  return data.pod;
}

export async function listPods(): Promise<Pod[]> {
  const query = `
    query { myself { pods {
      id name desiredStatus imageName costPerHr
      machine { gpuDisplayName }
      runtime {
        uptimeInSeconds
        ports { ip isIpPublic privatePort publicPort type }
        gpus { id gpuUtilPercent memoryUtilPercent }
      }
    }}}
  `;
  const data = await gql(query);
  return data.myself.pods;
}

export async function stopPod(podId: string): Promise<void> {
  await gql(`mutation { podStop(input: { podId: "${podId}" }) { id desiredStatus } }`);
}

export async function startPod(podId: string): Promise<void> {
  await gql(`mutation { podResume(input: { podId: "${podId}", gpuCount: 1 }) { id desiredStatus } }`);
}

export async function terminatePod(podId: string): Promise<void> {
  await gql(`mutation { podTerminate(input: { podId: "${podId}" }) }`);
}

// ---------- Run command on pod via RunPod exec API ----------

export async function runCommand(podId: string, command: string, timeoutMs: number = 120000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const apiKey = getApiKey();

  // Use RunPod's runsync endpoint to execute shell commands
  const execUrl = `https://api.runpod.ai/v2/${podId}/runsync`;

  // Alternative: use the direct pod SSH proxy
  // RunPod exposes an HTTP exec endpoint on running pods
  const proxyUrl = `https://${podId}-22.proxy.runpod.net`;

  // Approach: use the RunPod REST API exec endpoint
  const res = await fetch(`https://api.runpod.io/v2/${podId}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ command, timeout: Math.floor(timeoutMs / 1000) }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    // Fallback: try the graphql pod exec
    return runCommandViaProxy(podId, command, timeoutMs);
  }

  const data = await res.json();
  return {
    stdout: data.stdout || "",
    stderr: data.stderr || "",
    exitCode: data.exitCode ?? (data.status === "COMPLETED" ? 0 : 1),
  };
}

/** Fallback: run command via RunPod's HTTP proxy to the pod */
async function runCommandViaProxy(podId: string, command: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // RunPod pods with port 22 open get an HTTP proxy.
  // We can use the pod's exposed HTTP endpoint to run commands
  // by hitting a simple exec endpoint we install during bootstrap
  const execUrl = `https://${podId}-7860.proxy.runpod.net/exec`;

  try {
    const res = await fetch(execUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: command }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.ok) {
      const data = await res.json();
      return { stdout: data.stdout || "", stderr: data.stderr || "", exitCode: data.exitCode ?? 0 };
    }
  } catch {
    // Proxy not available yet
  }

  return { stdout: "", stderr: "Exec endpoint not available", exitCode: -1 };
}

// ---------- Helper: extract ComfyUI URL from pod ----------

export function getComfyUrl(pod: Pod): string | null {
  if (!pod.runtime?.ports) return null;
  const httpPort = pod.runtime.ports.find((p) => p.privatePort === 8188);
  if (!httpPort) return null;
  return `https://${pod.id}-8188.proxy.runpod.net`;
}

// ---------- Run a command on a pod via exec endpoint ----------

export async function runCommand(podId: string, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const execUrl = `https://${podId}-22.proxy.runpod.net/exec`;

  // Try proxy exec endpoint first; fall back to RunPod's run endpoint
  try {
    const res = await fetch(execUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Proxy not available, fall back to RunPod run endpoint
  }

  // Fallback: use RunPod's serverless exec API
  const res = await fetch(`https://api.runpod.io/v2/${podId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ input: { command } }),
  });

  if (!res.ok) throw new Error(`runCommand failed: ${res.status}`);
  const data = await res.json();
  return { stdout: data.output || "", stderr: "", exitCode: data.status === "COMPLETED" ? 0 : 1 };
}

// ---------- GPU types for easy reference ----------

export const GPU_PRESETS = {
  budget: "NVIDIA RTX A4000",
  standard: "NVIDIA GeForce RTX 4090",
  performance: "NVIDIA RTX A6000",
  pro: "NVIDIA A100 80GB PCIe",
} as const;
