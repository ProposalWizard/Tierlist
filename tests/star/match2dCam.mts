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
import { solveMatch2D, framedQuad, on2dScreen, pitchTo2dScreen, MATCH2D, type Frame2D } from "../../lib/star/style3d/match2dCam";

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
  const ks: number[] = [], shares: number[] = [];
  const ratio: number[] = [], extra: number[] = [], elevs: Record<string, number> = {};
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 1; seed <= 6; seed++) {
      const c = chanceFor(kind, seed);
      n++; kinds.add(kind);
      const o = oldCam(c), nu = solveMatch2D(c.f);
      const so = score(c, o, BROADCAST.fig), sn = score(c, nu, nu.k);
      for (const [k, s] of [["old", so], ["nu", sn]] as const) {
        tot[k].seen += s.seen; tot[k].kept += s.kept; tot[k].ball.push(s.ballPx); if (s.kept === s.seen) tot[k].full++;
      }
      for (const q of framedQuad(c.f)) if (!on3d(nu, q)) { cornersOff++; break; }
      extra.push(nu.extra); ks.push(nu.k); shares.push(nu.man); elevs[`${nu.elevDeg}°/${nu.fov}`] = (elevs[`${nu.elevDeg}°/${nu.fov}`] ?? 0) + 1;
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
  ok(pct(shares, 0.5) >= MATCH2D.manShare - 0.002 && Math.min(...shares) >= 0.035, `men readable: the median chance at the ${(MATCH2D.manShare * 100).toFixed(0)}% target, none under 3.5%`);
  ok(n >= 40, `${n} chances`);
  ok(tot.nu.kept === tot.nu.seen, `every person and post the 2D shows is on the 3D screen (${share(tot.nu)}%)`);
  ok(cornersOff === 0, `the 2D view box's grass corners (up to 3 m past the pitch on the camera's side) are on the 3D screen in every chance (${cornersOff} not)`);
  ok(badAngle === 0, `every camera 40–60° down (${badAngle} not)`);
  ok(pct(tot.nu.ball, 0.5) < pct(tot.old.ball, 0.5), `the ball sits nearer its 2D spot than before`);
  if (fails) { console.error(`${fails} failed`); process.exit(1); }
}
