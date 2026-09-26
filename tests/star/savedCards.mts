/**
 * tests/star/savedCards.mts — every saved gallery card loads as exactly the
 * picture that was saved.
 *
 * A saved card stores who stood where as slot numbers into the picture its
 * seed builds. When that base picture changes shape after the save, the
 * slots shift. Found 26 Sep 2026 on a sheet of simulated long shots: a
 * team-mate in goal and the keeper in midfield — and, checked across every
 * saved card, 6 of 14 saved one-on-ones loading YOU onto the poacher's spot.
 * scenarioEdit.ts's savedIdMap now matches by role when the slots no longer
 * line up. This test rebuilds every committed card and checks every saved
 * player is back where he was saved, in the same role.
 */
import { readFileSync } from "fs";
import { buildScenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { fixBaseScenario } from "@/lib/star/baseScenario";
import { buildSimScenario } from "@/lib/star/gallerySim";
import { frameFromScenario } from "@/lib/star/scenarioFrame";
import { applyOverride, overrideFromMatchScenario } from "@/lib/star/scenarioEdit";
import type { MatchScenario } from "@/lib/star/scenarios";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const file = JSON.parse(readFileSync(new URL("../../lib/star/authoredScenarios.json", import.meta.url), "utf8")).scenarios as Record<string, MatchScenario>;

console.log("\nSAVED CARDS LOAD AS SAVED");
let n = 0, exact = 0;
const broken: string[] = [];
for (const ms of Object.values(file)) {
  if (!ms.id.startsWith("gallery-") || ms.source?.seed == null || !ms.source.kind) continue;
  const kind = ms.source.kind as ScenarioKind;
  const sc = ms.id.startsWith("gallery-sim-")
    ? buildSimScenario({ kind, seed: ms.source.seed, planId: ms.source.planId ?? null })
    : (() => { const s = buildScenario(kind, mulberry32(ms.source!.seed!)); fixBaseScenario(s); return s; })();
  const base = frameFromScenario(sc);
  const f = applyOverride(base, overrideFromMatchScenario(ms, base.items, base.camera, base.facing));
  // The saved keeper is the last builder-slot opponent (defenders first,
  // then the keeper; added opponents carry no slot number).
  let savedKeeper = -1;
  ms.players.forEach((p, i) => { if (p.side === "opponent" && /^i\d+$/.test(p.id)) savedKeeper = i; });
  const left = [...f.items];
  let good = left.length === ms.players.length;
  ms.players.forEach((p, i) => {
    const keeper = i === savedKeeper;
    const j = left.findIndex((it) => Math.hypot(it.at.x - p.x, it.at.y - p.y) < 0.01
      && (keeper ? !!it.keeper : !it.keeper && it.side === p.side));
    if (j < 0) good = false; else left.splice(j, 1);
  });
  n++;
  if (good) exact++; else broken.push(ms.id);
}
ok(n > 50, `found the committed cards (${n})`);
ok(exact === n, `every saved card loads with everyone where he was saved, in his role (${exact}/${n})${broken.length ? " — " + broken.slice(0, 4).join(", ") : ""}`);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
