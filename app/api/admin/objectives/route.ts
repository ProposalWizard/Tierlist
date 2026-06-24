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
    .from("objectives")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const body = await req.json();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("objectives")
    .insert({
      title: body.title,
      description: body.description || null,
      xp_reward: body.xp_reward ?? 0,
      card_image_url: body.card_image_url || null,
      card_name: body.card_name || null,
      category: body.category ?? "foundation",
      is_active: body.is_active ?? true,
      is_published: body.is_published ?? false,
      sort_order: body.sort_order ?? 0,
      expires_at: body.expires_at ?? null,
      conditions: body.conditions ?? [],
    })
    .select()
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
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.xp_reward !== undefined) updates.xp_reward = body.xp_reward;
  if (body.card_image_url !== undefined) updates.card_image_url = body.card_image_url;
  if (body.card_name !== undefined) updates.card_name = body.card_name;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.is_published !== undefined) updates.is_published = body.is_published;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
  if ("expires_at" in body) updates.expires_at = body.expires_at ?? null;
  if (body.conditions !== undefined) updates.conditions = body.conditions;
  if (body.category !== undefined) updates.category = body.category;
  const { error } = await supabase
    .from("objectives")
    .update(updates)
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("objectives").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
