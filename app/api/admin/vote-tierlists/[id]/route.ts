export const runtime = "edge";
/**
 * Admin API – single vote tierlist operations
 *
 * PATCH  /api/admin/vote-tierlists/[id]  — update title / cover / is_active
 * DELETE /api/admin/vote-tierlists/[id]  — delete vote tierlist + images
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type Params = Promise<{ id: string }>;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (!(await isAdmin(user.id))) return null;
  return user;
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { title?: string; category?: string; cover_image_url?: string | null; is_active?: boolean; tiers?: { label: string; color: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.category !== undefined) update.category = body.category.trim() || "General";
  if (body.cover_image_url !== undefined) update.cover_image_url = body.cover_image_url;
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.tiers !== undefined && Array.isArray(body.tiers) && body.tiers.length > 0) {
    update.tiers = body.tiers;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("vote_tierlists").update(update).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  // Gather image URLs for storage cleanup
  const [{ data: vlData }, { data: imgData }] = await Promise.all([
    service.from("vote_tierlists").select("cover_image_url").eq("id", id).single(),
    service.from("vote_tierlist_images").select("image_url").eq("vote_tierlist_id", id),
  ]);

  const allUrls = [
    ...(imgData ?? []).map((r: { image_url: string }) => r.image_url),
    ...(vlData?.cover_image_url ? [vlData.cover_image_url] : []),
  ];

  const BUCKET_MARKER = "/object/public/tierlist-images/";
  const storagePaths = Array.from(new Set(allUrls))
    .map((url) => {
      const idx = url.indexOf(BUCKET_MARKER);
      return idx !== -1 ? decodeURIComponent(url.slice(idx + BUCKET_MARKER.length)) : null;
    })
    .filter(Boolean) as string[];

  if (storagePaths.length > 0) {
    await service.storage.from("tierlist-images").remove(storagePaths);
  }

  const { error } = await service.from("vote_tierlists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
