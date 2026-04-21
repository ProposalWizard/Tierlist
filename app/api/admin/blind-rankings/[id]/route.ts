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

interface Props { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Props) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = (body.title as string).trim();
  if (body.description !== undefined) updates.description = body.description;
  if (body.category !== undefined) updates.category = body.category;
  if (body.num_slots !== undefined) updates.num_slots = body.num_slots;
  if (body.cover_image_url !== undefined) updates.cover_image_url = body.cover_image_url;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("blind_rankings")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: Props) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = createServiceClient();

  const { data: images } = await service
    .from("blind_ranking_images")
    .select("image_url")
    .eq("blind_ranking_id", id);

  const BUCKET_MARKER = "/object/public/tierlist-images/";
  const filePaths = (images ?? [])
    .map((img) => {
      const idx = img.image_url.indexOf(BUCKET_MARKER);
      return idx >= 0 ? decodeURIComponent(img.image_url.slice(idx + BUCKET_MARKER.length)) : null;
    })
    .filter(Boolean) as string[];

  if (filePaths.length > 0) {
    await service.storage.from("tierlist-images").remove(filePaths);
  }

  const { error } = await service.from("blind_rankings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
