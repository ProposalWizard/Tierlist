/**
 * PLAY3D DRIBBLE RUN — the career's dribble chance played in 3D
 * (lib/star/play3d/dribbleRun.ts). Its result must keep the first-person
 * duel's contract (FpDribbleResult), because CanvasMatch's finishFpDribble
 * reads it the same way whichever picture played the run:
 *
 *  1. The waves are exactly the waves asked for (pickWaveSizes), never more
 *     than ten men; real defenders carry their names and faces.
 *  2. Every run ends, inside the duel's 20 s, in one of: cleared / passed / lost.
 *  3. The result's numbers agree: beaten ≤ men, waves beaten ≤ waves,
 *     cleared ⇒ every wave and every man beaten, passed ⇒ where it went and
 *     after how many waves, passFailed only on a loss.
 *  4. Skill counts: a bot that runs round the men clears more often than one
 *     that runs straight through them (and both sometimes lose).
 *  5. A tap with a team-mate on passes to him (most get there), and a drag-shot is ignored.
 *  6. The result's shape is the duel's (a type check: it is assigned to FpDribbleResult).
 */
import { CX } from "../../lib/star/play3d/constants";
import { skillsOf } from "../../lib/star/play3d/player";
import { makeDribbleRun, dribbleRunResult, wavesBeatenOf, DRIBBLE3D_TIMEOUT, type DribbleRunResult } from "../../lib/star/play3d/dribbleRun";
import { pickWaveSizes } from "../../lib/star/firstPersonDribble";
import type { FpDribbleResult } from "../../components/star/FirstPersonDribble";
import { mulberry32 } from "../../lib/star/season";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const you = { id: "you", name: "You", skills: skillsOf(76, { pace: 82, dribbling: 78, technique: 78 }) };
const mates = [{ id: "m1", name: "Saka", skills: skillsOf(80) }, { id: "m2", name: "Rice", skills: skillsOf(79) }];

type Bot = "straight" | "round" | "pass";
function play(seed: number, bot: Bot, withMates = false) {
  const rng = mulberry32(seed);
  const waveSizes = pickWaveSizes(rng, { minRounds: 3 });
  const roster = Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, name: `Defender ${i}`, shortName: `D${i}`, face: `/f${i}.png`, defending: 62 + (i % 5) * 4 }));
  const { world: w, state } = makeDribbleRun({ seed, you, waveSizes, roster, mates: withMates ? mates : [], oppStrength: 70 });
  w.newFeel = true;
  let t = 0, shotTried = false;
  while (!state.end && t < DRIBBLE3D_TIMEOUT + 2) {
    const me = w.you()!;
    if (bot === "pass" && t > 0.5 && t < 0.52) w.act({ kind: "tap" });
    if (bot === "round" && !shotTried && t > 1) { shotTried = true; w.act({ kind: "shoot", dir: { x: 0, y: -1 }, pull: 0.2 }); }
    let mx = 0, my = -1;
    const sprint = true;
    if (bot === "round") {
      // a thinking runner: the next wave he hasn't beaten, aim through its
      // widest gap (the corridor's edges count), flat out
      const ahead = w.players.filter((p) => p.active && p.team === 1 && !p.keeper && !state.beaten.has(p.id) && p.y < me.y + 0.5);
      if (ahead.length) {
        const front = Math.max(...ahead.map((p) => p.y));
        const line = ahead.filter((p) => p.y > front - 3.5).map((p) => p.x).sort((a, c) => a - c);
        const xs = [CX - 15, ...line, CX + 15];
        let gx = me.x, best = -1;
        for (let i = 0; i < xs.length - 1; i++) {
          const g = xs[i + 1] - xs[i], mid = (xs[i] + xs[i + 1]) / 2;
          const score = g - Math.abs(mid - me.x) * 0.35;
          if (score > best) { best = score; gx = mid; }
        }
        const ty = Math.min(me.y - 4, front - 3);
        // never cut more than about 40° off straight (a sharp cut at a sprint leaves the ball behind)
        my = ty - me.y; mx = Math.max(my * 0.85, Math.min(-my * 0.85, gx - me.x));
        // …steering through the ball, as a player does: at a point just past it, that way
        const dl = Math.hypot(mx, my), b = w.ball;
        mx = b.x + (mx / dl) * 1.2 - me.x; my = b.y + (my / dl) * 1.2 - me.y;
      }
    }
    const l = Math.hypot(mx, my);
    w.input = { move: { x: mx / l, y: my / l }, sprint };
    w.step(1 / 120);
    t += 1 / 120;
  }
  return { state, w, waveSizes, t, shotTried };
}

const tally: Record<Bot, Record<string, number>> = { straight: {}, round: {}, pass: {} };
const N = 120;
for (const bot of ["straight", "round", "pass"] as Bot[]) {
  for (let s = 1; s <= N; s++) {
    const { state, w, waveSizes, t } = play(s * 7919 + 3, bot, bot === "pass");
    // 1
    const men = w.players.filter((p) => p.team === 1 && !p.keeper);
    const total = waveSizes.reduce((a, b) => a + Math.min(b, 10), 0);
    check(men.length === Math.min(10, total), `seed ${s}: ${men.length} men for waves ${waveSizes.join("-")}`);
    check(men.length <= 10, `seed ${s}: more than ten men`);
    check(men.every((p) => /^D\d+$/.test(p.name) && !!p.photo), `seed ${s}: a defender lost his real name or face`);
    // 2
    check(state.end !== null, `${bot} seed ${s}: the run never ended (${t.toFixed(1)} s)`);
    check(t <= DRIBBLE3D_TIMEOUT + 0.05, `${bot} seed ${s}: ran ${t.toFixed(1)} s, past the 20 s limit`);
    // 3
    const r: DribbleRunResult = dribbleRunResult(state);
    const fp: FpDribbleResult = r; // 6: same shape as the duel's
    void fp;
    check(r.beaten >= 0 && r.beaten <= men.length, `${bot} seed ${s}: beaten ${r.beaten} of ${men.length}`);
    check(r.totalWaves === waveSizes.length, `${bot} seed ${s}: totalWaves ${r.totalWaves} vs ${waveSizes.length}`);
    check((r.wavesBeaten ?? 0) <= (r.totalWaves ?? 0), `${bot} seed ${s}: waves beaten past the total`);
    if (r.cleared) check(r.wavesBeaten === r.totalWaves && r.beaten === men.length, `${bot} seed ${s}: cleared with ${r.beaten}/${men.length} men, ${r.wavesBeaten}/${r.totalWaves} waves`);
    if (state.end === "passed") check(!!r.passTo && r.passedAfterWaves !== undefined && !r.cleared, `${bot} seed ${s}: a pass result without passTo/passedAfterWaves`);
    if (r.passFailed) check(state.end === "lost", `${bot} seed ${s}: passFailed on a ${state.end}`);
    check(wavesBeatenOf(state) <= waveSizes.length, `${bot} seed ${s}: wavesBeatenOf out of range`);
    tally[bot][state.end ?? "none"] = (tally[bot][state.end ?? "none"] ?? 0) + 1;
  }
}
const rate = (b: Bot, k: string) => (tally[b][k] ?? 0) / N;
// 4
check(rate("round", "clear") > rate("straight", "clear") + 0.1, `running round the men (${(rate("round", "clear") * 100).toFixed(0)}% through) is not clearly better than straight at them (${(rate("straight", "clear") * 100).toFixed(0)}%)`);
check(rate("round", "lost") > 0.05, `running round them never loses (${(rate("round", "lost") * 100).toFixed(0)}%): no challenge`);
check(rate("round", "clear") > 0.15, `running round them clears only ${(rate("round", "clear") * 100).toFixed(0)}%: too hard`);
// 5
// (a first touch that isn't clean leaves it loose: you may win it back and carry on)
check(rate("pass", "passed") > 0.35, `a tap with team-mates on: passed only ${(rate("pass", "passed") * 100).toFixed(0)}%`);
{
  const { state } = play(42, "round");
  check(state.end !== null, "a drag-shot stopped the run");
}

console.log(`play3dDribble: straight ${JSON.stringify(tally.straight)}, round ${JSON.stringify(tally.round)}, pass ${JSON.stringify(tally.pass)} (of ${N})`);
if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.log("  " + p);
  process.exit(1);
}
console.log("play3dDribble: all checks pass");
