import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { JobEngine, EVENT_STEPS } from "@/lib/engine";

export const dynamic = "force-dynamic";

// POST /api/jobs/[id]/cancel
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getServiceClient();
  const engine = new JobEngine(sb);

  const { data: job } = await sb.from("jobs").select("status").eq("id", params.id).single();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (["completed", "canceled"].includes(job.status)) {
    return NextResponse.json({ error: `Job is already ${job.status}` }, { status: 409 });
  }

  // Force-cancel: bypass normal transition rules for active jobs
  await sb.from("jobs").update({
    status: "canceled",
    updated_at: new Date().toISOString(),
  }).eq("id", params.id);

  await engine.log(params.id, EVENT_STEPS.JOB_CANCELED, { from_status: job.status });

  return NextResponse.json({ status: "canceled" });
}
