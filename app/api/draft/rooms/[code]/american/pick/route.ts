import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  americanPicksToSquad,
  attachSquadAttributes,
  fetchMixedRoundPlayers,
  fetchRoundPlayers,
  goalkeepersNeeded,
  participantsForRound,
  pickedPlayerKeys,
  playerNameKey,
  roundOptionsFromSettings,
  shuffleArray,
} from "@/lib/americanDraft";
import type { AmericanState, SquadPick } from "@/lib/americanDraft";
import { computeTeamStrength } from "@/lib/seasonSimulator";
import type { DraftPlayer } from "@/lib/seasonSimulator";
import { applyStatChange, getSigningBoost } from "@/lib/draftBoosts";

/** Squad rows only need these fields to build the ownership exclusion set. */
type RosterEntry = { sofifa_id?: string; name?: string };

/**
 * Make one pick in a room's American draft.
 *
 * On the final pick of the final round every player's squad is written to their
 * own draft_room_players row with status 'ready', which is exactly the state the
 * normal flow reaches after everyone submits a spun squad — so the host's
 * existing "Simulate Season" button just works. Nothing is handed off to
 * another room.
 */
export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  const { sofifa_id } = (await req.json().catch(() => ({}))) as { sofifa_id?: string };
  if (!sofifa_id) return NextResponse.json({ error: "Missing sofifa_id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();
  const code = params.code.toUpperCase();

  const { data: room, error: roomErr } = await service
    .from("draft_rooms")
    .select("id, american_state, season_number, settings")
    .eq("code", code)
    .maybeSingle();

  if (roomErr) {
    return NextResponse.json({ error: `Room lookup failed: ${roomErr.message}` }, { status: 500 });
  }
  if (!room) return new Response("Room not found", { status: 404 });

  const state = room.american_state as AmericanState | null;
  if (!state) return NextResponse.json({ error: "This room is not running an American draft" }, { status: 400 });
  if (state.complete) return NextResponse.json({ ok: true, complete: true });

  if (state.pick_order[state.current_pick_idx] !== user.id) {
    return NextResponse.json({ error: "It is not your turn" }, { status: 409 });
  }

  const picked = state.round_players.find(p => p.sofifa_id === sofifa_id);
  if (!picked) {
    return NextResponse.json({ error: "That player is no longer available" }, { status: 409 });
  }

  const currentPosition = state.position_sequence[state.current_round];

  // Record the pick.
  const nextState: AmericanState = {
    ...state,
    picks: {
      ...state.picks,
      [user.id]: [
        ...(state.picks[user.id] ?? []),
        { round: state.current_round, position: currentPosition, player: picked },
      ],
    },
    last_pick: { ...state.last_pick, [user.id]: picked },
  };

  const isReplacement = state.mode === "replacement";

  if (isReplacement) {
    return handleReplacementPick(service, room, state, nextState, user.id, sofifa_id);
  }

  const isLastPickerInRound = state.current_pick_idx + 1 >= state.pick_order.length;
  const isLastRound = state.current_round + 1 >= state.position_sequence.length;

  if (isLastPickerInRound && isLastRound) {
    // ── Draft finished — write every squad into this room ──
    nextState.complete = true;
    nextState.round_players = [];

    // Attributes are fetched once, here, for every finished squad — they are
    // kept out of the live draft state so each pick's write stays small. The
    // simulator needs them: without attributes it counts midfielders at half
    // their rating, which made an 83-average squad simulate at 67 strength.
    const built = Object.entries(nextState.picks).map(([userId, picks]) => {
      const list = picks as SquadPick[];
      return {
        userId,
        squad: americanPicksToSquad(list),
        fifaYears: list.map(p => p.player.fifa_year),
      };
    });
    await attachSquadAttributes(service, built);

    const rows = built.map(({ userId, squad }) => {
      const { teamStrength, avgOvr } = computeTeamStrength(squad);
      return { userId, squad, teamStrength, avgOvr };
    });

    for (const row of rows) {
      const { error: readyErr } = await service
        .from("draft_room_players")
        .update({
          squad: row.squad,
          avg_ovr: row.avgOvr,
          team_strength: row.teamStrength,
          status: "ready",
        })
        .eq("room_id", room.id)
        .eq("user_id", row.userId);

      if (readyErr) {
        return NextResponse.json(
          { error: `Could not save squads: ${readyErr.message}` },
          { status: 500 }
        );
      }
    }

    // "started", not "lobby": the lobby only lets the host edit settings while
    // the room is in "lobby", and the draft is finished, so the settings it was
    // played under must stop being editable. The simulate route accepts
    // lobby/started/drafting, so this does not block the season.
    const { error: doneErr } = await service
      .from("draft_rooms")
      .update({ american_state: nextState, status: "started" })
      .eq("id", room.id);

    if (doneErr) {
      return NextResponse.json({ error: `Could not finish the draft: ${doneErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, complete: true });
  }

  if (isLastPickerInRound) {
    // Advance to the next round: reshuffle the order and load a fresh pool.
    const nextRound = state.current_round + 1;
    nextState.current_round = nextRound;
    nextState.current_pick_idx = 0;
    nextState.pick_order = shuffleArray(state.pick_order);
    // Exclude everyone already taken, so a player picked at one position can
    // never reappear at another — and no two editions of the same footballer
    // can both end up in a squad.
    //
    // fetchRoundPlayers throws rather than returning an empty list. Saving an
    // empty pool is what stranded a draft on "Loading players…" with nothing to
    // pick and no way forward, so the pick is rejected instead and the room
    // stays on the round it can still play.
    try {
      nextState.round_players = await fetchRoundPlayers(
        service,
        state.position_sequence[nextRound],
        pickedPlayerKeys(nextState.picks),
        roundOptionsFromSettings(room.settings)
      );
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not load the next round" },
        { status: 500 }
      );
    }
  } else {
    // Same round, next picker — the picked player leaves the pool.
    nextState.current_pick_idx = state.current_pick_idx + 1;
    nextState.round_players = state.round_players.filter(p => p.sofifa_id !== sofifa_id);
  }

  const { error: saveErr } = await service
    .from("draft_rooms")
    .update({ american_state: nextState })
    .eq("id", room.id);

  if (saveErr) {
    return NextResponse.json({ error: `Could not save the pick: ${saveErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * One pick in a between-season replacement draft.
 *
 * Unlike the initial draft, managers owe different numbers of players, so the
 * pick order is rebuilt each round from whoever is still owed one and the draft
 * ends when nobody is. Picks are APPENDED to the squad the manager carried in
 * after departures and sales, rather than forming a whole new squad.
 */
async function handleReplacementPick(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  room: any,
  state: AmericanState,
  nextState: AmericanState,
  userId: string,
  sofifaId: string,
) {
  const vacancies = { ...(state.vacancies ?? {}) };
  vacancies[userId] = Math.max(0, (vacancies[userId] ?? 0) - 1);
  nextState.vacancies = vacancies;

  const standingsOrder = state.standings_order ?? state.pick_order;
  const needsGk = state.needs_gk ?? {};

  // A manager who just filled their keeper slot no longer forces one into the pool.
  const pickedIsGk = (state.round_players.find(p => p.sofifa_id === sofifaId)?.positions ?? "")
    .toUpperCase().split(",").map(x => x.trim()).includes("GK");
  if (pickedIsGk && needsGk[userId]) {
    nextState.needs_gk = { ...needsGk, [userId]: false };
  }

  const stillPicking = state.current_pick_idx + 1 < state.pick_order.length;
  if (stillPicking) {
    nextState.current_pick_idx = state.current_pick_idx + 1;
    nextState.round_players = state.round_players.filter(p => p.sofifa_id !== sofifaId);
  } else {
    const nextParticipants = participantsForRound(vacancies, standingsOrder);
    if (nextParticipants.length === 0) {
      return finishReplacementDraft(service, room, nextState);
    }

    nextState.current_round = state.current_round + 1;
    nextState.current_pick_idx = 0;
    nextState.pick_order = nextParticipants;

    // Exclude everyone on any roster in the room as well as this draft's picks.
    const excluded = pickedPlayerKeys(nextState.picks);
    const { data: rosters } = await service
      .from("draft_room_players")
      .select("squad")
      .eq("room_id", room.id);
    for (const r of rosters ?? []) {
      for (const sp of ((r.squad as RosterEntry[]) ?? [])) {
        if (sp?.sofifa_id) excluded.add(`id:${sp.sofifa_id}`);
        const nk = playerNameKey(sp?.name ?? "");
        if (nk) excluded.add(`name:${nk}`);
      }
    }

    try {
      nextState.round_players = await fetchMixedRoundPlayers(
        service,
        excluded,
        roundOptionsFromSettings(room.settings),
        goalkeepersNeeded(nextParticipants, nextState.needs_gk ?? needsGk)
      );
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not load the next round" },
        { status: 500 }
      );
    }
  }

  const { error } = await service
    .from("draft_rooms")
    .update({ american_state: nextState })
    .eq("id", room.id);
  if (error) {
    return NextResponse.json({ error: `Could not save the pick: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Append each manager's replacements to their carried-over squad. */
async function finishReplacementDraft(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  room: any,
  nextState: AmericanState,
) {
  nextState.complete = true;
  nextState.round_players = [];

  // status is needed so relegated managers are skipped below — writing "ready"
  // over their "out" would put an eliminated manager back into the league.
  const { data: rosters, error: rosterErr } = await service
    .from("draft_room_players")
    .select("user_id, squad, status")
    .eq("room_id", room.id);
  if (rosterErr) {
    return NextResponse.json({ error: rosterErr.message }, { status: 500 });
  }

  const season = Number(room.season_number) || 1;
  const built = Object.entries(nextState.picks).map(([userId, picks]) => {
    const list = picks as SquadPick[];
    // Replacements join the BENCH. They are not slotted into the position of
    // whoever left — the manager promotes whoever they want on the arrange
    // screen, which already refuses to continue until a full eleven is picked.
    return { userId, squad: americanPicksToSquad(list, true), fifaYears: list.map(p => p.player.fifa_year) };
  });
  await attachSquadAttributes(service, built);

  for (const row of rosters ?? []) {
    if (row.status === "out") continue;
    const mine = built.find(b => b.userId === row.user_id);
    const carried = (row.squad as DraftPlayer[]) ?? [];
    // Signings keep their boost in American mode, so a career's squad inflation
    // curve stays the same as the normal draft's.
    const signed = (mine?.squad ?? []).map(p => applyStatChange(p, getSigningBoost(season)));
    const full = [...carried, ...signed];
    if (full.length === 0) continue;

    const { teamStrength, avgOvr } = computeTeamStrength(full);
    const { error } = await service
      .from("draft_room_players")
      .update({ squad: full, avg_ovr: avgOvr, team_strength: teamStrength, status: "ready" })
      .eq("room_id", room.id)
      .eq("user_id", row.user_id);
    if (error) {
      return NextResponse.json({ error: `Could not save squads: ${error.message}` }, { status: 500 });
    }
  }

  const { error: doneErr } = await service
    .from("draft_rooms")
    .update({ american_state: nextState })
    .eq("id", room.id);
  if (doneErr) {
    return NextResponse.json({ error: doneErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, complete: true });
}
