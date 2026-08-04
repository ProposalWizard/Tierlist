/**
 * DELETE /api/admin/vote-tierlists/[id]/images/[imageId]
 * Removes a single image from a vote tierlist.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { deleteUnreferencedImages } from "@/lib/storageCleanup";

type Params = Promise<{ id: string; imageId: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id, imageId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  // Scope to the vote tierlist in the URL, not the image id alone — otherwise
  // this route will happily delete an image belonging to a different list.
  const { data: img } = await service
    .from("vote_tierlist_images")
    .select("image_url")
    .eq("id", imageId)
    .eq("vote_tierlist_id", id)
    .maybeSingle();

  const { error } = await service
    .from("vote_tierlist_images")
    .delete()
    .eq("id", imageId)
    .eq("vote_tierlist_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only remove the file if nothing else references it. Vote tierlists are
  // routinely built by importing from a regular tierlist, which copies the URL
  // rather than the file — so an unconditional delete broke the source list's
  // image too.
  await deleteUnreferencedImages(service, [img?.image_url]);

  return NextResponse.json({ ok: true });
}

/** PATCH — update image fields (image_url, name, sort_order) */
export async function PATCH(request: Request, { params }: { params: Params }) {
  const { imageId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { image_url?: string; name?: string; sort_order?: number; face_center?: { x: number; y: number } | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.image_url !== undefined) update.image_url = body.image_url;
  if (body.name !== undefined) update.name = body.name;
  if (body.sort_order !== undefined) update.sort_order = body.sort_order;
  if (body.face_center !== undefined) update.face_center = body.face_center;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("vote_tierlist_images")
    .update(update)
    .eq("id", imageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
