/**
 * THE DECK FOLLOWS THE MATCH (Mikey, 26 Oct 2026). Open play is dealt from the
 * even deck (lib/star/kindMix.ts), which used to ignore what the match asked:
 * a new career got a header in game 2, and your play style changed nothing.
 *
 * - Byline crosses: never on Attacking, sometimes on Balanced, most on Defensive.
 * - Headers and volleys: none before they open (inputs.mechanics.air false).
 * Plays real hidden matches and serves each request through makeChance.
 */
import { newMatch, advanceUntilInvolved, resolveScenario, type HiddenMatchInputs, type Playstyle } from "../../lib/star/hiddenMatch";
import { makeChance } from "../../lib/star/chanceMaker";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { mulberry32 } from "../../lib/star/season";
import type { ScenarioKind } from "../../lib/star/canvasEngine";

let fails = 0;
const check = (ok: boolean, what: string) => { if (!ok) { fails++; console.log("  ✗", what); } else console.log("  ✓", what); };

function serve(style: Playstyle, mechanics: HiddenMatchInputs["mechanics"], matches = 120) {
  const counts = new Map<ScenarioKind, number>();
  let total = 0;
  for (let s = 1; s <= matches; s++) {
    const rng = mulberry32(s * 977 + 3);
    const state = newMatch(rng);
    const selection = newSelectionMemory();
    const inputs = { teamStrength: 60, oppStrength: 60, playerSkill: 50, home: true, energyMode: "high", context: { playstyle: style }, mechanics } as HiddenMatchInputs;
    while (state.minute < 90) {
      const step = advanceUntilInvolved(state, inputs, rng, 90);
      if (step.fullTime || !step.request) break;
      const made = makeChance({ source: { from: "request", request: step.request, position: "ST" }, rng, selection });
      counts.set(made.sc.kind, (counts.get(made.sc.kind) ?? 0) + 1); total++;
      resolveScenario(state, "saved");
    }
  }
  const pct = (k: ScenarioKind) => (100 * (counts.get(k) ?? 0)) / Math.max(1, total);
  return { pct, total, n: (k: ScenarioKind) => counts.get(k) ?? 0 };
}

const att = serve("attacking", undefined), bal = serve("balanced", undefined), def = serve("defensive", undefined);
console.log(`  byline crosses: attacking ${att.pct("byline_cross").toFixed(1)}%, balanced ${bal.pct("byline_cross").toFixed(1)}%, defensive ${def.pct("byline_cross").toFixed(1)}% of chances`);
check(att.n("byline_cross") === 0 || att.pct("byline_cross") < 1, "Attacking: no byline crosses from the deck");
check(bal.pct("byline_cross") > att.pct("byline_cross") && def.pct("byline_cross") > bal.pct("byline_cross"), "byline crosses rise from Attacking to Balanced to Defensive");
console.log(`  one-on-ones: Attacking ${att.pct("one_on_one").toFixed(1)}%, Defensive ${def.pct("one_on_one").toFixed(1)}% (a one-on-one is capped at about one a match either way)`);
check(def.pct("midfield_pass") + def.pct("buildup") > att.pct("midfield_pass") + att.pct("buildup"), "Defensive: more deep chances (passes, build-ups) than Attacking");

const early = serve("balanced", { air: false, dribble: false });
check(early.n("header") === 0 && early.n("volley") === 0, `games 1-3: no header or volley served (${early.total} chances)`);
const open = serve("balanced", { air: true, dribble: true });
check(open.n("header") > 0 && open.n("volley") > 0, `once open, headers ${open.n("header")} and volleys ${open.n("volley")} are served`);

if (fails) { console.log(`FAIL (${fails})`); process.exit(1); }
console.log("PASS — the deck follows your play style and what is open");
