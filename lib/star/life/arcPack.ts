/**
 * FINISHED STORIES, PACKED SMALL (27 Nov 2026). Pure, no React.
 *
 * Harry wants hundreds more stories, and the save keeps every story a career has met. A finished
 * story used to keep a whole record in `life.arcs` (about 170 bytes, most of it names). Once it is
 * over, the game only ever shows four things about it: how it ended, who it was with, which beats
 * of the main line you played (the dots on the phone) and the week it started (story pacing). So a
 * finished story is packed into one word in `life.fin`, words joined by spaces:
 *
 *     k3f9 q1x 1b . 7 [. owner]         → "k3f9q1x1b.7" without the spaces (12 bytes or so)
 *     │    │   │    │   └ only when the story's person is not the usual one for the role
 *     │    │   │    └ beats played: bit n-1 for main-line beat n (base 36)
 *     │    │   └ the life week it started (base 36)
 *     │    └ its ending: 3 letters made from the ending's id (endCode)
 *     └ the story: 4 letters made from its id (arcCode), or the file's own `code`
 *
 * What is packed: a story with a `start` (not the kit man) that has ended, has nothing scheduled
 * or on offer, no match objective, and was already shrunk (arcs.ts: values, clocks and club wiped,
 * only the owner kept, one moment after it ended). Packed, it reads EXACTLY as that shrunk record
 * did (`arcsOf` unpacks it), so nothing in the game can tell the difference. A beat that must
 * change a packed story (a test page's forced start, an ending played late) unpacks it first
 * (`unpackRun`), and it is packed again at the next moment.
 *
 * Old saves: `life.fin` is new, so an old save simply has none; its finished stories are packed at
 * its first story moment after loading (`packDone` in arcMoment). The book never has to be loaded
 * to read a save (storage.ts / migrate.ts stay small).
 *
 * Writers: never rename a story's id or an ending's id, and never renumber a main-line beat's `n`
 * once a story is in the game (old saves name them). The checker (validateArcBook) fails if two
 * stories' codes clash or two endings of one story clash: then set `"code"` on the new story, or
 * rename the new ending.
 */
import type { ArcRun, LifeArc, LifeState } from "./types";
import { ALL_ARCS, arcById } from "./arcBook";
import { ROLE_ID } from "./people";

const fnv = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
};
const b36 = (n: number, w = 0) => n.toString(36).padStart(w, "0");

/** A story's 4-letter code in the save. */
export const arcCode = (arc: Pick<LifeArc, "id" | "code">): string => arc.code ?? b36(fnv(arc.id) % 36 ** 4, 4);
/** An ending's 3-letter code (unique inside its story). */
export const endCode = (endId: string): string => b36(fnv(endId) % 36 ** 3, 3);

/** The usual person for the story's owner (a role has one id per career), or null for a team-mate. */
function usualOwner(arc: LifeArc): string | null {
  const pick = arc.cast.find((s) => s.slot === arc.owner)?.pick;
  return (pick && (ROLE_ID as Record<string, string>)[pick]) || null;
}

/** The book's codes, and the stories that cannot be packed because a code clashes. */
let CODES: { byCode: Map<string, LifeArc>; unsafe: Set<string> } | null = null;
function codes() {
  if (CODES) return CODES;
  const byCode = new Map<string, LifeArc>(), unsafe = new Set<string>();
  for (const a of ALL_ARCS) {
    const k = arcCode(a);
    const other = byCode.get(k);
    if (other) { unsafe.add(a.id); unsafe.add(other.id); } else byCode.set(k, a);
    if (new Set(a.ends.map((e) => endCode(e.id))).size !== a.ends.length) unsafe.add(a.id);
  }
  CODES = { byCode, unsafe };
  return CODES;
}

/** For the checker: code clashes in a book. */
export function packProblems(arcs: LifeArc[]): { id: string; problem: string }[] {
  const out: { id: string; problem: string }[] = [];
  const seen = new Map<string, string>();
  for (const a of arcs) {
    if (a.code !== undefined && !/^[0-9a-z]{4}$/.test(a.code)) out.push({ id: a.id, problem: `"code" must be 4 lower-case letters or digits (got "${a.code}")` });
    const k = arcCode(a);
    if (seen.has(k)) out.push({ id: a.id, problem: `its save code "${k}" is also ${seen.get(k)}'s: give this story its own "code" (4 letters or digits)` });
    else seen.set(k, a.id);
    const ends = new Map<string, string>();
    for (const e of a.ends) {
      const c = endCode(e.id);
      if (ends.has(c)) out.push({ id: a.id, problem: `the endings "${ends.get(c)}" and "${e.id}" have the same save code: rename the new one` });
      ends.set(c, e.id);
    }
  }
  return out;
}

/** The first beat with each main-line number (the phone's dots read these). */
function mainBeats(arc: LifeArc): string[] {
  const out: string[] = [];
  for (const b of arc.beats) if (b.n && out[b.n - 1] === undefined) out[b.n - 1] = b.id;
  return out;
}

/** One finished, shrunk story as its packed word, or null when it must stay a full record. */
export function packRun(arc: LifeArc, run: ArcRun): string | null {
  if (!arc.start || !run.done || run.o || run.last !== undefined || run.club !== "") return null;
  if (Object.keys(run.s).length || Object.keys(run.v).length || Object.keys(run.k).length) return null;
  if (codes().unsafe.has(arc.id) || !arc.ends.some((e) => e.id === run.done)) return null;
  if (!Number.isInteger(run.at) || run.at < 0) return null;
  const castKeys = Object.keys(run.cast);
  if (castKeys.some((k) => k !== arc.owner)) return null;
  const who = run.cast[arc.owner];
  if (who === "") return null;
  let owner = "";
  if (who === undefined) owner = ".-";
  else if (who !== usualOwner(arc)) { if (!/^[^\s.]+$/.test(who) || who === "-") return null; owner = `.${who}`; }
  let mask = 0;
  mainBeats(arc).forEach((id, i) => { if (id && run.f[id]?.length) mask |= 1 << i; });
  return `${arcCode(arc)}${endCode(run.done)}${b36(run.at)}.${b36(mask)}${owner}`;
}

const WORD = /^([0-9a-z]{4})([0-9a-z]{3})([0-9a-z]+)\.([0-9a-z]+)(?:\.([^\s.]+))?$/;

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === "object") { for (const v of Object.values(o)) deepFreeze(v); Object.freeze(o); }
  return o;
};

/** A packed word back as the shrunk record it was (frozen: change it through unpackRun). */
export function unpackWord(word: string): [string, ArcRun] | null {
  const m = WORD.exec(word);
  if (!m) return null;
  const arc = codes().byCode.get(m[1]);
  if (!arc || codes().unsafe.has(arc.id)) return null;
  const end = arc.ends.find((e) => endCode(e.id) === m[2]);
  if (!end) return null;
  const at = parseInt(m[3], 36), mask = parseInt(m[4], 36);
  const cast: Record<string, string> = {};
  const usual = usualOwner(arc);
  if (m[5] === undefined) { if (usual) cast[arc.owner] = usual; else return null; }
  else if (m[5] !== "-") cast[arc.owner] = m[5];
  const f: Record<string, number[]> = {};
  mainBeats(arc).forEach((id, i) => { if (id && mask & (1 << i)) f[id] = [at]; });
  return [arc.id, deepFreeze({ at, club: "", cast, v: {}, k: {}, f, s: {}, done: end.id })];
}

/** Packed words that are not a story of this book (a story taken out) are kept as they are. */
const PARSED = new Map<string, Map<string, [ArcRun, string]>>();
function parsed(fin: string): Map<string, [ArcRun, string]> {
  let hit = PARSED.get(fin);
  if (hit) return hit;
  hit = new Map();
  for (const w of fin.split(" ")) {
    const r = w ? unpackWord(w) : null;
    if (r && !hit.has(r[0])) hit.set(r[0], [r[1], w]);
  }
  if (PARSED.size > 64) PARSED.clear();
  PARSED.set(fin, hit);
  return hit;
}

/** A story's record, full or packed (read only). */
export function runIn(life: LifeState, id: string): ArcRun | undefined {
  return life.arcs?.[id] ?? (life.fin ? parsed(life.fin).get(id)?.[0] : undefined);
}

/** Is this story packed (finished, nothing left to play)? */
export const isPacked = (life: LifeState, id: string): boolean => !life.arcs?.[id] && !!life.fin && parsed(life.fin).has(id);

const MERGED = new WeakMap<LifeState, { arcs: LifeState["arcs"]; fin: string | undefined; n: number; out: Record<string, ArcRun> }>();
/** Every story, open and finished, in the order they started (what `life.arcs` was before packing). */
export function allRuns(life: LifeState): Record<string, ArcRun> {
  const arcs = life.arcs ?? {};
  if (!life.fin) return arcs;
  const n = Object.keys(arcs).length;
  const hit = MERGED.get(life);
  if (hit && hit.arcs === life.arcs && hit.fin === life.fin && hit.n === n) return hit.out;
  const rows: [string, ArcRun][] = Object.entries(arcs);
  parsed(life.fin).forEach(([run], id) => { if (!(id in arcs)) rows.push([id, run]); });
  rows.sort((a, b) => a[1].at - b[1].at);
  const out = Object.fromEntries(rows);
  MERGED.set(life, { arcs: life.arcs, fin: life.fin, n, out });
  return out;
}

/** Pack every finished story that is ready (mutates `life`, a copy). */
export function packDone(life: LifeState): void {
  if (!life.arcs) return;
  const busy = new Set((life.objs ?? []).map((o) => o.arc));
  const words: string[] = [];
  for (const [id, run] of Object.entries(life.arcs)) {
    const arc = arcById(id);
    if (!arc || busy.has(id) || (life.fin && parsed(life.fin).has(id))) continue;
    const w = packRun(arc, run);
    if (!w) continue;
    words.push(w);
    delete life.arcs[id];
  }
  if (words.length) life.fin = [life.fin, ...words].filter(Boolean).join(" ");
}

/** A packed story as a full record again, in `life.arcs` (mutates `life`, a copy), for a beat that
 *  must change it. A story that is not packed is returned as it is. */
export function unpackRun(life: LifeState, id: string): ArcRun | undefined {
  const full = life.arcs?.[id];
  if (full || !life.fin) return full;
  const hit = parsed(life.fin).get(id);
  if (!hit) return undefined;
  const run = JSON.parse(JSON.stringify(hit[0])) as ArcRun;
  const words = life.fin.split(" ").filter((w) => w && w !== hit[1]);
  if (words.length) life.fin = words.join(" "); else delete life.fin;
  life.arcs = { ...(life.arcs ?? {}), [id]: run };
  return run;
}
