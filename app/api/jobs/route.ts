import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/jobs — list all jobs
// POST /api/jobs — create a new job from user input
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

export async function POST(req: NextRequest) {
  const sb = getServiceClient();
  const body = await req.json();
  const { input_text } = body;

  if (!input_text?.trim()) {
    return NextResponse.json({ error: "input_text required" }, { status: 400 });
  }

  // Create job in pending state
  const { data: job, error } = await sb
    .from("jobs")
    .insert({ input_text, status: "pending" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log event
  await sb.from("job_events").insert({
    job_id: job.id,
    event_type: "job_created",
    event_data: { input_text },
  });

  return NextResponse.json(job, { status: 201 });
}
