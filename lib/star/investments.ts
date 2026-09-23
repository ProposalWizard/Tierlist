import { reputationVoteBias } from "./reputation";
import type { CareerState, LeagueSquad, LeaguePlayer } from "./types";
import {
  divisionOf, PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS,
  OTHER_CLUBS, CHAMPIONS_LEAGUE_CLUBS, EUROPA_LEAGUE_CLUBS,
} from "./clubs";
import { poolFor } from "./euro";
import { transferWindowOpen, divisionOf as careerDivisionOf } from "./calendar";
import { getTuning } from "./tuningStore";
import { FREE_AGENTS_CLUB } from "./leagueSquads";
import { managerTier, managerBaseFee, allPoolManagers, managerRng, TIER_REPUTATION_RANGE, managerCooldownKey } from "./managerPool";
import { styleBlurb, bossOnArrival, type Manager, type ManagerStyle } from "./manager";
import { loadLineup } from "./lineupStore";
import {
  castVote, applyVoteHeldReputation, applyOverruleReputationCost,
  OVERRULE_OWNERSHIP_THRESHOLD, type VoteTally,
} from "./voting";
import { tierOf, TIER_MULTIPLIER } from "./clubTier";
import { playerMarketValue } from "./marketValue";
import { CLUB_DATABASE } from "./data/footballClubDatabase";
import { formatMoney } from "./money";

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

// Moved to clubTier.ts so marketValue.ts can share it without cycling back
// through this file — re-exported here so every existing caller of
// `tierOf`/`TIER_MULTIPLIER`/`ClubTier` FROM investments.ts still works.
export type { ClubTier } from "./clubTier";
export { tierOf, TIER_MULTIPLIER } from "./clubTier";

/** Wherever the game actually has a number for this club right now — your
 *  own division's live table, or a European pool's seeded strength — with a
 *  plain mid-table default for anything the engine tracks by name only
 *  (a Saudi giant, say, that plays in neither). */
function strengthOf(club: string, career: CareerState): number {
  const inLeague = career.league.find(t => t.name === club);
  if (inLeague) return inLeague.strength;
  for (const comp of ["Champions League", "Europa League", "Conference League"] as const) {
    const found = poolFor(comp, career).find(c => c.name === club);
    if (found) return found.strength;
  }
  return 68;
}

/**
 * Scales the INTANGIBLE component only (brand/history/momentum) — see
 * `clubValuation`'s own note on why real squad value and cash budget are
 * separate, additive, live-tracked components now rather than folded into
 * this one constant.
 *
 * Rescaled 14 Sep 2026 alongside `marketValue.scale` — requested directly
 * ("I want the economy like the real football world"), after research into
 * real club valuations (Deloitte/Forbes-style figures: the biggest clubs
 * in the €4-6bn range, a mid-table Premier League club several hundred
 * million, a Championship club tens of millions). Deliberately kept
 * smaller than the squad-value component it sits alongside for the
 * biggest clubs — brand/history is real, but a real elite squad's combined
 * player value is genuinely the bigger part of what a top club is worth,
 * not the other way round. 140,000 lands a genuine title-calibre club's
 * INTANGIBLE component alone around £250-300m — real, but not the whole
 * story; the squad and budget terms below do the rest of the real work.
 */
const VALUATION_SCALE = 140000;

/**
 * A real prestige multiplier for every one of the game's 125 real clubs —
 * rebuilt 14 Sep 2026 from the same researched spreadsheet `facilities.ts`
 * now reads (`CLUB_DATABASE`, footballClubDatabase.ts). Replaces the
 * earlier version, which sourced/estimated real prestige for only about 30
 * hand-typed clubs (English clubs plus a handful of the biggest European
 * names) and fell back to a flat, undifferentiated 1x for every other real
 * club this game actually has — every genuine European/Other club that
 * wasn't one of those ~30 got no real-world premium or discount at all.
 *
 * `currentReputation` is the dataset's own 1-10 CURRENT global-reputation
 * figure (not the historical one — this multiplier answers "how big is
 * this club right now," the same framing the earlier version used), mapped
 * LINEARLY across the full 1-10 scale onto the same compressed 0.6x-3.0x
 * band the original version used by hand. That compression is still the
 * point, not a new decision: this game's whole money economy runs several
 * orders of magnitude smaller than real football finance on purpose (a
 * majority stake in the very best club here costs tens of thousands, not
 * billions — see VALUATION_SCALE's own note above), so plugging in literal
 * real reputation gaps would dwarf every other number in the game. A club
 * genuinely absent from the dataset (there shouldn't be one — every real
 * club this game knows about was cross-checked 1:1 against it before this
 * was wired in) falls back to a neutral 1x, same as before.
 */
const PRESTIGE_FLOOR = 0.6;
const PRESTIGE_CEILING = 3.0;

export function realPrestigeFactor(club: string): number {
  const rating = CLUB_DATABASE[club]?.currentReputation;
  if (rating === undefined) return 1;
  return PRESTIGE_FLOOR + ((rating - 1) / 9) * (PRESTIGE_CEILING - PRESTIGE_FLOOR);
}

/** The real squad this club actually has, valued the same way a transfer
 *  negotiation would value each of them — reused here rather than a second
 *  pricing idiom, so "how much is this squad worth" always means the same
 *  thing everywhere it's asked. Your own club reads `career.squad` (full
 *  `SquadPlayer`s); every other club reads its thin `LeagueSquad` record. */
function squadMarketValueSum(club: string, career: CareerState): number {
  if (club === career.player.club) {
    // A generated/offline squad's `overall` is optional — same 65 fallback
    // `leagueSquads.ts` already uses when a real row has no rating on file.
    return (career.squad ?? []).reduce(
      (sum, p) => sum + playerMarketValue({ ...p, overall: p.overall ?? 65 }, club, career), 0,
    );
  }
  const entry = findSquadEntry(career, club);
  if (!entry) return 0;
  return entry.squad.players.reduce((sum, p) => sum + playerMarketValue(p, club, career), 0);
}

/**
 * Requested directly, with a full worked example: buying a player should
 * move club value by the GAP between what he actually cost and what he was
 * actually worth — pay exactly his market value and the club's value
 * doesn't change (you swapped cash for an asset of equal worth); get him
 * for less than he's worth and the club is genuinely richer for it; overpay
 * and it genuinely isn't. This isn't bespoke transfer-ledger bookkeeping —
 * it falls straight out of treating club value as real components that are
 * ALREADY tracked live: the squad's combined market value (which rises by
 * the new player's own value the instant he joins, whatever was paid for
 * him) plus the club's own cash budget (which drops by the fee paid, in the
 * same transaction) plus an intangible brand/history/form component. Buy a
 * player worth ★100 for exactly ★100 and the bracket is unchanged (+100
 * squad, -100 budget); get him for ★60 and the club is ★40 richer; pay
 * ★120 for him and it's ★20 poorer — exactly the mechanism asked for,
 * without a second value-tracking system alongside the real one.
 */
export function clubValuation(club: string, career: CareerState): number {
  const strength = strengthOf(club, career);
  const tier = tierOf(club, career);
  // Exponential on strength above a floor — same spirit as
  // competitionBetting.ts's winWeight: value climbs steeply for the truly
  // elite, not linearly, the same way a real club's worth doesn't scale
  // proportionally with a handful of extra rating points at the very top.
  // This is the club's INTANGIBLE component — brand, history, commercial
  // pull — deliberately separate from the real squad value added below, so
  // the two don't double-count "this club is full of great players" twice.
  const intangible = Math.pow(Math.max(1, strength - 40), 1.9) * TIER_MULTIPLIER[tier] * VALUATION_SCALE;

  let momentum = 1;
  const w = career.lastSeasonWinners;
  if (w?.championsLeague === club) momentum *= 1.3;
  else if (w?.europaLeague === club) momentum *= 1.18;
  if (w?.league === club) momentum *= 1.15;
  if (w?.faCup === club || w?.leagueCup === club) momentum *= 1.05;

  const squadValue = squadMarketValueSum(club, career);
  const budget = ownedClubState(career, club).budget;
  const prestige = realPrestigeFactor(club);

  // £5m floor — a real nominal figure for even the smallest, least
  // fashionable club this game knows about, rescaled 14 Sep 2026 alongside
  // everything else in this file.
  return Math.max(5000000, Math.round((intangible * momentum + squadValue + budget) * prestige));
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

/** Requested directly, 14 Sep 2026: "you should only be able to transfer
 *  players during transfer windows, and you already know when you're
 *  transferring" — the exact same real calendar boundary (summer/January)
 *  `calendar.ts`'s `transferWindowOpen` already governs the AI-vs-AI
 *  transfer window and the competition-betting cutoff with. A boardroom
 *  sign/sell is a real transfer, not a special boardroom-only exception to
 *  the calendar. */
function isTransferWindowOpen(career: CareerState): boolean {
  return transferWindowOpen(career.player.startYear, career.season, career.week, careerDivisionOf(career));
}

export function isMajorityOwner(career: CareerState, club: string): boolean {
  return (stakeIn(career, club)?.percent ?? 0) >= MAJORITY_THRESHOLD;
}

/**
 * Requested directly: you should be able to buy your own club too, the same
 * as any other. The real-world conflict-of-interest objection this used to
 * block on doesn't actually stop a footballer becoming a part-owner of his
 * own club in reality either (several have) — the earlier restriction was
 * really standing in for a different, narrower problem: your own squad,
 * contract, and manager relationship are modelled by entirely different
 * systems (`career.squad`, `career.contract`, `career.relationships.boss`)
 * than every OTHER club's thin `LeagueSquad` record the Boardroom's sign/
 * sell/manager tools operate on. That's still true, so majority-owning your
 * own club is real (a stake, profit/loss, a vote weight, counts toward
 * everything the Ownership hub shows) but its Boardroom deliberately
 * doesn't offer squad/sign/manager tools — see `Boardroom`'s own note in
 * Investments.tsx.
 */
export function canInvestIn(_career: CareerState, _club: string): boolean {
  return true;
}

export function buyStake(career: CareerState, club: string, percent: number): CareerState {
  if (percent <= 0 || !canInvestIn(career, club)) return career;
  const existing = stakeIn(career, club);
  // Reported directly: buying 100% of a club and then still being offered
  // more let a real save end up owning 200% of one club — impossible in
  // reality and unhandled everywhere else in this engine (majority checks,
  // vote weight, sale proceeds all assume percentages that sum to at most
  // 100). Clamp the actual purchase to whatever room is left rather than
  // trusting the caller's requested amount — the UI's own spend cap
  // (Investments.tsx's `maxBuySpend`) is fixed alongside this, but this is
  // the real backstop.
  const room = Math.max(0, 100 - (existing?.percent ?? 0));
  percent = Math.min(percent, room);
  if (percent <= 0) return career;
  const valuation = clubValuation(club, career);
  const cost = Math.round(valuation * (percent / 100));
  if (cost <= 0 || cost > career.money) return career;
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
  /** The talisman tactic — see clubPowers.ts's `setTalisman`. Only ever
   *  reaches the match engine while `CareerState.player.club === this club`;
   *  it stays recorded here even if you later move elsewhere, harmlessly. */
  talisman?: boolean;
  /** Set once this club has been absorbed into another via a merger — its
   *  own investable/governable identity ends here, but it is deliberately
   *  NOT removed from the world (clubs.ts's fixed lists, the ladder's fixed
   *  division sizes) — see clubPowers.ts's mergeClubs for why. */
  dissolvedInto?: string;
}

export function ownedClubState(career: CareerState, club: string): OwnedClubState {
  return career.ownedClubs?.[club] ?? { budget: 0 };
}

/** One completed real transfer through the Boardroom — see
 *  CareerState.clubTransferHistory's own header for why this exists. */
export interface ClubTransferRecord {
  season: number;
  direction: "in" | "out";
  playerName: string;
  /** The other club — who he came from (an "in") or went to (an "out"). */
  otherClub: string;
  fee: number;
}

const CLUB_TRANSFER_HISTORY_LIMIT = 200;

function recordClubTransfer(career: CareerState, club: string, record: ClubTransferRecord): CareerState {
  const existing = career.clubTransferHistory?.[club] ?? [];
  return {
    ...career,
    clubTransferHistory: {
      ...(career.clubTransferHistory ?? {}),
      [club]: [record, ...existing].slice(0, CLUB_TRANSFER_HISTORY_LIMIT),
    },
  };
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
  /** A price a real negotiation (negotiation.ts) already agreed on —
   *  overrides the flat `transferFee` formula when provided. Free-agent
   *  signings ignore this: there's no seller to have negotiated with. */
  agreedFee?: number,
): BoardActionResult {
  if (!isMajorityOwner(career, club)) return { career, ok: false, reason: "Not the majority shareholder" };
  if (!isTransferWindowOpen(career)) return { career, ok: false, reason: "Transfers only happen during a transfer window" };
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
    fee = agreedFee ?? transferFee(player.overall);
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
  next = recordClubTransfer(next, club, {
    season: next.season, direction: "in", playerName: player.name,
    otherClub: fromClub === FREE_AGENTS_CLUB ? "Free Agent" : fromClub, fee,
  });
  return { career: next, ok: true };
}

/** Sell a real player OUT of an owned club — proceeds go straight into the
 *  club's own transfer budget, priced the same way. Blocked once the squad
 *  is already down to the same minimum size the rest of the transfer
 *  engine protects (transfers.minSquadSize) — a chairman can weaken a club,
 *  not strip it down to nothing. */
export function sellPlayerFromOwnedClub(
  career: CareerState, club: string, playerId: string,
  /** A price a real negotiation already agreed on — overrides the flat
   *  `transferFee` formula when provided. */
  agreedFee?: number,
  /** The real destination club — reported directly, 14 Sep 2026: a sold
   *  player used to just vanish, with no real club to actually join, which
   *  broke transfer news (nowhere to send him) and left him unsignable
   *  anywhere. Optional, defaulting to the old remove-only behaviour, for
   *  any caller that genuinely has no real destination in hand (an old save
   *  replaying a stored action, e.g.) — every real UI path now always has
   *  one, since `transferMarket.ts`'s interested-clubs list is the only way
   *  a sale starts. */
  buyerClub?: string,
): BoardActionResult {
  if (!isMajorityOwner(career, club)) return { career, ok: false, reason: "Not the majority shareholder" };
  if (!isTransferWindowOpen(career)) return { career, ok: false, reason: "Transfers only happen during a transfer window" };
  const entry = findSquadEntry(career, club);
  const squad = entry?.squad;
  const idx = squad?.players.findIndex(p => p.id === playerId) ?? -1;
  if (!squad || idx < 0) return { career, ok: false, reason: "That player isn't in the squad" };
  if (squad.players.length <= getTuning("transfers.minSquadSize")) {
    return { career, ok: false, reason: "The squad is already too thin to sell from" };
  }
  const player = squad.players[idx];
  const fee = agreedFee ?? transferFee(player.overall);
  let next = setSquad(career, club, squad.players.filter((_, i) => i !== idx));
  if (buyerClub) {
    const buyerPlayers = [...(findSquadEntry(next, buyerClub)?.squad.players ?? []), player];
    next = setSquad(next, buyerClub, buyerPlayers);
  }
  const current = ownedClubState(next, club);
  next = { ...next, ownedClubs: { ...(next.ownedClubs ?? {}), [club]: { ...current, budget: current.budget + fee } } };
  next = recordClubTransfer(next, club, {
    season: next.season, direction: "out", playerName: player.name,
    otherClub: buyerClub ?? "Unknown", fee,
  });
  return { career: next, ok: true };
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
  /** The real destination club, when one's already been picked from the
   *  interested-clubs list (transferMarket.ts) — see sellPlayerFromOwnedClub's
   *  own note on why this is optional. */
  buyerClub?: string;
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
  /** A price a real negotiation with the buyer already agreed on — overrides
   *  the flat `transferFee` formula the shareholders are asked to approve. */
  agreedFee?: number,
  buyerClub?: string,
): { ok: true; proposal: SellPlayerVoteProposal } | { ok: false; reason: string } {
  if (!isMajorityOwner(career, club)) return { ok: false, reason: "Not the majority shareholder" };
  if (!isTransferWindowOpen(career)) return { ok: false, reason: "Transfers only happen during a transfer window" };
  const entry = findSquadEntry(career, club);
  const squad = entry?.squad;
  const idx = squad?.players.findIndex(p => p.id === playerId) ?? -1;
  if (!squad || idx < 0) return { ok: false, reason: "That player isn't in the squad" };
  if (squad.players.length <= getTuning("transfers.minSquadSize")) {
    return { ok: false, reason: "The squad is already too thin to sell from" };
  }
  const player = squad.players[idx];
  const fee = agreedFee ?? transferFee(player.overall);

  // Shareholder reputation biases the odds in your favour, never guarantees
  // them — a popular chairman with a great record still occasionally loses
  // a vote, which is the entire point of it being a real roll (see
  // voting.ts's MAX_SWING).
  const biasStrength = reputationVoteBias(career.reputation);
  const tally = castVote(
    `Sell ${player.name} for £${formatMoney(fee)}?`,
    [{ id: "yes", label: "Sell" }, { id: "no", label: "Keep" }],
    SHAREHOLDER_ELECTORATE, "yes", biasStrength, rng,
  );

  return { ok: true, proposal: { club, playerId, playerName: player.name, fee, tally, buyerClub } };
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
  // Reuse the exact fee the shareholders actually voted on (also the exact
  // price a negotiation may have agreed with the buyer) rather than letting
  // sellPlayerFromOwnedClub recompute its own flat fee fresh here — the two
  // could only diverge if the vote and the resolution happened at different
  // moments, but "the fee you sell for" should never silently change from
  // "the fee that was actually approved."
  const sale = sellPlayerFromOwnedClub(next, proposal.club, proposal.playerId, proposal.fee, proposal.buyerClub);
  return sale.ok ? sale : { career: next, ok: false, reason: sale.reason };
}

/**
 * Which club (if any) a real pool manager currently occupies — the
 * PLAYER's own club (`career.manager`) or any club they own
 * (`ownedClubs[club].managerName`). Reported directly, from a real save:
 * appointing Eddie Howe at Brentford while he was already appointed at
 * Bournemouth left him managing both — a manager is a unique resource,
 * exactly like a player, and this is the one check that keeps him that way.
 * Non-owned clubs' Lineups-typed names are deliberately out of scope here —
 * this game never dynamically reassigns a manager it doesn't itself
 * simulate, so there is nothing to poach there.
 */
export function managerCurrentClub(career: CareerState, name: string): string | undefined {
  if (career.manager?.name === name) return career.player.club;
  for (const [c, state] of Object.entries(career.ownedClubs ?? {})) {
    if (state.managerName === name) return c;
  }
  return undefined;
}

/** A negotiation that ends without a deal — rejected, walked away by
 *  either side — takes this specific man off the table for THIS specific
 *  club until next season. Requested directly: "you either have to get the
 *  deal done right there, or you have to wait until the next beginning of
 *  the season" — otherwise a lowball is free to keep retrying for the best
 *  possible price with no real cost to trying. */
export function recordFailedManagerNegotiation(career: CareerState, club: string, managerName: string): CareerState {
  return {
    ...career,
    managerNegotiationCooldowns: {
      ...(career.managerNegotiationCooldowns ?? {}),
      [managerCooldownKey(club, managerName)]: career.season + 1,
    },
  };
}

/** Appoint a manager — real data (a name, shown wherever this club's
 *  manager is displayed, costing the club's own budget, priced by the same
 *  reputation tier the pool already uses) without pretending this engine
 *  simulates a second club's tactics or morale — it doesn't, and a fake
 *  strength swing to compensate would be worse than an honestly cosmetic
 *  appointment. See this file's own header.
 *
 *  `agreedFee`, when given, overrides `managerBaseFee` — the real number a
 *  negotiation (managerPool.ts's `managerInterest` + negotiation.ts) just
 *  settled on, same pattern `signPlayerForOwnedClub`/`sellPlayerFromOwnedClub`
 *  already use for a negotiated transfer fee. */
export function replaceManagerForOwnedClub(
  career: CareerState, club: string, managerName: string, agreedFee?: number,
): BoardActionResult {
  if (!isMajorityOwner(career, club)) return { career, ok: false, reason: "Not the majority shareholder" };
  const takenAt = managerCurrentClub(career, managerName);
  if (takenAt && takenAt !== club) {
    return { career, ok: false, reason: `${managerName} already manages ${takenAt}` };
  }
  const current = ownedClubState(career, club);
  const fee = agreedFee ?? managerBaseFee(managerName);
  if (fee > current.budget) return { career, ok: false, reason: "Not enough in the budget for that appointment" };
  const isOwnClub = club === career.player.club;

  // Whoever he's replacing is out of a job now — same "unemployed real
  // managers" pool the player's own club's sacking flow already draws from
  // (managerPool.ts/manager.ts), so that man becomes hireable again exactly
  // like a departing player would, rather than just vanishing.
  const outgoingName = isOwnClub ? career.manager?.name : (current.managerName ?? (loadLineup(club)?.manager || undefined));
  let availableManagers = career.availableManagers ?? allPoolManagers();
  availableManagers = availableManagers.filter(n => n !== managerName);
  if (outgoingName && outgoingName !== managerName
    && managerTier(outgoingName) !== undefined && !availableManagers.includes(outgoingName)) {
    availableManagers = [...availableManagers, outgoingName];
  }

  // Requested directly: majority (or full) ownership of your OWN club used
  // to unlock nothing but a budget top-up — squad/sign/formation genuinely
  // can't work here yet (they read the OTHER 19 clubs' LeagueSquad shape;
  // your own real teammates are a different, richer SquadPlayer[] this
  // function doesn't touch), but there's no such conflict for the manager's
  // job: you can already BE sacked, so being able to sack HIM, as the man
  // who actually owns the club, is a real, safe power to add. This appoints
  // into `career.manager` for real — the same live system the automatic
  // sacking flow uses — rather than the cosmetic `ownedClubs.managerName`
  // record every other club's appointment writes to.
  if (isOwnClub) {
    const tier = managerTier(managerName);
    const rng = managerRng(career, club, career.season);
    const styleRoll = rng();
    const style: ManagerStyle = styleRoll < 0.38 ? "trusting" : styleRoll < 0.72 ? "demanding" : "rotational";
    const range = tier !== undefined ? TIER_REPUTATION_RANGE[tier] : { min: 20, max: 60 };
    const reputation = Math.round(range.min + rng() * (range.max - range.min));
    const manager: Manager = { name: managerName, style, since: career.season, arrival: styleBlurb(style), reputation, poolTier: tier };
    const next: CareerState = {
      ...career,
      manager,
      availableManagers,
      relationships: { ...career.relationships, boss: bossOnArrival(career) },
      ownedClubs: { ...(career.ownedClubs ?? {}), [club]: { ...current, budget: current.budget - fee } },
    };
    return { career: next, ok: true };
  }

  return {
    career: {
      ...career,
      availableManagers,
      ownedClubs: {
        ...(career.ownedClubs ?? {}),
        [club]: { ...current, budget: current.budget - fee, managerName, managerSince: career.season },
      },
    },
    ok: true,
  };
}
