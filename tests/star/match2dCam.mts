/**
 * THE 3D CAMERA FRAMES WHAT THE 2D FRAMES (lib/star/style3d/match2dCam.ts).
 *
 * Harry, 12 Oct 2026: "the framing is not exactly the same on 3d and 2d … on 2d
 * it might be able to be a shot but on 3d it seems like a build up." Every
 * chance kind × several seeds, framed the way CanvasMatch frames it (new view,
 * wide chances turned, the 20° tilt where the match uses it), on a phone's
 * pitch box. For each chance:
 *   - every person and goal post the 2D shows is on the 3D screen (feet and
 *     head; post foot and top), target 100%;
 *   - the 2D view box's grass corners sit on the 3D screen;
 *   - the camera is 50–60° down, never inside a stand (in front of nothing);
 *   - the ball lands near where the 2D puts it.
 * Prints the same numbers for the camera before (the broadcast camera).
 * MATCH2D_ROWS=1 prints one JSON line per chance (the stills script reads them).
 */
import { buildScenario, initDefenders, goalInView, SCENARIO_KINDS, type Scenario } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { frameForNewView, turnWideChance } from "../../lib/star/matchView";
import { hasRunup } from "../../lib/star/penaltyRunup";
import { tiltFor } from "../../lib/star/cameraTilt";
import { solveBroadcast, actionPoints, bcProject, BROADCAST, type BcFigure, type BcPoint, type BcCamera } from "../../lib/star/style3d/broadcastCam";
import { solveMatch2D, framedQuad, on2dScreen, pitchTo2dScreen, leanedManShare, leanFor, MATCH2D, MATCH_SCALES, MATCH_SCALE_PICK, matchScale, type Frame2D } from "../../lib/star/style3d/match2dCam";
import fs from "node:fs";
import { CX } from "../../lib/star/pitch";
import { usesSetPieceCam, solveSetPieceCam, setPieceKeep, groundUnder, dragRoomShare, SET_PIECE_CAM } from "../../lib/star/style3d/match2dCam";
import { dragForFullPower, DRAG_LENGTH_SCALE } from "../../lib/star/canvasEngine";
import { standBackFor, DEFAULT_PENALTY_RUNUP, DEFAULT_FREE_KICK_RUNUP } from "../../lib/star/runupStyles";
import { drawnTakerAt } from "../../lib/star/kickFoot";
import { keepDragRoom, usesCornerCam, solveCornerCam, tiltCamera, TILT } from "../../lib/star/style3d/match2dCam";
import { zoomCamera } from "../../lib/star/style3d/camZoom";
import { servedChance, cleanServed, SERVED_KINDS } from "../../scripts/cam3d/served.mts";
import { usesKindCam, solveKindCam, wideFromSide, orbitCamera, clampOrbit, ORBIT, centreOnPivot, centreShare, keepInBowl, bowlSpot, ORBIT as ORB } from "../../lib/star/style3d/match2dCam";
import { stanceFor, shotTarget } from "../../lib/star/style3d/setPiece3d";
import { frameTurned, solveTurnFit, easeFit, goalMouthOnScreen, pitchOnScreen, grabsBall, ballGrabMaxPx, bottomOverStand, overheadClipAlong, BOWL, FRAME_TURNED, showsGoal, type TurnFit } from "../../lib/star/style3d/match2dCam";
import { limitOrbit, orbitMaxFor, ORBIT_LIMIT } from "../../lib/star/style3d/match2dCam";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error("  ✗ " + m); } else console.log("  ✓ " + m); };
const W = 372, H = 704; // the 3D match's pitch box on a 390×844 iPhone

export function chanceFor(kind: string, seed: number) {
  const rng = mulberry32(seed * 131 + kind.length * 7);
  const sc = buildScenario(kind as Scenario["kind"], rng, 40 + (seed * 7) % 55);
  initDefenders(sc, rng);
  turnWideChance(sc, !hasRunup(sc.kind), H / W);
  const facing = sc.facing ?? "up";
  const tiltDeg = sc.kind === "corner" || sc.kind === "byline_cross" || facing !== "up" ? 0 : 20;
  const vp = frameForNewView(sc, H / W, false, tiltDeg);
  const f: Frame2D = { viewport: vp, facing, tilt: tiltFor(tiltDeg, W, H), W, H };
  const gv = goalInView(sc.kind);
  const figs: (BcFigure & { keeper?: boolean })[] = [
    { sid: "you", x: sc.player.x, y: sc.player.y, team: "us" },
    ...sc.defenders.map((d, i) => ({ sid: `def${i}`, x: d.x, y: d.y, team: "them" as const })),
    ...sc.teammates.map((t, i) => ({ sid: `mate${i}`, x: t.x, y: t.y, team: "us" as const })),
    ...(sc.runner ? [{ sid: "run0", x: sc.runner.pos.x, y: sc.runner.pos.y, team: "us" as const }] : []),
    ...((sc as unknown as { secondaryRunners?: { pos: { x: number; y: number } }[] }).secondaryRunners ?? []).map((r, i) => ({ sid: `run${i + 1}`, x: r.pos.x, y: r.pos.y, team: "us" as const })),
    { sid: "follower", x: sc.follower.x, y: sc.follower.y, team: "us" },
  ];
  const keeper = { x: sc.keeper.x, y: sc.keeper.y, drawn: gv };
  return { sc, f, figs, keeper, gv, tiltDeg };
}

/** The broadcast camera (3D camera: New before 12 Oct 2026), as engineView placed it at a chance's start. */
export function oldCam(c: ReturnType<typeof chanceFor>): BcCamera {
  const pts = actionPoints({ x: c.sc.ball.x, y: c.sc.ball.y }, c.figs, c.keeper, c.gv);
  return solveBroadcast({ anchor: c.sc.ball, points: pts, facing: c.f.facing, W, H });
}

const on3d = (cam: BcCamera, p: BcPoint) => { const s = bcProject(cam, W, H, p); return s.depth > 0.3 && Math.abs(s.nx) <= 1 && s.fr >= 0 && s.fr <= 1; };

function score(c: ReturnType<typeof chanceFor>, cam: BcCamera, fig: number) {
  let seen = 0, kept = 0;
  const people = [...c.figs, ...(c.keeper.drawn ? [{ x: c.keeper.x, y: c.keeper.y }] : [])];
  for (const g of people) {
    if (!on2dScreen(c.f, g)) continue;
    seen++;
    if (on3d(cam, g) && on3d(cam, { x: g.x, y: g.y, z: 1.8 * fig })) kept++;
  }
  for (const px of [34 - 3.66, 34 + 3.66]) {
    if (!on2dScreen(c.f, { x: px, y: 0 })) continue;
    seen++;
    if (on3d(cam, { x: px, y: 0 }) && on3d(cam, { x: px, y: 0, z: 2.44 })) kept++;
  }
  const b2 = pitchTo2dScreen(c.f, c.sc.ball);
  const b3 = bcProject(cam, W, H, c.sc.ball);
  const ballPx = Math.hypot(b2.X - (b3.nx + 1) / 2 * W, b2.Y - b3.fr * H);
  return { seen, kept, ballPx, b2: { x: b2.X / W, y: b2.Y / H }, b3: { x: (b3.nx + 1) / 2, y: b3.fr } };
}

const isMain = process.argv[1] && process.argv[1].includes("match2dCam");
if (isMain) {
  const rows = process.env.MATCH2D_ROWS === "1";
  const tot = { old: { seen: 0, kept: 0, full: 0, ball: [] as number[] }, nu: { seen: 0, kept: 0, full: 0, ball: [] as number[] } };
  let n = 0, cornersOff = 0, badAngle = 0, kinds = new Set<string>();
  const ks: number[] = [], shares: number[] = [], keeperKs: number[] = [], goalKs: number[] = [], keeperBar: number[] = [];
  const ratio: number[] = [], extra: number[] = [], elevs: Record<string, number> = {};
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 1; seed <= 6; seed++) {
      const c = chanceFor(kind, seed);
      n++; kinds.add(kind);
      const o = oldCam(c), nu = solveMatch2D(c.f);
      const fixed = matchScale();
      const so = score(c, o, BROADCAST.fig), sn = score(c, nu, fixed.man);
      for (const [k, s] of [["old", so], ["nu", sn]] as const) {
        tot[k].seen += s.seen; tot[k].kept += s.kept; tot[k].ball.push(s.ballPx); if (s.kept === s.seen) tot[k].full++;
      }
      for (const q of framedQuad(c.f)) if (!on3d(nu, q)) { cornersOff++; break; }
      extra.push(nu.extra); ks.push(fixed.man); keeperKs.push(fixed.keeper); goalKs.push(fixed.goal);
      shares.push(leanedManShare(nu, W, H, c.sc.ball, MATCH2D.manH * fixed.man, fixed.lean ? leanFor(nu.elevDeg) : 0));
      if (c.gv) {
        // the keeper on his line against the bar, on the 3D screen (Harry: "the goalie's head is out the damn goal")
        const kp = leanedManShare(nu, W, H, { x: c.keeper.x, y: c.keeper.y }, MATCH2D.manH * fixed.keeper, fixed.lean ? leanFor(nu.elevDeg) : 0);
        const bar = bcProject(nu, W, H, { x: 34, y: 0 }).fr - bcProject(nu, W, H, { x: 34, y: 0, z: 2.44 * fixed.goal }).fr;
        keeperBar.push(kp / bar);
      } elevs[`${nu.elevDeg}°/${nu.fov}`] = (elevs[`${nu.elevDeg}°/${nu.fov}`] ?? 0) + 1;
      if (nu.elevDeg < 40 || nu.elevDeg > 60) badAngle++;
      // the 2D man's height on the phone vs a life-size 3D man at the ball: the fig that would match
      const v = c.f.viewport, turned = c.f.facing !== "up";
      const unit = turned ? H / (v.x2 - v.x1) : W / (v.x2 - v.x1);
      const b = pitchTo2dScreen(c.f, c.sc.ball);
      const man2d = 1.847 * unit * (c.f.tilt ? c.f.tilt.s * c.f.tilt.cos : 1);
      const man3d1 = (bcProject(nu, W, H, c.sc.ball).fr - bcProject(nu, W, H, { ...c.sc.ball, z: 1.8 }).fr) * H;
      ratio.push(man2d / man3d1);
      if (rows) console.log(JSON.stringify({ kind, seed, facing: c.f.facing, tilt: c.tiltDeg, vp: c.f.viewport, old: { seen: so.seen, kept: so.kept, ball: so.b3 }, nu: { seen: sn.seen, kept: sn.kept, ball: sn.b3, elev: nu.elevDeg, fov: nu.fov, extra: +nu.extra.toFixed(2) }, ball2d: so.b2, man2dPx: +man2d.toFixed(1), bx: b.X }));
    }
  }
  const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
  const share = (t: { seen: number; kept: number }) => ((100 * t.kept) / Math.max(1, t.seen)).toFixed(1);
  console.log(`${n} chances, ${kinds.size} kinds`);
  console.log(`people + posts the 2D shows that are on the 3D screen: before ${share(tot.old)}% (${tot.old.kept}/${tot.old.seen}; ${tot.old.full}/${n} chances whole) → after ${share(tot.nu)}% (${tot.nu.kept}/${tot.nu.seen}; ${tot.nu.full}/${n} whole)`);
  console.log(`ball, 2D vs 3D on the screen (px, median / p90): before ${pct(tot.old.ball, 0.5).toFixed(0)} / ${pct(tot.old.ball, 0.9).toFixed(0)} → after ${pct(tot.nu.ball, 0.5).toFixed(0)} / ${pct(tot.nu.ball, 0.9).toFixed(0)}`);
  console.log(`fig that matches the 2D's men at this framing: p10 ${pct(ratio, 0.1).toFixed(2)}, median ${pct(ratio, 0.5).toFixed(2)}, p90 ${pct(ratio, 0.9).toFixed(2)} (set ${MATCH2D.fig})`);
  console.log(`extra grass on the 3D screen the 2D does not show: median ${(pct(extra, 0.5) * 100).toFixed(0)}%, p90 ${(pct(extra, 0.9) * 100).toFixed(0)}%; angle/lens picked ${JSON.stringify(elevs)}`);
  console.log(`men: size per chance ${pct(ks, 0).toFixed(2)}–${pct(ks, 1).toFixed(2)}× (median ${pct(ks, 0.5).toFixed(2)}), a man in the action ${(pct(shares, 0) * 100).toFixed(1)}–${(pct(shares, 1) * 100).toFixed(1)}% of the height (median ${(pct(shares, 0.5) * 100).toFixed(1)}%)`);
  // ONE SIZE (Harry, 12 Oct 2026: "no changes in size for any player or goalie or goal should ever occur")
  const same = (a: number[]) => a.every((v) => v === a[0]);
  ok(same(ks) && same(keeperKs) && same(goalKs), `one fixed scale in every chance: men ${ks[0]}x, keeper ${keeperKs[0]}x, goal ${goalKs[0]}x (option "${MATCH_SCALE_PICK}")`);
  const ev = fs.readFileSync(new URL("../../lib/star/style3d/engineView.ts", import.meta.url), "utf8");
  const pm = ev.slice(ev.indexOf("const placeMatch2D"), ev.indexOf("const placeCamera"));
  ok(pm.length > 0 && !/=\s*c\.k\b/.test(pm) && /fig: SIZE3D\.man/.test(pm), "the 2D-frame camera never takes a size from the camera solve (c.k); sizes are SIZE3D (size3d.ts)");
  if (MATCH_SCALE_PICK === "A") ok(keeperBar.length > 20 && Math.max(...keeperBar) < 0.85 && Math.min(...keeperBar) > 0.68, `the keeper's height on the 3D screen sits under the bar in every chance: ${(Math.min(...keeperBar)).toFixed(2)}–${(Math.max(...keeperBar)).toFixed(2)} of the bar's (real: 1.8 / 2.44 = 0.74; ${keeperBar.length} chances with a goal)`);
  ok(Math.max(...keeperBar) < 1, `the keeper never stands taller than the bar on the screen (max ${(Math.max(...keeperBar)).toFixed(2)})`);
  for (const [id, sc] of Object.entries(MATCH_SCALES)) ok(sc.man > 0 && sc.keeper > 0 && sc.goal > 0, `scale option ${id} is a set of fixed numbers`);
  if (MATCH_SCALE_PICK === "current") ok(pct(shares, 0.5) >= MATCH2D.manShare - 0.002, `men readable: the median chance at the ${(MATCH2D.manShare * 100).toFixed(0)}% target at the fixed ${ks[0]}x (smallest ${(Math.min(...shares) * 100).toFixed(1)}%: a wide side-on chance)`);
  ok(n >= 40, `${n} chances`);
  ok(tot.nu.kept === tot.nu.seen, `every person and post the 2D shows is on the 3D screen (${share(tot.nu)}%)`);
  ok(cornersOff === 0, `the 2D view box's grass corners (up to 3 m past the pitch on the camera's side) are on the 3D screen in every chance (${cornersOff} not)`);
  ok(badAngle === 0, `every camera 40–60° down (${badAngle} not)`);
  ok(pct(tot.nu.ball, 0.5) < pct(tot.old.ball, 0.5), `the ball sits nearer its 2D spot than before`);

  // THE SET-PIECE CAMERA (Harry: penalties and free kicks closer; every other kind as the 2D)
  ok(SCENARIO_KINDS.filter((k) => usesSetPieceCam(k)).sort().join() === "free_kick,penalty", "only penalties and free kicks get the closer camera");
  const spShares: number[] = [];
  let spOff = 0, spDrag = 0, spN = 0, spRoom = 0;
  const rooms: number[] = [];
  // the 2D's longest full-power drag on this phone, px (a fraction of the classic 5:8 canvas: 1.6 × width)
  const fullDragPx = dragForFullPower(0) * 1.6 * W;
  ok(Math.abs(dragForFullPower(0) / (0.14 * DRAG_LENGTH_SCALE) - 1) < 1e-9 && Math.abs(SET_PIECE_CAM.dragRoomW - 0.03 - dragForFullPower(0) * 1.6) < 1e-9, `the set-piece camera's drag room matches the 2D's full-power drag (${fullDragPx.toFixed(0)} px on a ${W} px wide box)`);
  const fixedS = matchScale();
  for (const kind of ["penalty", "free_kick"]) for (let seed = 1; seed <= 6; seed++) {
    const c = chanceFor(kind, seed);
    const id = kind === "penalty" ? DEFAULT_PENALTY_RUNUP : DEFAULT_FREE_KICK_RUNUP;
    const you = c.figs.find((g) => g.sid === "you")!;
    const st = drawnTakerAt(c.sc.ball, standBackFor(id, c.sc.ball, c.sc.player, c.f.viewport), 1).at;
    you.x = st.x; you.y = st.y;
    const keep = setPieceKeep(c.sc.ball, c.figs, { x: c.keeper.x, y: c.keeper.y }, fixedS);
    const cam = solveSetPieceCam(c.f, keep, c.sc.ball, fixedS);
    spN++; spShares.push(cam.man);
    for (const p of keep) { const r = bcProject(cam, W, H, p); if (r.depth <= 0.3 || Math.abs(r.nx) > 1 || r.fr < 0 || r.fr > 1) { spOff++; break; } }
    // the drag: a finger on the ball's picture finds the ball's own spot on the grass (the 3D view's touch → 2D mapping)
    const b = bcProject(cam, W, H, c.sc.ball);
    const below = (1 - b.fr) * H;
    rooms.push(below);
    if (below < fullDragPx || b.fr > 1 - dragRoomShare(W, H) + 1e-6) spRoom++;
    const g = groundUnder(cam, W, H, b.nx, 1 - 2 * b.fr);
    if (!g || Math.hypot(g.x - c.sc.ball.x, g.y - c.sc.ball.y) > 0.05) spDrag++;
  }
  console.log(`set-piece camera: a man at the ball ${(pct(spShares, 0) * 100).toFixed(1)}–${(pct(spShares, 1) * 100).toFixed(1)}% of the height (median ${(pct(spShares, 0.5) * 100).toFixed(1)}%), ${spN} chances`);
  ok(spOff === 0, `ball, taker, keeper, the whole goal and the wall on screen in every penalty and free kick (${spOff} not)`);
  ok(pct(spShares, 0.5) >= 0.045 && pct(spShares, 1) <= 0.065, "taker readable: about 5–6% of the screen's height (camera distance only)");
  console.log(`room below the ball for the drag: ${Math.min(...rooms).toFixed(0)}–${Math.max(...rooms).toFixed(0)} px (a full-power drag needs ${fullDragPx.toFixed(0)} px)`);
  ok(spRoom === 0, `a full-power drag back always fits below the ball on penalties and free kicks (${spRoom} short)`);
  ok(spDrag === 0, `the ball's spot on the glass maps back to the ball on the grass (the drag), ${spDrag} off`);

  // ROOM TO DRAG BACK, EVERY SERVED CHANCE (Harry, 12 Oct 2026: "a player wont be able to drag that back
  // on phone"). The chances the game really serves (makeChance; drawn kinds; kinds' rules passed), the 3D
  // camera as engineView builds it while aiming (default, pinched in and out, a corner's B and C start
  // views): the ball's spot on the screen is at least a full-power drag above the bottom.
  {
    const OPEN_K = 1;
    const ev2 = fs.readFileSync(new URL("../../lib/star/style3d/engineView.ts", import.meta.url), "utf8");
    ok(ev2.includes("m2.aimBall && (sp || zoom !== 0) ? keepDragRoom(c0, m2.aimBall, W, H) : c0") && ev2.includes("const OPEN_DEFAULT_K = 1;"), "the 3D view: open play at the default zoom is the 2D frame untouched; the drag room is kept on set pieces, corners and when pinched (engineView.ts)");
    for (const [w, h] of [[372, 704], [390, 844]] as const) {
      const full = dragForFullPower(0) * 1.6 * w;
      let n2 = 0, before = 0, after = 0, worst = Infinity, skipped = 0;
      const per: Record<string, string> = {};
      for (const kind of SERVED_KINDS) {
        let kn = 0, kb = 0;
        for (let seed = 1; seed <= 8; seed++) {
          const c = servedChance(kind, seed, w, h);
          if (!c.drawn || c.faults.length || c.sc.kind !== kind) { skipped++; continue; }
          const b = c.sc.ball;
          if (hasRunup(kind as Scenario["kind"])) {
            const id = kind === "penalty" ? DEFAULT_PENALTY_RUNUP : DEFAULT_FREE_KICK_RUNUP;
            const you = c.figs.find((g) => g.sid === "you")!;
            const st = drawnTakerAt(b, standBackFor(id, b, c.sc.player, c.f.viewport), 1).at;
            you.x = st.x; you.y = st.y;
          }
          const wide = solveMatch2D(c.f);
          const kp = { x: c.keeper.x, y: c.keeper.y };
          const defs = usesCornerCam(kind)
            ? (["B", "C"] as const).map((v) => solveCornerCam(c.f, b, c.figs, kp, matchScale(), v))
            : usesSetPieceCam(kind)
              ? [solveSetPieceCam(c.f, setPieceKeep(b, c.figs, kp, matchScale()), b, matchScale(), SET_PIECE_CAM, kind === "penalty" ? SET_PIECE_CAM.penaltyShare : SET_PIECE_CAM.targetShare)]
              : usesKindCam(kind)
                ? [solveKindCam(kind, c.f, b, c.figs, kp, matchScale())]
                : [{ ...wide, D: wide.D * OPEN_K, minDepth: wide.minDepth * OPEN_K }];
          for (const def of defs) for (const z of [-1, -0.5, 0, 0.5, 1]) {
            const cz = zoomCamera(def, usesKindCam(kind) ? wideFromSide(c.f, def) : wide, z);
            const c0 = { ...cz, elev: (cz.elevDeg * Math.PI) / 180 };
            const y0 = bcProject(c0, w, h, b).fr * h;
            const cam = usesSetPieceCam(kind) || usesCornerCam(kind) || usesKindCam(kind) || z !== 0 ? keepDragRoom(c0, b, w, h) : c0;
            const y1 = bcProject(cam, w, h, b).fr * h;
            n2++; kn++;
            if (y0 > h - full) { before++; kb++; }
            if (y1 > h - full) after++;
            worst = Math.min(worst, h - y1);
          }
        }
        per[kind] = `${kb}/${kn}`;
      }
      console.log(`drag room on ${w}x${h}: a full-power drag is ${full.toFixed(0)} px; ${n2} aiming cameras over the served kinds (${skipped} chances skipped: not drawn, or broke their kind's rules)`);
      console.log(`  short of room before: ${before}/${n2} ${JSON.stringify(per)}; after: ${after}/${n2}; least room left under the ball ${worst.toFixed(0)} px`);
      ok(after === 0, `${w}x${h}: the ball is at least a full-power drag (${full.toFixed(0)} px) above the bottom in every served kind, every zoom, both corner start views (${after} short)`);
    }
  }

  // THE 3D DEFAULT FRAME IS THE 2D FRAME (coordinator, 12 Oct 2026, relaying Harry): every served open-play
  // kind, at the default zoom, puts the ball and the taker where the 2D puts them (within 10% of the screen),
  // both on screen; only corners (the glide) and penalties / free kicks (the set-piece camera) differ.
  {
    let n3 = 0, off = 0, out = 0, worstD = 0, minEdge = 1;
    for (const kind of SERVED_KINDS) {
      if (usesSetPieceCam(kind) || usesCornerCam(kind) || usesKindCam(kind)) continue;
      for (let seed = 1; seed <= 10; seed++) {
        const c = servedChance(kind, seed);
        if (!c.drawn || c.faults.length || c.sc.kind !== kind) continue;
        const cam = solveMatch2D(c.f);
        const you = c.figs.find((g) => g.sid === "you")!;
        for (const p of [c.sc.ball, you]) {
          const a = pitchTo2dScreen(c.f, p), r = bcProject(cam, W, H, p);
          const d = Math.hypot(a.X / W - (r.nx + 1) / 2, a.Y / H - r.fr);
          worstD = Math.max(worstD, d);
          if (d > 0.1) off++;
          const edge = Math.min((r.nx + 1) / 2, 1 - (r.nx + 1) / 2, r.fr, 1 - r.fr);
          minEdge = Math.min(minEdge, edge);
          if (edge < 0.02) out++;
        }
        n3++;
      }
    }
    console.log(`3D default vs the 2D frame: ${n3} served open-play chances; ball and taker at most ${(worstD * 100).toFixed(1)}% of the screen from their 2D spot; nearest to an edge ${(minEdge * 100).toFixed(1)}%`);
    ok(off === 0, `the ball and the taker sit where the 2D puts them, within 10% of the screen (${off} not)`);
    ok(out === 0, `the ball and the taker are on the 3D screen, at least 2% in from every edge (${out} not)`);
  }

  // THE 3D-ONLY CAMERAS (Harry, 12 Oct 2026): cutbacks side-on, framed tight; tight angles from behind
  // the taker's head (FIFA-style); byline crosses the corner's glide. Served chances that pass their
  // kind's rules only. Ball, taker, keeper and the goal on screen; a full-power drag fits under the ball.
  {
    ok(usesKindCam("cutback") && usesKindCam("tight_angle") && !usesKindCam("one_on_one") && !usesKindCam("corner"), "only cutbacks and tight angles get the 3D-only kind camera");
    ok(usesCornerCam("byline_cross") && usesCornerCam("corner") && !usesCornerCam("cutback"), "byline crosses take the corner's camera and glide");
    const ev3 = fs.readFileSync(new URL("../../lib/star/style3d/engineView.ts", import.meta.url), "utf8");
    ok(ev3.includes("solveKindCam(f.kind, fr2") && ev3.includes("usesKindCam(f.kind)"), "the 3D view uses the kind camera (engineView.ts)");
    const manPx = (cam: BcCamera, p: BcPoint) => leanedManShare(cam, W, H, p, 1.8, 0) * H;
    const ref: number[] = [];
    for (const c of cleanServed("one_on_one", 6)) ref.push(manPx(solveMatch2D(c.f), c.sc.ball));
    const refMed = pct(ref, 0.5);
    const fullH = dragForFullPower(0) * 1.6 * W;
    for (const kind of ["cutback", "tight_angle", "byline_cross"]) {
      let n4 = 0, offS = 0, noRoom = 0, small = 0, shape = 0;
      const px: number[] = [], before: number[] = [], Ds: number[] = [];
      for (const c of cleanServed(kind, 10)) {
        const b = c.sc.ball, kp = { x: c.keeper.x, y: c.keeper.y };
        const you = c.figs.find((g) => g.sid === "you")!;
        const cams = kind === "byline_cross"
          ? (["B", "C"] as const).map((v) => keepDragRoom(solveCornerCam(c.f, b, c.figs, kp, matchScale(), v), b, W, H))
          : [solveKindCam(kind, c.f, b, c.figs, kp, matchScale())];
        for (const cam of cams) {
          n4++;
          const must: BcPoint[] = [b, { x: you.x, y: you.y }, { x: you.x, y: you.y, z: 1.8 }];
          if (kind !== "byline_cross") must.push(kp, { ...kp, z: 1.8 }, { x: 34 - 3.66, y: 0 }, { x: 34 + 3.66, y: 0, z: 2.44 });
          if (kind === "cutback") { const r0 = c.figs.find((g) => g.sid === "run0"); if (r0) must.push({ x: r0.x, y: r0.y }, { x: r0.x, y: r0.y, z: 1.8 }); }
          for (const p of must) { const r = bcProject(cam, W, H, p); if (r.depth <= 0.3 || Math.abs(r.nx) > 0.98 || r.fr < 0.01 || r.fr > 0.99) { offS++; break; } }
          if ((1 - bcProject(cam, W, H, b).fr) * H < fullH) noRoom++;
          const m = manPx(cam, b); px.push(m); Ds.push(cam.D);
          if (kind === "cutback" && !(Math.abs(cam.ax) > 0.999 && Math.sign(cam.ax) === Math.sign(b.x - 34))) shape++;
          // behind the taker's head: he (where the 3D stands him, setPiece3d.ts stanceFor) is nearer the
          // camera than the ball, the ball nearer than the goal, a low camera
          if (kind === "tight_angle") {
            const st = stanceFor(kind, b, shotTarget(kind, null, b), 1);
            const ps = bcProject(cam, W, H, st), pb = bcProject(cam, W, H, b);
            const dy = ps.depth, db = pb.depth, dg = bcProject(cam, W, H, { x: 34, y: 0 }).depth;
            // over his shoulder: the ball sits beside his body on the glass, never behind it (at least ~0.35 m across)
            const apart = (Math.abs(ps.nx - pb.nx) * W) / 2, body = (manPx(cam, st) / 1.8) * 0.35;
            if (!(dy < db + 0.3 && db < dg && cam.elevDeg <= 36 && apart >= body)) shape++;
          }
          if (kind !== "byline_cross" && m < 0.8 * refMed) small++;
        }
        if (kind === "cutback") { const s = servedChance(kind, c.seed, W, H, true); before.push(manPx(solveMatch2D(s.f), s.sc.ball)); }
      }
      console.log(`${kind}: ${n4} cameras; a man at the ball ${pct(px, 0).toFixed(0)}–${pct(px, 1).toFixed(0)} px (median ${pct(px, 0.5).toFixed(0)}; one-on-one ${refMed.toFixed(0)})${before.length ? `, side-on 2D frame before ${pct(before, 0.5).toFixed(0)} px` : ""}; camera ${pct(Ds, 0).toFixed(0)}–${pct(Ds, 1).toFixed(0)} m`);
      ok(n4 >= 10, `${kind}: ${n4} served cameras checked`);
      ok(offS === 0, `${kind}: ball, taker${kind === "byline_cross" ? "" : ", keeper and the goal"} on screen in every camera (${offS} not)`);
      ok(noRoom === 0, `${kind}: a full-power drag (${fullH.toFixed(0)} px) fits under the ball (${noRoom} short)`);
      if (kind !== "byline_cross") ok(small === 0, `${kind}: men at least 80% of the one-on-one's size on screen (${small} smaller)`);
      if (kind === "cutback") ok(shape === 0 && pct(px, 0.5) > 1.5 * pct(before, 0.5), `cutback: side-on from the ball's touchline, men ${(pct(px, 0.5) / pct(before, 0.5)).toFixed(1)}× bigger than the old side-on frame`);
      if (kind === "tight_angle") ok(shape === 0, `tight angle: camera low (≤36°) behind the taker, over his shoulder, looking at goal; the ball beside his body (${shape} not)`);
    }
  }
  // THE CAMERA SWIPE (Harry, 12 Oct 2026): turns the view round the ball, at most 45° either way; the ball
  // keeps its spot on the glass; the drag that turns it never reaches the 2D game (no kick, no order).
  {
    let moved = 0, n5 = 0;
    for (const c of cleanServed("tight_angle", 6)) {
      const cam = solveKindCam("tight_angle", c.f, c.sc.ball, c.figs, { x: c.keeper.x, y: c.keeper.y }, matchScale());
      const b0 = bcProject(cam, W, H, c.sc.ball);
      for (const d of [-45, -20, 20, 45]) {
        const o = orbitCamera(cam, c.sc.ball, d);
        const b1 = bcProject(o, W, H, c.sc.ball);
        n5++;
        if (Math.hypot((b1.nx - b0.nx) * W / 2, (b1.fr - b0.fr) * H) > 0.5 || Math.abs(b1.depth - b0.depth) > 1e-6) moved++;
      }
    }
    ok(n5 > 0 && moved === 0, `camera swipe: the ball keeps its spot on the screen and the camera its distance (${n5} turned views, ${moved} moved)`);
    ok(clampOrbit(270) === 180 && clampOrbit(-270) === -180 && clampOrbit(180) === 180 && clampOrbit(90) === 90 && ORBIT.maxDeg === 180, "camera swipe: a full turn round our player (±180°)");
    // ROUND OUR PLAYER, CENTRED (Harry, 13 Oct 2026): turned, the ball sits in the middle; drag room kept; sizes kept
    {
      let n6 = 0, offC = 0, noRoom6 = 0, dist6 = 0, worst = 0;
      const limit = 1 - dragRoomShare(W, H);
      for (const kind of ["tight_angle", "cutback", "one_on_one"]) for (const c of cleanServed(kind, 6)) {
        const cam0 = usesKindCam(kind) ? solveKindCam(kind, c.f, c.sc.ball, c.figs, { x: c.keeper.x, y: c.keeper.y }, matchScale()) : solveMatch2D(c.f);
        for (const d of [90, -90, 180, -180, 45]) {
          const o = centreOnPivot(orbitCamera(cam0, c.sc.ball, d), c.sc.ball, centreShare(d, 0), W, H);
          const b = bcProject(o, W, H, c.sc.ball);
          n6++;
          worst = Math.max(worst, Math.abs(b.nx) / 2);
          if (Math.abs(b.nx) / 2 > 0.1) offC++;
          if (b.fr > limit + 1e-3 || b.fr < 0.25) noRoom6++;
          if (Math.abs(o.D - cam0.D) > 1e-9 || Math.abs(o.fov - cam0.fov) > 1e-9 || Math.abs(o.elev - cam0.elev) > 1e-9) dist6++;
        }
      }
      ok(n6 > 0 && offC === 0, `orbit centred: after a 45–180° turn the ball is within 10% of the screen's middle (${n6} views, ${offC} off, worst ${(worst * 100).toFixed(1)}%)`);
      ok(noRoom6 === 0, `orbit centred: the ball stays a full-power drag above the bottom and in the middle band (${noRoom6} not)`);
      ok(dist6 === 0, "orbit centred: camera distance, angle and lens kept (3D sizes never change)");
      // INSIDE THE BOWL: turned/tilted, the camera never stands outside the stadium
      let nB = 0, standB = 0, outB = 0, offB = 0, roomB = 0, lensB = 0, shrunkB = 0, raisedB = 0, same0 = 0, minD = Infinity, minRatio = Infinity;
      for (const kind of ["tight_angle", "cutback", "one_on_one"]) for (const c of cleanServed(kind, 6)) {
        const cam0 = usesKindCam(kind) ? solveKindCam(kind, c.f, c.sc.ball, c.figs, { x: c.keeper.x, y: c.keeper.y }, matchScale()) : solveMatch2D(c.f);
        if (keepInBowl(cam0, c.sc.ball, 0, W, H) !== cam0) same0++;
        for (const [d, t] of [[90, 0], [-90, 0], [180, 0], [0, 15], [0, -15], [45, 10]] as const) {
          const turned = orbitCamera(cam0, c.sc.ball, d);
          const sh = centreShare(d, t);
          const tl = tiltCamera(turned, c.sc.ball, t + ORB.autoTilt * sh, W, H);
          const o = keepInBowl(centreOnPivot(tl, c.sc.ball, sh, W, H), c.sc.ball, sh, W, H);
          const ce = Math.cos(o.elev), px = o.tx + CX + o.ax * o.D * ce, pz = o.tz + o.az * o.D * ce;
          const b = bcProject(o, W, H, c.sc.ball);
          nB++; minD = Math.min(minD, o.D);
          if (o.D < tl.D - 1e-6) shrunkB++;
          if (o.elev > tl.elev + 1e-6) raisedB++;
          minRatio = Math.min(minRatio, o.D / tl.D);
          const spot = bowlSpot(px, pz, o.D * Math.sin(o.elev));
          if (spot === "out") outB++;
          if (spot === "stand") standB++;
          if (Math.abs(b.nx) / 2 > 0.1) offB++;
          if (b.fr > limit + 1e-3) roomB++;
          // it may RISE to stay inside the bowl (13 Oct 2026: closer read as a zoom-in), never drop, never change lens
          if (Math.abs(o.fov - tl.fov) > 1e-9 || o.elev < tl.elev - 1e-9) lensB++;
        }
      }
      ok(nB > 0 && outB === 0, `inside the bowl: every turned/tilted camera stands inside the stadium, over the grass or over a stand clear of its seats (${nB} views, ${standB} over a stand, ${outB} outside, ${raisedB} raised, ${shrunkB} brought closer, nearest ${minD.toFixed(0)} m)`);
      ok(minRatio >= 0.85 - 1e-6, `inside the bowl: never closer than 85% of the framing's own distance, so no zoom-in (closest ${(minRatio * 100).toFixed(0)}%)`);
      ok(offB === 0 && roomB === 0 && lensB === 0, `inside the bowl: the ball still in the middle (${offB} off), drag room kept (${roomB} short), lens kept and the angle only ever rises (${lensB} not)`);
      ok(same0 === 0, "inside the bowl: the default camera (no turn, no tilt) is untouched");
      ok(centreShare(0, 0) === 0 && centreShare(7.5, 0) === 0.5 && centreShare(15, 0) === 1 && centreShare(0, 5) === 1 && centreShare(0, 0, true) === 1, "orbit centred: none at the default, half at 7.5°, full from 15° turned or 5° tilted, full while dragging");
    }
    const ev4 = fs.readFileSync(new URL("../../lib/star/style3d/engineView.ts", import.meta.url), "utf8");
    const mv = ev4.slice(ev4.indexOf("const onMove = "), ev4.indexOf("const onUp = "));
    const up = ev4.slice(ev4.indexOf("const onUp = "), ev4.indexOf("// PINCH ZOOM"));
    const dn = ev4.slice(ev4.indexOf("const onDown = "), ev4.indexOf("const moveTarget = "));
    const orbitBranch = mv.slice(mv.indexOf("if (touch.orbit) {"), mv.indexOf("const at = moveTarget(e);"));
    ok(dn.includes("touch.pend = !touch.shot && f?.phase === \"aim\";") && dn.indexOf("if (touch.pend) return;") > dn.indexOf("touch.pend =") && dn.indexOf("if (touch.pend) return;") < dn.indexOf("send(\"pointerdown\", e, touch.start2)") && dn.indexOf("if (m2 && mate)") < dn.indexOf("touch.pend ="),
      "camera swipe: only a press on open grass can become one (the ball and a team-mate are taken first), and nothing is sent to the 2D game until it shows what it is");
    ok(orbitBranch.length > 0 && !orbitBranch.includes("send(") && orbitBranch.includes("return;") && /if \(touch\.orbit \|\| touch\.tilt\) \{ touch\.orbit = false; touch\.tilt = false; orbit\.drag = false; orbit\.tiltDrag = false; touch\.id = -1; return; \}/.test(up),
      "camera swipe: a swipe sends nothing to the 2D game, moving or lifting (it can never start a kick)");
    // UP AND DOWN (Harry, 13 Oct 2026): tilts the camera; the ball keeps its spot; never past the limits
    let tMoved = 0, tN = 0, tOut = 0;
    for (const c of cleanServed("tight_angle", 6)) {
      const cam = solveKindCam("tight_angle", c.f, c.sc.ball, c.figs, { x: c.keeper.x, y: c.keeper.y }, matchScale());
      const b0 = bcProject(cam, W, H, c.sc.ball);
      for (const d of [-25, -10, 10, 25]) {
        const t = tiltCamera(cam, c.sc.ball, d, W, H);
        const b1 = bcProject(t, W, H, c.sc.ball);
        const e = (t.elev * 180) / Math.PI;
        tN++;
        if (Math.abs(b1.fr - b0.fr) * H > 0.5) tMoved++;
        if (e < TILT.minElev - 1e-6 || e > TILT.maxElev + 1e-6) tOut++;
      }
    }
    ok(tN > 0 && tMoved === 0 && tOut === 0, `camera tilt: the ball keeps its height on the screen and the angle stays ${TILT.minElev}–${TILT.maxElev}° (${tN} tilted views, ${tMoved} moved, ${tOut} out of range)`);
    const wh = ev4.slice(ev4.indexOf("const onWheel = "), ev4.indexOf("// the floating camera button"));
    ok(wh.length > 0 && wh.includes("setCamZoom(") && !wh.includes("orbit.") && !wh.includes("clampOrbit") && !wh.includes("clampTilt") && wh.includes("if (camLock.on) return;"), "wheel: every wheel event zooms and never turns or tilts the camera; locked = nothing");
    ok(dn.includes("const in2dGrab =") && dn.includes("in2dGrab ||"), "a press inside the 2D ball zone always kicks");
    const tiltBranch = mv.slice(mv.indexOf("if (touch.tilt) {"), mv.indexOf("const at = moveTarget(e);"));
    ok(tiltBranch.length > 0 && !tiltBranch.includes("send(") && tiltBranch.includes("return;"), "camera tilt: an up/down swipe sends nothing to the 2D game");
  }
  // A TURNED CAMERA KEEPS THE GOAL AND THE PITCH, SMOOTHLY (Harry, 13 Oct 2026: "the goal should always be
  // in view even with the ball centred"; "it shld also never be out of play in 3d"; "turning left right isn't
  // clean anymore"). The game's camera for a turned/tilted view is frameTurned (engineView.ts), on the chance's
  // own camera exactly as engineView builds it (set pieces, corners and kind cameras: + keepDragRoom).
  {
    const ms = matchScale();
    const baseCam = (c: ReturnType<typeof servedChance>) => {
      const b = { x: c.sc.ball.x, y: c.sc.ball.y }, kp = { x: c.keeper.x, y: c.keeper.y }, k = c.sc.kind;
      if (usesCornerCam(k)) return keepDragRoom(solveCornerCam(c.f, b, c.figs, kp, ms), b, W, H);
      if (usesKindCam(k)) return keepDragRoom(solveKindCam(k, c.f, b, c.figs, kp, ms), b, W, H);
      if (usesSetPieceCam(k)) return keepDragRoom(solveSetPieceCam(c.f, setPieceKeep(b, c.figs, kp, ms), b, ms, SET_PIECE_CAM, k === "penalty" ? SET_PIECE_CAM.penaltyShare : SET_PIECE_CAM.targetShare), b, W, H);
      return solveMatch2D(c.f);
    };
    const turnedOf = (cam: ReturnType<typeof baseCam>, b: BcPoint, d: number, t: number, sh: number) => {
      const tu = d ? orbitCamera(cam, b, d) : cam;
      const ta = t + ORB.autoTilt * sh;
      return ta ? tiltCamera(tu, b, ta, W, H) : tu;
    };
    const limit = 1 - dragRoomShare(W, H);
    const views = [[45, 0], [90, 0], [-90, 0], [180, 0], [0, 15], [0, -15], [90, 15], [90, -15]] as const;
    let p70 = 0, roofNew = 0, roofOld = 0, roofBad = 0, nG = 0, goalLost = 0, oldLost = 0, oldShort = 0, overSeats = 0, oldOver = 0, steep = 0, maxElevT = 0, nV = 0, pitchShort = 0, minPitch = 1, ballBad = 0, closer = 0, lens = 0, untouched = 0, grabBig = 0, grabOldMax = 0, grabNewMax = 0, grassGrabs = 0;
    const short: string[] = [], lostAt: string[] = [], overAt: string[] = [];
    const grid = (fn: (X: number, Y: number) => boolean) => { let n = 0, y = 0; for (let i = 0; i < 24; i++) for (let j = 0; j < 40; j++) { n++; if (fn(((i + 0.5) / 24) * W, ((j + 0.5) / 40) * H)) y++; } return y / n; };
    for (const kind of SERVED_KINDS) for (const c of cleanServed(kind, 3)) {
      const cam0 = baseCam(c), b = c.sc.ball;
      const goal = showsGoal(cam0, W, H);
      if (frameTurned(cam0, b, 0, W, H, goal) !== cam0) untouched++;
      for (const [d, t] of views) {
        const sh = centreShare(d, t), tl = turnedOf(cam0, b, d, t, sh);
        const o = frameTurned(tl, b, sh, W, H, goal);
        nV++;
        const before = keepInBowl(centreOnPivot(tl, b, sh, W, H), b, sh, W, H); // the camera before this change
        if (goal) { nG++; if (!goalMouthOnScreen(o, W, H)) { goalLost++; lostAt.push(`${kind}#${c.seed} ${d}°/${t}°`); } if (!goalMouthOnScreen(before, W, H)) oldLost++; }
        if (pitchOnScreen(before, W, H) < 0.6) oldShort++;
        // the screen's bottom edge stays on the grass (within 2 m of a stand's front): past it, that stand's roof
        // is drawn over the picture (the turned stills of 13 Oct 2026 had their bottom 40% under one); and the
        // camera keeps a real 3D angle (not near top-down)
        if (bottomOverStand(o, W, H) > 2) { overSeats++; overAt.push(`${kind}#${c.seed} ${d}°/${t}° ${bottomOverStand(o, W, H).toFixed(0)} m`); }
        if (bottomOverStand(before, W, H) > 2) oldOver++;
        // (the stadium lifts a turned camera that stands outside it anyway, ball centred and nothing moved: keepInBowl)
        const eT = (o.elev * 180) / Math.PI, eMin = (Math.max(tl.elev, keepInBowl(centreOnPivot(tl, b, 1, W, H), b, 1, W, H).elev) * 180) / Math.PI;
        maxElevT = Math.max(maxElevT, eT - Math.max(eMin, FRAME_TURNED.elevCap));
        if (eT > Math.max(eMin, FRAME_TURNED.elevCap) + 0.5) steep++;
        // A STAND'S ROOF OVER THE PICTURE (stills, 13 Oct 2026: the bottom 40% of two turned views was the
        // roof). Roofs (real/arena.ts) sit ~28 m up, from 3.5 m behind each stand's front to its back; the
        // game draws a roof only where it is no nearer the camera than engineView's clip. Share of the screen
        // covered by a drawn roof, with the game's clip (stand fronts) and with the old one (the screen's bottom).
        const roofShare = (x: typeof o, k: number) => {
          const tV = Math.tan((x.fov * Math.PI) / 360), tH = tV * (W / H), se = Math.sin(x.elev), ce = Math.cos(x.elev);
          const py = x.D * se, px = x.tx + x.ax * x.D * ce, pz = x.tz + x.az * x.D * ce;
          if (py <= 28) return 0;
          return grid((X, Y) => {
            const nx = (X / W) * 2 - 1, ny = 1 - (Y / H) * 2;
            const dx = -x.ax * ce + x.az * nx * tH - x.ax * se * ny * tV, dy = -se + ce * ny * tV, dz = -x.az * ce - x.ax * nx * tH - x.az * se * ny * tV;
            if (dy >= 0) return false;
            const tt = (py - 28) / -dy, wx = px + dx * tt + CX, wz = pz + dz * tt;
            const sb = Math.max(BOWL.x0 - wx, wx - BOWL.x1, BOWL.y0 - wz, wz - BOWL.y1);
            const al = (wx - CX) * x.ax + wz * x.az;
            return sb >= 3.5 && sb <= BOWL.depth && al <= k;
          });
        };
        let nearG = -Infinity;
        for (const nx of [-1, 0, 1]) { const gq = groundUnder(o, W, H, nx, -1); if (gq) nearG = Math.max(nearG, (gq.x - CX) * o.ax + gq.y * o.az); }
        const rNew = roofShare(o, Math.min(nearG + 1.5, overheadClipAlong(o, b, 1))), rOld = roofShare(o, nearG + 1.5);
        roofNew = Math.max(roofNew, rNew); roofOld = Math.max(roofOld, rOld);
        if (rNew > 0.01) roofBad++;
        const p = pitchOnScreen(o, W, H) - rNew;
        minPitch = Math.min(minPitch, p);
        if (p < 0.5) p70++;
        if (p < 0.6) { pitchShort++; short.push(`${kind}#${c.seed} ${d}°/${t}° ${(p * 100).toFixed(0)}%`); }
        const bp = bcProject(o, W, H, b);
        if (!(bp.depth > 0.3 && Math.abs(bp.nx) <= 0.9 && bp.fr >= 0.1 && bp.fr <= limit + 1e-3)) ballBad++;
        if (o.D < tl.D * 0.85 - 1e-6) closer++;
        if (Math.abs(o.fov - tl.fov) > 1e-9) lens++;
        // THE GRAB: the old zone (the 2D's zone and 3.2 m, both on the grass) against the new one (bounded on the glass)
        const bx = ((bp.nx + 1) / 2) * W, by = bp.fr * H, b2 = pitchTo2dScreen(c.f, b);
        const press = (X: number, Y: number) => {
          const g = groundUnder(o, W, H, (X / W) * 2 - 1, 1 - (Y / H) * 2);
          if (!g) return null;
          const a2 = pitchTo2dScreen(c.f, g);
          return { glass: Math.hypot(X - bx, Y - by), in2d: Math.hypot(a2.X - b2.X, a2.Y - b2.Y) <= 0.2 * H, m: Math.hypot(g.x - b.x, g.y - b.y) };
        };
        const oldShare = grid((X, Y) => { const q = press(X, Y); return !!q && (q.glass <= 48 || q.in2d || q.m < 3.2); });
        const newShare = grid((X, Y) => { const q = press(X, Y); return !!q && grabsBall(q.glass, q.in2d, q.m); });
        grabOldMax = Math.max(grabOldMax, oldShare); grabNewMax = Math.max(grabNewMax, newShare);
        if (newShare > (Math.PI * ballGrabMaxPx() ** 2) / (W * H) + 0.01) grabBig++;
        // a press clearly on open grass (two grab-radii from the ball) never grabs, so it turns or tilts
        if (grid((X, Y) => { const q = press(X, Y); return !!q && q.glass > 2 * ballGrabMaxPx() && grabsBall(q.glass, q.in2d, q.m); }) > 0) grassGrabs++;
      }
    }
    ok(untouched === 0, "turned framing: the default camera (no turn, no tilt) is untouched");
    ok(nG > 0 && goalLost <= Math.ceil(nG * 0.02), `turned framing: the whole goal mouth (both posts, bar and net foot) on screen in the turned/tilted views of a chance whose own camera shows it, all but at most 2% (the rest would need the men at dot size, FRAME_TURNED.maxD) (${nG} views, ${goalLost} lost${lostAt.length ? ": " + lostAt.join(", ") : ""}; before: ${oldLost})`);
    // Harry, 14 Oct 2026: the pitch is the main thing (fans and boards at an edge are fine, the roof never)
    ok(pitchShort <= Math.ceil(nV * 0.01) && minPitch >= 0.4, `turned framing: the pitch is the main thing: at least 60% of the screen in ${nV - pitchShort} of ${nV} views (before: ${nV - oldShort}; lowest ${(minPitch * 100).toFixed(0)}%${short.length ? "; under: " + short.join(", ") : ""})`);
    ok(roofBad === 0 && roofOld > 0.05, `turned framing: no stand roof on the screen (largest ${(roofNew * 100).toFixed(1)}% of it; with the old clip a roof covered up to ${(roofOld * 100).toFixed(0)}%, and counts as off the pitch)`);
    console.log(`  turned framing: the screen's bottom edge out over a stand's seats in ${overSeats} views (before: ${oldOver}); their roofs are not drawn (above)`);
    ok(steep === 0, `turned framing: never pushed towards top-down: at most ${FRAME_TURNED.elevCap}° down (or the stadium's own lift) (${steep} steeper; worst ${maxElevT.toFixed(1)}° over)`);
    ok(ballBad === 0, `turned framing: the ball stays clearly on screen with a full-power drag under it (${ballBad} not)`);
    ok(closer === 0 && lens === 0, `turned framing: never in (at most the bowl's 85%), lens kept: sizes never change (${closer} closer, ${lens} lens)`);
    ok(grabBig === 0 && grassGrabs === 0 && grabOldMax > 0.4, `ball grab: on the glass round the ball, at most ${ballGrabMaxPx().toFixed(0)} px: ${(grabNewMax * 100).toFixed(0)}% of a turned screen at most (was ${(grabOldMax * 100).toFixed(0)}%); a press on open grass never grabs (${grassGrabs} views where it did)`);
    ok(grabsBall(40, false, 99) && !grabsBall(60, false, 99) && grabsBall(60, true, 99) && grabsBall(60, false, 2) && !grabsBall(100, true, 0) && !grabsBall(170, true, 8.4),
      "ball grab: a fingertip always grabs; out to 1.4x only inside the 2D zone or 3.2 m; never past it (the logged 170 px press inside the 2D zone does not grab)");
    // SMOOTH: a fast swipe (3° a frame at 60 fps, as the game eases it) and a tilt, sweeping the whole range
    let worstRatio = 0, worstElev = 0, worstLook = 0, nS = 0;
    const rep: string[] = [];
    for (const kind of ["one_on_one", "cutback", "corner", "tight_angle", "byline_cross", "free_kick"]) for (const c of cleanServed(kind, 1)) {
      const cam0 = baseCam(c), b = c.sc.ball, goal = showsGoal(cam0, W, H);
      const run = (frames: [number, number][]) => {
        let fit: TurnFit | null = null;
        const ps = frames.map(([d, t]) => {
          const tl = turnedOf(cam0, b, d, t, 1), want = solveTurnFit(tl, b, W, H, goal);
          fit = fit ? easeFit(fit, want, 1 / 60) : want;
          const o = frameTurned(tl, b, 1, W, H, goal, fit), ce = Math.cos(o.elev);
          return { x: o.tx + o.ax * o.D * ce, y: o.D * Math.sin(o.elev), z: o.tz + o.az * o.D * ce, e: (o.elev * 180) / Math.PI, lx: o.tx, lz: o.tz };
        });
        const st: number[] = [];
        for (let i = 1; i < ps.length; i++) {
          st.push(Math.hypot(ps[i].x - ps[i - 1].x, ps[i].y - ps[i - 1].y, ps[i].z - ps[i - 1].z));
          worstElev = Math.max(worstElev, Math.abs(ps[i].e - ps[i - 1].e));
          worstLook = Math.max(worstLook, Math.hypot(ps[i].lx - ps[i - 1].lx, ps[i].lz - ps[i - 1].lz));
        }
        const med = [...st].sort((p, q) => p - q)[st.length >> 1], mx = Math.max(...st);
        worstRatio = Math.max(worstRatio, mx / Math.max(med, 1)); nS++;
        return `${mx.toFixed(1)}/${med.toFixed(1)} m`;
      };
      const a = run(Array.from({ length: 61 }, (_, i) => [i * 3, 0] as [number, number]));
      const t = run(Array.from({ length: 51 }, (_, i) => [0, -25 + i] as [number, number]));
      rep.push(`${kind} turn ${a}, tilt ${t}`);
    }
    console.log("  smoothness (largest / typical camera step per frame): " + rep.join("; "));
    ok(nS > 0 && worstRatio <= 4 && worstElev <= 4 && worstLook <= 4, `turned framing is smooth: no frame's camera step over 4x the typical one (worst ${worstRatio.toFixed(1)}x), angle under 4° a frame (worst ${worstElev.toFixed(1)}°), look point under 4 m a frame (worst ${worstLook.toFixed(1)} m)`);
  }
  // CORNERS TURN LESS (Harry, 14 Oct 2026, option C): on a corner the turn stops softly at ±60° (distance cap
  // still 165 m); every other kind keeps the full ±180°. At the limit the whole goal stays on screen.
  {
    const asks = Array.from({ length: 801 }, (_, i) => -400 + i);
    const got = asks.map((d) => limitOrbit(d, "corner"));
    const within = got.every((g) => Math.abs(g) <= ORBIT_LIMIT.corner + 1e-9);
    const reaches = limitOrbit(180, "corner") > ORBIT_LIMIT.corner - 0.05 && limitOrbit(-180, "corner") < -ORBIT_LIMIT.corner + 0.05;
    const free = asks.filter((d) => Math.abs(d) <= ORBIT_LIMIT.corner - ORBIT_LIMIT.knee).every((d) => limitOrbit(d, "corner") === d);
    // soft: never turns back, and never moves more than the finger asked (no jump)
    let soft = true;
    for (let i = 1; i < asks.length; i++) { const step = got[i] - got[i - 1]; if (step < -1e-12 || step > 1 + 1e-9) soft = false; }
    ok(orbitMaxFor("corner") === 60 && within && reaches && free && soft && FRAME_TURNED.maxD === 165,
      `corner swipe: the turn stops at ±60° (asked 90° → ${limitOrbit(90, "corner").toFixed(1)}°, 180° → ${limitOrbit(180, "corner").toFixed(2)}°), follows the finger exactly up to ±${ORBIT_LIMIT.corner - ORBIT_LIMIT.knee}°, eases in after (no jump); distance cap still ${FRAME_TURNED.maxD} m`);
    let otherBad = 0;
    for (const k of [...SERVED_KINDS.filter((x) => x !== "corner"), "byline_cross"]) for (const d of asks) if (limitOrbit(d, k) !== clampOrbit(d)) otherBad++;
    ok(otherBad === 0 && orbitMaxFor("byline_cross") === 180 && orbitMaxFor("one_on_one") === 180, `corner swipe: every other kind unchanged, a full ±180° (${otherBad} differ)`);
    const ms = matchScale();
    const lost: string[] = [];
    let views = 0;
    for (const seed of [1, 3]) {
      const c = servedChance("corner", seed, W, H);
      const b = { x: c.sc.ball.x, y: c.sc.ball.y };
      const cam0 = keepDragRoom(solveCornerCam(c.f, b, c.figs, { x: c.keeper.x, y: c.keeper.y }, ms), b, W, H);
      const goal = showsGoal(cam0, W, H);
      for (const ask of [180, -180]) {
        const d = limitOrbit(ask, "corner");
        const o = frameTurned(orbitCamera(cam0, b, d), b, centreShare(d, 0), W, H, goal);
        views++;
        if (!goal || !goalMouthOnScreen(o, W, H)) lost.push(`#${seed} ${d.toFixed(0)}°`);
      }
    }
    ok(views === 4 && lost.length === 0, `corner swipe at the limit: the whole goal mouth on screen for corner seeds 1 and 3, turned both ways (${views - lost.length} of ${views}${lost.length ? "; lost " + lost.join(", ") : ""})`);
    const ev5 = fs.readFileSync(new URL("../../lib/star/style3d/engineView.ts", import.meta.url), "utf8");
    ok(ev5.includes("orbit.target = limitOrbit(orbit.d0 - (dx / w) * ORBIT.degPerWidth, orbit.kind)") && ev5.includes("orbit.kind = f.kind;"), "corner swipe: the game's swipe uses the kind's limit (engineView.ts onMove)");
  }
  if (fails) { console.error(`${fails} failed`); process.exit(1); }
}
