import { shuffle } from "@/lib/shuffle";
import { nextPickDeadline, playerNameKey } from "@/lib/americanDraft";
import type { AmPlayer } from "@/lib/americanDraft";
import type { Brief } from "@/lib/challengeDraft";
import type { DraftPlayer } from "@/lib/seasonSimulator";

/**
 * MULTIPLAYER CHALLENGE DRAFT
 *
 * Runs on the existing draft_rooms / draft_room_players tables, with the draft
 * state living in the room's `american_state` JSONB column under a `variant`
 * tag. That column is already there, so this needs no migration — and nothing
 * else can misread it, because every code path that touches american_state is
 * reached only from a room whose settings.draftMode says it owns that state.
 */

export const CHALLENGE_DRAFT_MODE = "challenge";

export interface ChallengePick {
  briefId: string;
  player: AmPlayer;
}

export interface ChallengeRoomState {
  variant: "challenge";
  /** The fourteen briefs for this run, decided when the host starts. */
  briefs: Brief[];
  current_round: number;
  /** Draft order, shuffled once. Rounds alternate direction — see orderForRound. */
  base_order: string[];
  current_pick_idx: number;
  round_players: AmPlayer[];
  picks: Record<string, ChallengePick[]>;
  last_pick: Record<string, AmPlayer>;
  complete: boolean;
  /** Epoch ms by which the current picker must choose. */
  pick_deadline?: number;
  era: { start: number; end: number };
}

/**
 * Whose turn it is, round by round — a snake order.
 *
 * Reversing on alternate rounds is what keeps a multi-player draft fair. With a
 * fixed order the first picker takes the best card in all fourteen rounds and
 * the last picker never does; snaking means whoever picks last this round picks
 * first next, so the advantage evens out. (The American draft reshuffles
 * instead, which is fair on average but can still deal one manager the last
 * pick several rounds running.)
 */
export function orderForRound(baseOrder: string[], round: number): string[] {
  return round % 2 === 0 ? [...baseOrder] : [...baseOrder].reverse();
}

export function makeChallengeRoomState(
  userIds: string[],
  briefs: Brief[],
  firstRoundPlayers: AmPlayer[],
  era: { start: number; end: number },
): ChallengeRoomState {
  return {
    variant: "challenge",
    briefs,
    current_round: 0,
    base_order: shuffle(userIds),
    current_pick_idx: 0,
    round_players: firstRoundPlayers,
    picks: {},
    last_pick: {},
    complete: false,
    pick_deadline: nextPickDeadline(),
    era,
  };
}

/** Narrow an unknown american_state to a challenge draft. */
export function asChallengeState(state: unknown): ChallengeRoomState | null {
  const s = state as ChallengeRoomState | null;
  return s && s.variant === "challenge" ? s : null;
}

/**
 * Everyone already drafted by ANYONE in the room, by id and normalised name.
 *
 * Both keys matter: the same footballer appears once per FIFA edition under one
 * id, and the data also carries genuine duplicates under different ids. Without
 * the name key the same player can be offered again in a later round as a
 * different edition.
 */
export function takenKeysFrom(picks: Record<string, ChallengePick[]>): Set<string> {
  const keys = new Set<string>();
  for (const list of Object.values(picks ?? {})) {
    for (const p of list ?? []) {
      if (p?.player?.sofifa_id) keys.add(`id:${p.player.sofifa_id}`);
      const nk = playerNameKey(p?.player?.name ?? "");
      if (nk) keys.add(`name:${nk}`);
    }
  }
  return keys;
}

/** The same list, as the shape the round endpoint's `taken` field expects. */
export function takenListFrom(picks: Record<string, ChallengePick[]>): { sofifa_id: string; name: string }[] {
  const out: { sofifa_id: string; name: string }[] = [];
  for (const list of Object.values(picks ?? {})) {
    for (const p of list ?? []) {
      if (p?.player) out.push({ sofifa_id: p.player.sofifa_id, name: p.player.name });
    }
  }
  return out;
}

/**
 * A finished challenge squad, as the arrange screen and simulator consume it.
 *
 * Everyone lands on the bench at their natural position. There are no formation
 * slots in this mode — that is the point — so the eleven is chosen on the
 * arrange screen, which already refuses to continue until it is full.
 */
export function challengePicksToSquad(picks: ChallengePick[]): DraftPlayer[] {
  return picks.map(({ player: p }) => ({
    name: p.name,
    overall: p.ovr,
    positions: p.positions,
    club: p.club,
    clubYear: p.season ? `${p.club} ${p.season}` : p.club,
    assignedPosition: (p.positions || "").split(",")[0]?.trim().toUpperCase() || "CM",
    sofifa_id: p.sofifa_id,
    image_url: p.image_url,
    nationality: p.nationality,
    age: p.age,
    isSub: true,
  })) as unknown as DraftPlayer[];
}

/** The best card on the board — what an expired turn takes. */
export function autoPickFrom(state: ChallengeRoomState): AmPlayer | undefined {
  return [...(state.round_players ?? [])].sort((a, b) => b.ovr - a.ovr)[0];
}
