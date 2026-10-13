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
  if (fails) { console.error(`${fails} failed`); process.exit(1); }
}
