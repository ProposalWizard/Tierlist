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

  // Validate before touching Storage. `contentType: file.type` was passed
  // straight through, so an "image" declared as text/html was stored AND
  // SERVED as HTML from the public bucket. Size was unbounded too.
  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Image must be PNG, JPEG or WebP" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 400 });
  }

  // Upload to Supabase Storage. contentType comes from the allowlist above
  // rather than being passed through raw — an "image" declared as text/html
  // would otherwise be stored AND served as HTML from the public bucket.
  const EXT_FOR_TYPE: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  const filename = `${crypto.randomUUID()}.${EXT_FOR_TYPE[file.type]}`;
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
