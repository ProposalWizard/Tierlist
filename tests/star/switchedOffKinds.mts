/**
 * VOLLEY AND HEADER ARE SWITCHED OFF (lib/star/switchedOffKinds.ts).
 *
 * Harry, 24 Sep 2026: "for now remove volley and header from scenario gallery
 * and from being in the game in general." The engine still knows both, so
 * every way the match picks a chance is run here many times, the way
 * CanvasMatch runs it, and none may come out as a volley or a header.
 */
import {
  SCENARIO_KINDS, buildScenario, buildWeightedScenario, buildAttackingScenario, chainKindFor,
  pickScenarioKindFrom, type ScenarioKind,
} from "../../lib/star/canvasEngine";
import { kindsForZone } from "../../lib/star/hiddenMatch";
import { isSwitchedOff, playableKind, withoutSwitchedOff } from "../../lib/star/switchedOffKinds";
import { allKinds, loadKinds } from "../../lib/star/highlightStore";
import { mulberry32 } from "../../lib/star/season";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const POSITIONS = ["ST", "CAM", "LW", "RW", "CM", "CDM", "LB", "RB", "CB"];
const N = 3000;

// The engine really does still roll them — otherwise this test proves nothing.
let rawOff = 0;
{
  const rng = mulberry32(7);
  for (let i = 0; i < N; i++) if (isSwitchedOff(chainKindFor({ x: 34, y: 10 }, rng, 1))) rawOff++;
}
check(rawOff > 0, "chainKindFor never rolled a volley in the box — the test would prove nothing");

// 1. A chain (after a completed pass), swapped the way CanvasMatch swaps it.
let off = 0;
for (let i = 0; i < N; i++) {
  const rng = mulberry32(1000 + i);
  const at = { x: 5 + rng() * 58, y: 4 + rng() * 45 };
  if (isSwitchedOff(playableKind(chainKindFor(at, rng, rng() < 0.5 ? 1 : 0), rng))) off++;
}
check(off === 0, `a chain handed out ${off} volleys/headers`);

// 2. A hidden-match request, filtered then picked (the formula's fallback path).
off = 0;
for (const zone of ["own_box", "defensive", "middle", "attacking", "box"] as const) {
  for (const lane of ["left", "centre", "right"] as const) {
    const kinds = kindsForZone(zone, lane);
    if (!Array.isArray(kinds)) { problems.push(`${zone}/${lane}: no kinds`); continue; }
    const kept = withoutSwitchedOff(kinds);
    check(kept.every(k => !isSwitchedOff(k)) || kept.length === kinds.length, `${zone}/${lane}: filter left a switched-off kind in`);
    for (let i = 0; i < 400; i++) {
      const rng = mulberry32(i * 31 + zone.length);
      const pos = POSITIONS[i % POSITIONS.length];
      const k = playableKind(pickScenarioKindFrom(pos, rng, kept), rng);
      if (isSwitchedOff(k)) off++;
    }
  }
}
check(off === 0, `a hidden-match request handed out ${off} volleys/headers`);

// 3. The engine's own weighted and attacking pickers, then CanvasMatch's swap.
off = 0;
let swapped = 0;
for (let i = 0; i < N; i++) {
  const rng = mulberry32(5000 + i);
  const pos = POSITIONS[i % POSITIONS.length];
  let sc = i % 2 ? buildWeightedScenario(rng, pos) : buildAttackingScenario(rng);
  if (isSwitchedOff(sc.kind)) { swapped++; sc = buildScenario(playableKind(sc.kind, rng), rng); }
  if (isSwitchedOff(sc.kind)) off++;
}
check(swapped > 0, "the engine's pickers never rolled a volley/header — the swap was never exercised");
check(off === 0, `the weighted/attacking pickers handed out ${off} volleys/headers after the swap`);

// 4. Every other kind passes through untouched, without drawing from the rng.
for (const k of SCENARIO_KINDS) {
  if (isSwitchedOff(k)) continue;
  let draws = 0;
  const counting = () => { draws++; return 0.5; };
  check(playableKind(k, counting) === k && draws === 0, `${k} was changed or drew from the rng`);
}

// 5. The highlights pool never includes them.
check(allKinds().every(k => !isSwitchedOff(k)), "the highlights 'All' pool still includes a switched-off kind");
check(loadKinds().every(k => !isSwitchedOff(k)), "the highlights saved pool still includes a switched-off kind");

console.log(`engine still rolls them: ${rawOff}/${N} raw volleys in the box; swapped by the weighted/attacking pickers: ${swapped}/${N}`);
if (problems.length) { console.log("FAIL"); for (const p of problems) console.log("  - " + p); process.exit(1); }
console.log("PASS — no chance picker hands out a volley or a header");
