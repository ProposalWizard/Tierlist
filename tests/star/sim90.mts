/**
 * The full-match replay (lib/star/sim90.ts, /star-sim90-dev): over several
 * seeds and fixtures, the replay covers all ninety minutes, ends on the
 * unseen match's own score, has 22 men and a ball on the pitch every frame,
 * nobody stands on a team-mate for long, the teams swap ends at half-time,
 * the keeper dives on saves, the defending side's back line is
 * between the ball and its goal, possession matches the unseen match's within
 * a few points, and no pass goes to a man in an offside position.
 */
import { simulate90, SIM_FPS, FULL_T } from "../../lib/star/sim90";
import { frameAt, trackDuration } from "../../lib/star/goalClip/track";
import { PITCH_W } from "../../lib/star/pitch";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
const LEN = 105;

const FIXTURES: [string, number, string, number][] = [
  ["Chelsea", 83, "Brighton & Hove Albion", 72],
  ["Arsenal", 86, "Burnley", 66],
  ["Everton", 70, "Manchester City", 88],
  ["Fulham FC", 75, "Brentford", 75],
];

const rows: string[] = [];
let n = 0;
let sumPossDiff = 0, sumLine = 0, sumAgree = 0;
for (let s = 0; s < 8; s++) {
  const [home, hs, away, as] = FIXTURES[s % FIXTURES.length];
  const seed = 1000 + s * 7919;
  const flow = s % 2 === 0;
  const sim = simulate90({ home, away, homeStrength: hs, awayStrength: as, seed, matchFlow: flow });
  const tr = sim.track;
  const tag = `${home} v ${away} seed ${seed}${flow ? " (flow)" : ""}`;
  check(Math.abs(trackDuration(tr) - FULL_T) < 1e-6, `${tag}: 90 minutes (${trackDuration(tr)} s)`);
  check(tr.bodies.length === 22, `${tag}: 22 men`);
  check(sim.score[0] === sim.radar.state.userScore && sim.score[1] === sim.radar.state.oppScore,
    `${tag}: score ${sim.score.join("-")} vs unseen match ${sim.radar.state.userScore}-${sim.radar.state.oppScore}`);
  if (s === 0) {
    const again = simulate90({ home, away, homeStrength: hs, awayStrength: as, seed, matchFlow: flow });
    check(again.track.data.every((v, k) => v === tr.data[k]), `${tag}: same seed, same replay`);
  }

  let off = 0, bad = 0, lineOk = 0, lineN = 0;
  const closeRun = new Float32Array(22 * 22);
  let longClose = 0;
  let ctlHome = 0, ctlAll = 0, agree = 0;
  for (let f = 0; f < tr.n; f++) {
    const fr = frameAt(tr, f / SIM_FPS);
    const b = fr.ball;
    if (![b.x, b.y, b.z].every(Number.isFinite)) bad++;
    for (const p of fr.bodies) if (p.x < 0 || p.x > PITCH_W || p.y < 0 || p.y > LEN) off++;
    for (let i = 0; i < 22; i++) for (let j = i + 1; j < 22; j++) {
      if ((i < 11) !== (j < 11)) continue;
      const k = i * 22 + j;
      const d = Math.hypot(fr.bodies[i].x - fr.bodies[j].x, fr.bodies[i].y - fr.bodies[j].y);
      if (d < 1.5) { closeRun[k] += 1 / SIM_FPS; if (Math.abs(closeRun[k] - 2) < 0.05) longClose++; }
      else closeRun[k] = 0;
    }
    const c = sim.control[f];
    if (c > 0) {
      ctlAll++;
      if (c === 1) ctlHome++;
      const minute = Math.min(90, Math.floor(f / SIM_FPS / 60) + 1);
      const hp = sim.radar.frames[minute].possession === "user" ? 1 : 2;
      if (c === hp) agree++;
      // The defending side: its deepest outfielder nearer its own goal than the ball.
      // The teams swap ends at half-time: home defends y = 105 in the first
      // half and y = 0 in the second.
      const D = c === 1 ? 1 : 0;
      const second = f >= (FULL_T / 2) * SIM_FPS;
      const own = (D === 0) !== second ? (y: number) => LEN - y : (y: number) => y;
      let deepest = Infinity;
      for (let k = 1; k < 11; k++) deepest = Math.min(deepest, own(fr.bodies[D * 11 + k].y));
      lineN++;
      if (deepest < own(b.y)) lineOk++;
    }
  }
  const hm = sim.radar.frames.slice(1).filter((x) => x.possession === "user").length / 90;
  const tm = ctlHome / Math.max(1, ctlAll);
  const line = lineOk / Math.max(1, lineN);
  check(off === 0, `${tag}: ${off} man-frames off the pitch`);
  check(bad === 0, `${tag}: ${bad} frames without a ball`);
  check(Math.abs(tm - hm) <= 0.06, `${tag}: possession ${Math.round(tm * 100)}% vs unseen ${Math.round(hm * 100)}%`);
  check(line >= 0.85, `${tag}: defending line goal-side of the ball ${Math.round(line * 100)}%`);
  check(longClose <= 6, `${tag}: ${longClose} times two team-mates within 1.5 m for 2 s+`);
  check(sim.stats.offsidePasses === 0, `${tag}: ${sim.stats.offsidePasses} passes to an offside man`);
  check(sim.stats.snaps <= 2, `${tag}: ${sim.stats.snaps} times the ball jumped to a shooter`);
  // Ends swapped: home's keeper is at the far end (y near 105) before the
  // break and the near end after it.
  const k1 = frameAt(tr, 30 * 60).bodies[0].y, k2 = frameAt(tr, 60 * 60).bodies[0].y;
  check(k1 > 105 / 2 && k2 < 105 / 2, `${tag}: ends swap at half-time (home keeper y ${k1.toFixed(0)} then ${k2.toFixed(0)})`);
  const saves = sim.events.filter((e) => e.kind === "save").length;
  let diveFrames = 0;
  for (let f = 0; f < tr.n; f += 1) { const k = frameAt(tr, f / SIM_FPS).keeper; if (k.lunge > 0.04 && k.dir !== 0) diveFrames++; }
  if (saves >= 2) check(diveFrames > 0, `${tag}: ${saves} saves but no dives`);
  const yours = sim.events.filter((e) => e.chance).length;
  const want = sim.radar.frames.filter((x) => x.highlight).length;
  check(yours <= want, `${tag}: ${yours} chances marked yours, unseen match had ${want}`);
  if (want > 0) check(yours >= 1, `${tag}: unseen match handed you ${want} chances, none marked`);
  const goals = sim.events.filter((e) => e.kind === "goal").length;
  const shots = sim.events.filter((e) => e.kind === "shot").length;
  rows.push(`${tag}: ${sim.score.join("-")} (unseen ${sim.radar.state.userScore}-${sim.radar.state.oppScore}) · possession ${Math.round(tm * 100)}% vs ${Math.round(hm * 100)}% · per-minute agree ${Math.round((agree / ctlAll) * 100)}% · line ${Math.round(line * 100)}% · close ${longClose} · passes ${sim.stats.passes} offside ${sim.stats.offsidePasses} · snaps ${sim.stats.snaps} · goals ${goals} shots ${shots} · dives ${diveFrames}f · yours ${yours}/${want}`);
  n++; sumPossDiff += Math.abs(tm - hm); sumLine += line; sumAgree += agree / ctlAll;
}
console.log(rows.join("\n"));
console.log(`mean |possession diff| ${((sumPossDiff / n) * 100).toFixed(1)} pts · mean line ${((sumLine / n) * 100).toFixed(1)}% · mean per-minute agree ${((sumAgree / n) * 100).toFixed(1)}%`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log("sim90: ok");
