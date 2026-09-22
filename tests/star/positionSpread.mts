/**
 * tests/star/positionSpread.mts
 *
 * EACH PLAYABLE POSITION GETS ITS OWN KIND OF GAME.
 *
 * Before the position pull existed, `position` only decided who took a free
 * kick. Everything else was identical, and it showed: a STRIKER's third most
 * common highlight was build-up play (10.6%), build-up + a midfield pass + a
 * long shot were a quarter of everything he did, and a left winger and a
 * right winger produced byte-identical spreads because nothing read which
 * side of the pitch they play on.
 *
 * This pins the shape, not the exact numbers — a floor and a ceiling per
 * claim, so tuning has room to move without the identities quietly dissolving
 * back into one position wearing four names.
 */
import {
  newMatch, advanceUntilInvolved, resolveScenario,
  type HiddenMatchInputs, type ScenarioResult,
} from "../../lib/star/hiddenMatch";
import { selectChance, newSelectionMemory } from "../../lib/star/scenarioSelect";
import { pickScenarioKindFrom } from "../../lib/star/canvasEngine";
import type { ScenarioKind } from "../../lib/star/scenarios";
import { mulberry32 } from "../../lib/star/season";

let failures = 0;
function check(label: string, ok: boolean, detail: string): void {
  if (!ok) { failures++; console.log(`  FAIL  ${label} — ${detail}`); }
  else console.log(`  ok    ${label} — ${detail}`);
}

const EVEN: HiddenMatchInputs = { teamStrength: 70, oppStrength: 70, playerSkill: 65, pace: 60 };
const MATCHES = 400;

function standIn(rng: () => number): ScenarioResult {
  const r = rng();
  return r < 0.12 ? "goal" : r < 0.45 ? "delivered" : r < 0.75 ? "saved" : "lost";
}

/** Per-kind share, as a percentage, over whole simulated matches. */
function spread(position: string, seed = 20260922): Record<string, number> {
  const kinds: string[] = [];
  for (let m = 0; m < MATCHES; m++) {
    const rng = mulberry32(seed + m * 7919);
    const state = newMatch(rng);
    const memory = newSelectionMemory();
    const inputs: HiddenMatchInputs = { ...EVEN, position };
    for (let guard = 0; guard < 400; guard++) {
      const step = advanceUntilInvolved(state, inputs, rng, 90);
      if (!step.request) break;
      const request = step.request;
      let kind: ScenarioKind;
      if (request.dribble) kind = "dribble" as ScenarioKind;
      else {
        const plan = selectChance({ request, position, rng, memory });
        kind = plan ? plan.kind : pickScenarioKindFrom(position, rng, request.kinds);
      }
      kinds.push(kind);
      resolveScenario(state, standIn(rng));
      if (state.minute >= 90) break;
    }
  }
  const out: Record<string, number> = {};
  for (const k of kinds) out[k] = (out[k] ?? 0) + 1;
  for (const k of Object.keys(out)) out[k] = (out[k] / kinds.length) * 100;
  out.__perMatch = kinds.length / MATCHES;
  return out;
}

const pc = (v: number | undefined) => `${(v ?? 0).toFixed(1)}%`;

console.log("positionSpread.mts — each position gets its own kind of game\n");

const ST = spread("ST");
const CAM = spread("CAM");
const LW = spread("LW");
const RW = spread("RW");

console.log("A striker is a penalty-box player");
check("one-on-one is his most common chance", (ST.one_on_one ?? 0) >= 16,
  `${pc(ST.one_on_one)} (floor 16%)`);
check("he heads more than anyone else", (ST.header ?? 0) > (CAM.header ?? 0) && (ST.header ?? 0) > (LW.header ?? 0),
  `ST ${pc(ST.header)} vs CAM ${pc(CAM.header)}, LW ${pc(LW.header)}`);
check("build-up is not a striker's game", (ST.buildup ?? 0) <= 8,
  `${pc(ST.buildup)} (was 10.6% before the pull, ceiling 8%)`);
check("he is not a long-range shooter", (ST.long_range ?? 0) <= 8,
  `${pc(ST.long_range)} (ceiling 8%)`);
check("he does not swing crosses in", (ST.byline_cross ?? 0) <= 4,
  `${pc(ST.byline_cross)} (ceiling 4%)`);

console.log("\nA ten creates");
check("the through ball is his most common chance", (CAM.through_ball ?? 0) >= 15,
  `${pc(CAM.through_ball)} (floor 15%)`);
check("he plays more through balls than the striker", (CAM.through_ball ?? 0) > (ST.through_ball ?? 0),
  `CAM ${pc(CAM.through_ball)} vs ST ${pc(ST.through_ball)}`);
check("he shoots from range more than the striker", (CAM.long_range ?? 0) > (ST.long_range ?? 0),
  `CAM ${pc(CAM.long_range)} vs ST ${pc(ST.long_range)}`);

console.log("\nA winger goes down the outside");
for (const [name, W] of [["LW", LW], ["RW", RW]] as const) {
  check(`${name} crosses far more than the striker`, (W.byline_cross ?? 0) >= 3 * (ST.byline_cross ?? 1),
    `${name} ${pc(W.byline_cross)} vs ST ${pc(ST.byline_cross)}`);
  check(`${name} runs at people more than the striker`, (W.dribble ?? 0) > (ST.dribble ?? 0) * 1.5,
    `${name} ${pc(W.dribble)} vs ST ${pc(ST.dribble)}`);
  check(`${name} barely heads one`, (W.header ?? 0) <= 5, `${pc(W.header)} (ceiling 5%)`);
}

console.log("\nLeft and right are mirrors, not clones of the middle");
const mirrored = ["byline_cross", "cutback", "one_on_one", "dribble"] as const;
for (const k of mirrored) {
  const gap = Math.abs((LW[k] ?? 0) - (RW[k] ?? 0));
  check(`${k} is within 3pp between the wings`, gap <= 3,
    `LW ${pc(LW[k])} vs RW ${pc(RW[k])}, gap ${gap.toFixed(1)}pp`);
}

console.log("\nNobody is starved by having a position");
for (const [name, P] of [["ST", ST], ["CAM", CAM], ["LW", LW], ["RW", RW]] as const) {
  check(`${name} still gets a real number of chances`, P.__perMatch >= 5 && P.__perMatch <= 9,
    `${P.__perMatch.toFixed(1)} per match (5-9)`);
}

console.log(failures === 0
  ? "\npositionSpread.mts — all checks pass"
  : `\npositionSpread.mts — ${failures} FAILED`);
if (failures) process.exit(1);
