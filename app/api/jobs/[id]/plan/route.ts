import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { planJob } from "@/lib/openrouter";
import { JobEngine, EVENT_STEPS, TIMEOUTS, withTimeout } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Vercel function timeout

// POST /api/jobs/[id]/plan — idempotent planning
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getServiceClient();
  const engine = new JobEngine(sb);
  const jobId = params.id;

  // Fetch job — allow re-planning from "created" or "planned" (bumps version)
  const { data: job } = await sb
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Idempotent: if already running/completed, refuse
  if (["queued", "running", "uploading", "completed"].includes(job.status)) {
    return NextResponse.json({ error: `Cannot plan: job is ${job.status}` }, { status: 409 });
  }

  // If failed_planning, reset to created first via retry path
  if (job.status === "failed_planning") {
    await sb.from("jobs").update({ status: "created", last_error: null, retryable: false }).eq("id", jobId);
  }

  // Transition: created → (planning) → planned
  const t0 = Date.now();
  await engine.log(jobId, EVENT_STEPS.PLAN_STARTED, { attempt: job.attempt, plan_version: job.plan_version + 1 });

  // Optimistic status update for UI
  await sb.from("jobs").update({
    status: "created", // stays created during planning (no intermediate "planning" status in contract)
    started_at: job.started_at || new Date().toISOString(),
  }).eq("id", jobId);

  try {
    // Get templates + models
    const [{ data: templates }, { data: models }] = await Promise.all([
      sb.from("workflow_templates").select("slug, name, description, category").eq("is_active", true),
      sb.from("models_registry").select("name, filename, target_folder").eq("is_cached", true),
    ]);

    // Run planning agent with timeout
    const plan = await withTimeout(
      planJob(job.input_text, templates || [], models || []),
      TIMEOUTS.PLANNING,
      "Planning (OpenRouter)"
    );

    const durationMs = Date.now() - t0;

    // Find template ID
    const template = templates?.find((t) => t.slug === plan.template_slug);
    const templateId = template
      ? (await sb.from("workflow_templates").select("id").eq("slug", plan.template_slug).single()).data?.id
      : null;

    // Transition to planned — optimistic lock on status
    const newVersion = job.plan_version + 1;
    const { error: updateErr } = await sb.from("jobs").update({
      status: "planned",
      plan,
      plan_version: newVersion,
      template_id: templateId,
      params: plan.params,
      last_error: null,
      retryable: false,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    if (updateErr) throw new Error(`Plan update failed: ${updateErr.message}`);

    await engine.log(jobId, EVENT_STEPS.PLAN_COMPLETED, {
      template_slug: plan.template_slug,
      reasoning: plan.reasoning,
      plan_version: newVersion,
    }, durationMs);

    return NextResponse.json({ plan, template_id: templateId, plan_version: newVersion });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Planning failed";
    const durationMs = Date.now() - t0;

    await engine.fail(jobId, "planning", message, true);
    await engine.log(jobId, EVENT_STEPS.PLAN_FAILED, { error: message }, durationMs);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
