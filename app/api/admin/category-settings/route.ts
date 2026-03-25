/**
 * GET  /api/admin/category-settings  — fetch all category settings
 * POST /api/admin/category-settings  — upsert settings for a category
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !(await isAdmin(user.id))) return null;
  return user;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  const { data, error } = await service
    .from("category_homepage_settings")
    .select("category, sort_method, pinned_ids");
  if (error) {
    // Table may not exist yet — return empty gracefully
    return NextResponse.json([]);
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: { category: string; sort_method: string; pinned_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.category || !body.sort_method) {
    return NextResponse.json({ error: "category and sort_method required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("category_homepage_settings")
    .upsert({
      category: body.category,
      sort_method: body.sort_method,
      pinned_ids: body.pinned_ids ?? [],
      updated_at: new Date().toISOString(),
    })
    .select("category, sort_method, pinned_ids")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
