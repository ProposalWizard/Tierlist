/**
 * WHO IS IN YOUR HOUSE TODAY (docs/plans/PEOPLE_AND_MEMORY_PLAN.md section 3a; Harry, 27 Nov 2026:
 * "there doesn't need to ALWAYS be an NPC in my house").
 *
 * The house is empty unless there is a reason. A seeded planner decides each day:
 *   - a team-mate drops round on a free afternoon: in a flat about 4 days in 10 (so nobody comes on
 *     about 6 in 10), more often in a bigger home (DROP_IN). Never on match day.
 *   - a team-mate you texted "come round?" comes at the time you picked, if he said yes.
 *   - the cleaner, at the House tier and up: Monday and Thursday mornings, 09:00 to 12:00.
 *   - the chef, at the Villa and the Estate: lunch 11:00 to 13:40, dinner 17:00 to 20:40.
 * (Harry's question 5, the recommended answer: staff by home. A partner, family and the gardener
 * come with later phases.) It reads the save; it never invents a person: team-mates are your squad.
 * The same day plays the same way on any device. Pure. Test: tests/star/dayPlan.mts.
 */
import type { CareerState } from "../types";
import type { HomeTier, RoomId } from "../home3d/homes";
import { HOME_TIERS, homeTierOf, livingOn, roomsFor } from "../home3d/homes";
import { seeded, hashId } from "../world3d/routine";
import { planVisit, whereAt, type VStep } from "./houseRoutines";
import { clockOf, dateOf, dayNumber, nextMatchInfo } from "./clock";

/** Chance a team-mate drops round on a free day, by home (1 - this = the empty days). */
export const DROP_IN: Record<HomeTier, number> = { starter: 0.4, flat: 0.4, penthouse: 0.45, house: 0.5, villa: 0.55, estate: 0.6 };
/** No visitor this close to kick-off (minutes). */
export const NO_VISIT_BEFORE_KO = 240;
/** How long an invited team-mate stays (minutes). */
export const INVITE_STAY = 150;

export type VisitorRole = "mate" | "chef" | "cleaner";

const CHEF_NAMES = ["Marta", "Luis", "Grace", "Paolo", "Ana"];
const CLEANER_NAMES = ["Joan", "Sandra", "Ewa", "Rosa", "Pat"];

export interface HouseVisit {
  /** Unique on the day ("mate-<id>", "chef-lunch"…). */
  id: string;
  who: VisitorRole;
  name: string;
  /** A team-mate: his squad id. */
  mateId?: string;
  from: number;
  to: number;
  /** Why he is here (the Today list). */
  why: string;
  steps: VStep[];
}

export interface DayInput {
  tier: HomeTier;
  rooms: RoomId[];
  mates: { id: string; name: string }[];
  /** A day number that never repeats (clock.ts dayNumber): the seed. */
  dayNo: number;
  /** 0 Sunday … 6 Saturday. */
  dow: number;
  /** Kick-off minute if today is match day, else null. */
  matchKo: number | null;
  /** A team-mate you texted for today. */
  invite?: { at: number; mateId: string; yes: boolean } | null;
  /** The career's own seed text (the player), so two careers have different days. */
  seed: string;
}

const tierRank = (t: HomeTier) => HOME_TIERS.indexOf(t);

/** The day's visits, staff first (a team-mate can have a word with the chef). */
export function dayPlan(inp: DayInput): HouseVisit[] {
  const r = seeded(hashId(`${inp.seed}|${inp.dayNo}`));
  const out: HouseVisit[] = [];
  const seed = hashId(`${inp.seed}|${inp.dayNo}|plan`);
  const latest = inp.matchKo !== null ? inp.matchKo - NO_VISIT_BEFORE_KO : 24 * 60;
  const staff = (id: string, who: VisitorRole, name: string, from: number, to: number, why: string) => {
    if (to > latest + NO_VISIT_BEFORE_KO - 150) return; // staff go home before you leave for a match
    out.push({ id, who, name, from, to, why, steps: planVisit(who, id, from, to, inp.rooms, seed, { tier: inp.tier }) });
  };
  // the same chef and cleaner every day of a career (named once, from the career's seed)
  const chef = CHEF_NAMES[hashId(`${inp.seed}|chef`) % CHEF_NAMES.length];
  const cleaner = CLEANER_NAMES[hashId(`${inp.seed}|cleaner`) % CLEANER_NAMES.length];
  if (tierRank(inp.tier) >= tierRank("villa")) {
    staff("chef-lunch", "chef", chef, 11 * 60, 13 * 60 + 40, "Your chef, cooking lunch");
    staff("chef-dinner", "chef", chef, 17 * 60, 20 * 60 + 40, "Your chef, cooking dinner");
  }
  if (tierRank(inp.tier) >= tierRank("house") && (inp.dow === 1 || inp.dow === 4)) staff("cleaner", "cleaner", cleaner, 9 * 60, 12 * 60, "Your cleaner");
  const others = out.map((v) => ({ id: v.id, kind: v.who, at: (id: string, m: number) => whereAt(out.find((x) => x.id === id)!.steps, m)?.step ?? null }));
  const mateVisit = (mate: { id: string; name: string }, from: number, to: number, why: string) => {
    if (to > latest) to = latest;
    if (to - from < 30) return;
    out.push({ id: `mate-${mate.id}`, who: "mate", name: mate.name, mateId: mate.id, from, to, why, steps: planVisit("mate", mate.id, from, to, inp.rooms, seed, { tier: inp.tier, others }) });
  };
  const roll = r(), pickMate = r(), startR = r(), lenR = r();
  // you texted someone: he comes (if he said yes), and nobody else drops in
  if (inp.invite) {
    const m = inp.mates.find((x) => x.id === inp.invite!.mateId);
    if (m && inp.invite.yes) mateVisit(m, inp.invite.at, inp.invite.at + INVITE_STAY, "You texted him");
    return out;
  }
  if (inp.matchKo === null && inp.mates.length && roll < DROP_IN[inp.tier]) {
    const m = inp.mates[Math.floor(pickMate * inp.mates.length) % inp.mates.length];
    const from = 14 * 60 + Math.floor(startR * 22) * 15; // 14:00 to 19:15, on the quarter hour
    mateVisit(m, from, Math.min(22 * 60 + 30, from + 90 + Math.floor(lenR * 7) * 15), "Dropped round");
  }
  return out;
}

/** The day plan for day `d` of this gap (the clock's day). */
export function dayPlanFor(c: CareerState, d: number, rooms: RoomId[], tier: HomeTier, mates: { id: string; name: string }[]): HouseVisit[] {
  const dt = dateOf(c, d);
  const nx = nextMatchInfo(c);
  const no = dayNumber(c, d);
  const inv = clockOf(c).inv;
  return dayPlan({
    tier, rooms, mates, dayNo: no, dow: dt.getDay(),
    matchKo: nx && nx.day === d ? nx.ko : null,
    invite: inv && inv[0] === no ? { at: inv[1], mateId: inv[2], yes: inv[3] === 1 } : null,
    seed: `${c.player.firstName ?? ""}${c.player.lastName ?? ""}${c.player.startYear}`,
  });
}

/**
 * Test pages and filming (?visit=mate|chef|quiet): a forced day. "mate": a team-mate comes in at `from`
 * and stays two hours; "chef": the chef cooks from `from`; "quiet": nobody.
 */
export function forcedDay(kind: string, from: number, rooms: RoomId[], tier: HomeTier, mates: { id: string; name: string }[]): HouseVisit[] | null {
  if (kind === "quiet") return [];
  const seed = hashId(`forced|${kind}|${from}`);
  if (kind === "chef") return [{ id: "chef-test", who: "chef", name: CHEF_NAMES[0], from, to: from + 160, why: "Your chef", steps: planVisit("chef", "chef-test", from, from + 160, rooms, seed, { tier }) }];
  if (kind === "mate" && mates.length) {
    const m = mates[0];
    return [{ id: `mate-${m.id}`, who: "mate", name: m.name, mateId: m.id, from, to: from + 120, why: "Dropped round", steps: planVisit("mate", m.id, from, from + 120, rooms, seed, { tier }) }];
  }
  return null;
}

/** Who can drop round: the first four outfield players of your squad (as the house always used). */
export function houseMates(c: CareerState): { id: string; name: string }[] {
  return (c.squad ?? []).filter((p) => p.position !== "GK").slice(0, 4).map((p) => ({ id: p.id, name: p.shortName || p.name }));
}

/** Today's visits for the Today lists (the clock pill, the phone), off the home you own (its living rooms). */
export function visitsToday(c: CareerState, d: number): { from: number; name: string; why: string }[] {
  const tier = homeTierOf(c.ownedItems);
  if (!livingOn(tier)) return [];
  return dayPlanFor(c, d, roomsFor(tier, "new", true), tier, houseMates(c)).map((v) => ({ from: v.from, name: v.who === "mate" ? `${v.name} is coming round` : v.name, why: v.why }));
}

/** "Come round?": does he say yes (seeded by the day, three in four do), and when does he come. */
export function inviteAnswer(c: CareerState, d: number, mateId: string, minute: number): { yes: boolean; at: number } {
  const no = dayNumber(c, d);
  const yes = seeded(hashId(`${mateId}|${no}|invite`))() < 0.75;
  // he comes in about an hour, on the quarter hour, not after 20:00
  const at = Math.min(20 * 60, Math.ceil((minute + 60) / 15) * 15);
  return { yes, at };
}

/** Save an invite on the clock (one a day). */
export function withInvite(c: CareerState, d: number, mateId: string, minute: number): { career: CareerState; yes: boolean; at: number } {
  const a = inviteAnswer(c, d, mateId, minute);
  const s = clockOf(c);
  return { career: { ...c, clock: { ...s, inv: [dayNumber(c, d), a.at, mateId, a.yes ? 1 : 0] } }, ...a };
}
