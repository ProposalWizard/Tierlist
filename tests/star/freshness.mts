/**
 * tests/star/freshness.mts — HOW OFTEN DO YOU SEE A PICTURE YOU HAVE SEEN?
 *
 * A measurement, not a gate. Plays seeded unseen matches (lib/star/matchRadar.ts,
 * the same harness as tests/star/chanceJudge.mts) and serves every chance
 * through the real chance maker (makeChance) with ONE picture memory across
 * all the matches, as the career does. With Chances: New, each fresh open-play
 * chance also asks the build-up generator (lib/star/leadInGen.ts,
 * careerBuildUp) for its build-up, as CanvasMatch does.
 *
 * "The same picture" is the game's own rule: samePicture (pictureGap under
 * SAME_PICTURE_M = 3 m, a mirror counts as the same), same kind only.
 * "The same picture + build-up" also needs the same build-up: none and none,
 * or the same kind of build-up (passes / break), the same number of ball
 * keys, and the ball's keys within 3 m on average (mirror counts).
 *
 * For each served chance it asks: have you seen this already
 *   - in your last 20 chances (across matches),
 *   - earlier this match or in the match before,
 *   - earlier this match or in the 5 matches before.
 *
 * Runs 40 matches (the judge's set) and 120 matches (about 3 seasons), Old
 * and New. Prints tables per kind. Only a crash fails it; the 5% target is a
 * warning line ("kinds that need more drawings").
 */
import { startRadar, stepRadar, resolveHighlight, radarOver } from "../../lib/star/matchRadar";
import { noteServedKind, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import { makeChance, PictureMemory, pictureOf, samePicture, SAME_PICTURE_M, type Picture } from "../../lib/star/chanceMaker";
import { authoredPool } from "../../lib/star/authoredChance";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { forceChancesMode, type ChancesMode } from "../../lib/star/newChances";
import { careerBuildUp, type BuildUp } from "../../lib/star/leadInGen";
import { mulberry32 } from "../../lib/star/season";
import { PITCH_W } from "../../lib/star/pitch";
import type { ScenarioKind, Vec2 } from "../../lib/star/canvasEngine";

const TARGET = 5; // % of chances you have already seen in your last 20
const POSITIONS = ["ST", "LW", "RW", "CAM", "ST", "CM", "RW", "LW"];

interface BU { kind: string; keys: Vec2[] }
interface Served { match: number; kind: ScenarioKind; sourceId: string | null; pic: Picture; bu: BU | null }

function inputsFor(i: number): HiddenMatchInputs {
  const r = mulberry32(0xabc + i * 31);
  const team = 55 + Math.floor(r() * 35), opp = 55 + Math.floor(r() * 35);
  return {
    teamStrength: team, oppStrength: opp, home: i % 2 === 0, playerSkill: 60 + Math.floor(r() * 30),
    pace: 70, freeKick: 70, position: POSITIONS[i % POSITIONS.length],
    context: { playstyle: "balanced", teamRelationship: 60, fanRelationship: 50, skills: { pace: 70, power: 65, technique: 65, vision: 60 } },
  };
}

function run(mode: ChancesMode, matches: number): Served[] {
  forceChancesMode(mode);
  const memory = new PictureMemory(`freshness-${mode}-${matches}`, false);
  const out: Served[] = [];
  for (let mi = 0; mi < matches; mi++) {
    const inputs = inputsFor(mi);
    const position = inputs.position!;
    const m = startRadar(7000 + mi * 13, inputs);
    const rng = mulberry32((0xc4a7ce ^ (mi * 2654435761)) >>> 0);
    const selection = newSelectionMemory();
    let i = 0;
    for (let guard = 0; guard < 400 && !radarOver(m); guard++) {
      if (!m.pending) { stepRadar(m); continue; }
      const req = m.pending.request!;
      if (!req.dribble) {
        const made = makeChance({
          source: { from: "request", request: req, position }, rng,
          strength: { keeper: 62, team: inputs.teamStrength, vision: 60 },
          memory, selection,
        });
        const sc = made.sc;
        noteServedKind(m.state, sc.kind);
        const pic = pictureOf(sc);
        // The build-up, asked for exactly as CanvasMatch asks (a request is a
        // fresh chance unless it is a set piece). Old: always null.
        const lead = careerBuildUp(sc, {
          opening: false, fresh: req.pattern !== "set_piece",
          lane: req.lane, pattern: req.pattern,
          seed: (mi * 1000 + i * 17 + 1) >>> 0,
          us: "Arsenal", them: "Chelsea", themStrength: inputs.oppStrength,
        }) as BuildUp | null;
        const bu = lead ? { kind: lead.kind, keys: lead.ballKeys.map((k) => ({ x: k.p.x, y: k.p.y })) } : null;
        out.push({ match: mi, kind: sc.kind, sourceId: made.sourceId, pic, bu });
        i++;
      }
      resolveHighlight(m, "bench-rate");
    }
  }
  forceChancesMode(null);
  return out;
}

const mirror = (v: Vec2): Vec2 => ({ x: PITCH_W - v.x, y: v.y });
function keysGap(a: Vec2[], b: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return s / a.length;
}
function sameBuildUp(a: BU | null, b: BU | null): boolean {
  if (!a || !b) return !a && !b;
  if (a.kind !== b.kind || a.keys.length !== b.keys.length || !a.keys.length) return false;
  return Math.min(keysGap(a.keys, b.keys), keysGap(a.keys.map(mirror), b.keys)) < SAME_PICTURE_M;
}
const samePic = (a: Served, b: Served) => a.kind === b.kind && samePicture(a.pic, b.pic);
const sameAll = (a: Served, b: Served) => samePic(a, b) && sameBuildUp(a.bu, b.bu);

interface Row { served: number; distinct: number; drawingsUsed: number; r20: number; rMatch: number; r5: number; r20bu: number; withBu: number }
function tally(list: Served[]): Map<string, Row> {
  const rows = new Map<string, Row>();
  const reps = new Map<string, Served[]>();
  const used = new Map<string, Set<string>>();
  const get = (k: string) => {
    let r = rows.get(k);
    if (!r) { r = { served: 0, distinct: 0, drawingsUsed: 0, r20: 0, rMatch: 0, r5: 0, r20bu: 0, withBu: 0 }; rows.set(k, r); }
    return r;
  };
  list.forEach((s, g) => {
    for (const k of [s.kind, "ALL"]) {
      const r = get(k);
      r.served++;
      if (s.bu) r.withBu++;
      const prev20 = list.slice(Math.max(0, g - 20), g);
      if (prev20.some((p) => samePic(s, p))) r.r20++;
      if (prev20.some((p) => sameAll(s, p))) r.r20bu++;
      const before = list.slice(0, g);
      if (before.some((p) => p.match >= s.match - 1 && samePic(s, p))) r.rMatch++;
      if (before.some((p) => p.match >= s.match - 5 && samePic(s, p))) r.r5++;
      const rl = reps.get(k) ?? [];
      if (!rl.some((p) => samePic(s, p))) { rl.push(s); r.distinct++; }
      reps.set(k, rl);
      const u = used.get(k) ?? new Set<string>();
      if (s.sourceId) u.add(`${s.kind}:${s.sourceId}`);
      used.set(k, u);
      r.drawingsUsed = u.size;
    }
  });
  return rows;
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");
const need: { mode: string; span: number; kind: string; r: string }[] = [];
function table(mode: ChancesMode, matches: number) {
  const list = run(mode, matches);
  const rows = tally(list);
  console.log(`\n== Chances: ${mode === "old" ? "Old" : "New"} — ${matches} matches, ${list.length} chances, one memory`);
  const h = ["kind", "drawings", "served", "used", "distinct", "seen/20", "seen/match", "seen/5m", "+build-up/20", "build-ups"];
  const w = [14, 9, 7, 6, 9, 9, 11, 9, 13, 10];
  const line = (c: string[]) => console.log("  " + c.map((x, i) => (i === 0 ? x.padEnd(w[i]) : x.padStart(w[i]))).join(""));
  line(h);
  const kinds = [...rows.keys()].filter((k) => k !== "ALL").sort();
  for (const k of [...kinds, "ALL"]) {
    const r = rows.get(k)!;
    const drawings = k === "ALL" ? kinds.reduce((s, x) => s + authoredPool(x).length, 0) : authoredPool(k).length;
    line([k === "ALL" ? "ALL" : k, String(drawings), String(r.served), String(r.drawingsUsed), String(r.distinct),
      pct(r.r20, r.served), pct(r.rMatch, r.served), pct(r.r5, r.served), pct(r.r20bu, r.served), pct(r.withBu, r.served)]);
    if (k !== "ALL" && r.served >= 5 && (100 * r.r20) / r.served > TARGET) need.push({ mode, span: matches, kind: k, r: pct(r.r20, r.served) });
  }
}

console.log(`Same picture = pictureGap < ${SAME_PICTURE_M} m (mirror counts), same kind.`);
console.log("seen/20 = already seen in your last 20 chances; seen/match = earlier this match or the match before;");
console.log("seen/5m = earlier this match or the 5 before; +build-up/20 = same picture AND same build-up in the last 20.");
console.log("used = distinct drawings served; distinct = distinct pictures served (greedy, 3 m).");
for (const span of [40, 120]) for (const mode of ["old", "new"] as ChancesMode[]) table(mode, span);

console.log(`\n== Kinds that need more drawings (seen in the last 20 above ${TARGET}%)`);
const byKind = new Map<string, string[]>();
for (const n of need) byKind.set(n.kind, [...(byKind.get(n.kind) ?? []), `${n.mode} ${n.span}m ${n.r}`]);
if (!byKind.size) console.log("  none");
for (const [k, v] of byKind) {
  const note = k === "penalty" ? " (a penalty is one picture by design)" : k === "free_kick" ? " (served exactly as drawn: no nudge)" : "";
  console.log(`  WARN ${k}: ${v.join(", ")}${note}`);
}
console.log("\ndone (measurement only; warnings do not fail)");
