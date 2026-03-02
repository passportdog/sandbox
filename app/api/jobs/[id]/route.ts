import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getServiceClient();

  const [jobRes, eventsRes, outputsRes] = await Promise.all([
    sb.from("jobs")
      .select("*, workflow_templates(name, slug, category), pod_instances(status, gpu_type, comfyui_url)")
      .eq("id", params.id)
      .single(),
    sb.from("job_events")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: true }),
    sb.from("outputs")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  if (jobRes.error) return NextResponse.json({ error: jobRes.error.message }, { status: 404 });

  return NextResponse.json({
    ...jobRes.data,
    events: eventsRes.data || [],
    outputs: outputsRes.data || [],
  });
}
