export const runtime = "edge";
/**
 * Admin API – batch update image sort orders
 *
 * PATCH /api/admin/tierlists/[id]/images/reorder
 *
 * Body: { images: [{ id: string, sort_order: number }] }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { images: { id: string; sort_order: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.images) || body.images.length === 0) {
    return NextResponse.json({ error: "No images to reorder" }, { status: 400 });
  }

  const service = createServiceClient();

  // Batch update all sort orders in parallel
  const results = await Promise.all(
    body.images.map((img) =>
      service
        .from("tierlist_images")
        .update({ sort_order: img.sort_order })
        .eq("id", img.id)
        .eq("tierlist_id", id)
    )
  );

  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    console.error("[PATCH /api/admin/tierlists/images/reorder]", errors[0].error);
    return NextResponse.json({ error: "Some updates failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
