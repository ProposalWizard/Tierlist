/**
 * WHAT A NEW CAREER CAN DO, AND WHEN (lib/star/mechanics.ts, Mikey 25 Oct 2026).
 *
 * - No header or volley chance before headers open; game 4 brings one of each.
 * - No run with the ball before moving with the ball opens.
 * - The unlock rules: steer at Pace 60, sprint at Pace 65, aerial after game 3,
 *   dribble after game 4; power shot, knuckleball, skill moves and one-twos
 *   waiting for a future update (never open on a story career yet).
 * - A save from before the story order keeps everything.
 */
import { newMatch, advanceUntilInvolved, resolveScenario, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import { mulberry32 } from "../../lib/star/season";
import { mechanicOpen, mechanicsFor, aerialIntroGame, mechanicGuideDue, MECHANICS } from "../../lib/star/mechanics";
import type { CareerState } from "../../lib/star/types";

let fails = 0;
const check = (ok: boolean, what: string) => { if (!ok) { fails++; console.log("  ✗", what); } else console.log("  ✓", what); };

const base: HiddenMatchInputs = { teamStrength: 60, oppStrength: 60, playerSkill: 50, home: true, energyMode: "high" } as HiddenMatchInputs;

function play(seed: number, inputs: HiddenMatchInputs) {
  const rng = mulberry32(seed);
  const state = newMatch(rng);
  const seen = { header: 0, volley: 0, dribble: 0, all: 0 };
  while (state.minute < 90) {
    const step = advanceUntilInvolved(state, inputs, rng, 90);
    if (step.fullTime || !step.request) break;
    const r = step.request;
    seen.all++;
    if (r.dribble) seen.dribble++;
    if (r.kinds.length && r.kinds.every((k) => k === "header")) seen.header++;
    if (r.kinds.length && r.kinds.every((k) => k === "volley")) seen.volley++;
    resolveScenario(state, "saved");
  }
  return { seen, state };
}

const N = 300;
// Before: no air kinds offered at all, no dribbles.
{
  let air = 0, drib = 0, total = 0;
  for (let s = 1; s <= N; s++) {
    const rng = mulberry32(s);
    const state = newMatch(rng);
    while (state.minute < 90) {
      const step = advanceUntilInvolved(state, { ...base, mechanics: { air: false, dribble: false } }, rng, 90);
      if (step.fullTime || !step.request) break;
      total++;
      if (step.request.kinds.some((k) => k === "header" || k === "volley")) air++;
      if (step.request.dribble) drib++;
      resolveScenario(state, "saved");
    }
  }
  check(air === 0, `games 1-3: no header or volley offered (${air} of ${total} chances)`);
  check(drib === 0, `games 1-4: no run with the ball (${drib} of ${total})`);
}
// Without the gate (an old save): both still happen.
{
  let air = 0, drib = 0;
  for (let s = 1; s <= N; s++) { const { seen } = play(s, base); air += seen.header + seen.volley; drib += seen.dribble; }
  let mixed = 0;
  for (let s = 1; s <= N; s++) {
    const rng = mulberry32(s); const state = newMatch(rng);
    while (state.minute < 90) { const st = advanceUntilInvolved(state, base, rng, 90); if (st.fullTime || !st.request) break; if (st.request.kinds.some((k) => k === "header" || k === "volley")) mixed++; resolveScenario(state, "saved"); }
  }
  check(mixed > 0 && drib > 0, `an old save is unchanged: air kinds offered ${mixed} times, runs with the ball ${drib}`);
}
// Game 4: one header and one volley in every match.
{
  let bad = 0;
  for (let s = 1; s <= N; s++) {
    const { seen } = play(s, { ...base, mechanics: { air: true, airIntro: true, dribble: false } });
    if (seen.header < 1 || seen.volley < 1) bad++;
  }
  check(bad === 0, `game 4: a header and a volley in every match (${bad} of ${N} missing one)`);
  let badLow = 0;
  for (let s = 1; s <= N; s++) {
    const { seen } = play(s, { ...base, energyMode: "low", mechanics: { air: true, airIntro: true, dribble: false } });
    if (seen.header < 1 || seen.volley < 1) badLow++;
  }
  check(badLow === 0, `game 4 on Low energy too (${badLow} of ${N} missing one)`);
}

// The rules.
const career = (games: number, skills: Partial<CareerState["skills"]>, story = true) => ({
  unlocks: story ? { story: true, open: [], seen: [] } : { open: [], seen: [] },
  careerStats: { appearances: games },
  skills: { pace: 40, power: 40, technique: 40, vision: 40, freeKick: 40, aerial: 40, ...skills },
}) as unknown as CareerState;
check(!mechanicOpen(career(3 - 1, {}), "aerial") && mechanicOpen(career(3, {}), "aerial"), "aerial opens after game 3");
check(aerialIntroGame(career(3, {})) && !aerialIntroGame(career(4, {})), "game 4 is the header-and-volley game");
check(!mechanicOpen(career(3, {}), "dribble") && mechanicOpen(career(4, {}), "dribble"), "moving with the ball opens after game 4 (in game 5)");
check(!mechanicOpen(career(0, { pace: 59 }), "steer") && mechanicOpen(career(0, { pace: 60 }), "steer"), "steer your run at Pace 60");
check(!mechanicOpen(career(0, { pace: 64 }), "sprint") && mechanicOpen(career(0, { pace: 65 }), "sprint"), "sprint at Pace 65");
const maxed = career(50, { pace: 99, power: 99, technique: 99, vision: 99 });
for (const id of ["powerShot", "knuckle", "skillMoves", "oneTwo"] as const) check(!mechanicOpen(maxed, id), `${id}: waiting for a future update, closed even at 99`);
const old = career(0, {}, false);
check(Object.values(mechanicsFor(old)).every(Boolean), "a save from before the story order keeps every move");
check(MECHANICS.every((m) => m.guide.title && m.guide.line), "every move has its guide written");
check(mechanicGuideDue(career(3, {})) === "aerial", "after game 3 the headers-and-volleys guide is due");

if (fails) { console.log(`FAIL (${fails})`); process.exit(1); }
console.log("PASS — new careers open their moves one at a time, each with a guide");
