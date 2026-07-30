import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a blind ranking" }, { status: 401 });

  let body: {
    title?: string;
    description?: string;
    category?: string;
    num_slots?: number;
    cover_image_url?: string | null;
    images?: { image_url: string; name: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Input caps mirroring POST /api/tierlists. Without these, any signed-in user
  // can publish an unbounded payload straight to the public /blind-rankings
  // listing (is_active defaults to true, there is no moderation step) — e.g.
  // 100k rows of megabyte-long data: URLs, against a 500 MB DB quota.
  if (body.title.trim().length > 120) {
    return NextResponse.json({ error: "Title too long (max 120 chars)" }, { status: 400 });
  }
  if (body.description && body.description.length > 1000) {
    return NextResponse.json({ error: "Description too long (max 1000 chars)" }, { status: 400 });
  }
  if (body.category && body.category.length > 60) {
    return NextResponse.json({ error: "Category too long (max 60 chars)" }, { status: 400 });
  }

  const numSlots = Number(body.num_slots ?? 10);
  if (!Number.isInteger(numSlots) || numSlots < 1 || numSlots > 50) {
    return NextResponse.json({ error: "num_slots must be an integer between 1 and 50" }, { status: 400 });
  }

  const isValidImageUrl = (u: unknown): u is string =>
    typeof u === "string" && /^https?:\/\//.test(u) && u.length <= 2048;

  if (body.cover_image_url != null && !isValidImageUrl(body.cover_image_url)) {
    return NextResponse.json({ error: "cover_image_url must be a valid http(s) URL" }, { status: 400 });
  }

  if (body.images != null) {
    if (!Array.isArray(body.images)) {
      return NextResponse.json({ error: "images must be an array" }, { status: 400 });
    }
    if (body.images.length > 200) {
      return NextResponse.json({ error: "Too many images (max 200)" }, { status: 400 });
    }
    const bad = body.images.find(
      (img) => !isValidImageUrl(img?.image_url) || (img?.name != null && String(img.name).length > 120)
    );
    if (bad) {
      return NextResponse.json({ error: "Each image needs a valid http(s) image_url and a name under 120 chars" }, { status: 400 });
    }
  }

  const service = createServiceClient();

  const { data: ranking, error } = await service
    .from("blind_rankings")
    .insert({
      title: body.title.trim(),
      description: body.description?.trim() || null,
      category: body.category?.trim() || "General",
      num_slots: numSlots,
      cover_image_url: body.cover_image_url ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !ranking) {
    return NextResponse.json({ error: error?.message ?? "Failed to create" }, { status: 500 });
  }

  if (body.images && body.images.length > 0) {
    const rows = body.images.map((img, i) => ({
      blind_ranking_id: ranking.id,
      name: img.name || "",
      image_url: img.image_url,
      sort_order: i,
    }));
    await service.from("blind_ranking_images").insert(rows);
  }

  return NextResponse.json({ id: ranking.id }, { status: 201 });
}
