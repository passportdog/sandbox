import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { pollAllPods } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

// GET /api/pods/poll — poll all active pods, update DB status
// Can be called by Vercel Cron, or by the UI every 15s
export async function GET() {
  const sb = getServiceClient();

  try {
    const result = await pollAllPods(sb);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Poll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
