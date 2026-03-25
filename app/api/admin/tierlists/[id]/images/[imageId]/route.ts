export const runtime = "edge";
/**
 * Admin API – remove a single image from a tierlist
 *
 * DELETE /api/admin/tierlists/[id]/images/[imageId]
 *
 * Deletes the image record from the DB and the file from storage.
 * Requires the caller to be an authenticated admin.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type Params = Promise<{ id: string; imageId: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id, imageId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  // Fetch the image URL before deleting so we can clean up storage
  const { data: imgData } = await service
    .from("tierlist_images")
    .select("image_url")
    .eq("id", imageId)
    .eq("tierlist_id", id)
    .maybeSingle();

  // Best-effort storage cleanup
  if (imgData?.image_url) {
    const BUCKET_MARKER = "/object/public/tierlist-images/";
    const idx = imgData.image_url.indexOf(BUCKET_MARKER);
    if (idx !== -1) {
      const storagePath = decodeURIComponent(
        imgData.image_url.slice(idx + BUCKET_MARKER.length)
      );
      await service.storage.from("tierlist-images").remove([storagePath]);
    }
  }

  const { error: delError } = await service
    .from("tierlist_images")
    .delete()
    .eq("id", imageId)
    .eq("tierlist_id", id);

  if (delError) {
    console.error("[DELETE /api/admin/tierlists/images]", delError);
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id, imageId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { sort_order?: number; name?: string; image_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.sort_order !== undefined) update.sort_order = body.sort_order;
  if (body.name !== undefined) update.name = body.name;
  if (body.image_url !== undefined) update.image_url = body.image_url;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("tierlist_images")
    .update(update)
    .eq("id", imageId)
    .eq("tierlist_id", id);

  if (error) {
    console.error("[PATCH /api/admin/tierlists/images]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
