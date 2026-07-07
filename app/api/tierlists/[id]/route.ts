import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

interface Props { params: Promise<{ id: string }> }

// DELETE /api/tierlists/[id] — delete own tierlist (or admin)
export async function DELETE(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = createServiceClient();

  // Verify ownership or admin
  const { data: tl } = await service
    .from("tierlists")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!tl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owner = tl.created_by === user.id;
  const admin = await isAdmin(user.id);
  if (!owner && !admin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch image paths for storage cleanup
  const { data: images } = await service
    .from("tierlist_images")
    .select("image_url")
    .eq("tierlist_id", id);

  const toPath = (imageUrl: string): string | null => {
    try {
      const url = new URL(imageUrl);
      const parts = url.pathname.split("/tierlist-images/");
      return parts[1] ? decodeURIComponent(parts[1]) : null;
    } catch { return null; }
  };

  // Delete storage files — but only ones no OTHER tierlist references.
  // "Save as New Tierlist" reuses image URLs, so multiple rows can point at the same file.
  if (images?.length) {
    const urls = images.map((img) => img.image_url).filter(Boolean) as string[];

    // Which of these URLs are still used by a different tierlist?
    const { data: shared } = await service
      .from("tierlist_images")
      .select("image_url")
      .neq("tierlist_id", id)
      .in("image_url", urls);
    const stillUsed = new Set((shared ?? []).map((r) => r.image_url));

    // Also keep any file used as another tierlist's cover image
    const { data: coverRefs } = await service
      .from("tierlists")
      .select("cover_image_url")
      .neq("id", id)
      .in("cover_image_url", urls);
    (coverRefs ?? []).forEach((r) => { if (r.cover_image_url) stillUsed.add(r.cover_image_url); });

    const paths = urls
      .filter((u) => !stillUsed.has(u))
      .map(toPath)
      .filter(Boolean) as string[];

    if (paths.length) {
      await service.storage.from("tierlist-images").remove(paths);
    }
  }

  // Delete tierlist (cascade removes tierlist_images, likes, saves)
  await service.from("tierlists").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
