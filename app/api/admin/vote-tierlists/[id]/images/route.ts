/**
 * POST /api/admin/vote-tierlists/[id]/images
 * Adds a new image to a vote tierlist.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("vote_tierlist_images")
    .select("id, name, image_url, sort_order, face_center")
    .eq("vote_tierlist_id", id)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string; image_url?: string; sort_order?: number; face_center?: { x: number; y: number } | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.image_url?.trim()) {
    return NextResponse.json({ error: "image_url is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Get next sort_order
  const { count } = await service
    .from("vote_tierlist_images")
    .select("*", { count: "exact", head: true })
    .eq("vote_tierlist_id", id);

  const { data, error } = await service
    .from("vote_tierlist_images")
    .insert({
      vote_tierlist_id: id,
      name: body.name?.trim() ?? "",
      image_url: body.image_url.trim(),
      sort_order: body.sort_order ?? (count ?? 0),
      face_center: body.face_center ?? null,
    })
    .select("id, name, image_url, sort_order, face_center")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
