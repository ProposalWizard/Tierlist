import type { CareerState, SquadPlayer, LeaguePlayer, LeagueSquad, LeagueTeam } from "./types";
import type { Role, Formation } from "./formations";
import { autoPick, bestFitness, type Pickable } from "./formations";
import { formationForClub } from "./teamsheet";
import { shortNameOf } from "./realSquad";
import type { TransferWindow } from "./calendar";

/**
 * THE OTHER NINETEEN DRESSING ROOMS, RESHAPING THEMSELVES.
 *
 * Twenty clubs is a closed system: every signing is somebody else's sale.
 * This runs once at the moment a transfer window opens (see the hook in
 * careerFlow.ts's creditMatchResult, on the week the calendar's
 * transferWindowFor first returns non-null) and decides the whole window's
 * business in one pass — who a club needs, who it can actually attract, and
 * who it is prepared to let go.
 *
 * Three rules carry almost all of the realism, and none of them are a random
 * roll:
 *
 *  1. A club only buys where it has a real gap — thin depth at a position its
 *     own formation actually uses, weighted up for a position several men can
 *     play (a central midfielder) and down for one only one man ever plays
 *     (a full-back) — see `positionNeed`. A club already stacked past a
 *     sensible squad size buys nothing but a genuine upgrade.
 *  2. A club can only ATTRACT a player within reach of its own reputation —
 *     modelled as `LeagueTeam.strength`, which is already a live reading of
 *     the squad's own quality (see leagueSquads.ts). A big club reaches
 *     further down than a small one; nothing reaches far up at all. This is
 *     what makes Fulham's one 84-rated outlier a plausible departure and a
 *     Manchester United starter an implausible arrival for them — see
 *     `reach`.
 *  3. A club's best players are not for sale. A STARTER at a club whose own
 *     strength is near the top of the division only leaves on an
 *     "unhappiness" roll — rare, rarer still outside the summer — everybody
 *     else (bench, reserves, and starters anywhere the club isn't genuinely
 *     among the division's best) is a real, if still unlikely, sale. See
 *     `sellability`.
 *
 * Deliberately NOT here yet, all by request: loan deals, a fixed rivalry
 * no-sell list, and anything outside the twenty Premier League clubs this
 * career actually has data for.
 */

// ── The common shape every club's roster is read as ────────────────────────

interface Candidate {
  id: string;
  name: string;
  shortName: string;
  position: Role;
  positions: Role[];
  overall: number;
  club: string;
  isYou: boolean;
  sofifaId?: string;
  imageUrl?: string;
  nationality?: string;
  age?: number;
  seasonGoals: number;
  seasonAssists: number;
  careerGoals: number;
  careerAssists: number;
}

const ROLES: Role[] = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

function fromSquadPlayer(p: SquadPlayer, club: string): Candidate {
  return {
    id: p.id, name: p.name, shortName: p.shortName || shortNameOf(p.name),
    position: p.position, positions: p.positions?.length ? p.positions : [p.position],
    overall: p.overall ?? 65, club, isYou: true,
    sofifaId: p.sofifaId, imageUrl: p.imageUrl, nationality: p.nationality, age: p.age,
    seasonGoals: p.seasonGoals, seasonAssists: p.seasonAssists,
    careerGoals: p.careerGoals, careerAssists: p.careerAssists,
  };
}

function fromLeaguePlayer(p: LeaguePlayer, club: string): Candidate {
  return {
    id: p.id, name: p.name, shortName: shortNameOf(p.name),
    position: p.position, positions: p.positions?.length ? p.positions : [p.position],
    overall: p.overall, club, isYou: false,
    sofifaId: p.id, imageUrl: p.image, nationality: p.nation,
    seasonGoals: p.goals, seasonAssists: p.assists, careerGoals: 0, careerAssists: 0,
  };
}

function toSquadPlayer(c: Candidate): SquadPlayer {
  return {
    id: c.sofifaId ? `sf_${c.sofifaId}` : c.id,
    name: c.name, shortName: c.shortName, position: c.position, positions: c.positions,
    seasonGoals: c.seasonGoals, seasonAssists: c.seasonAssists,
    careerGoals: c.careerGoals, careerAssists: c.careerAssists,
    sofifaId: c.sofifaId, overall: c.overall, imageUrl: c.imageUrl,
    nationality: c.nationality, age: c.age,
  };
}

function toLeaguePlayer(c: Candidate): LeaguePlayer {
  return {
    id: c.sofifaId ?? c.id, name: c.name, position: c.position, positions: c.positions,
    overall: c.overall, goals: c.seasonGoals, assists: c.seasonAssists,
    ...(c.imageUrl ? { image: c.imageUrl } : {}),
    ...(c.nationality ? { nation: c.nationality } : {}),
  };
}

// ── Reading the division ────────────────────────────────────────────────────

/** Every club's current strength, your own included — averageStartingXIRating's
 *  own top-11-by-rating approximation, applied uniformly so "reputation" means
 *  the same thing on both sides of a deal. */
function clubStrength(club: string, pool: Candidate[]): number {
  const xi = [...pool].sort((a, b) => b.overall - a.overall).slice(0, 11);
  if (!xi.length) return 65;
  return Math.round(xi.reduce((s, p) => s + p.overall, 0) / xi.length);
}

/**
 * How far below a club's own strength it will still reach to sign somebody.
 *
 * A big club can go and get last place's one good player; a struggling one
 * can barely reach its own level. Linear between 6 points of reach at the
 * bottom of the division and 16 at the top — Fulham signs from Fulham's own
 * neighbourhood, Manchester United signs from anywhere.
 */
function reachDown(buyerStrength: number): number {
  const t = clampUnit((buyerStrength - 62) / 24); // ~62 = a relegation-battler, ~86 = a title side
  return 6 + t * 10;
}
/** Nobody signs a project player HOPING he grows into the shirt — a cap on
 *  reaching up, so a mid-table side doesn't land an 85 just because it needed
 *  a striker. */
const REACH_UP = 5;

function clampUnit(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * How many of a club's slots a role fills, in the shape it actually plays.
 *
 * The reason a club wants a third good central midfielder far more than a
 * second great right-back: one formation-worth of a 4-3-3 has three CM slots
 * for a squad to stock and one RB slot, full stop. `bestFitness` finding a
 * player "good enough to deputise" here — a CB who can cover CDM — is
 * deliberately NOT counted as a slot of its own; it is what makes a thin
 * position survivable, not what makes it wanted.
 */
function slotsFor(role: Role, formation: Formation): number {
  return formation.slots.filter(s => s.role === role).length;
}

/**
 * How much a club wants a signing at this role, 0 (not interested) upward.
 *
 * Two things move it: how good his replacement already is (a position with
 * two 85s at it wants nothing, however many slots it has) and how many slots
 * the role actually holds (a thin CM room matters more than a thin RB room,
 * because a CM slot is three chances to use a signing and an RB slot is one).
 * Squad size gates the whole thing — a club already carrying more players
 * than a matchday squad plus real depth needs the signing to be a clear
 * upgrade on its weakest slot-holder before it counts as needed at all.
 */
function positionNeed(role: Role, club: string, pool: Candidate[], formation: Formation, squadSize: number): number {
  const slots = slotsFor(role, formation);
  if (slots === 0) return 0;
  const at = pool
    .map(p => ({ p, fit: bestFitness(role, p as Pickable) }))
    .filter(x => x.fit >= 82)
    .sort((a, b) => b.p.overall - a.p.overall);
  const depth = at.slice(0, slots).map(x => x.p.overall);
  while (depth.length < slots) depth.push(0); // an empty slot is the strongest possible need
  const avgDepth = depth.reduce((s, v) => s + v, 0) / slots;
  const strength = clubStrength(club, pool);
  // How far the current depth sits below what the club would consider its own
  // standard — 0 at "as good as the rest of the side", 1 at "twelve points
  // short or an empty slot".
  const gap = clampUnit((strength - avgDepth) / 12);
  const multiplicity = 0.55 + Math.min(slots, 3) * 0.22; // one slot: 0.77, three: 1.21
  // A squad well past a sensible size only wants a slot it is genuinely short
  // in — everything else is a bench place it does not need to fill.
  const sizeBrake = squadSize > 26 ? clampUnit((32 - squadSize) / 6) : 1;
  return gap * multiplicity * sizeBrake;
}

// ── Who is actually for sale ────────────────────────────────────────────────

interface Listed { candidate: Candidate; unhappy: boolean }

/**
 * Whether he is even in the conversation this window — not whether he moves,
 * only whether an offer for him would be entertained at all.
 *
 * A bench or reserve player at anyone's club: yes, most of the time. A
 * starter: only if his own club is not one of the division's best sides, or
 * — the "unhappy, or a bigger club comes calling" case, which for a league
 * this size mostly means the first half of that sentence — he rolls
 * unhappy. Unhappiness itself is rarer in January, matching how little
 * business actually happens then outside exactly that situation.
 */
function sellability(
  c: Candidate, isStarter: boolean, ownStrength: number, leagueTopStrength: number,
  window: TransferWindow, rng: () => number,
): Listed | null {
  const isEliteClub = ownStrength >= leagueTopStrength - 4;
  if (isStarter && isEliteClub) {
    const unhappyOdds = window === "summer" ? 0.05 : 0.015;
    return rng() < unhappyOdds ? { candidate: c, unhappy: true } : null;
  }
  const baseOdds = isStarter ? 0.10 : 0.16;
  const odds = window === "summer" ? baseOdds : baseOdds * 0.35;
  return rng() < odds ? { candidate: c, unhappy: false } : null;
}

// ── The window itself ───────────────────────────────────────────────────────

export interface TransferMove {
  player: string;
  from: string;
  to: string;
  overall: number;
  fee: number;
  /** He asked for the move rather than being sold on. Rare — see sellability. */
  unhappy: boolean;
}

/** A price with no budget behind it — cosmetic, off the rating alone, the
 *  same shape real fees roughly follow without pretending to model a market. */
function feeFor(overall: number): number {
  const m = Math.max(0, overall - 60);
  return Math.round((0.3 + m * m * 0.045) * 10) / 10; // £m, one decimal
}

/**
 * Roughly how many total moves the whole division makes this window.
 *
 * "In real life it might be three in, three out. In the game I want that to
 * be one point five in, one point five out" — half real life's rate, and
 * January much quieter again, because most players are not unhappy enough to
 * leave mid-season. Total moves = total arrivals = total departures, since
 * every deal inside a closed twenty-club system is both at once.
 */
function windowBudget(window: TransferWindow, clubCount: number): number {
  return Math.round(clubCount * (window === "summer" ? 1.5 : 0.35));
}

export function runTransferWindow(
  career: CareerState, window: TransferWindow, rng: () => number,
): { career: CareerState; moves: TransferMove[] } {
  if (!window || !career.leagueSquads?.length) return { career, moves: [] };

  const you = career.player.club;
  const pools = new Map<string, Candidate[]>();
  pools.set(you, career.squad.map(p => fromSquadPlayer(p, you)));
  for (const sq of career.leagueSquads) {
    pools.set(sq.club, sq.players.map(p => fromLeaguePlayer(p, sq.club)));
  }
  const clubs = Array.from(pools.keys());
  const strengths = new Map(clubs.map(c => [c, clubStrength(c, pools.get(c)!)]));
  const topStrength = Math.max(...Array.from(strengths.values()));

  // ── Who is listed ──
  const listed: Listed[] = [];
  for (const club of clubs) {
    const pool = pools.get(club)!;
    const formation = formationForClub(club);
    const xi = new Set(autoPick(pool as Pickable[], formation).filter((id): id is string => !!id));
    for (const c of pool) {
      const l = sellability(c, xi.has(c.id), strengths.get(club)!, topStrength, window, rng);
      if (l) listed.push(l);
    }
  }

  // ── Match each listing to the best-fitting buyer ──
  interface Candidate_ { move: TransferMove; score: number; from: string; to: string; playerId: string }
  const proposals: Candidate_[] = [];
  for (const { candidate: seller, unhappy } of listed) {
    let bestClub: string | null = null, bestScore = -Infinity;
    for (const club of clubs) {
      if (club === seller.club) continue;
      const buyerStrength = strengths.get(club)!;
      const gap = buyerStrength - seller.overall;
      if (gap < -reachDown(buyerStrength) || gap > REACH_UP) continue;
      const pool = pools.get(club)!;
      const formation = formationForClub(club);
      const need = Math.max(
        ...seller.positions.map(r => positionNeed(r, club, pool, formation, pool.length)),
      );
      if (need <= 0.12) continue;
      const score = need * 10 - Math.abs(gap) * 0.15 + rng() * 0.6;
      if (score > bestScore) { bestScore = score; bestClub = club; }
    }
    if (!bestClub) continue;
    proposals.push({
      move: {
        player: seller.name, from: seller.club, to: bestClub,
        overall: seller.overall, fee: feeFor(seller.overall), unhappy,
      },
      score: bestScore, from: seller.club, to: bestClub, playerId: seller.id,
    });
  }

  // ── Apply the best proposals up to the window's own volume ──
  proposals.sort((a, b) => b.score - a.score);
  const budget = windowBudget(window, clubs.length);
  const moves: TransferMove[] = [];
  const moved = new Set<string>();
  for (const p of proposals) {
    if (moves.length >= budget) break;
    if (moved.has(p.playerId)) continue;
    const fromPool = pools.get(p.from)!;
    const idx = fromPool.findIndex(c => c.id === p.playerId);
    if (idx < 0) continue;
    const [player] = fromPool.splice(idx, 1);
    player.club = p.to;
    pools.get(p.to)!.push(player);
    // A move changes both ends' standing, so later proposals in the same
    // pass read the club they just strengthened or thinned correctly.
    strengths.set(p.from, clubStrength(p.from, fromPool));
    strengths.set(p.to, clubStrength(p.to, pools.get(p.to)!));
    moved.add(p.playerId);
    moves.push(p.move);
  }

  if (!moves.length) return { career, moves: [] };

  const nextSquad = pools.get(you)!.map(toSquadPlayer);
  const nextLeagueSquads: LeagueSquad[] = career.leagueSquads.map(sq => ({
    club: sq.club, players: pools.get(sq.club)!.map(toLeaguePlayer),
  }));
  const nextLeague: LeagueTeam[] = career.league.map(t => {
    const s = strengths.get(t.name);
    return s === undefined ? t : { ...t, strength: s };
  });

  return {
    career: { ...career, squad: nextSquad, leagueSquads: nextLeagueSquads, league: nextLeague },
    moves,
  };
}
