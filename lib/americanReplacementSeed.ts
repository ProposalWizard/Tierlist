import {
  fetchMixedRoundPlayers,
  goalkeepersNeeded,
  makeReplacementState,
  participantsForRound,
  playerNameKey,
  roundOptionsFromSettings,
} from "@/lib/americanDraft";
import type { AmericanState } from "@/lib/americanDraft";

/** Squad rows only need these fields to build the ownership exclusion set. */
type RosterEntry = { sofifa_id?: string; name?: string };

export type SeedOutcome =
  | { status: "waiting"; submitted: number; total: number }
  | { status: "seeded" }
  | { status: "already-seeded" }
  | { status: "no-vacancies" }
  | { status: "not-applicable" }
  | { status: "error"; message: string };

/**
 * Seed the between-season replacement draft, but only once every remaining
 * manager has submitted their vacancies.
 *
 * Shared by two callers, which is the whole point:
 *
 *  - the vacancies route, after a manager submits;
 *  - the leave route, after a manager is removed.
 *
 * The second one matters. "Is everyone in?" used to be evaluated ONLY inside a
 * submission, so a manager who quit before submitting stranded everyone who
 * had: the check that would have noticed the room was now complete had no
 * remaining trigger, and leaving deletes the row without re-running it. Two
 * managers could sit on the waiting screen indefinitely, and the quitter could
 * not rejoin — a started room refuses joins — so nobody could unstick it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedReplacementDraftIfReady(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  roomId: string,
): Promise<SeedOutcome> {
  const { data: room, error: roomErr } = await service
    .from("draft_rooms")
    .select("id, american_state, settings")
    .eq("id", roomId)
    .maybeSingle();

  if (roomErr) return { status: "error", message: roomErr.message };
  if (!room) return { status: "not-applicable" };

  const state = room.american_state as AmericanState | null;
  // Only applies while a replacement draft is collecting vacancies.
  if (!state || state.mode !== "replacement" || state.complete || state.seeded) {
    return { status: state?.seeded ? "already-seeded" : "not-applicable" };
  }

  const pending = state.pending_vacancies ?? {};
  if (Object.keys(pending).length === 0) return { status: "not-applicable" };

  const { data: allPlayers, error: playersErr } = await service
    .from("draft_room_players")
    .select("user_id, status, squad, actual_finish")
    .eq("room_id", room.id);
  if (playersErr) return { status: "error", message: playersErr.message };

  // Relegated managers are out of the competition and take no part.
  const active = (allPlayers ?? []).filter(
    (p: { status?: string }) => p.status !== "out"
  ) as { user_id: string; squad?: RosterEntry[]; actual_finish?: number | null }[];

  if (active.length === 0) return { status: "not-applicable" };
  if (!active.every(p => pending[p.user_id] !== undefined)) {
    return {
      status: "waiting",
      submitted: active.filter(p => pending[p.user_id] !== undefined).length,
      total: active.length,
    };
  }

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
      .eq("id", room.id)
      .is("american_state->>seeded", null);
    if (error) return { status: "error", message: error.message };
    return { status: "no-vacancies" };
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
  for (const p of (allPlayers ?? []) as { squad?: RosterEntry[] }[]) {
    for (const sp of (p.squad ?? [])) {
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
    return { status: "error", message: e instanceof Error ? e.message : "Could not load players" };
  }

  const next = makeReplacementState(vacancies, needsGk, standingsOrder, pool);
  next.pending_vacancies = pending;
  next.seeded = true;

  // Claim the seed. Two callers can both observe "everyone is in" and both
  // build a pool — which is exactly how a previous draft ended up with two
  // players looking at different goalkeepers and every pick rejected as
  // unavailable. Writing only while the state is still unseeded means one wins
  // and the other falls in behind it.
  //
  // Deliberately does NOT touch room.status: this runs between seasons while
  // the room is "complete", and "complete" is the status /next-season requires
  // in order to advance the season number.
  const { data: claimed, error: seedErr } = await service
    .from("draft_rooms")
    .update({ american_state: next })
    .eq("id", room.id)
    .is("american_state->>seeded", null)
    .select("id");

  if (seedErr) {
    // If the JSON filter is unsupported, fall back to an unconditional write
    // rather than blocking the draft — that is no worse than before.
    const { error: fallbackErr } = await service
      .from("draft_rooms")
      .update({ american_state: next })
      .eq("id", room.id);
    if (fallbackErr) return { status: "error", message: fallbackErr.message };
    return { status: "seeded" };
  }

  if (!claimed || claimed.length === 0) return { status: "already-seeded" };
  return { status: "seeded" };
}
