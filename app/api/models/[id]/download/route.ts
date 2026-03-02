import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { runCommand } from "@/lib/runpod";
import { aria2cCommand } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

// POST /api/models/[id]/download — download a model to a pod
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getServiceClient();
  const body = await req.json();
  const { pod_id } = body;

  // Look up model
  const { data: model, error: modelErr } = await sb
    .from("models_registry")
    .select("*")
    .eq("id", params.id)
    .single();

  if (modelErr || !model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  if (!model.download_url) {
    return NextResponse.json({ error: "No download URL for this model" }, { status: 400 });
  }

  // Find a ready pod
  let pod;
  if (pod_id) {
    const { data } = await sb.from("pod_instances").select("*").eq("id", pod_id).single();
    pod = data;
  } else {
    const { data: readyPods } = await sb
      .from("pod_instances")
      .select("*")
      .eq("status", "ready")
      .order("last_used_at", { ascending: true })
      .limit(1);
    pod = readyPods?.[0];
  }

  if (!pod) {
    return NextResponse.json({ error: "No ready pods available. Launch one first." }, { status: 400 });
  }

  // Mark as downloading
  await sb.from("models_registry").update({
    download_status: "downloading",
    download_error: null,
  }).eq("id", model.id);

  try {
    // Build aria2c command
    const cmd = aria2cCommand({
      url: model.download_url,
      filename: model.filename,
      folder: model.target_folder,
      sizeMb: model.size_bytes ? Math.round(model.size_bytes / 1024 / 1024) : undefined,
    });

    // Execute on the pod
    const result = await runCommand(pod.runpod_pod_id, cmd);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || `aria2c exited with code ${result.exitCode}`);
    }

    // Mark as completed
    await sb.from("models_registry").update({
      is_cached: true,
      download_status: "completed",
      cached_at: new Date().toISOString(),
    }).eq("id", model.id);

    return NextResponse.json({
      id: model.id,
      download_status: "completed",
      filename: model.filename,
      folder: model.target_folder,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Download failed";

    await sb.from("models_registry").update({
      download_status: "failed",
      download_error: message,
    }).eq("id", model.id);

    return NextResponse.json({
      id: model.id,
      download_status: "failed",
      error: message,
    }, { status: 500 });
  }
}
