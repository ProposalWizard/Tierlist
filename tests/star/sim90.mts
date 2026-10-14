/**
 * The full-match replay (lib/star/sim90.ts, /star-sim90-dev): over several
 * seeds and fixtures, the replay covers all ninety minutes, ends on the
 * unseen match's own score, has 22 men and a ball on the pitch every frame,
 * nobody stands on a team-mate for long, the teams swap ends at half-time,
 * the keeper dives on saves, the defending side's back line is
 * between the ball and its goal, possession matches the unseen match's within
 * a few points, and no pass goes to a man in an offside position. It also
 * counts how the ball goes up the pitch (forward / sideways / back passes,
 * metres gained, possessions into the final third), after Harry's "a lot of
 * passing side to side" (14 Oct 2026).
 */
import { simulate90, startSim90, resolveSim90Chance, SIM_FPS, FULL_T } from "../../lib/star/sim90";
import { frameAt, trackDuration } from "../../lib/star/goalClip/track";
import { PITCH_W } from "../../lib/star/pitch";
import { formationForClub } from "../../lib/star/clubFormation";

// ── Shape vs real football ──
// Targets measured from public tracking data, Oct 2026 (20 + 7 matches; ball zone 0 = own end … 5 = far end).
const REAL = {
  backMinusBallIn: [7.7, 2.3, -3.8, -10.3, -17.6, -24.9], // attacking back line vs ball, m (− = behind)
  backToMidIn: 9.6, backToMidOut: 10.6,                    // back line → midfield gap, m
  lengthIn: 35.4, lengthOut: 31.7,                          // outfield team length, m
  gkOffLineIn: [6.0, 10.7, 15.2, 19.4, 23.5, 27.6],        // keeper metres off his line
  gkOffLineOut: [2.6, 5.0, 9.5, 14.3, 18.8, 22.9],
  roleSdX: 11.0,                                            // one role's spread along the pitch at a fixed ball zone, m
};
const TOL = { backMinusBall: 6, gap: 4, length: 5, gkOffLine: 4, roleSdMin: 0.6 };
const GROUP: Record<string, string> = { CB: "CB", LB: "FB", RB: "FB", LWB: "FB", RWB: "FB", CDM: "DM", CM: "CM", CAM: "AM", LW: "W", RW: "W", LM: "W", RM: "W", ST: "ST", CF: "ST" };
const BACK = new Set(["CB", "FB"]), MID = new Set(["DM", "CM", "AM"]);
const zones = () => [0, 0, 0, 0, 0, 0].map(() => [] as number[]);
const sh = { bmb: zones(), gkIn: zones(), gkOut: zones(),
  b2mIn: [] as number[], b2mOut: [] as number[], lenIn: [] as number[], lenOut: [] as number[], role: new Map<string, number[]>() };
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const sdOf = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };

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
// How the ball goes up the pitch (Harry, 14 Oct 2026: "a lot of passing side to side").
const flowAll = { passes: 0, forward: 0, sideways: 0, backward: 0, gain: 0, poss: 0, outside: 0, reach: 0, toFinal: [] as number[] };
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
    if (c > 0 && f % 5 === 0) {
      // Ends swap at half-time, so depth is measured from each team's own end in each half.
      const second = f >= (FULL_T / 2) * SIM_FPS;
      for (const T of [0, 1]) {
        const slots = formationForClub(T === 0 ? home : away).slots;
        const dep = (y: number) => ((T === 0) !== second ? LEN - y : y) - 52.5;
        const bx = dep(b.y), zx = Math.min(5, Math.max(0, Math.floor((bx + 52.5) / 17.5)));
        const inP = c === T + 1;
        const xs: number[] = [], back: number[] = [], mid: number[] = [];
        for (let k = 1; k < 11; k++) {
          const g = GROUP[slots[k].role] ?? "CM", x = dep(fr.bodies[T * 11 + k].y);
          xs.push(x); if (BACK.has(g)) back.push(x); if (MID.has(g)) mid.push(x);
          const key = `${T}|${s}|${g}|${inP}|${zx}`;
          if (!sh.role.has(key)) sh.role.set(key, []);
          sh.role.get(key)!.push(x);
        }
        (inP ? sh.gkIn : sh.gkOut)[zx].push(dep(fr.bodies[T * 11].y) + 52.5);
        const len = Math.max(...xs) - Math.min(...xs);
        if (inP) { sh.lenIn.push(len); if (back.length) sh.bmb[zx].push(mean(back) - bx); if (back.length && mid.length) sh.b2mIn.push(mean(mid) - mean(back)); }
        else { sh.lenOut.push(len); if (back.length && mid.length) sh.b2mOut.push(mean(mid) - mean(back)); }
      }
    }
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
  const fl = sim.stats.flow;
  flowAll.passes += sim.stats.passes; flowAll.forward += fl.forward; flowAll.sideways += fl.sideways; flowAll.backward += fl.backward;
  flowAll.gain += fl.gain; flowAll.poss += fl.possessions; flowAll.outside += fl.startedOutside; flowAll.reach += fl.reachFinal; flowAll.toFinal.push(...fl.toFinal);
  check(fl.forward / Math.max(1, sim.stats.passes) >= 0.5, `${tag}: only ${Math.round((100 * fl.forward) / sim.stats.passes)}% of passes forward`);
  n++; sumPossDiff += Math.abs(tm - hm); sumLine += line; sumAgree += agree / ctlAll;
}
console.log(rows.join("\n"));
{
  const r1 = (v: number) => v.toFixed(1);
  const zoneRow = (ours: number[][], real: number[], tol: number, name: string) => {
    const o = ours.map((a) => (a.length >= 50 ? mean(a) : NaN));
    o.forEach((v, z) => { if (Number.isFinite(v)) check(Math.abs(v - real[z]) <= tol, `${name} zone ${z}: ours ${r1(v)} vs real ${real[z]} (±${tol})`); });
    console.log(`${name} by zone: ours ${o.map((v) => (Number.isFinite(v) ? r1(v) : "-")).join(" ")} | real ${real.join(" ")}`);
  };
  zoneRow(sh.bmb, REAL.backMinusBallIn, TOL.backMinusBall, "attacking back line minus ball");
  zoneRow(sh.gkIn, REAL.gkOffLineIn, TOL.gkOffLine, "keeper off his line, in possession");
  zoneRow(sh.gkOut, REAL.gkOffLineOut, TOL.gkOffLine, "keeper off his line, out of possession");
  const one = (v: number, real: number, tol: number, name: string) => {
    check(Math.abs(v - real) <= tol, `${name}: ours ${r1(v)} vs real ${real} (±${tol})`);
    console.log(`${name}: ours ${r1(v)} | real ${real}`);
  };
  one(mean(sh.b2mIn), REAL.backToMidIn, TOL.gap, "back line to midfield, in possession");
  one(mean(sh.b2mOut), REAL.backToMidOut, TOL.gap, "back line to midfield, out of possession");
  one(mean(sh.lenIn), REAL.lengthIn, TOL.length, "team length, in possession");
  one(mean(sh.lenOut), REAL.lengthOut, TOL.length, "team length, out of possession");
  // Spread: one side's role, state and ball zone within one match.
  const ms = mean([...sh.role.values()].filter((a) => a.length >= 40).map(sdOf));
  check(ms >= REAL.roleSdX * TOL.roleSdMin, `role spread along the pitch ${r1(ms)} m vs real ${REAL.roleSdX} (at least ${TOL.roleSdMin * 100}%)`);
  console.log(`role spread along the pitch at a fixed ball zone: ours ${r1(ms)} | real ${REAL.roleSdX} (pass from ${r1(REAL.roleSdX * TOL.roleSdMin)})`);
}
{
  // Real top-flight football, from general knowledge (no data shipped): about
  // 50-60% of passes gain ground, about a fifth to a quarter go back, a pass
  // gains a few metres on average, and something like 35-50% of possessions
  // get into the final third. The bars here sit a little wide of those.
  const P = flowAll.passes;
  const pct = (v: number) => Math.round((100 * v) / Math.max(1, P));
  const fwd = flowAll.forward / P, back = flowAll.backward / P, gain = flowAll.gain / P, reach = flowAll.reach / Math.max(1, flowAll.outside);
  const tf = [...flowAll.toFinal].sort((a, b) => a - b);
  console.log(`passes: forward ${pct(flowAll.forward)}% · sideways ${pct(flowAll.sideways)}% · back ${pct(flowAll.backward)}% · ${gain.toFixed(1)} m gained a pass · possessions into the final third ${Math.round(reach * 100)}% · ball won to final third: median ${(tf[tf.length >> 1] ?? 0).toFixed(1)} s`);
  check(fwd >= 0.52, `forward passes ${pct(flowAll.forward)}% (want 52%+)`);
  check(back <= 0.34, `back passes ${pct(flowAll.backward)}% (want 34% or under)`);
  check(gain >= 3, `metres gained a pass ${gain.toFixed(1)} (want 3+)`);
  check(reach >= 0.4, `possessions into the final third ${Math.round(reach * 100)}% (want 40%+)`);
}
{
  // Played live (Harry, 14 Oct 2026: "the game is determined pre-game"): the
  // unseen match runs only up to your chance, and your result goes back in.
  // Same seed, your first chance scored vs missed: the same match up to it,
  // a different one after, and the score carries your goal.
  let tried = 0, differ = 0, sameAgain = 0;
  for (let s = 0; s < 6; s++) {
    const [home, hs, away, as] = FIXTURES[s % FIXTURES.length];
    const setup = { home, away, homeStrength: hs, awayStrength: as, seed: 5000 + s * 104729, matchFlow: s % 2 === 0 };
    const tag = `${home} v ${away} seed ${setup.seed} (live)`;
    const run = (first: "goal" | "missed") => {
      const live = startSim90(setup);
      const w = live.waiting ? { ...live.waiting } : null;
      const ahead = live.events.filter((e) => e.t > live.readyT + 0.11).length;
      const before = live.track.data.slice(0, live.track.n * (live.track.data.length / (FULL_T * SIM_FPS + 1)));
      if (live.waiting) resolveSim90Chance(live, first);
      for (let g = 0; g < 400 && !live.over; g++) if (live.waiting) resolveSim90Chance(live, "bench-rate");
      return { live, w, ahead, before };
    };
    const A = run("goal"), B = run("missed"), A2 = run("goal");
    if (!A.w || !B.w) continue;
    tried++;
    const M = A.w.minute;
    check(A.ahead === 0, `${tag}: ${A.ahead} events staged past the picture while waiting`);
    check(A.w.t < FULL_T && A.w.minute === B.w.minute && A.w.t === B.w.t, `${tag}: both runs wait at the same chance`);
    check(A.before.length === B.before.length && A.before.every((v, k) => v === B.before[k]), `${tag}: the replay up to your chance is the same`);
    check(A.live.score[0] === A.live.radar.state.userScore && A.live.score[1] === A.live.radar.state.oppScore, `${tag}: scored run's score is the unseen match's`);
    check(B.live.score[0] === B.live.radar.state.userScore && B.live.score[1] === B.live.radar.state.oppScore, `${tag}: missed run's score is the unseen match's`);
    const fa = A.live.radar.frames[M], fb = B.live.radar.frames[M];
    check(fa.events.some((e) => e.kind === "highlight-goal") && fb.events.some((e) => e.kind === "highlight-miss"), `${tag}: your result went into minute ${M}`);
    check(fa.userScore === fb.userScore + 1, `${tag}: after your chance ${fa.userScore} vs ${fb.userScore}`);
    check(A.live.events.some((e) => e.kind === "goal" && e.side === 0 && Math.abs(e.minute - M) <= 1), `${tag}: your goal is in the scored run's events`);
    const later = (x: typeof A) => x.live.radar.frames.slice(M + 1).map((f) => `${f.possession}${f.zone}${f.lane}${f.userScore}${f.oppScore}`).join();
    const restDiffers = later(A) !== later(B) && A.live.track.data.some((v, k) => v !== B.live.track.data[k]);
    if (restDiffers) differ++;
    check(restDiffers, `${tag}: the rest of the match is the same whether you scored or not`);
    const same = A2.live.track.data.every((v, k) => v === A.live.track.data[k]) && A2.live.score.join() === A.live.score.join();
    if (same) sameAgain++;
    check(same, `${tag}: same seed and same results, a different match`);
    console.log(`${tag}: first chance ${M}' · scored → ${A.live.score.join("-")}, missed → ${B.live.score.join("-")}`);
  }
  check(tried >= 4, `only ${tried} live fixtures had a chance of yours`);
  console.log(`live: ${tried} fixtures · rest of match differs ${differ}/${tried} · same seed + same results identical ${sameAgain}/${tried}`);
}
console.log(`mean |possession diff| ${((sumPossDiff / n) * 100).toFixed(1)} pts · mean line ${((sumLine / n) * 100).toFixed(1)}% · mean per-minute agree ${((sumAgree / n) * 100).toFixed(1)}%`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log("sim90: ok");
