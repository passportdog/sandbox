import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { JobEngine, EVENT_STEPS } from "@/lib/engine";

export const dynamic = "force-dynamic";

// GET /api/jobs
export async function GET() {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("jobs")
    .select("*, workflow_templates(name, slug, category), pod_instances(status, gpu_type, comfyui_url)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/jobs — idempotent job creation
export async function POST(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json();
  const { input_text, idempotency_key } = body;

  if (!input_text?.trim()) {
    return NextResponse.json({ error: "input_text required" }, { status: 400 });
  }

  // Idempotency: if key provided and exists, return existing job
  if (idempotency_key) {
    const { data: existing } = await sb
      .from("jobs")
      .select("*")
      .eq("idempotency_key", idempotency_key)
      .single();

    if (existing) {
      return NextResponse.json(existing, { status: 200 });
    }
  }

  // Create with status "created" (not "pending" — Phase 2 contract)
  const { data: job, error } = await sb
    .from("jobs")
    .insert({
      input_text,
      status: "created",
      attempt: 1,
      plan_version: 0,
      idempotency_key: idempotency_key || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const engine = new JobEngine(sb);
  await engine.log(job.id, "job.created", { input_text });

  return NextResponse.json(job, { status: 201 });
}
