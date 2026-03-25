export const runtime = "edge";
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

  // Delete storage files
  if (images?.length) {
    const paths = images
      .map((img) => {
        try {
          const url = new URL(img.image_url);
          const parts = url.pathname.split("/tierlist-images/");
          return parts[1] ? decodeURIComponent(parts[1]) : null;
        } catch { return null; }
      })
      .filter(Boolean) as string[];

    if (paths.length) {
      await service.storage.from("tierlist-images").remove(paths);
    }
  }

  // Delete tierlist (cascade removes tierlist_images, likes, saves)
  await service.from("tierlists").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
