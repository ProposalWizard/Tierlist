export const runtime = "edge";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

interface Props { params: Promise<{ id: string }> }

// PATCH /api/admin/categories/[id] — rename a category
export async function PATCH(req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, sort_order } = body as { name?: string; sort_order?: number };

  if (!name?.trim() && sort_order === undefined)
    return NextResponse.json({ error: "Name or sort_order required" }, { status: 400 });

  const service = createServiceClient();

  // Handle sort_order update (no rename needed)
  if (sort_order !== undefined && !name?.trim()) {
    const { error } = await service
      .from("categories")
      .update({ sort_order })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Get old name so we can update tierlists too
  const { data: old } = await service
    .from("categories")
    .select("name")
    .eq("id", id)
    .single();

  if (!old) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build update object
  const update: Record<string, unknown> = { name: name!.trim() };
  if (sort_order !== undefined) update.sort_order = sort_order;

  // Rename the category
  const { error } = await service
    .from("categories")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update all tierlists that used the old category name
  await service
    .from("tierlists")
    .update({ category: name!.trim() })
    .eq("category", old.name);

  return NextResponse.json({ ok: true });
}

// POST /api/admin/categories — create a new category
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Name required" }, { status: 400 });

  const service = createServiceClient();
  const { data: maxRow } = await service
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await service
    .from("categories")
    .insert({ name: name.trim(), sort_order: (maxRow?.sort_order ?? 0) + 1 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/admin/categories/[id]
export async function DELETE(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service.from("categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
