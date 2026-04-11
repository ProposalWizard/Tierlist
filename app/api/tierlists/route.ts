/**
 * POST /api/tierlists
 *
 * Creates a new user tierlist. Expects JSON body:
 *   { title: string, images: { name: string; image_url: string }[] }
 *
 * Images must already be uploaded to Supabase Storage before calling
 * this route — the client uploads directly and passes back the URLs.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    title: string;
    category: string;
    cover_image_url?: string;
    images: {
      name: string;
      image_url: string;
      face_center?: { x: number; y: number } | null;
    }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, category, images } = body;
  const cover_image_url = body.cover_image_url ?? images[0]?.image_url ?? null;

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json(
      { error: "images must be a non-empty array" },
      { status: 400 }
    );
  }

  const slug = `${slugify(title.trim())}-${Date.now().toString(36)}`;

  const { data: tierlist, error: tlError } = await supabase
    .from("tierlists")
    .insert({ created_by: user.id, title: title.trim(), category: category ?? "Other", slug, cover_image_url })
    .select("id, slug")
    .single();

  if (tlError || !tierlist) {
    console.error("[POST /api/tierlists] insert error:", tlError);
    return NextResponse.json({ error: "Failed to create tierlist" }, { status: 500 });
  }

  const imageRows = images.map((img, i) => ({
    tierlist_id: tierlist.id,
    name: img.name,
    image_url: img.image_url,
    sort_order: i,
    face_center: img.face_center ?? null,
  }));

  const { error: imgError } = await supabase.from("tierlist_images").insert(imageRows);

  if (imgError) {
    console.error("[POST /api/tierlists] images insert error:", imgError);
    return NextResponse.json({ error: "Failed to save images" }, { status: 500 });
  }

  return NextResponse.json({ id: tierlist.id, slug: tierlist.slug });
}
