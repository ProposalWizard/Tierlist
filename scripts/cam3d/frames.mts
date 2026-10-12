// Real chances (built and framed exactly as the career match frames them in the
// new view) as engine frames for the 3D harness, plus an SVG of what the 2D view
// box shows on the phone (lines, men, ball, goal), drawn through the 2D's own
// tilt. Usage: npx tsx scripts/cam3d/frames.mts OUTDIR   (writes chances.json + 2d-*.svg)
import fs from "node:fs";
import { cleanServed, SERVED_KINDS, type Served } from "./served.mts";
import { pitchTo2dScreen, type Frame2D } from "../../lib/star/style3d/match2dCam";
import { hasRunup, plantBeside } from "../../lib/star/penaltyRunup";
import { standBackFor, planRunup, runupPositionAt, DEFAULT_PENALTY_RUNUP, DEFAULT_FREE_KICK_RUNUP, RUNUP_MOTION } from "../../lib/star/runupStyles";
import { drawnTakerAt } from "../../lib/star/kickFoot";
import { SET_PIECE_KINDS } from "../../lib/star/newLook";

const out = process.argv[2] ?? "/tmp/cam3d";
fs.mkdirSync(`${out}/raw`, { recursive: true });
// Every kind the game serves FROM DRAWINGS, the n-th served chance of it that passes its kind's rules
// (baseScenario.ts scenarioFaults). Never a raw build (Harry, 12 Oct 2026: a "one-on-one" still with a
// defender between the ball and the goal: "NOT a one on one which u should know by reading a scenarios rules").
const PICK: [string, number, string][] = SERVED_KINDS.map((k) => [k, 1, k.replace(/_/g, " ")] as [string, number, string]);

function svgFor(f: Frame2D, c: Served): string {
  const P = (x: number, y: number) => { const s = pitchTo2dScreen(f, { x, y }); return `${s.X.toFixed(1)},${s.Y.toFixed(1)}`; };
  const line = (pts: [number, number][]) => `<polyline points="${pts.map(([x, y]) => P(x, y)).join(" ")}" fill="none" stroke="#fff" stroke-width="2" stroke-opacity=".85"/>`;
  const seg = (a: [number, number], b: [number, number], n = 12) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n] as [number, number]);
  const circ = (cx: number, cy: number, r: number, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: 41 }, (_, i) => { const a = a0 + (a1 - a0) * i / 40; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number]; });
  const L: string[] = [];
  L.push(line([...seg([0, 0], [68, 0]), ...seg([68, 0], [68, 105]), ...seg([68, 105], [0, 105]), ...seg([0, 105], [0, 0])]));
  L.push(line([[13.84, 0], [13.84, 16.5], [54.16, 16.5], [54.16, 0]]), line([[24.84, 0], [24.84, 5.5], [43.16, 5.5], [43.16, 0]]));
  L.push(line(seg([0, 52.5], [68, 52.5])), line(circ(34, 52.5, 9.15)), line(circ(34, 11, 9.15, 0.93, Math.PI - 0.93)));
  // the goal: posts and bar, height drawn up the screen at true scale (the 2D's own rule)
  const v = f.viewport, turned = f.facing !== "up";
  const unit = turned ? f.H / (v.x2 - v.x1) : f.W / (v.x2 - v.x1);
  const tiltK = f.tilt ? f.tilt.s * f.tilt.cos : 1;
  const up = (m: number) => m * unit * tiltK;
  const pl = pitchTo2dScreen(f, { x: 30.34, y: 0 }), pr = pitchTo2dScreen(f, { x: 37.66, y: 0 });
  L.push(`<path d="M${pl.X},${pl.Y} L${pl.X},${pl.Y - up(2.44)} L${pr.X},${pr.Y - up(2.44)} L${pr.X},${pr.Y}" fill="none" stroke="#fff" stroke-width="3"/>`);
  const man = (x: number, y: number, col: string) => { const s = pitchTo2dScreen(f, { x, y }); const h = up(1.847); return `<rect x="${s.X - h * 0.16}" y="${s.Y - h}" width="${h * 0.32}" height="${h}" rx="${h * 0.16}" fill="${col}" stroke="#000" stroke-width="1"/>`; };
  for (const g of c.figs) L.push(man(g.x, g.y, g.sid === "you" ? "#fde047" : g.team === "us" ? "#ef4444" : "#3b82f6"));
  if (c.keeper.drawn) L.push(man(c.keeper.x, c.keeper.y, "#22c55e"));
  const b = pitchTo2dScreen(f, c.sc.ball);
  L.push(`<circle cx="${b.X}" cy="${b.Y}" r="5" fill="#fff" stroke="#000"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f.W}" height="${f.H}" viewBox="0 0 ${f.W} ${f.H}"><rect width="100%" height="100%" fill="#2f7d32"/>${L.join("")}</svg>`;
}

// --kinds=one_on_one:1,buildup:2 : these chances instead of PICK
{
  const k = process.argv.find((x) => x.startsWith("--kinds="));
  if (k) PICK.splice(0, PICK.length, ...k.slice(8).split(",").map((t) => { const [kind, sd] = t.split(":"); return [kind, Number(sd) || 1, kind.replace(/_/g, " ")] as [string, number, string]; }));
}
// --phases: also the run-up (penalty, free kick) and the strike screen (every kind), for the set-piece stills
const phases = process.argv.includes("--phases");
const list: unknown[] = [];
for (const [kind, nth, kindLabel] of PICK) {
  const c = cleanServed(kind, nth)[nth - 1];
  if (!c || !c.drawn) { console.log(`skip ${kind}: ${!c ? "no served chance passes its rules" : "not served from drawings"}`); continue; }
  const seed = c.seed;
  const label = `${kindLabel} · rules: ok · served seed ${seed}`;
  const f = c.f;
  // the stance CanvasMatch gives a penalty / free kick taker (loadScenario: standBackFor; the picture: drawnTakerAt)
  let standAt: { x: number; y: number } | null = null;
  if (hasRunup(kind)) {
    const id = kind === "penalty" ? DEFAULT_PENALTY_RUNUP : DEFAULT_FREE_KICK_RUNUP;
    const p = standBackFor(id, c.sc.ball, c.sc.player, f.viewport);
    standAt = p;
    const at = drawnTakerAt(c.sc.ball, p, 1).at;
    const you = c.figs.find((g) => g.sid === "you");
    if (you) { you.x = at.x; you.y = at.y; }
  }
  const fig = (sid: string, x: number, y: number, team: "us" | "them") => ({ sid, x, y, team, shirt: team === "us" ? "#c8102e" : "#1d4ed8", shorts: "#ffffff", kick: false, kickFoot: 1, drawn: sid !== "you" || SET_PIECE_KINDS.has(kind) });
  const frame = {
    t: 0, phase: "aim", kind,
    cam: { viewport: f.viewport, facing: f.facing, tilt: f.tilt, W: f.W, H: f.H },
    ball: { x: c.sc.ball.x, y: c.sc.ball.y, z: 0.11, vx: 0, vy: 0, vz: 0, live: true, inNet: false }, landing: null,
    keeper: { x: c.keeper.x, y: c.keeper.y, dive: 0, saveLunge: 0, saveDir: 0, saveKind: null, idleT: 0, shirt: "#16a34a", shorts: "#111111", drawn: c.keeper.drawn },
    figures: c.figs.map((g) => fig(g.sid, g.x, g.y, g.team)), aim: null, ring: { x: c.sc.ball.x, y: c.sc.ball.y }, goalSide: null, goalInView: c.gv, orders: null,
  };
  const name = `${kind}-${seed}`;
  fs.writeFileSync(`${out}/raw/2d-${name}.svg`, svgFor(f, c));
  list.push({ name, label, frame });
  if (phases) {
    const runS = hasRunup(kind) ? RUNUP_MOTION[kind === "penalty" ? DEFAULT_PENALTY_RUNUP : DEFAULT_FREE_KICK_RUNUP].runS : 0;
    if (hasRunup(kind) && standAt) {
      const id = kind === "penalty" ? DEFAULT_PENALTY_RUNUP : DEFAULT_FREE_KICK_RUNUP;
      const at = drawnTakerAt(c.sc.ball, runupPositionAt(planRunup(id, c.sc.ball, standAt), runS - 0.6), 1).at;
      const figures = frame.figures.map((g) => (g.sid === "you" ? { ...g, x: at.x, y: at.y } : g));
      list.push({ name: `${name}-runup`, label: `${label}, run-up (0.6 s before the plant)`, frame: { ...frame, figures, phase: "runup", runup: { t: runS - 0.6, runS } } });
    }
    // the strike screen: a penalty / free kick taker is where the 2D's run-up ends (beside the ball)
    const plantAt = hasRunup(kind) && standAt ? drawnTakerAt(c.sc.ball, plantBeside(c.sc.ball, standAt), 1).at : null;
    const cfig = plantAt ? frame.figures.map((g) => (g.sid === "you" ? { ...g, x: plantAt.x, y: plantAt.y } : g)) : frame.figures;
    list.push({ name: `${name}-contact`, label: `${label}, strike screen up`, frame: { ...frame, figures: cfig, phase: "contact" } });
  }
}
fs.writeFileSync(`${out}/raw/chances.json`, JSON.stringify(list));
console.log(`${list.length} chances → ${out}`);
