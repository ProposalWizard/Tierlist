/**
 * POST /api/admin/vote-tierlists/[id]/import
 * Imports images from an existing regular tierlist into a vote tierlist.
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

  // Fetch images from the source tierlist
  const { data: sourceImages, error: fetchError } = await service
    .from("tierlist_images")
    .select("id, name, image_url, sort_order")
    .eq("tierlist_id", body.source_tierlist_id)
    .order("sort_order");

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!sourceImages?.length) return NextResponse.json({ imported: 0, images: [] });

  // Get current image count for sort_order offset
  const { count: currentCount } = await service
    .from("vote_tierlist_images")
    .select("*", { count: "exact", head: true })
    .eq("vote_tierlist_id", id);

  const offset = currentCount ?? 0;

  const newImages = sourceImages.map((img, i) => ({
    vote_tierlist_id: id,
    name: "",
    image_url: img.image_url,
    sort_order: offset + i,
  }));

  const { data: inserted, error: insertError } = await service
    .from("vote_tierlist_images")
    .insert(newImages)
    .select("id, name, image_url, sort_order");

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ imported: inserted?.length ?? 0, images: inserted ?? [] });
}
