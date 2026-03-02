import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { JobEngine } from "@/lib/engine";

export const dynamic = "force-dynamic";

// POST /api/jobs/[id]/retry
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getServiceClient();
  const engine = new JobEngine(sb);

  const result = await engine.retry(params.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Fetch updated job
  const { data: job } = await sb.from("jobs").select("*").eq("id", params.id).single();

  return NextResponse.json(job);
}
