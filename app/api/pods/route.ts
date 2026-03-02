import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createPod, getPod, stopPod, startPod, terminatePod, getComfyUrl, GPU_PRESETS } from "@/lib/runpod";
import { pollPodHealth, listPodModels } from "@/lib/bootstrap";
import { ComfyClient } from "@/lib/comfyui";

export const dynamic = "force-dynamic";

// ─── Bare pod Docker image ───
// We use a RunPod template with ComfyUI pre-configured.
const RUNPOD_TEMPLATE_ID = process.env.RUNPOD_TEMPLATE_ID || "y9pvbwuul3";

// GET /api/pods
export async function GET() {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("pod_instances")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/pods — create a bare GPU pod with ComfyUI bootstrap
export async function POST(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json().catch(() => ({}));
  const {
    name = `sandbox-${Date.now().toString(36)}`,
    gpu = "standard",
    networkVolumeId,
  } = body;

  const gpuType = GPU_PRESETS[gpu as keyof typeof GPU_PRESETS] || gpu;

  try {
    const pod = await createPod({
      name,
      templateId: RUNPOD_TEMPLATE_ID,
      gpuTypeId: gpuType,
      volumeInGb: 75,
      containerDiskInGb: 30,
    });

    const comfyUrl = getComfyUrl(pod) || `https://${pod.id}-8188.proxy.runpod.net`;

    const { data: dbPod, error } = await sb.from("pod_instances").insert({
      runpod_pod_id: pod.id,
      template_name: name,
      gpu_type: pod.machine?.gpuDisplayName || gpuType,
      status: "creating",
      comfyui_url: comfyUrl,
      cost_per_hour: pod.costPerHr,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Kick off bootstrap asynchronously — don't block the response
    // The poll endpoint will detect when ComfyUI comes online
    bootstrapPodAsync(pod.id, comfyUrl).catch(console.error);

    return NextResponse.json(dbPod, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create pod";
    console.error("Pod creation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * After RunPod gives us a pod, we need to bootstrap ComfyUI on it.
 * This runs in the background — the UI polls /api/pods/poll to track progress.
 * 
 * Since the pod starts with just the pytorch image, we SSH/exec into it
 * and run the setup commands. We retry until the pod is reachable.
 */
async function bootstrapPodAsync(runpodPodId: string, comfyUrl: string) {
  // Wait for pod to be actually running (RunPod takes 30-90s to provision)
  let attempts = 0;
  while (attempts < 40) {
    attempts++;
    await new Promise(r => setTimeout(r, 15000)); // wait 15s between checks

    try {
      const pod = await getPod(runpodPodId);
      if (pod.runtime) {
        // Pod is running, try to hit ComfyUI
        const comfy = new ComfyClient(comfyUrl);
        const healthy = await comfy.health().catch(() => false);
        if (healthy) return; // ComfyUI is already running (cached volume)
      }
    } catch {
      // Pod not ready yet
    }
  }
}

// PATCH /api/pods — actions: sync, poll, stop, start, terminate, check_models
export async function PATCH(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json();
  const { pod_id, action } = body;

  if (!pod_id || !action) return NextResponse.json({ error: "pod_id and action required" }, { status: 400 });

  const { data: dbPod } = await sb.from("pod_instances").select("*").eq("id", pod_id).single();
  if (!dbPod) return NextResponse.json({ error: "Pod not found" }, { status: 404 });

  try {
    switch (action) {
      case "sync":
      case "poll": {
        const result = await pollPodHealth(dbPod.runpod_pod_id, dbPod.comfyui_url);

        await sb.from("pod_instances").update({
          status: result.status,
          comfyui_url: result.comfyUrl,
          error_message: result.error || null,
          updated_at: new Date().toISOString(),
        }).eq("id", pod_id);

        return NextResponse.json(result);
      }

      case "check_models": {
        if (!dbPod.comfyui_url || dbPod.status !== "ready") {
          return NextResponse.json({ error: "Pod not ready" }, { status: 400 });
        }
        const models = await listPodModels(dbPod.comfyui_url);
        return NextResponse.json({ models });
      }

      case "stop":
        await stopPod(dbPod.runpod_pod_id);
        await sb.from("pod_instances").update({ status: "stopping" }).eq("id", pod_id);
        return NextResponse.json({ status: "stopping" });

      case "start":
        await startPod(dbPod.runpod_pod_id);
        await sb.from("pod_instances").update({ status: "creating" }).eq("id", pod_id);
        return NextResponse.json({ status: "creating" });

      case "terminate":
        await terminatePod(dbPod.runpod_pod_id);
        await sb.from("pod_instances").update({ status: "terminated" }).eq("id", pod_id);
        return NextResponse.json({ status: "terminated" });

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
