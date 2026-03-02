import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { ComfyClient, patchWorkflow } from "@/lib/comfyui";

export const dynamic = "force-dynamic";

// POST /api/jobs/[id]/execute — execute workflow on ComfyUI pod
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getServiceClient();

  // Get job with template and pod
  const { data: job, error: jobErr } = await sb
    .from("jobs")
    .select("*, workflow_templates(*), pod_instances(*)")
    .eq("id", params.id)
    .single();

  if (jobErr || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!["planned", "approved"].includes(job.status)) {
    return NextResponse.json({ error: `Job status is ${job.status}, expected planned or approved` }, { status: 400 });
  }

  // Find a ready pod
  let pod = job.pod_instances;
  if (!pod) {
    const { data: readyPods } = await sb
      .from("pod_instances")
      .select("*")
      .eq("status", "ready")
      .order("last_used_at", { ascending: true })
      .limit(1);

    pod = readyPods?.[0];
    if (!pod) return NextResponse.json({ error: "No ready pods available. Provision one first." }, { status: 400 });

    await sb.from("jobs").update({ pod_instance_id: pod.id }).eq("id", job.id);
  }

  if (!pod.comfyui_url) return NextResponse.json({ error: "Pod has no ComfyUI URL" }, { status: 400 });

  const comfy = new ComfyClient(pod.comfyui_url);
  const template = job.workflow_templates;

  if (!template) return NextResponse.json({ error: "No workflow template assigned" }, { status: 400 });

  // Update status
  await sb.from("jobs").update({ status: "executing" }).eq("id", job.id);
  await sb.from("job_events").insert({ job_id: job.id, event_type: "execution_started", event_data: { pod_id: pod.id, comfyui_url: pod.comfyui_url } });

  try {
    // Health check
    const healthy = await comfy.health();
    if (!healthy) throw new Error("ComfyUI not reachable at " + pod.comfyui_url);

    await sb.from("job_events").insert({ job_id: job.id, event_type: "comfyui_healthy", event_data: {} });

    // Patch workflow with params
    const workflow = patchWorkflow(
      template.workflow_json as Record<string, unknown>,
      (template.param_schema || {}) as Record<string, { node: string; field: string }>,
      (job.params || {}) as Record<string, unknown>
    );

    // Random seed if -1 or not set
    if (job.params?.seed === -1 || job.params?.seed === undefined) {
      const seedSchema = (template.param_schema as Record<string, { node: string; field: string }>)?.seed;
      if (seedSchema) {
        const node = workflow[seedSchema.node] as Record<string, Record<string, unknown>>;
        if (node?.inputs) node.inputs.seed = Math.floor(Math.random() * 2 ** 32);
      }
    }

    // Queue prompt
    const result = await comfy.queuePrompt(workflow);
    const promptId = result.prompt_id;

    await sb.from("jobs").update({ prompt_id: promptId }).eq("id", job.id);
    await sb.from("job_events").insert({ job_id: job.id, event_type: "prompt_queued", event_data: { prompt_id: promptId, queue_position: result.number } });

    // Poll for completion
    const history = await comfy.waitForCompletion(promptId, 300000);

    await sb.from("job_events").insert({ job_id: job.id, event_type: "prompt_completed", event_data: { status: history.status } });

    // Extract output images
    const outputImages: { filename: string; url: string }[] = [];
    for (const [, nodeOutput] of Object.entries(history.outputs)) {
      if (nodeOutput.images) {
        for (const img of nodeOutput.images) {
          const url = comfy.imageUrl(img.filename, img.subfolder, img.type);
          outputImages.push({ filename: img.filename, url });
        }
      }
    }

    // Save outputs
    for (const img of outputImages) {
      await sb.from("outputs").insert({
        job_id: job.id,
        file_type: "image",
        filename: img.filename,
        public_url: img.url,
        metadata: { prompt: job.params?.prompt, seed: job.params?.seed },
      });
    }

    // Mark complete
    await sb.from("jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);

    await sb.from("pod_instances").update({ last_used_at: new Date().toISOString() }).eq("id", pod.id);

    await sb.from("job_events").insert({
      job_id: job.id,
      event_type: "job_completed",
      event_data: { output_count: outputImages.length, images: outputImages },
    });

    return NextResponse.json({ status: "completed", outputs: outputImages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Execution failed";
    await sb.from("jobs").update({ status: "failed", error: message }).eq("id", job.id);
    await sb.from("job_events").insert({ job_id: job.id, event_type: "execution_failed", event_data: { error: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
