/**
 * Node Pack Registry — Phase 4
 *
 * Static lookup table mapping ComfyUI custom node packs to their
 * git repos, install commands, and approval status.
 *
 * Source of truth: ComfyUI-Manager's custom-node-list.json
 * https://github.com/ltdrdata/ComfyUI-Manager
 *
 * Approval levels:
 *   approved  — auto-install allowed
 *   review    — show to user for manual approval
 *   blocked   — never install (known unsafe)
 */

export interface NodePackEntry {
  name: string;
  repo: string;
  description: string;
  approved: "approved" | "review" | "blocked";
  classTypes: string[];
}

/**
 * Registry of known custom node packs.
 * Key is the pack name (matches repo name convention).
 */
export const NODE_REGISTRY: Record<string, NodePackEntry> = {
  // ── Tier 1: Core ecosystem packs (auto-approved) ──

  "ComfyUI-Manager": {
    name: "ComfyUI Manager",
    repo: "https://github.com/ltdrdata/ComfyUI-Manager",
    description: "Node manager and installer for ComfyUI",
    approved: "approved",
    classTypes: [],
  },

  "ComfyUI-Impact-Pack": {
    name: "Impact Pack",
    repo: "https://github.com/ltdrdata/ComfyUI-Impact-Pack",
    description: "SAM, face detailer, bbox, iterative upscale",
    approved: "approved",
    classTypes: [
      "SAMLoader", "SAMDetectorCombined", "SAMDetectorSegmented",
      "DetailerForEach", "DetailerForEachDebug", "DetailerForEachPipe",
      "FaceDetailer", "FaceDetailerPipe",
      "BboxDetectorSEGS", "BboxDetectorCombined",
      "SegmDetectorSEGS", "SegmDetectorCombined",
      "ONNXDetectorProvider", "SegsToCombinedMask",
      "MaskToSEGS", "SEGSToMaskList", "SEGSToMaskBatch",
      "IterativeImageUpscale", "IterativeLatentUpscale",
      "PixelKSampleUpscalerProvider", "PixelKSampleUpscalerProviderPipe",
      "TwoSamplersForMask", "TwoAdvancedSamplersForMask",
      "PreviewBridge", "ImageSender", "ImageReceiver",
      "SubtractMask", "AddMask", "BitwiseAndMask",
      "ImpactWildcardProcessor", "ImpactWildcardEncode",
    ],
  },

  "ComfyUI-Inspire-Pack": {
    name: "Inspire Pack",
    repo: "https://github.com/ltdrdata/ComfyUI-Inspire-Pack",
    description: "Regional prompting, wildcards, backend tools",
    approved: "approved",
    classTypes: [
      "KSamplerAdvancedInspire", "KSamplerInspire",
      "RegionalPromptSimple", "RegionalPromptColorMask",
      "LoadPromptsFromDir", "LoadPromptsFromFile",
      "UnzipPrompt", "ZipPrompt",
      "WildcardEncode", "PromptExtractor",
      "GlobalSeed", "BindImageListToPromptList",
      "CacheBackendData", "CacheBackendDataList",
      "RetrieveBackendData", "RetrieveBackendDataList",
      "RemoveBackendData", "RemoveBackendDataList",
    ],
  },

  "ComfyUI_Comfyroll_CustomNodes": {
    name: "Comfyroll Studio",
    repo: "https://github.com/Suzie1/ComfyUI_Comfyroll_CustomNodes",
    description: "Utility nodes, switches, schedulers, templates",
    approved: "approved",
    classTypes: [
      "CR Image Output", "CR Seed", "CR Aspect Ratio",
      "CR Apply ControlNet", "CR Multi-ControlNet Stack",
      "CR LoRA Stack", "CR Apply LoRA Stack",
      "CR Prompt Text", "CR SD1.5 Aspect Ratio", "CR SDXL Aspect Ratio",
      "CR Half Drop Panel", "CR Diamond Panel",
      "CR Checker Pattern", "CR Color Bars",
      "CR Simple Text Panel", "CR Overlay Text",
      "CR Image Grid Panel",
    ],
  },

  "was-node-suite-comfyui": {
    name: "WAS Node Suite",
    repo: "https://github.com/WASasquatch/was-node-suite-comfyui",
    description: "200+ utility nodes for image, text, number operations",
    approved: "approved",
    classTypes: [
      "WAS_Image_Resize", "WAS_Image_Rescale", "WAS_Image_Crop",
      "WAS_Image_Blend", "WAS_Image_Blending_Mode",
      "WAS_Image_Flip", "WAS_Image_Rotate",
      "WAS_Mask_Combine", "WAS_Mask_Crop",
      "WAS_Text_String", "WAS_Text_Concatenate", "WAS_Text_Multiline",
      "WAS_Number", "WAS_Number_To_Int", "WAS_Number_To_Float",
      "WAS_Latent_Noise", "WAS_Latent_Upscale_By",
      "WAS_KSampler", "WAS_Image_Save",
      "WAS_Image_Load", "WAS_Image_To_Noise",
      "WAS_Number_Operation", "WAS_Number_Input_Switch",
      "WAS_Text_Parse_Noodle_Soup", "WAS_Text_To_Conditioning",
      "WAS_Logic_Boolean", "WAS_Debug_Number_to_String",
      "WAS_Image_Batch", "WAS_Mask_Fill_Holes",
    ],
  },

  "efficiency-nodes-comfyui": {
    name: "Efficiency Nodes",
    repo: "https://github.com/jags111/efficiency-nodes-comfyui",
    description: "Efficient KSampler, LoRA stacker, pipes",
    approved: "approved",
    classTypes: [
      "KSampler (Efficient)", "KSampler Adv. (Efficient)",
      "Efficient Loader", "Eff. Loader SDXL",
      "LoRA Stacker", "Control Net Stacker",
      "Unpack SDXL Tuple", "Pack SDXL Tuple",
      "XY Plot", "XY Input: Seeds++ Batch",
      "XY Input: Steps", "XY Input: CFG Scale",
      "XY Input: Sampler/Scheduler", "XY Input: Denoise",
      "Evaluate Integers", "Evaluate Strings", "Evaluate Floats",
      "HighRes-Fix Script", "Noise Control Script",
    ],
  },

  "ComfyUI_essentials": {
    name: "ComfyUI Essentials",
    repo: "https://github.com/cubiq/ComfyUI_essentials",
    description: "Essential utility nodes",
    approved: "approved",
    classTypes: [
      "GetImageSize+", "ImageResize+", "ImageCrop+",
      "ImageFlip+", "ImageDesaturate+",
      "MaskBlur+", "MaskPreview+",
      "DrawText+", "ModelCompile+",
      "CLIPTextEncodeSDXL+", "SDXLEmptyLatentSizePicker+",
      "KSamplerVariationsStochastic+", "KSamplerVariationsWithNoise+",
      "ConsoleDebug+", "DebugTensorShape+",
    ],
  },

  "rgthree-comfy": {
    name: "rgthree Nodes",
    repo: "https://github.com/rgthree/rgthree-comfy",
    description: "Power lora loader, seed, context, reroute nodes",
    approved: "approved",
    classTypes: [
      "Power Lora Loader (rgthree)", "Seed (rgthree)",
      "Context (rgthree)", "Context Switch (rgthree)",
      "Context Switch Big (rgthree)", "Context Merge (rgthree)",
      "Context Merge Big (rgthree)",
      "Display Any (rgthree)", "Bookmark (rgthree)",
      "Reroute (rgthree)", "Fast Muter (rgthree)",
      "Fast Bypasser (rgthree)", "Fast Groups Muter (rgthree)",
      "Image Comparer (rgthree)", "SDXL Power Prompt - Positive (rgthree)",
      "SDXL Power Prompt - Negative (rgthree)",
    ],
  },

  "comfyui-tooling-nodes": {
    name: "Tooling Nodes",
    repo: "https://github.com/Acly/comfyui-tooling-nodes",
    description: "Send/load images for Krita integration",
    approved: "approved",
    classTypes: [
      "ETN_LoadImageBase64", "ETN_LoadMaskBase64",
      "ETN_SendImageWebSocket", "ETN_CropImage",
      "ETN_ApplyMaskToImage",
    ],
  },

  "ComfyUI-KJNodes": {
    name: "KJ Nodes",
    repo: "https://github.com/kijai/ComfyUI-KJNodes",
    description: "Conditioning, masking, and utility nodes",
    approved: "approved",
    classTypes: [
      "ConditioningSetMaskAndCombine", "ConditioningMultiCombine",
      "ColorMatch", "CreateShapeMask", "CreateTextMask",
      "CreateGradientMask", "CreateFadeMaskAdvanced",
      "BatchCropFromMask", "BatchCropFromMaskAdvanced",
      "GrowMaskWithBlur", "INTConstant", "FloatConstant",
      "StringConstant", "GetImageSizeAndCount",
      "GetLatentsFromBatch", "SetLatentNoiseMask",
      "RoundMask", "ResizeMask", "OffsetMask",
      "FlipSigmasAdjusted", "InjectNoiseToLatent",
      "SomethingToString", "WidgetToString",
    ],
  },

  "ComfyUI-AnimateDiff-Evolved": {
    name: "AnimateDiff Evolved",
    repo: "https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved",
    description: "AnimateDiff video generation nodes",
    approved: "approved",
    classTypes: [
      "ADE_AnimateDiffLoaderGen1", "ADE_AnimateDiffLoaderWithContext",
      "ADE_AnimateDiffUniformContextOptions",
      "ADE_AnimateDiffCombine", "ADE_EmptyLatentImageLarge",
      "ADE_AnimateDiffModelSettings", "ADE_AnimateDiffSamplingSettings",
      "ADE_UseEvolvedSampling", "ADE_ApplyAnimateDiffModel",
      "ADE_LoadAnimateDiffModel", "ADE_StandardStaticContextOptions",
      "ADE_AnimateDiffKeyframe",
    ],
  },

  "ComfyUI-VideoHelperSuite": {
    name: "Video Helper Suite",
    repo: "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",
    description: "Video loading, combining, and output",
    approved: "approved",
    classTypes: [
      "VHS_VideoCombine", "VHS_LoadVideo", "VHS_LoadVideoPath",
      "VHS_LoadImages", "VHS_LoadImagesPath",
      "VHS_SplitImages", "VHS_SplitLatents",
      "VHS_MergeImages", "VHS_MergeLatents",
      "VHS_SelectEveryNthImage", "VHS_SelectEveryNthLatent",
      "VHS_GetImageCount", "VHS_GetLatentCount",
      "VHS_DuplicateImages", "VHS_DuplicateLatents",
      "VHS_PruneOutputs",
    ],
  },

  "ComfyUI-Advanced-ControlNet": {
    name: "Advanced ControlNet",
    repo: "https://github.com/Kosinkadink/ComfyUI-Advanced-ControlNet",
    description: "Advanced ControlNet apply with timestep controls",
    approved: "approved",
    classTypes: [
      "ACN_AdvancedControlNetApply", "ControlNetLoaderAdvanced",
      "DiffControlNetLoaderAdvanced",
      "ACN_SparseCtrlRGBPreprocessor", "ACN_SparseCtrlLoaderAdvanced",
      "ScaledSoftControlNetWeights", "SoftControlNetWeights",
      "CustomControlNetWeights", "SoftT2IAdapterWeights",
      "ACN_TimestepKeyframeNode", "ACN_DefaultUniversalWeights",
      "ACN_ControlNetLoaderWithLoraAdvanced",
    ],
  },

  "ComfyUI_IPAdapter_plus": {
    name: "IP-Adapter Plus",
    repo: "https://github.com/cubiq/ComfyUI_IPAdapter_plus",
    description: "IP-Adapter image prompt nodes",
    approved: "approved",
    classTypes: [
      "IPAdapterModelLoader", "IPAdapterApply",
      "IPAdapterApplyFaceID", "IPAdapterApplyEncoded",
      "IPAdapterEncoder", "IPAdapterCombineEmbeds",
      "IPAdapterBatch", "IPAdapterFaceID",
      "IPAdapterTiled", "IPAdapterTiledBatch",
      "IPAdapterUnifiedLoader", "IPAdapterUnifiedLoaderFaceID",
      "IPAdapterStyleComposition", "IPAdapterStyleCompositionBatch",
      "PrepImageForClipVision", "IPAdapterSaveEmbeds",
      "IPAdapterLoadEmbeds", "IPAdapterAdvanced",
      "IPAdapterMS", "InsightFaceLoader",
    ],
  },

  "ComfyUI_InstantID": {
    name: "InstantID",
    repo: "https://github.com/cubiq/ComfyUI_InstantID",
    description: "InstantID face transfer nodes",
    approved: "approved",
    classTypes: [
      "InstantIDModelLoader", "InstantIDFaceAnalysis",
      "ApplyInstantID", "ApplyInstantIDAdvanced",
      "FaceKeypointsPreprocessor",
    ],
  },

  "comfyui_controlnet_aux": {
    name: "ControlNet Aux Preprocessors",
    repo: "https://github.com/Fannovel16/comfyui_controlnet_aux",
    description: "All ControlNet preprocessors (canny, depth, pose, etc.)",
    approved: "approved",
    classTypes: [
      "CannyEdgePreprocessor", "LineArtPreprocessor",
      "LineArtPreprocessor_Anime", "AnimeLineArtPreprocessor",
      "Manga2Anime_LineArt_Preprocessor",
      "DepthAnythingPreprocessor", "DepthAnythingV2Preprocessor",
      "MiDaS-DepthMapPreprocessor", "LeReS-DepthMapPreprocessor",
      "Zoe-DepthMapPreprocessor", "Zoe_DepthAnythingPreprocessor",
      "DWPreprocessor", "OpenposePreprocessor",
      "MediaPipeFaceMeshPreprocessor", "AnimalPosePreprocessor",
      "HEDPreprocessor", "PiDiNetPreprocessor", "ScribblePreprocessor",
      "FakeScribblePreprocessor", "M-LSDPreprocessor",
      "BAE-NormalMapPreprocessor", "MeshGraphormerDepthMapPreprocessor",
      "OneFormer-COCO-SemSegPreprocessor",
      "OneFormer-ADE20K-SemSegPreprocessor",
      "UniformerSemSegPreprocessor",
      "SemSegPreprocessor", "InpaintPreprocessor",
      "ColorPreprocessor", "TilePreprocessor",
      "ImageLuminanceDetector", "ImageIntensityDetector",
      "SavePoseKpsAsJsonFile", "FacialPartColoringFromPoseKps",
      "PixelPerfectResolution", "AIO_Preprocessor",
    ],
  },

  "ComfyUI-GGUF": {
    name: "GGUF Loader",
    repo: "https://github.com/city96/ComfyUI-GGUF",
    description: "Load GGUF quantized models in ComfyUI",
    approved: "approved",
    classTypes: [
      "UnetLoaderGGUF", "UnetLoaderGGUFAdvanced",
      "CLIPLoaderGGUF", "DualCLIPLoaderGGUF",
      "TripleCLIPLoaderGGUF",
    ],
  },

  "ComfyUI-Florence2": {
    name: "Florence2",
    repo: "https://github.com/kijai/ComfyUI-Florence2",
    description: "Florence 2 vision model nodes",
    approved: "approved",
    classTypes: [
      "DownloadAndLoadFlorence2Model", "Florence2Run",
      "Florence2toCoordinates",
    ],
  },

  "ComfyUI-Flux": {
    name: "Flux Nodes",
    repo: "https://github.com/kijai/ComfyUI-FluxTrainer",
    description: "FLUX model support nodes",
    approved: "review",
    classTypes: [
      "FluxLoader", "FluxSampler", "FluxGuidance",
    ],
  },

  // ── Tier 2: Popular but needs review ──

  "ComfyUI-Easy-Use": {
    name: "Easy Use",
    repo: "https://github.com/yolain/ComfyUI-Easy-Use",
    description: "Simplified workflow nodes",
    approved: "review",
    classTypes: [
      "easy fullLoader", "easy a1111Loader", "easy comfyLoader",
      "easy kSampler", "easy kSamplerTiled",
      "easy preSampling", "easy preSamplingAdvanced",
      "easy positive", "easy negative",
      "easy seed", "easy int", "easy float", "easy string",
      "easy imageSize", "easy imageSave",
    ],
  },

  "ComfyUI-Custom-Scripts": {
    name: "Custom Scripts (pythongosssss)",
    repo: "https://github.com/pythongosssss/ComfyUI-Custom-Scripts",
    description: "UI enhancements, string functions, show text",
    approved: "approved",
    classTypes: [
      "ShowText|pysssss", "StringFunction|pysssss",
      "Repeater|pysssss", "MathExpression|pysssss",
      "CheckpointLoader|pysssss", "LoraLoader|pysssss",
    ],
  },

  "ComfyUI-Crystools": {
    name: "Crystools",
    repo: "https://github.com/crystian/ComfyUI-Crystools",
    description: "Debug, metadata, resource monitor nodes",
    approved: "approved",
    classTypes: [
      "Show any [Crystools]", "Debugger [Crystools]",
      "Metadata extractor [Crystools]",
      "Stats system [Crystools]",
      "Switch any [Crystools]", "Pipe to/from any [Crystools]",
      "List of any [Crystools]",
    ],
  },

  "ComfyUI-Allor": {
    name: "Allor Plugin",
    repo: "https://github.com/Nourepide/ComfyUI-Allor",
    description: "Alpha channel, image composite, font rendering",
    approved: "review",
    classTypes: [
      "AlphaChanelAdd", "AlphaChanelRemove",
      "ImageComposite", "ImageCompositeAbsolute",
      "ImageContainer", "ImageContainerInheritanceAdd",
      "FontFamilySelector", "ImageDrawText",
    ],
  },
};

// ── Reverse lookup: class_type → pack name ──

const _classTypeToPackCache = new Map<string, string>();

function buildClassTypeIndex() {
  if (_classTypeToPackCache.size > 0) return;
  for (const [packName, entry] of Object.entries(NODE_REGISTRY)) {
    for (const ct of entry.classTypes) {
      _classTypeToPackCache.set(ct, packName);
    }
  }
}

/**
 * Look up which node pack a class_type belongs to.
 * Returns null if not in the registry.
 */
export function classTypeToPackName(classType: string): string | null {
  buildClassTypeIndex();
  return _classTypeToPackCache.get(classType) || null;
}

/**
 * Look up a node pack entry by class_type.
 */
export function classTypeToPack(classType: string): NodePackEntry | null {
  const packName = classTypeToPackName(classType);
  if (!packName) return null;
  return NODE_REGISTRY[packName] || null;
}

/**
 * Resolve a list of unknown class_types against the registry.
 * Returns structured results for the ImportReport.
 */
export interface NodeResolution {
  classType: string;
  packName: string | null;
  pack: NodePackEntry | null;
  status: "approved" | "review" | "unknown";
}

export function resolveCustomNodes(classTypes: string[]): NodeResolution[] {
  return classTypes.map((ct) => {
    const pack = classTypeToPack(ct);
    if (!pack) {
      return { classType: ct, packName: null, pack: null, status: "unknown" as const };
    }
    return {
      classType: ct,
      packName: classTypeToPackName(ct),
      pack,
      status: pack.approved === "blocked" ? "unknown" as const : pack.approved,
    };
  });
}

/**
 * Get all unique packs needed for a list of class_types.
 * Deduplicates by pack name.
 */
export function getRequiredPacks(classTypes: string[]): {
  approved: NodePackEntry[];
  review: NodePackEntry[];
  unknown: string[];
} {
  const approved = new Map<string, NodePackEntry>();
  const review = new Map<string, NodePackEntry>();
  const unknown: string[] = [];

  for (const ct of classTypes) {
    const packName = classTypeToPackName(ct);
    if (!packName) {
      unknown.push(ct);
      continue;
    }
    const pack = NODE_REGISTRY[packName];
    if (!pack) {
      unknown.push(ct);
      continue;
    }

    if (pack.approved === "approved") {
      approved.set(packName, pack);
    } else if (pack.approved === "review") {
      review.set(packName, pack);
    } else {
      unknown.push(ct);
    }
  }

  return {
    approved: Array.from(approved.values()),
    review: Array.from(review.values()),
    unknown: [...new Set(unknown)],
  };
}
