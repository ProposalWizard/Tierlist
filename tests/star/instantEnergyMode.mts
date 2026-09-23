import { newMatch, advanceUntilInvolved, modeAt, tick, resolveScenario, type HiddenMatchInputs, type ScenarioResult } from "../../lib/star/hiddenMatch";
import { mulberry32 } from "../../lib/star/season";

/**
 * SWITCHING ENERGY MODE IS INSTANT.
 *
 * Owners: "if you change to high energy, it changes everything to high energy
 * mode straight away." The match screen re-runs the stretch of play it had
 * already worked out, from the same seed, with the new mode taking over from
 * the next minute (CanvasMatch's stretchRef). That only works if two things
 * hold, and this checks both on the real simulation:
 *   1. every minute BEFORE the switch comes out identical, so nothing already
 *      read out on screen changes;
 *   2. the minutes AFTER it genuinely play at the new mode.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const BASE: HiddenMatchInputs = { teamStrength: 70, oppStrength: 70, playerSkill: 65, position: "ST", energyMode: "medium" };

// ── modeAt: the latest switch at or before the minute wins ──
{
  const inputs: HiddenMatchInputs = { ...BASE, energyModeChanges: [{ minute: 20, mode: "high" }, { minute: 40, mode: "low" }] };
  check(modeAt(inputs, 19) === "medium", "before any switch, the starting mode");
  check(modeAt(inputs, 20) === "high", "from the switch minute, the new mode");
  check(modeAt(inputs, 55) === "low", "a later switch replaces an earlier one");
  check(modeAt(BASE, 70) === "medium", "no switches: the starting mode all match");
}

// ── A re-run keeps everything before the switch identical ──
let identical = 0, runs = 0;
for (let seed = 1; seed <= 400; seed++) {
  const a = newMatch(mulberry32(seed));
  const b = { ...a };
  const first = advanceUntilInvolved(a, BASE, mulberry32(seed * 13), 90);
  const switchAt = Math.max(2, Math.floor(first.events.length ? first.events[0].minute : 5));
  const second = advanceUntilInvolved(b, { ...BASE, energyModeChanges: [{ minute: switchAt, mode: "high" }] }, mulberry32(seed * 13), 90);
  const before = (evs: typeof first.events) => JSON.stringify(evs.filter(e => e.minute < switchAt));
  runs++;
  if (before(first.events) === before(second.events)) identical++;
}
check(identical === runs, `every minute before the switch replays identically (${identical}/${runs})`);

// ── And from the switch on, the new mode really plays ──
// Switch two minutes in and play whole matches: High must find you about 35%
// more often than staying on Medium, Low about 35% less (the owners' target).
function standIn(zone: string, rng: () => number): ScenarioResult {
  const r = rng();
  if (zone === "box") return r < 0.24 ? "goal" : r < 0.85 ? "saved" : "lost";
  if (zone === "attacking") return r < 0.11 ? "goal" : r < 0.6 ? "saved" : r < 0.85 ? "delivered" : "lost";
  return r < 0.72 ? "delivered" : "lost";
}
function chancesWith(changes: HiddenMatchInputs["energyModeChanges"]) {
  let total = 0;
  const N = 1500;
  for (let i = 0; i < N; i++) {
    const rng = mulberry32(1 + i * 7919);
    const st = newMatch(rng);
    while (st.minute < 90) {
      const { request } = tick(st, { ...BASE, energyModeChanges: changes }, rng);
      if (request) { total++; resolveScenario(st, standIn(request.zone, rng)); }
    }
  }
  return total / N;
}
const stay = chancesWith(undefined);
const toHigh = chancesWith([{ minute: 2, mode: "high" }]);
const toLow = chancesWith([{ minute: 2, mode: "low" }]);
check(toHigh > stay * 1.28 && toHigh < stay * 1.45, `switching to High is about +35% chances (${stay.toFixed(2)} -> ${toHigh.toFixed(2)})`);
check(toLow < stay * 0.72 && toLow > stay * 0.55, `switching to Low is about -35% chances (${stay.toFixed(2)} -> ${toLow.toFixed(2)})`);

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`PASS — a mode switch replays the past identically (${identical}/${runs}) and plays the rest at the new mode (Medium ${stay.toFixed(2)}, High ${toHigh.toFixed(2)}, Low ${toLow.toFixed(2)} chances)`);
