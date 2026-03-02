import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { planJob } from "@/lib/openrouter";

export const dynamic = "force-dynamic";

// POST /api/jobs/[id]/plan — run planning agent on a job
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getServiceClient();

  // Get job
  const { data: job, error: jobErr } = await sb
    .from("jobs").select("*").eq("id", params.id).single();
  if (jobErr || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "pending") return NextResponse.json({ error: `Job status is ${job.status}, expected pending` }, { status: 400 });

  // Update status to planning
  await sb.from("jobs").update({ status: "planning", started_at: new Date().toISOString() }).eq("id", job.id);
  await sb.from("job_events").insert({ job_id: job.id, event_type: "planning_started", event_data: {} });

  try {
    // Get available templates
    const { data: templates } = await sb
      .from("workflow_templates")
      .select("slug, name, description, category")
      .eq("is_active", true);

    // Get cached models
    const { data: models } = await sb
      .from("models_registry")
      .select("name, filename, target_folder")
      .eq("is_cached", true);

    // Run planning agent
    const plan = await planJob(
      job.input_text,
      templates || [],
      models || []
    );

    // Find template ID from slug
    const template = templates?.find((t) => t.slug === plan.template_slug);
    const templateId = template ? (await sb.from("workflow_templates").select("id").eq("slug", plan.template_slug).single()).data?.id : null;

    // Update job with plan
    await sb.from("jobs").update({
      status: "planned",
      plan,
      template_id: templateId,
      params: plan.params,
    }).eq("id", job.id);

    await sb.from("job_events").insert({
      job_id: job.id,
      event_type: "plan_created",
      event_data: plan,
    });

    return NextResponse.json({ plan, template_id: templateId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Planning failed";
    await sb.from("jobs").update({ status: "failed", error: message }).eq("id", job.id);
    await sb.from("job_events").insert({ job_id: job.id, event_type: "planning_failed", event_data: { error: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
