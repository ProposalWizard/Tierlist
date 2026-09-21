import { SCENARIO_KINDS, type ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import {
  nextHighlight, newSimMemory, buildSimScenario, simFaults, pictureKey,
} from "../../lib/star/gallerySim";
import {
  flagId, specOf, seedForRun, allKinds, type FlaggedChance,
} from "../../lib/star/highlightStore";
import { splitFaults } from "../../lib/star/scenarioFrame";

/**
 * INFINITE HIGHLIGHTS — measured, not asserted.
 *
 * The page's whole value is that a person can flick through a hundred real
 * chances in a minute. So the things worth pinning are the ones that would
 * quietly waste that minute: a pool that leaks a kind nobody selected, the
 * same picture twice running, a kind that never comes up, and — the one that
 * matters most — a flagged chance that cannot be got back to.
 */

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) { failures++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
  else console.log(`  ok    ${name}${detail ? ` — ${detail}` : ""}`);
}

/** The page's own stream (app/star-highlights-dev/page.tsx), run for run. */
const streamFor = (run: number) => mulberry32(seedForRun(run));

/** A hundred presses, exactly as the page makes them. */
function press(kinds: ScenarioKind[], n: number, run = 1) {
  const rng = streamFor(run);
  const mem = newSimMemory();
  const out: { kind: ScenarioKind; picture: string; faults: number; seed: number }[] = [];
  let last: string | undefined;
  for (let i = 0; i < n; i++) {
    const spec = nextHighlight(kinds, rng, mem, last);
    if (!spec) break;
    const sc = buildSimScenario(spec);
    last = pictureKey(sc);
    out.push({
      kind: spec.kind,
      picture: last,
      faults: splitFaults(spec.kind, simFaults(sc, spec.planId)).faults.length,
      seed: spec.seed,
    });
  }
  return out;
}

console.log("\n── A hundred presses, every kind on ──");
{
  const runs = press(allKinds(), 100);
  const pics = new Set(runs.map((r) => r.picture));
  let immediate = 0;
  for (let i = 1; i < runs.length; i++) if (runs[i].picture === runs[i - 1].picture) immediate++;
  const kinds = new Set(runs.map((r) => r.kind));
  const faulty = runs.filter((r) => r.faults > 0).length;

  check("100 presses produced 100 chances", runs.length === 100);
  check(`no picture twice running`, immediate === 0, `${immediate} immediate repeats`);
  check(`distinct pictures`, pics.size >= 95, `${pics.size}/100`);
  check(`every kind came up`, kinds.size === SCENARIO_KINDS.length, `${kinds.size}/${SCENARIO_KINDS.length}`);
  // Not a pass/fail bar — the number the tool exists to surface.
  console.log(`  note  ${faulty}/100 came back with a fault`);
}

console.log("\n── The pool is honoured ──");
{
  const pool: ScenarioKind[] = ["one_on_one", "long_range", "free_kick"];
  const runs = press(pool, 120, 3);
  const leaked = runs.filter((r) => !pool.includes(r.kind));
  check("nothing outside the selection ever appears", leaked.length === 0,
    leaked.length ? `leaked ${leaked[0].kind}` : "");
  const seen = new Set(runs.map((r) => r.kind));
  check("every selected kind is actually served", seen.size === pool.length,
    [...seen].join(", "));
  // Uniform by design — a kind is selected because someone wants to LOOK at
  // it, so no kind should be starved.
  const counts = pool.map((k) => runs.filter((r) => r.kind === k).length);
  check(`the spread is even-ish`, Math.min(...counts) >= 20, counts.join("/"));
}
{
  const one = press(["penalty"], 30, 4);
  check("a single-kind pool serves only that kind", one.every((r) => r.kind === "penalty"));
  const none = nextHighlight([], mulberry32(1), newSimMemory());
  check("an empty pool serves nothing rather than guessing", none === null);
}

console.log("\n── A flagged chance can be got back to ──");
{
  const rng = streamFor(7);
  const mem = newSimMemory();
  const spec = nextHighlight(allKinds(), rng, mem)!;
  const flag: FlaggedChance = {
    id: flagId(spec), kind: spec.kind, seed: spec.seed, planId: spec.planId, at: Date.now(),
  };
  // Through a JSON round trip, which is what localStorage actually does to it.
  const back: FlaggedChance = JSON.parse(JSON.stringify(flag));
  const a = pictureKey(buildSimScenario(spec));
  const b = pictureKey(buildSimScenario(specOf(back)));
  check("a flag rebuilds the identical picture", a === b);
  check("flagging the same chance twice is one id", flagId(spec) === flagId(specOf(back)));
  check("two different chances are two different ids",
    flagId(spec) !== flagId(nextHighlight(allKinds(), rng, mem)!));
}

console.log("\n── The stream replays ──");
{
  const key = (rs: ReturnType<typeof press>) => rs.map((r) => `${r.kind}:${r.seed}`).join("/");
  check("the same run number replays press for press", key(press(allKinds(), 25, 11)) === key(press(allKinds(), 25, 11)));
  check("a different run number is different material", key(press(allKinds(), 25, 11)) !== key(press(allKinds(), 25, 12)));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
if (failures > 0) process.exit(1);
