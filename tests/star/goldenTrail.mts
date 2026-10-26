/**
 * THE GOLDEN RUN-UP'S TRAIL (lib/star/goldenTrail.ts; Star Pass reward, piece 4).
 *
 * Pinned: only the Golden Run-up has a trail; mid-run it is there and lies
 * BEHIND him (on the path he has already run, oldest first, brightest
 * nearest him); sparks are scattered close to his line and rise as they
 * fade; it fades out within GOLDEN_TRAIL.fadeS of reaching the ball; the
 * same moment always gives the same trail; a left-footer's trail is mirrored
 * with him. (Its run-up itself — length, start, plant beside the ball, inside
 * the picture, scoring the same as Standard — is in tests/star/runupStyles.mts.)
 *
 * Run: npx tsx tests/star/goldenTrail.mts
 */
import { goldenTrailAt, mirrorTrail, goldTrailPoints, GOLDEN_TRAIL } from "../../lib/star/goldenTrail";
import { planRunup, runupPositionAt, standBackFor, RUNUP_MOTION, PENALTY_RUNUPS, GOLDEN_RUNUP } from "../../lib/star/runupStyles";
import { PEN_SPOT_Y } from "../../lib/star/pitch";
import { CX } from "../../lib/star/pitch";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const ball = { x: CX, y: PEN_SPOT_Y };
const from = standBackFor(GOLDEN_RUNUP, ball, { x: ball.x, y: ball.y + 1 });
const run = planRunup(GOLDEN_RUNUP, ball, from);
const T = RUNUP_MOTION[GOLDEN_RUNUP].runS;

console.log("\nTHE GOLDEN RUN-UP");
{
  const g = PENALTY_RUNUPS.find((s) => s.id === "golden");
  ok(!!g && g.name === "Golden Run-up", `"golden" is the Golden Run-up (${g?.name})`);
  ok(!!run.ctrl, "it is a curved run");
  ok(T >= 1.5 && T <= 3.2, `release to strike screen ${T} s (1.5-3.2 s, like every style)`);
}

console.log("\nTHE TRAIL");
{
  for (const s of PENALTY_RUNUPS.filter((s) => s.id !== "golden")) {
    const r = planRunup(s.id, ball, standBackFor(s.id, ball, { x: ball.x, y: ball.y + 1 }));
    const t = goldenTrailAt(r, RUNUP_MOTION[s.id].runS * 0.6);
    if (t.streak.length || t.sparks.length) { ok(false, `${s.id} has no trail`); }
  }
  ok(true, "no other run-up has a trail");
  ok(goldenTrailAt(run, 0).streak.length === 0, "nothing before he sets off");

  const mid = T * 0.6;
  const tr = goldenTrailAt(run, mid);
  const here = runupPositionAt(run, mid);
  ok(tr.streak.length >= 10 && tr.sparks.length >= 6, `mid-run: a streak of ${tr.streak.length} points and ${tr.sparks.length} sparks`);
  // Behind him: every streak point is a spot on his own path in the last lifeS seconds.
  let onPath = 0;
  for (const p of tr.streak) {
    let best = Infinity;
    for (let ts = Math.max(0, mid - GOLDEN_TRAIL.lifeS - 0.05); ts <= mid; ts += 0.005) best = Math.min(best, d(p, runupPositionAt(run, ts)));
    if (best < 0.02) onPath++;
  }
  ok(onPath === tr.streak.length, `the streak lies on the path he has just run (${onPath}/${tr.streak.length})`);
  const first = tr.streak[0], last = tr.streak[tr.streak.length - 1];
  ok(d(last, here) < d(first, here) && last.life > first.life, "oldest first: the newest end is at his feet and brightest");
  ok(tr.streak.every((p) => p.life > 0 && p.life <= 1) && tr.sparks.every((p) => p.life > 0 && p.life <= 1), "every brightness is in 0..1");
  ok(tr.sparks.every((s) => d(s, here) < 4), "the sparks are close behind him");
  const young = tr.sparks.reduce((a, b) => (b.life > a.life ? b : a)), old = tr.sparks.reduce((a, b) => (b.life < a.life ? b : a));
  ok(old.h >= young.h - 0.2, `older sparks have floated up (${old.h.toFixed(2)} m vs ${young.h.toFixed(2)} m)`);
  ok(JSON.stringify(goldenTrailAt(run, mid)) === JSON.stringify(tr), "the same moment gives the same trail (no random)");

  // After he gets to the ball: it fades and is gone.
  const a0 = goldenTrailAt(run, T, 0), a1 = goldenTrailAt(run, T, GOLDEN_TRAIL.fadeS * 0.5), a2 = goldenTrailAt(run, T, GOLDEN_TRAIL.fadeS + 0.01);
  const sum = (g: typeof a0) => [...g.streak, ...g.sparks].reduce((s, p) => s + p.life, 0);
  ok(sum(a0) > 0 && sum(a1) < sum(a0) && a2.streak.length === 0 && a2.sparks.length === 0,
    `at the ball it fades (${sum(a0).toFixed(1)} → ${sum(a1).toFixed(1)}) and is gone after ${GOLDEN_TRAIL.fadeS} s`);

  // A left-footer is drawn on the other side of the ball: the trail goes with him.
  const m = mirrorTrail(tr, ball);
  const backX = (p: { x: number }) => p.x - ball.x; // straight behind a central spot is along y, so x flips
  ok(m.streak.every((p, i) => Math.abs(backX(p) + backX(tr.streak[i])) < 1e-9 && Math.abs(p.y - tr.streak[i].y) < 1e-9), "mirrored for a left-footer, across the line behind the ball");
  const pts = goldTrailPoints(tr);
  ok(pts.length > 0 && pts.length <= 64, `the 3D view gets ${pts.length} glowing dots (its pool holds 64)`);
}

if (failed) { console.log(`\nFAIL (${failed})`); process.exit(1); }
console.log("\nPASS — the Golden Run-up leaves a gold trail behind him, and only it does");
