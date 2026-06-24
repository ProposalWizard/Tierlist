import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !(await isAdmin(user.id))) return false;
  return true;
}

export async function GET() {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("card_library")
    .select("id, name, image_url, tags, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const body = await req.json();
  if (!body.name?.trim() || !body.image_url) {
    return new NextResponse("Missing name or image_url", { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("card_library")
    .insert({ name: body.name.trim(), image_url: body.image_url, tags: body.tags ?? [] })
    .select("id, name, image_url, tags, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const body = await req.json();
  if (!body.id) return new NextResponse("Missing id", { status: 400 });
  const supabase = createServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.tags !== undefined) updates.tags = body.tags;
  const { error } = await supabase.from("card_library").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });

  const supabase = createServiceClient();

  // Fetch image_url before deleting so we can remove from storage
  const { data: card } = await supabase
    .from("card_library")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("card_library").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort storage cleanup
  if (card?.image_url) {
    const pathMatch = card.image_url.split("/object/public/tierlist-images/")[1];
    if (pathMatch) {
      await supabase.storage.from("tierlist-images").remove([pathMatch]);
    }
  }

  return NextResponse.json({ ok: true });
}
