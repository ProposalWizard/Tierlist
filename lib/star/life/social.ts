/**
 * SOCIAL ACTIONS — the Sims part (living world, design part 3). Phase 1 has
 * three: Chat, Go for a drive, A day at the races.
 *
 *  - Chat: free. Once a week per person. A line from the book picked by his
 *    memories (a callback lands here first) and the week's football. Bond +1 to
 *    +3, shrinking as bond rises; a man holding a grudge may blank you.
 *  - Go for a drive: you own a car; one of the week's days. Plays a drive event
 *    from the book (social:drive) with him in the passenger seat.
 *  - A day at the races: his bond 25+; a day, 0.3 weeks' wage and 4 energy.
 *    Plays soc-races-day-out: the bets are real money.
 *
 * Each person has a "seen enough of you" limit: 2 social actions a week.
 */
import type { CareerState } from "../types";
import type { LifeMoment } from "./types";
import { CHATS, EVENTS } from "./book";
import { allHold, parsePersonCond, personHolds } from "./cond";
import { cantPay, cloneLife, lifeOf, pickEvent, startEvent, type LiveEvent } from "./director";
import { carTier, ctxFor, factsOf, personView, type FactOverride } from "./facts";
import { lifeWeek, meet, moveTeamFromPerson, noteSquad, nudge, personInfo, roleOf } from "./people";
import { fillLine } from "./text";
import type { LifeChange } from "./resolve";
import { actionsLeft } from "../week";

export type SocialKind = "chat" | "drive" | "races";
export const SOCIAL_PER_PERSON_WEEK = 2;
export const RACES_MIN_BOND = 25;

export const SOCIAL_LABEL: Record<SocialKind, string> = { chat: "Chat", drive: "Go for a drive", races: "A day at the races" };
export const SOCIAL_ICON: Record<SocialKind, string> = { chat: "💬", drive: "🚗", races: "🏇" };

function socToday(c: CareerState, id: string): number {
  const life = lifeOf(c);
  return life.soc[0] === lifeWeek(c) ? life.soc[1][id] ?? 0 : 0;
}

function chattedThisWeek(c: CareerState, id: string): boolean {
  const life = lifeOf(c);
  return life.log.some((r) => r.w === lifeWeek(c) && r.e === "chat" && r.c === id);
}

const EVENT_OF: Record<Exclude<SocialKind, "chat">, LifeMoment> = { drive: "social:drive", races: "social:races" };

/** What each action costs, in words (from the book's own event costs). */
export function socialCost(kind: SocialKind): string {
  if (kind === "chat") return "Free";
  const e = EVENTS.find((x) => x.trigger.when.includes(EVENT_OF[kind]) && x.cost);
  const k = e?.cost;
  const parts: string[] = [];
  if (k?.weekAction) parts.push(`${k.weekAction} day`);
  if (k?.moneyWeeks) parts.push(`${k.moneyWeeks} wk wage`);
  if (k?.energy) parts.push(`${k.energy} energy`);
  return parts.join(" · ") || "1 day";
}

/** Why you cannot do it now (null = you can). */
export function socialBlocked(c: CareerState, id: string, kind: SocialKind): string | null {
  if (roleOf(id) !== "teammate") return "Only with team-mates for now";
  if (socToday(c, id) >= SOCIAL_PER_PERSON_WEEK) return "He has seen enough of you this week";
  if (kind === "chat") return chattedThisWeek(c, id) ? "You spoke this week" : null;
  if (kind === "drive" && carTier(c) === 0) return "You need a car";
  const rec = lifeOf(c).people[id];
  const bond = rec?.b ?? 30;
  if (kind === "races" && bond < RACES_MIN_BOND) return `He is not close enough yet (bond ${RACES_MIN_BOND}+)`;
  const ev = EVENTS.find((x) => x.trigger.when.includes(EVENT_OF[kind as "drive" | "races"]));
  if (kind === "races" && ev) {
    const last = lifeOf(c).fired[ev.id]?.slice(-1)[0];
    if (last !== undefined && lifeWeek(c) - last < (ev.trigger.cooldownWeeks ?? 0)) return "You were at the races lately";
  }
  const pay = cantPay(c, ev?.cost);
  if (pay) return pay;
  return null;
}

function countSocial(c: CareerState, id: string): CareerState {
  const life = cloneLife(lifeOf(c));
  const now = lifeWeek(c);
  if (life.soc[0] !== now) life.soc = [now, {}];
  noteSquad(life, c, now);
  life.soc[1][id] = (life.soc[1][id] ?? 0) + 1;
  return { ...c, life };
}

export interface ChatResult { career: CareerState; who: string; line: string; changes: LifeChange[]; callback: boolean }

/** Chat: free, small, and where most callbacks land. */
export function chat(c0: CareerState, id: string, rng: () => number, facts?: FactOverride): ChatResult | null {
  if (socialBlocked(c0, id, "chat")) return null;
  let c = countSocial(c0, id);
  const life = cloneLife(lifeOf(c));
  const now = lifeWeek(c);
  const p = meet(life, id, now, c.squad?.find((s) => s.id === id)?.name);
  const info = personInfo(c, id);
  const who = info?.short ?? "He";
  const cast = { mate: id };
  const ctx = ctxFor(c, life, cast, factsOf(c, facts));
  // A callback first: one of his memories the book says comes back in a chat.
  let line = "";
  let callback = false;
  const tags = new Set(p.m.map(([t]) => t));
  const squadTags = new Set(life.squad.map(([t]) => t));
  const selfTags = new Set(life.self.map(([t]) => t));
  const hits: string[] = [];
  for (const e of EVENTS) for (const cb of e.callbacks) {
    // Chat lines, and any spoken line ("…") that comes back in any later scene with him.
    const spoken = cb.where === "event:any" && cb.line.startsWith('"');
    if (cb.where !== "social:chat" && cb.where !== "social:any" && !spoken) continue;
    const [holder, tag] = cb.ifMemory.split(":");
    if (holder === "squad" ? squadTags.has(tag) : holder === "you" ? selfTags.has(tag) : tags.has(tag)) hits.push(cb.line);
  }
  if (hits.length) { line = hits[Math.floor(rng() * hits.length)]; callback = true; }
  else {
    const view = personView(c, life, id, now);
    const fits = CHATS.filter((ch) => allHold(ch.when, ctx) && (ch.where ?? []).every((w) => { const pc = parsePersonCond(w); return !!view && typeof pc !== "string" && personHolds(view, pc, c.player.position); }));
    // The most particular line wins half the time; the plain one is the fallback.
    const special = fits.filter((f) => (f.where?.length ?? 0) + (f.when?.length ?? 0) > 0);
    const pool = special.length && rng() < 0.8 ? special : fits;
    const pick = pool[Math.floor(rng() * pool.length)] ?? CHATS[0];
    line = pick.lines[Math.floor(rng() * pick.lines.length)];
  }
  line = fillLine(line, c, cast, ctx);
  const changes: LifeChange[] = [];
  // A man holding a grudge may blank you.
  const blank = p.g >= 30 && rng() < 0.4;
  const db = nudge(p, "b", blank ? -1 : 1 + Math.floor(rng() * 3));
  if (db) changes.push({ kind: "person", label: `${who} bond`, delta: db });
  const tm = moveTeamFromPerson(life, id, db);
  if (tm.fellOut) changes.push({ kind: "team-rule", label: `You and ${who} have fallen out. The dressing room takes sides.` });
  if (tm.madeUp) changes.push({ kind: "team-rule", label: `You and ${who} are good again.` });
  life.log = [...life.log, { w: now, e: "chat", c: id, t: line.slice(0, 140) }].slice(-12);
  c = { ...c, life };
  if (tm.team) {
    const team = Math.max(0, Math.min(100, c.relationships.team + tm.team));
    changes.push({ kind: "bar", label: "Team", delta: team - c.relationships.team });
    c = { ...c, relationships: { ...c.relationships, team } };
  }
  return { career: c, who, line: blank ? `${line} He does not really want to talk.` : line, changes, callback };
}

export interface OutingStart { career: CareerState; live: LiveEvent }

/**
 * A drive or a day at the races: counts the action, pays the outing, and
 * hands back the event to play. A drive with nothing new in the book is a
 * plain good drive (bond +6), never nothing.
 */
export function startOuting(c0: CareerState, id: string, kind: "drive" | "races", rng: () => number, facts?: FactOverride): OutingStart | { career: CareerState; plain: ChatResult } | null {
  if (socialBlocked(c0, id, kind)) return null;
  const live = pickEvent(c0, EVENT_OF[kind], { rng, socialTarget: id, facts });
  if (!live) {
    if (kind !== "drive") return null;
    let c = countSocial(c0, id);
    const life = cloneLife(lifeOf(c));
    const p = meet(life, id, lifeWeek(c), c.squad?.find((s) => s.id === id)?.name);
    const db = nudge(p, "b", 6);
    const who = personInfo(c, id)?.short ?? "He";
    const tm = moveTeamFromPerson(life, id, db);
    c = { ...c, life, weekActions: Math.max(0, actionsLeft(c) - 1) };
    if (tm.team) c = { ...c, relationships: { ...c.relationships, team: Math.max(0, Math.min(100, c.relationships.team + tm.team)) } };
    return { career: c, plain: { career: c, who, line: `A quiet drive with ${who}. Good music, no phones.`, changes: db ? [{ kind: "person", label: `${who} bond`, delta: db }] : [], callback: false } };
  }
  const c = startEvent(countSocial(c0, id), live);
  return { career: c, live };
}
