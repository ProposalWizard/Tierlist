import type { CareerState, LeagueSquad, LeaguePlayer } from "./types";
import {
  divisionOf, PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS,
  OTHER_CLUBS, CHAMPIONS_LEAGUE_CLUBS, EUROPA_LEAGUE_CLUBS,
} from "./clubs";
import { poolFor } from "./euro";
import { getTuning } from "./tuningStore";
import { FREE_AGENTS_CLUB } from "./leagueSquads";
import { managerTier } from "./managerPool";
import {
  castVote, applyVoteHeldReputation, applyOverruleReputationCost,
  OVERRULE_OWNERSHIP_THRESHOLD, type VoteTally,
} from "./voting";

/**
 * INVESTMENTS — OWNING A PIECE OF A REAL CLUB, NOT JUST PLAYING FOR ONE.
 *
 * Requested directly: buy a percentage stake in any club the game knows
 * about — expensive, priced off the club's reputation/league position/
 * squad rating, going up when they do well (trophies, promotion, European
 * qualification, progressing further in Europe) and down when they don't
 * (relegation, dropping out of Europe, an underwhelming season) — and, past
 * 50.1%, real control: sign and sell players, appoint a manager, fund the
 * club directly.
 *
 * ── Why valuation is stateless, recomputed fresh every time ──
 *
 * A real share price doesn't need a memory of every past event — it only
 * reflects current fundamentals. `clubValuation` is a pure function of
 * CURRENT facts already sitting in `CareerState`: this season's live table
 * strength for a club in your division, the same seeded strength `euro.ts`
 * already carries for a European club, and last season's real trophy
 * winners (`career.lastSeasonWinners`) as the "recent form" premium — no
 * new per-club history needs tracking at all. As your own league plays out
 * week to week, a rival's valuation drifts with their live strength; at
 * every rollover, `lastSeasonWinners` updates and the whole board reprices
 * around who actually won what.
 *
 * ── Why governance is deliberately modest in mechanical depth ──
 *
 * No club but your own is simulated at manager level anywhere in this
 * engine (see manager.ts's own header: "no other club... is simulated well
 * enough to hold a job, let alone lose one"), and no club has ever had a
 * real transfer budget — `leagueTransfers.ts`'s whole engine works off
 * need-scoring and a shared fee formula, never a club's own bank balance.
 * Rather than inventing a second, parallel AI-club simulation just for a
 * majority owner to push against, the actions below plug into what's
 * ALREADY real and consequential: `career.leagueSquads`/`career.league`
 * (a signing or a sale here genuinely changes that club's actual roster and
 * `LeagueTeam.strength`, which the real season simulation then reads) and
 * the exact same fee formula every other transfer in the game is priced by.
 * A manager appointment is real data (a name on file, a real cost against
 * the club's budget, tiered by the same reputation the pool already uses)
 * without pretending this engine tracks a second club's tactics or morale —
 * it doesn't, and inventing a fake mechanical effect for it would be worse
 * than leaving it honestly cosmetic.
 */

// ── Every club a player could plausibly invest in ───────────────────────────

export function allInvestableClubs(): string[] {
  return Array.from(new Set<string>([
    ...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS, ...PROMOTION_POOL_CLUBS,
    ...OTHER_CLUBS, ...CHAMPIONS_LEAGUE_CLUBS, ...EUROPA_LEAGUE_CLUBS,
  ])).sort((a, b) => a.localeCompare(b));
}

// ── Valuation ────────────────────────────────────────────────────────────

type ClubTier = "champions" | "europa" | "premier" | "championship" | "other";

function tierOf(club: string, career: CareerState): ClubTier {
  // Actually playing in it THIS season outranks the static list — a club
  // punching above its usual competition (or currently in one at all) is
  // worth what it's doing now, not its long-run reputation bucket.
  if (career.euroState?.competition === "Champions League" && career.euroState.clubs.some(c => c.name === club)) return "champions";
  if (career.euroState?.competition === "Europa League" && career.euroState.clubs.some(c => c.name === club)) return "europa";
  const div = divisionOf(club);
  if (div === "champions") return "champions";
  if (div === "europa") return "europa";
  if (div === "championship") return "championship";
  if (div === "premier") return "premier";
  return "other";
}

/** Wherever the game actually has a number for this club right now — your
 *  own division's live table, or a European pool's seeded strength — with a
 *  plain mid-table default for anything the engine tracks by name only
 *  (a Saudi giant, say, that plays in neither). */
function strengthOf(club: string, career: CareerState): number {
  const inLeague = career.league.find(t => t.name === club);
  if (inLeague) return inLeague.strength;
  for (const comp of ["Champions League", "Europa League", "Conference League"] as const) {
    const found = poolFor(comp).find(c => c.name === club);
    if (found) return found.strength;
  }
  return 68;
}

// Prestige premium/discount by tier, layered on top of raw squad strength —
// a Champions League regular is worth more than a Championship promotion
// hopeful at the same nominal strength, the same way real club valuations
// carry a competition premium independent of the current XI's quality.
const TIER_MULTIPLIER: Record<ClubTier, number> = {
  champions: 1.25, europa: 0.85, premier: 1.0, championship: 0.3, other: 0.55,
};

/**
 * Calibrated so a genuinely elite club (strength ~92, Champions League
 * tier) is worth roughly ★150,000 in full — a majority stake (50.1%) costs
 * around ★75,000, genuinely "very very expensive" as requested, while 0.1%
 * of the same club (~★150) is the "reasonable amount for a rich footballer"
 * a small stake was asked to be. A mid-table Championship side, by
 * contrast, is worth a small fraction of that — buying into a smaller club
 * is genuinely cheaper, the same as it is in real football.
 */
const VALUATION_SCALE = 65;

export function clubValuation(club: string, career: CareerState): number {
  const strength = strengthOf(club, career);
  const tier = tierOf(club, career);
  // Exponential on strength above a floor — same spirit as
  // competitionBetting.ts's winWeight: value climbs steeply for the truly
  // elite, not linearly, the same way a real club's worth doesn't scale
  // proportionally with a handful of extra rating points at the very top.
  const base = Math.pow(Math.max(1, strength - 40), 1.9) * TIER_MULTIPLIER[tier] * VALUATION_SCALE;

  let momentum = 1;
  const w = career.lastSeasonWinners;
  if (w?.championsLeague === club) momentum *= 1.3;
  else if (w?.europaLeague === club) momentum *= 1.18;
  if (w?.league === club) momentum *= 1.15;
  if (w?.faCup === club || w?.leagueCup === club) momentum *= 1.05;

  return Math.max(500, Math.round(base * momentum));
}

// ── Buying and selling a stake ──────────────────────────────────────────

export interface ClubStake {
  club: string;
  /** 0-100. */
  percent: number;
  /** Valuation-weighted average price paid per percentage point owned —
   *  for showing profit/loss, never read by the buy/sell math itself. */
  avgBuyValuation: number;
}

export const MAJORITY_THRESHOLD = 50.1;

export function stakeIn(career: CareerState, club: string): ClubStake | undefined {
  return (career.investments ?? []).find(i => i.club === club);
}

export function isMajorityOwner(career: CareerState, club: string): boolean {
  return (stakeIn(career, club)?.percent ?? 0) >= MAJORITY_THRESHOLD;
}

/** A player can't invest in his own employer — the same conflict-of-
 *  interest a real footballer would be barred from, and it sidesteps every
 *  question of what "majority-owning the club you play for" would even mean
 *  for the rest of this engine (your own squad/contract/wages are modelled
 *  completely differently from every other club's). */
export function canInvestIn(career: CareerState, club: string): boolean {
  return club !== career.player.club;
}

export function buyStake(career: CareerState, club: string, percent: number): CareerState {
  if (percent <= 0 || !canInvestIn(career, club)) return career;
  const valuation = clubValuation(club, career);
  const cost = Math.round(valuation * (percent / 100));
  if (cost <= 0 || cost > career.money) return career;
  const existing = stakeIn(career, club);
  const merged: ClubStake = existing
    ? {
        club,
        percent: existing.percent + percent,
        avgBuyValuation: (existing.avgBuyValuation * existing.percent + valuation * percent) / (existing.percent + percent),
      }
    : { club, percent, avgBuyValuation: valuation };
  const investments = existing
    ? (career.investments ?? []).map(i => (i.club === club ? merged : i))
    : [...(career.investments ?? []), merged];
  return { ...career, money: career.money - cost, investments };
}

export function sellStake(career: CareerState, club: string, percent: number): CareerState {
  const existing = stakeIn(career, club);
  if (!existing || percent <= 0 || percent > existing.percent + 1e-9) return career;
  const valuation = clubValuation(club, career);
  const proceeds = Math.round(valuation * (percent / 100));
  const remaining = existing.percent - percent;
  const investments = remaining > 1e-6
    ? (career.investments ?? []).map(i => (i.club === club ? { ...i, percent: remaining } : i))
    : (career.investments ?? []).filter(i => i.club !== club);
  // Dropping below majority relinquishes the boardroom on the NEXT read
  // (isMajorityOwner just checks the live percentage) — the club's budget/
  // manager stay on file rather than being wiped, the same way a real
  // chairman selling down doesn't erase what the club already spent.
  return { ...career, money: career.money + proceeds, investments };
}

// ── Governance — majority ownership only ───────────────────────────────

export interface OwnedClubState {
  budget: number;
  managerName?: string;
  managerSince?: number;
  /** Phase 3 of STAR_POWER_POLITICS.md — see lib/star/clubPowers.ts. */
  formation?: string;
  isPresident?: boolean;
  presidentWage?: number;
  /** Set once this club has been absorbed into another via a merger — its
   *  own investable/governable identity ends here, but it is deliberately
   *  NOT removed from the world (clubs.ts's fixed lists, the ladder's fixed
   *  division sizes) — see clubPowers.ts's mergeClubs for why. */
  dissolvedInto?: string;
}

export function ownedClubState(career: CareerState, club: string): OwnedClubState {
  return career.ownedClubs?.[club] ?? { budget: 0 };
}

export function topUpClubBudget(career: CareerState, club: string, amount: number): CareerState {
  if (!isMajorityOwner(career, club) || amount <= 0 || amount > career.money) return career;
  const current = ownedClubState(career, club);
  return {
    ...career,
    money: career.money - amount,
    ownedClubs: { ...(career.ownedClubs ?? {}), [club]: { ...current, budget: current.budget + amount } },
  };
}

export function clubStrengthFromPlayers(players: { overall: number }[]): number {
  const xi = [...players].sort((a, b) => b.overall - a.overall).slice(0, 11);
  if (!xi.length) return 65;
  return Math.round(xi.reduce((s, p) => s + p.overall, 0) / xi.length);
}

/** The exact fee formula leagueTransfers.ts's own (unexported) feeFor uses,
 *  duplicated rather than imported — see this file's own header on why: the
 *  transfer engine's internals stay untouched by an unrelated caller. */
export function transferFee(overall: number): number {
  const m = Math.max(0, overall - 60);
  return Math.round((getTuning("transfers.feeBase") + m * m * getTuning("transfers.feeQuadratic")) * 10) / 10;
}

/**
 * Where a club's REAL squad actually lives.
 *
 * `career.leagueSquads` only ever holds the other clubs in the player's
 * CURRENT division — everyone else the game tracks a roster for (Champions/
 * Europa League, Championship/Other clubs when the player is in the Premier
 * League, or vice versa) lives in `career.externalSquads` instead. Every
 * other reader of "some other club's squad" in this codebase already checks
 * both (`scoutReport.ts`, `teamsheet.ts`) — this file didn't, so majority
 * ownership of any club outside the player's own division looked entirely
 * empty ("no squad data on file") and every sign/sell into it silently
 * failed to find a seller, reported directly after 100+ simulated seasons
 * of promotions/relegations and European qualification made that the common
 * case rather than the exception.
 */
export function findSquadEntry(career: CareerState, club: string): { squad: LeagueSquad; where: "league" | "external" } | undefined {
  const inLeague = (career.leagueSquads ?? []).find(s => s.club === club);
  if (inLeague) return { squad: inLeague, where: "league" };
  const inExternal = (career.externalSquads ?? []).find(s => s.club === club);
  if (inExternal) return { squad: inExternal, where: "external" };
  return undefined;
}

/** A club with no squad entry in EITHER array yet belongs wherever the rest
 *  of the game would file it: in your current division's live table
 *  (`career.league`), or external if not. */
export function setSquad(career: CareerState, club: string, players: LeaguePlayer[]): CareerState {
  const existing = findSquadEntry(career, club);
  const where = existing?.where ?? (career.league.some(t => t.name === club) ? "league" : "external");

  if (where === "external") {
    const exists = (career.externalSquads ?? []).some(s => s.club === club);
    const externalSquads: LeagueSquad[] = exists
      ? (career.externalSquads ?? []).map(s => (s.club === club ? { ...s, players } : s))
      : [...(career.externalSquads ?? []), { club, players }];
    return { ...career, externalSquads };
  }

  const exists = (career.leagueSquads ?? []).some(s => s.club === club);
  const leagueSquads: LeagueSquad[] = exists
    ? (career.leagueSquads ?? []).map(s => (s.club === club ? { ...s, players } : s))
    : [...(career.leagueSquads ?? []), { club, players }];
  const league = career.league.map(t => (t.name === club ? { ...t, strength: clubStrengthFromPlayers(players) } : t));
  return { ...career, leagueSquads, league };
}

export interface BoardActionResult {
  career: CareerState;
  ok: boolean;
  reason?: string;
}

/**
 * Sign a real player into an owned club — from the free-agent pool (no
 * fee) or bought from another club's real squad (the standard transfer
 * fee, drawn from the CLUB's own budget via topUpClubBudget, never
 * straight from personal money — a chairman funds the club, the club buys
 * the player). Mirrors leagueTransfers.ts's own splice/push/recompute-
 * strength pattern exactly, so this is a genuine transfer, not a cosmetic
 * roster edit — the squad it lands in is the exact same data the real
 * season simulation reads.
 */
export function signPlayerForOwnedClub(
  career: CareerState, club: string, playerId: string, fromClub: string,
): BoardActionResult {
  if (!isMajorityOwner(career, club)) return { career, ok: false, reason: "Not the majority shareholder" };
  const budget = ownedClubState(career, club).budget;

  let player: LeaguePlayer | undefined;
  let fee = 0;
  let next = career;

  if (fromClub === FREE_AGENTS_CLUB) {
    const idx = (career.freeAgents ?? []).findIndex(p => p.id === playerId);
    if (idx < 0) return { career, ok: false, reason: "That player isn't available" };
    player = career.freeAgents![idx];
    next = { ...career, freeAgents: career.freeAgents!.filter((_, i) => i !== idx) };
  } else {
    const sellerEntry = findSquadEntry(career, fromClub);
    const idx = sellerEntry?.squad.players.findIndex(p => p.id === playerId) ?? -1;
    if (!sellerEntry || idx < 0) return { career, ok: false, reason: "That player isn't available" };
    player = sellerEntry.squad.players[idx];
    fee = transferFee(player.overall);
    if (fee > budget) return { career, ok: false, reason: "Not enough in the transfer budget" };
    next = setSquad(next, fromClub, sellerEntry.squad.players.filter((_, i) => i !== idx));
  }
  if (!player) return { career, ok: false, reason: "That player isn't available" };

  const buyerPlayers = [...(findSquadEntry(next, club)?.squad.players ?? []), player];
  next = setSquad(next, club, buyerPlayers);
  next = {
    ...next,
    ownedClubs: { ...(next.ownedClubs ?? {}), [club]: { ...ownedClubState(next, club), budget: budget - fee } },
  };
  return { career: next, ok: true };
}

/** Sell a real player OUT of an owned club — proceeds go straight into the
 *  club's own transfer budget, priced the same way. Blocked once the squad
 *  is already down to the same minimum size the rest of the transfer
 *  engine protects (transfers.minSquadSize) — a chairman can weaken a club,
 *  not strip it down to nothing. */
export function sellPlayerFromOwnedClub(career: CareerState, club: string, playerId: string): BoardActionResult {
  if (!isMajorityOwner(career, club)) return { career, ok: false, reason: "Not the majority shareholder" };
  const entry = findSquadEntry(career, club);
  const squad = entry?.squad;
  const idx = squad?.players.findIndex(p => p.id === playerId) ?? -1;
  if (!squad || idx < 0) return { career, ok: false, reason: "That player isn't in the squad" };
  if (squad.players.length <= getTuning("transfers.minSquadSize")) {
    return { career, ok: false, reason: "The squad is already too thin to sell from" };
  }
  const player = squad.players[idx];
  const fee = transferFee(player.overall);
  const next = setSquad(career, club, squad.players.filter((_, i) => i !== idx));
  const current = ownedClubState(next, club);
  return {
    career: { ...next, ownedClubs: { ...(next.ownedClubs ?? {}), [club]: { ...current, budget: current.budget + fee } } },
    ok: true,
  };
}

// ── Selling a player, routed through a real shareholder vote ────────────────
//
// Phase 2 of STAR_POWER_POLITICS.md's proof-of-concept: this ONE boardroom
// action now goes through the generic voting engine (voting.ts) instead of
// acting instantly. Nothing else in this file changed — signing a player and
// appointing a manager are untouched, deliberately, since Phase 2 is "prove
// the voting system works," not "route every boardroom action through it."

/** How many shareholders vote — this game doesn't model individual
 *  shareholders as data, so a stylised, fixed electorate stands in for
 *  "however many people actually hold shares" (the brief's own worked
 *  example, 638 votes, is this same order of magnitude). */
const SHAREHOLDER_ELECTORATE = 640;

/** Above `OVERRULE_OWNERSHIP_THRESHOLD` (voting.ts), a club-scoped vote can
 *  be overruled outright regardless of your ownership stake in the OTHER
 *  sense the rest of this file already checks (majority control) — this is
 *  a stricter, higher bar on top of it. */
export function canOverruleClubVote(career: CareerState, club: string): boolean {
  return (stakeIn(career, club)?.percent ?? 0) >= OVERRULE_OWNERSHIP_THRESHOLD;
}

export interface SellPlayerVoteProposal {
  club: string;
  playerId: string;
  playerName: string;
  fee: number;
  tally: VoteTally;
}

/** Build and immediately resolve the shareholder vote on selling a specific
 *  player — the real tally is decided here (see voting.ts's own note on why
 *  a vote is rolled once, not simulated live); the ceremony screen only
 *  animates toward it. Every check `sellPlayerFromOwnedClub` itself makes
 *  (majority ownership, the player exists, the squad floor) is repeated
 *  here first so a vote is never held over something that could never
 *  actually happen. */
export function proposeSellPlayerVote(
  career: CareerState, club: string, playerId: string, rng: () => number,
): { ok: true; proposal: SellPlayerVoteProposal } | { ok: false; reason: string } {
  if (!isMajorityOwner(career, club)) return { ok: false, reason: "Not the majority shareholder" };
  const entry = findSquadEntry(career, club);
  const squad = entry?.squad;
  const idx = squad?.players.findIndex(p => p.id === playerId) ?? -1;
  if (!squad || idx < 0) return { ok: false, reason: "That player isn't in the squad" };
  if (squad.players.length <= getTuning("transfers.minSquadSize")) {
    return { ok: false, reason: "The squad is already too thin to sell from" };
  }
  const player = squad.players[idx];
  const fee = transferFee(player.overall);

  // Shareholder reputation biases the odds in your favour, never guarantees
  // them — a popular chairman with a great record still occasionally loses
  // a vote, which is the entire point of it being a real roll (see
  // voting.ts's MAX_SWING).
  const biasStrength = (career.reputation.shareholders - 50) / 50;
  const tally = castVote(
    `Sell ${player.name} for £${fee}m?`,
    [{ id: "yes", label: "Sell" }, { id: "no", label: "Keep" }],
    SHAREHOLDER_ELECTORATE, "yes", biasStrength, rng,
  );

  return { ok: true, proposal: { club, playerId, playerName: player.name, fee, tally } };
}

/** Apply the outcome of a proposal built by `proposeSellPlayerVote`. If the
 *  vote passed, or you overrule it (only possible above
 *  `OVERRULE_OWNERSHIP_THRESHOLD` — see `canOverruleClubVote` above), the
 *  sale goes through exactly as `sellPlayerFromOwnedClub` already did it;
 *  either way, holding the vote nudges shareholder reputation, and
 *  overruling costs it on top. */
export function resolveSellPlayerVote(
  career: CareerState, proposal: SellPlayerVoteProposal, overrule: boolean,
): BoardActionResult {
  let next = { ...career, reputation: applyVoteHeldReputation(career.reputation) };
  const passed = proposal.tally.winner === "yes";
  if (!passed && overrule) {
    if (!canOverruleClubVote(next, proposal.club)) {
      return { career: next, ok: false, reason: "Not enough ownership to overrule this vote" };
    }
    next = { ...next, reputation: applyOverruleReputationCost(next.reputation) };
  } else if (!passed) {
    return { career: next, ok: false, reason: "The shareholders voted to keep him" };
  }
  const sale = sellPlayerFromOwnedClub(next, proposal.club, proposal.playerId);
  return sale.ok ? sale : { career: next, ok: false, reason: sale.reason };
}

function managerFee(name: string): number {
  const tier = managerTier(name);
  if (tier === "dream") return 8000;
  if (tier === 1) return 3000;
  if (tier === 2) return 1200;
  if (tier === 3) return 400;
  return 250; // an unranked name — a cheap, low-profile hire
}

/** Appoint a manager — real data (a name, shown wherever this club's
 *  manager is displayed, costing the club's own budget, priced by the same
 *  reputation tier the pool already uses) without pretending this engine
 *  simulates a second club's tactics or morale — it doesn't, and a fake
 *  strength swing to compensate would be worse than an honestly cosmetic
 *  appointment. See this file's own header. */
export function replaceManagerForOwnedClub(career: CareerState, club: string, managerName: string): BoardActionResult {
  if (!isMajorityOwner(career, club)) return { career, ok: false, reason: "Not the majority shareholder" };
  const current = ownedClubState(career, club);
  const fee = managerFee(managerName);
  if (fee > current.budget) return { career, ok: false, reason: "Not enough in the budget for that appointment" };
  return {
    career: {
      ...career,
      ownedClubs: {
        ...(career.ownedClubs ?? {}),
        [club]: { ...current, budget: current.budget - fee, managerName, managerSince: career.season },
      },
    },
    ok: true,
  };
}
