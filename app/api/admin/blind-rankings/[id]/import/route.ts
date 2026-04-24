/**
 * POST /api/admin/blind-rankings/[id]/import
 * Imports images from an existing regular tierlist into a blind ranking.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { source_tierlist_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.source_tierlist_id) {
    return NextResponse.json({ error: "source_tierlist_id is required" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: sourceImages, error: fetchError } = await service
    .from("tierlist_images")
    .select("id, name, image_url, sort_order, face_center")
    .eq("tierlist_id", body.source_tierlist_id)
    .order("sort_order");

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!sourceImages?.length) return NextResponse.json({ imported: 0, images: [] });

  const { count: currentCount } = await service
    .from("blind_ranking_images")
    .select("*", { count: "exact", head: true })
    .eq("blind_ranking_id", id);

  const offset = currentCount ?? 0;

  const newImages = sourceImages.map((img, i) => ({
    blind_ranking_id: id,
    name: "",
    image_url: img.image_url,
    sort_order: offset + i,
    face_center: img.face_center ?? null,
  }));

  const { data: inserted, error: insertError } = await service
    .from("blind_ranking_images")
    .insert(newImages)
    .select("*");

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ imported: inserted?.length ?? 0, images: inserted ?? [] });
}
