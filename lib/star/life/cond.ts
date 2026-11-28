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
 *            minigame.won · roll<0.3 · a||b (either) · caps>=1 · europe
 *            ended(arc-the-snorer) · ended(arc-the-snorer:good-sleep|the-machine)  (a story is over,
 *            any way or one of these ways. Read from the save's finished stories, which keep their
 *            ending for good, so a follow-on story can wait for it; 28 Nov 2026)
 *   world:   club:chelsea · everClub:leeds-united · opponent:real-madrid · derby · clubTop26 ·
 *            seasonsAtClub>=3 · callUps>=1 · intlGoals>=1 · inTournament · ballonDor>=1 ·
 *            won(fa-cup) · won(league)>=2 · wonAt(league,sunderland) · has(heritage-room) ·
 *            book('watch-minute') · since('watch-minute')>=3 · just(birthday) · just(trophy:fa-cup)
 *            (the story world, job B, 28 Nov 2026: docs/plans/STORY_WORLD_PLAN.md part 2. A club
 *            word takes a slug from lib/star/clubs.ts, unlocks.ts clubSlug; the parser fails an
 *            unknown club, unlock, competition, milestone or scrapbook tag.)
 *   person:  bond>=35 · grudge>=20 · age<=19 · overall>=70 · !mem('borrowed-car')
 *            samePosition · new · veteran
 */
import type { LifeState, LifePerson } from "./types";
import { runIn } from "./arcPack";
import { ALL_CLUB_SLUGS, UNLOCK_BY_ID, unlocksOf } from "./unlocks";
import { COMP_SLUGS, isMilestone, justHolds } from "./milestones";
import { SCRAPBOOK, bookHas, bookSince } from "./scrapbook";

export type Op = ">=" | "<=" | ">" | "<" | "==";

/** The numbers the book can ask about the career (facts.ts fills them). */
export const FACT_NUMBERS = [
  "age", "season", "week", "clubApps", "fame", "reputation", "energy", "boss", "team", "fans",
  "starLevel", "moneyWeeks", "carTier", "divisionLevel", "lastRating", "lastGoals", "seasonGoals",
  "matchFitness", "overall",
  // Story stages (28 Nov 2026): international caps.
  "caps",
  // The story world (job B, 28 Nov 2026): seasons in a row at this club (1 in your first), call-ups,
  // international goals, Ballon d'Or wins.
  "seasonsAtClub", "callUps", "intlGoals", "ballonDor",
] as const;
export type FactNumber = (typeof FACT_NUMBERS)[number];
export const FACT_FLAGS = ["lastLost", "lastWon", "injured", "hasPartner", "captain", "europe",
  // The story world (job B): the last or next match is a derby; in this summer's tournament squad; at one of the 26 hook clubs.
  "derby", "inTournament", "clubTop26"] as const;
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
  /** The story world (job B): your club's slug, every club you have played for, the last and next
   *  match's opponents (slugs), and your trophies as [competition words, club slug]. */
  club: string;
  clubsEver: string[];
  opponents: string[];
  trophies: [string[], string][];
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
  /** Events v2: the story, the talk so far, the game just played (arcs.ts, talk.ts). */
  v2?: V2Ctx;
}

/** What a v2 condition can read: arc.x, arc.clock(id), talk.mood, said:x,
 *  activity.score / tens / won / abandoned, promise(id), sameClub. */
export interface V2Ctx {
  arc?: { v: Record<string, number | string>; k: Record<string, number>; club: string };
  talk?: { mood: number; said: string[] };
  activity?: { score: number; tens: number; won: boolean; abandoned: boolean; oppScore?: number };
  /** Is this promise made and still open (or kept)? */
  promise?: (id: string) => boolean;
  /** Your club now. */
  club?: string;
}

/** One side of a v2 comparison: a number, a 'word', or a value the story keeps. */
type V2Val = { n: number } | { s: string } | { ref: string; arg?: string };

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
  | { t: "roll"; op: Op; v: number }
  | { t: "said"; tag: string }
  | { t: "promise"; id: string }
  | { t: "sameClub" }
  | { t: "act"; what: "won" | "lost" | "abandoned" }
  | { t: "v2cmp"; l: V2Val; op: Op; r: V2Val }
  | { t: "ended"; arc: string; ends: string[] }
  | { t: "club"; which: "club" | "everClub" | "opponent"; slug: string }
  | { t: "won"; comp: string; op: Op; v: number }
  | { t: "wonAt"; comp: string; slug: string }
  | { t: "has"; id: string }
  | { t: "book"; tags: string[] }
  | { t: "since"; tag: string; op: Op; v: number }
  | { t: "just"; m: string }
  | { t: "and"; parts: AtomN[] };
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

const V2_REFS = /^(arc\.[a-z]+|arc\.clock\([a-z0-9-]+\)|talk\.mood|activity\.(score|tens|oppScore))$/;
function v2Val(x: string): V2Val | null {
  const t = x.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return { n: Number(t) };
  const q = /^'([a-z0-9-]*)'$/.exec(t);
  if (q) return { s: q[1] };
  if (!V2_REFS.test(t)) return null;
  const c = /^arc\.clock\(([a-z0-9-]+)\)$/.exec(t);
  return c ? { ref: "arc.clock", arg: c[1] } : { ref: t };
}

/** Split on a word joiner outside brackets (squad.any(a && b) stays whole). */
function splitTop(src: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && src.startsWith(sep, i)) { out.push(cur); cur = ""; i += sep.length - 1; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseV2(s: string, neg: boolean): AtomN | string | null {
  let m = /^said:([a-z0-9-]+)$/.exec(s);
  if (m) return { neg, a: { t: "said", tag: m[1] } };
  m = /^ended\(([a-z0-9-]+)(?::([a-z0-9|-]+))?\)$/.exec(s);
  if (m) return { neg, a: { t: "ended", arc: m[1], ends: m[2] ? m[2].split("|").filter(Boolean) : [] } };
  m = /^promise\(([a-z0-9-]+)\)$/.exec(s);
  if (m) return { neg, a: { t: "promise", id: m[1] } };
  if (s === "sameClub" || s === "sameClub(arc.start)") return { neg, a: { t: "sameClub" } };
  m = /^activity\.(won|lost|abandoned)$/.exec(s);
  if (m) return { neg, a: { t: "act", what: m[1] as "won" | "lost" | "abandoned" } };
  if (!/^(arc\.|talk\.|activity\.)/.test(s)) return null;
  const o = OP_RE.exec(s);
  if (!o) return `unknown story condition "${s}"`;
  const l = v2Val(s.slice(0, o.index)), r = v2Val(s.slice(o.index + o[1].length));
  if (!l || !r) return `unknown story condition "${s}"`;
  return { neg, a: { t: "v2cmp", l, op: o[1] as Op, r } };
}

/** The story world's words (job B, 28 Nov 2026). null = not one of them. */
function parseWorld(s: string, neg: boolean): AtomN | string | null {
  let m = /^(club|everClub|opponent):([a-z0-9-]+)$/.exec(s);
  if (m) return ALL_CLUB_SLUGS.has(m[2]) ? { neg, a: { t: "club", which: m[1] as "club" | "everClub" | "opponent", slug: m[2] } } : `unknown club "${m[2]}" in "${s}" (a slug of a club in lib/star/clubs.ts, e.g. manchester-united)`;
  m = /^won\(([a-z0-9-]+)\)\s*(?:(>=|<=|==|>|<)\s*(\d+))?$/.exec(s);
  if (m) return COMP_SLUGS.includes(m[1]) ? { neg, a: { t: "won", comp: m[1], op: (m[2] as Op) ?? ">=", v: m[3] !== undefined ? Number(m[3]) : 1 } } : `unknown competition "${m[1]}" in "${s}" (one of: ${COMP_SLUGS.join(", ")})`;
  m = /^wonAt\(([a-z0-9-]+),\s*([a-z0-9-]+)\)$/.exec(s);
  if (m) {
    if (!COMP_SLUGS.includes(m[1])) return `unknown competition "${m[1]}" in "${s}"`;
    return ALL_CLUB_SLUGS.has(m[2]) ? { neg, a: { t: "wonAt", comp: m[1], slug: m[2] } } : `unknown club "${m[2]}" in "${s}"`;
  }
  m = /^has\(([a-z0-9-]+)\)$/.exec(s);
  if (m) return UNLOCK_BY_ID.has(m[1]) ? { neg, a: { t: "has", id: m[1] } } : `unknown unlock "${m[1]}" in "${s}" (the ids are in lib/star/life/unlocks.ts)`;
  m = /^book\((.+)\)$/.exec(s);
  if (m) {
    const tags = tagList(m[1]);
    if (!tags) return `bad tag list in "${s}"`;
    const unknown = tags.find((t) => !SCRAPBOOK[t]);
    return unknown ? `unknown scrapbook tag "${unknown}" in "${s}" (add it to lib/star/life/book/scrapbook.json)` : { neg, a: { t: "book", tags } };
  }
  m = /^since\('([a-z0-9-]+)'\)\s*(>=|<=|==|>|<)\s*(\d+)$/.exec(s);
  if (m) return SCRAPBOOK[m[1]] ? { neg, a: { t: "since", tag: m[1], op: m[2] as Op, v: Number(m[3]) } } : `unknown scrapbook tag "${m[1]}" in "${s}" (add it to lib/star/life/book/scrapbook.json)`;
  m = /^just\(([a-z0-9:-]+)\)$/.exec(s);
  if (m) return isMilestone(m[1]) ? { neg, a: { t: "just", m: m[1] } } : `unknown milestone "${m[1]}" in "${s}" (birthday, star-level, new-club, first-call-up, call-up, trophy, trophy:<competition>, promoted, relegated)`;
  if (/^(club|everClub|opponent|won|wonAt|has|book|since|just)\b/.test(s) && !/^[a-zA-Z]+(>=|<=|==|>|<)/.test(s)) return `badly written story-world condition "${s}"`;
  return null;
}

function parseAtom(raw: string): AtomN | string {
  // "a && b": every part must hold (outside brackets).
  const ands = splitTop(raw, "&&");
  if (ands.length > 1) {
    const parts: AtomN[] = [];
    for (const p of ands) { const a = parseAtom(p); if (typeof a === "string") return a; parts.push(a); }
    return { neg: false, a: { t: "and", parts } };
  }
  let s = raw.trim();
  const neg = s.startsWith("!");
  if (neg) s = s.slice(1).trim();
  const v2 = parseV2(s, neg);
  if (v2) return v2;
  const w = parseWorld(s, neg);
  if (w) return w;
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
  for (const alt of splitTop(src, "||")) {
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
  const walk = (list: AtomN[]) => { for (const { a } of list) { if (a.t === "and") walk(a.parts); else if ("slot" in a) out.push(a.slot); } };
  walk(p);
  return out;
}

/** The memory tags a condition reads (the checker makes sure something writes them). */
export function tagsIn(src: string): string[] {
  const p = parseCond(src);
  if (typeof p === "string") return [];
  const out: string[] = [];
  const walk = (list: AtomN[]) => {
    for (const { a } of list) {
      if (a.t === "and") walk(a.parts);
      if (a.t === "mem") out.push(...a.tags);
      if (a.t === "squadAny") for (const c of a.conds) if (c.a.t === "pmem") out.push(...c.a.tags);
    }
  };
  walk(p);
  return out;
}

/** The stories (and endings) a condition waits on: [arc id, endings ([] = any)]. The checker makes
 *  sure each is a real story that can end that way. */
export function endedIn(src: string): [string, string[]][] {
  const p = parseCond(src);
  if (typeof p === "string") return [];
  const out: [string, string[]][] = [];
  const walk = (list: AtomN[]) => { for (const { a } of list) { if (a.t === "and") walk(a.parts); if (a.t === "ended") out.push([a.arc, a.ends]); } };
  walk(p);
  return out;
}

/** The life flags a condition reads (the checker makes sure something sets them). */
export function flagsIn(src: string): string[] {
  const p = parseCond(src);
  if (typeof p === "string") return [];
  const out: string[] = [];
  const walk = (list: AtomN[]) => { for (const { a } of list) { if (a.t === "and") walk(a.parts); if (a.t === "lifeFlag") out.push(a.name); } };
  walk(p);
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
    case "and": v = a.parts.every((p) => atomHolds(p, ctx)); break;
    case "said": v = !!ctx.v2?.talk?.said.includes(a.tag); break;
    case "promise": v = !!ctx.v2?.promise?.(a.id); break;
    case "ended": { const d = runIn(ctx.life, a.arc)?.done; v = !!d && (!a.ends.length || a.ends.includes(d)); break; }
    case "sameClub": v = !ctx.v2?.arc || ctx.v2.arc.club === ctx.v2.club; break;
    case "club": {
      const f = ctx.facts;
      v = a.which === "club" ? f.club === a.slug : a.which === "everClub" ? f.clubsEver.includes(a.slug) : f.opponents.includes(a.slug);
      break;
    }
    case "won": v = cmp(ctx.facts.trophies.filter(([cs]) => cs.includes(a.comp)).length, a.op, a.v); break;
    case "wonAt": v = ctx.facts.trophies.some(([cs, club]) => cs.includes(a.comp) && club === a.slug); break;
    case "has": v = unlocksOf(ctx.life).has(a.id); break;
    case "book": v = bookHas(ctx.life, a.tags, nowOf(ctx)); break;
    case "since": { const n = bookSince(ctx.life, a.tag, nowOf(ctx)); v = n !== undefined && cmp(n, a.op, a.v); break; }
    case "just": v = justHolds(ctx.life, a.m, nowOf(ctx), ctx.facts.trophies); break;
    case "act": { const x = ctx.v2?.activity; v = !!x && (a.what === "abandoned" ? x.abandoned : a.what === "won" ? x.won && !x.abandoned : !x.won && !x.abandoned); break; }
    case "v2cmp": {
      const l = v2Read(a.l, ctx), r = v2Read(a.r, ctx);
      if (l === undefined || r === undefined) { v = false; break; }
      if (typeof l === "number" && typeof r === "number") v = cmp(l, a.op, r);
      else v = a.op === "==" ? String(l) === String(r) : false;
      break;
    }
  }
  return x.neg ? !v : v;
}

/** The life week the conditions are read in (people.ts lifeWeek: 50 to a season). */
const nowOf = (ctx: CondCtx) => (ctx.facts.num.season - 1) * 50 + ctx.facts.num.week;

/** The scrapbook tags a condition reads (book('x'), since('x')): the checker makes sure a story writes them. */
export function bookTagsIn(src: string): string[] {
  const p = parseCond(src);
  if (typeof p === "string") return [];
  const out: string[] = [];
  const walk = (list: AtomN[]) => { for (const { a } of list) { if (a.t === "and") walk(a.parts); if (a.t === "book") out.push(...a.tags); if (a.t === "since") out.push(a.tag); } };
  walk(p);
  return out;
}

/** A story value (undefined when there is no story to read). */
export function v2Read(x: V2Val, ctx: CondCtx): number | string | undefined {
  if ("n" in x) return x.n;
  if ("s" in x) return x.s;
  const v2 = ctx.v2;
  if (x.ref === "arc.clock") return v2?.arc ? v2.arc.k[x.arg ?? ""] ?? 0 : undefined;
  if (x.ref === "talk.mood") return v2?.talk?.mood;
  if (x.ref.startsWith("activity.")) { const a = v2?.activity; return a ? (a as unknown as Record<string, number>)[x.ref.slice(9)] : undefined; }
  if (x.ref.startsWith("arc.")) return v2?.arc?.v[x.ref.slice(4)];
  return undefined;
}

/** Is the condition true? A condition that does not parse is never true. */
export function holds(src: string, ctx: CondCtx): boolean {
  const p = parseCond(src);
  if (typeof p === "string") return false;
  return p.some((a) => atomHolds(a, ctx));
}

export const allHold = (list: string[] | undefined, ctx: CondCtx) => (list ?? []).every((s) => holds(s, ctx));
