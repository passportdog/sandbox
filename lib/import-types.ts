// Shared types for model/workflow import

export interface ModelEntry {
  id: string;
  name: string;
  filename: string;
  target_folder: string;
  model_type: string | null;
  base_model: string | null;
  is_cached: boolean;
  download_status: string; // pending | downloading | completed | failed
  download_error: string | null;
  preview_url: string | null;
  size_bytes: number | null;
}

export interface ImportReportModel {
  filename: string;
  folder: string;
  nodeType: string;
  status: "cached" | "registered" | "missing";
  registryId?: string;
}

export interface ImportReportParam {
  node: string;
  field: string;
  type: "string" | "integer" | "number";
  label?: string;
  min?: number;
  max?: number;
  default?: string | number;
}

export interface ImportReport {
  type: "model" | "workflow";

  // For workflows:
  templateId?: string;
  templateName?: string;
  templateSlug?: string;
  category?: string;
  nodeCount?: number;
  models?: ImportReportModel[];
  customNodes?: string[];
  paramSchema?: Record<string, ImportReportParam>;
  missingModels?: Array<{ filename: string; folder: string }>;

  // For models:
  modelId?: string;
  modelName?: string;
  modelFilename?: string;
  modelFolder?: string;
  modelSize?: number;
  baseModel?: string;
  downloadStatus?: string;
  previewUrl?: string;
}
