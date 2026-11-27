/**
 * SAVE MIGRATION for `career.life` (living world). An old save has no life
 * block: it simply starts one at the first event (freshLife). A save that has
 * one is checked on load: every field is put back in shape, numbers clamped,
 * memory logs trimmed to 6, people to 60, so a damaged or older block can
 * never crash the director.
 */
import type { ArcRun, LifeMemory, LifePerson, LifeState, ObjectiveRun, PromiseRun } from "./types";
import { PEOPLE_CAP, PERSON_MEMORY_CAP } from "./types";
import { freshLife } from "./people";

/** A sanity bound on stories in one save, far above what a career can meet. */
const MAX_SAVED_ARCS = 2000;

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const clamp = (v: unknown, d: number) => Math.max(0, Math.min(100, Math.round(num(v, d))));
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function mems(v: unknown): LifeMemory[] {
  if (!Array.isArray(v)) return [];
  const out: LifeMemory[] = [];
  for (const m of v) {
    if (!Array.isArray(m) || typeof m[0] !== "string") continue;
    const s = num(m[2], 1);
    out.push([m[0], num(m[1], 0), (s >= 3 ? 3 : s >= 2 ? 2 : 1) as 1 | 2 | 3]);
  }
  return out.slice(-PERSON_MEMORY_CAP);
}

export function migrateLife(raw: unknown): LifeState {
  const f = freshLife();
  const o = obj(raw);
  if (!Object.keys(o).length) return f;
  const people: Record<string, LifePerson> = {};
  for (const [id, pv] of Object.entries(obj(o.people)).slice(0, PEOPLE_CAP)) {
    const p = obj(pv);
    people[id] = { r: clamp(p.r, 40), b: clamp(p.b, 30), g: clamp(p.g, 0), m: mems(p.m), s: num(p.s, 0), ...(p.f ? { f: 1 as const } : {}), ...(typeof p.n === "string" ? { n: p.n } : {}) };
  }
  const fired: Record<string, number[]> = {};
  for (const [id, w] of Object.entries(obj(o.fired))) if (Array.isArray(w)) fired[id] = w.filter((x) => typeof x === "number");
  const numMap = (v: unknown) => Object.fromEntries(Object.entries(obj(v)).filter(([, x]) => typeof x === "number")) as Record<string, number>;
  const wk = Array.isArray(o.wk) ? o.wk : [];
  const soc = Array.isArray(o.soc) ? o.soc : [];
  return {
    v: 2,
    people,
    squad: mems(o.squad).slice(-PERSON_MEMORY_CAP),
    self: mems(o.self),
    fired,
    pending: (Array.isArray(o.pending) ? o.pending : []).map(obj).filter((p) => typeof p.event === "string").slice(-20).map((p) => ({
      event: p.event as string, due: num(p.due, 0),
      cast: Object.fromEntries(Object.entries(obj(p.cast)).filter(([, x]) => typeof x === "string")) as Record<string, string>,
      ...(typeof p.if === "string" ? { if: p.if } : {}),
    })),
    groups: numMap(o.groups),
    cats: numMap(o.cats),
    wk: [num(wk[0], 0), num(wk[1], 0), num(wk[2], 0)],
    lastBig: num(o.lastBig, -999),
    soc: [num(soc[0], 0), numMap(soc[1])],
    flags: (Array.isArray(o.flags) ? o.flags : []).filter((x): x is string => typeof x === "string").slice(-12),
    teamCarry: Math.max(-0.99, Math.min(0.99, num(o.teamCarry, 0))),
    ...(o.roster && typeof o.roster === "object" ? { roster: numMap(o.roster) } : {}),
    ...(Array.isArray(o.voice) && o.voice.length === 6 ? { voice: o.voice.map((x) => Math.max(0, Math.round(num(x, 0)))) as LifeState["voice"] } : {}),
    ...migrateV2(o),
    log: (Array.isArray(o.log) ? o.log : []).map(obj).filter((r) => typeof r.e === "string").slice(-12).map((r) => ({ w: num(r.w, 0), e: r.e as string, c: String(r.c ?? ""), t: String(r.t ?? "").slice(0, 140) })),
  };
}

/** Events v2's fields (arcs, promises, objectives, things you got): kept when
 *  well formed, dropped piece by piece when not. A v1 block gets none of them. */
function migrateV2(o: Record<string, unknown>): Partial<LifeState> {
  const out: Partial<LifeState> = {};
  const str = (v: unknown) => typeof v === "string";
  const strMap = (v: unknown) => Object.fromEntries(Object.entries(obj(v)).filter(([, x]) => str(x))) as Record<string, string>;
  const numList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number").slice(-12) : []);
  if (o.arcs && typeof o.arcs === "object") {
    const arcs: Record<string, ArcRun> = {};
    // Every story is kept (this was 40, so a career that had met more lost the rest on load).
    for (const [id, rv] of Object.entries(obj(o.arcs)).slice(0, MAX_SAVED_ARCS)) {
      const r = obj(rv);
      const v = Object.fromEntries(Object.entries(obj(r.v)).filter(([, x]) => typeof x === "number" || str(x)).slice(0, 12)) as ArcRun["v"];
      const f: ArcRun["f"] = {};
      for (const [b, w] of Object.entries(obj(r.f))) f[b] = numList(w);
      const oo = Array.isArray(r.o) && str(r.o[0]) && str(r.o[1]) && typeof r.o[2] === "number" ? (r.o as [string, string, number]) : undefined;
      arcs[id] = {
        at: num(r.at, 0), club: str(r.club) ? (r.club as string) : "", cast: strMap(r.cast), v,
        k: Object.fromEntries(Object.entries(obj(r.k)).filter(([, x]) => typeof x === "number")) as Record<string, number>,
        f, s: Object.fromEntries(Object.entries(obj(r.s)).filter(([, x]) => typeof x === "number")) as Record<string, number>,
        ...(oo ? { o: oo } : {}), ...(str(r.done) ? { done: r.done as string } : {}), ...(str(r.last) ? { last: r.last as string } : {}),
      };
    }
    out.arcs = arcs;
  }
  // Finished stories, packed (arcPack.ts): each well-formed word is kept as it is (the book is not
  // loaded here; a word for a story no longer in the book is kept and simply not shown).
  if (str(o.fin)) {
    const words = (o.fin as string).split(" ").filter((w) => /^[0-9a-z]{8,}\.[0-9a-z]+(\.[^\s.]+)?$/.test(w)).slice(-MAX_SAVED_ARCS);
    if (words.length) out.fin = Array.from(new Set(words)).join(" ");
  }
  // The people pool (pool.ts): a pinned person is kept; a save whose kit man story started
  // before the pool existed keeps Den (the man it was written with).
  const pool = strMap(o.pool);
  if (out.arcs?.["arc-hundred-balls"] && !pool.kitman) pool.kitman = "den";
  if (Object.keys(pool).length) out.pool = pool;
  if (Array.isArray(o.promises)) {
    out.promises = o.promises.map(obj).filter((p) => str(p.id) && str(p.arc)).slice(-26).map((p): PromiseRun => ({
      id: p.id as string, arc: p.arc as string, to: String(p.to ?? ""), text: String(p.text ?? "").slice(0, 160), made: num(p.made, 0), due: num(p.due, -1),
      st: p.st === "kept" || p.st === "broken" ? p.st : "open", ...(typeof p.end === "number" ? { end: p.end } : {}), ...(p.r ? { r: 1 as const } : {}),
    }));
  }
  if (Array.isArray(o.objs)) {
    out.objs = o.objs.map(obj).filter((x) => str(x.id) && str(x.met) && str(x.onMet) && str(x.onMiss)).slice(-2).map((x): ObjectiveRun => ({
      id: x.id as string, arc: String(x.arc ?? ""), text: String(x.text ?? ""), left: num(x.left, 1), met: x.met as string, onMet: x.onMet as string, onMiss: x.onMiss as string, made: num(x.made, 0),
    }));
  }
  if (Array.isArray(o.got)) out.got = o.got.filter(str).slice(-20) as string[];
  return out;
}
