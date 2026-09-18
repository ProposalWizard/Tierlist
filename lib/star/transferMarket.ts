import type { CareerState, LeagueSquad } from "./types";
import type { Role } from "./formations";
import { bestFitness } from "./formations";
import { formationForClub } from "./teamsheet";
import { playerMarketValue } from "./marketValue";
import { getTuning } from "./tuningStore";
import { realPrestigeFactor } from "./investments";
import { clubNameSeed } from "./squadData";

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
 *  `externalClubsFor`, so this isn't a guess for them either. `real: false`
 *  means neither of those held and the number is a flat, uninformed guess —
 *  see `interestedClubs`'s own note on why that specifically matters. */
function clubStrengthOf(career: CareerState, club: string, squad: LeagueSquad | undefined): { strength: number; real: boolean } {
  const inLeague = career.league.find(t => t.name === club);
  if (inLeague) return { strength: inLeague.strength, real: true };
  if (squad && squad.players.length) {
    const xi = [...squad.players].sort((a, b) => b.overall - a.overall).slice(0, 11);
    return { strength: Math.round(xi.reduce((s, p) => s + p.overall, 0) / xi.length), real: true };
  }
  return { strength: 65, real: false };
}

/** A club with no real strength data on file at all shouldn't be able to
 *  parlay a flat, uninformed guess into interest in a genuinely elite
 *  target — reported directly, with real named examples (Ferencvárosi,
 *  Sheffield United both showing interest in an 88-rated Chelsea starter):
 *  neither club's squad was ever actually fetched for this career, so their
 *  "interest" was riding entirely on the 65 fallback plus reach/potential
 *  bonuses happening to clear the bar, not on any real evidence either club
 *  is actually big enough to be in the conversation. A club with genuine
 *  data (a fetched squad, or a real league strength) is judged on that
 *  real number with no extra cap — only the blind guess gets capped. */
const UNVERIFIED_CLUB_RATING_CAP = 75;

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
  // Your own playing club is never a real candidate here — its real roster
  // lives in `career.squad`, a completely different place from every other
  // club's `leagueSquads`/`externalSquads` entry. `career.leagueSquads`
  // still carries a redundant, stale FETCHED copy of your own club too (for
  // the league table's other nineteen clubs' squads, fetched as one whole-
  // division batch with nothing excluding yours) — nothing else reads it,
  // but `sellPlayerFromOwnedClub`'s buyerClub path would happily write a
  // "purchased" player into that dead copy instead of your real squad,
  // making him vanish from wherever he actually came from while never
  // genuinely joining the club the game says bought him. Caught directly:
  // signing a player away from the human's own club left him on both
  // squads' bench at once.
  const candidateClubs = new Set<string>();
  for (const s of career.leagueSquads ?? []) if (s.club !== sellingClub && s.club !== career.player.club) candidateClubs.add(s.club);
  for (const s of career.externalSquads ?? []) if (s.club !== sellingClub && s.club !== career.player.club) candidateClubs.add(s.club);

  const reachBonus = player.worldClassPotential
    ? getTuning("wonderkids.bigClubReachBonus") * getTuning("wonderkids.worldClassMultiplier")
    : player.highPotential ? getTuning("wonderkids.bigClubReachBonus") : 0;

  const results: TransferInterest[] = [];
  for (const club of Array.from(candidateClubs)) {
    const squad = squadOf(career, club);
    const { strength: buyerStrength, real: hasRealStrength } = clubStrengthOf(career, club, squad);
    const overall = player.overall ?? 65;
    if (!hasRealStrength && overall > UNVERIFIED_CLUB_RATING_CAP) continue; // a blind guess can't justify chasing an elite target
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

    // BUG FOUND, 18 Sep 2026: `need` is purely a positional-GAP score — a
    // genuinely elite club almost always already has a great player at every
    // position (that's what makes it elite), so `avgDepth` sits close to or
    // above `buyerStrength` and `need` reads near zero for them specifically.
    // That made it structurally impossible for a top club to EVER show up as
    // interested in even the best player in the game, since the model only
    // ever asked "do you have a hole to fill," never "is this a genuine
    // upgrade over what you already have" — reported directly: selling a
    // 90-rated wonderkid from Barcelona surfaced only mid-table/Europa-tier
    // interest, nothing from Bayern/Liverpool/City/Real Madrid/etc. Real big
    // clubs chase special talents as upgrades regardless of existing depth.
    // A second, independent path into interest: a clear rating upgrade over
    // the buyer's own current best at the position, reusing the exact same
    // margin `roleIntent` below already treats as "obviously walks into the
    // team" — set a little higher here since this is now an INCLUSION gate,
    // not just a labelling one; a modest 2-3 point edge shouldn't override
    // "already has plenty of good cover," but a truly special talent should.
    const upgradeGap = overall - avgDepth;
    const UPGRADE_THRESHOLD = 8;
    const genuineUpgrade = upgradeGap >= UPGRADE_THRESHOLD;
    if (need < 0.12 && !genuineUpgrade) continue; // plenty of good cover there already — not remotely interested

    // A club coming in purely off the upgrade path (not real positional
    // need) still has to be treated as a real, competitive suitor for
    // pricing purposes below — a `need` of near-zero would otherwise price
    // a superclub's genuine interest in a generational talent as an
    // afterthought bid, which isn't realistic: a special player draws a real
    // offer even from a club that isn't desperate.
    const pricingNeed = genuineUpgrade ? Math.max(need, 0.5) : need;

    const roleIntent: RoleIntent = (avgDepth === 0 || upgradeGap >= 6) ? "starter"
      : pricingNeed >= 0.35 ? "squad" : "reserve";

    // A desperate buyer offers close to (or past) market value; indifferent
    // interest well under it — the same "expected offer" spread requested
    // directly (a title side low-balls a squad-filler, a club in genuine
    // need pays close to what he's really worth).
    const fitMultiplier = 0.65 + pricingNeed * 0.7;

    // BUG FOUND, 18 Sep 2026: every interested club offered the exact same
    // amount — market value scaled only by `fitMultiplier` — regardless of
    // how rich or big the buying club actually is. Reported directly: five
    // clubs of wildly different real financial standing all quoted the
    // identical expected offer, equal to full market value, for the same
    // player ("if they were to offer 50 million, that would be an
    // astounding figure for these clubs"). Reuses `realPrestigeFactor`
    // (investments.ts) — the SAME real, per-club (not per-tier) financial/
    // reputation dataset `clubValuation` already prices a whole CLUB with —
    // rather than `clubTier.ts`'s coarser tier multiplier, which can't tell
    // Bayern Munich from Sevilla FC if both happen to sit in the same
    // competition tier this season. `realPrestigeFactor` runs 0.6-3.0;
    // remapped here onto a 0.25-1.10x ceiling on a PLAYER's own expected
    // offer — wide enough that a genuinely rich superclub can approach or
    // slightly clear real market value while a modest club's realistic
    // ceiling sits clearly, visibly lower (real worked numbers: a ~179m
    // valuation reads as ~197m from a top club and ~45m from a modest one —
    // matching the user's own "50 million would be astounding" framing).
    const prestige = realPrestigeFactor(club);
    const wealthFactor = clampUnit((prestige - 0.6) / (3.0 - 0.6)) * 0.85 + 0.25;

    // A small, real per-club variance so two clubs at genuinely different
    // financial standing (or even two at a similar one) don't coincidentally
    // land on the identical offer — reported directly as "a bit odd."
    // `interestedClubs` is otherwise pure with no `rng` parameter of its own
    // (its one real call site, Investments.tsx, doesn't thread one through,
    // and adding one here would be a bigger signature change than this fix
    // needs), so this reuses `clubNameSeed` — the same "stable pseudo-random
    // number keyed off a name" idiom this codebase's engine files already
    // use elsewhere (manager.ts, sponsors.ts, leagueSquads.ts) — keyed off
    // both the buying club AND the seller's own club, so the SAME buyer
    // varies between two different sales rather than always nudging the
    // same fixed direction for that club.
    const variance = 0.92 + (clubNameSeed(`${club}:${sellingClub}`) % 1000) / 1000 * 0.16; // 0.92–1.08

    const expectedOffer = Math.max(
      getTuning("marketValue.floor"),
      Math.round(playerMarketValue({ ...player, overall }, sellingClub, career) * fitMultiplier * wealthFactor * variance),
    );
    results.push({ club, roleIntent, expectedOffer });
  }

  return results.sort((a, b) => b.expectedOffer - a.expectedOffer).slice(0, maxResults);
}
