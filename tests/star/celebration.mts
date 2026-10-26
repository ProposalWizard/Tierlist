/**
 * After you score (Leo, 22 Oct 2026): the run to the corner, the move you
 * equipped, the goal video's extra 2.5 s, and big moments.
 * lib/star/celebration.ts, lib/star/bigMoment.ts, goalClip/recorder.ts.
 */
import { planCelebration, celebAt, celebrationMoveFor, roomFor, celebEndDist, ROOM_M, CELEB_SPECS, CELEB_RUN_S, type CelebrationMove } from "../../lib/star/celebration";
import { isBigMoment, headingIn } from "../../lib/star/bigMoment";
import { GoalRecorder, POST_GOAL_S, CELEB_EXTRA_S } from "../../lib/star/goalClip/recorder";
import { frameAt, trackDuration } from "../../lib/star/goalClip/track";
import { celebCut, makeEdit } from "../../lib/star/goalClip/edit";
import { ACCESSORIES } from "../../lib/star/store/catalogue";
import { PITCH_W } from "../../lib/star/pitch";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

// Every shop celebration maps to its own move; nothing equipped is the plain fist.
const celebs = ACCESSORIES.filter((a) => a.slot === "celebration");
check(celebs.length === 10, `ten celebrations in the shop (got ${celebs.length}): six, plus the Star Pass four`);
for (const a of celebs) check(celebrationMoveFor(a.celebration) !== "fist", `${a.id} plays a move`);
check(celebrationMoveFor(undefined) === "fist", "nothing equipped: fist");
check(new Set(celebs.map((a) => celebrationMoveFor(a.celebration))).size === 10, "ten different moves");
for (const id of ["celeb-corner-flag", "celeb-backflip", "celeb-own-name", "celeb-statue"]) check(celebs.some((a) => a.id === id), `${id} in the catalogue`);

// From many spots in and around the box, every move: he runs towards the nearer
// corner for at most ~2 s, stays on the pitch, never passes the flag, and moves smoothly.
const spots = [{ x: 34, y: 11 }, { x: 25, y: 6 }, { x: 45, y: 14 }, { x: 34, y: 25 }, { x: 60, y: 3 }, { x: 3, y: 2 }, { x: 20, y: 30 }];
for (const move of Object.keys(CELEB_SPECS) as CelebrationMove[]) {
  for (const from of spots) {
    const p = planCelebration(from, move);
    check(p.runS <= CELEB_RUN_S + 1e-9, `${move} ${JSON.stringify(from)}: run ${p.runS.toFixed(2)} s`);
    check(p.totalS < 6.5, `${move}: whole celebration ${p.totalS.toFixed(2)} s`);
    const corner = from.x < PITCH_W / 2 ? 0 : PITCH_W;
    let prev = celebAt(p, 0), maxStep = 0;
    for (let t = 0; t <= p.totalS + 0.5; t += 1 / 60) {
      const s = celebAt(p, t);
      maxStep = Math.max(maxStep, Math.hypot(s.x - prev.x, s.y - prev.y));
      check(s.x >= 0.5 && s.x <= PITCH_W - 0.5 && s.y >= 0.5, `${move} ${JSON.stringify(from)} t=${t.toFixed(2)}: off the pitch (${s.x.toFixed(2)}, ${s.y.toFixed(2)})`);
      prev = s;
    }
    check(maxStep < 8 / 60 + 1e-6, `${move} ${JSON.stringify(from)}: a jump of ${maxStep.toFixed(3)} m in one frame`);
    const end = celebAt(p, p.totalS);
    const d0 = Math.hypot(from.x - corner, from.y), d1 = Math.hypot(end.x - corner, end.y);
    check(d1 <= d0 + 1e-6, `${move} ${JSON.stringify(from)}: ended further from the corner`);
    const minGap = Math.min(2.5, (CELEB_SPECS[move].atFlag ?? 2.5) - 0.05);
    check(d1 >= minGap || d0 < 3, `${move} ${JSON.stringify(from)}: ran past the flag (${d1.toFixed(2)} m from it)`);
    // a move done at the flag: right by it whenever the ~2 s run reaches it (from further out, as near as the run gets)
    if (CELEB_SPECS[move].atFlag !== undefined && d0 > 4 && d0 < 11) check(d1 < 2.0,`${move} ${JSON.stringify(from)}: done at the flag, but ${d1.toFixed(2)} m from it`);
  }
}
// A long way out: about 2 s of real running, about 2 s of move.
{
  const p = planCelebration({ x: 34, y: 14 }, "roar");
  check(p.runS > 1.6 && p.runS <= 2.0, `penalty spot: run ${p.runS.toFixed(2)} s, expected ~2`);
  check(p.runDist > 9, `penalty spot: ran ${p.runDist.toFixed(1)} m`);
  const mid = celebAt(p, p.moveAt + 1);
  check(mid.phase === "move" && Math.abs(mid.clipT - 1) < 1e-9, "move phase plays the clip");
}

// Big moments: 85'+ (scaled), level or one down, a chance with a goal in it.
check(isBigMoment(85, 90, 1, 1, true), "85', level");
check(isBigMoment(89, 90, 0, 1, true), "89', one down");
check(!isBigMoment(84, 90, 0, 0, true), "84' is not");
check(!isBigMoment(88, 90, 2, 1, true), "one up is not (choice 5a)");
check(!isBigMoment(88, 90, 0, 2, true), "two down is not");
check(!isBigMoment(88, 90, 0, 0, false), "no goal in the picture is not");
check(isBigMoment(57, 60, 0, 0, true) && !isBigMoment(55, 60, 0, 0, true), "a 60-minute match: from 56.7'");
check(isBigMoment(105, 90, 1, 1, true), "extra time counts");
check(headingIn({ x: 34, y: 6 }, 0.5, { x: 0, y: -20 }, 1), "a shot 0.3 s out, on target");
check(!headingIn({ x: 34, y: 16 }, 0.5, { x: 0, y: -20 }, 1), "0.8 s out: not yet");
check(!headingIn({ x: 42, y: 6 }, 0.5, { x: 0, y: -20 }, 1), "wide: no");
check(!headingIn({ x: 34, y: 6 }, 2.5, { x: 0, y: -20 }, 4), "over: no");

// The goal video: your goal with a celebration runs 2.5 s longer, and your
// run in it is the plan's, even when the match moved on early (a tap).
const bodies = [
  { id: "you", role: "you" as const, side: "us" as const, kit: { shirt: "#f00", shorts: "#fff" } },
  { id: "keeper", role: "keeper" as const, side: "them" as const, kit: { shirt: "#0f0", shorts: "#000" } },
];
const facts = { id: "c1", minute: 88, minuteLabel: "88", scorer: "You", scorerShort: "You", isYou: true, home: "A", away: "B", youAreHome: true, scorerBody: "you" };
const frame = (yx: number, yy: number) => ({ ball: { x: 34, y: 1, z: 0.3 }, bodies: [{ x: yx, y: yy, z: 0 }, { x: 34, y: 0.5, z: 0 }], keeper: { dive: 0, lunge: 0, dir: 0, kind: null } });
function record(celebrate: boolean, skipAfter: number) {
  const rec = new GoalRecorder();
  rec.begin(bodies as never);
  rec.event("shot", "you");
  for (let i = 0; i < 60; i++) rec.frame(1 / 60, frame(34, 11) as never);
  rec.markGoal(facts as never);
  if (celebrate) rec.celebrate("knee_slide", { x: 34, y: 11 });
  for (let i = 0; i < skipAfter * 60; i++) rec.frame(1 / 60, frame(34, 11) as never);
  rec.finishNow();
  return rec.take()[0];
}
const plain = record(false, 3), full = record(true, 6), skipped = record(true, 0.5);
check(Math.abs(trackDuration(full) - trackDuration(plain) - CELEB_EXTRA_S) < 0.05, `celebration clip ${trackDuration(full).toFixed(2)} s vs ${trackDuration(plain).toFixed(2)} s`);
check(full.goalT + POST_GOAL_S + CELEB_EXTRA_S - trackDuration(full) < 0.05, "it runs to the end of the celebration");
check(Math.abs(trackDuration(skipped) - trackDuration(full)) < 0.05, "a tap in the match does not shorten the video");
const p = planCelebration({ x: 34, y: 11 }, "knee_slide");
for (const t of [1, 2, 3.5]) {
  const at = celebAt(p, t), f = frameAt(skipped, skipped.goalT + t).bodies[0];
  check(Math.hypot(at.x - f.x, at.y - f.y) < 0.15, `video at +${t}s: you at (${f.x.toFixed(2)}, ${f.y.toFixed(2)}), plan (${at.x.toFixed(2)}, ${at.y.toFixed(2)})`);
}
check(celebCut(full) !== null && celebCut(plain) === null, "the tight cut only with a celebration");
check(makeEdit([full], "broadcast").shots.some((s) => s.angle === "tight"), "broadcast goes tight on your celebration");
check(!makeEdit([plain], "broadcast").shots.some((s) => s.angle === "tight"), "an ordinary goal's edit is unchanged");

// Room for you (25 Oct 2026): a man on your run or where your move ends steps
// aside before you get there and stays aside. Every move, from every spot, with
// men standing along the line, on it and either side of it, and at its end.
{
  let worst = Infinity, worstAt = "", fastest = 0;
  for (const move of Object.keys(CELEB_SPECS) as CelebrationMove[]) {
    for (const from of spots) {
      const p = planCelebration(from, move);
      const L = celebEndDist(p), nx = -p.dir.y, ny = p.dir.x;
      const men: { x: number; y: number }[] = [];
      for (let s = 0; s <= L + 1.5; s += 0.75) for (const o of [-1.2, -0.5, 0, 0.4, 1.0])
        men.push({ x: p.from.x + p.dir.x * s + nx * o, y: p.from.y + p.dir.y * s + ny * o });
      for (const m of men) {
        let prev = roomFor(p, m, 0);
        for (let t = 1 / 60; t <= p.totalS + 0.5; t += 1 / 60) {
          const q = roomFor(p, m, t), you = celebAt(p, t);
          fastest = Math.max(fastest, Math.hypot(q.x - prev.x, q.y - prev.y) * 60);
          prev = q;
          // the moment the ball goes in he may still be where he stood; from 0.4 s on, never on top of you
          const d = Math.hypot(q.x - you.x, q.y - you.y);
          if (t >= 0.4 && d < worst) { worst = d; worstAt = `${move} from ${JSON.stringify(from)} man ${m.x.toFixed(1)},${m.y.toFixed(1)} at ${t.toFixed(2)} s`; }
        }
      }
      // anyone already clear is left exactly where he stands
      const far = { x: p.from.x + nx * (ROOM_M + 0.3), y: p.from.y + ny * (ROOM_M + 0.3) };
      const fr = roomFor(p, far, 1.5);
      check(fr.x === far.x && fr.y === far.y, `${move}: a man ${ROOM_M + 0.3} m off the line is not moved`);
      check(roomFor(p, men[3], 0) === men[3], `${move}: nobody moves before the goal`);
    }
  }
  check(worst >= 1.2, `nobody within 1.2 m of you from 0.4 s on (closest ${worst.toFixed(2)} m: ${worstAt})`);
  check(fastest <= 7.5, `nobody steps aside faster than a run (fastest ${fastest.toFixed(1)} m/s)`);
  console.log(`room for you: closest ${worst.toFixed(2)} m from 0.4 s on; fastest step aside ${fastest.toFixed(1)} m/s`);
}

if (problems.length) {
  console.error(`celebration: ${problems.length} problem(s)\n  ` + problems.slice(0, 30).join("\n  "));
  process.exit(1);
}
console.log("celebration: all checks passed");
