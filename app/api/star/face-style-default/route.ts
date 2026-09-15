import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * THE ADMIN'S OWN GLOBAL DEFAULT FACE STYLE.
 *
 * See the migration (supabase/migrations/star_face_style_default.sql) for
 * why this exists: FaceStyle (lib/star/faceStyle.ts) has always been a
 * per-device localStorage preference, and this is the one deliberate
 * exception — an admin-set look every device with no override of its own
 * picks up automatically. Requested directly: "an admin button to set the
 * custom player face values as official and global default values."
 *
 * GET is public — every device needs to check this before falling back to
 * the hardcoded DEFAULT_FACE_STYLE. POST is admin-only: one shared default
 * means one place it can be changed, not whoever last had the editor open.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("star_face_style_default")
    .select("style")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    // Covers the migration not having been run yet as much as any other
    // read failure — the client's own fetchGlobalDefaultFaceStyle() already
    // treats a non-ok response as "no global default, use the hardcoded
    // fallback," exactly the same degrade-gracefully shape every other
    // pending-migration feature in this codebase already uses.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ style: data?.style ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { style?: unknown } | null;
  if (!body || typeof body.style !== "object" || body.style === null || Array.isArray(body.style)) {
    return NextResponse.json({ error: "style (an object) is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("star_face_style_default").upsert({
    id: "default",
    style: body.style,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
