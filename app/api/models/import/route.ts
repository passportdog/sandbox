import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getModel, getModelVersion, checkSafety, typeToFolder, getDownloadUrl } from "@/lib/civitai";
import type { CivitaiModel, CivitaiModelVersion } from "@/lib/civitai";

export const dynamic = "force-dynamic";

/**
 * POST /api/models/import
 *
 * Accepts:
 *   { url: "https://civitai.com/models/12345" }
 *   { url: "https://civitai.com/models/12345/version/67890" }
 *   { model_id: 12345 }
 *   { model_id: 12345, version_id: 67890 }
 *
 * Fetches model metadata from Civitai, runs safety checks,
 * and registers in models_registry with status "pending".
 */
export async function POST(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json();

  let modelId: number | null = null;
  let versionId: number | null = null;

  // Parse Civitai URL
  if (body.url) {
    const parsed = parseCivitaiUrl(body.url);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid Civitai URL. Expected: https://civitai.com/models/12345 or https://civitai.com/models/12345?modelVersionId=67890" }, { status: 400 });
    }
    modelId = parsed.modelId;
    versionId = parsed.versionId;
  } else {
    modelId = body.model_id || null;
    versionId = body.version_id || null;
  }

  if (!modelId) {
    return NextResponse.json({ error: "model_id or url required" }, { status: 400 });
  }

  try {
    // Fetch model from Civitai
    const model = await getModel(modelId);

    // Get the specific version or latest
    let version: CivitaiModelVersion;
    if (versionId) {
      version = model.modelVersions.find((v) => v.id === versionId)
        || await getModelVersion(versionId);
    } else {
      version = model.modelVersions[0];
    }

    if (!version) {
      return NextResponse.json({ error: "No versions found for this model" }, { status: 404 });
    }

    // Safety check
    const safety = checkSafety(version);
    if (!safety.safe) {
      return NextResponse.json({
        error: "Model failed safety check",
        reasons: safety.reasons,
        model_name: model.name,
      }, { status: 403 });
    }

    if (!safety.file) {
      return NextResponse.json({ error: "No downloadable file found" }, { status: 404 });
    }

    // Check if already registered
    const { data: existing } = await sb
      .from("models_registry")
      .select("id, download_status")
      .eq("civitai_model_id", model.id)
      .eq("civitai_version_id", version.id)
      .single();

    if (existing) {
      return NextResponse.json({
        message: "Model already registered",
        id: existing.id,
        download_status: existing.download_status,
      }, { status: 200 });
    }

    const folder = typeToFolder(model.type);
    const downloadUrl = getDownloadUrl(version.id);
    const previewUrl = version.images?.[0]?.url || null;

    // Register in DB
    const { data: registered, error } = await sb.from("models_registry").insert({
      name: `${model.name} - ${version.name}`,
      source: "civitai",
      source_id: `${model.id}/${version.id}`,
      download_url: downloadUrl,
      target_folder: folder,
      filename: safety.file.name,
      sha256: safety.file.hashes?.SHA256 || null,
      size_bytes: safety.file.sizeKB ? Math.round(safety.file.sizeKB * 1024) : null,
      format: safety.file.format,
      virus_scan_status: safety.file.virusScanResult,
      pickle_scan_status: safety.file.pickleScanResult,
      civitai_model_id: model.id,
      civitai_version_id: version.id,
      base_model: version.baseModel,
      model_type: model.type,
      preview_url: previewUrl,
      download_status: "pending",
      is_cached: false,
      metadata: {
        civitai_name: model.name,
        version_name: version.name,
        base_model: version.baseModel,
        type: model.type,
        safety_reasons: safety.reasons,
      },
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      id: registered.id,
      name: registered.name,
      filename: registered.filename,
      folder,
      size_mb: registered.size_bytes ? Math.round(registered.size_bytes / 1024 / 1024) : null,
      base_model: version.baseModel,
      model_type: model.type,
      safety: safety.reasons,
      download_status: "pending",
      preview_url: previewUrl,
    }, { status: 201 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── URL parser ───

function parseCivitaiUrl(url: string): { modelId: number; versionId: number | null } | null {
  try {
    const u = new URL(url);
    // https://civitai.com/models/12345/optional-slug
    // https://civitai.com/models/12345?modelVersionId=67890
    const match = u.pathname.match(/\/models\/(\d+)/);
    if (!match) return null;

    const modelId = parseInt(match[1]);
    const versionId = u.searchParams.get("modelVersionId");

    return {
      modelId,
      versionId: versionId ? parseInt(versionId) : null,
    };
  } catch {
    // Try bare number
    const num = parseInt(url);
    if (!isNaN(num)) return { modelId: num, versionId: null };
    return null;
  }
}
