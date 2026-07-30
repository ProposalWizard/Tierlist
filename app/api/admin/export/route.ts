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
import { fetchAllRows } from "@/lib/fetchAllRows";

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

  // Every query must PAGE, not just carry a high .limit(). PostgREST's row cap
  // is server-side (db-max-rows), so .limit(1000000) still returned 1000 rows —
  // this "full backup" was silently truncated, and tierlist_images crosses 1000
  // after only a handful of tierlists, so most lists in the download lost their
  // images. Restoring from such a file loses data with no error anywhere.
  type Keyed = Record<string, unknown> & { id: string };
  type TlImage = Record<string, unknown> & { tierlist_id: string };
  type VtImage = Record<string, unknown> & { vote_tierlist_id: string };

  const [tierlists, tierlistImages, voteTierlists, voteImages, categories] = await Promise.all([
    fetchAllRows<Keyed>((from, to) =>
      service.from("tierlists").select("*").order("created_at", { ascending: false }).range(from, to),
      200000),
    fetchAllRows<TlImage>((from, to) =>
      service.from("tierlist_images").select("*").order("tierlist_id").order("sort_order").range(from, to),
      1000000),
    fetchAllRows<Keyed>((from, to) =>
      service.from("vote_tierlists").select("*").order("created_at", { ascending: false }).range(from, to),
      200000),
    fetchAllRows<VtImage>((from, to) =>
      service.from("vote_tierlist_images").select("*").order("vote_tierlist_id").order("sort_order").range(from, to),
      1000000),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      service.from("categories").select("*").order("sort_order").range(from, to),
      20000),
  ]);

  // Cross-check the exported row counts against the server's own counts, so a
  // truncated or partially-failed backup fails loudly instead of downloading.
  const [tlCount, tlImgCount, vtCount, vtImgCount] = await Promise.all([
    service.from("tierlists").select("id", { count: "exact", head: true }),
    service.from("tierlist_images").select("id", { count: "exact", head: true }),
    service.from("vote_tierlists").select("id", { count: "exact", head: true }),
    service.from("vote_tierlist_images").select("id", { count: "exact", head: true }),
  ]);

  const mismatches: string[] = [];
  const check = (name: string, got: number, expected: number | null) => {
    if (expected != null && got !== expected) mismatches.push(`${name}: exported ${got} of ${expected}`);
  };
  check("tierlists", tierlists.length, tlCount.count);
  check("tierlist_images", tierlistImages.length, tlImgCount.count);
  check("vote_tierlists", voteTierlists.length, vtCount.count);
  check("vote_tierlist_images", voteImages.length, vtImgCount.count);

  if (mismatches.length > 0) {
    return NextResponse.json(
      { error: "Export incomplete — refusing to produce a partial backup", detail: mismatches.join("; ") },
      { status: 500 }
    );
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
