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
  if (body.face_detection_enabled !== undefined) updates.face_detection_enabled = body.face_detection_enabled;

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

  const imageUrls = (images ?? []).map((img) => img.image_url);

  // Only delete storage files that aren't referenced by any other table
  if (imageUrls.length > 0) {
    const [{ data: usedInTierlists }, { data: usedInVote }, { data: usedInOtherBlind }] = await Promise.all([
      service.from("tierlist_images").select("image_url").in("image_url", imageUrls),
      service.from("vote_tierlist_images").select("image_url").in("image_url", imageUrls),
      service.from("blind_ranking_images").select("image_url").in("image_url", imageUrls).neq("blind_ranking_id", id),
    ]);

    const referencedUrls = new Set([
      ...(usedInTierlists ?? []).map((r) => r.image_url),
      ...(usedInVote ?? []).map((r) => r.image_url),
      ...(usedInOtherBlind ?? []).map((r) => r.image_url),
    ]);

    const BUCKET_MARKER = "/object/public/tierlist-images/";
    const safeToDelete = imageUrls
      .filter((url) => !referencedUrls.has(url))
      .map((url) => {
        const idx = url.indexOf(BUCKET_MARKER);
        return idx >= 0 ? decodeURIComponent(url.slice(idx + BUCKET_MARKER.length)) : null;
      })
      .filter(Boolean) as string[];

    if (safeToDelete.length > 0) {
      await service.storage.from("tierlist-images").remove(safeToDelete);
    }
  }

  const { error } = await service.from("blind_rankings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
