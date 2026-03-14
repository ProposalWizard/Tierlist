/**
 * Admin API – vote tierlists list & create
 *
 * GET  /api/admin/vote-tierlists  — all vote tierlists (including inactive)
 * POST /api/admin/vote-tierlists  — create a new vote tierlist
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (!(await isAdmin(user.id))) return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("vote_tierlists")
    .select("id, title, cover_image_url, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { title?: string; cover_image_url?: string | null; tiers?: { label: string; color: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const insertData: Record<string, unknown> = {
    title: body.title.trim(),
    cover_image_url: body.cover_image_url ?? null,
    created_by: user.id,
  };
  // Allow custom tiers on creation (otherwise DB default S/A/B/C/D is used)
  if (body.tiers && Array.isArray(body.tiers) && body.tiers.length > 0) {
    insertData.tiers = body.tiers;
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("vote_tierlists")
    .insert(insertData)
    .select("id, title, cover_image_url, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
