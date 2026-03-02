/**
 * Workflow Analyzer — Phase 3
 *
 * Parses a raw ComfyUI workflow JSON (API format) and extracts:
 * - Required models (checkpoints, loras, controlnets, etc)
 * - Required custom node packs
 * - Auto-generated param_schema for common knobs (prompt, seed, steps, etc)
 * - Model type → ComfyUI folder mapping
 */

export interface WorkflowAnalysis {
  models: ExtractedModel[];
  customNodes: string[];
  paramSchema: Record<string, ParamDef>;
  nodeCount: number;
  hasControlnet: boolean;
  hasLora: boolean;
  hasUpscale: boolean;
  errors: string[];
}

export interface ExtractedModel {
  filename: string;
  folder: string;
  nodeType: string;
  nodeId: string;
  inputKey: string;
}

export interface ParamDef {
  node: string;
  field: string;
  type: "string" | "integer" | "number";
  label?: string;
  min?: number;
  max?: number;
}

// Node types that load models and their input key → folder mapping
const MODEL_LOADERS: Record<string, { key: string; folder: string }> = {
  CheckpointLoaderSimple:     { key: "ckpt_name",      folder: "checkpoints" },
  CheckpointLoader:           { key: "ckpt_name",      folder: "checkpoints" },
  LoraLoader:                 { key: "lora_name",      folder: "loras" },
  LoraLoaderModelOnly:        { key: "lora_name",      folder: "loras" },
  ControlNetLoader:           { key: "control_net_name", folder: "controlnet" },
  VAELoader:                  { key: "vae_name",       folder: "vae" },
  UpscaleModelLoader:         { key: "model_name",     folder: "upscale_models" },
  CLIPLoader:                 { key: "clip_name",      folder: "clip" },
  StyleModelLoader:           { key: "style_model_name", folder: "style_models" },
  unCLIPCheckpointLoader:     { key: "ckpt_name",      folder: "checkpoints" },
  DiffusersLoader:            { key: "model_path",     folder: "diffusers" },
  UNETLoader:                 { key: "unet_name",      folder: "unet" },
};

// Node types that are from custom node packs (not built-in)
const BUILTIN_NODES = new Set([
  "KSampler", "KSamplerAdvanced", "CheckpointLoaderSimple", "CheckpointLoader",
  "CLIPTextEncode", "CLIPSetLastLayer", "LoraLoader", "LoraLoaderModelOnly",
  "VAEDecode", "VAEEncode", "VAELoader", "EmptyLatentImage", "LatentUpscale",
  "LatentUpscaleBy", "SaveImage", "PreviewImage", "LoadImage", "ControlNetLoader",
  "ControlNetApply", "ControlNetApplyAdvanced", "UpscaleModelLoader", "ImageUpscaleWithModel",
  "CLIPLoader", "DualCLIPLoader", "CLIPVisionLoader", "CLIPVisionEncode",
  "StyleModelLoader", "StyleModelApply", "unCLIPCheckpointLoader",
  "ConditioningCombine", "ConditioningSetArea", "ConditioningSetMask",
  "ImageScale", "ImageScaleBy", "ImageInvert", "ImageBatch", "ImagePadForOutpaint",
  "RepeatLatentBatch", "LatentFromBatch", "LatentComposite", "LatentBlend",
  "ModelMergeSimple", "ModelMergeBlocks", "Note",
  "PrimitiveNode", "Reroute", "ReroutePrimitive",
  "SetLatentNoiseMask", "LatentRotate", "LatentFlip", "LatentCrop",
  "FreeU", "FreeU_V2", "SamplerCustom",
  "UNETLoader", "DiffusersLoader",
]);

// Input keys that are likely user-configurable params
const PARAM_KEYS: Record<string, { type: "string" | "integer" | "number"; label: string; min?: number; max?: number }> = {
  "seed":            { type: "integer", label: "Seed" },
  "steps":           { type: "integer", label: "Steps",           min: 1, max: 150 },
  "cfg":             { type: "number",  label: "CFG Scale",       min: 1, max: 30 },
  "denoise":         { type: "number",  label: "Denoise Strength", min: 0, max: 1 },
  "width":           { type: "integer", label: "Width" },
  "height":          { type: "integer", label: "Height" },
  "batch_size":      { type: "integer", label: "Batch Size",      min: 1, max: 16 },
  "sampler_name":    { type: "string",  label: "Sampler" },
  "scheduler":       { type: "string",  label: "Scheduler" },
};

/**
 * Analyze a ComfyUI workflow JSON (API format).
 * Returns all extracted info needed to register it as a template.
 */
export function analyzeWorkflow(workflow: Record<string, unknown>): WorkflowAnalysis {
  const models: ExtractedModel[] = [];
  const customNodeSet = new Set<string>();
  const paramSchema: Record<string, ParamDef> = {};
  const errors: string[] = [];
  let hasControlnet = false;
  let hasLora = false;
  let hasUpscale = false;

  for (const [nodeId, nodeData] of Object.entries(workflow)) {
    if (!nodeData || typeof nodeData !== "object") continue;
    const node = nodeData as { class_type?: string; inputs?: Record<string, unknown> };
    const classType = node.class_type;
    if (!classType) continue;

    // ── Extract models ──
    const loader = MODEL_LOADERS[classType];
    if (loader && node.inputs) {
      const filename = node.inputs[loader.key];
      if (typeof filename === "string" && filename.length > 0) {
        models.push({
          filename,
          folder: loader.folder,
          nodeType: classType,
          nodeId,
          inputKey: loader.key,
        });
      }
    }

    // ── Detect features ──
    if (classType.toLowerCase().includes("controlnet")) hasControlnet = true;
    if (classType.toLowerCase().includes("lora")) hasLora = true;
    if (classType.toLowerCase().includes("upscale")) hasUpscale = true;

    // ── Detect custom nodes ──
    if (!BUILTIN_NODES.has(classType)) {
      customNodeSet.add(classType);
    }

    // ── Extract params ──
    if (node.inputs) {
      // Find text prompts (CLIPTextEncode)
      if (classType === "CLIPTextEncode" && typeof node.inputs.text === "string") {
        // Heuristic: if it looks like a negative prompt
        const text = node.inputs.text.toLowerCase();
        const isNegative = text.includes("ugly") || text.includes("blur") || text.includes("bad") || text.includes("worst") || text.includes("low quality");
        const key = isNegative ? "negative_prompt" : `prompt_${nodeId}`;
        // Only add the first positive prompt as "prompt"
        const finalKey = !isNegative && !paramSchema["prompt"] ? "prompt" : key;

        paramSchema[finalKey] = {
          node: nodeId,
          field: "inputs.text",
          type: "string",
          label: isNegative ? "Negative Prompt" : "Prompt",
        };
      }

      // Find KSampler params
      if (classType === "KSampler" || classType === "KSamplerAdvanced" || classType === "SamplerCustom") {
        for (const [inputKey, value] of Object.entries(node.inputs)) {
          const paramDef = PARAM_KEYS[inputKey];
          if (paramDef && (typeof value === "string" || typeof value === "number")) {
            // Don't duplicate if already found
            if (!paramSchema[inputKey]) {
              paramSchema[inputKey] = {
                node: nodeId,
                field: `inputs.${inputKey}`,
                ...paramDef,
              };
            }
          }
        }
      }

      // Find EmptyLatentImage dimensions
      if (classType === "EmptyLatentImage") {
        for (const key of ["width", "height", "batch_size"]) {
          if (node.inputs[key] !== undefined && !paramSchema[key]) {
            const paramDef = PARAM_KEYS[key];
            if (paramDef) {
              paramSchema[key] = { node: nodeId, field: `inputs.${key}`, ...paramDef };
            }
          }
        }
      }
    }
  }

  // Clean up: if we have prompt_X but no "prompt", rename the first one
  const promptKeys = Object.keys(paramSchema).filter((k) => k.startsWith("prompt_"));
  if (promptKeys.length > 0 && !paramSchema["prompt"]) {
    const first = promptKeys[0];
    paramSchema["prompt"] = { ...paramSchema[first], label: "Prompt" };
    delete paramSchema[first];
  }

  return {
    models,
    customNodes: Array.from(customNodeSet),
    paramSchema,
    nodeCount: Object.keys(workflow).length,
    hasControlnet,
    hasLora,
    hasUpscale,
    errors,
  };
}

/**
 * Generate a human-readable slug from a name.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}
