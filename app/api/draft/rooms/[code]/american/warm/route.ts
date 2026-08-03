import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchRoundPlayers, roundOptionsFromSettings } from "@/lib/americanDraft";

/**
 * Warm the player pool for a room's era.
 *
 * The pool is cached in server memory, but that cache does not survive a cold
 * serverless instance — so the first action after any idle period paid the full
 * load. The lobby calls this while people are still joining and reading the
 * settings, which is dead time anyway, so by the time the host presses Start
 * Game the pool is already in memory.
 *
 * Deliberately cheap to call and safe to call repeatedly: a warm cache makes it
 * a no-op, and any failure is swallowed because this is only an optimisation —
 * the draft still works, it is just slower.
 */
export async function POST(
  _req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const service = createServiceClient();
    const { data: room } = await service
      .from("draft_rooms")
      .select("settings")
      .eq("code", params.code.toUpperCase())
      .maybeSingle();

    if (!room) return NextResponse.json({ ok: true, warmed: false });

    // Loading one round populates the era pool, the league names and the club
    // logo map — every cache the draft depends on.
    await fetchRoundPlayers(service, "GK", [], roundOptionsFromSettings(room.settings), 1);
    return NextResponse.json({ ok: true, warmed: true });
  } catch {
    return NextResponse.json({ ok: true, warmed: false });
  }
}
