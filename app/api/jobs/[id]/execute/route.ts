import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { ComfyClient, patchWorkflow } from "@/lib/comfyui";
import { JobEngine, EVENT_STEPS, TIMEOUTS, withTimeout, withRetry } from "@/lib/engine";
import { listPodModels } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min Vercel timeout

// POST /api/jobs/[id]/execute
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getServiceClient();
  const engine = new JobEngine(sb);
  const jobId = params.id;

  // ─── Gate: only planned jobs (or retries from failed_queue/failed_runtime) ───
  const { data: job } = await sb
    .from("jobs")
    .select("*, workflow_templates(*)")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Idempotent: refuse if already running, uploading, or completed
  if (["running", "uploading", "completed"].includes(job.status)) {
    return NextResponse.json({ error: `Job is already ${job.status}` }, { status: 409 });
  }

  // Allow execute from: planned, failed_queue, failed_runtime
  if (!["planned", "failed_queue", "failed_runtime"].includes(job.status)) {
    return NextResponse.json({ error: `Cannot execute from status ${job.status}` }, { status: 400 });
  }

  const template = job.workflow_templates;
  if (!template) return NextResponse.json({ error: "No workflow template assigned" }, { status: 400 });

  // ─── Phase: QUEUE — find pod, health check, patch workflow, queue prompt ───
  let pod: Record<string, unknown> | null = null;

  try {
    // Transition to queued
    await engine.transition(jobId, "queued");

    // Find a ready pod (least recently used)
    const { data: readyPods } = await sb
      .from("pod_instances")
      .select("*")
      .eq("status", "ready")
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(3);

    if (!readyPods?.length) {
      await engine.fail(jobId, "queue", "No ready pods available. Provision one first.", false);
      return NextResponse.json({ error: "No ready pods available" }, { status: 400 });
    }

    // Try pods in order — failover to next if unhealthy
    for (const candidate of readyPods) {
      if (!candidate.comfyui_url) continue;

      const comfy = new ComfyClient(candidate.comfyui_url);
      try {
        const healthy = await withTimeout(
          comfy.health(),
          TIMEOUTS.POD_HEALTH,
          "Pod health check"
        );

        if (healthy) {
          pod = candidate;
          await engine.log(jobId, EVENT_STEPS.POD_ASSIGNED, {
            pod_id: candidate.id,
            gpu_type: candidate.gpu_type,
            comfyui_url: candidate.comfyui_url,
          });
          await engine.log(jobId, EVENT_STEPS.POD_HEALTH_OK, { pod_id: candidate.id });
          break;
        }
      } catch {
        await engine.log(jobId, EVENT_STEPS.POD_HEALTH_FAIL, {
          pod_id: candidate.id,
          comfyui_url: candidate.comfyui_url,
        });
        // Mark pod as unhealthy
        await sb.from("pod_instances").update({ status: "error", error_message: "Health check failed" }).eq("id", candidate.id);
        continue;
      }
    }

    if (!pod) {
      await engine.fail(jobId, "queue", "All available pods failed health checks", true);
      return NextResponse.json({ error: "All pods unhealthy" }, { status: 503 });
    }

    // Assign pod to job
    await sb.from("jobs").update({ pod_instance_id: pod.id }).eq("id", jobId);

    // Check if required models are available
    const requiredModels = (template as Record<string, unknown>).required_models as string[] | undefined;
    if (requiredModels?.length && pod.comfyui_url) {
      const availableModels = await listPodModels(pod.comfyui_url as string);
      const missing = requiredModels.filter((m) => !availableModels.some((a) => a.includes(m) || m.includes(a)));
      if (missing.length > 0) {
        await engine.log(jobId, "model.check", { required: requiredModels, available: availableModels, missing });
        // Don't fail — model might be under a different name or still loading
        // Just log the warning
      } else {
        await engine.log(jobId, "model.check", { required: requiredModels, all_present: true });
      }
    }

    // Patch workflow
    const workflow = patchWorkflow(
      template.workflow_json as Record<string, unknown>,
      (template.param_schema || {}) as Record<string, { node: string; field: string }>,
      (job.params || {}) as Record<string, unknown>
    );

    // Random seed
    if (job.params?.seed === -1 || job.params?.seed === undefined) {
      const seedSchema = (template.param_schema as Record<string, { node: string; field: string }>)?.seed;
      if (seedSchema) {
        const node = workflow[seedSchema.node] as Record<string, Record<string, unknown>>;
        if (node?.inputs) node.inputs.seed = Math.floor(Math.random() * 2 ** 32);
      }
    }

    await engine.log(jobId, EVENT_STEPS.WORKFLOW_PATCHED, {
      template_slug: template.slug,
      params: job.params,
    });

    // Queue prompt
    const comfy = new ComfyClient(pod.comfyui_url as string);
    const result = await comfy.queuePrompt(workflow);
    const promptId = result.prompt_id;

    await sb.from("jobs").update({ prompt_id: promptId }).eq("id", jobId);
    await engine.log(jobId, EVENT_STEPS.COMFYUI_QUEUED, {
      prompt_id: promptId,
      queue_position: result.number,
    });

    // ─── Phase: RUNNING — poll for completion ───
    await engine.transition(jobId, "running");

    const t0 = Date.now();
    const history = await withTimeout(
      comfy.waitForCompletion(promptId, TIMEOUTS.EXECUTION, TIMEOUTS.POLL_INTERVAL),
      TIMEOUTS.EXECUTION + 10_000, // outer timeout slightly longer
      "ComfyUI execution"
    );
    const execMs = Date.now() - t0;

    await engine.log(jobId, EVENT_STEPS.COMFYUI_COMPLETED, {
      prompt_id: promptId,
      status: history.status?.status_str,
    }, execMs);

    // ─── Phase: UPLOADING — save outputs ───
    await engine.transition(jobId, "uploading");
    await engine.log(jobId, EVENT_STEPS.ARTIFACT_SAVING, {});

    const outputImages: { filename: string; url: string }[] = [];
    for (const [, nodeOutput] of Object.entries(history.outputs)) {
      if (nodeOutput.images) {
        for (const img of nodeOutput.images) {
          outputImages.push({
            filename: img.filename,
            url: comfy.imageUrl(img.filename, img.subfolder, img.type),
          });
        }
      }
    }

    // Save each output with retry
    for (const img of outputImages) {
      await withRetry(
        async () => {
          const { error } = await sb.from("outputs").insert({
            job_id: jobId,
            file_type: "image",
            filename: img.filename,
            public_url: img.url,
            metadata: { prompt: job.params?.prompt, seed: job.params?.seed },
          });
          if (error) throw new Error(`Output insert failed: ${error.message}`);
        },
        { maxAttempts: 2, delayMs: 1000, label: `Save output ${img.filename}` }
      );

      await engine.log(jobId, EVENT_STEPS.ARTIFACT_SAVED, {
        filename: img.filename,
        url: img.url,
      });
    }

    // ─── Phase: COMPLETED ───
    await engine.transition(jobId, "completed", {
      completed_at: new Date().toISOString(),
      gpu_seconds: Math.round(execMs / 1000),
    });

    await sb.from("pod_instances").update({ last_used_at: new Date().toISOString() }).eq("id", pod.id);

    await engine.log(jobId, EVENT_STEPS.JOB_COMPLETED, {
      output_count: outputImages.length,
      total_duration_ms: Date.now() - t0,
      attempt: job.attempt,
    });

    return NextResponse.json({ status: "completed", outputs: outputImages });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Execution failed";

    // Determine which phase failed based on current job status
    const { data: current } = await sb.from("jobs").select("status").eq("id", jobId).single();
    const phase = current?.status === "queued" ? "queue"
      : current?.status === "uploading" ? "upload"
      : "runtime";

    await engine.fail(jobId, phase as "queue" | "runtime" | "upload", message, true);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
