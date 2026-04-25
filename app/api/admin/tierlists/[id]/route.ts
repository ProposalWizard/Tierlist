/**
 * Admin API – single tierlist operations
 *
 * PATCH /api/admin/tierlists/[id]  — update title / category / cover
 * DELETE /api/admin/tierlists/[id] — delete tierlist + clean up storage
 *
 * Both require the caller to be an authenticated admin.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type Params = Promise<{ id: string }>;

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;

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

  let body: {
    title?: string;
    category?: string;
    cover_image_url?: string | null;
    linked_vote_tierlist_id?: string | null;
    linked_blind_ranking_id?: string | null;
    additional_categories?: string[];
    tiers?: { label: string; color: string }[];
    face_detection_enabled?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.category !== undefined) update.category = body.category;
  if (body.cover_image_url !== undefined)
    update.cover_image_url = body.cover_image_url;
  if (body.linked_vote_tierlist_id !== undefined)
    update.linked_vote_tierlist_id = body.linked_vote_tierlist_id;
  if (body.linked_blind_ranking_id !== undefined)
    update.linked_blind_ranking_id = body.linked_blind_ranking_id;
  if (body.additional_categories !== undefined)
    update.additional_categories = body.additional_categories;
  if (body.tiers !== undefined && Array.isArray(body.tiers) && body.tiers.length > 0)
    update.tiers = body.tiers;
  if (body.face_detection_enabled !== undefined)
    update.face_detection_enabled = body.face_detection_enabled;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("tierlists").update(update).eq("id", id);

  if (error) {
    console.error("[PATCH /api/admin/tierlists]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id } = await params;

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

  // Gather all image URLs (tierlist images + separate cover) for storage cleanup
  const [{ data: tlData }, { data: imgData }] = await Promise.all([
    service.from("tierlists").select("cover_image_url").eq("id", id).single(),
    service.from("tierlist_images").select("image_url").eq("tierlist_id", id),
  ]);

  const allUrls = Array.from(new Set([
    ...(imgData ?? []).map((r: { image_url: string }) => r.image_url),
    ...(tlData?.cover_image_url ? [tlData.cover_image_url] : []),
  ]));

  // Only delete storage files that aren't referenced by any other table
  if (allUrls.length > 0) {
    const [{ data: usedInVote }, { data: usedInBlind }, { data: usedInOtherTl }] = await Promise.all([
      service.from("vote_tierlist_images").select("image_url").in("image_url", allUrls),
      service.from("blind_ranking_images").select("image_url").in("image_url", allUrls),
      service.from("tierlist_images").select("image_url").in("image_url", allUrls).neq("tierlist_id", id),
    ]);

    const referencedUrls = new Set([
      ...(usedInVote ?? []).map((r) => r.image_url),
      ...(usedInBlind ?? []).map((r) => r.image_url),
      ...(usedInOtherTl ?? []).map((r) => r.image_url),
    ]);

    const BUCKET_MARKER = "/object/public/tierlist-images/";
    const safeToDelete = allUrls
      .filter((url) => !referencedUrls.has(url))
      .map((url) => {
        const idx = url.indexOf(BUCKET_MARKER);
        return idx !== -1 ? decodeURIComponent(url.slice(idx + BUCKET_MARKER.length)) : null;
      })
      .filter(Boolean) as string[];

    if (safeToDelete.length > 0) {
      await service.storage.from("tierlist-images").remove(safeToDelete);
    }
  }

  // Delete the tierlist row — tierlist_images cascade-deletes automatically
  const { error: delError } = await service
    .from("tierlists")
    .delete()
    .eq("id", id);

  if (delError) {
    console.error("[DELETE /api/admin/tierlists]", delError);
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
