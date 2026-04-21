import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (!(await isAdmin(user.id))) return null;
  return user;
}

interface Props { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Props) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = createServiceClient();
  const { data, error } = await service
    .from("blind_ranking_images")
    .select("id, name, image_url, sort_order")
    .eq("blind_ranking_id", id)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request, { params }: Props) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: { name?: string; image_url?: string; sort_order?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.image_url?.trim()) {
    return NextResponse.json({ error: "name and image_url are required" }, { status: 400 });
  }

  const service = createServiceClient();

  let sortOrder = body.sort_order;
  if (sortOrder === undefined) {
    const { count } = await service
      .from("blind_ranking_images")
      .select("*", { count: "exact", head: true })
      .eq("blind_ranking_id", id);
    sortOrder = count ?? 0;
  }

  const { data, error } = await service
    .from("blind_ranking_images")
    .insert({
      blind_ranking_id: id,
      name: body.name.trim(),
      image_url: body.image_url.trim(),
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
