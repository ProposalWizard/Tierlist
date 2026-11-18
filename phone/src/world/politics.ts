/**
 * OWNERSHIP AND POLITICS: the wiring page.tsx does for the Ownership hub, the
 * Investments boardroom, the Rule Book and the vote ceremony. Every action is
 * the game's own pure CareerState -> CareerState function (lib/star/
 * investments, clubPowers, facilities, governingBodies, ruleBook, leadership,
 * corruption, forcedMovement, newCompetition); this file only reads the
 * career, calls it with the same seeds page.tsx uses, and saves the result.
 *
 * A vote is decided when it is proposed (voting.ts). The proposal travels to
 * the "vote-ceremony" screen in its params with where to go back to
 * (`VoteBack`), the way page.tsx keeps `pendingVote` + `investmentsEntry`.
 */
import type { CareerState } from "@/lib/star/types";
import { mulberry32 } from "@/lib/star/season";
import {
  buyStake, sellStake, topUpClubBudget, signPlayerForOwnedClub, sellPlayerFromOwnedClub, replaceManagerForOwnedClub,
  proposeSellPlayerVote, resolveSellPlayerVote, canOverruleClubVote, findSquadEntry, recordFailedManagerNegotiation,
  type SellPlayerVoteProposal,
} from "@/lib/star/investments";
import {
  setClubFormation, setClubKit, proposeKitVote, resolveKitVote, proposePresidentVote, resolvePresidentVote,
  setPresidentWage, submitRecommendation, haveASon, ageUpSonWithPotion, promoteSonToFirstTeam, transferSon,
  mergeClubs, setOwnedLineup, appointSelfCaptain, setTalisman, transferSelfTo,
  type ClubKit, type KitVoteProposal, type PresidentVoteProposal, type RecommendationKind,
} from "@/lib/star/clubPowers";
import { renameStadium, upgradeStadiumCapacity, upgradeTrainingGround, upgradeYouthAcademy } from "@/lib/star/facilities";
import { investInfluence, type GoverningBody } from "@/lib/star/governingBodies";
import { proposeRuleChangeVote, resolveRuleChangeVote, canOverruleRuleVote, type RuleChangeProposal, type RuleBook } from "@/lib/star/ruleBook";
import { bribeVote, rollCaught, applyGettingCaught, LAWYER_FEE } from "@/lib/star/corruption";
import { forceClubIntoPremierLeague } from "@/lib/star/forcedMovement";
import {
  proposeBodyPresidencyVote, resolveBodyPresidencyVote, canOverrulePresidencyVote, type PresidencyVoteProposal,
} from "@/lib/star/leadership";
import { createCompetition, playCompetitionToWinner } from "@/lib/star/newCompetition";
import { loadLineup, saveLineup, type SavedLineup } from "@/lib/star/lineupStore";
import { DEFAULT_FORMATION } from "@/lib/star/formations";
import { generateForBoardroomSale } from "@/lib/star/media/feed";
import { getCareer, setCareer } from "../game/store";
import { settle } from "../game/flow";

export interface ActionResult { ok: boolean; reason?: string }

export type PendingVote =
  | { kind: "sellPlayer"; proposal: SellPlayerVoteProposal }
  | { kind: "kit"; proposal: KitVoteProposal }
  | { kind: "president"; proposal: PresidentVoteProposal }
  | { kind: "ruleChange"; proposal: RuleChangeProposal }
  | { kind: "bodyPresidency"; proposal: PresidencyVoteProposal };

export type BoardSection = "squad" | "sign" | "manager" | "powers" | "history";
/** Where the Investments screen opens (page.tsx's investmentsEntry). */
export interface InvestmentsEntry { tab?: "market" | "portfolio" | "boardroom"; club?: string; section?: BoardSection }
/** After the ceremony: back to the club's boardroom, or to the Rule Book. */
export type VoteBack = { screen: "investments"; params: InvestmentsEntry } | { screen: "rule-book"; params?: undefined };

const NO_CAREER: ActionResult = { ok: false, reason: "No active career" };

function save(next: CareerState) { setCareer(next); settle(); }

/** Run a lib action that returns { ok, career, reason }. */
function board(fn: (c: CareerState) => { ok: boolean; career: CareerState; reason?: string }): ActionResult {
  const c = getCareer();
  if (!c) return NO_CAREER;
  const r = fn(c);
  if (r.ok) save(r.career);
  return { ok: r.ok, reason: r.reason };
}
/** Run a lib action that returns the new career or { ok: false, reason }. */
function either(fn: (c: CareerState) => CareerState | { ok: false; reason: string }): ActionResult {
  const c = getCareer();
  if (!c) return NO_CAREER;
  const r = fn(c);
  if ("ok" in r) return r;
  save(r);
  return { ok: true };
}

// ── Stakes ──────────────────────────────────────────────────────────────────
export const buy = (club: string, percent: number) => { const c = getCareer(); if (c) save(buyStake(c, club, percent)); };
export const sell = (club: string, percent: number) => { const c = getCareer(); if (c) save(sellStake(c, club, percent)); };
export const topUp = (club: string, amount: number) => { const c = getCareer(); if (c) save(topUpClubBudget(c, club, amount)); };
export const recommend = (club: string, kind: RecommendationKind, detail: string) => either((c) => submitRecommendation(c, club, kind, detail));

// ── The boardroom ───────────────────────────────────────────────────────────
export const signPlayer = (club: string, playerId: string, fromClub: string, agreedFee?: number) =>
  board((c) => signPlayerForOwnedClub(c, club, playerId, fromClub, agreedFee));

/** A boardroom sale to a named buyer is real transfer news (page.tsx). */
export function sellPlayer(club: string, playerId: string, agreedFee?: number, buyerClub?: string): ActionResult {
  const c = getCareer();
  if (!c) return NO_CAREER;
  const playerName = findSquadEntry(c, club)?.squad.players.find((p) => p.id === playerId)?.name;
  const r = sellPlayerFromOwnedClub(c, club, playerId, agreedFee, buyerClub);
  if (!r.ok) return { ok: false, reason: r.reason };
  let next = r.career;
  if (buyerClub && agreedFee !== undefined && playerName) {
    next = { ...next, media: generateForBoardroomSale(next, club, buyerClub, playerName, agreedFee, `boardroom-sale-${playerId}`) };
  }
  save(next);
  return { ok: true };
}

export function proposeSellVote(club: string, playerId: string, agreedFee?: number, buyerClub?: string): { ok: true; vote: PendingVote } | { ok: false; reason?: string } {
  const c = getCareer();
  if (!c) return { ok: false, reason: NO_CAREER.reason };
  const rng = mulberry32(c.season * 91721 + c.week * 131 + playerId.length);
  const r = proposeSellPlayerVote(c, club, playerId, rng, agreedFee, buyerClub);
  return r.ok ? { ok: true, vote: { kind: "sellPlayer", proposal: r.proposal } } : { ok: false, reason: r.reason };
}

/** The appointment is written into the saved lineup too, so every screen shows him (page.tsx). */
export function replaceManager(club: string, managerName: string, agreedFee?: number): ActionResult {
  const c = getCareer();
  if (!c) return NO_CAREER;
  const r = replaceManagerForOwnedClub(c, club, managerName, agreedFee);
  if (r.ok) {
    save(r.career);
    const existing = loadLineup(club);
    saveLineup(club, { formation: existing?.formation ?? DEFAULT_FORMATION, xi: existing?.xi ?? Array(11).fill(null), bench: existing?.bench, manager: managerName });
  }
  return { ok: r.ok, reason: r.reason };
}
export const managerTalksFailed = (club: string, managerName: string) => { const c = getCareer(); if (c) save(recordFailedManagerNegotiation(c, club, managerName)); };

export const setFormation = (club: string, formationId: string) => board((c) => setClubFormation(c, club, formationId));
export const setLineup = (club: string, lineup: SavedLineup) => board((c) => setOwnedLineup(c, club, lineup));
export const selfCaptain = (club: string) => board((c) => appointSelfCaptain(c, club));
export const talisman = (club: string, on: boolean) => board((c) => setTalisman(c, club, on));
export const transferSelf = (toClub: string) => board((c) => transferSelfTo(c, toClub));
export const setKit = (club: string, kit: ClubKit) => board((c) => setClubKit(c, club, kit));
export const presidentWage = (club: string, wage: number) => board((c) => setPresidentWage(c, club, wage));
export const merge = (primary: string, absorbed: string) => board((c) => mergeClubs(c, primary, absorbed));
export const son = () => either((c) => haveASon(c));
export const sonPotion = () => either((c) => ageUpSonWithPotion(c, mulberry32(c.season * 61519 + c.week * 419 + (c.son?.age ?? 0))));
export const promoteSon = (club: string) => board((c) => promoteSonToFirstTeam(c, club));
export const moveSon = (toClub: string) => board((c) => transferSon(c, toClub));
export const rename = (club: string, name: string) => board((c) => renameStadium(c, club, name));
export const moreSeats = (club: string) => board((c) => upgradeStadiumCapacity(c, club));
export const training = (club: string) => board((c) => upgradeTrainingGround(c, club));
export const academy = (club: string) => board((c) => upgradeYouthAcademy(c, club));

export function proposeKit(club: string, a: ClubKit, b: ClubKit, favor: "a" | "b" | undefined): { ok: true; vote: PendingVote } | { ok: false; reason?: string } {
  const c = getCareer();
  if (!c) return { ok: false, reason: NO_CAREER.reason };
  const r = proposeKitVote(c, club, a, b, favor, mulberry32(c.season * 40361 + c.week * 211 + club.length));
  return r.ok ? { ok: true, vote: { kind: "kit", proposal: r.proposal } } : { ok: false, reason: r.reason };
}
export function standForPresident(club: string): { ok: true; vote: PendingVote } | { ok: false; reason?: string } {
  const c = getCareer();
  if (!c) return { ok: false, reason: NO_CAREER.reason };
  const r = proposePresidentVote(c, club, mulberry32(c.season * 20887 + c.week * 307 + club.length));
  return r.ok ? { ok: true, vote: { kind: "president", proposal: r.proposal } } : { ok: false, reason: r.reason };
}

// ── The Rule Book ───────────────────────────────────────────────────────────
export const investIn = (body: GoverningBody, amount: number) => either((c) => investInfluence(c, body, amount));

/** An optional bribe sways the tally toward yes, at a real risk of getting caught (page.tsx). */
export function proposeRule(body: GoverningBody, change: Partial<RuleBook>, bribe?: { amount: number; useLawyers: boolean }): { ok: true; vote: PendingVote } | { ok: false; reason?: string } {
  const c = getCareer();
  if (!c) return { ok: false, reason: NO_CAREER.reason };
  const r = proposeRuleChangeVote(c, body, change, mulberry32(c.season * 82301 + c.week * 523 + JSON.stringify(change).length));
  if (!r.ok) return { ok: false, reason: r.reason };
  let proposal = r.proposal;
  let working = c;
  if (bribe && bribe.amount > 0) {
    const total = bribe.amount + (bribe.useLawyers ? LAWYER_FEE : 0);
    if (total > working.money) return { ok: false, reason: "Not enough money for that bribe" };
    working = { ...working, money: working.money - total };
    proposal = { ...proposal, tally: bribeVote(proposal.tally, "yes", bribe.amount) };
    if (rollCaught("bribery", bribe.useLawyers, mulberry32(c.season * 61001 + c.week * 907 + bribe.amount))) {
      working = applyGettingCaught(working, "bribery", bribe.amount, "Caught bribing a governing-body vote");
    }
  }
  save(working);
  return { ok: true, vote: { kind: "ruleChange", proposal } };
}
export function standForBody(body: GoverningBody): { ok: true; vote: PendingVote } | { ok: false; reason?: string } {
  const c = getCareer();
  if (!c) return { ok: false, reason: NO_CAREER.reason };
  const r = proposeBodyPresidencyVote(c, body, mulberry32(c.season * 13291 + c.week * 733 + body.length));
  return r.ok ? { ok: true, vote: { kind: "bodyPresidency", proposal: r.proposal } } : { ok: false, reason: r.reason };
}
export const forceIntoPremierLeague = (club: string) => board((c) => forceClubIntoPremierLeague(c, club));
export function newCompetition(name: string, entrants: string[]): ActionResult {
  const c = getCareer();
  if (!c) return NO_CAREER;
  const created = createCompetition(`comp-${c.season}-${(c.newCompetitions ?? []).length}`, name, entrants);
  if ("ok" in created) return created;
  const strengthOf = (club: string) => c.league.find((t) => t.name === club)?.strength ?? 70;
  const finished = playCompetitionToWinner(created, strengthOf, mulberry32(c.season * 71011 + c.week * 617 + name.length));
  save({ ...c, newCompetitions: [...(c.newCompetitions ?? []), finished] });
  return { ok: true };
}

// ── The ceremony ────────────────────────────────────────────────────────────
export function canOverrule(c: CareerState, v: PendingVote): boolean {
  return v.kind === "kit" ? false
    : v.kind === "ruleChange" ? canOverruleRuleVote(c, v.proposal.body)
    : v.kind === "bodyPresidency" ? canOverrulePresidencyVote(c, v.proposal.body)
    : canOverruleClubVote(c, v.proposal.club);
}
export const voteScope = (v: PendingVote) => (v.kind === "kit" ? "fans" : v.kind === "ruleChange" || v.kind === "bodyPresidency" ? "governing-body" : "boardroom") as "fans" | "governing-body" | "boardroom";
export const voteSuccessId = (v: PendingVote) => (v.kind === "kit" ? (v.proposal.favor === "b" ? "b" : v.proposal.favor === "a" ? "a" : undefined) : "yes");
/** Where page.tsx goes after the vote (backTo + investmentsEntry). */
export function voteBack(v: PendingVote): VoteBack {
  if (v.kind === "ruleChange" || v.kind === "bodyPresidency") return { screen: "rule-book" };
  return { screen: "investments", params: { tab: "boardroom", club: v.proposal.club, section: v.kind === "sellPlayer" ? "squad" : "powers" } };
}

/** page.tsx handleVoteDone. */
export function resolveVote(v: PendingVote, overrule: boolean): void {
  const c = getCareer();
  if (!c) return;
  const result = v.kind === "sellPlayer" ? resolveSellPlayerVote(c, v.proposal, overrule)
    : v.kind === "kit" ? { career: resolveKitVote(c, v.proposal), ok: true as const }
    : v.kind === "president" ? resolvePresidentVote(c, v.proposal, overrule)
    : v.kind === "bodyPresidency" ? resolveBodyPresidencyVote(c, v.proposal, overrule)
    : resolveRuleChangeVote(c, v.proposal, overrule);
  let next = result.career;
  if (v.kind === "sellPlayer" && result.ok && v.proposal.buyerClub) {
    const { club, buyerClub, playerName, fee, playerId } = v.proposal;
    next = { ...next, media: generateForBoardroomSale(next, club, buyerClub, playerName, fee, `boardroom-sale-${playerId}`) };
  }
  save(next);
}
