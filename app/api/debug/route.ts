import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug — check env vars and RunPod connectivity
 * Remove this route before going to production!
 */
export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars (show existence, not values)
  checks.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ set" : "❌ missing";
  checks.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ set" : "❌ missing";
  checks.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ set" : "❌ missing";
  checks.RUNPOD_API_KEY = process.env.RUNPOD_API_KEY ? `✅ set (${process.env.RUNPOD_API_KEY.slice(0, 6)}...)` : "❌ missing";
  checks.RUNPOD_TEMPLATE_ID = process.env.RUNPOD_TEMPLATE_ID || "y9pvbwuul3 (fallback)";
  checks.CIVITAI_API_KEY = process.env.CIVITAI_API_KEY ? "✅ set" : "❌ missing";

  // Test Supabase connection
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const sb = createClient(url, key);
    const { count, error } = await sb.from("pod_instances").select("*", { count: "exact", head: true });
    checks.supabase_connection = error ? `❌ ${error.message}` : `✅ connected (${count} pods)`;
  } catch (err) {
    checks.supabase_connection = `❌ ${err instanceof Error ? err.message : "unknown"}`;
  }

  // Test RunPod API
  try {
    const apiKey = process.env.RUNPOD_API_KEY;
    if (!apiKey) {
      checks.runpod_api = "❌ no API key";
    } else {
      const res = await fetch(`https://api.runpod.io/graphql?api_key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "query { myself { pods { id name desiredStatus } } }",
        }),
      });
      const data = await res.json();
      if (data.errors) {
        checks.runpod_api = `❌ ${JSON.stringify(data.errors).slice(0, 200)}`;
      } else {
        const pods = data.data?.myself?.pods || [];
        checks.runpod_api = `✅ connected (${pods.length} existing pods)`;
        checks.runpod_pods = JSON.stringify(pods.map((p: { id: string; name: string; desiredStatus: string }) => ({
          id: p.id,
          name: p.name,
          status: p.desiredStatus,
        })));
      }
    }
  } catch (err) {
    checks.runpod_api = `❌ ${err instanceof Error ? err.message : "unknown"}`;
  }

  return NextResponse.json(checks, { status: 200 });
}
