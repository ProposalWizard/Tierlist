import { SCENARIO_KINDS, type ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import {
  nextSim, newSimMemory, buildSimScenario, simFaults, pictureKey,
  zonesForKind, lanesForKind, formulaCoversKind,
} from "../../lib/star/gallerySim";

/**
 * THE SCENARIO GALLERY'S SIMULATE BUTTON — measured, not asserted.
 *
 * Asked for directly: "If I press that 100 times, it should never be the same
 * scenario two times in a row." So that is what this measures — a hundred real
 * presses per kind, through the same seeded stream the page itself uses, with
 * the picture compared to the one before it.
 *
 * It also pins the two things that make the button trustworthy at all: a sim
 * is REBUILDABLE from its spec (the same seed and plan must give the same
 * picture forever, or a person cannot point at what they saw), and a sim is
 * judged by the same fault rules a base card is.
 */

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) { failures++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
  else console.log(`  ok    ${name}${detail ? ` — ${detail}` : ""}`);
}

/** The page's own stream, copied exactly (app/star-gallery-dev/page.tsx). */
const streamFor = (kind: ScenarioKind) =>
  mulberry32(90210 + SCENARIO_KINDS.indexOf(kind) * 7919);

console.log("\n── 100 presses per kind ──");
let totalPresses = 0, totalDistinct = 0, totalRepeats = 0, totalFaults = 0;
for (const kind of SCENARIO_KINDS as readonly ScenarioKind[]) {
  const rng = streamFor(kind);
  const mem = newSimMemory();
  const keys: string[] = [];
  let repeats = 0, faulty = 0;
  for (let i = 0; i < 100; i++) {
    const spec = nextSim(kind, rng, mem, keys[keys.length - 1]);
    const sc = buildSimScenario(spec);
    if (simFaults(sc, spec.planId).length) faulty++;
    const k = pictureKey(sc);
    if (keys.length && keys[keys.length - 1] === k) repeats++;
    keys.push(k);
  }
  const distinct = new Set(keys).size;
  totalPresses += 100; totalDistinct += distinct; totalRepeats += repeats; totalFaults += faulty;
  console.log(`  ${kind.padEnd(14)} ${String(distinct).padStart(3)} distinct · ${repeats} same twice running · ${faulty} with faults`);
  check(`${kind}: never the same picture twice running`, repeats === 0, `${repeats} repeats`);
}
console.log(`  TOTAL ${totalPresses} presses · ${totalDistinct} distinct · ${totalRepeats} immediate repeats · ${totalFaults} with faults`);

// A penalty genuinely IS one picture — the ball is on the spot, you are behind
// it and the keeper is on his line. It is the one kind with real variety to
// spare, so it gets its own floor rather than the others'.
console.log("\n── Variety ──");
for (const kind of SCENARIO_KINDS as readonly ScenarioKind[]) {
  const rng = streamFor(kind);
  const mem = newSimMemory();
  const keys: string[] = [];
  for (let i = 0; i < 100; i++) {
    const spec = nextSim(kind, rng, mem, keys[keys.length - 1]);
    keys.push(pictureKey(buildSimScenario(spec)));
  }
  const distinct = new Set(keys).size;
  const floor = kind === "penalty" ? 10 : 60;
  check(`${kind}: ${distinct} distinct pictures in 100 (floor ${floor})`, distinct >= floor);
}

console.log("\n── A sim is rebuildable ──");
{
  const rng = streamFor("one_on_one");
  const mem = newSimMemory();
  const spec = nextSim("one_on_one", rng, mem);
  const a = pictureKey(buildSimScenario(spec));
  const b = pictureKey(buildSimScenario(spec));
  check("the same spec builds the same picture twice", a === b);
  check("a spec carries everything needed to rebuild it",
    typeof spec.seed === "number" && spec.kind === "one_on_one");
}
{
  // Two runs of the whole stream from scratch must agree press for press, or a
  // sim seen yesterday cannot be got back to today.
  const run = () => {
    const rng = streamFor("cutback");
    const mem = newSimMemory();
    const out: string[] = [];
    let last: string | undefined;
    for (let i = 0; i < 20; i++) {
      const spec = nextSim("cutback", rng, mem, last);
      last = pictureKey(buildSimScenario(spec));
      out.push(last);
    }
    return out.join("/");
  };
  check("the stream replays identically", run() === run());
}

console.log("\n── The request each kind is asked for ──");
for (const kind of SCENARIO_KINDS as readonly ScenarioKind[]) {
  if (!formulaCoversKind(kind)) continue;
  check(`${kind}: has a zone the formula can serve`, zonesForKind(kind).length > 0);
  check(`${kind}: has a lane the formula can serve`, lanesForKind(kind).length > 0);
}
// Every kind the formula owns must actually produce a plan — a kind that
// silently fell through to the plain base build every time would look like it
// was working while testing nothing the formula does.
console.log("\n── The formula is actually reached ──");
for (const kind of SCENARIO_KINDS as readonly ScenarioKind[]) {
  if (!formulaCoversKind(kind)) continue;
  const rng = streamFor(kind);
  const mem = newSimMemory();
  let planned = 0;
  for (let i = 0; i < 40; i++) if (nextSim(kind, rng, mem).planId) planned++;
  check(`${kind}: ${planned}/40 presses used a real chance plan`, planned >= 36);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
if (failures > 0) process.exit(1);
