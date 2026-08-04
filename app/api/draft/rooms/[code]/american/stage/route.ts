import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stageNextRound } from "@/lib/americanDraft";
import type { AmericanState } from "@/lib/americanDraft";

/**
 * Pre-build the NEXT round's pool while the current round is being played.
 *
 * Clients call this once whenever a round begins. The pool is parked in
 * storage; the round-advance request consumes it instead of building a pool
 * while the whole room waits. The staged players are returned so the caller
 * can prefetch their images — by the time the round flips, every face, badge
 * and flag is already in the browser cache.
 *
 * Every client fires this (whoever lands first does the work; the rest get the
 * already-staged pool back), it is idempotent, and it can never break a draft:
 * on any failure the advance path simply builds the pool live as it always did.
 */
export async function POST(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const service = createServiceClient();
    const { data: room } = await service
      .from("draft_rooms")
      .select("id, american_state, settings, season_number")
      .eq("code", params.code.toUpperCase())
      .maybeSingle();

    const state = room?.american_state as AmericanState | null;
    if (!room || !state || state.complete) {
      return NextResponse.json({ players: [] });
    }

    const players = await stageNextRound(service, room, state);
    return NextResponse.json({ players: players ?? [] });
  } catch {
    // Staging is only ever an optimisation.
    return NextResponse.json({ players: [] });
  }
}
