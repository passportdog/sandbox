import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { ComfyClient, patchWorkflow } from "@/lib/comfyui";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/workflows/:slug/run
 *
 * The core product endpoint. Takes a template slug + params,
 * patches the workflow, queues it on a ready pod, and returns
 * a job ID for tracking.
 *
 * Body: {
 *   prompt?: string,
 *   negative_prompt?: string,
 *   seed?: number,
 *   steps?: number,
 *   cfg?: number,
 *   width?: number,
 *   height?: number,
 *   ...any param in the template's param_schema
 *   pod_id?: string,         // optional: target a specific pod
 *   wait?: boolean,          // optional: poll until done (default false)
 * }
 *
 * Returns: {
 *   job_id: string,
 *   prompt_id: string,
 *   status: "queued" | "completed",
 *   template: { name, slug, category },
 *   outputs?: [{ url, filename, width, height }],  // only if wait=true
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const sb = getServiceClient();
  const body = await req.json().catch(() => ({}));
  const { slug } = params;

  // ── 1. Look up template ──
  const { data: template, error: tplErr } = await sb
    .from("workflow_templates")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (tplErr || !template) {
    return NextResponse.json(
      { error: `Template "${slug}" not found or inactive` },
      { status: 404 }
    );
  }

  // ── 2. Find a ready pod ──
  let pod;
  if (body.pod_id) {
    const { data } = await sb
      .from("pod_instances")
      .select("*")
      .eq("id", body.pod_id)
      .eq("status", "ready")
      .single();
    pod = data;
  } else {
    const { data } = await sb
      .from("pod_instances")
      .select("*")
      .eq("status", "ready")
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(1);
    pod = data?.[0];
  }

  if (!pod?.comfyui_url) {
    return NextResponse.json(
      { error: "No ready pod available. Launch a pod first." },
      { status: 503 }
    );
  }

  // ── 3. Patch workflow with params ──
  const paramSchema = (template.param_schema || {}) as Record<
    string,
    { node: string; field: string; type: string; min?: number; max?: number }
  >;

  // Extract only params that exist in the schema (ignore pod_id, wait, etc.)
  const overrides: Record<string, unknown> = {};
  for (const [key, schemaDef] of Object.entries(paramSchema)) {
    if (body[key] !== undefined) {
      let value = body[key];

      // Type coercion
      if (schemaDef.type === "integer") value = Math.round(Number(value));
      if (schemaDef.type === "number") value = Number(value);

      // Clamp to min/max
      if (typeof value === "number") {
        if (schemaDef.min !== undefined) value = Math.max(schemaDef.min, value);
        if (schemaDef.max !== undefined) value = Math.min(schemaDef.max, value);
      }

      overrides[key] = value;
    }
  }

  // Randomize seed if not provided
  if (paramSchema.seed && overrides.seed === undefined) {
    overrides.seed = Math.floor(Math.random() * 2147483647);
  }

  const patchedWorkflow = patchWorkflow(
    template.workflow_json as Record<string, unknown>,
    paramSchema,
    overrides
  );

  // ── 4. Create job record ──
  const idempotencyKey = `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: job, error: jobErr } = await sb
    .from("jobs")
    .insert({
      status: "queued",
      input_text: body.prompt || `[template:${slug}]`,
      plan: {
        template_slug: slug,
        template_name: template.name,
        params: overrides,
        source: "api",
      },
      plan_version: 1,
      template_id: template.id,
      params: overrides,
      pod_instance_id: pod.id,
      idempotency_key: idempotencyKey,
    })
    .select()
    .single();

  if (jobErr || !job) {
    return NextResponse.json(
      { error: jobErr?.message || "Failed to create job" },
      { status: 500 }
    );
  }

  // ── 5. Log event ──
  await sb.from("job_events").insert({
    job_id: job.id,
    event_type: "comfyui.queued",
    step: "comfyui.queued",
    event_data: { slug, pod_id: pod.id, overrides },
  });

  // ── 6. Queue prompt on ComfyUI ──
  const comfy = new ComfyClient(pod.comfyui_url);

  let promptId: string;
  try {
    const healthy = await comfy.health();
    if (!healthy) throw new Error("Pod not responding");

    const result = await comfy.queuePrompt(patchedWorkflow);
    promptId = result.prompt_id;

    if (result.node_errors && Object.keys(result.node_errors).length > 0) {
      throw new Error(
        `Node errors: ${JSON.stringify(result.node_errors).slice(0, 300)}`
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Queue failed";

    await sb
      .from("jobs")
      .update({
        status: "failed_queue",
        last_error: message,
        error: message,
      })
      .eq("id", job.id);

    await sb.from("job_events").insert({
      job_id: job.id,
      event_type: "queue.failed",
      step: "queue.failed",
      event_data: { error: message },
    });

    return NextResponse.json({ error: message, job_id: job.id }, { status: 502 });
  }

  // ── 7. Update job with prompt_id ──
  await sb
    .from("jobs")
    .update({
      status: "running",
      prompt_id: promptId,
      started_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await sb.from("job_events").insert({
    job_id: job.id,
    event_type: "comfyui.progress",
    step: "comfyui.progress",
    event_data: { prompt_id: promptId },
  });

  // Update pod last_used_at
  await sb
    .from("pod_instances")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", pod.id);

  // ── 8. If wait=true, poll for completion ──
  if (body.wait) {
    try {
      const entry = await comfy.waitForCompletion(promptId, 280_000);

      // Extract output images
      const outputs: Array<{ url: string; filename: string }> = [];
      for (const [, nodeOutput] of Object.entries(entry.outputs || {})) {
        for (const img of nodeOutput.images || []) {
          outputs.push({
            url: comfy.imageUrl(img.filename, img.subfolder, img.type),
            filename: img.filename,
          });
        }
      }

      // Save outputs to DB
      const endTime = new Date().toISOString();
      const gpuSeconds = job.started_at
        ? Math.round(
            (Date.now() - new Date(job.started_at).getTime()) / 1000
          )
        : null;

      for (const output of outputs) {
        await sb.from("outputs").insert({
          job_id: job.id,
          file_type: "image",
          public_url: output.url,
          filename: output.filename,
        });
      }

      await sb
        .from("jobs")
        .update({
          status: "completed",
          completed_at: endTime,
          gpu_seconds: gpuSeconds,
        })
        .eq("id", job.id);

      await sb.from("job_events").insert({
        job_id: job.id,
        event_type: "job.completed",
        step: "job.completed",
        event_data: { output_count: outputs.length },
        duration_ms: gpuSeconds ? gpuSeconds * 1000 : null,
      });

      return NextResponse.json({
        job_id: job.id,
        prompt_id: promptId,
        status: "completed",
        template: {
          name: template.name,
          slug: template.slug,
          category: template.category,
        },
        params: overrides,
        outputs,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Execution failed";

      await sb
        .from("jobs")
        .update({ status: "failed_runtime", last_error: message })
        .eq("id", job.id);

      await sb.from("job_events").insert({
        job_id: job.id,
        event_type: "runtime.failed",
        step: "runtime.failed",
        event_data: { error: message },
      });

      return NextResponse.json(
        { error: message, job_id: job.id, prompt_id: promptId },
        { status: 500 }
      );
    }
  }

  // ── 9. Return immediately (async mode) ──
  return NextResponse.json({
    job_id: job.id,
    prompt_id: promptId,
    status: "queued",
    template: {
      name: template.name,
      slug: template.slug,
      category: template.category,
    },
    params: overrides,
    status_url: `/api/jobs/${job.id}`,
  });
}
