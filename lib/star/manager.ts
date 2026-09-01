import type { CareerState } from "./types";
import { mulberry32 } from "./season";
import { clubNameSeed } from "./squadData";
import { loadLineup } from "./lineupStore";
import { clubExpectation } from "./expectations";

/**
 * THE MANAGER
 *
 * Your standing with "the boss" was a relationship with nobody. It had no name,
 * it never changed hands, and a number you had spent five seasons building could
 * not be taken away by anything except your own form.
 *
 * There is a man in the job now, and he can lose it. A bad enough season and the
 * board sack him, and the one who walks in has never picked you — everything you
 * built with the last one goes with him. It is the harshest thing in the career
 * and it is the most true: it is how a settled player becomes a squad player
 * without kicking a ball differently.
 *
 * He also has a way of doing things. A manager who trusts his players is slower
 * to drop you and slower to bring you back; one who rotates is the opposite.
 * That is the whole of it — no hidden tactics, nothing you cannot see on the
 * dashboard.
 *
 * ── Reputation ──
 *
 * The board's own expectation (see expectations.ts) already judges the CLUB's
 * season against a target that scales with the job — but every incoming
 * manager, big club or small, used to be drawn from exactly the same blind
 * roll. A free agent's own name is worth something too: a title-chasing job
 * mostly attracts a name to match, and a relegation fight mostly gets someone
 * with a point to prove — never a certainty either way, since an ambitious
 * small club can tempt a bigger name than the job deserves, and a giant can
 * just as easily take a punt on someone unproven. It also decides how much
 * rope the incoming man himself gets in his first season — see sackCheck.
 */

const FIRST = ["Alan", "Roberto", "Klaus", "Diego", "Sean", "Marcelo", "Henrik", "Paul", "Gianluca", "Owen", "Bruno", "Terry"];
const LAST = ["Whitfield", "Marchetti", "Voss", "Almeida", "Doherty", "Ferreira", "Lindberg", "Ashcroft", "Bianchi", "Pryce", "Salgado", "Hobbs"];

export type ManagerStyle = "trusting" | "demanding" | "rotational";

export interface Manager {
  name: string;
  style: ManagerStyle;
  /** The season he took over. */
  since: number;
  /** How he described the job when he arrived. */
  arrival: string;
  /**
   * 0-100, how well-regarded he is in the game — a free agent's own
   * standing, not his standing with YOU (that's `relationships.boss`). See
   * `reputationTier`/`reputationBlurb`. Weighted by the prestige of the job
   * he's taken (`makeManager`), and it sets how much first-season patience
   * he himself gets from the board (`sackCheck`) — a big name is brought in
   * to fix things now, not to be given time to learn the job.
   */
  reputation: number;
}

const STYLE_BLURB: Record<ManagerStyle, string> = {
  trusting: "Picks a side and sticks with it. Slow to drop you, slow to bring you back.",
  demanding: "Expects a lot, every week. Form is the only currency with him.",
  rotational: "Rotates freely. Nobody is guaranteed, and nobody is frozen out.",
};

export type ReputationTier = "Elite" | "Proven" | "Rising" | "Journeyman";

const REPUTATION_TIERS: { tier: ReputationTier; min: number; blurb: string }[] = [
  { tier: "Elite", min: 80, blurb: "A genuine box-office name — the kind of appointment that makes the back pages." },
  { tier: "Proven", min: 55, blurb: "Has done this before, somewhere that mattered." },
  { tier: "Rising", min: 30, blurb: "Making a name for himself. This could be the job that does it." },
  { tier: "Journeyman", min: 0, blurb: "Not a name anyone outside the game would know. Everyone starts somewhere." },
];

export function reputationTier(reputation: number): ReputationTier {
  return (REPUTATION_TIERS.find(t => reputation >= t.min) ?? REPUTATION_TIERS[REPUTATION_TIERS.length - 1]).tier;
}

export function reputationBlurb(reputation: number): string {
  return (REPUTATION_TIERS.find(t => reputation >= t.min) ?? REPUTATION_TIERS[REPUTATION_TIERS.length - 1]).blurb;
}

/**
 * The reputation range a club's own prestige can plausibly hire from —
 * genuinely overlapping between tiers, so nothing here is a hard ceiling or
 * floor, just where the odds lean. Read off the same four ambition tiers
 * `clubExpectation` already buckets every club into, rather than a second,
 * separate notion of "how big is this club."
 */
const REPUTATION_RANGE: Record<ReturnType<typeof clubExpectation>["ambition"], { min: number; max: number }> = {
  Title: { min: 55, max: 100 },
  Europe: { min: 35, max: 90 },
  "Mid-table": { min: 15, max: 75 },
  Survival: { min: 0, max: 55 },
};

/**
 * How a manager's way of doing things bends selection.
 *
 * Deliberately small and symmetric: a trusting manager is harder to lose your
 * place with AND harder to win it back from, so no style is simply better. It
 * shifts the bar rather than the player.
 */
export const STYLE_SELECTION: Record<ManagerStyle, { start: number; bench: number }> = {
  trusting: { start: -4, bench: -4 },
  demanding: { start: +5, bench: +2 },
  rotational: { start: 0, bench: -6 },
};

export function makeManager(career: CareerState, club: string, season: number): Manager {
  const rng = mulberry32(clubNameSeed(club) + season * 7717 + Math.round(career.starRating * 7));
  // Rolled either way, so the style/tenure sequence below never shifts
  // depending on whether a real name is on file for this club.
  const generatedName = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
  const roll = rng();
  const style: ManagerStyle = roll < 0.38 ? "trusting" : roll < 0.72 ? "demanding" : "rotational";
  // Weighted by the prestige of THIS job — `club`, not necessarily wherever
  // `career.player` currently plays — see REPUTATION_RANGE.
  const range = REPUTATION_RANGE[clubExpectation({ ...career, player: { ...career.player, club } }).ambition];
  const reputation = Math.round(range.min + rng() * (range.max - range.min));
  // Typed in for this club on the Squad Builder / Lineups screen (see
  // lineupStore.ts) — use the real name on the touchline instead of a
  // fictional one when there is one on file. Everything else about him
  // (style, tenure, reputation, whether he gets sacked) is still simulated;
  // only the database has no real managers, not the game.
  const real = loadLineup(club)?.manager?.trim();
  return {
    name: real || generatedName,
    style,
    since: season,
    arrival: STYLE_BLURB[style],
    reputation,
  };
}

export function styleBlurb(style: ManagerStyle): string {
  return STYLE_BLURB[style];
}

/**
 * What a new manager thinks of you before he has seen you play.
 *
 * Not a full reset to zero — he has watched the tapes, and a player with a real
 * reputation walks in with something. But nothing like the relationship you had
 * with the man who just left, which is the entire point.
 */
export function bossOnArrival(career: CareerState): number {
  return Math.round(Math.max(35, Math.min(68, 42 + career.starRating * 5)));
}

export interface SackVerdict {
  sacked: boolean;
  reason: string;
}

/**
 * Whether the board have seen enough.
 *
 * Judged on the season the club just had, not on you — a manager is not sacked
 * because one of his forwards had a quiet year. A manager in his first season
 * gets more rope, because sacking someone after nine months for a squad he
 * inherited is the kind of thing that reads as arbitrary even when it is
 * realistic.
 *
 * That rope is not the same length for everyone, though: a genuine name was
 * brought in to fix things NOW, not to be given a season to learn the job,
 * so reputation trims his first-season grace back down; a journeyman "project"
 * appointment gets extra, on the same logic a board that signed up for a long
 * rebuild does not panic after nine months. Reputation only touches the
 * FIRST-season bar — small and bounded (±0.15 at the extremes, well short of
 * the 0.27 gap to the second-season bar) so a legendary reputation can make
 * year one genuinely tense without ever being judged harder than a settled
 * manager in year two. By his second season everyone answers to the same bar
 * regardless of what he arrived with.
 */
export function sackCheck(career: CareerState, seasonScore: number): SackVerdict {
  const m = career.manager;
  if (!m) return { sacked: false, reason: "" };
  const firstSeason = career.season - m.since < 1;
  const reputationAdjust = firstSeason ? (((m.reputation ?? 50) - 50) / 100) * 0.3 : 0;
  const bar = (firstSeason ? -0.72 : -0.45) + reputationAdjust;
  if (seasonScore <= bar) {
    return {
      sacked: true,
      reason: seasonScore <= -0.8
        ? `${m.name} is sacked. The board had seen enough long before the end.`
        : `${m.name} is sacked after a season below what the board wanted.`,
    };
  }
  return { sacked: false, reason: "" };
}
