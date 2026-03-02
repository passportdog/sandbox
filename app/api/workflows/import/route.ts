import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { analyzeWorkflow, categorize, slugify, validateApiFormat } from "@/lib/workflow-analyzer";

export const dynamic = "force-dynamic";

// POST /api/workflows/import — analyze and register a ComfyUI workflow
export async function POST(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json();
  const { workflow, name, description } = body;

  if (!workflow) {
    return NextResponse.json({ error: "workflow is required (ComfyUI API-format JSON)" }, { status: 400 });
  }

  // Validate format
  const validation = validateApiFormat(workflow);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    // Analyze the workflow
    const analysis = analyzeWorkflow(workflow);
    const category = categorize(analysis);
    const templateName = name || `Workflow ${Date.now().toString(36)}`;
    const slug = slugify(templateName);

    // Check for duplicate slug
    const { data: existing } = await sb
      .from("workflow_templates")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: `Template with slug "${slug}" already exists` }, { status: 409 });
    }

    // Extract required model filenames
    const requiredModels = [...new Set(analysis.models.map((m) => m.filename))];
    const requiredNodePacks = analysis.custom_nodes;

    // Cross-check against models_registry for missing models
    const { data: registeredModels } = await sb
      .from("models_registry")
      .select("filename, is_cached")
      .in("filename", requiredModels.length > 0 ? requiredModels : ["__none__"]);

    const registeredSet = new Set((registeredModels || []).map((m: { filename: string }) => m.filename));
    const cachedSet = new Set(
      (registeredModels || [])
        .filter((m: { is_cached: boolean }) => m.is_cached)
        .map((m: { filename: string }) => m.filename)
    );

    const missingModels = requiredModels.filter((f) => !registeredSet.has(f));
    const uncachedModels = requiredModels.filter((f) => registeredSet.has(f) && !cachedSet.has(f));

    // Insert template
    const { data: template, error } = await sb
      .from("workflow_templates")
      .insert({
        name: templateName,
        slug,
        description: description || null,
        category,
        workflow_json: workflow,
        raw_workflow: workflow,
        required_models: requiredModels,
        required_node_packs: requiredNodePacks,
        param_schema: analysis.param_schema,
        source: "upload",
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      id: template.id,
      slug: template.slug,
      name: template.name,
      category,
      analysis: {
        node_count: analysis.node_count,
        models: analysis.models,
        custom_nodes: analysis.custom_nodes,
        param_schema: analysis.param_schema,
        features: analysis.features,
      },
      missing_models: missingModels,
      uncached_models: uncachedModels,
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
