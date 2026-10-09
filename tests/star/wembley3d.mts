/**
 * WEMBLEY (lib/star/play3d/wembley.ts) — Harry's rules, checked:
 *   a scorer is safe and steps off; the last man without a goal is out;
 *   rounds repeat until one is left; doubles: a goal by either partner makes
 *   the pair safe; the 60 s valve lowers the keeper (said on the HUD), never a
 *   hidden goal; a session always ends.
 * Then the measure Harry asked for: 200 seeded sessions, four AI men (one 80,
 * three 60): how often the 80 wins, the average round and session length.
 */
import { STEP } from "../../lib/star/play3d/constants";
import { skillsOf } from "../../lib/star/play3d/player";
import {
  makeWembley, wembleyLeave, wembleyPlace, wembleyReward, wembleyWatch, wembleyPlayers,
  VALVE_SECONDS, VALVE_DROP, WEMBLEY_KEEPER, type WembleyState,
} from "../../lib/star/play3d/wembley";
import type { World } from "../../lib/star/play3d/world";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const men = (n: number, ov = 60) => Array.from({ length: n }, (_, i) => ({ id: `m${i + 1}`, name: `Man${i + 1}`, skills: skillsOf(ov) }));
const run = (w: World, s: number) => { for (let i = 0; i < Math.round(s / STEP); i++) w.step(STEP); };
/** Let play start (the round banner), then a goal by `who` as the World would say it. */
/** Rule checks only: the AI never shoots, so the only goals are the ones the test says. */
const quiet = (w: World) => { w.rules.shouldShoot = () => false; };
function goal(w: World, st: WembleyState, who: string) {
  for (let i = 0; i < 120 * 10 && (w.frozen > 0 || st.paused || w.owner === "keeper" || !w.get(who)?.active); i++) w.step(STEP);
  w.emit({ kind: "goal", who });

}

// ── 1. Normal, 4 players: the rules, goal by goal ──
{
  const { world: w, state: s } = makeWembley({ seed: 1, mode: "normal", count: 4, you: { id: "you", name: "You", skills: skillsOf(70) }, mates: men(3) });
  quiet(w);
  check(s.units.length === 4 && w.players.filter((p) => !p.keeper).length === 4, "four players, four entrants");
  goal(w, s, "m1");
  const m1 = w.get("m1")!;
  check(s.units[1].safe && !m1.active && !!m1.sideline, "a scorer is safe, off the pitch, still in the picture");
  check(s.banner?.text.includes("SAFE") ?? false, "a SAFE banner");
  run(w, 7);
  check(!m1.active && m1.x < 30.4 && m1.y < 1, `he walks off to the post (${m1.x.toFixed(1)}, ${m1.y.toFixed(1)})`);
  goal(w, s, "m2");
  check(s.round === 1 && !s.units.some((u) => u.out), "two of four through: nobody out yet");
  goal(w, s, "you");
  check(s.units[3].out && s.units[3].place === 4, "the last without a goal (Man3) is OUT, 4th");
  check(!s.units[0].out && s.units[0].safe, "you scored: safe");
  run(w, 2);
  check(s.round === 2 && s.units.filter((u) => !u.out).every((u) => !u.safe), "round 2: every survivor back on, nobody safe");
  check(w.players.filter((p) => p.active && !p.keeper).length === 3 && !w.get("m3")!.active, "the out man stays off");
  goal(w, s, "m2"); goal(w, s, "m1");
  check(s.youOut && s.units[0].place === 3 && wembleyPlace(s) === 3, "you were last in round 2: out, 3rd");
  run(w, 2);
  check(s.round === 3, "round 3: the last two");
  goal(w, s, "m2");
  run(w, 2);
  check(s.over && s.units.filter((u) => !u.out).length === 1 && s.units[2].place === 1, "Man2 wins: exactly one winner, the session ends");
  check(wembleyReward(s, 50, 0.3).gain === 0 && !wembleyReward(s, 50, 0.3).won, "3rd of 4: no Team move");
}

// ── 2. Doubles: either partner makes the pair safe ──
{
  const { world: w, state: s } = makeWembley({ seed: 2, mode: "doubles", count: 3, you: { id: "you", name: "You", skills: skillsOf(70) }, mates: men(5) });
  quiet(w);
  check(wembleyPlayers("doubles", 3) === 6 && s.units.length === 3 && s.units[0].members.join() === "you,m1", "3 pairs; your partner is the first team-mate");
  check(w.get("m1")!.team === w.get("you")!.team && w.get("m2")!.team !== w.get("you")!.team, "partners share a side");
  goal(w, s, "m1");
  check(s.units[0].safe && !w.get("you")!.active && !w.get("m1")!.active, "your partner scores: you're both safe and off");
  goal(w, s, "m4");
  check(s.units[1].out && s.units[2].safe, "the pair still to score is out");
  run(w, 3);
  goal(w, s, "m5");
  run(w, 3);
  check(s.over && s.units[2].place === 1 && s.units[0].place === 2, "last pair standing wins; you're 2nd");
  check(wembleyReward(s, 50, 0.3).gain > 0, "2nd of 3 pairs: half a win on the Team bar");
}

// ── 3. The valve: 60 s with no goal → the keeper drops, said out loud ──
{
  const { world: w, state: s } = makeWembley({ seed: 3, mode: "normal", count: 3, you: { id: "you", name: "You", skills: skillsOf(70) }, mates: men(2), autoYou: true });
  run(w, 3);
  s.sinceGoal = VALVE_SECONDS - 0.05;
  const before = s.goals;
  run(w, 0.5);
  check(s.keeperNow === WEMBLEY_KEEPER - VALVE_DROP && s.valveLine.includes("tiring") && s.goals === before, `the valve drops him ${VALVE_DROP} and says so, no goal given (${s.valveLine})`);
  check(w.keeperOf()!.skills.overall === s.keeperNow, "the keeper on the pitch really is weaker");
}

// ── 4. Watch / Leave once you're out ──
{
  const { world: w, state: s } = makeWembley({ seed: 4, mode: "normal", count: 3, you: { id: "you", name: "You", skills: skillsOf(70) }, mates: men(2) });
  quiet(w);
  goal(w, s, "m1"); goal(w, s, "m2");
  check(s.youOut && wembleyPlace(s) === 3, "you didn't score: out, 3rd of 3");
  wembleyWatch(w, s);
  check(w.timeScale === 3 && s.watching, "Watch to the end runs three times as fast");
  wembleyLeave(w, s);
  check(s.over && s.left && wembleyPlace(s) === 3 && wembleyReward(s, 50, 0.3).gain < 0, "Leave ends it: 3rd (last) stands, a point off the Team bar");
}

// ── 5. The measure: 200 sessions, four AI men (one 80, three 60) ──
{
  const N = Number(process.env.WEMBLEY_N ?? 200);
  let wins80 = 0, total = 0, stalls = 0, valve = 0, maxGap = 0, goals = 0, shots = 0, saves = 0;
  const rounds: number[] = [];
  for (let seed = 1; seed <= N; seed++) {
    const { world: w, state: s } = makeWembley({
      seed, mode: "normal", count: 4, autoYou: true,
      you: { id: "p80", name: "Eighty", skills: skillsOf(80) },
      mates: [1, 2, 3].map((i) => ({ id: `p60_${i}`, name: `Sixty${i}`, skills: skillsOf(60) })),
    });
    let last = 0;
    for (let i = 0; i < 120 * 900 && !s.over; i++) {
      w.step(STEP);
      if (w.events.length) for (const e of w.drain()) {
        if (e.kind === "goal") { goals++; maxGap = Math.max(maxGap, w.t - last); last = w.t; }
        else if (e.kind === "shot") shots++;
        else if (e.kind === "save") saves++;
      }
    }
    if (!s.over) stalls++;
    if (s.units.find((u) => u.place === 1)?.members[0] === "p80") wins80++;
    total += s.t; rounds.push(...s.roundTimes, s.roundT); valve += s.valveFires;
  }
  const avgRound = rounds.reduce((a, b) => a + b, 0) / rounds.length;
  check(stalls === 0, `every session ends inside 15 minutes (${stalls} stalled)`);
  check(wins80 / N > 0.25, `the 80 wins more than his fair quarter (${wins80} of ${N})`);
  check(total / N > 100 && total / N < 300, `a 4-man session lasts a few minutes (${(total / N).toFixed(0)} s)`);
  console.log(`wembley, ${N} sessions, 4 AI men (one 80, three 60s), keeper ${WEMBLEY_KEEPER}: the 80 wins ${wins80} (${(100 * wins80 / N).toFixed(0)}%, fair share 25%); `
    + `average round ${avgRound.toFixed(0)} s, average session ${(total / N).toFixed(0)} s (${(total / N / 60).toFixed(1)} min); `
    + `${goals} goals from ${shots} shots (${(100 * goals / shots).toFixed(0)}%), ${saves} saves; valve fired ${valve} times (${(valve / N).toFixed(1)} a session); longest gap between goals ${maxGap.toFixed(0)} s; ${stalls} stalls`);
}

if (problems.length) { console.error(problems.map((p) => "  ✗ " + p).join("\n")); process.exit(1); }
console.log("wembley3d: all checks pass");
