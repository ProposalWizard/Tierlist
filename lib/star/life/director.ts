/**
 * THE DIRECTOR — which event fires, and when (living world, design 1.3).
 *
 *  - Budget: at most 2 events a week, at most 1 medium-or-big; a big one needs
 *    6 weeks since the last big one. Social outings you chose do not count.
 *  - Follow-ups first: a due follow-up always beats a fresh event.
 *  - Never the same event twice, unless it says maxPerCareer; a group stops
 *    near-copies for the event's cooldown.
 *  - A reason to fire: each event's trigger reads the career (cond.ts).
 *  - Picked by the caller's seeded roll, so a soak run is repeatable.
 */
import type { CareerState } from "../types";
import type { CastSlot, LifeChoice, LifeEvent, LifeMoment, LifeState } from "./types";
import { EVENTS, eventById } from "./book";
import { allHold, hasMemory, holds, parsePersonCond, personHolds, type PersonView } from "./cond";
import { ctxFor, factsOf, squadViews, weekOfMoney, type FactOverride } from "./facts";
import { clubRoleId, freshLife, lifeWeek, meet, noteSquad, peek, ROLE_ID, roleOf, tidy } from "./people";
import { fillLine } from "./text";
import { actionsLeft } from "../week";

export const MAX_PER_WEEK = 2;
export const MAX_HEAVY_PER_WEEK = 1;
export const BIG_GAP_WEEKS = 6;
/** A follow-up waits at most this long past its date for its moment, then is dropped. */
export const FOLLOWUP_EXPIRE = 30;
/** How often an ordinary moment looks for a fresh event at all (follow-ups always look). */
export const MOMENT_CHANCE: Record<LifeMoment, number> = {
  "after-match": 0.4, "arrive:training": 0.35, "home:evening": 0.3, driving: 0.35,
  walkout: 0.6, "season-end": 1, "leave:casino": 0.8, followUp: 1, "social:drive": 1, "social:races": 1,
};
const RARITY_W: Record<string, number> = { common: 1, uncommon: 0.6, rare: 0.3, "social-action": 1, "follow-up": 1, callback: 1 };

export interface LiveChoice { id: string; label: string; costText: string[]; locked: string | null; choice: LifeChoice }
export interface LiveCallback { who: string; line: string }
export interface LiveEvent {
  id: string;
  event: LifeEvent;
  moment: LifeMoment;
  cast: Record<string, string>;
  lines: string[];
  callbacks: LiveCallback[];
  choices: LiveChoice[];
  followUp: boolean;
  social: boolean;
}

export interface PickOpts {
  rng: () => number;
  facts?: FactOverride;
  /** The team-mate a social action is with. */
  socialTarget?: string;
  /** A quiet week (cup final, transfer, Ballon d'Or night): nothing fresh fires. */
  quiet?: boolean;
  /** Test page: this event, ignoring budget and cooldowns (its cast still has to fill). */
  force?: string;
}

export const lifeOf = (c: CareerState): LifeState => c.life ?? freshLife();

/** Which week's numbers apply: a new week starts from zero. */
function budget(life: LifeState, now: number): { n: number; heavy: number } {
  return life.wk[0] === now ? { n: life.wk[1], heavy: life.wk[2] } : { n: 0, heavy: 0 };
}

const ORDERS: Record<string, (a: PersonView, b: PersonView) => number> = {
  "bond-desc": (a, b) => b.rec.b - a.rec.b,
  "bond-asc": (a, b) => a.rec.b - b.rec.b,
  "grudge-desc": (a, b) => b.rec.g - a.rec.g,
  youngest: (a, b) => (a.age ?? 99) - (b.age ?? 99),
  best: (a, b) => (b.overall ?? 0) - (a.overall ?? 0),
};

/** Fill one slot. "" = an optional slot left empty; null = cannot be cast. */
function castSlot(c: CareerState, life: LifeState, s: CastSlot, taken: Set<string>, opts: PickOpts, carried: Record<string, string> | null, now: number): string | null {
  const you = c.player.position;
  const ok = (p: PersonView) => !taken.has(p.id) && (s.where ?? []).every((w) => { const pc = parsePersonCond(w); return typeof pc !== "string" && personHolds(p, pc, you); });
  let id: string | null = null;
  switch (s.pick) {
    case "squad": {
      const list = squadViews(c, life, now).filter(ok);
      if (list.length) {
        if (!s.order || s.order === "random") id = list[Math.floor(opts.rng() * list.length)].id;
        else id = list.sort(ORDERS[s.order])[0].id;
      }
      break;
    }
    case "social": id = opts.socialTarget && !taken.has(opts.socialTarget) ? opts.socialTarget : null; break;
    case "stranger": id = "oneoff:stranger"; break;
    case "memory": case "carried": {
      if (carried?.[s.slot]) { id = carried[s.slot]; break; }
      const tags = s.tags ?? [];
      let best: [string, number] | null = null;
      for (const [pid, p] of Object.entries(life.people)) {
        if (taken.has(pid)) continue;
        for (const [t, at, str] of p.m) if (tags.includes(t) && (!best || str * 1000 + at > best[1])) best = [pid, str * 1000 + at];
      }
      id = best?.[0] ?? null;
      break;
    }
    case "manager": id = c.manager ? ROLE_ID.manager : null; break;
    // A club's people (kit man, physio, legend ...) are the club you are at now's (people.ts).
    default: id = clubRoleId(c, life, s.pick);
  }
  if (id && s.pick !== "squad" && s.pick !== "stranger" && s.where?.length) {
    const v = { id, rec: peek(life, id), isNew: false, veteran: false } as PersonView;
    if (!ok(v)) id = null;
  }
  if (!id) return s.optional ? "" : null;
  return id;
}

export function castEvent(c: CareerState, life: LifeState, e: LifeEvent, opts: PickOpts, carried: Record<string, string> | null, now: number): Record<string, string> | null {
  const cast: Record<string, string> = {};
  const taken = new Set<string>();
  for (const s of e.cast) {
    const id = castSlot(c, life, s, taken, opts, carried, now);
    if (id === null) return null;
    cast[s.slot] = id;
    if (id && !id.startsWith("oneoff:")) taken.add(id);
  }
  return cast;
}

function freshOk(e: LifeEvent, life: LifeState, now: number): boolean {
  const t = e.trigger;
  const fired = life.fired[e.id] ?? [];
  if (t.once && fired.length) return false;
  if (fired.length >= (t.maxPerCareer ?? 1)) return false;
  if (fired.length && t.cooldownWeeks && now - fired[fired.length - 1] < t.cooldownWeeks) return false;
  if (t.group && life.groups[t.group] !== undefined && now - life.groups[t.group] < (t.cooldownWeeks ?? 0)) return false;
  return true;
}

function sizeOk(e: LifeEvent, life: LifeState, now: number, b: { n: number; heavy: number }): boolean {
  if (e.size !== "small" && b.heavy >= MAX_HEAVY_PER_WEEK) return false;
  if (e.size === "big" && now - life.lastBig < BIG_GAP_WEEKS) return false;
  return true;
}

/** Callback lines that land in this event: a cast person's memory that some
 *  event in the book says comes back "event:any", "event:<this id>" or
 *  "event:<prefix>*"; squad memories when a team-mate is in it; your own. */
function callbacksFor(c: CareerState, life: LifeState, e: LifeEvent, cast: Record<string, string>, ctx: ReturnType<typeof ctxFor>): LiveCallback[] {
  const out: (LiveCallback & { at: number })[] = [];
  const seen = new Set<string>();
  const hits = (where: string) => {
    if (!where.startsWith("event:")) return false;
    const w = where.slice(6);
    return w.split("|").some((x) => x === "any" || x === e.id || (x.endsWith("*") && e.id.startsWith(x.slice(0, -1))) || x === `category:${e.category}`);
  };
  const hasMate = Object.values(cast).some((id) => id && roleOf(id) === "teammate");
  for (const ev of EVENTS) {
    for (const cb of ev.callbacks) {
      if (!hits(cb.where) || seen.has(cb.line)) continue;
      const tag = cb.ifMemory.split(":")[1];
      const holderSlot = cb.ifMemory.split(":")[0];
      let who = "";
      let at = -1;
      if (holderSlot === "squad") { const m = life.squad.find(([t]) => t === tag); if (!hasMate || !m) continue; who = "The lads"; at = m[1]; }
      else if (holderSlot === "you") { const m = life.self.find(([t]) => t === tag); if (!m) continue; who = ""; at = m[1]; }
      else {
        const holder = Object.values(cast).find((id) => id && hasMemory(life.people[id], [tag]));
        if (!holder) continue;
        const slot = Object.keys(cast).find((k) => cast[k] === holder)!;
        who = fillLine(`{${slot}.short}`, c, cast, ctx);
        const mAt = life.people[holder].m.find(([t]) => t === tag)?.[1] ?? 0;
        out.push({ who, line: fillLine(cb.line, c, cast, ctx), at: mAt }); seen.add(cb.line);
        continue;
      }
      out.push({ who, line: fillLine(cb.line, c, cast, ctx), at }); seen.add(cb.line);
    }
  }
  // One memory coming back at a time: the freshest one (two read as a list, not a moment).
  return out.sort((a, b) => b.at - a.at).slice(0, 1).map(({ who, line }) => ({ who, line }));
}

export function costText(c: CareerState, cost: LifeChoice["cost"]): string[] {
  if (!cost) return [];
  const out: string[] = [];
  if (cost.weekAction) out.push(`${cost.weekAction} day`);
  if (cost.moneyWeeks) out.push(`${cost.moneyWeeks} wk wage`);
  if (cost.energy) out.push(`${cost.energy} energy`);
  return out;
}

/** Can you pay for it? null = yes, else the reason. */
export function cantPay(c: CareerState, cost: LifeChoice["cost"]): string | null {
  if (!cost) return null;
  if (cost.weekAction && actionsLeft(c) < cost.weekAction) return "No days left this week";
  if (cost.moneyWeeks && c.money < cost.moneyWeeks * weekOfMoney(c)) return "Not enough money";
  if (cost.energy && c.energy + cost.energy < 0) return "Too tired";
  return null;
}

/** Turn a picked event and its cast into what the screen shows. */
export function liveEvent(c: CareerState, e: LifeEvent, cast: Record<string, string>, moment: LifeMoment, followUp: boolean, facts?: FactOverride): LiveEvent {
  const life = lifeOf(c);
  const ctx = ctxFor(c, life, cast, factsOf(c, facts));
  const lines = e.setup.map((l) => fillLine(l, c, cast, ctx)).filter(Boolean);
  const choices: LiveChoice[] = [];
  for (const ch of e.choices) {
    if (!allHold(ch.requires, ctx)) continue;
    choices.push({ id: ch.id, label: fillLine(ch.label, c, cast, ctx), costText: costText(c, ch.cost), locked: cantPay(c, ch.cost), choice: ch });
  }
  return {
    id: e.id, event: e, moment, cast, lines, callbacks: callbacksFor(c, life, e, cast, ctx), choices, followUp,
    social: moment.startsWith("social:"),
  };
}

/**
 * Look for an event at a moment. Returns null when nothing should happen
 * (the usual answer: most moments are quiet).
 */
export function pickEvent(c: CareerState, moment: LifeMoment, opts: PickOpts): LiveEvent | null {
  const life = lifeOf(c);
  const now = lifeWeek(c);
  const social = moment.startsWith("social:");
  const facts = factsOf(c, opts.facts);

  if (opts.force) {
    const e = eventById(opts.force);
    if (!e) return null;
    const pend = life.pending.find((p) => p.event === e.id);
    const cast = castEvent(c, life, e, opts, pend?.cast ?? null, now);
    if (!cast) return null;
    return liveEvent(c, e, cast, moment, !!pend || e.trigger.when.includes("followUp"), opts.facts);
  }

  const b = budget(life, now);
  if (!social && b.n >= MAX_PER_WEEK) return null;

  // 1. Follow-ups first.
  if (!social) {
    for (const p of [...life.pending].sort((a, z) => a.due - z.due)) {
      if (p.due > now) continue;
      const e = eventById(p.event);
      if (!e) continue;
      // Its own limit still holds (a once-only pay-off never plays twice).
      if ((life.fired[e.id]?.length ?? 0) >= (e.trigger.once ? 1 : e.trigger.maxPerCareer ?? 1)) continue;
      if (!(e.trigger.when.includes(moment) || (e.trigger.when.includes("followUp") && e.trigger.when.length === 1))) continue;
      if (!sizeOk(e, life, now, b)) continue;
      const cast = castEvent(c, life, e, opts, p.cast, now);
      if (!cast) continue;
      const ctx = ctxFor(c, life, cast, facts);
      if (p.if && !holds(p.if, ctx)) continue;
      if (!allHold(e.trigger.requires, ctx)) continue;
      return liveEvent(c, e, cast, moment, true, opts.facts);
    }
  }

  // 2. Fresh events.
  if (opts.quiet && !social) return null;
  if (opts.rng() >= MOMENT_CHANCE[moment]) return null;
  const pool: { e: LifeEvent; cast: Record<string, string>; w: number }[] = [];
  for (const e of EVENTS) {
    if (!e.trigger.when.includes(moment)) continue;
    // A pay-off that carries its people only ever comes as a follow-up (the boots, years later).
    if (e.cast.some((s) => s.pick === "carried")) continue;
    if (!freshOk(e, life, now)) continue;
    if (!social && !sizeOk(e, life, now, b)) continue;
    const cast = castEvent(c, life, e, opts, null, now);
    if (!cast) continue;
    const ctx = ctxFor(c, life, cast, facts);
    if (!allHold(e.trigger.requires, ctx)) continue;
    let w = RARITY_W[e.rarity] ?? 1;
    const lastCat = life.cats[e.category];
    if (lastCat === undefined || now - lastCat >= 8) w *= 1.5;
    if (Object.values(cast).some((id) => id && (life.people[id]?.m.length ?? 0) > 0)) w *= 1.25;
    pool.push({ e, cast, w });
  }
  if (!pool.length) return null;
  let r = opts.rng() * pool.reduce((a, x) => a + x.w, 0);
  for (const x of pool) { r -= x.w; if (r <= 0) return liveEvent(c, x.e, x.cast, moment, false, opts.facts); }
  const x = pool[pool.length - 1];
  return liveEvent(c, x.e, x.cast, moment, false, opts.facts);
}

/** Clone the life block so a reducer never mutates the old career. */
export function cloneLife(life: LifeState): LifeState {
  return JSON.parse(JSON.stringify(life)) as LifeState;
}

/**
 * The event is on screen: count it against the week, mark it fired, take a
 * follow-up off the waiting list, and pay the event's own cost (an outing's
 * ticket). Everyone in the cast is now someone you have met.
 */
export function startEvent(c: CareerState, live: LiveEvent): CareerState {
  const life = cloneLife(lifeOf(c));
  const now = lifeWeek(c);
  if (life.wk[0] !== now) { tidy(life, c, now); life.wk = [now, 0, 0]; }
  noteSquad(life, c, now);
  if (!live.social) {
    life.wk[1] += 1;
    if (live.event.size !== "small") life.wk[2] += 1;
  }
  if (live.event.size === "big") life.lastBig = now;
  life.fired[live.id] = [...(life.fired[live.id] ?? []), now];
  if (live.event.trigger.group) life.groups[live.event.trigger.group] = now;
  life.cats[live.event.category] = now;
  life.pending = life.pending.filter((p) => p.event !== live.id);
  for (const id of Object.values(live.cast)) if (id && !id.startsWith("oneoff:")) meet(life, id, now, c.squad?.find((p) => p.id === id)?.name);
  let next: CareerState = { ...c, life };
  const cost = live.event.cost;
  if (cost) {
    if (cost.moneyWeeks) next = { ...next, money: Math.max(0, next.money - Math.round(cost.moneyWeeks * weekOfMoney(next))) };
    if (cost.energy) next = { ...next, energy: Math.max(0, Math.min(100, next.energy + cost.energy)) };
    if (cost.weekAction) next = { ...next, weekActions: Math.max(0, actionsLeft(next) - cost.weekAction) };
  }
  return next;
}

/** Follow-ups that waited too long for their moment are dropped (the soak counts them). */
export function dropStale(c: CareerState): { career: CareerState; dropped: number } {
  if (!c.life) return { career: c, dropped: 0 };
  const now = lifeWeek(c);
  const life = c.life;
  const overLimit = (id: string) => { const e = eventById(id); return !e || (life.fired[id]?.length ?? 0) >= (e.trigger.once ? 1 : e.trigger.maxPerCareer ?? 1); };
  const keep = life.pending.filter((p) => now - p.due <= FOLLOWUP_EXPIRE && !overLimit(p.event));
  const dropped = c.life.pending.length - keep.length;
  if (!dropped) return { career: c, dropped };
  return { career: { ...c, life: { ...c.life, pending: keep } }, dropped };
}
