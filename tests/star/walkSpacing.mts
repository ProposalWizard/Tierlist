/**
 * NOBODY WALKS THROUGH ANYBODY (28 Nov 2026, Harry on the 22-man walk-out: "players walking through each other on
 * the cut scene"). Every frame (60 a second) of every group walk is checked, pair by pair:
 *   - side by side, two men's middles at least BODY apart (two bodies with arms: 2 x 0.27 m);
 *   - one behind the other (within 0.45 m to the side), at least FRONT apart (a stride's feet: 0.65 m);
 *   - a man who surges ends his surge outside the man ahead (the last frames of every walk, and the arrivals);
 *   - every man still starts where the script starts him and, given a moment, arrives where it sends him;
 *   - seek(t) gives the same place from any frame (the walk is walked once, from the script alone);
 *   - the old walk (no spacing) DID put men inside each other: the check can see it.
 * Scenes: the 22-man test walk-out (testScenes walkout22), the eight walkers, and every generated walk-out
 * (beats walkOut) over several seeds. The house and garden walkers (world3d/npc.ts) are not cut-scene code: they
 * keep their own gap to the man ahead (npc.ts, "gap").
 */
import { ownMotion } from "../../lib/star/people/life";
import { TEST_SCENES } from "../../lib/star/cutscene/testScenes";
import { generateScript } from "../../lib/star/cutscene/generate";
import { compileScript, rootAt, crowdOf, CROWD, WALK_PACE, type Compiled } from "../../lib/star/cutscene/timeline";
import type { CutsceneScript } from "../../lib/star/cutscene/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const BODY = 0.54, FRONT = 0.65, SIDE_WINDOW = 0.45;

interface Hit { t: number; a: string; b: string; d: number; kind: string }
function overlaps(c: Compiled, ids: string[], t0: number, t1: number, at: (id: string, t: number) => { pos: number[]; yaw: number }): Hit[] {
  const hits: Hit[] = [];
  for (let t = t0; t <= t1 + 1e-9; t += 1 / 60) {
    const P = ids.map((id) => at(id, t));
    // (front to back counts while he walks: a man stood still and turned to face someone is side by side with him)
    const Q = ids.map((id) => at(id, t - 1 / 60));
    const moving = P.map((p, i) => Math.hypot(p.pos[0] - Q[i].pos[0], p.pos[2] - Q[i].pos[2]) * 60 > 0.15);
    for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      const dx = P[j].pos[0] - P[i].pos[0], dz = P[j].pos[2] - P[i].pos[2];
      const d = Math.hypot(dx, dz);
      if (j > i && d < BODY) hits.push({ t, a: ids[i], b: ids[j], d, kind: "side" });
      const fx = Math.sin(P[i].yaw), fz = Math.cos(P[i].yaw);
      const a = dx * fx + dz * fz, l = Math.abs(dx * -fz + dz * fx);
      if (moving[i] && a > 0 && l < SIDE_WINDOW && a < FRONT) hits.push({ t, a: ids[i], b: ids[j], d: a, kind: "behind" });
    }
  }
  void c;
  return hits;
}

function moversOf(s: CutsceneScript): string[] {
  return Array.from(new Set(s.tracks.filter((t) => t.type === "move" && (t as { gait?: string }).gait !== "none").map((t) => (t as { actor: string }).actor)));
}

function sceneCheck(name: string, s: CutsceneScript, expectOldHits: boolean) {
  const c = compileScript(s);
  const ids = moversOf(s).filter((id) => c.cast.some((m) => m.id === id));
  const sim = crowdOf(c);
  check(!!sim && sim.ids.length >= 2, `${name}: no group walk found (${ids.length} walkers)`);
  const hits = overlaps(c, ids, 0, s.duration, (id, t) => rootAt(c, id, t));
  const worst = hits.reduce((m, h) => (h.d < m.d ? h : m), { t: 0, a: "", b: "", d: 9, kind: "" });
  check(hits.length === 0, `${name}: ${hits.length} frames with two men inside each other (closest ${worst.a}/${worst.b} ${(worst.d * 100).toFixed(0)} cm ${worst.kind} at ${worst.t.toFixed(2)} s)`);
  // the old way (the script's own places): the test can see it
  const c0 = compileScript(s);
  const raw = overlaps(c0, ids, 0, s.duration, (id, t) => rawAt(c0, id, t));
  if (expectOldHits) check(raw.length > 0, `${name}: the old walk had no overlaps, so this test proves nothing`);
  // starts where the script starts him; arrives (within 3 s after the end of his walk) where it sends him
  let maxStart = 0, maxEnd = 0, late = 0;
  for (const id of ids) {
    const mv = s.tracks.filter((t) => t.type === "move" && (t as { actor: string }).actor === id) as { at: number; dur: number }[];
    const first = Math.min(...mv.map((m) => m.at)), last = Math.max(...mv.map((m) => m.at + m.dur));
    const a = rootAt(c, id, first), ra = rawAt(c, id, first);
    maxStart = Math.max(maxStart, Math.hypot(a.pos[0] - ra.pos[0], a.pos[2] - ra.pos[2]));
    const tEnd = Math.min(last + 3, s.duration + 3);
    const b = rootAt(c, id, tEnd), rb = rawAt(c, id, tEnd);
    const e = Math.hypot(b.pos[0] - rb.pos[0], b.pos[2] - rb.pos[2]);
    maxEnd = Math.max(maxEnd, e);
    if (e > 0.05) late++;
  }
  check(maxStart < 0.01, `${name}: a man starts ${(maxStart * 100).toFixed(1)} cm from his mark`);
  // (arrival points that are themselves closer than the gap cannot all be reached: those men stop short, outside)
  const arrivalsClash = ids.some((a, i) => ids.some((b, j) => j > i && (() => { const A = rawAt(c, a, s.duration + 3).pos, B = rawAt(c, b, s.duration + 3).pos; return Math.hypot(A[0] - B[0], A[2] - B[2]) < CROWD.gap + 0.1; })()));
  if (!arrivalsClash) check(late === 0, `${name}: ${late} men not where the script sends them 3 s after their walk (up to ${(maxEnd * 100).toFixed(0)} cm off)`);
  // the same place from any frame
  const c2 = compileScript(s);
  const tt = [s.duration * 0.7, 0.5, s.duration * 0.3];
  for (const t of tt) for (const id of ids.slice(0, 4)) { const p = rootAt(c2, id, t).pos, q = rootAt(c, id, t).pos; check(Math.hypot(p[0] - q[0], p[2] - q[2]) < 1e-6, `${name}: ${id} at ${t.toFixed(2)} s not the same on a fresh seek`); }
  // no jolts: nobody covers ground much quicker than the script walks him (30% at most, when he makes up ground)
  let vmax = 0, who = "";
  for (const id of ids) for (let t = (sim?.t0 ?? 0) + 1 / 60; t <= s.duration; t += 1 / 60) { const a = rootAt(c, id, t - 1 / 60).pos, b = rootAt(c, id, t).pos; const sp = Math.hypot(b[0] - a[0], b[2] - a[2]) * 60; if (sp > vmax) { vmax = sp; who = `${id} at ${t.toFixed(2)} s`; } }
  let rmax = 0;
  for (const id of ids) for (let t = (sim?.t0 ?? 0) + 1 / 60; t <= s.duration; t += 1 / 60) { const a = rawAt(c, id, t - 1 / 60).pos, b = rawAt(c, id, t).pos; rmax = Math.max(rmax, Math.hypot(b[0] - a[0], b[2] - a[2]) * 60); }
  check(vmax < Math.max(1.9, rmax * 1.3), `${name}: a man moves at ${vmax.toFixed(2)} m/s (${who}; the script's quickest ${rmax.toFixed(2)})`);
  // the gaps the men actually keep (for the report)
  let minFront = 9, minSide = 9;
  for (let t = 0; t <= s.duration; t += 1 / 30) {
    const P = ids.map((id) => rootAt(c, id, t));
    for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) if (i !== j) {
      const dx = P[j].pos[0] - P[i].pos[0], dz = P[j].pos[2] - P[i].pos[2];
      const fx = Math.sin(P[i].yaw), fz = Math.cos(P[i].yaw);
      const a = dx * fx + dz * fz, l = Math.abs(dx * -fz + dz * fx);
      if (a > 0 && l < SIDE_WINDOW) minFront = Math.min(minFront, a); else minSide = Math.min(minSide, Math.hypot(dx, dz));
    }
  }
  console.log(`${name}: ${ids.length} walkers, ${sim?.ids.length ?? 0} spaced; overlapping frames before ${raw.length}, now ${hits.length}; closest front-to-back ${(minFront * 100).toFixed(0)} cm, side ${(minSide * 100).toFixed(0)} cm; arrivals within ${(maxEnd * 100).toFixed(1)} cm; quickest ${vmax.toFixed(2)} m/s`);
}

/** The script's own places, without the spacing pass (as before 28 Nov 2026). */
function rawAt(c: Compiled, id: string, t: number) {
  const sim = crowdOf(c);
  if (!sim) return rootAt(c, id, t);
  // a compiled copy whose spacing pass is switched off
  const key = c as unknown as { __raw?: Compiled };
  if (!key.__raw) key.__raw = { ...compileScript(c.script), noCrowd: true };
  return rootAt(key.__raw, id, t);
}

sceneCheck("walk-out, 22 men (test)", TEST_SCENES.walkout22(), false);
// the walk-out as it was filmed on 28 Nov 2026 (each man's distance set by his pace, the full pace shift and surge):
// men walked through each other, and the spacing pass must keep them apart all the same
{
  const old = { ...WALK_PACE };
  WALK_PACE.shift = 0.9; WALK_PACE.surge = 1;
  const s = TEST_SCENES.walkout22();
  for (const t of s.tracks) if (t.type === "move") {
    const mv = t as { actor: string; at: number; dur: number; path: [number, number, number][] };
    const own = ownMotion(mv.actor), m = s.cast.find((c) => c.id === mv.actor)!.mark as [number, number, number];
    mv.path = [[mv.path[0][0], 0, m[2] + 1.05 * own.pace * mv.dur]];
  }
  sceneCheck("walk-out, 22 men, as filmed 28 Nov (old paces)", s, true);
  Object.assign(WALK_PACE, old);
}
sceneCheck("eight walkers (test)", TEST_SCENES.walkers(), false);
for (const seed of [1, 2, 3, 4, 5, 6]) {
  for (const kind of ["walkout", "debut", "rivalry"] as const) {
    const s = generateScript({ kind, stakes: 0.6, emotion: "calm", intensity: 0.5 } as never, seed);
    const walks = s.tracks.filter((t) => t.type === "move" && ((t as { gait?: string }).gait ?? "walk").startsWith("walk")).length;
    if (walks < 2) continue;
    sceneCheck(`generated ${kind} seed ${seed}`, s, false);
  }
}

if (problems.length) { console.error(`walkSpacing: ${problems.length} problem(s)\n - ` + problems.join("\n - ")); process.exit(1); }
console.log("walkSpacing: ok");
