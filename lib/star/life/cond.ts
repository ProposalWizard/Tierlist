/**
 * THE BOOK'S CONDITIONS — one small, closed language for `requires`, `if`,
 * cast `where` and chat `where` (living world, phase 1).
 *
 * Closed on purpose: the checker (validate.ts) rejects any word it does not
 * know, so an event can never ask for a fact the game cannot answer
 * (design 5.2: "names a person rule, place, item, flag … that does not exist").
 *
 *   career:  age>=18 · fame>=30 · lastLost · !injured · owns:car · carTier>=3
 *            mem(mate,'refused-car'|'crashed-your-car') · squad.any(bond>=35 && age<=19)
 *            hack.grudge>=20 · cast.source · outscored(rival) · flag:duel-shirt
 *            minigame.won · roll<0.3 · a||b (either)
 *   person:  bond>=35 · grudge>=20 · age<=19 · overall>=70 · !mem('borrowed-car')
 *            samePosition · new · veteran
 */
import type { LifeState, LifePerson } from "./types";

export type Op = ">=" | "<=" | ">" | "<" | "==";

/** The numbers the book can ask about the career (facts.ts fills them). */
export const FACT_NUMBERS = [
  "age", "season", "week", "clubApps", "fame", "reputation", "energy", "boss", "team", "fans",
  "starLevel", "moneyWeeks", "carTier", "divisionLevel", "lastRating", "lastGoals", "seasonGoals",
  "matchFitness", "overall",
] as const;
export type FactNumber = (typeof FACT_NUMBERS)[number];
export const FACT_FLAGS = ["lastLost", "lastWon", "injured", "hasPartner", "captain"] as const;
export type FactFlag = (typeof FACT_FLAGS)[number];
export const OWNABLE = ["car", "horse", "house"] as const;
export const PERSON_NUMBERS = ["bond", "respect", "grudge", "age", "overall", "goals"] as const;
export type PersonNumber = (typeof PERSON_NUMBERS)[number];

export interface LifeFacts {
  num: Record<FactNumber, number>;
  flag: Record<FactFlag, boolean>;
  owns: Record<(typeof OWNABLE)[number], boolean>;
  /** Your position (samePosition). */
  position: string;
}

/** A team-mate (or any person) as the conditions see him. */
export interface PersonView {
  id: string;
  rec: LifePerson;
  age?: number;
  overall?: number;
  goals?: number;
  position?: string;
  isNew: boolean;
  veteran: boolean;
}

export interface CondCtx {
  facts: LifeFacts;
  life: LifeState;
  /** slot → person id ("" = an optional slot left empty). */
  cast: Record<string, string>;
  /** Look up a person by id (cast.ts personView). */
  person: (id: string) => PersonView | null;
  /** Every team-mate, for squad.any. */
  squad: () => PersonView[];
  minigame?: "won" | "lost";
  /** A 0-1 roll for this outcome (roll<0.3). */
  roll?: number;
}

type Atom =
  | { t: "num"; key: FactNumber; op: Op; v: number }
  | { t: "flag"; key: FactFlag }
  | { t: "owns"; what: (typeof OWNABLE)[number] }
  | { t: "mem"; slot: string; tags: string[] }
  | { t: "squadAny"; conds: PAtomN[] }
  | { t: "cast"; slot: string }
  | { t: "slotNum"; slot: string; key: PersonNumber; op: Op; v: number }
  | { t: "outscored"; slot: string }
  | { t: "lifeFlag"; name: string }
  | { t: "mini"; won: boolean }
  | { t: "roll"; op: Op; v: number };
type AtomN = { neg: boolean; a: Atom };
type PAtom =
  | { t: "pnum"; key: PersonNumber; op: Op; v: number }
  | { t: "pmem"; tags: string[] }
  | { t: "samePosition" } | { t: "new" } | { t: "veteran" };
type PAtomN = { neg: boolean; a: PAtom };

const OP_RE = /(>=|<=|==|>|<)/;
const cmp = (a: number, op: Op, b: number) =>
  op === ">=" ? a >= b : op === "<=" ? a <= b : op === ">" ? a > b : op === "<" ? a < b : a === b;

function tagList(s: string): string[] | null {
  const parts = s.split("|").map((p) => p.trim());
  const out: string[] = [];
  for (const p of parts) {
    const m = /^'([a-z0-9-]+)'$/.exec(p);
    if (!m) return null;
    out.push(m[1]);
  }
  return out.length ? out : null;
}

function splitOp(s: string): [string, Op, number] | null {
  const m = OP_RE.exec(s);
  if (!m) return null;
  const left = s.slice(0, m.index).trim();
  const right = s.slice(m.index + m[1].length).trim();
  const v = Number(right);
  if (!left || right === "" || !Number.isFinite(v)) return null;
  return [left, m[1] as Op, v];
}

function parsePerson(raw: string): PAtomN | string {
  let s = raw.trim();
  const neg = s.startsWith("!");
  if (neg) s = s.slice(1).trim();
  if (s === "samePosition" || s === "new" || s === "veteran") return { neg, a: { t: s } };
  const mm = /^mem\((.+)\)$/.exec(s);
  if (mm) { const tags = tagList(mm[1]); return tags ? { neg, a: { t: "pmem", tags } } : `bad tag list in "${raw}"`; }
  const o = splitOp(s);
  if (o && (PERSON_NUMBERS as readonly string[]).includes(o[0])) return { neg, a: { t: "pnum", key: o[0] as PersonNumber, op: o[1], v: o[2] } };
  return `unknown person condition "${raw}"`;
}

function parseAtom(raw: string): AtomN | string {
  let s = raw.trim();
  const neg = s.startsWith("!");
  if (neg) s = s.slice(1).trim();
  if (s === "minigame.won" || s === "minigame.lost") return { neg, a: { t: "mini", won: s === "minigame.won" } };
  if ((FACT_FLAGS as readonly string[]).includes(s)) return { neg, a: { t: "flag", key: s as FactFlag } };
  let m = /^owns:([a-z]+)$/.exec(s);
  if (m) return (OWNABLE as readonly string[]).includes(m[1]) ? { neg, a: { t: "owns", what: m[1] as (typeof OWNABLE)[number] } } : `unknown thing to own "${m[1]}"`;
  m = /^flag:([a-z0-9-]+)$/.exec(s);
  if (m) return { neg, a: { t: "lifeFlag", name: m[1] } };
  m = /^cast\.([a-z]+)$/.exec(s);
  if (m) return { neg, a: { t: "cast", slot: m[1] } };
  m = /^outscored\(([a-z]+)\)$/.exec(s);
  if (m) return { neg, a: { t: "outscored", slot: m[1] } };
  m = /^mem\(([a-z]+),(.+)\)$/.exec(s);
  if (m) { const tags = tagList(m[2]); return tags ? { neg, a: { t: "mem", slot: m[1], tags } } : `bad tag list in "${raw}"`; }
  m = /^squad\.any\((.+)\)$/.exec(s);
  if (m) {
    const conds: PAtomN[] = [];
    for (const part of m[1].split("&&")) { const p = parsePerson(part); if (typeof p === "string") return p; conds.push(p); }
    return { neg, a: { t: "squadAny", conds } };
  }
  const o = splitOp(s);
  if (o) {
    const [left, op, v] = o;
    if (left === "roll") return { neg, a: { t: "roll", op, v } };
    if ((FACT_NUMBERS as readonly string[]).includes(left)) return { neg, a: { t: "num", key: left as FactNumber, op, v } };
    const sm = /^([a-z]+)\.([a-z]+)$/.exec(left);
    if (sm && (PERSON_NUMBERS as readonly string[]).includes(sm[2])) return { neg, a: { t: "slotNum", slot: sm[1], key: sm[2] as PersonNumber, op, v } };
  }
  return `unknown condition "${raw}"`;
}

const cache = new Map<string, AtomN[] | string>();
/** A condition: alternatives joined by `||`. A string back is the error. */
export function parseCond(src: string): AtomN[] | string {
  const hit = cache.get(src);
  if (hit) return hit;
  const out: AtomN[] = [];
  let err: string | null = null;
  // "||" splits alternatives, but not inside mem('a'|'b') (one bar only there).
  for (const alt of src.split("||")) {
    const a = parseAtom(alt);
    if (typeof a === "string") { err = a; break; }
    out.push(a);
  }
  const res = err ?? out;
  cache.set(src, res);
  return res;
}

const PERSON_CACHE = new Map<string, PAtomN | string>();
export function parsePersonCond(src: string): PAtomN | string {
  const hit = PERSON_CACHE.get(src);
  if (hit) return hit;
  const p = parsePerson(src);
  PERSON_CACHE.set(src, p);
  return p;
}

/** The slots a condition names (the checker makes sure the event casts them). */
export function slotsIn(src: string): string[] {
  const p = parseCond(src);
  if (typeof p === "string") return [];
  const out: string[] = [];
  for (const { a } of p) if ("slot" in a) out.push(a.slot);
  return out;
}

/** The memory tags a condition reads (the checker makes sure something writes them). */
export function tagsIn(src: string): string[] {
  const p = parseCond(src);
  if (typeof p === "string") return [];
  const out: string[] = [];
  for (const { a } of p) {
    if (a.t === "mem") out.push(...a.tags);
    if (a.t === "squadAny") for (const c of a.conds) if (c.a.t === "pmem") out.push(...c.a.tags);
  }
  return out;
}

export function hasMemory(rec: { m: [string, number, number][] } | undefined, tags: string[]): boolean {
  return !!rec && rec.m.some(([t]) => tags.includes(t));
}

export function personHolds(p: PersonView, c: PAtomN, you: string): boolean {
  const a = c.a;
  let v: boolean;
  if (a.t === "pnum") {
    const n = a.key === "bond" ? p.rec.b : a.key === "respect" ? p.rec.r : a.key === "grudge" ? p.rec.g
      : a.key === "age" ? p.age : a.key === "overall" ? p.overall : p.goals;
    v = typeof n === "number" && cmp(n, a.op, a.v);
  } else if (a.t === "pmem") v = hasMemory(p.rec, a.tags);
  else if (a.t === "samePosition") v = !!p.position && p.position === you;
  else if (a.t === "new") v = p.isNew;
  else v = p.veteran;
  return c.neg ? !v : v;
}

function atomHolds(x: AtomN, ctx: CondCtx): boolean {
  const a = x.a;
  let v = false;
  switch (a.t) {
    case "num": v = cmp(ctx.facts.num[a.key], a.op, a.v); break;
    case "flag": v = ctx.facts.flag[a.key]; break;
    case "owns": v = ctx.facts.owns[a.what]; break;
    case "lifeFlag": v = ctx.life.flags.includes(a.name); break;
    case "cast": v = !!ctx.cast[a.slot]; break;
    case "mini": v = ctx.minigame === (a.won ? "won" : "lost"); break;
    case "roll": v = typeof ctx.roll === "number" && cmp(ctx.roll, a.op, a.v); break;
    case "mem": {
      if (a.slot === "squad") { v = ctx.life.squad.some(([t]) => a.tags.includes(t)); break; }
      if (a.slot === "you") { v = ctx.life.self.some(([t]) => a.tags.includes(t)); break; }
      const id = ctx.cast[a.slot];
      v = !!id && hasMemory(ctx.life.people[id], a.tags);
      break;
    }
    case "slotNum": {
      const id = ctx.cast[a.slot];
      const p = id ? ctx.person(id) : null;
      v = !!p && personHolds(p, { neg: false, a: { t: "pnum", key: a.key, op: a.op, v: a.v } }, ctx.facts.position);
      break;
    }
    case "outscored": {
      const id = ctx.cast[a.slot];
      const p = id ? ctx.person(id) : null;
      v = !!p && ctx.facts.num.seasonGoals >= (p.goals ?? 0);
      break;
    }
    case "squadAny": v = ctx.squad().some((p) => a.conds.every((c) => personHolds(p, c, ctx.facts.position))); break;
  }
  return x.neg ? !v : v;
}

/** Is the condition true? A condition that does not parse is never true. */
export function holds(src: string, ctx: CondCtx): boolean {
  const p = parseCond(src);
  if (typeof p === "string") return false;
  return p.some((a) => atomHolds(a, ctx));
}

export const allHold = (list: string[] | undefined, ctx: CondCtx) => (list ?? []).every((s) => holds(s, ctx));
