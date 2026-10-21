/**
 * REAL MOMENTS (lib/star/realMoments, data/realmoments) — real football from
 * free-licensed data, turned into our scenarios (Harry, 19 Oct 2026: "rebuild
 * Real moments and Real shots (and Real Goals) with free-licensed data").
 *
 *   1. The data: counts, every position on our pitch, the acting team
 *      attacking the goal at y = 0, a keeper by his goal.
 *   2. Fully real shots as our scenarios: the real keeper and every real man
 *      inside the camera exactly where he stood; the whole goal in frame.
 *   3. Placed shots: the real ball, a keeper between it and the goal, nobody
 *      behind the goal line, the goal in frame.
 *   4. Corners: the ball at the real flag, you beside it, the real box.
 *   5. The tracked build-up (trackLeadIn): real speeds, ends exactly on the
 *      chance (no jump when it starts).
 *   6. The credit lines are LICENCES.md's.
 *
 * Run: npx tsx tests/star/realMoments.mts
 */
import { readFileSync } from "node:fs";
import {
  REAL_CREDIT, scenarioForShot, scenarioForCorner, frameHoldsShot, peopleOf, trackLeadIn, buildUpOf, isFullyReal,
  type TrackedFile, type TrackFile, type WyscoutShotFile, type RealShot, type RealCorner,
} from "../../lib/star/realMoments";
import { leadInEntities } from "../../lib/star/leadIn";
import { airKindOf, kindForShot, playKindForShot } from "../../lib/star/realMoments/shots";
import { isAirKind, airWaitZ, airZOf, AIR_HEIGHT_VARIES, HEADER_Z, VOLLEY_MAX_Z, type AirHeighted } from "../../lib/star/airDrawings";
import { CX, POST_L, POST_R, PITCH_W } from "../../lib/star/pitch";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const share = (n: number, of: number) => `${n}/${of} (${((100 * n) / Math.max(1, of)).toFixed(1)}%)`;

const tracked = (JSON.parse(readFileSync("data/realmoments/tracked.json", "utf8")) as TrackedFile).moments;
const tracks = (JSON.parse(readFileSync("data/realmoments/tracks.json", "utf8")) as TrackFile).tracks;
const wy = (JSON.parse(readFileSync("data/realmoments/wyscout_shots.json", "utf8")) as WyscoutShotFile).shots;
const tShots = tracked.filter((m): m is RealShot & { what: "shot" } => m.what === "shot");
const corners = tracked.filter((m): m is RealCorner => m.what === "corner");

console.log("\n1. THE DATA");
{
  console.log(`  fully real: ${tShots.length} shots, ${corners.length} corners (DFL ${tracked.filter((m) => m.src === "dfl").length}, SkillCorner ${tracked.filter((m) => m.src === "skillcorner").length}); placed: ${wy.length} Wyscout shots`);
  ok(tShots.length + corners.length >= 500, `hundreds of fully real moments (${tShots.length + corners.length})`);
  ok(wy.length >= 2500, `thousands of real shots with placed defenders (${wy.length})`);
  ok(tracked.every((m) => tracks[m.id]) && Object.keys(tracks).length === tracked.length, "every fully real moment has its own track");
  ok(new Set([...tracked, ...wy].map((m) => m.id)).size === tracked.length + wy.length, "every moment id is unique");
  ok(wy.every((s) => !isFullyReal(s) && !s.ff) && tracked.every((m) => isFullyReal(m)), "the two kinds are told apart (src)");
  // Real men stand a few metres off the pitch at times (behind the goal line at a corner).
  const onPitch = (p: number[]) => p[0] >= -5 && p[0] <= PITCH_W + 5 && p[1] >= -5 && p[1] <= 110;
  ok([...tracked, ...wy].every((m) => onPitch(m.ball) && (m.ff ?? []).every(onPitch)), "every position on our pitch (or within 5 m of it)");
  const attacking = tShots.filter((s) => s.ball[1] < 40).length;
  ok(attacking / tShots.length > 0.97, `tracked shots struck towards the goal at y = 0: ${share(attacking, tShots.length)}`);
  const keeperByGoal = tShots.filter((s) => { const k = peopleOf(s).keeper; return k && k.y < 12 && Math.abs(k.x - CX) < 15; }).length;
  ok(keeperByGoal / tShots.length > 0.95, `their keeper stands by that goal: ${share(keeperByGoal, tShots.length)}`);
  const full22 = tracked.filter((m) => (m.ff?.length ?? 0) >= 19).length;
  ok(full22 / tracked.length > 0.9, `19+ others in the picture (all 22 on the pitch): ${share(full22, tracked.length)}`);
  ok(wy.filter((s) => (s.lead?.passes.length ?? 0) >= 2).length > 1000, "1,000+ Wyscout shots with 2+ real passes before them");
}

console.log("\n2. FULLY REAL SHOTS AS OUR SCENARIOS (the Play frame)");
{
  let holds = 0, keeperExact = 0, keepers = 0, menOk = 0, n = 0;
  for (const s of tShots) {
    const sc = scenarioForShot(s, { wideFrame: true });
    n++;
    if (frameHoldsShot(s, sc.viewport)) holds++;
    const p = peopleOf(s);
    if (p.keeper && s.type !== "Penalty") { keepers++; if (d(sc.keeper, p.keeper) < 0.01 && sc.keeperHoldsStart) keeperExact++; }
    // Every real opponent inside the camera is a defender exactly where he stood.
    const v = sc.viewport, inV = (q: { x: number; y: number }) => q.x > v.x1 + 0.8 && q.x < v.x2 - 0.8 && q.y > v.y1 + 0.8 && q.y < v.y2 - 0.8;
    const want = p.opps.filter((q) => inV(q) && d(q, p.ball) >= 0.6);
    if (want.every((q) => sc.defenders.some((dd) => d(dd, q) < 0.01)) && sc.defenders.length === want.length) menOk++;
    if (s.type !== "Penalty" && d(sc.ball, p.ball) > 0.01) { failed++; console.error("  ball moved", s.id); }
  }
  ok(holds / n > 0.97, `everyone within 20 m, the keeper and the whole goal on screen: ${share(holds, n)}`);
  ok(keeperExact === keepers, `the real keeper where he stood, and held there while you aim: ${share(keeperExact, keepers)}`);
  ok(menOk / n > 0.97, `every real opponent in the camera is a defender exactly where he stood: ${share(menOk, n)}`);
}

console.log("\n3. PLACED SHOTS (Wyscout: the shot is real, the others placed by our rules)");
{
  let ball = 0, between = 0, behind = 0, goal = 0, n = 0;
  for (const s of wy) {
    if (s.type === "Penalty") continue;
    const sc = scenarioForShot(s, { wideFrame: true });
    n++;
    if (d(sc.ball, { x: s.ball[0], y: s.ball[1] }) < 0.01) ball++;
    if (sc.keeper.y >= 0 && sc.keeper.y < s.ball[1] && sc.keeper.x > POST_L - 3 && sc.keeper.x < POST_R + 3) between++;
    if (sc.defenders.some((dd) => dd.y < 0.5)) behind++;
    const v = sc.viewport;
    if (v.x1 < POST_L && v.x2 > POST_R && v.y1 < 0 && v.y2 > s.ball[1]) goal++;
  }
  ok(ball === n, `the real ball where it was struck: ${share(ball, n)}`);
  ok(between / n > 0.98, `the placed keeper between the ball and his goal: ${share(between, n)}`);
  ok(behind === 0, `no placed defender behind the goal line (${behind})`);
  ok(goal / n > 0.99, `the ball and the whole goal in the camera: ${share(goal, n)}`);
}

console.log("\n4. CORNERS");
{
  let atFlag = 0, rawNear = 0, you = 0, real = 0;
  for (const c of corners) {
    const sc = scenarioForCorner(c);
    if ((sc.ball.x < 1 || sc.ball.x > PITCH_W - 1) && sc.ball.y < 1) atFlag++;
    if ((c.ball[0] < 3 || c.ball[0] > PITCH_W - 3) && c.ball[1] < 3) rawNear++;
    if (d(sc.player, sc.ball) < 1.5) you++;
    const inBox = (c.ff ?? []).filter((q) => !q[2] && !q[3] && q[1] < 16.5 && Math.abs(q[0] - CX) < 20.16).length;
    const defsInBox = sc.defenders.filter((q) => q.y < 16.5 && Math.abs(q.x - CX) < 20.16).length;
    if (defsInBox === inBox) real++;
  }
  ok(atFlag === corners.length, `the chance's ball on the real flag's corner arc: ${share(atFlag, corners.length)}`);
  // The tracked ball near the flag is the least sure spot (SkillCorner's broadcast camera often loses it there).
  ok(rawNear / corners.length > 0.6, `the tracked ball itself within 3 m of the flag at the kick: ${share(rawNear, corners.length)}`);
  ok(you === corners.length, `YOU (the real taker) beside the ball: ${share(you, corners.length)}`);
  ok(real / corners.length > 0.9, `every real defender in the box is in the corner's picture: ${share(real, corners.length)}`);
}

console.log("\n5. THE TRACKED BUILD-UP (4 s of real movement, then the chance)");
{
  let n = 0, endExact = 0, ballEnd = 0, fast = 0, frames = 0, matched = 0, ents = 0, startJump = 0;
  for (const s of tShots) {
    const tr = tracks[s.id];
    const sc = scenarioForShot(s, { wideFrame: true });
    const lead = trackLeadIn(tr, sc);
    n++;
    const es = leadInEntities(sc);
    ents += es.length; matched += lead.matched;
    if (es.every((e) => { const p = lead.posAt(e.key, lead.durS); return !p || d(p, e.get()) < 1e-6; })) endExact++;
    const b = lead.ballAt(lead.durS);
    // A real header or volley ends in the air, where its ball hangs or bounces from while you aim.
    const wantZ = isAirKind(sc.kind) ? airWaitZ(sc.kind, 0, sc as typeof sc & AirHeighted) : 0;
    if (d(b, sc.ball) < 1e-6 && Math.abs(b.z - wantZ) < 1e-9) ballEnd++;
    const keys = [...es.map((e) => e.key), ...Array.from({ length: lead.extraMates ?? 0 }, (_, i) => `extra${i}`)];
    for (let t = 1 / 30; t <= lead.durS; t += 1 / 30) {
      for (const k of keys) {
        const p = lead.posAt(k, t), q = lead.posAt(k, t - 1 / 30);
        if (!p || !q) continue;
        frames++;
        if (d(p, q) * 30 > 11) fast++;
      }
    }
    if (lead.durS < 3.9 || lead.durS > 4.1) startJump++;
    const build = buildUpOf(tr);
    if (build.men.length < 15 || build.ball.length !== 21) startJump++;
  }
  ok(n === tShots.length && startJump === 0, `every shot: 4 s, 21 frames of the ball, 15+ men decoded (${n} shots, ${startJump} off)`);
  ok(endExact === n, `every man ends exactly where the chance has him: ${share(endExact, n)}`);
  ok(ballEnd === n, `the ball ends on the chance's ball, on the grass (a header or volley: at its height): ${share(ballEnd, n)}`);
  ok(fast / frames < 0.003, `real speeds: man-frames over 11 m/s ${share(fast, frames)}`);
  ok(matched / ents > 0.8, `the chance's men are real men from the track: ${share(matched, ents)}`);
}

console.log("\n6. THE CREDIT LINES");
{
  const lic = readFileSync("data/opendata/LICENCES.md", "utf8");
  for (const [k, line] of Object.entries(REAL_CREDIT)) ok(lic.includes(line), `${k}: the page's credit is LICENCES.md's line`);
}

console.log("\n7. REAL HEADERS AND VOLLEYS ARE PLAYED AS TRUE ONES (21 Oct 2026)");
{
  // The strike height is on every tracked shot that has a ball height (DFL, SkillCorner).
  const withZ = tShots.filter((s) => s.src !== "soccertrack");
  ok(withZ.every((s) => typeof s.z === "number" && s.z >= 0 && s.z < 6), `every DFL and SkillCorner shot has its strike height (${withZ.length})`);
  const open = tShots.filter((s) => s.type === "Open Play");
  const by = (k: string | null) => open.filter((s) => airKindOf(s) === k);
  const heads = by("header"), vols = by("volley"), high = by("high");
  console.log(`  open play: ${heads.length} headers, ${vols.length} volleys, ${high.length} overhead (not served), ${by(null).length} on the grass`);
  ok(heads.length >= 45 && vols.length >= 90, `the real air-ball shots are there (headers ${heads.length} ≥ 45, volleys ${vols.length} ≥ 90)`);
  ok(open.filter((s) => s.body === "Head").every((s) => airKindOf(s) === "header"), "every shot the source says was a header is a header");
  ok(heads.every((s) => playKindForShot(s) === "header" && kindForShot(s) === "header"), "a real header is played as a header (the ball hangs at your head)");
  ok(vols.every((s) => playKindForShot(s) === "volley"), "a real volley is played as a volley (the ball bounces)");
  ok(by(null).every((s) => playKindForShot(s) !== "header" && playKindForShot(s) !== "volley"), "a shot on the grass is never played as a header or a volley");
  ok(high.every((s) => playKindForShot(s) !== "header" && playKindForShot(s) !== "volley"), "an overhead shot is not a header or a volley (acrobatics: not built)");
  // A foot shot the source names (DFL) is never a header, however high.
  ok(open.filter((s) => s.src === "dfl" && s.body !== "Head").every((s) => airKindOf(s) !== "header"), "a DFL foot shot is never served as a header");
  // Its picture: the real men, the whole goal (frameHoldsShot), and its own height when the heights vary.
  let holds = 0, heightOk = 0;
  for (const s of [...heads, ...vols]) {
    const sc = scenarioForShot(s, { wideFrame: true });
    if (frameHoldsShot(s, sc.viewport)) holds++;
    const z = airZOf(sc as typeof sc & AirHeighted);
    const usual = sc.kind === "header" ? HEADER_Z : VOLLEY_MAX_Z;
    if (AIR_HEIGHT_VARIES ? Math.abs(z - (s.z ?? usual)) < 0.6 : z === usual) heightOk++;
  }
  ok(holds === heads.length + vols.length, `every real header and volley's picture holds its men and the goal: ${share(holds, heads.length + vols.length)}`);
  ok(heightOk === heads.length + vols.length, `the ball's height is ${AIR_HEIGHT_VARIES ? "its real one (held in range)" : "the kind's usual one (heights switched off)"}: ${share(heightOk, heads.length + vols.length)}`);
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
