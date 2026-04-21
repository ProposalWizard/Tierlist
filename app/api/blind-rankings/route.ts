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

  const service = createServiceClient();

  const { data: ranking, error } = await service
    .from("blind_rankings")
    .insert({
      title: body.title.trim(),
      description: body.description?.trim() || null,
      category: body.category?.trim() || "General",
      num_slots: body.num_slots ?? 10,
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
