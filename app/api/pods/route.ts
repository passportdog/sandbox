import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createPod, getPod, listPods, stopPod, startPod, terminatePod, getComfyUrl, GPU_PRESETS } from "@/lib/runpod";

export const dynamic = "force-dynamic";

// GET /api/pods — list pods from DB + sync with RunPod
export async function GET() {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("pod_instances")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/pods — create a new pod
export async function POST(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json();
  const {
    name = "sandbox-comfyui",
    gpu = "standard",
    image = "timpietruskyblibla/runpod-worker-comfy:3.7.0-sdxl",
    networkVolumeId,
  } = body;

  const gpuType = GPU_PRESETS[gpu as keyof typeof GPU_PRESETS] || gpu;

  try {
    const pod = await createPod({
      name,
      imageId: image,
      gpuTypeId: gpuType,
      ports: "8188/http,22/tcp",
      volumeInGb: 50,
      containerDiskInGb: 30,
      networkVolumeId,
      volumeMountPath: "/workspace",
      env: {
        COMFYUI_PORT: "8188",
      },
    });

    const comfyUrl = getComfyUrl(pod);

    // Store in DB
    const { data: dbPod, error } = await sb.from("pod_instances").insert({
      runpod_pod_id: pod.id,
      template_name: name,
      gpu_type: pod.machine?.gpuDisplayName || gpuType,
      status: "creating",
      comfyui_url: comfyUrl || `https://${pod.id}-8188.proxy.runpod.net`,
      cost_per_hour: pod.costPerHr,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(dbPod, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create pod";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/pods — actions: sync, stop, start, terminate
export async function PATCH(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json();
  const { pod_id, action } = body;

  if (!pod_id || !action) return NextResponse.json({ error: "pod_id and action required" }, { status: 400 });

  // Get DB record
  const { data: dbPod } = await sb
    .from("pod_instances")
    .select("*")
    .eq("id", pod_id)
    .single();

  if (!dbPod) return NextResponse.json({ error: "Pod not found" }, { status: 404 });

  try {
    switch (action) {
      case "sync": {
        const rpPod = await getPod(dbPod.runpod_pod_id);
        const comfyUrl = getComfyUrl(rpPod);
        let status = dbPod.status;

        if (rpPod.desiredStatus === "RUNNING" && rpPod.runtime) {
          status = dbPod.status === "bootstrapping" ? "bootstrapping" : "running";
        } else if (rpPod.desiredStatus === "EXITED") {
          status = "stopped";
        }

        await sb.from("pod_instances").update({
          status,
          ip_address: rpPod.runtime?.ports?.[0]?.ip || null,
          comfyui_url: comfyUrl || dbPod.comfyui_url,
          cost_per_hour: rpPod.costPerHr,
          updated_at: new Date().toISOString(),
        }).eq("id", pod_id);

        return NextResponse.json({ status, comfyui_url: comfyUrl });
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

      case "mark_ready":
        await sb.from("pod_instances").update({ status: "ready" }).eq("id", pod_id);
        return NextResponse.json({ status: "ready" });

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
