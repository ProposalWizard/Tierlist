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
