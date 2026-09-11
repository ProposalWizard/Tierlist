import type { CareerState, LeaguePlayer } from "./types";
import {
  isMajorityOwner, stakeIn, ownedClubState, findSquadEntry, setSquad,
  clubStrengthFromPlayers, canOverruleClubVote, type BoardActionResult,
} from "./investments";
import { castVote, applyVoteHeldReputation, applyOverruleReputationCost, type VoteTally } from "./voting";
import { clampReputation } from "./reputation";
import { FORMATIONS, DEFAULT_FORMATION, formationOf, autoPick, bestFitness } from "./formations";
import { getTuning } from "./tuningStore";

/**
 * PHASE 3 OF STAR_POWER_POLITICS.MD — DEEPENING CLUB OWNERSHIP.
 *
 * Everything §2 asked for beyond the majority-owner sign/sell/manager
 * actions investments.ts already had: minority-shareholder recommendations,
 * setting a club's formation as its de facto manager, a kit creator plus a
 * real public vote on it, a shareholder-elected presidency (and the wage
 * that comes with it), the §4.5 aging-up "son" mechanic (cleared in Phase 0
 * — fictional, a potion/magic effect on a game character, not a real
 * depiction of doping a child), and club takeovers/mergers. Scoped to YOUR
 * OWN club and clubs you can buy outright — no governing bodies yet (that's
 * Phase 4). Built on Phase 1's reputation and Phase 2's voting engine,
 * reusing both rather than inventing parallel versions.
 *
 * ── Why this is its own file, not more of investments.ts ──
 *
 * investments.ts's own header already draws a line around itself: buying a
 * stake and the majority-owner sign/sell/manager trio. This is a distinct,
 * later-arriving layer on top of it — reusing its exports rather than
 * growing that file past what its own name still honestly describes.
 */

// ── A. Minority-shareholder recommendations ─────────────────────────────────

export type RecommendationKind = "sign" | "formation" | "manager" | "wage";

export interface Recommendation {
  id: string;
  club: string;
  kind: RecommendationKind;
  /** Free text describing the ask — "sign a left-back", "switch to 4-3-3" —
   *  since this engine doesn't simulate a second club's transfer market or
   *  tactics deeply enough to validate the specifics; see this file's own
   *  header and investments.ts's on why that's an honest choice, not a gap. */
  detail: string;
  season: number;
  status: "pending" | "adopted" | "dismissed";
}

/** How many past recommendations stay on file — old ones are kept for the
 *  record, not because anything still reads them, so this is a plain cap
 *  rather than a real archive. */
const RECOMMENDATION_HISTORY_CAP = 30;

/**
 * A shareholder BELOW majority can only recommend, never force — the
 * brief's own framing: "I think we should sign a left back... not
 * guaranteed, framed as influence, not control." A majority owner already
 * has the real sign/sell/manager actions and has no need of this one.
 */
export function submitRecommendation(
  career: CareerState, club: string, kind: RecommendationKind, detail: string,
): CareerState | { ok: false; reason: string } {
  if (!stakeIn(career, club)) return { ok: false, reason: "You don't hold a stake in this club" };
  if (isMajorityOwner(career, club)) return { ok: false, reason: "A majority owner acts directly, not by recommendation" };
  const rec: Recommendation = {
    id: `${club}:${kind}:${career.season}:${(career.recommendations ?? []).length}`,
    club, kind, detail, season: career.season, status: "pending",
  };
  const kept = [...(career.recommendations ?? []), rec].slice(-RECOMMENDATION_HISTORY_CAP);
  return { ...career, recommendations: kept };
}

/**
 * The board "considers" every pending recommendation once a season — called
 * from advanceSeason. Adoption is a real roll, biased by shareholder
 * reputation the same way a vote's odds are, but deliberately NOT a full
 * vote/ceremony: the brief frames this as an informal, low-stakes nudge
 * ("the club might get on board with it"), not a formal shareholders'
 * meeting. Adopting one is a small real reputation reward — "letting people
 * feel heard" pays off even at this lightweight a scale; dismissing one
 * costs nothing, since making a non-binding suggestion was never a risk.
 */
export function considerRecommendations(career: CareerState, rng: () => number): CareerState {
  const pending = (career.recommendations ?? []).filter(r => r.status === "pending");
  if (pending.length === 0) return career;
  const swing = (career.reputation.shareholders - 50) / 100; // -0.5..0.5
  const chance = Math.max(0.1, Math.min(0.8, 0.35 + swing * 0.6));
  let reputation = career.reputation;
  const byId = new Map(pending.map(r => [r.id, r]));
  for (const r of pending) {
    const adopted = rng() < chance;
    byId.set(r.id, { ...r, status: adopted ? "adopted" : "dismissed" });
    if (adopted) reputation = { ...reputation, shareholders: clampReputation(reputation.shareholders + 1) };
  }
  const recommendations = (career.recommendations ?? []).map(r => byId.get(r.id) ?? r);
  return { ...career, recommendations, reputation };
}

// ── B. Formation as manager ──────────────────────────────────────────────

/** Set the formation a majority-owned club plays — the "you are able to
 *  become a manager in your team" power. Purely a majority-owner action;
 *  same gate every other Boardroom action already uses. */
export function setClubFormation(career: CareerState, club: string, formationId: string): BoardActionResult {
  if (!isMajorityOwner(career, club)) return { career, ok: false, reason: "Not the majority shareholder" };
  if (!FORMATIONS.some(f => f.id === formationId)) return { career, ok: false, reason: "Not a real formation" };
  const current = ownedClubState(career, club);
  return {
    career: { ...career, ownedClubs: { ...(career.ownedClubs ?? {}), [club]: { ...current, formation: formationId } } },
    ok: true,
  };
}

/** How well the picked XI actually suits the chosen shape, averaged across
 *  the eleven `autoPick` would actually field in it — reusing the exact
 *  fitness math the real team-sheet screen already trusts, rather than a
 *  second, invented "tactics quality" number. */
function pickedXIFitness(players: LeaguePlayer[], formationId: string): number {
  const formation = formationOf(formationId);
  const picks = autoPick(players, formation);
  const byId = new Map(players.map(p => [p.id, p]));
  const fits: number[] = [];
  formation.slots.forEach((slot, i) => {
    const id = picks[i];
    const p = id ? byId.get(id) : undefined;
    if (p) fits.push(bestFitness(slot.role, p));
  });
  return fits.length ? fits.reduce((a, b) => a + b, 0) / fits.length : 74;
}

/**
 * A club's real strength, WITH its chosen formation's fit folded in — a
 * small, bounded adjustment (±3) on top of `clubStrengthFromPlayers`'s
 * ordinary XI average, never a second, parallel strength number. Read-time
 * only: nothing writes this back into `LeagueTeam.strength` itself, which
 * stays exactly what `syncLeagueStrengthFromSquads` already computes it as
 * everywhere else — this is deliberately a governance-screen-only view, not
 * a rewrite of how the real season simulation rates the club.
 */
export function clubStrengthWithFormation(career: CareerState, club: string): number {
  const entry = findSquadEntry(career, club);
  if (!entry) return clubStrengthFromPlayers([]);
  const base = clubStrengthFromPlayers(entry.squad.players);
  const formationId = ownedClubState(career, club).formation ?? DEFAULT_FORMATION;
  const fit = pickedXIFitness(entry.squad.players, formationId);
  const bonus = Math.max(-3, Math.min(3, Math.round((fit - 74) / 6)));
  return base + bonus;
}

// ── C. Kit creator + a real public kit vote ─────────────────────────────────

export interface ClubKit {
  primary: string;
  secondary: string;
  trim: string;
}

/** However many "fans" actually vote — same stylised stand-in
 *  `investments.ts`'s shareholder electorate uses, just bigger: a kit vote
 *  is explicitly "thousands and thousands of fans," not a boardroom. */
const FAN_ELECTORATE = 8000;
/** Letting fans decide a kit design is worth a little real fan goodwill,
 *  same "being heard is itself worth something" logic voting.ts's
 *  shareholder version already uses, at fan scale rather than shareholder
 *  scale. */
const KIT_VOTE_FAN_GAIN = 2;

export function clubKitFor(career: CareerState, club: string): ClubKit | null {
  return career.clubKits?.[club] ?? null;
}

/** Set a kit directly — a majority owner's unilateral option, same tier as
 *  forcing a transfer through rather than recommending it. */
export function setClubKit(career: CareerState, club: string, kit: ClubKit): BoardActionResult {
  if (!isMajorityOwner(career, club)) return { career, ok: false, reason: "Not the majority shareholder" };
  return { career: { ...career, clubKits: { ...(career.clubKits ?? {}), [club]: kit } }, ok: true };
}

export interface KitVoteProposal {
  club: string;
  optionA: ClubKit;
  optionB: ClubKit;
  tally: VoteTally;
}

/** Put two kit designs to the fans instead of just picking one — the real
 *  vote is decided here (see voting.ts's own note on why); `favor` lets the
 *  owner nominate the one they'd rather see win, biased by FAN reputation
 *  (`relationships.fans`), never guaranteed. */
export function proposeKitVote(
  career: CareerState, club: string, optionA: ClubKit, optionB: ClubKit,
  favor: "a" | "b" | undefined, rng: () => number,
): { ok: true; proposal: KitVoteProposal } | { ok: false; reason: string } {
  if (!isMajorityOwner(career, club)) return { ok: false, reason: "Not the majority shareholder" };
  const biasStrength = favor ? (career.relationships.fans - 50) / 50 : 0;
  const favoredId = favor === "a" ? "a" : favor === "b" ? "b" : undefined;
  const tally = castVote(
    "Which kit should we wear next season?",
    [{ id: "a", label: "Design A" }, { id: "b", label: "Design B" }],
    FAN_ELECTORATE, favoredId, biasStrength, rng,
  );
  return { ok: true, proposal: { club, optionA, optionB, tally } };
}

export function resolveKitVote(career: CareerState, proposal: KitVoteProposal): CareerState {
  const kit = proposal.tally.winner === "a" ? proposal.optionA : proposal.optionB;
  return {
    ...career,
    clubKits: { ...(career.clubKits ?? {}), [proposal.club]: kit },
    relationships: { ...career.relationships, fans: clampReputation(career.relationships.fans + KIT_VOTE_FAN_GAIN) },
  };
}

// ── D. Shareholder-elected club president ───────────────────────────────────

/** Shareholders vote on YOU specifically, not on an action — a formally
 *  voted role "distinct from just owning >50%," so standing for it needs
 *  majority control first (you can't credibly run a club's boardroom you
 *  don't already control) but is not the same thing as already holding it. */
const PRESIDENT_ELECTORATE = 640;

export interface PresidentVoteProposal {
  club: string;
  tally: VoteTally;
}

export function proposePresidentVote(
  career: CareerState, club: string, rng: () => number,
): { ok: true; proposal: PresidentVoteProposal } | { ok: false; reason: string } {
  if (!isMajorityOwner(career, club)) return { ok: false, reason: "Not the majority shareholder" };
  if (ownedClubState(career, club).isPresident) return { ok: false, reason: "Already president" };
  const biasStrength = (career.reputation.shareholders - 50) / 50;
  const tally = castVote(
    "Elect you as club president?",
    [{ id: "yes", label: "Elect" }, { id: "no", label: "Reject" }],
    PRESIDENT_ELECTORATE, "yes", biasStrength, rng,
  );
  return { ok: true, proposal: { club, tally } };
}

export function resolvePresidentVote(
  career: CareerState, proposal: PresidentVoteProposal, overrule: boolean,
): BoardActionResult {
  let next = { ...career, reputation: applyVoteHeldReputation(career.reputation) };
  const passed = proposal.tally.winner === "yes";
  if (!passed && overrule) {
    if (!canOverruleClubVote(next, proposal.club)) {
      return { career: next, ok: false, reason: "Not enough ownership to overrule this vote" };
    }
    next = { ...next, reputation: applyOverruleReputationCost(next.reputation) };
  } else if (!passed) {
    return { career: next, ok: false, reason: "The shareholders voted against you" };
  }
  const current = ownedClubState(next, proposal.club);
  return {
    career: { ...next, ownedClubs: { ...(next.ownedClubs ?? {}), [proposal.club]: { ...current, isPresident: true } } },
    ok: true,
  };
}

// ── E. Choosing your own wage, once president ───────────────────────────────

/** Only a real president — the formally elected role, not bare majority
 *  ownership — can choose a wage; the brief is explicit this is reserved
 *  for "a position of extreme power," not majority control on its own. */
export function setPresidentWage(career: CareerState, club: string, wage: number): BoardActionResult {
  const current = ownedClubState(career, club);
  if (!current.isPresident) return { career, ok: false, reason: "Not the club president" };
  if (wage < 0) return { career, ok: false, reason: "A wage can't be negative" };
  return {
    career: { ...career, ownedClubs: { ...(career.ownedClubs ?? {}), [club]: { ...current, presidentWage: wage } } },
    ok: true,
  };
}

/**
 * Pay every president wage this season — called from advanceSeason. The
 * wage comes straight out of the CLUB's own budget, capped at what's
 * actually there (a club can't be run into debt to pay it), and lands in
 * the player's own money — "the higher the wage, the more it drains the
 * club's own finances," read literally.
 */
export function payPresidentWages(career: CareerState): CareerState {
  const owned = career.ownedClubs ?? {};
  let money = career.money;
  let changed = false;
  const nextOwned = { ...owned };
  for (const [club, state] of Object.entries(owned)) {
    if (!state.isPresident || !state.presidentWage) continue;
    const paid = Math.min(state.presidentWage, state.budget);
    if (paid <= 0) continue;
    nextOwned[club] = { ...state, budget: state.budget - paid };
    money += paid;
    changed = true;
  }
  return changed ? { ...career, money, ownedClubs: nextOwned } : career;
}

// ── F. §4.5 — the aging-up "son" mechanic ───────────────────────────────────
//
// Cleared in Phase 0: a fictional, potion/magic-based ageing effect on a
// game character, framed like a wonderkid rather than anything literal —
// not a depiction of doping a real child. See STAR_POWER_POLITICS.md §4.5.

export interface SonState {
  name: string;
  age: number;
  overall: number;
  /** Which club's real squad he's actually playing in, once promoted. Null
   *  until then — he exists, but isn't on any team sheet yet. */
  club: string | null;
  /** His id inside that club's squad, once promoted — needed to find and
   *  move him later without hunting by name. */
  playerId: string | null;
}

const HAVE_A_SON_COST = 500;
const SON_START_AGE = 0;
const SON_START_OVERALL = 35;
/** However many times you use the potion, he never plays before this age —
 *  a floor, not a suggestion: "promote him into the first team" only makes
 *  sense of somebody old enough to plausibly be on one. */
const SON_MIN_PROMOTION_AGE = 16;
const SON_OVERALL_CAP = 92;

export function haveASon(career: CareerState): CareerState | { ok: false; reason: string } {
  if (career.son) return { ok: false, reason: "You already have a son" };
  if (career.money < HAVE_A_SON_COST) return { ok: false, reason: "Not enough money" };
  return {
    ...career,
    money: career.money - HAVE_A_SON_COST,
    son: { name: `${career.player.lastName} Junior`, age: SON_START_AGE, overall: SON_START_OVERALL, club: null, playerId: null },
  };
}

/**
 * The potion — a real, if modest, cost every time, and a real random
 * jump in both age and ability, capped so he never simply becomes a
 * finished superstar in one sitting. Can be used again after he's already
 * on a team sheet ("give him growth hormones to increase his age and
 * ability" is not framed as a one-off), which is why this doesn't require
 * `son.club === null`.
 */
export function ageUpSonWithPotion(career: CareerState, rng: () => number): CareerState | { ok: false; reason: string } {
  if (!career.son) return { ok: false, reason: "You don't have a son yet" };
  const cost = 200 + career.son.age * 40;
  if (career.money < cost) return { ok: false, reason: "Not enough money for the potion" };
  const ageGain = 3 + Math.floor(rng() * 6); // 3-8
  const overallGain = 2 + Math.floor(rng() * 7); // 2-8
  const son: SonState = {
    ...career.son,
    age: career.son.age + ageGain,
    overall: Math.min(SON_OVERALL_CAP, career.son.overall + overallGain),
  };
  let next: CareerState = { ...career, money: career.money - cost, son };
  // A promoted son already on a real team sheet stays in sync — the same
  // squad entry the transfer engine and every match reads is updated here,
  // not just the private `son` record, so the potion's effect is real on
  // the pitch and not just a number nobody else sees.
  if (son.club && son.playerId) {
    const entry = findSquadEntry(next, son.club);
    if (entry) {
      const players = entry.squad.players.map(p => (p.id === son.playerId ? { ...p, overall: son.overall } : p));
      next = setSquad(next, son.club, players);
    }
  }
  return next;
}

/**
 * Into the first team of a club you actually own — "your own team," read
 * literally. Requires majority ownership (full unilateral control, the
 * same tier that already lets you force a transfer through) and a real
 * floor on age so this can't put a toddler on the pitch.
 */
export function promoteSonToFirstTeam(career: CareerState, club: string): BoardActionResult {
  if (!career.son) return { career, ok: false, reason: "You don't have a son" };
  if (career.son.club) return { career, ok: false, reason: "He's already on a team" };
  if (career.son.age < SON_MIN_PROMOTION_AGE) return { career, ok: false, reason: "He's not old enough yet — use the potion first" };
  if (!isMajorityOwner(career, club)) return { career, ok: false, reason: "Not the majority shareholder" };
  const entry = findSquadEntry(career, club);
  if (!entry) return { career, ok: false, reason: "No squad data on file for this club" };
  const playerId = `son:${career.son.name}:${club}`;
  const player: LeaguePlayer = { id: playerId, name: career.son.name, position: "ST", overall: career.son.overall, goals: 0, assists: 0 };
  const next = setSquad(career, club, [...entry.squad.players, player]);
  return { career: { ...next, son: { ...career.son, club, playerId } }, ok: true };
}

/**
 * Move him wherever you want, because you're his dad — read as literally
 * as the rest of this mechanic: no fee, no vote, no ownership requirement
 * on the DESTINATION (only that it has a real squad on file to place him
 * in) — a deliberately different rule from every other transfer in this
 * game, exactly because the brief frames this one power as total and
 * personal rather than another instance of ordinary club business.
 */
export function transferSon(career: CareerState, toClub: string): BoardActionResult {
  if (!career.son?.club || !career.son.playerId) return { career, ok: false, reason: "He isn't on a team yet" };
  if (toClub === career.son.club) return { career, ok: false, reason: "He's already there" };
  const fromEntry = findSquadEntry(career, career.son.club);
  const toEntry = findSquadEntry(career, toClub);
  if (!toEntry) return { career, ok: false, reason: "No squad data on file for that club" };
  const playerId = career.son.playerId;
  const moving = fromEntry?.squad.players.find(p => p.id === playerId);
  if (!moving) return { career, ok: false, reason: "He isn't in his old squad anymore" };
  let next = career;
  if (fromEntry) next = setSquad(next, career.son.club, fromEntry.squad.players.filter(p => p.id !== playerId));
  next = setSquad(next, toClub, [...toEntry.squad.players, moving]);
  return { career: { ...next, son: { ...career.son, club: toClub } }, ok: true };
}

// ── G. Club takeovers/mergers ────────────────────────────────────────────

/** Full assets absorption needs full control of BOTH sides — this is the
 *  hardest, most irreversible action in the whole ownership layer, so the
 *  bar is 100%, not bare majority. */
export function canMergeClubs(career: CareerState, primaryClub: string, absorbedClub: string): boolean {
  if (primaryClub === absorbedClub) return false;
  if ((stakeIn(career, primaryClub)?.percent ?? 0) < 100) return false;
  if ((stakeIn(career, absorbedClub)?.percent ?? 0) < 100) return false;
  if (ownedClubState(career, absorbedClub).dissolvedInto) return false;
  return true;
}

/** How much a merger costs in fan goodwill — the brief's own framing: a
 *  real chunk of the absorbed side's fans hate you for "stealing their
 *  club." No fabricated "fanbase size" stat exists here to model the
 *  matching net GAIN precisely (see this function's own note below), so
 *  this only ever moves the one real number this engine actually has. */
const MERGER_FAN_COST = 15;

/**
 * Buy out, dissolve, and absorb — full squad merge (best players up to the
 * normal squad cap survive; a real cost of an ambitious takeover, not a
 * free doubling of talent), combined budgets, and a real fan-reputation
 * hit. Deliberately does NOT remove `absorbedClub` from the world
 * (clubs.ts's fixed lists, the ladder's fixed division sizes — see
 * promotion.ts's own reconcileLadder, which exists specifically to defend
 * those exact counts) — it keeps its league slot and, like every other
 * unowned club, is never simulated deeply enough for that to matter; it is
 * simply marked `dissolvedInto` so nothing lets you invest in or govern it
 * again. An honest simplification, the same kind investments.ts's own
 * header already commits to rather than faking a second club-removal
 * system this engine has nowhere real to put.
 */
export function mergeClubs(career: CareerState, primaryClub: string, absorbedClub: string): BoardActionResult {
  if (!canMergeClubs(career, primaryClub, absorbedClub)) {
    return { career, ok: false, reason: "Both clubs must be fully (100%) owned to merge them" };
  }
  const primaryEntry = findSquadEntry(career, primaryClub);
  const absorbedEntry = findSquadEntry(career, absorbedClub);
  if (!primaryEntry || !absorbedEntry) return { career, ok: false, reason: "No squad data on file for one of these clubs" };

  const target = getTuning("transfers.squadTarget");
  const combined = [...primaryEntry.squad.players, ...absorbedEntry.squad.players]
    .sort((a, b) => b.overall - a.overall)
    .slice(0, target);

  let next = setSquad(career, primaryClub, combined);
  next = setSquad(next, absorbedClub, []);

  const primaryBudget = ownedClubState(next, primaryClub).budget;
  const absorbedBudget = ownedClubState(next, absorbedClub).budget;
  next = {
    ...next,
    ownedClubs: {
      ...(next.ownedClubs ?? {}),
      [primaryClub]: { ...ownedClubState(next, primaryClub), budget: primaryBudget + absorbedBudget },
      [absorbedClub]: { ...ownedClubState(next, absorbedClub), budget: 0, dissolvedInto: primaryClub },
    },
    relationships: { ...next.relationships, fans: clampReputation(next.relationships.fans - MERGER_FAN_COST) },
  };
  return { career: next, ok: true };
}
