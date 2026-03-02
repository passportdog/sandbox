// Civitai REST API Client
// Docs: https://github.com/civitai/civitai/wiki/REST-API-Reference

const CIVITAI_API = "https://civitai.com/api/v1";

function getApiKey(): string {
  return process.env.CIVITAI_API_KEY || "";
}

function headers(): HeadersInit {
  const key = getApiKey();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export interface CivitaiModelVersion {
  id: number;
  modelId: number;
  name: string;
  baseModel: string;
  downloadUrl: string;
  files: CivitaiFile[];
  images: { url: string; width: number; height: number }[];
}

export interface CivitaiFile {
  id: number;
  name: string;
  sizeKB: number;
  type: string;
  format: string; // "SafeTensor" | "PickleTensor" | etc
  pickleScanResult: string; // "Success" | "Danger" | etc
  virusScanResult: string; // "Success" | "Danger" | etc
  hashes: { SHA256?: string; CRC32?: string; BLAKE3?: string };
  downloadUrl: string;
  primary?: boolean;
}

export interface CivitaiModel {
  id: number;
  name: string;
  type: string; // Checkpoint, LORA, TextualInversion, etc
  nsfw: boolean;
  modelVersions: CivitaiModelVersion[];
}

/** Search models by query */
export async function searchModels(query: string, limit: number = 5): Promise<CivitaiModel[]> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  const res = await fetch(`${CIVITAI_API}/models?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`Civitai search failed: ${res.status}`);
  const data = await res.json();
  return data.items;
}

/** Get a specific model by ID */
export async function getModel(modelId: number): Promise<CivitaiModel> {
  const res = await fetch(`${CIVITAI_API}/models/${modelId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Civitai get model failed: ${res.status}`);
  return res.json();
}

/** Get a specific model version */
export async function getModelVersion(versionId: number): Promise<CivitaiModelVersion> {
  const res = await fetch(`${CIVITAI_API}/model-versions/${versionId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Civitai get version failed: ${res.status}`);
  return res.json();
}

/** Get download URL with auth token */
export function getDownloadUrl(versionId: number): string {
  const key = getApiKey();
  const base = `https://civitai.com/api/download/models/${versionId}`;
  return key ? `${base}?token=${key}` : base;
}

// ---------- Safety checks ----------

export interface SafetyResult {
  safe: boolean;
  reasons: string[];
  file: CivitaiFile | null;
}

/** Check if a model version is safe to download */
export function checkSafety(version: CivitaiModelVersion): SafetyResult {
  const reasons: string[] = [];

  // Prefer primary file, or first safetensor
  const safetensorFile = version.files.find(
    (f) => f.format === "SafeTensor" && (f.primary || version.files.length === 1)
  );
  const primaryFile = version.files.find((f) => f.primary) || version.files[0];
  const file = safetensorFile || primaryFile;

  if (!file) {
    return { safe: false, reasons: ["No files found"], file: null };
  }

  // Check format
  if (file.format !== "SafeTensor") {
    reasons.push(`Format is ${file.format}, not SafeTensor — higher risk`);
  }

  // Check virus scan
  if (file.virusScanResult === "Danger") {
    reasons.push("Virus scan flagged as DANGER");
  }

  // Check pickle scan
  if (file.pickleScanResult === "Danger") {
    reasons.push("Pickle scan flagged as DANGER");
  }

  // Check file size (warn if > 10GB)
  if (file.sizeKB > 10 * 1024 * 1024) {
    reasons.push(`Large file: ${(file.sizeKB / 1024 / 1024).toFixed(1)}GB`);
  }

  const hasDanger = reasons.some((r) => r.includes("DANGER"));
  return { safe: !hasDanger, reasons, file };
}

/** Map Civitai model type to ComfyUI folder */
export function typeToFolder(type: string): string {
  const map: Record<string, string> = {
    Checkpoint: "checkpoints",
    LORA: "loras",
    TextualInversion: "embeddings",
    Controlnet: "controlnet",
    VAE: "vae",
    Upscaler: "upscale_models",
  };
  return map[type] || "other";
}
