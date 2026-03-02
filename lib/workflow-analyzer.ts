/**
 * ComfyUI Workflow Analyzer
 *
 * Parses a ComfyUI API-format workflow JSON and extracts:
 * - Required model files (checkpoints, LoRAs, controlnet, VAE, etc.)
 * - Custom node class_types (non-builtin)
 * - Auto-generated param_schema for user-facing inputs
 * - Feature flags (hasControlnet, hasLora, hasUpscale)
 */

// Builtin ComfyUI node class_types (non-exhaustive, covers core nodes)
const BUILTIN_NODES = new Set([
  "KSampler", "KSamplerAdvanced", "CheckpointLoaderSimple", "CLIPTextEncode",
  "CLIPSetLastLayer", "VAEDecode", "VAEEncode", "VAELoader", "EmptyLatentImage",
  "LatentUpscale", "LatentUpscaleBy", "SaveImage", "PreviewImage", "LoadImage",
  "ImageScale", "ImageScaleBy", "ConditioningCombine", "ConditioningSetArea",
  "LoraLoader", "ControlNetLoader", "ControlNetApply", "ControlNetApplyAdvanced",
  "CLIPLoader", "DualCLIPLoader", "UNETLoader", "FreeU", "FreeU_V2",
  "UpscaleModelLoader", "ImageUpscaleWithModel", "LatentComposite",
  "LatentBlend", "ImageBatch", "ImageInvert", "ImageSharpen", "ImageBlur",
  "RepeatLatentBatch", "RebatchLatentBatch", "LoadImageMask", "SetLatentNoiseMask",
  "ConditioningSetTimestepRange", "SamplerCustom",
]);

// Nodes that load model files, mapped to their input field and ComfyUI subfolder
const MODEL_LOADER_NODES: Record<string, { field: string; folder: string }> = {
  CheckpointLoaderSimple: { field: "ckpt_name", folder: "checkpoints" },
  CheckpointLoader:       { field: "ckpt_name", folder: "checkpoints" },
  LoraLoader:             { field: "lora_name", folder: "loras" },
  LoraLoaderModelOnly:    { field: "lora_name", folder: "loras" },
  VAELoader:              { field: "vae_name", folder: "vae" },
  ControlNetLoader:       { field: "control_net_name", folder: "controlnet" },
  UpscaleModelLoader:     { field: "model_name", folder: "upscale_models" },
  CLIPLoader:             { field: "clip_name", folder: "clip" },
  UNETLoader:             { field: "unet_name", folder: "unet" },
  DualCLIPLoader:         { field: "clip_name1", folder: "clip" },
  StyleModelLoader:       { field: "style_model_name", folder: "style_models" },
  unCLIPCheckpointLoader: { field: "ckpt_name", folder: "checkpoints" },
};

export interface ModelRef {
  filename: string;
  folder: string;
  loaderNode: string;
  nodeId: string;
}

export interface ParamEntry {
  node: string;
  field: string;
  type: "string" | "number" | "integer";
  default?: unknown;
}

export interface WorkflowAnalysis {
  node_count: number;
  models: ModelRef[];
  custom_nodes: string[];
  param_schema: Record<string, ParamEntry>;
  features: {
    hasControlnet: boolean;
    hasLora: boolean;
    hasUpscale: boolean;
    hasVae: boolean;
  };
}

type WorkflowNode = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
};

type Workflow = Record<string, WorkflowNode>;

export function analyzeWorkflow(workflow: Workflow): WorkflowAnalysis {
  const nodes = Object.entries(workflow);
  const models: ModelRef[] = [];
  const customNodes = new Set<string>();
  const paramSchema: Record<string, ParamEntry> = {};

  const features = {
    hasControlnet: false,
    hasLora: false,
    hasUpscale: false,
    hasVae: false,
  };

  for (const [nodeId, node] of nodes) {
    const classType = node.class_type;
    if (!classType) continue;

    // Detect custom nodes
    if (!BUILTIN_NODES.has(classType)) {
      customNodes.add(classType);
    }

    // Extract model references from loader nodes
    const loaderInfo = MODEL_LOADER_NODES[classType];
    if (loaderInfo) {
      const filename = node.inputs[loaderInfo.field];
      if (typeof filename === "string" && filename) {
        models.push({
          filename,
          folder: loaderInfo.folder,
          loaderNode: classType,
          nodeId,
        });
      }

      // Also check for second model field (e.g. DualCLIPLoader has clip_name2)
      if (classType === "DualCLIPLoader" && typeof node.inputs.clip_name2 === "string") {
        models.push({
          filename: node.inputs.clip_name2,
          folder: "clip",
          loaderNode: classType,
          nodeId,
        });
      }

      // Also check LoraLoader for the secondary lora
      if (classType === "LoraLoader" && typeof node.inputs.lora_name === "string") {
        features.hasLora = true;
      }
    }

    // Feature detection
    if (classType.toLowerCase().includes("controlnet")) features.hasControlnet = true;
    if (classType.toLowerCase().includes("lora")) features.hasLora = true;
    if (classType.toLowerCase().includes("upscale")) features.hasUpscale = true;
    if (classType === "VAELoader" || classType === "VAEDecode") features.hasVae = true;

    // Auto-generate param_schema from common input patterns
    if (classType === "CLIPTextEncode") {
      const textVal = node.inputs.text;
      if (typeof textVal === "string") {
        // Determine if this is likely a positive or negative prompt
        const title = node._meta?.title?.toLowerCase() || "";
        const isNegative = title.includes("negative") || title.includes("neg");
        const key = isNegative ? "negative_prompt" : "prompt";
        if (!paramSchema[key]) {
          paramSchema[key] = { node: nodeId, field: "text", type: "string", default: textVal };
        }
      }
    }

    if (classType === "KSampler" || classType === "KSamplerAdvanced") {
      if (typeof node.inputs.seed === "number" && !paramSchema.seed) {
        paramSchema.seed = { node: nodeId, field: "seed", type: "integer", default: node.inputs.seed };
      }
      if (typeof node.inputs.steps === "number" && !paramSchema.steps) {
        paramSchema.steps = { node: nodeId, field: "steps", type: "integer", default: node.inputs.steps };
      }
      if (typeof node.inputs.cfg === "number" && !paramSchema.cfg) {
        paramSchema.cfg = { node: nodeId, field: "cfg", type: "number", default: node.inputs.cfg };
      }
      if (typeof node.inputs.denoise === "number" && !paramSchema.denoise) {
        paramSchema.denoise = { node: nodeId, field: "denoise", type: "number", default: node.inputs.denoise };
      }
    }

    if (classType === "EmptyLatentImage") {
      if (typeof node.inputs.width === "number" && !paramSchema.width) {
        paramSchema.width = { node: nodeId, field: "width", type: "integer", default: node.inputs.width };
      }
      if (typeof node.inputs.height === "number" && !paramSchema.height) {
        paramSchema.height = { node: nodeId, field: "height", type: "integer", default: node.inputs.height };
      }
      if (typeof node.inputs.batch_size === "number" && !paramSchema.batch_size) {
        paramSchema.batch_size = { node: nodeId, field: "batch_size", type: "integer", default: node.inputs.batch_size };
      }
    }
  }

  // Determine category from features / models
  return {
    node_count: nodes.length,
    models,
    custom_nodes: [...customNodes].sort(),
    param_schema: paramSchema,
    features,
  };
}

/** Determine a workflow category based on analysis */
export function categorize(analysis: WorkflowAnalysis): string {
  if (analysis.features.hasControlnet) return "controlnet";
  if (analysis.features.hasUpscale && !analysis.param_schema.prompt) return "upscale";
  if (analysis.features.hasLora) return "lora";
  return "txt2img";
}

/** Generate a URL-safe slug from a name */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Validate that a workflow is API format (not UI format) */
export function validateApiFormat(workflow: unknown): { valid: boolean; error?: string } {
  if (!workflow || typeof workflow !== "object") {
    return { valid: false, error: "Workflow must be a JSON object" };
  }

  // UI format has a "nodes" array — reject it
  if (Array.isArray((workflow as Record<string, unknown>).nodes)) {
    return { valid: false, error: "This looks like ComfyUI UI format (has 'nodes' array). Please export as API format instead." };
  }

  const entries = Object.entries(workflow as Record<string, unknown>);
  if (entries.length === 0) {
    return { valid: false, error: "Workflow is empty" };
  }

  // API format has numbered string keys with class_type
  const hasClassType = entries.some(
    ([, v]) => v && typeof v === "object" && "class_type" in (v as Record<string, unknown>)
  );

  if (!hasClassType) {
    return { valid: false, error: "No nodes with 'class_type' found. Is this a valid ComfyUI API workflow?" };
  }

  return { valid: true };
}
