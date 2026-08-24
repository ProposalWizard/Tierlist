import type { CareerState, SquadPlayer, LeaguePlayer, LeagueSquad, LeagueTeam } from "./types";
import type { Role, Formation } from "./formations";
import { autoPick, bestFitness, type Pickable } from "./formations";
import { formationForClub } from "./teamsheet";
import { shortNameOf } from "./realSquad";
import type { TransferWindow } from "./calendar";
import { isDerby, strongestTier } from "./rivalries";
import { FREE_AGENTS_CLUB } from "./leagueSquads";

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
 * Deliberately NOT here yet: anything outside the clubs this career actually
 * has data for. A rivalry no-sell rule IS here — see `rivalrySellChance` —
 * reading real per-club data (lib/star/rivalries.ts) rather than a fixed
 * list: a primary rivalry blocks a deal almost outright, a lesser one only
 * dampens it, and a player forcing his own exit (`unhappy`) is a real, if
 * still uncommon, exception to all of it — a transfer request does not stop
 * at a shirt colour in real football either. It applies equally to loans.
 *
 * ── Loans ──
 *
 * The same closed system, the same candidate pools, the same rivalry gate —
 * a loan is not a separate market, it is the other thing that can happen to
 * a player a club is willing to let go of for a window. Three differences
 * from a permanent sale, and nothing else: `loanOrSale` decides which one a
 * listing becomes (never a loan for an unhappy elite starter leaving for
 * good — see there for why), a loan reaches further down the strength scale
 * than a permanent sale would (a big club loans a squad player out further
 * than it would ever sell him that cheap), and there is no fee. What makes
 * a loan a LOAN rather than a sale with a return date typed in by hand: it
 * is tracked on `CareerState.activeLoans` and comes home automatically at
 * the season's end (`returnLoansHome`, called once from careerFlow.ts's
 * `advanceSeason`, before that season's squads are otherwise touched) —
 * never mid-season, no recall clause, no loan-to-buy conversion, and never
 * exactly the season it was signed for, deliberately not any shorter or
 * longer. A player currently out on loan is excluded from BOTH kinds of
 * listing at his temporary club for as long as he is there — the club
 * fielding him does not own him and cannot sell or loan him on.
 *
 * ── Free agents ──
 *
 * `CareerState.freeAgents` (fetched via lib/star/leagueSquads.ts's
 * fetchFreeAgents) are real players with no club at all — admin marks one
 * this way by typing "free" or "Free" as his club, a free-text field, not a
 * picker. Reported directly: these are not background noise, they are
 * signable, and they are desperate — a released player takes whatever club
 * will actually play him, not only one at his own level. Modelled as one
 * more pool a club can sign FROM, alongside the twenty/twenty-four real
 * ones, with three deliberate differences from a normal sale: nobody has to
 * roll to list him (he is always available, every window, until somebody
 * takes him), there is no rivalry check (no selling club has any say in
 * where he goes), and he accepts a buying club considerably further below
 * his own level than a contracted man's own club would ever let him leave
 * for that cheap — see `FREE_AGENT_REACH_MULT`. Never a loan: a free agent
 * signs, permanently, for nothing (`fee: 0` — that IS what "free agent"
 * means), or he does not move at all this window.
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

/**
 * The one identifier for a player that survives crossing between the two
 * representations this file juggles — a real player's `Candidate.id` is
 * `sf_<sofifaId>` on the SquadPlayer side (fromSquadPlayer) but the bare
 * `<sofifaId>` on the LeaguePlayer side (fromLeaguePlayer): the SAME man,
 * two different id strings, depending only on which club currently has him.
 * `sofifaId` itself is set consistently on both sides, so anything that has
 * to still recognise a player after he has moved between sides — loans,
 * specifically, since a LoanMove is read back a whole season later against
 * freshly rebuilt pools — must key off THIS, never off `Candidate.id`
 * directly.
 */
function stableKey(c: Candidate): string {
  return c.sofifaId ?? c.id;
}

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
    sofifaId: p.id, imageUrl: p.image, nationality: p.nation, age: p.age,
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
    ...(c.age ? { age: c.age } : {}),
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

/** A released player drops further below his own level than a loan does —
 *  he has no club at all to hold out for a better offer from. See the file
 *  header's "Free agents" section. */
const FREE_AGENT_REACH_MULT = 2;

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

interface Listed { candidate: Candidate; unhappy: boolean; loan: boolean }

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
): Omit<Listed, "loan"> | null {
  const isEliteClub = ownStrength >= leagueTopStrength - 4;
  if (isStarter && isEliteClub) {
    const unhappyOdds = window === "summer" ? 0.05 : 0.015;
    return rng() < unhappyOdds ? { candidate: c, unhappy: true } : null;
  }
  const baseOdds = isStarter ? 0.10 : 0.16;
  const odds = window === "summer" ? baseOdds : baseOdds * 0.35;
  return rng() < odds ? { candidate: c, unhappy: false } : null;
}

/**
 * Loan, not sale — the ordinary way a squad player gets minutes somewhere
 * else without his club giving him up for good.
 *
 * Never for an unhappy departure: a player unsettled enough to leave a good
 * club leaves for good, not for a season. Everywhere else — the ordinary
 * bench-and-reserve listing most windows produce — a loan is genuinely the
 * MORE likely outcome in real football, not the exception: permanently
 * selling a squad player is the bigger, rarer decision. Age moves it
 * further where it is known — a teenager is what loans are FOR, an ageing
 * squad player being let go is usually let go for good. `Candidate.age`
 * reaches here from `sofifa_players.age` for every real player now, own
 * squad or not (see fromLeaguePlayer / app/api/star/league-squads) — the
 * "unknown" baseline below still matters for a generated/fallback squad,
 * which has no real DB row to read an age from at all, so it sits between
 * the two known cases rather than guessing either way.
 */
function loanOrSale(c: Candidate, unhappy: boolean, rng: () => number): boolean {
  if (unhappy) return false;
  const age = c.age;
  const chance = age === undefined ? 0.45 : age < 23 ? 0.68 : age < 29 ? 0.3 : 0.12;
  return rng() < chance;
}

// ── Rivals do not sell to rivals ────────────────────────────────────────────

/**
 * How likely a club is to even entertain selling to THIS particular buyer,
 * given what the two clubs are to each other. 1 for no rivalry at all — the
 * ordinary case, unaffected.
 *
 * A primary rivalry (R1) is close to a hard no: a club selling its player
 * straight to its biggest rival happens in real football about as often as
 * this number suggests, essentially never outside a player forcing it
 * himself. A lesser rivalry or a plain geographical derby with no rated
 * history dampens the odds without pretending it never happens — smaller
 * clubs sell to a local derby rival more often than the big primary
 * rivalries ever do.
 */
export function rivalrySellChance(sellerClub: string, buyerClub: string, unhappy: boolean): number {
  const tier = strongestTier(sellerClub, buyerClub);
  const derby = isDerby(sellerClub, buyerClub);
  if (!tier && !derby) return 1;
  const base = tier === "R1" ? 0.03 : tier === "R2" ? 0.15 : tier === "R3" ? 0.4 : 0.5; // derby-only, no tier
  // An unhappy player forcing his own move is a real exception, not a full
  // waiver — he still has to actually get the rival to want him.
  return unhappy ? Math.min(1, base * 3.2) : base;
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

export interface LoanMove {
  player: string;
  /** The same id every Candidate carries within this file — stable enough
   *  within one save to find him again at `returnLoansHome` time. */
  playerId: string;
  /** Who actually owns him, and where he comes back to. */
  parentClub: string;
  /** Where he is actually playing this season. */
  loanClub: string;
  overall: number;
  /** The season this loan is due home — always the season it was made in;
   *  see the file header for what that deliberately does not cover. */
  returnSeason: number;
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
): { career: CareerState; moves: TransferMove[]; loans: LoanMove[] } {
  if (!window || !career.leagueSquads?.length) return { career, moves: [], loans: [] };

  const you = career.player.club;
  const pools = new Map<string, Candidate[]>();
  pools.set(you, career.squad.map(p => fromSquadPlayer(p, you)));
  for (const sq of career.leagueSquads) {
    // leagueSquads is fetched for the whole division, your own club
    // included — career.squad is the up-to-date, richer source for that one
    // (age, sofifaId, real current overall), so it must not be clobbered by
    // the thinner LeaguePlayer snapshot sitting alongside it.
    if (sq.club === you) continue;
    pools.set(sq.club, sq.players.map(p => fromLeaguePlayer(p, sq.club)));
  }
  const clubs = Array.from(pools.keys());
  const strengths = new Map(clubs.map(c => [c, clubStrength(c, pools.get(c)!)]));
  const topStrength = Math.max(...Array.from(strengths.values()));

  // A club fielding somebody else's loanee does not own him and cannot deal
  // him on, to anybody, for any reason, until his loan is up.
  const onLoanElsewhere = new Set((career.activeLoans ?? []).map(l => l.playerId));

  // Real players, no club — see the file header's "Free agents" section.
  // Deliberately NOT one of `pools`/`clubs`: it is not a football club, has
  // no formation and nobody may buy FROM it, only sign out of it.
  const freeAgentPool: Candidate[] = (career.freeAgents ?? [])
    .map(p => fromLeaguePlayer(p, FREE_AGENTS_CLUB));

  // ── Who is listed ──
  const listed: Listed[] = [];
  for (const club of clubs) {
    const pool = pools.get(club)!;
    const formation = formationForClub(club);
    const xi = new Set(autoPick(pool as Pickable[], formation).filter((id): id is string => !!id));
    for (const c of pool) {
      if (onLoanElsewhere.has(stableKey(c))) continue;
      const l = sellability(c, xi.has(c.id), strengths.get(club)!, topStrength, window, rng);
      if (l) listed.push({ ...l, loan: loanOrSale(l.candidate, l.unhappy, rng) });
    }
  }

  // ── Match each listing to the best-fitting buyer ──
  interface Proposal {
    loan: boolean;
    saleMove?: TransferMove;
    loanMove?: LoanMove;
    score: number; from: string; to: string; playerId: string;
  }
  const proposals: Proposal[] = [];
  for (const { candidate: seller, unhappy, loan } of listed) {
    let bestClub: string | null = null, bestScore = -Infinity;
    for (const club of clubs) {
      if (club === seller.club) continue;
      if (rng() > rivalrySellChance(seller.club, club, unhappy)) continue;
      const buyerStrength = strengths.get(club)!;
      const gap = buyerStrength - seller.overall;
      // A loan reaches further down than a permanent sale would — a big
      // club sends a squad player out on loan somewhere it would never
      // actually SELL him that cheap.
      const reach = loan ? reachDown(buyerStrength) * 1.4 : reachDown(buyerStrength);
      if (gap < -reach || gap > REACH_UP) continue;
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
    if (loan) {
      proposals.push({
        loan: true,
        loanMove: {
          // The stable cross-representation key — see stableKey — since this
          // is read back next season against pools rebuilt from scratch,
          // possibly on the other side of the SquadPlayer/LeaguePlayer
          // divide from where he was sitting when this was written.
          player: seller.name, playerId: stableKey(seller), parentClub: seller.club, loanClub: bestClub,
          overall: seller.overall, returnSeason: career.season,
        },
        score: bestScore, from: seller.club, to: bestClub, playerId: seller.id,
      });
    } else {
      proposals.push({
        loan: false,
        saleMove: {
          player: seller.name, from: seller.club, to: bestClub,
          overall: seller.overall, fee: feeFor(seller.overall), unhappy,
        },
        score: bestScore, from: seller.club, to: bestClub, playerId: seller.id,
      });
    }
  }

  // ── Free agents match the same way, minus the parts that need a seller ──
  //
  // Always "listed" (nobody rolls to decide he is available — he already
  // is), no rivalry check (no club is refusing to strengthen a rival, since
  // no club owns him), and a wider reach downward: see
  // FREE_AGENT_REACH_MULT and the file header.
  for (const fa of freeAgentPool) {
    let bestClub: string | null = null, bestScore = -Infinity;
    for (const club of clubs) {
      const buyerStrength = strengths.get(club)!;
      const gap = buyerStrength - fa.overall;
      const reach = reachDown(buyerStrength) * FREE_AGENT_REACH_MULT;
      if (gap < -reach || gap > REACH_UP) continue;
      const pool = pools.get(club)!;
      const formation = formationForClub(club);
      const need = Math.max(
        ...fa.positions.map(r => positionNeed(r, club, pool, formation, pool.length)),
      );
      if (need <= 0.12) continue;
      const score = need * 10 - Math.abs(gap) * 0.15 + rng() * 0.6;
      if (score > bestScore) { bestScore = score; bestClub = club; }
    }
    if (!bestClub) continue;
    proposals.push({
      loan: false,
      saleMove: {
        // A signing, not a purchase — free is what "free agent" means.
        player: fa.name, from: FREE_AGENTS_CLUB, to: bestClub, overall: fa.overall, fee: 0, unhappy: false,
      },
      score: bestScore, from: FREE_AGENTS_CLUB, to: bestClub, playerId: fa.id,
    });
  }

  // ── Apply the best proposals up to the window's own volume ──
  //
  // Loans and sales share one budget and one dedup set — a player does
  // exactly one thing this window, whichever proposal for him scored
  // higher, not one of each.
  proposals.sort((a, b) => b.score - a.score);
  // Free-agent signings get their own small allowance on TOP of the
  // division's usual business, not carved out of it — they are arrivals
  // from outside the closed system, with no corresponding departure, so
  // counting them against the same budget would mean a quiet window for
  // signings is also a quiet window for the free agents actually reported
  // as wanting one. Capped, and small, because most windows do not have
  // many free agents worth signing at all.
  const freeAgentBudget = Math.min(freeAgentPool.length, window === "summer" ? 5 : 2);
  const budget = windowBudget(window, clubs.length) + freeAgentBudget;
  const moves: TransferMove[] = [];
  const loans: LoanMove[] = [];
  const moved = new Set<string>();
  for (const p of proposals) {
    if (moves.length + loans.length >= budget) break;
    if (moved.has(p.playerId)) continue;
    const fromPool = p.from === FREE_AGENTS_CLUB ? freeAgentPool : pools.get(p.from)!;
    const idx = fromPool.findIndex(c => c.id === p.playerId);
    if (idx < 0) continue;
    const [player] = fromPool.splice(idx, 1);
    player.club = p.to;
    pools.get(p.to)!.push(player);
    // A move changes both ends' standing, so later proposals in the same
    // pass read the club they just strengthened or thinned correctly. Free
    // Agents itself has no "strength" to update — it is not a club.
    if (p.from !== FREE_AGENTS_CLUB) strengths.set(p.from, clubStrength(p.from, fromPool));
    strengths.set(p.to, clubStrength(p.to, pools.get(p.to)!));
    moved.add(p.playerId);
    if (p.loan) loans.push(p.loanMove!); else moves.push(p.saleMove!);
  }

  if (!moves.length && !loans.length) return { career, moves: [], loans: [] };

  const nextSquad = pools.get(you)!.map(toSquadPlayer);
  const nextLeagueSquads: LeagueSquad[] = career.leagueSquads.map(sq => ({
    club: sq.club, players: pools.get(sq.club)!.map(toLeaguePlayer),
  }));
  const nextLeague: LeagueTeam[] = career.league.map(t => {
    const s = strengths.get(t.name);
    return s === undefined ? t : { ...t, strength: s };
  });
  const nextFreeAgents = freeAgentPool.map(toLeaguePlayer);

  return {
    career: {
      ...career, squad: nextSquad, leagueSquads: nextLeagueSquads, league: nextLeague,
      activeLoans: loans.length ? [...(career.activeLoans ?? []), ...loans] : career.activeLoans,
      freeAgents: nextFreeAgents,
    },
    moves, loans,
  };
}

/**
 * Bring everybody due home.
 *
 * Called once at season rollover (careerFlow.ts's `advanceSeason`, before
 * that season's squads are otherwise touched), so the man who spent this
 * season out on loan is back on the club that actually owns him by the time
 * next season's squads are built. "Due" simply means the season the loan
 * covered has ended — see the file header for what deliberately is not
 * modelled here (an early recall, a loan-to-buy conversion, a loan that runs
 * shorter or longer than exactly one season).
 */
export function returnLoansHome(career: CareerState): CareerState {
  const active = career.activeLoans ?? [];
  const due = active.filter(l => l.returnSeason <= career.season);
  if (!due.length) return career;
  const remaining = active.filter(l => l.returnSeason > career.season);

  const you = career.player.club;
  const pools = new Map<string, Candidate[]>();
  pools.set(you, career.squad.map(p => fromSquadPlayer(p, you)));
  for (const sq of career.leagueSquads ?? []) {
    if (sq.club === you) continue;
    pools.set(sq.club, sq.players.map(p => fromLeaguePlayer(p, sq.club)));
  }

  for (const loan of due) {
    const fromPool = pools.get(loan.loanClub);
    const toPool = pools.get(loan.parentClub);
    // His parent club may no longer be one this career tracks at all (a
    // pool club since drawn out of the Championship picture, say) — nothing
    // to bring him home TO, so he simply stays wherever he already is.
    if (!fromPool || !toPool) continue;
    const idx = fromPool.findIndex(c => stableKey(c) === loan.playerId);
    if (idx < 0) continue; // he has left that club some other way since — nothing to recall
    const [player] = fromPool.splice(idx, 1);
    player.club = loan.parentClub;
    toPool.push(player);
  }

  const nextSquad = pools.get(you)?.map(toSquadPlayer) ?? career.squad;
  const nextLeagueSquads: LeagueSquad[] = (career.leagueSquads ?? []).map(sq => ({
    club: sq.club, players: (pools.get(sq.club) ?? sq.players.map(p => fromLeaguePlayer(p, sq.club))).map(toLeaguePlayer),
  }));

  return { ...career, squad: nextSquad, leagueSquads: nextLeagueSquads, activeLoans: remaining };
}
