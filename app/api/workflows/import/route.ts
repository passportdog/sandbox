import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { analyzeWorkflow, slugify } from "@/lib/workflow-analyzer";
import { getRequiredPacks } from "@/lib/node-registry";
import { searchModels, typeToFolder, checkSafety, getDownloadUrl } from "@/lib/civitai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/workflows/import
 *
 * Accepts:
 *   { workflow: {...}, name?: string, description?: string, auto_resolve?: boolean }
 *
 * The workflow should be in ComfyUI API format (the JSON you get from
 * "Save (API Format)" or from workflow sharing sites).
 *
 * Analyzes the workflow to extract:
 * - Required models (checkpoints, loras, etc)
 * - Required custom node packs (resolved against node registry)
 * - Auto-generated param_schema for prompt, seed, steps, etc
 * - Auto-searches Civitai for missing models
 *
 * Registers it as a workflow_template in the DB.
 */
export async function POST(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json();

  let workflow = body.workflow;
  const name = body.name || "Imported Workflow";
  const description = body.description || null;
  const sourceUrl = body.source_url || null;
  const autoResolve = body.auto_resolve !== false; // default true

  if (!workflow) {
    return NextResponse.json({ error: "workflow JSON required" }, { status: 400 });
  }

  // Handle both API format and UI format
  if (workflow.nodes && Array.isArray(workflow.nodes)) {
    return NextResponse.json({
      error: "This looks like a ComfyUI UI format workflow. Please export using 'Save (API Format)' instead. In ComfyUI, go to the menu and click 'Save (API Format)' to get the correct JSON.",
    }, { status: 400 });
  }

  // Validate it looks like an API format workflow
  const nodeIds = Object.keys(workflow);
  if (nodeIds.length === 0) {
    return NextResponse.json({ error: "Empty workflow" }, { status: 400 });
  }

  const firstNode = workflow[nodeIds[0]];
  if (!firstNode?.class_type) {
    return NextResponse.json({
      error: "Invalid workflow format. Expected ComfyUI API format with class_type fields.",
    }, { status: 400 });
  }

  // ── Analyze ──
  const analysis = analyzeWorkflow(workflow);

  // Generate slug
  const slug = slugify(name) + "_" + Date.now().toString(36);

  // Determine category from features
  let category = "txt2img";
  if (analysis.hasControlnet) category = "controlnet";
  else if (analysis.hasUpscale) category = "upscale";
  else if (analysis.hasLora) category = "lora";

  // ── Resolve custom nodes against registry ──
  const nodePacks = getRequiredPacks(analysis.customNodes);

  // ── Check models against registry ──
  const requiredModelFilenames = analysis.models.map((m) => m.filename);

  const { data: existingModels } = await sb
    .from("models_registry")
    .select("id, filename, is_cached, download_status")
    .in("filename", requiredModelFilenames.length > 0 ? requiredModelFilenames : ["__none__"]);

  const existingByFilename = new Map(
    (existingModels || []).map((m) => [m.filename, m])
  );

  // Build per-model status
  const modelStatuses = analysis.models.map((m) => {
    const existing = existingByFilename.get(m.filename);
    if (existing?.is_cached) {
      return { ...m, status: "cached" as const, registry_id: existing.id };
    }
    if (existing) {
      return { ...m, status: "registered" as const, registry_id: existing.id, download_status: existing.download_status };
    }
    return { ...m, status: "missing" as const, registry_id: null };
  });

  const missingModels = modelStatuses.filter((m) => m.status === "missing");

  // ── Auto-search Civitai for missing models ──
  const civitaiMatches: Array<{
    filename: string;
    folder: string;
    civitai_model_id: number;
    civitai_version_id: number;
    civitai_name: string;
    download_url: string;
    size_kb: number;
    base_model: string;
    preview_url: string | null;
  }> = [];

  if (autoResolve && missingModels.length > 0) {
    // Search Civitai for each missing model (in parallel, max 5)
    const searchPromises = missingModels.slice(0, 5).map(async (m) => {
      try {
        // Extract a search-friendly name: remove extension, replace underscores
        const searchName = m.filename
          .replace(/\.(safetensors|ckpt|pt|bin)$/i, "")
          .replace(/[_-]/g, " ")
          .slice(0, 60);

        const results = await searchModels(searchName, 3);

        for (const model of results) {
          const version = model.modelVersions?.[0];
          if (!version) continue;

          const safety = checkSafety(version);
          if (!safety.safe || !safety.file) continue;

          // Check if filename matches (exact or close)
          const civFilename = safety.file.name.toLowerCase();
          const targetFilename = m.filename.toLowerCase();

          if (
            civFilename === targetFilename ||
            civFilename.replace(/[_\-\s]/g, "") === targetFilename.replace(/[_\-\s]/g, "")
          ) {
            civitaiMatches.push({
              filename: m.filename,
              folder: m.folder,
              civitai_model_id: model.id,
              civitai_version_id: version.id,
              civitai_name: `${model.name} - ${version.name}`,
              download_url: getDownloadUrl(version.id),
              size_kb: safety.file.sizeKB,
              base_model: version.baseModel,
              preview_url: version.images?.[0]?.url || null,
            });
            break; // Found a match, stop searching this model
          }
        }
      } catch {
        // Civitai search failed for this model — skip silently
      }
    });

    await Promise.allSettled(searchPromises);
  }

  const uncachedModels = modelStatuses.filter(
    (m): m is typeof m & { status: "registered"; download_status: string; registry_id: string } =>
      m.status === "registered"
  );

  // ── Insert template ──
  const { data: template, error } = await sb.from("workflow_templates").insert({
    name,
    slug,
    description,
    category,
    workflow_json: workflow,
    raw_workflow: workflow,
    required_models: requiredModelFilenames,
    required_node_packs: analysis.customNodes,
    param_schema: analysis.paramSchema,
    source: sourceUrl ? "civitai" : "upload",
    source_url: sourceUrl,
    is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: template.id,
    slug: template.slug,
    name: template.name,
    category,
    analysis: {
      node_count: analysis.nodeCount,
      models: modelStatuses.map((m) => ({
        filename: m.filename,
        folder: m.folder,
        node_type: m.nodeType,
        status: m.status,
        registry_id: m.registry_id,
      })),
      custom_nodes: {
        approved: nodePacks.approved.map((p) => ({ name: p.name, repo: p.repo })),
        needs_review: nodePacks.review.map((p) => ({ name: p.name, repo: p.repo, description: p.description })),
        unknown: nodePacks.unknown,
      },
      param_schema: analysis.paramSchema,
      has_controlnet: analysis.hasControlnet,
      has_lora: analysis.hasLora,
      has_upscale: analysis.hasUpscale,
    },
    missing_models: missingModels.map((m) => ({
      filename: m.filename,
      folder: m.folder,
      node_type: m.nodeType,
    })),
    civitai_matches: civitaiMatches,
    uncached_models: uncachedModels.map((m) => ({
      filename: m.filename,
      registry_id: m.registry_id,
      download_status: m.download_status,
    })),
    readiness: {
      models_ready: missingModels.length === 0 && uncachedModels.length === 0,
      models_total: modelStatuses.length,
      models_cached: modelStatuses.filter((m) => m.status === "cached").length,
      models_missing: missingModels.length,
      models_civitai_found: civitaiMatches.length,
      nodes_approved: nodePacks.approved.length,
      nodes_need_review: nodePacks.review.length,
      nodes_unknown: nodePacks.unknown.length,
    },
  }, { status: 201 });
}
