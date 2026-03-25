import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST — save a tierlist screenshot image to the user's profile */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  const tierlistTitle = formData.get("tierlist_title") as string | null;
  const tierlistId = formData.get("tierlist_id") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const filename = `${crypto.randomUUID()}.png`;
  const storagePath = `profile-saves/${user.id}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("tierlist-images")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("tierlist-images")
    .getPublicUrl(storagePath);

  // Insert record
  const { data, error } = await supabase.from("saved_profile_images").insert({
    user_id: user.id,
    image_url: urlData.publicUrl,
    tierlist_title: tierlistTitle || null,
    tierlist_id: tierlistId || null,
  }).select("id, image_url, tierlist_title, created_at").single();

  if (error) {
    return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
  }

  return NextResponse.json(data);
}
