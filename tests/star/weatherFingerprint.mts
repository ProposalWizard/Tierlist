/**
 * THE REAL MATCH'S BALL MUST NOT MOVE (Leo, 22 Oct 2026, chat 4 "Weather and
 * pitch"). The new wind, rain skid and pitch quality are switched on only from
 * /star-weather-dev. This plays the same 1,200 chances under every condition
 * the real game can roll today (none, clear, wind, rain, heavy) with both balls
 * (Old and New), hashes every step of every ball, and holds the result to the
 * fingerprint taken before the change (tests/star/fixtures/weatherFingerprint.json).
 *
 *   npx tsx tests/star/weatherFingerprint.mts           check
 *   npx tsx tests/star/weatherFingerprint.mts --write   take a new fingerprint (only when the real ball is MEANT to change)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch,
  setBallPhysics, firstBounceAt, type Outcome,
} from "../../lib/star/canvasEngine";
import { conditionsFor, type Conditions } from "../../lib/star/weather";
import { POST_L, POST_R } from "../../lib/star/pitch";

const FILE = new URL("./fixtures/weatherFingerprint.json", import.meta.url);

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over the rounded numbers: one hash per (ball, weather).
function hasher() {
  let h = 0x811c9dc5;
  return {
    add(n: number) {
      const s = Number.isFinite(n) ? n.toFixed(6) : String(n);
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      h ^= 124; h = Math.imul(h, 0x01000193);
    },
    addS(s: string) { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } },
    hex: () => (h >>> 0).toString(16).padStart(8, "0"),
  };
}

const sample = Array.from({ length: 400 }, (_, i) => conditionsFor(1, i + 1));
const pick = (w: Conditions["weather"]) => sample.find((c) => c.weather === w)!;
const WEATHERS: Record<string, Conditions | undefined> = {
  none: undefined, clear: pick("clear"), wind: pick("wind"), rain: pick("rain"), heavy: pick("heavy"),
  // CanvasMatch's own fallback when nothing is passed.
  canvasDefault: conditionsFor(0, 0),
};

function run(mode: "old" | "new", cond: Conditions | undefined): { hash: string; goals: number; outcomes: Record<string, number> } {
  setBallPhysics(mode);
  const H = hasher();
  const outcomes: Record<string, number> = {};
  let goals = 0;
  const kinds = ["long_range", "one_on_one", "tight_angle", "free_kick", "cutback", "through_ball", "corner", "midfield_pass"] as const;
  for (let seed = 0; seed < 240; seed++) {
    const rng = mulberry32(seed * 7919 + 13);
    const kind = kinds[seed % kinds.length];
    let sc;
    try { sc = buildScenario(kind as never, rng, 65, 65, 60); } catch { continue; }
    sc.conditions = cond;
    initDefenders(sc, rng);
    const tx = (POST_L + POST_R) / 2 + (rng() - 0.5) * 6;
    const ball = launch(sc, { x: tx - sc.ball.x, y: -Math.max(1, sc.ball.y) }, 0.45 + rng() * 0.55,
      { cx: (rng() - 0.5) * 1.4, cy: -0.4 + rng() * 1.4 }, { power: 70, technique: 70 }, rng);
    const land = firstBounceAt(ball, cond);
    H.add(land?.x ?? -999); H.add(land?.y ?? -999);
    const h = 1 / 180;
    let out: Outcome | null = null;
    for (let i = 0; i < 180 * 10 && !out; i++) {
      stepDefenders(sc, h, ball.pos, false, ball);
      stepKeeper(sc, h);
      stepReactions(sc, ball, h, rng);
      out = stepBall(ball, sc, rng, h);
      if (i % 6 === 0) { H.add(ball.pos.x); H.add(ball.pos.y); H.add(ball.z); }
    }
    H.addS(String(out)); H.add(ball.pos.x); H.add(ball.pos.y);
    outcomes[String(out)] = (outcomes[String(out)] ?? 0) + 1;
    if (out === "goal" || out === "rebound") goals++;
  }
  return { hash: H.hex(), goals, outcomes };
}

const result: Record<string, { hash: string; goals: number; outcomes: Record<string, number> }> = {};
for (const mode of ["old", "new"] as const) for (const [w, c] of Object.entries(WEATHERS)) result[`${mode}/${w}`] = run(mode, c);
setBallPhysics("old");

if (process.argv.includes("--write")) {
  writeFileSync(FILE, JSON.stringify(result, null, 1) + "\n");
  console.log("fingerprint written");
  for (const [k, v] of Object.entries(result)) console.log(k.padEnd(20), v.hash, "goals", v.goals);
} else {
  if (!existsSync(FILE)) { console.error("no fingerprint yet: run with --write before the change"); process.exit(1); }
  const want = JSON.parse(readFileSync(FILE, "utf8"));
  let bad = 0;
  for (const [k, v] of Object.entries(result)) {
    const same = want[k]?.hash === v.hash;
    console.log((same ? "same " : "MOVED").padEnd(6), k.padEnd(20), v.hash, "goals", v.goals, "/ 240");
    if (!same) bad++;
  }
  if (bad) { console.error(`\n${bad} of ${Object.keys(result).length} ball fingerprints moved — the real match's ball changed.`); process.exit(1); }
  console.log(`\nAll ${Object.keys(result).length} fingerprints identical: the real match's ball is unchanged.`);
}
