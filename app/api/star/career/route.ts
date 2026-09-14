import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MIN_SLOT = 1;
const MAX_SLOT = 3; // MAX_SAVE_SLOTS, lib/star/storage.ts

/**
 * `?slot=` is new — see supabase/migrations/star_career_slots.sql (PENDING).
 * Anything absent, non-numeric, or out of range quietly becomes slot 1
 * rather than erroring, so an old cached page or a stray request never
 * fails loudly over this.
 */
function parseSlot(req: Request): number {
  const raw = new URL(req.url).searchParams.get("slot");
  const n = raw === null ? NaN : parseInt(raw, 10);
  return Number.isInteger(n) && n >= MIN_SLOT && n <= MAX_SLOT ? n : MIN_SLOT;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null);
  const slot = parseSlot(req);

  let { data, error } = await supabase
    .from("star_careers")
    .select("career, updated_at")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .maybeSingle();

  // star_career_slots.sql may not have run against the live database yet —
  // selecting/filtering on a column that doesn't exist fails the WHOLE
  // query, not just the missing part (the same Supabase behaviour
  // league-squads/route.ts already has to work around). Slot 1 is the exact
  // save every account already had before slots existed, so it falls back
  // to the pre-slots query shape here — identical to what this route has
  // always done — rather than ever losing it. A slot other than 1 simply
  // cannot exist in the database yet if the migration hasn't run, so there
  // is nothing to fall back to: it correctly reads as "no cloud save for
  // this slot", exactly like a slot nobody has used yet once the migration
  // HAS run, and the client already treats that as "fall back to
  // localStorage" — see loadCareerFromCloud's own doc.
  if (error && slot === MIN_SLOT) {
    ({ data, error } = await supabase
      .from("star_careers")
      .select("career, updated_at")
      .eq("user_id", user.id)
      .maybeSingle());
  }

  if (!data || error) return NextResponse.json(null);
  // The timestamp travels WITH the career now — see loadCareerFromCloud.
  // Without it the client has no way to tell a cloud save that is ahead of
  // localStorage apart from one that is stale and behind it, and blindly
  // preferring cloud regressed players to an older, less-complete squad
  // (missing images that a later merge had already filled in locally).
  return NextResponse.json({ career: data.career, updatedAt: data.updated_at });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null);
  const slot = parseSlot(req);

  let career: unknown;
  try { career = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updated_at = new Date().toISOString();
  let { error } = await supabase
    .from("star_careers")
    .upsert(
      { user_id: user.id, slot, career, updated_at },
      { onConflict: "user_id,slot" },
    );

  // Same fallback as GET, and for the same reason: slot 1 degrades to the
  // exact upsert this route always used before slots existed, so an account
  // that never touches the new saves screen keeps cloud-saving exactly as
  // before regardless of whether star_career_slots.sql has been run yet. A
  // slot other than 1 has no pre-slots shape to fall back to — it simply
  // stays local-only (see saveCareerToCloud's "fire-and-forget" doc) until
  // the migration runs.
  if (error && slot === MIN_SLOT) {
    ({ error } = await supabase
      .from("star_careers")
      .upsert(
        { user_id: user.id, career, updated_at },
        { onConflict: "user_id" },
      ));
  }

  if (error) {
    // Never surfaced to the player — saveCareerToCloud is fire-and-forget by
    // design — but worth a server-side trace rather than vanishing outright,
    // now that a failure here can mean two different things: a real
    // problem, or simply a pending migration for a non-primary slot.
    console.error("[star/career] cloud save failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null);
  const slot = parseSlot(req);

  let { error } = await supabase.from("star_careers").delete()
    .eq("user_id", user.id).eq("slot", slot);

  if (error && slot === MIN_SLOT) {
    ({ error } = await supabase.from("star_careers").delete().eq("user_id", user.id));
  }

  return NextResponse.json({ ok: !error });
}
