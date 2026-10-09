import { readFileSync } from "node:fs";
import { makeChance } from "../../lib/star/chanceMaker";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { buildKaneMoment, dealKaneMoment, type KaneMoment } from "../../lib/star/kaneMoments";
import { mulberry32 } from "../../lib/star/season";
import type { ScenarioKind } from "../../lib/star/canvasEngine";

/**
 * KANE DRAWINGS (Settings → Match → Kane drawings (testing)).
 * 376 real Kane passes and shots (public/star/kane-moments.json, made by
 * tools/statsbomb/kane.mts). With the setting on, a chance of a kind that has
 * Kane drawings is one of them; with it off (null), nothing changes.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const file = JSON.parse(readFileSync("public/star/kane-moments.json", "utf8")) as { moments: KaneMoment[] };
const ms = file.moments;
check(ms.length > 300, `a real number of drawings (${ms.length})`);

// Every drawing builds: the ball where Kane was, you on it, the target on the real team-mate.
let bad = 0;
for (const m of ms) {
  const sc = buildKaneMoment(m);
  const b = m.override.ball!;
  if (Math.hypot(sc.ball.x - b.x, sc.ball.y - b.y) > 0.01) bad++;
  if (Math.hypot(sc.player.x - sc.ball.x, sc.player.y - sc.ball.y) > 1.5) bad++;
  if (m.runnerTo && (!sc.runner || !sc.passTarget || Math.hypot(sc.passTarget.x - m.runnerTo.x, sc.passTarget.y - m.runnerTo.y) > 0.01)) bad++;
  if (sc.kind !== m.kind) bad++;
}
check(bad === 0, `every drawing builds as drawn (${bad} wrong)`);

// The match serves them: kind kept, and no repeat until the kind is used up.
const kinds = Array.from(new Set(ms.map((m) => m.kind))) as ScenarioKind[];
for (const kind of kinds) {
  const n = ms.filter((m) => m.kind === kind).length;
  const seen = new Set<string>();
  const rng = mulberry32(3);
  for (let i = 0; i < n; i++) seen.add(dealKaneMoment(kind, rng, ms)!.id);
  check(seen.size === n, `${kind}: all ${n} dealt before any repeats (${seen.size})`);
}
const made = makeChance({ source: { from: "kind", kind: "through_ball" }, rng: mulberry32(9), selection: newSelectionMemory(), kaneDrawings: ms });
check(made.how === "kane" && made.sc.kind === "through_ball", `a through ball is a Kane drawing (${made.how})`);
const cross = makeChance({ source: { from: "kind", kind: "byline_cross" }, rng: mulberry32(9), selection: newSelectionMemory(), kaneDrawings: ms });
check(cross.how !== "kane", "a kind with no Kane drawing is made as before");
const off = makeChance({ source: { from: "kind", kind: "through_ball" }, rng: mulberry32(9), selection: newSelectionMemory(), kaneDrawings: null });
check(off.how !== "kane", "switched off: the game's own");

if (problems.length) { console.error(`kaneMoments: ${problems.length} problem(s)`); for (const p of problems) console.error("  ✗ " + p); process.exit(1); }
console.log(`kaneMoments: ${ms.length} drawings, ${kinds.length} kinds, all good`);
