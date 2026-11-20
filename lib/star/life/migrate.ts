/**
 * SAVE MIGRATION for `career.life` (living world). An old save has no life
 * block: it simply starts one at the first event (freshLife). A save that has
 * one is checked on load: every field is put back in shape, numbers clamped,
 * memory logs trimmed to 6, people to 60, so a damaged or older block can
 * never crash the director.
 */
import type { LifeMemory, LifePerson, LifeState } from "./types";
import { PEOPLE_CAP, PERSON_MEMORY_CAP } from "./types";
import { freshLife } from "./people";

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
    v: 1,
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
    log: (Array.isArray(o.log) ? o.log : []).map(obj).filter((r) => typeof r.e === "string").slice(-12).map((r) => ({ w: num(r.w, 0), e: r.e as string, c: String(r.c ?? ""), t: String(r.t ?? "").slice(0, 140) })),
  };
}
