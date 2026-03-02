import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("workflow_templates")
    .select("id, name, slug, description, category, required_models, required_node_packs, param_schema, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
