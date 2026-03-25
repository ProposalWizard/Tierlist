export const runtime = "edge";
/**
 * GET /api/vote-tierlists
 * Returns all active vote tierlists for the homepage.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vote_tierlists")
    .select("id, title, category, cover_image_url, created_at, tiers, description")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
