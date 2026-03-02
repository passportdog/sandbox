import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getModel, getModelVersion, checkSafety, typeToFolder, getDownloadUrl } from "@/lib/civitai";

export const dynamic = "force-dynamic";

/** Parse a Civitai URL into model ID and optional version ID */
function parseCivitaiUrl(url: string): { modelId: number; versionId?: number } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("civitai.com")) return null;

    // /models/12345 or /models/12345/some-slug
    const match = u.pathname.match(/\/models\/(\d+)/);
    if (!match) return null;

    const modelId = parseInt(match[1], 10);
    const versionId = u.searchParams.get("modelVersionId");

    return {
      modelId,
      versionId: versionId ? parseInt(versionId, 10) : undefined,
    };
  } catch {
    return null;
  }
}

// POST /api/models/import — import a model from Civitai
export async function POST(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json();
  const { url, model_id, version_id } = body;

  let modelId: number;
  let versionId: number | undefined;

  if (url) {
    const parsed = parseCivitaiUrl(url);
    if (!parsed) return NextResponse.json({ error: "Invalid Civitai URL" }, { status: 400 });
    modelId = parsed.modelId;
    versionId = parsed.versionId;
  } else if (model_id) {
    modelId = Number(model_id);
    versionId = version_id ? Number(version_id) : undefined;
  } else {
    return NextResponse.json({ error: "Provide a Civitai URL or model_id" }, { status: 400 });
  }

  try {
    // Fetch model metadata from Civitai
    const model = await getModel(modelId);

    // Pick version: specified version, or latest
    let version;
    if (versionId) {
      version = await getModelVersion(versionId);
    } else {
      version = model.modelVersions[0];
      if (!version) return NextResponse.json({ error: "No versions found for this model" }, { status: 404 });
      versionId = version.id;
    }

    // Safety check
    const safety = checkSafety(version);
    if (!safety.safe) {
      return NextResponse.json({
        error: "Model failed safety checks",
        reasons: safety.reasons,
      }, { status: 422 });
    }

    const file = safety.file!;
    const folder = typeToFolder(model.type);
    const downloadUrl = getDownloadUrl(versionId);
    const previewUrl = version.images[0]?.url || null;

    // Check for duplicate
    const { data: existing } = await sb
      .from("models_registry")
      .select("id")
      .eq("source_id", `${modelId}/${versionId}`)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Model already imported", id: existing.id }, { status: 409 });
    }

    // Insert into models_registry
    const { data: dbModel, error } = await sb
      .from("models_registry")
      .insert({
        name: `${model.name} - ${version.name}`,
        source: "civitai",
        source_id: `${modelId}/${versionId}`,
        download_url: downloadUrl,
        target_folder: folder,
        filename: file.name,
        sha256: file.hashes.SHA256 || null,
        size_bytes: file.sizeKB * 1024,
        format: file.format === "SafeTensor" ? "safetensors" : "ckpt",
        base_model: version.baseModel || null,
        model_type: model.type,
        preview_url: previewUrl,
        is_cached: false,
        download_status: "pending",
        civitai_model_id: modelId,
        civitai_version_id: versionId,
        virus_scan_status: file.virusScanResult,
        pickle_scan_status: file.pickleScanResult,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      id: dbModel.id,
      name: dbModel.name,
      filename: dbModel.filename,
      folder: dbModel.target_folder,
      size_mb: dbModel.size_bytes ? Math.round(dbModel.size_bytes / 1024 / 1024) : null,
      base_model: dbModel.base_model,
      safety: { safe: safety.safe, reasons: safety.reasons },
      download_status: dbModel.download_status,
      preview_url: dbModel.preview_url,
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
