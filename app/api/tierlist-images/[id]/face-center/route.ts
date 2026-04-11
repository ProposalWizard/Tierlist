/**
 * POST /api/tierlist-images/[id]/face-center
 *
 * Lazy backfill endpoint: stores a client-detected face position on a
 * tierlist_images row that doesn't yet have one. This is called once by the
 * first visitor to any pre-existing image; every subsequent visitor then
 * receives the position via SSR with no flash.
 *
 * The endpoint is public (no auth required) because:
 *   1. Tierlist images are publicly readable via RLS already.
 *   2. face_center is a purely cosmetic thumbnail-centering hint, not
 *      sensitive data.
 *   3. The value is only written when it's currently NULL — it cannot be
 *      overwritten once set, preventing vandalism.
 *
 * Uses the service-role client to bypass RLS for the write.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

interface Params { params: Promise<{ id: string }> }

function isValidFaceCenter(v: unknown): v is { x: number; y: number } {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.x === "number" &&
    typeof obj.y === "number" &&
    obj.x >= 0 && obj.x <= 100 &&
    obj.y >= 0 && obj.y <= 100
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  let body: { face_center?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidFaceCenter(body.face_center)) {
    return NextResponse.json(
      { error: "face_center must be { x: number, y: number } with x,y in [0,100]" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Only write if currently NULL — this prevents overwriting an existing
  // value (including one that an admin may have manually curated).
  const { data: existing, error: fetchError } = await service
    .from("tierlist_images")
    .select("id, face_center")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("[face-center backfill] fetch error:", fetchError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (existing.face_center) {
    // Already set — no-op success.
    return NextResponse.json({ ok: true, updated: false });
  }

  const { error: updateError } = await service
    .from("tierlist_images")
    .update({ face_center: body.face_center })
    .eq("id", id)
    .is("face_center", null); // extra guard against race

  if (updateError) {
    console.error("[face-center backfill] update error:", updateError);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: true });
}
