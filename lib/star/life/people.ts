/**
 * PEOPLE WHO REMEMBER (living world, design part 2).
 *
 * Every person has an id that never changes: a team-mate is his squad id, the
 * rest are role ids ("mgr", "agent", "fam:dad", "staff:physio", "hack:tabloid").
 * Names come from the id and the career, so they cost nothing in the save.
 * The save keeps only three numbers and up to 6 memory lines per person.
 *
 * Also here: Harry's team rule (20 Nov 2026): "if ur relationship with 1 player
 * goes down enough the general team relationship goes down … your team
 * relationship effects in game." See moveTeamFromPerson and teamForMatch.
 */
import type { CareerState, SquadPlayer } from "../types";
import type { LifeMemory, LifePerson, LifeState } from "./types";
import { PEOPLE_CAP, PERSON_MEMORY_CAP } from "./types";
import { scaledChange } from "../relationships";
import { poolPerson, type PoolPerson } from "./pool";

// ── Who is who ──────────────────────────────────────────────────────────

export type LifeRole = "teammate" | "manager" | "agent" | "dad" | "mum" | "brother" | "physio" | "kitman" | "tabloid" | "broadsheet"
  // Story arcs, batch 1 (lib/star/life/book/arcs/): one of each per career, named from the career's seed.
  | "groundsman" | "canteen" | "chairman" | "coach" | "partner" | "sister" | "pal" | "fan" | "kidfan" | "reporter" | "neighbour" | "rival" | "legend" | "sponsor" | "referee";
export const ROLE_ID: Record<Exclude<LifeRole, "teammate">, string> = {
  manager: "mgr", agent: "agent", dad: "fam:dad", mum: "fam:mum", brother: "fam:brother",
  physio: "staff:physio", kitman: "staff:kitman", tabloid: "hack:tabloid", broadsheet: "hack:broadsheet",
  groundsman: "staff:ground", canteen: "staff:canteen", chairman: "club:chair", coach: "staff:coach",
  partner: "fam:partner", sister: "fam:sister", pal: "pal:school", fan: "fan:tunnel", kidfan: "fan:kid",
  reporter: "hack:local", neighbour: "near:door", rival: "rival:one", legend: "club:legend", sponsor: "biz:rep", referee: "ref:one",
};
const ID_ROLE = new Map(Object.entries(ROLE_ID).map(([r, id]) => [id, r as LifeRole]));

export function roleOf(id: string): LifeRole {
  return ID_ROLE.get(id) ?? "teammate";
}

/** Where each person stands on the day you meet them. */
const START: Record<LifeRole, [number, number, number]> = {
  teammate: [40, 30, 0], manager: [45, 25, 0], agent: [50, 45, 0],
  dad: [60, 70, 0], mum: [65, 80, 0], brother: [45, 60, 0],
  physio: [50, 35, 0], kitman: [45, 40, 0], tabloid: [35, 15, 0], broadsheet: [45, 20, 0],
  groundsman: [45, 30, 0], canteen: [50, 45, 0], chairman: [45, 15, 0], coach: [45, 30, 0],
  partner: [60, 75, 0], sister: [50, 65, 0], pal: [45, 55, 0], fan: [40, 30, 0], kidfan: [55, 40, 0],
  reporter: [40, 20, 0], neighbour: [40, 20, 0], rival: [45, 5, 10], legend: [40, 20, 0], sponsor: [45, 25, 0], referee: [45, 10, 0],
};

/** The groups on the People page. */
export const ROLE_GROUP: Record<LifeRole, "Dressing room" | "Club staff" | "Family" | "Agent" | "Press" | "Around you"> = {
  teammate: "Dressing room", manager: "Club staff", physio: "Club staff", kitman: "Club staff",
  dad: "Family", mum: "Family", brother: "Family", agent: "Agent", tabloid: "Press", broadsheet: "Press",
  groundsman: "Club staff", canteen: "Club staff", chairman: "Club staff", coach: "Club staff",
  partner: "Family", sister: "Family", pal: "Family", reporter: "Press", sponsor: "Agent",
  fan: "Around you", kidfan: "Around you", neighbour: "Around you", rival: "Around you", legend: "Around you", referee: "Around you",
};

export const ROLE_TITLE: Record<LifeRole, string> = {
  teammate: "Team-mate", manager: "Your manager", agent: "Your agent", dad: "Your dad", mum: "Your mum",
  brother: "Your brother", physio: "Club physio", kitman: "Kit man", tabloid: "Tabloid reporter", broadsheet: "Broadsheet writer",
  groundsman: "Head groundsman", canteen: "Runs the canteen", chairman: "The chairman", coach: "First-team coach",
  partner: "Your partner", sister: "Your sister", pal: "Old school friend", fan: "Season ticket, by the tunnel", kidfan: "A young fan",
  reporter: "Local paper", neighbour: "Your neighbour", rival: "Plays for another club", legend: "Club legend", sponsor: "Sponsor's rep", referee: "Referee",
};

const FIRST_M = ["Gary", "Steve", "Danny", "Rob", "Kev", "Tony", "Mark", "Lee", "Paul", "Dean", "Craig", "Neil"];
const FIRST_F = ["Sarah", "Jo", "Helen", "Amy", "Claire", "Nadia", "Priya", "Lucy"];
/** Surnames a generated squad never uses (squadData.ts), so the agent is never "Moreno" next to a Moreno at left back. */
const SURNAMES = ["Hartley", "Brennan", "Ashworth", "Pike", "Dunmore", "Lomax", "Collier", "Prentice", "Whitlock", "Fairbrother", "Sefton", "Kettering"];
/** Invented papers (never a real outlet). */
export const OUTLETS: Record<"tabloid" | "broadsheet" | "reporter", string> = { tabloid: "Daily Whistle", broadsheet: "Sporting Ledger", reporter: "Evening Lantern" };
/** The invented boot brand the sponsor's rep works for (read as {sponsor.outlet}). */
export const SPONSOR_BRAND = "Halden";
/** More names for the story people, so the canteen and the groundsman never share a surname. */
const SURNAMES_2 = ["Rowntree", "Gilmour", "Okafor", "Varley", "Quigley", "Thwaite", "Mensah", "Doherty", "Pickering", "Sowerby", "Callaghan", "Ibbotson", "Marsh", "Kowalski", "Haworth", "Bairstow"];
const FIRST_OLD = ["Ron", "Alan", "Brian", "Frank", "Terry", "Derek", "Keith", "Malcolm"];
const FIRST_KID = ["Maisie", "Ellie", "Ruby", "Isla", "Poppy", "Freya"];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export interface PersonInfo {
  id: string;
  role: LifeRole;
  name: string;
  short: string;
  /** Squad data for a team-mate. */
  player?: SquadPlayer;
  outlet?: string;
  /** A role with a pool (pool.ts): the person this career has, with age, accent, look, sign-off. */
  pool?: PoolPerson;
}

/** A person's name and role, from the id and the career. Null = unknown id
 *  (a team-mate who has left keeps his record but has no squad row). */
export function personInfo(c: CareerState, id: string): PersonInfo | null {
  const role = roleOf(id);
  const sur = c.player.lastName || "Smith";
  const seed = hash(`${c.player.firstName}|${c.player.lastName}|${c.player.startYear}`);
  const pick = <T,>(a: T[], k: string) => a[(seed + hash(k)) % a.length];
  // The story people take consecutive names from one shuffle, so two of them never share one.
  const nth = <T,>(a: T[], n: number) => a[(seed + n) % a.length];
  // A role with a pool: the one person this career keeps for it (Den is one kit man of four).
  const pp = role === "teammate" || role === "manager" ? null : poolPerson(c, role);
  if (pp) return { id, role, name: `${pp.first} ${pp.last}`, short: pp.short ?? pp.first, pool: pp, outlet: role === "reporter" ? OUTLETS.reporter : undefined };
  switch (role) {
    case "teammate": {
      const p = (c.squad ?? []).find((s) => s.id === id);
      if (!p) {
        // He has left; his record (and name) stay while he has a strong memory.
        const n = c.life?.people[id]?.n;
        return n ? { id, role, name: n, short: n.split(" ").slice(-1)[0] } : null;
      }
      return { id, role, name: p.name, short: p.shortName || p.name.split(" ").slice(-1)[0], player: p };
    }
    case "manager": {
      const n = c.manager?.name ?? "The gaffer";
      return { id, role, name: n, short: "the gaffer" };
    }
    case "dad": return { id, role, name: `${pick(FIRST_M, "dad")} ${sur}`, short: "Dad" };
    case "mum": return { id, role, name: `${pick(FIRST_F, "mum")} ${sur}`, short: "Mum" };
    case "brother": { const f = pick(FIRST_M, "bro"); return { id, role, name: `${f} ${sur}`, short: f }; }
    case "agent": { const f = pick(FIRST_M, "agent"); const s = pick(SURNAMES, "agent-s"); return { id, role, name: `${f} ${s}`, short: f }; }
    case "physio": { const f = pick(FIRST_F, "physio"); const s = pick(SURNAMES, "physio-s"); return { id, role, name: `${f} ${s}`, short: f }; }
    // (the pool always has a kit man; this is only a fallback)
    case "kitman": return { id, role, name: `Den ${pick(SURNAMES, "kit-s")}`, short: "Den" };
    case "tabloid": case "broadsheet": {
      const f = pick(FIRST_M, role); const s = pick(SURNAMES, `${role}-s`);
      return { id, role, name: `${f} ${s}`, short: s, outlet: OUTLETS[role] };
    }
    // The story people (batch 1). Each is one person for the whole career, named from its seed.
    case "groundsman": { const f = nth(FIRST_OLD, 0); return { id, role, name: `${f} ${nth(SURNAMES_2, 0)}`, short: f }; }
    case "canteen": { const f = nth(FIRST_F, 0); return { id, role, name: `${f} ${nth(SURNAMES_2, 1)}`, short: f }; }
    case "chairman": { const s = nth(SURNAMES_2, 2); return { id, role, name: `${nth(FIRST_OLD, 1)} ${s}`, short: `Mr ${s}` }; }
    case "coach": { const f = nth(FIRST_M, 0); return { id, role, name: `${f} ${nth(SURNAMES_2, 3)}`, short: f }; }
    case "partner": { const f = c.girlfriend?.name?.split(" ")[0] || nth(FIRST_F, 1); return { id, role, name: c.girlfriend?.name || `${f} ${nth(SURNAMES_2, 4)}`, short: f }; }
    case "sister": { const f = nth(FIRST_F, 5); return { id, role, name: `${f} ${sur}`, short: f }; }
    case "pal": { const f = nth(FIRST_M, 1); return { id, role, name: `${f} ${nth(SURNAMES_2, 5)}`, short: f }; }
    case "fan": { const f = nth(FIRST_OLD, 2); return { id, role, name: `${f} ${nth(SURNAMES_2, 6)}`, short: f }; }
    case "kidfan": { const f = nth(FIRST_KID, 0); return { id, role, name: `${f} ${nth(SURNAMES_2, 7)}`, short: f }; }
    case "reporter": { const f = nth(FIRST_F, 2); return { id, role, name: `${f} ${nth(SURNAMES_2, 8)}`, short: f, outlet: OUTLETS.reporter }; }
    case "neighbour": { const s = nth(SURNAMES_2, 9); return { id, role, name: `${nth(FIRST_F, 4)} ${s}`, short: `Mrs ${s}` }; }
    case "rival": { const s = nth(SURNAMES_2, 10); return { id, role, name: `${nth(FIRST_M, 2)} ${s}`, short: s }; }
    case "legend": { const s = nth(SURNAMES_2, 11); return { id, role, name: `${nth(FIRST_OLD, 3)} ${s}`, short: s }; }
    case "sponsor": { const f = nth(FIRST_F, 3); return { id, role, name: `${f} ${nth(SURNAMES_2, 12)}`, short: f, outlet: SPONSOR_BRAND }; }
    case "referee": { const s = nth(SURNAMES_2, 13); return { id, role, name: `${nth(FIRST_M, 3)} ${s}`, short: `Mr ${s}` }; }
  }
}

// ── The store ────────────────────────────────────────────────────────────

export function freshLife(): LifeState {
  return { v: 2, people: {}, squad: [], self: [], fired: {}, pending: [], groups: {}, cats: {}, wk: [0, 0, 0], lastBig: -999, soc: [0, {}], flags: [], teamCarry: 0, log: [] };
}

/** The life week: one number that only goes up (season × 50 + week). */
export function lifeWeek(c: Pick<CareerState, "season" | "week">): number {
  return (c.season - 1) * 50 + c.week;
}

/** Read a person; a person never met reads as his role's start (not stored). */
export function peek(life: LifeState, id: string): LifePerson {
  const r = life.people[id];
  if (r) return r;
  const [rr, b, g] = START[roleOf(id)];
  return { r: rr, b, g, m: [], s: -1 };
}

/** Make sure a person has a record (first meeting). Mutates `life`. */
export function meet(life: LifeState, id: string, now: number, name?: string): LifePerson {
  if (!life.people[id]) {
    const [r, b, g] = START[roleOf(id)];
    life.people[id] = { r, b, g, m: [], s: now };
  }
  if (name && roleOf(id) === "teammate") life.people[id].n = name;
  return life.people[id];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Move one number on one person. Gains shrink near 100 and losses near 0 —
 * the same curve the boss/team/fans bars use (relationships.ts scaledChange),
 * without its 0.65 match scale, so a named act lands at full size.
 * Returns the real change.
 */
export function nudge(p: LifePerson, key: "r" | "b" | "g", raw: number): number {
  if (!raw) return 0;
  const before = p[key];
  const shaped = key === "g" ? raw : scaledChange(before, raw) / (raw > 0 ? 0.65 : 1);
  p[key] = clamp(before + shaped);
  return p[key] - before;
}

/** How long a memory lasts (life weeks): 1 ≈ a season, 2 ≈ three, 3 = for ever. */
export const MEMORY_LIFE: Record<1 | 2 | 3, number> = { 1: 46, 2: 138, 3: Infinity };

/** Write a memory line; a full log drops its weakest (then oldest) line. */
export function remember(list: LifeMemory[], tag: string, now: number, strength: 1 | 2 | 3): LifeMemory[] {
  const rest = list.filter(([t]) => t !== tag);
  const next: LifeMemory[] = [...rest, [tag, now, strength]];
  while (next.length > PERSON_MEMORY_CAP) {
    let worst = 0;
    for (let i = 1; i < next.length; i++) {
      const a = next[i], w = next[worst];
      if (a[2] < w[2] || (a[2] === w[2] && a[1] < w[1])) worst = i;
    }
    next.splice(worst, 1);
  }
  return next;
}

/** Memories that have run their time are forgotten. */
export function fade(list: LifeMemory[], now: number): LifeMemory[] {
  return list.filter(([, at, s]) => now - at < MEMORY_LIFE[s]);
}

/**
 * Who is remembered (story batch 1, 21 Nov 2026). Once a week, and whenever the
 * stories push past PEOPLE_CAP:
 *  1. Memories past their time fade.
 *  2. A team-mate who has left is forgotten unless he still MATTERS: he is in a
 *     story that is still open, a promise to him is still open, or he left a strong
 *     feeling (bond 50+ or grudge 40+) with a memory of strength 2 or more. A
 *     minor team-mate is forgotten once his story closes.
 *     (Was: any strength-2 memory kept him, design 2.3. With 60 stories writing
 *     strength-3 memories that kept every old team-mate for ever.)
 *  3. Over PEOPLE_CAP, the weakest go first: never someone in an open story or owed
 *     a promise; a role (family, staff, press) before a team-mate only when it has
 *     nothing at all.
 */
export function tidy(life: LifeState, c: CareerState, now: number): void {
  const inSquad = new Set((c.squad ?? []).map((p) => p.id));
  const live = new Set<string>();
  for (const run of Object.values(life.arcs ?? {})) if (!run.done || Object.keys(run.s).length) for (const id of Object.values(run.cast)) if (id) live.add(id);
  for (const pr of life.promises ?? []) if (pr.st === "open") live.add(pr.to);
  for (const [id, p] of Object.entries(life.people)) {
    p.m = fade(p.m, now);
    if (roleOf(id) !== "teammate" || inSquad.has(id) || live.has(id)) continue;
    const strong = (p.b >= 50 || p.g >= 40) && p.m.some(([, , s]) => s >= 2);
    if (!strong) delete life.people[id];
  }
  life.squad = fade(life.squad, now);
  life.self = fade(life.self, now);
  const ids = Object.keys(life.people);
  if (ids.length > PEOPLE_CAP) {
    const score = (id: string) => {
      const p = life.people[id];
      const has = p.m.reduce((a, [, , s]) => a + s * 10, 0) + Math.abs(p.b - 30) + p.g;
      return has + (live.has(id) ? 10_000 : 0) + (inSquad.has(id) ? 50 : 0) + (roleOf(id) !== "teammate" && (has > 10 || p.m.length) ? 1000 : 0);
    };
    ids.sort((a, b) => score(a) - score(b));
    for (const id of ids.slice(0, ids.length - PEOPLE_CAP)) delete life.people[id];
  }
}

/** Keep the roster in step with the squad (who joined when). Mutates `life`. */
export function noteSquad(life: LifeState, c: CareerState, now: number): void {
  const ids = (c.squad ?? []).map((p) => p.id);
  if (!life.roster) { life.roster = Object.fromEntries(ids.map((id) => [id, 0])); return; }
  const keep = new Set(ids);
  for (const id of Object.keys(life.roster)) if (!keep.has(id)) delete life.roster[id];
  for (const id of ids) if (life.roster[id] === undefined) life.roster[id] = now;
}

/** A new signing: joined in the last NEW_SIGNING_WEEKS (unknown to a roster that exists = just arrived). */
export const NEW_SIGNING_WEEKS = 8;
export function isNewSigning(life: LifeState, id: string, now: number): boolean {
  const r = life.roster;
  if (!r || !Object.keys(r).length) return false;
  const at = r[id];
  return at === undefined || (at > 0 && now - at <= NEW_SIGNING_WEEKS);
}

// ── The team rule (Harry, 20 Nov 2026) ──────────────────────────────────

/** A team-mate's bond moves the team bar by a fifth of it (design 2.3). */
export const TEAM_SHARE = 0.2;
/** A fall-out: bond under this, or grudge at or over FALL_OUT_GRUDGE. */
export const FALL_OUT_BOND = 15;
export const FALL_OUT_GRUDGE = 50;
/** What a fall-out costs the team bar once, and what making up gives back. */
export const FALL_OUT_HIT = 4;
export const MAKE_UP_BACK = 2;
/** Each live fall-out takes this off the team number the match would read (max 4 of them). */
export const FALL_OUT_MATCH = 2;

export interface TeamMove { team: number; fellOut: boolean; madeUp: boolean }

/**
 * After a team-mate's numbers moved: the team bar moves a fifth of his bond
 * change (kept fractions in life.teamCarry), and if he has now fallen out with
 * you the whole dressing room takes a side (−FALL_OUT_HIT, once). Making up
 * (bond back to 35+ and grudge under 30) clears it and gives MAKE_UP_BACK back.
 * Returns the whole team-bar change to apply.
 */
export function moveTeamFromPerson(life: LifeState, id: string, bondChange: number): TeamMove {
  if (roleOf(id) !== "teammate") return { team: 0, fellOut: false, madeUp: false };
  const p = life.people[id];
  const exact = life.teamCarry + bondChange * TEAM_SHARE;
  const whole = exact < 0 ? Math.ceil(exact) : Math.floor(exact);
  life.teamCarry = Math.max(-0.99, Math.min(0.99, exact - whole));
  let team = whole, fellOut = false, madeUp = false;
  if (p) {
    const out = p.b < FALL_OUT_BOND || p.g >= FALL_OUT_GRUDGE;
    if (out && !p.f) { p.f = 1; team -= FALL_OUT_HIT; fellOut = true; }
    else if (p.f && p.b >= 35 && p.g < 30) { delete p.f; team += MAKE_UP_BACK; madeUp = true; }
  }
  return { team, fellOut, madeUp };
}

/** Team-mates you have fallen out with, right now. */
export function fallOuts(life: LifeState | undefined, c: CareerState): string[] {
  if (!life) return [];
  const inSquad = new Set((c.squad ?? []).map((p) => p.id));
  return Object.entries(life.people).filter(([id, p]) => p.f && inSquad.has(id)).map(([id]) => id);
}

/**
 * THE ONE HOOK THE MATCH CAN READ LATER (not wired yet — the engine is not
 * touched in phase 1). The team number a match should use: your team bar,
 * less FALL_OUT_MATCH for each team-mate you have fallen out with (at most 4).
 * With no life block it is exactly the team bar, so wiring it changes nothing
 * for a career that never met the living world.
 *
 * Where it plugs in (phase 3, needs the engine warning, RUL-ENG-001):
 * lib/star/matchInputs.ts `context.teamRelationship: career.relationships.team`
 * and components/star/EnginePlay.tsx `teamRelationship={career.relationships.team}`
 * — swap both for teamForMatch(career). Inside a chance the team number
 * already sets how well team-mates combine (buildScenario's teamRelationship).
 */
export function teamForMatch(c: CareerState): number {
  const base = c.relationships.team;
  const n = Math.min(4, fallOuts(c.life, c).length);
  return Math.max(0, base - n * FALL_OUT_MATCH);
}
