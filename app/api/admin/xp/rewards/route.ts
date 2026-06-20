import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!(await isAdmin(user.id))) return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("rewards")
    .select("*")
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rewards: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["name", "description", "category", "rarity", "icon_name", "unlock_type", "unlock_stat", "unlock_value", "sort_order"];
  const cleaned: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in updates) cleaned[k] = updates[k];
  }

  const svc = createServiceClient();
  const { error } = await svc.from("rewards").update(cleaned).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, name, description, category, rarity, icon_name, unlock_type, unlock_stat, unlock_value, sort_order } = body;

  if (!id || !name || !category || !unlock_type) {
    return NextResponse.json({ error: "Missing required fields (id, name, category, unlock_type)" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { error } = await svc.from("rewards").insert({
    id,
    name,
    description: description || null,
    category,
    rarity: rarity || "bronze",
    icon_name: icon_name || null,
    unlock_type,
    unlock_stat: unlock_stat || null,
    unlock_value: unlock_value ?? null,
    sort_order: sort_order ?? 0,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const svc = createServiceClient();
  const { error } = await svc.from("rewards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
