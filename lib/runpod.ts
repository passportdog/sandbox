// RunPod REST API Client
// Docs: https://docs.runpod.io/api-reference

const RUNPOD_API_URL = "https://api.runpod.io/graphql";

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

// ---------- Pod operations ----------

export interface PodConfig {
  name: string;
  imageId: string; // Docker image
  gpuTypeId: string; // e.g. "NVIDIA RTX A5000"
  volumeInGb?: number;
  containerDiskInGb?: number;
  ports?: string; // e.g. "8188/http,22/tcp"
  env?: Record<string, string>;
  templateId?: string;
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
  const envArray = config.env
    ? Object.entries(config.env).map(([key, value]) => ({ key, value }))
    : [];

  const mutation = `
    mutation {
      podFindAndDeployOnDemand(input: {
        name: "${config.name}"
        imageName: "${config.imageId}"
        gpuTypeId: "${config.gpuTypeId}"
        ${config.networkVolumeId ? `networkVolumeId: "${config.networkVolumeId}"` : ""}
        ${config.volumeMountPath ? `volumeMountPath: "${config.volumeMountPath}"` : ""}
        volumeInGb: ${config.volumeInGb ?? 20}
        containerDiskInGb: ${config.containerDiskInGb ?? 20}
        ports: "${config.ports ?? "8188/http,22/tcp"}"
        ${config.templateId ? `templateId: "${config.templateId}"` : ""}
        env: [${envArray.map((e) => `{key:"${e.key}",value:"${e.value}"}`).join(",")}]
      }) {
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
  const data = await gql(mutation);
  return data.podFindAndDeployOnDemand;
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

// ---------- Helper: extract ComfyUI URL from pod ----------

export function getComfyUrl(pod: Pod): string | null {
  if (!pod.runtime?.ports) return null;
  const httpPort = pod.runtime.ports.find((p) => p.privatePort === 8188);
  if (!httpPort) return null;
  return `https://${pod.id}-8188.proxy.runpod.net`;
}

// ---------- GPU types for easy reference ----------

export const GPU_PRESETS = {
  budget: "NVIDIA RTX A4000",
  standard: "NVIDIA RTX A5000",
  performance: "NVIDIA RTX 4090",
  pro: "NVIDIA A100 80GB PCIe",
} as const;
