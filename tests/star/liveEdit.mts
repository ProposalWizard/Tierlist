/**
 * tests/star/liveEdit.mts — a live chance becomes a card that shows exactly it.
 *
 * The contract of lib/star/liveEdit.ts: the base the card is saved on, with
 * the drag applied, is the live picture — every figure where he stood, the
 * ball where it was, nobody extra and nobody missing.
 */
import { buildScenario, SCENARIO_KINDS, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { frameFromScenario, type Frame } from "@/lib/star/scenarioFrame";
import { applyOverride } from "@/lib/star/scenarioEdit";
import { cardForLive, baseFor, LIVE_SEED_BASE } from "@/lib/star/liveEdit";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const sig = (f: Frame) => f.items
  .map((it) => `${it.keeper ? "K" : it.side}:${it.at.x.toFixed(3)},${it.at.y.toFixed(3)}`)
  .sort().join("|") + `|ball:${f.ball.x.toFixed(3)},${f.ball.y.toFixed(3)}`;

console.log("\nLIVE CHANCE → CARD");
let n = 0, exact = 0, framed = 0, rebuilt = 0;
const kinds = (SCENARIO_KINDS as readonly ScenarioKind[]).filter((k) => k !== "buildup");
for (const kind of kinds) {
  for (let s = 0; s < 12; s++) {
    // A "live" chance: any build of that kind, then nudged the way a drawing
    // overlay would, so it is not simply one of the base pictures.
    const live = buildScenario(kind, mulberry32(50_000 + s * 17 + kind.length));
    live.defenders.forEach((d, i) => { d.x += (i % 3) - 1; d.y += 0.5; });
    const card = cardForLive(live);
    n++;
    const shown = applyOverride(card.base, card.override);
    if (sig(shown) === sig(frameFromScenario(live))) exact++;
    const lc = frameFromScenario(live).camera, sc = shown.camera;
    if (lc.x1 === sc.x1 && lc.x2 === sc.x2 && lc.y1 === sc.y1 && lc.y2 === sc.y2) framed++;
    // The gallery rebuilds the card from kind + seed — it must be the same base.
    if (sig(frameFromScenario(baseFor(kind, card.seed))) === sig(card.base)) rebuilt++;
    if (card.seed < LIVE_SEED_BASE) failed++;
  }
}
ok(exact === n, `the card shows exactly the live picture (${exact}/${n})`);
ok(rebuilt === n, `the gallery rebuilds the same base from kind + seed (${rebuilt}/${n})`);
ok(framed === n, `the card is framed exactly as the match framed it (${framed}/${n})`);

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nAll checks passed.\n");
