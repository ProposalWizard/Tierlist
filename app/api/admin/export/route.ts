/**
 * Admin API – Export full backup of all tierlists + vote tierlists
 *
 * GET /api/admin/export
 *
 * Returns a JSON object containing:
 * - All tierlists with their images
 * - All vote tierlists with their images
 * - All categories
 * - Export metadata (date, counts)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET() {
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

  // Fetch everything in parallel — explicit high limits to avoid the default 1000-row PostgREST cap
  const [
    { data: tierlists, error: e1 },
    { data: tierlistImages, error: e2 },
    { data: voteTierlists, error: e3 },
    { data: voteImages, error: e4 },
    { data: categories, error: e5 },
  ] = await Promise.all([
    service.from("tierlists").select("*").order("created_at", { ascending: false }).limit(100000),
    service.from("tierlist_images").select("*").order("tierlist_id").order("sort_order").limit(1000000),
    service.from("vote_tierlists").select("*").order("created_at", { ascending: false }).limit(100000),
    service.from("vote_tierlist_images").select("*").order("vote_tierlist_id").order("sort_order").limit(1000000),
    service.from("categories").select("*").order("sort_order").limit(10000),
  ]);

  const exportError = e1 ?? e2 ?? e3 ?? e4 ?? e5;
  if (exportError) {
    return NextResponse.json({ error: "Export query failed", detail: exportError.message }, { status: 500 });
  }

  // Group images by their tierlist
  const tlImgs = tierlistImages ?? [];
  const imagesByTierlist: Record<string, typeof tlImgs> = {};
  for (const img of tlImgs) {
    if (!imagesByTierlist[img.tierlist_id]) imagesByTierlist[img.tierlist_id] = [];
    imagesByTierlist[img.tierlist_id].push(img);
  }

  const vtImgs = voteImages ?? [];
  const imagesByVoteTierlist: Record<string, typeof vtImgs> = {};
  for (const img of vtImgs) {
    if (!imagesByVoteTierlist[img.vote_tierlist_id]) imagesByVoteTierlist[img.vote_tierlist_id] = [];
    imagesByVoteTierlist[img.vote_tierlist_id].push(img);
  }

  // Build structured export
  const tierlistsExport = (tierlists ?? []).map((tl) => ({
    ...tl,
    images: imagesByTierlist[tl.id] ?? [],
  }));

  const voteTierlistsExport = (voteTierlists ?? []).map((vl) => ({
    ...vl,
    images: imagesByVoteTierlist[vl.id] ?? [],
  }));

  const backup = {
    exported_at: new Date().toISOString(),
    exported_by: user.id,
    counts: {
      tierlists: tierlistsExport.length,
      tierlist_images: (tierlistImages ?? []).length,
      vote_tierlists: voteTierlistsExport.length,
      vote_tierlist_images: (voteImages ?? []).length,
      categories: (categories ?? []).length,
    },
    categories: categories ?? [],
    tierlists: tierlistsExport,
    vote_tierlists: voteTierlistsExport,
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="tierlist-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
