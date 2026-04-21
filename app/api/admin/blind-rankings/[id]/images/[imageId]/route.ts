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

interface Props { params: Promise<{ id: string; imageId: string }> }

export async function DELETE(_request: Request, { params }: Props) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { imageId } = await params;
  const service = createServiceClient();

  const { data: img } = await service
    .from("blind_ranking_images")
    .select("image_url")
    .eq("id", imageId)
    .single();

  if (img) {
    const BUCKET_MARKER = "/object/public/tierlist-images/";
    const idx = img.image_url.indexOf(BUCKET_MARKER);
    if (idx >= 0) {
      const filePath = decodeURIComponent(img.image_url.slice(idx + BUCKET_MARKER.length));
      await service.storage.from("tierlist-images").remove([filePath]);
    }
  }

  const { error } = await service.from("blind_ranking_images").delete().eq("id", imageId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, { params }: Props) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { imageId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.image_url !== undefined) updates.image_url = body.image_url;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("blind_ranking_images")
    .update(updates)
    .eq("id", imageId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
