import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getPod, getComfyUrl } from "@/lib/runpod";

export const dynamic = "force-dynamic";

// GET /api/pods/poll — sync RunPod status for all non-terminal pods
export async function GET() {
  const sb = getServiceClient();

  // Get non-terminal pods
  const { data: pods, error } = await sb
    .from("pod_instances")
    .select("*")
    .not("status", "in", '("terminated","stopped")');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pods || pods.length === 0) return NextResponse.json([]);

  const results = [];

  for (const dbPod of pods) {
    try {
      const rpPod = await getPod(dbPod.runpod_pod_id);
      const comfyUrl = getComfyUrl(rpPod);

      let status = dbPod.status;

      if (rpPod.desiredStatus === "RUNNING" && rpPod.runtime) {
        // Pod is running — check if ComfyUI is healthy
        if (dbPod.status === "creating" || dbPod.status === "bootstrapping") {
          // Try health check to see if ComfyUI is ready
          const healthUrl = comfyUrl ? `${comfyUrl}/system_stats` : null;
          let healthy = false;

          if (healthUrl) {
            try {
              const hRes = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
              healthy = hRes.ok;
            } catch {
              // Not healthy yet
            }
          }

          status = healthy ? "ready" : "bootstrapping";
        } else {
          status = dbPod.status === "ready" ? "ready" : "running";
        }
      } else if (rpPod.desiredStatus === "EXITED") {
        status = "stopped";
      }

      // Update DB
      await sb.from("pod_instances").update({
        status,
        ip_address: rpPod.runtime?.ports?.[0]?.ip || null,
        comfyui_url: comfyUrl || dbPod.comfyui_url,
        cost_per_hour: rpPod.costPerHr,
        updated_at: new Date().toISOString(),
      }).eq("id", dbPod.id);

      results.push({ id: dbPod.id, status, comfyui_url: comfyUrl });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Poll failed";
      results.push({ id: dbPod.id, status: dbPod.status, error: message });
    }
  }

  return NextResponse.json(results);
}
