import type { CareerState, LeagueSquad } from "./types";
import type { Role } from "./formations";
import { bestFitness } from "./formations";
import { formationForClub } from "./teamsheet";
import { playerMarketValue } from "./marketValue";
import { getTuning } from "./tuningStore";

/** Works against either representation a player can be read as — your own
 *  SquadPlayer, or a LeaguePlayer on the far side of a fetched squad — since
 *  a real sale only ever needs these few fields either shape already has. */
interface SellableCandidate {
  position: Role;
  overall?: number;
  age?: number;
  highPotential?: boolean;
  worldClassPotential?: boolean;
}

/**
 * WHO'S ACTUALLY INTERESTED IN BUYING YOUR PLAYER.
 *
 * Requested directly, in full detail, after reporting that selling a player
 * from an owned club just removed him with no real destination: a 70-rated
 * squad player should not draw interest from a Champions League side, and a
 * club that just lost its own goalkeeper (or never had a good one) should be
 * a plausible taker even for an ordinary one. Built to reuse the SAME real
 * ingredients `leagueTransfers.ts`'s AI-vs-AI transfer window already scores
 * a club's own buying decisions with — reach (a club can only attract a
 * player within reach of its own real strength) and need (a thin position
 * matters far more than a well-stocked one) — rather than inventing a
 * second, different notion of "interested." Not a straight import of that
 * file's own functions: those are tuned for a whole-division batch pass
 * across every listed player at once (squad-size gating, unhappiness rolls,
 * loans), which doesn't apply here — this only ever answers "does THIS one
 * club want THIS one player," for a sale the human is actively initiating.
 *
 * `expectedOffer` scales `playerMarketValue` by how good a fit the deal
 * is — a desperate buyer offers close to (or over) market value, indifferent
 * interest well under it — so two clubs sitting at the same reach can still
 * offer very differently for the same player.
 */

export type RoleIntent = "starter" | "squad" | "reserve";

export interface TransferInterest {
  club: string;
  roleIntent: RoleIntent;
  expectedOffer: number;
}

function clampUnit(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function squadOf(career: CareerState, club: string): LeagueSquad | undefined {
  return (career.leagueSquads ?? []).find(s => s.club === club)
    ?? (career.externalSquads ?? []).find(s => s.club === club);
}

/** Real league strength where it's already tracked (your own division);
 *  otherwise the same top-11-average approximation leagueSquads.ts's own
 *  `averageStartingXIRating` uses, read straight off that club's real
 *  fetched squad — Championship/Europa/Saudi clubs all carry one via
 *  `externalClubsFor`, so this isn't a guess for them either. */
function clubStrengthOf(career: CareerState, club: string, squad: LeagueSquad | undefined): number {
  const inLeague = career.league.find(t => t.name === club);
  if (inLeague) return inLeague.strength;
  if (squad && squad.players.length) {
    const xi = [...squad.players].sort((a, b) => b.overall - a.overall).slice(0, 11);
    return Math.round(xi.reduce((s, p) => s + p.overall, 0) / xi.length);
  }
  return 65;
}

/** Same shape as leagueTransfers.ts's own `reachDown` — a big club reaches
 *  much further down than a small one; nothing reaches far up at all. */
function reachDown(buyerStrength: number): number {
  const t = clampUnit((buyerStrength - 62) / 24);
  return 6 + t * 10;
}
const REACH_UP = 5;

function slotsFor(role: Role, formationSlots: { role: Role }[]): number {
  return formationSlots.filter(s => s.role === role).length;
}

/**
 * Every club with a real, fetched squad this career actually has data for —
 * the other nineteen in your own division, plus Championship/Europa/Saudi
 * clubs already pulled into `externalSquads` — is a genuine candidate
 * buyer. `maxResults` keeps the list a real shortlist, not a wall of names;
 * a genuinely unwanted player (a plain lower-league squad man) can come
 * back with none at all.
 */
export function interestedClubs(
  player: SellableCandidate, sellingClub: string, career: CareerState, maxResults = 5,
): TransferInterest[] {
  const candidateClubs = new Set<string>();
  for (const s of career.leagueSquads ?? []) if (s.club !== sellingClub) candidateClubs.add(s.club);
  for (const s of career.externalSquads ?? []) if (s.club !== sellingClub) candidateClubs.add(s.club);

  const reachBonus = player.worldClassPotential
    ? getTuning("wonderkids.bigClubReachBonus") * getTuning("wonderkids.worldClassMultiplier")
    : player.highPotential ? getTuning("wonderkids.bigClubReachBonus") : 0;

  const results: TransferInterest[] = [];
  for (const club of Array.from(candidateClubs)) {
    const squad = squadOf(career, club);
    const buyerStrength = clubStrengthOf(career, club, squad);
    const overall = player.overall ?? 65;
    if (overall < buyerStrength - reachDown(buyerStrength) - reachBonus) continue; // out of their reach entirely
    if (overall > buyerStrength + REACH_UP + reachBonus) continue; // no club signs a project player hoping he grows into the shirt

    const formation = formationForClub(club);
    const slots = slotsFor(player.position, formation.slots);
    if (slots === 0) continue; // this club's own shape doesn't even play the position

    const at = (squad?.players ?? [])
      .map(p => ({ p, fit: bestFitness(player.position, p) }))
      .filter(x => x.fit >= 82)
      .sort((a, b) => b.p.overall - a.p.overall);
    const depth = at.slice(0, slots).map(x => x.p.overall);
    while (depth.length < slots) depth.push(0); // an empty slot is the strongest possible need
    const avgDepth = depth.reduce((s, v) => s + v, 0) / slots;
    const need = clampUnit((buyerStrength - avgDepth) / 12);
    if (need < 0.12) continue; // plenty of good cover there already — not remotely interested

    const roleIntent: RoleIntent = (avgDepth === 0 || overall - avgDepth >= 6) ? "starter"
      : need >= 0.35 ? "squad" : "reserve";

    // A desperate buyer offers close to (or past) market value; indifferent
    // interest well under it — the same "expected offer" spread requested
    // directly (a title side low-balls a squad-filler, a club in genuine
    // need pays close to what he's really worth).
    const fitMultiplier = 0.65 + need * 0.7;
    const expectedOffer = Math.max(
      getTuning("marketValue.floor"),
      Math.round(playerMarketValue({ ...player, overall }, sellingClub, career) * fitMultiplier),
    );
    results.push({ club, roleIntent, expectedOffer });
  }

  return results.sort((a, b) => b.expectedOffer - a.expectedOffer).slice(0, maxResults);
}
