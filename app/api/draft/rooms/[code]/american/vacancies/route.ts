import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchMixedRoundPlayers,
  goalkeepersNeeded,
  makeReplacementState,
  participantsForRound,
  playerNameKey,
  roundOptionsFromSettings,
} from "@/lib/americanDraft";
import type { AmericanState } from "@/lib/americanDraft";
import type { DraftPlayer } from "@/lib/seasonSimulator";

/** Squad rows only need these fields to build the ownership exclusion set. */
type RosterEntry = { sofifa_id?: string; name?: string };

/**
 * Submit one manager's between-season position: the squad they are left with
 * after departures and any sale, and how many replacements they are owed.
 *
 * The last manager to submit also seeds the replacement draft, in the same
 * request. Doing it here rather than behind a host button means nobody has to
 * coordinate, and the seeding write is conditional so two simultaneous final
 * submissions cannot produce two different pools.
 */
export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  const body = await req.json().catch(() => null) as {
    squad?: DraftPlayer[];
    vacancies?: number;
    needsGk?: boolean;
  } | null;

  if (!body || !Array.isArray(body.squad)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const count = Number(body.vacancies);
  if (!Number.isInteger(count) || count < 0 || count > 3) {
    return NextResponse.json({ error: "vacancies must be between 0 and 3" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();
  const code = params.code.toUpperCase();

  const { data: room, error: roomErr } = await service
    .from("draft_rooms")
    .select("id, american_state, settings, season_number")
    .eq("code", code)
    .maybeSingle();

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });
  if (!room) return new Response("Room not found", { status: 404 });

  // Persist the reduced squad so the pool can exclude everyone still owned. The
  // status stays "drafting" — the squad is not final until it has been arranged.
  const { error: squadErr } = await service
    .from("draft_room_players")
    .update({ squad: body.squad })
    .eq("room_id", room.id)
    .eq("user_id", user.id);
  if (squadErr) {
    return NextResponse.json({ error: `Could not save your squad: ${squadErr.message}` }, { status: 500 });
  }

  const { data: allPlayers, error: playersErr } = await service
    .from("draft_room_players")
    .select("user_id, status, squad, actual_finish")
    .eq("room_id", room.id);
  if (playersErr) {
    return NextResponse.json({ error: playersErr.message }, { status: 500 });
  }

  // Relegated managers are out of the competition and take no part.
  const active = (allPlayers ?? []).filter(p => p.status !== "out");

  // Only pending_vacancies is carried forward. Spreading the whole previous
  // state dragged complete:true and seeded:true from the last season into this
  // one, so the draft was skipped and could never be seeded again.
  const prev = (room.american_state as AmericanState | null) ?? null;
  const stale = prev?.complete === true;
  const pending = { ...(stale ? {} : (prev?.pending_vacancies ?? {})) };
  pending[user.id] = { count, needsGk: !!body.needsGk };

  const everyoneIn = active.every(p => pending[p.user_id] !== undefined);
  if (!everyoneIn) {
    const { error } = await service
      .from("draft_rooms")
      .update({ american_state: { mode: "replacement", pending_vacancies: pending } })
      .eq("id", room.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      waiting: true,
      submitted: Object.keys(pending).length,
      total: active.length,
    });
  }

  // ── Everyone is in: seed the draft ──
  const vacancies: Record<string, number> = {};
  const needsGk: Record<string, boolean> = {};
  for (const p of active) {
    vacancies[p.user_id] = pending[p.user_id]?.count ?? 0;
    needsGk[p.user_id] = pending[p.user_id]?.needsGk ?? false;
  }

  // Nobody lost anyone — skip the draft entirely rather than opening an empty one.
  if (Object.values(vacancies).every(v => v === 0)) {
    const { error } = await service
      .from("draft_rooms")
      .update({
        american_state: {
          mode: "replacement", pending_vacancies: pending,
          complete: true, seeded: true, round_players: [], vacancies, needs_gk: needsGk,
        },
      })
      .eq("id", room.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, complete: true, noVacancies: true });
  }

  // Reverse league standings — worst finisher picks first, straight order.
  // A missing finish sorts last so it never steals the first pick.
  const standingsOrder = [...active]
    .sort((a, b) => (b.actual_finish ?? 0) - (a.actual_finish ?? 0))
    .map(p => p.user_id);

  // Exclude everyone already on ANY roster in this room, not just this draft's
  // picks — squads persist between seasons, so without this the same footballer
  // could be drafted onto a second team.
  const owned = new Set<string>();
  for (const p of allPlayers ?? []) {
    for (const sp of ((p.squad as RosterEntry[]) ?? [])) {
      if (sp?.sofifa_id) owned.add(`id:${sp.sofifa_id}`);
      const nk = playerNameKey(sp?.name ?? "");
      if (nk) owned.add(`name:${nk}`);
    }
  }

  const firstParticipants = participantsForRound(vacancies, standingsOrder);
  let pool;
  try {
    pool = await fetchMixedRoundPlayers(
      service,
      owned,
      roundOptionsFromSettings(room.settings),
      goalkeepersNeeded(firstParticipants, needsGk)
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load players" },
      { status: 500 }
    );
  }

  const state = makeReplacementState(vacancies, needsGk, standingsOrder, pool);
  state.pending_vacancies = pending;
  state.seeded = true;

  // Claim the seed. Two managers submitting at almost the same moment can BOTH
  // observe "everyone is in" and both build a pool — which is exactly how a
  // previous draft ended up with the two players looking at different
  // goalkeepers and every pick rejected as unavailable. Writing only while the
  // state is still unseeded means one wins and the other falls in behind it.
  const { data: claimed, error: seedErr } = await service
    .from("draft_rooms")
    .update({ american_state: state, status: "started" })
    .eq("id", room.id)
    .is("american_state->>seeded", null)
    .select("id");

  if (seedErr) {
    // If the JSON filter is unsupported, fall back to an unconditional write
    // rather than blocking the draft — that is no worse than before.
    const { error: fallbackErr } = await service
      .from("draft_rooms")
      .update({ american_state: state, status: "started" })
      .eq("id", room.id);
    if (fallbackErr) {
      return NextResponse.json({ error: `Could not start the draft: ${fallbackErr.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, started: true });
  }

  // Someone else seeded first — their pool is the real one.
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ ok: true, started: true, alreadySeeded: true });
  }

  return NextResponse.json({ ok: true, started: true });
}
