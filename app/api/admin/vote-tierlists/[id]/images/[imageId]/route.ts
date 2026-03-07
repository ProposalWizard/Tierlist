/**
 * DELETE /api/admin/vote-tierlists/[id]/images/[imageId]
 * Removes a single image from a vote tierlist.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type Params = Promise<{ id: string; imageId: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { imageId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  // Get the image URL for storage cleanup
  const { data: img } = await service
    .from("vote_tierlist_images")
    .select("image_url")
    .eq("id", imageId)
    .single();

  if (img?.image_url) {
    const BUCKET_MARKER = "/object/public/tierlist-images/";
    const idx = img.image_url.indexOf(BUCKET_MARKER);
    if (idx !== -1) {
      const path = decodeURIComponent(img.image_url.slice(idx + BUCKET_MARKER.length));
      await service.storage.from("tierlist-images").remove([path]);
    }
  }

  const { error } = await service
    .from("vote_tierlist_images")
    .delete()
    .eq("id", imageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
