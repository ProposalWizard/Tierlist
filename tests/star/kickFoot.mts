/**
 * tests/star/kickFoot.mts — the foot you chose kicks the ball, on screen (v0.25 item 4).
 *
 * Picture only: a left-footer is the mirror of a right-footer — he runs up
 * from the other side of the ball and swings the other leg. Nothing about
 * the kick itself changes.
 */
import { footSign, drawnTakerAt, runupSideFor, takerFootSign, setActiveFoot, activeFoot } from "@/lib/star/kickFoot";
import { sideOf, backDir } from "@/lib/star/penaltyRunup";
import { feetFor, bodyPoseFor } from "@/lib/star/fiveASide/render";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

console.log("\nWHICH FOOT");
ok(footSign("left") === -1 && footSign("right") === 1 && footSign(undefined) === 1, "left −1, right +1, unknown is right");
ok(runupSideFor(1) === -1 && runupSideFor(-1) === 1, "a right-footer runs up from his left, a left-footer from his right");

console.log("\nTHE RUN-UP SIDE");
let mirroredOk = 0, keptOk = 0, n = 0;
for (let i = 0; i < 200; i++) {
  const ball = { x: 20 + Math.sin(i) * 12, y: 11 + (i % 7) * 3 };
  const p = { x: ball.x + Math.cos(i * 1.7) * 2.5, y: ball.y + 1.5 + Math.abs(Math.sin(i * 0.9)) * 2 };
  const b = backDir(ball);
  // sideOf reads anything within 0.2 m of the line as "his left"; skip those.
  if (Math.abs((p.x - ball.x) * b.y - (p.y - ball.y) * b.x) < 0.3) continue;
  n++;
  for (const sign of [1, -1] as const) {
    const d = drawnTakerAt(ball, p, sign);
    const dist0 = Math.hypot(p.x - ball.x, p.y - ball.y);
    const dist1 = Math.hypot(d.at.x - ball.x, d.at.y - ball.y);
    if (sideOf(ball, d.at) === runupSideFor(sign) && near(dist0, dist1)) {
      if (d.mirrored) mirroredOk++; else keptOk++;
    }
  }
}
ok(n > 100 && mirroredOk + keptOk === 2 * n, `every drawn taker stands on his foot's side, same distance from the ball (${mirroredOk + keptOk}/${2 * n})`);
ok(mirroredOk === n && keptOk === n, "exactly one of the two feet needs the mirror each time");

console.log("\nTHE SWING");
const r = 10;
const right = feetFor(r, { ...bodyPoseFor("kick", 0, 1), crouch: 0 });
const left = feetFor(r, { ...bodyPoseFor("kick", 0, -1), crouch: 0 });
ok(near(left.lx, -right.rx) && near(left.ly, right.ry) && near(left.rx, -right.lx) && near(left.ry, right.ly), "a left-footed kick is the mirror image of a right-footed one");
ok(right.ry < right.ly, "a right-footer's right foot goes through the ball");
ok(left.ly < left.ry, "a left-footer's left foot goes through the ball");
const plain = feetFor(r, bodyPoseFor("kick", 0));
ok(near(plain.ly, plain.ry) && near(plain.lx, -plain.rx), "with no foot given, the old two-legged kick is unchanged");
ok(bodyPoseFor("run", 1, -1).kickFoot === undefined, "running is not affected by the foot");

// v0.25 item 11 (Harry, testing the build): the swing could not be seen. The
// first cut moved the kicking foot 0.09 r sideways and lifted it 0.08 r — on
// a phone figure (r ≈ 10 px) that is 1 px — and the shaded "3d" skin, which
// is what the game draws, ignored the foot altogether.
console.log("\nYOU CAN SEE IT");
const { oneFootKickFeet } = await import("@/lib/star/figure3d");
const k3 = oneFootKickFeet(r, 0.26, 1, -1);
ok(near(k3.lx, left.lx) && near(k3.ly, left.ly) && near(k3.rx, left.rx) && near(k3.ry, left.ry), "both skins swing the same leg to the same place");
ok(left.lx <= -0.35 * r && right.rx >= 0.35 * r, `the kicking foot reaches out to the ball's side (${(-left.lx / r).toFixed(2)} r)`);
ok(left.ry - left.ly >= 0.25 * r, `and comes off the ground (${((left.ry - left.ly) / r).toFixed(2)} r above the standing foot)`);
ok(Math.abs(left.rx) < Math.abs(left.lx) / 2, "the standing foot stays under him");

console.log("\nOTHER PLAYERS AND THE TRIAL");
let lefties = 0;
for (let i = 0; i < 1000; i++) if (takerFootSign(`player-${i}`) < 0) lefties++;
ok(lefties > 120 && lefties < 280, `about one in five team-mates is left-footed (${lefties}/1000)`);
ok(takerFootSign("Bukayo Saka") === takerFootSign("Bukayo Saka"), "the same man always uses the same foot");
setActiveFoot("left"); ok(activeFoot() === "left", "the star page can set the foot for the trial and training");
setActiveFoot(null); ok(activeFoot() === undefined, "and clear it");

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nAll checks passed.\n");
