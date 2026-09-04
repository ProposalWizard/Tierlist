import type { CareerState, SquadPlayer, LeaguePlayer, LeagueSquad, LeagueTeam } from "./types";
import type { Role, Formation } from "./formations";
import { autoPick, bestFitness, type Pickable } from "./formations";
import { formationForClub } from "./teamsheet";
import { shortNameOf } from "./realSquad";
import type { TransferWindow } from "./calendar";
import { isDerby, strongestTier } from "./rivalries";
import { FREE_AGENTS_CLUB } from "./leagueSquads";
import { getTuning } from "./tuningStore";

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
 *
 * ── On realism, for whoever tunes this next ──
 *
 * Checked directly against a long real-world description of how transfer
 * windows actually work, supplied specifically so future tuning has it
 * without needing the whole thing re-explained. Condensed to what is
 * actually actionable here — the full description covered a lot this game
 * has no model for at all (see "deliberately not modelled" below).
 *
 * What it confirmed this file already does right: transfers here are
 * already meant to be NEED-driven, not opportunity-driven — a club only
 * buys where `positionNeed` finds a real gap, a full squad barely sells at
 * all (`sellability`'s squad-size gate), and a free agent is evaluated
 * against that same need rather than signed just because he is cheap and
 * available. `windowBudget`'s own docs already target "half real life's
 * rate" — the total volume was never the problem.
 *
 * What it caught that WAS wrong, and is now fixed: nothing capped how many
 * signings a single club could win in one window's matching pass, because
 * every listed player independently asks "who is my best-fitting buyer"
 * against the same starting snapshot — so a club that drew a few weak
 * positions could win that question for many unrelated sellers in a row.
 * See `maxSigningsFor`. Real football does not let one club absorb a large
 * share of a whole division's window regardless of how thin its squad is.
 *
 * Deliberately NOT modelled, because the game has nothing to model it
 * WITH — not oversights, just the honest edge of what exists right now:
 *   - injuries (no injury system exists anywhere in this game yet)
 *   - real club finances (`feeFor` is cosmetic, off overall alone — no
 *     club has a "budget" a fee is ever checked against)
 *   - potential distinct from overall (no squad player, generated or real,
 *     carries a potential rating apart from his current one)
 *   - contract length/expiry (tracked for the human player only, via
 *     `CareerState.contract` — nobody else in the division has one)
 *   - a persistent "transfer-listed, waiting for the right offer" state —
 *     `sellability` decides listed-and-matched in one pass; a listing that
 *     finds no buyer this window simply did not happen, it is not carried
 *     forward as still-available next window
 *   - fees shaped by demand/desirability/contract urgency rather than a
 *     flat curve off overall alone
 * If any of these get built for their own reason later, this file would be
 * the natural place to plug them into `sellability`/`positionNeed`/`feeFor`
 * — not a reason to add them here first.
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
  /**
   * The league-only subset of this season, carried through untouched.
   *
   * `runTransferWindow` rebuilds the human's ENTIRE squad every time it runs —
   * everyone goes out through `fromSquadPlayer` and back in through
   * `toSquadPlayer`, whether he moved or not — so anything `SquadPlayer` holds
   * that this shape does not is silently dropped in passing. These two were,
   * and they are what the Golden Boot and Assist King charts actually read
   * (recognition.ts); without them those fall back to `?? seasonGoals`, which
   * includes cup goals, so a January window quietly inflated every one of your
   * own team-mates' tallies mid-season. Absent on a LeaguePlayer, which has no
   * league/cup split of its own — see `fromLeaguePlayer`.
   */
  leagueGoals?: number;
  leagueAssists?: number;
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
    leagueGoals: p.leagueGoals, leagueAssists: p.leagueAssists,
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
    // Only written when the man actually has them: a signing arriving from
    // another club is a LeaguePlayer, which keeps no league/cup split, and
    // inventing a zero for him would put a brand-new arrival on the Golden
    // Boot chart at nought league goals rather than leaving him off it until
    // he scores one. `undefined` is the honest "not tracked for him yet".
    ...(c.leagueGoals !== undefined ? { leagueGoals: c.leagueGoals } : {}),
    ...(c.leagueAssists !== undefined ? { leagueAssists: c.leagueAssists } : {}),
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

/** Eleven starters, nine substitutes — the squad size both `sellability` and
 *  `positionNeed` treat as "full", the same target the Lineups picker and
 *  buildLeagueSquad's own POSITION_ORDER already assume. */
const SQUAD_TARGET = getTuning("transfers.squadTarget");

/**
 * Eleven starters plus at least four in reserve — the absolute floor a sale
 * can take a club to, full stop, no roll of the dice involved.
 *
 * `sellability`'s own "unhappy departure" odds below (5%/1.5% a window) were
 * already meant to make a thin squad an unlikely one to sell FROM, but
 * "unlikely" is not "impossible": over a career-length run of transfer
 * windows a club can still random-walk past it, and nothing here ever
 * bought a departed player's replacement in for them (`pool.splice` in the
 * actual sale, further down, has no matching `pool.push`). Reported
 * directly: a real league match kicking off with an opponent fielding only
 * ten men, because their one recognised specialist at a position had been
 * sold with nobody realistic left to reach for. `matchdayFor`
 * (teamsheet.ts) now has its own last-resort widening for a squad already
 * this thin, but the actual fix is not selling a club down this far in the
 * first place.
 */
const MIN_SQUAD_SIZE = getTuning("transfers.minSquadSize");

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
 * Squad size gates the whole thing on both sides — a club already carrying
 * more players than a matchday squad plus real depth needs the signing to be
 * a clear upgrade on its weakest slot-holder before it counts as needed at
 * all, and a club that CANNOT field a matchday squad plus a full bench off
 * its own current numbers (eleven starters, nine substitutes — twenty,
 * `SQUAD_TARGET`) wants almost anything plausible, considerably more than
 * its actual per-position gaps alone would suggest.
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
  // in; a squad that cannot even field itself wants bodies well beyond what
  // its per-position gaps say — nineteen is "usually go and get someone",
  // fifteen is considerably more than that. Not a guarantee either way: this
  // still has to clear the `need <= 0.12` gate and win the buyer comparison
  // like any other signing, the same as a real thin club doing real business
  // rather than panic-buying the moment it dips below twenty.
  const squadSizeFactor = squadSize < SQUAD_TARGET ? 1 + (SQUAD_TARGET - squadSize) * 0.15
    : squadSize > 26 ? clampUnit((32 - squadSize) / 6)
    : 1;
  return gap * multiplicity * squadSizeFactor;
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
 *
 * The same "essentially only an unhappy departure" gate also covers a club
 * carrying twenty players or fewer — not because they are good, but because
 * eleven starters and nine substitutes is the whole squad already. Selling
 * ANYONE from it, starter or bench, means turning out short-handed until a
 * replacement is found, which a real club does not do over an ordinary
 * squad-depth transfer; it does it because a player forced the issue. See
 * `positionNeed`'s own squad-size handling for the other half of this — the
 * club that DOES end up short a player next reads as needing one considerably
 * more than its bare per-position gap would say.
 */
function sellability(
  c: Candidate, isStarter: boolean, ownStrength: number, leagueTopStrength: number,
  window: TransferWindow, rng: () => number, squadSize: number,
): Omit<Listed, "loan"> | null {
  if (squadSize <= MIN_SQUAD_SIZE) return null;
  const isEliteClub = ownStrength >= leagueTopStrength - 4;
  if (squadSize <= SQUAD_TARGET || (isStarter && isEliteClub)) {
    const unhappyOdds = window === "summer" ? getTuning("transfers.summerUnhappyOdds") : getTuning("transfers.januaryUnhappyOdds");
    return rng() < unhappyOdds ? { candidate: c, unhappy: true } : null;
  }
  const baseOdds = isStarter ? getTuning("transfers.starterListingOdds") : getTuning("transfers.benchListingOdds");
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
  return Math.round((getTuning("transfers.feeBase") + m * m * getTuning("transfers.feeQuadratic")) * 10) / 10; // £m, one decimal
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

/**
 * How many incoming players ONE club may take in this window — sales, loans
 * and free agents combined, whichever the source.
 *
 * Reported directly, with real numbers: on a brand-new career's very first
 * window, one club took 17 of that window's 32 total moves — more than half
 * the ENTIRE division's business. Every club starts a save at an identical
 * twenty players, so this had nothing to do with squad size; it was the
 * matching loop itself. Each listed player independently asks "who is my
 * single best-fitting buyer", reading the SAME unchanged pool/strength
 * snapshot every other listed player that window also reads — so a club
 * that happens to have drawn several weak positions (`generateSquad` is
 * random per club) looks like the best answer to that question over and
 * over, for completely different sellers, and nothing before this ever
 * stopped it winning all of them. A real club cannot physically scout,
 * negotiate and integrate that many signings in one window regardless of
 * how thin its squad is — see the real-world description this was checked
 * against, in the file header's "On realism" section.
 *
 * A genuinely short-handed club (see `positionNeed`'s own squad-size
 * handling) is still allowed more business than a full one — that part of
 * the report was real too, just not the cause of THIS number — but even
 * the most depleted squad has a ceiling. Computed once, from the club's
 * size at the START of the window: squad size changes AS this window's
 * moves apply, and a cap that moved with it would let a club that started
 * full but sold heavily earlier in the same pass buy its way back past its
 * own limit before the window is even over.
 */
function maxSigningsFor(startingSquadSize: number, window: TransferWindow): number {
  const short = Math.max(0, SQUAD_TARGET - startingSquadSize);
  if (window === "summer") return Math.min(3 + Math.ceil(short / 2.5), 6);
  return Math.min(1 + Math.ceil(short / 4), 3);
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
      const l = sellability(c, xi.has(c.id), strengths.get(club)!, topStrength, window, rng, pool.length);
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
  //
  // Reported directly, with a real example ("Bernardo Clark" aside — see
  // buildLeagueSquad's own fix — this was about the volume itself): free
  // agents were a third of all division business, not the rare pickup a
  // real window has. This number never actually capped that — it only
  // widened the SHARED ceiling below by a few slots; nothing stopped the
  // apply loop taking far more than this many free-agent proposals off the
  // sorted list, and a real listing has to clear a rivalry check and a
  // narrower reach to find a buyer at all while a free agent has neither
  // gate (see FREE_AGENT_REACH_MULT) — so free-agent proposals are both
  // more numerous AND score competitively, and kept winning slots the
  // shared budget was never actually enforcing against them specifically.
  // Measured directly: free agents were 35.7% of all business across 100
  // simulated summer windows. Now enforced as a REAL per-window cap in the
  // apply loop below, not just a bigger shared number — see freeAgentsSoFar.
  const freeAgentBudget = Math.min(freeAgentPool.length, window === "summer" ? 2 : 1);
  const budget = windowBudget(window, clubs.length) + freeAgentBudget;
  // Each club's own ceiling, fixed at the size it actually started this
  // window — see maxSigningsFor.
  const signingCap = new Map(clubs.map(c => [c, maxSigningsFor(pools.get(c)!.length, window)]));
  const signingsSoFar = new Map<string, number>();
  const moves: TransferMove[] = [];
  const loans: LoanMove[] = [];
  const moved = new Set<string>();
  let freeAgentsSoFar = 0;
  for (const p of proposals) {
    if (moves.length + loans.length >= budget) break;
    if (moved.has(p.playerId)) continue;
    // The free-agent allowance, actually enforced — see freeAgentBudget's
    // own comment above for why the shared ceiling alone was not doing
    // this. A free-agent proposal beyond it is skipped, same as any other
    // blocked proposal below: it simply does not happen this window.
    if (p.from === FREE_AGENTS_CLUB && freeAgentsSoFar >= freeAgentBudget) continue;
    // A proposal blocked here is a transfer that simply does not happen
    // this window, same as real business falling through — not
    // reattempted at the next-best club, which this pass never computed.
    const cap = signingCap.get(p.to);
    if (cap !== undefined && (signingsSoFar.get(p.to) ?? 0) >= cap) continue;
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
    signingsSoFar.set(p.to, (signingsSoFar.get(p.to) ?? 0) + 1);
    if (p.from === FREE_AGENTS_CLUB) freeAgentsSoFar++;
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

// ── The wider world ──────────────────────────────────────────────────────────
//
// Requested directly: "I noticed there is only transfer activity within the
// Premier League and free agents... can you open it up to all of the other
// clubs we have available so that we might see a big Premier League [club]
// sign a big player from Real Madrid or Barcelona." Confirmed true — the
// closed-system engine above only ever knows about the twenty clubs of the
// player's own division; every European giant this game has real data for
// (career.externalSquads — Champions League/Europa League/Other, see
// lib/star/clubs.ts) sat there unused by anything.
//
// Deliberately a SEPARATE pass from runTransferWindow above rather than
// folding sixty extra clubs into its own matching loop: that engine is tuned
// and tested for a twenty-club division where every signing is somebody
// else's sale, and a marquee move crossing into it is meant to be the rare
// exception a whole division's business is not built around — "you MIGHT
// see" one, not routine cross-continental trading every window. So this
// keeps its own small budget (at most one or two deals, and most windows
// have none at all) and reuses the SAME tuned building blocks — clubStrength,
// reachDown/REACH_UP, positionNeed, sellability, rivalrySellChance, feeFor —
// rather than inventing separate rules a big club buying abroad would somehow
// follow differently from one buying at home.
//
// Permanent sales only, deliberately — no loans across this boundary. A loan
// comes home automatically at the season's end (returnLoansHome), which
// depends on the parent club still being one this career tracks a pool for
// every season; a foreign loanee's parent club sits in `externalSquads`,
// which nothing currently guarantees stays fetched and correctly shaped
// forever the way `leagueSquads` does. A permanent move has no such promise
// to keep.

const INTERNATIONAL_STAR_THRESHOLD = 78; // a marquee window, not a scouting trawl through reserves
const INTERNATIONAL_WINDOW_CHANCE: Record<"summer" | "january", number> = { summer: 0.4, january: 0.15 };
const INTERNATIONAL_SECOND_DEAL_CHANCE = 0.25; // summer only — most windows that happen at all still produce just one

/** One club's pool, restated the same way runTransferWindow reads its own —
 *  own strength, own formation-based need, own eligibility to sell. */
interface WorldClub { club: string; pool: Candidate[]; strength: number }

function worldClubsFrom(squads: LeagueSquad[]): WorldClub[] {
  return squads.map(sq => {
    const pool = sq.players.map(p => fromLeaguePlayer(p, sq.club));
    return { club: sq.club, pool, strength: clubStrength(sq.club, pool) };
  });
}

/** Every plausible seller across a set of clubs, using the exact same
 *  sellability gate runTransferWindow applies to its own twenty. */
function listedAcross(clubs: WorldClub[], topStrength: number, window: TransferWindow, rng: () => number): Listed[] {
  const listed: Listed[] = [];
  for (const { club, pool, strength } of clubs) {
    const formation = formationForClub(club);
    const xi = new Set(autoPick(pool as Pickable[], formation).filter((id): id is string => !!id));
    for (const c of pool) {
      if (c.overall < INTERNATIONAL_STAR_THRESHOLD) continue;
      const l = sellability(c, xi.has(c.id), strength, topStrength, window, rng, pool.length);
      if (l) listed.push({ ...l, loan: false });
    }
  }
  return listed;
}

/** The best-fitting buyer for one listed man among a set of clubs — the same
 *  scoring runTransferWindow's own matching loop uses. */
function bestBuyerAmong(seller: Candidate, buyers: WorldClub[], rng: () => number): string | null {
  let bestClub: string | null = null, bestScore = -Infinity;
  for (const { club, pool, strength: buyerStrength } of buyers) {
    if (club === seller.club) continue;
    if (rng() > rivalrySellChance(seller.club, club, false)) continue;
    const gap = buyerStrength - seller.overall;
    if (gap < -reachDown(buyerStrength) || gap > REACH_UP) continue;
    const formation = formationForClub(club);
    const need = Math.max(...seller.positions.map(r => positionNeed(r, club, pool, formation, pool.length)));
    if (need <= 0.12) continue;
    const score = need * 10 - Math.abs(gap) * 0.15 + rng() * 0.6;
    if (score > bestScore) { bestScore = score; bestClub = club; }
  }
  return bestClub;
}

/**
 * One or two marquee deals a window, crossing between the player's own
 * division and the wider world of clubs this career has real data for but
 * has never traded with. Run alongside runTransferWindow (see the hook in
 * careerFlow.ts), on the career IT already returned, so a marquee arrival
 * competes for a genuinely up-to-date read of domestic need rather than a
 * snapshot from before that window's own domestic business happened.
 */
export function runInternationalWindow(
  career: CareerState, window: TransferWindow, rng: () => number,
): { career: CareerState; moves: TransferMove[] } {
  if (!window || !career.externalSquads?.length || !career.leagueSquads?.length) {
    return { career, moves: [] };
  }
  if (rng() >= INTERNATIONAL_WINDOW_CHANCE[window]) return { career, moves: [] };
  const deals = window === "summer" && rng() < INTERNATIONAL_SECOND_DEAL_CHANCE ? 2 : 1;

  const you = career.player.club;
  const domesticPool = career.squad.map(p => fromSquadPlayer(p, you));
  const domestic: WorldClub[] = [
    { club: you, pool: domesticPool, strength: clubStrength(you, domesticPool) },
    ...worldClubsFrom(career.leagueSquads.filter(sq => sq.club !== you)),
  ];
  const external = worldClubsFrom(career.externalSquads);
  const topStrength = Math.max(...domestic.map(c => c.strength), ...external.map(c => c.strength));

  const moves: TransferMove[] = [];
  for (let i = 0; i < deals; i++) {
    // Weighted toward the headline direction, but a domestic star leaving for
    // the wider world is exactly as real a piece of transfer news.
    const incoming = rng() < 0.6;
    const sellSide = incoming ? external : domestic;
    const buySide = incoming ? domestic : external;

    const candidates = listedAcross(sellSide, topStrength, window, rng);
    if (!candidates.length) continue;

    let chosen: { seller: Candidate; sellerClub: WorldClub; buyerClub: string } | null = null;
    let chosenScore = -Infinity;
    for (const { candidate: seller } of candidates) {
      const sellerClub = sellSide.find(c => c.club === seller.club)!;
      const buyerClub = bestBuyerAmong(seller, buySide, rng);
      if (!buyerClub) continue;
      // bestBuyerAmong already picked ITS best buyer for this seller; picking
      // the best SELLER across all candidates too (rather than the first one
      // that matches at all) is what makes this "the one star who actually
      // moves this window" instead of whichever happened to be listed first.
      const buyer = buySide.find(c => c.club === buyerClub)!;
      const score = seller.overall + buyer.strength * 0.2 + rng() * 4;
      if (score > chosenScore) { chosenScore = score; chosen = { seller, sellerClub, buyerClub }; }
    }
    if (!chosen) continue;

    const { seller, sellerClub, buyerClub } = chosen;
    const idx = sellerClub.pool.findIndex(p => p.id === seller.id);
    if (idx < 0) continue; // already moved by an earlier deal this same pass
    const [player] = sellerClub.pool.splice(idx, 1);
    player.club = buyerClub;
    const buyer = buySide.find(c => c.club === buyerClub)!;
    buyer.pool.push(player);
    sellerClub.strength = clubStrength(sellerClub.club, sellerClub.pool);
    buyer.strength = clubStrength(buyer.club, buyer.pool);

    moves.push({
      player: player.name, from: sellerClub.club, to: buyerClub,
      overall: player.overall, fee: feeFor(player.overall), unhappy: false,
    });
  }

  if (!moves.length) return { career, moves: [] };

  const nextSquad = domestic.find(c => c.club === you)!.pool.map(toSquadPlayer);
  const nextLeagueSquads = career.leagueSquads.map(sq => {
    const c = domestic.find(d => d.club === sq.club);
    return c ? { club: sq.club, players: c.pool.map(toLeaguePlayer) } : sq;
  });
  const domesticStrengthByClub = new Map(domestic.map(c => [c.club, c.strength]));
  const nextLeague = career.league.map(t => {
    const s = domesticStrengthByClub.get(t.name);
    return s === undefined ? t : { ...t, strength: s };
  });
  const nextExternalSquads = career.externalSquads.map(sq => {
    const c = external.find(e => e.club === sq.club);
    return c ? { club: sq.club, players: c.pool.map(toLeaguePlayer) } : sq;
  });

  return {
    career: {
      ...career, squad: nextSquad, leagueSquads: nextLeagueSquads, league: nextLeague,
      externalSquads: nextExternalSquads,
    },
    moves,
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
