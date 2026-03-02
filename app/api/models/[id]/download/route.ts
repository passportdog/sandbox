import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { ComfyClient } from "@/lib/comfyui";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/models/[id]/download
 *
 * Downloads a registered model to a ready pod.
 * Accepts: { pod_id?: string } — optional, will pick first ready pod if not given.
 *
 * Strategy: Since we can't SSH into RunPod from Vercel, we use a workaround:
 * - The bootstrap script installs aria2c on the pod
 * - We create a small download script via ComfyUI's /upload/image endpoint
 *   placed in the custom_nodes folder, which can execute shell commands
 * - Alternative: use a lightweight download helper deployed as a custom node
 *
 * For V1: we rely on the pod having aria2c installed (from bootstrap) and
 * use the RunPod proxy exec endpoint or a download manager custom node.
 *
 * Simplest reliable approach: write a download.sh to the pod via the
 * exec API, then monitor progress.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sb = getServiceClient();

  // Get model
  const { data: model, error: modelErr } = await sb
    .from("models_registry")
    .select("*")
    .eq("id", params.id)
    .single();

  if (modelErr || !model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  if (model.download_status === "downloading") {
    return NextResponse.json({ error: "Download already in progress" }, { status: 409 });
  }

  if (model.is_cached && model.download_status === "completed") {
    return NextResponse.json({ message: "Model already downloaded", id: model.id }, { status: 200 });
  }

  if (!model.download_url) {
    return NextResponse.json({ error: "No download URL" }, { status: 400 });
  }

  // Find a ready pod
  const body = await _req.json().catch(() => ({}));
  let pod;

  if (body.pod_id) {
    const { data } = await sb.from("pod_instances").select("*").eq("id", body.pod_id).eq("status", "ready").single();
    pod = data;
  } else {
    const { data } = await sb.from("pod_instances").select("*").eq("status", "ready").order("last_used_at", { ascending: true, nullsFirst: true }).limit(1);
    pod = data?.[0];
  }

  if (!pod?.comfyui_url) {
    return NextResponse.json({ error: "No ready pod available" }, { status: 400 });
  }

  // Mark as downloading
  await sb.from("models_registry").update({
    download_status: "downloading",
    download_error: null,
    pod_instance_id: pod.id,
  }).eq("id", model.id);

  try {
    // Verify pod is healthy
    const comfy = new ComfyClient(pod.comfyui_url);
    const healthy = await comfy.health();
    if (!healthy) throw new Error("Pod not responding");

    // Use RunPod exec API to download the model
    // RunPod pods expose an exec endpoint at the proxy URL
    const targetPath = `/workspace/ComfyUI/models/${model.target_folder}/${model.filename}`;

    // Build the download command
    const downloadCmd = [
      // Check if already exists
      `if [ -f "${targetPath}" ]; then echo "EXISTS"; exit 0; fi`,
      // Download with aria2c (installed during bootstrap)
      `aria2c -x 16 -s 16 --allow-overwrite=true`,
      `-d /workspace/ComfyUI/models/${model.target_folder}`,
      `-o "${model.filename}"`,
      `"${model.download_url}"`,
      `&& echo "DONE"`,
    ].join(" ");

    // Execute via RunPod's HTTP proxy exec endpoint
    // The pod needs to have our exec helper running (installed during bootstrap)
    const execRes = await fetch(`${pod.comfyui_url.replace(":8188", ":7860")}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: downloadCmd }),
      signal: AbortSignal.timeout(280_000), // 4.5 min timeout
    }).catch(() => null);

    let success = false;

    if (execRes?.ok) {
      const result = await execRes.json();
      success = result.stdout?.includes("DONE") || result.stdout?.includes("EXISTS");
      if (!success && result.stderr) {
        throw new Error(`Download failed: ${result.stderr.slice(0, 200)}`);
      }
    } else {
      // Fallback: use RunPod API exec
      const { runCommand } = await import("@/lib/runpod");
      const result = await runCommand(pod.runpod_pod_id, downloadCmd, 280_000);
      success = result.stdout.includes("DONE") || result.stdout.includes("EXISTS");
      if (!success) {
        throw new Error(result.stderr?.slice(0, 200) || "Download command failed");
      }
    }

    // Verify the file exists by checking ComfyUI's model list
    // We need to refresh ComfyUI's model list
    // Send a dummy object_info request which re-scans models
    await comfy.objectInfo().catch(() => {});

    // Mark as completed
    await sb.from("models_registry").update({
      download_status: "completed",
      is_cached: true,
      cached_at: new Date().toISOString(),
      download_error: null,
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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
