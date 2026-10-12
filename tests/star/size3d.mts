/**
 * SIZES ARE ABSOLUTE; THE CAMERA ONLY MOVES (lib/star/style3d/size3d.ts).
 *
 * Harry, 12 Oct 2026: "Why can't the players just have a measurement on their
 * own? Why is it 4% of the screen? … why aren't they just a set size?"
 *
 * Fails if any man's, the keeper's, the ball's or the goal's scale on a 3D
 * screen depends on the camera, the screen, the camera setting, an address-bar
 * flag or the chance:
 *   1. SIZE3D is real size (1) for all four.
 *   2. matchScale() (the scale the set-piece camera frames around) is SIZE3D,
 *      whatever the address bar says (?mscale=, ?fig=, ?man= no longer pick a size).
 *   3. Every camera solve (the 2D-frame camera, the set-piece camera, the
 *      broadcast camera) over every chance kind × seeds, in both facings and on
 *      two phone sizes, leaves that scale alone — and the 3D view's own size
 *      functions (read from its source) return SIZE3D and nothing else.
 *   4. The source: every `.scale.setScalar(...)` on a man's, the keeper's or the
 *      ball's root in engineView.ts takes figNow() / keeperFig() / SIZE3D, those
 *      two read SIZE3D only, and nothing in the 3D size path names the camera,
 *      pixels, field of view, framing or a test flag. Same for the style page's
 *      Free Roam (gameplay.ts) and the anim test page (animGrid3d.ts).
 * The harness stills (scratchpad, 12 Oct 2026) also measured each root in the
 * real view: 1.000 for men and keeper in every chance and every camera.
 */
import fs from "node:fs";
import { SIZE3D, MAN_HEIGHT_M } from "../../lib/star/style3d/size3d";
import { SCENARIO_KINDS } from "../../lib/star/canvasEngine";
import { solveMatch2D, matchScale, MATCH2D, usesSetPieceCam, solveSetPieceCam, setPieceKeep, MATCH_SCALE_PICK } from "../../lib/star/style3d/match2dCam";
import { solveBroadcast, actionPoints } from "../../lib/star/style3d/broadcastCam";
import { chanceFor } from "./match2dCam.mts";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error("  ✗ " + m); } else console.log("  ✓ " + m); };
const src = (p: string) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// 1. the numbers
ok(SIZE3D.man === 1 && SIZE3D.keeper === 1 && SIZE3D.ball === 1 && SIZE3D.goal === 1, `men, keeper, ball and goal are real size (${JSON.stringify(SIZE3D)})`);
ok(Object.isFrozen(SIZE3D), "SIZE3D cannot be changed at run time");
ok(MAN_HEIGHT_M === 1.8, `a man at scale 1 is ${MAN_HEIGHT_M} m`);

// 2. no address-bar flag picks a size
const g = globalThis as unknown as { window?: unknown };
const had = g.window;
const sizes: string[] = [];
for (const q of ["", "?mscale=B", "?mscale=current", "?fig=2", "?man=0.12", "?cam2d=0", "?bcam=0&animfix=0"]) {
  g.window = { location: { search: q } };
  const s = matchScale();
  sizes.push(`${s.man}/${s.keeper}/${s.goal}`);
}
g.window = had;
ok(sizes.every((s) => s === `${SIZE3D.man}/${SIZE3D.keeper}/${SIZE3D.goal}`), `matchScale() is SIZE3D under every test flag (${[...new Set(sizes)].join(", ")})`);
ok(MATCH_SCALE_PICK === "A", "the pick is A (real size)");

// 3. camera solves across kinds, seeds and phones never move the size
let solves = 0, moved = 0;
for (const kind of SCENARIO_KINDS) for (let seed = 1; seed <= 4; seed++) {
  const c = chanceFor(kind, seed);
  for (const [W, H] of [[372, 704], [320, 520]] as [number, number][]) {
    const f = { ...c.f, W, H };
    const before = JSON.stringify(matchScale());
    const m = solveMatch2D(f, MATCH2D);
    const b = solveBroadcast({ anchor: c.sc.ball, points: actionPoints({ x: c.sc.ball.x, y: c.sc.ball.y }, c.figs, c.keeper, c.gv), facing: f.facing, W, H });
    if (usesSetPieceCam(kind)) solveSetPieceCam(f, setPieceKeep(c.sc.ball, c.figs, { x: c.keeper.x, y: c.keeper.y }, matchScale()), c.sc.ball, matchScale());
    solves += 2;
    if (JSON.stringify(matchScale()) !== before || !(m.D > 0) || !(b.D > 0)) moved++;
  }
}
ok(solves > 100 && moved === 0, `${solves} camera solves (every kind × 4 seeds × 2 phones, 2D-frame + broadcast + set-piece): the size never moved (${moved})`);

// 4. the source: the view's size path reads SIZE3D and nothing else
const ev = src("lib/star/style3d/engineView.ts");
const fn = (name: string) => { const m = ev.match(new RegExp(`const ${name} = \\(\\): number => ([^;]+);`)); return m ? m[1].trim() : ""; };
ok(fn("figNow") === "SIZE3D.man", `figNow() is SIZE3D.man (${fn("figNow") || "not found"})`);
ok(fn("keeperFig") === "SIZE3D.keeper", `keeperFig() is SIZE3D.keeper (${fn("keeperFig") || "not found"})`);
const rootScales = [...ev.matchAll(/(\w+(?:\.\w+)*)\.root\.scale\.setScalar\(([^)]*\)?)\)/g)].map((m) => m[2]);
const allowed = /^(figNow\(\)|keeperFig\(\)|SIZE3D\.\w+|1|sc|fs)$/;
const badRoot = rootScales.filter((a) => !allowed.test(a.trim()));
ok(rootScales.length >= 2 && badRoot.length === 0, `every root.scale.setScalar in engineView takes the one size (${rootScales.length} found${badRoot.length ? `; bad: ${badRoot.join(" | ")}` : ""})`);
ok(/const bs = SIZE3D\.ball;/.test(ev), "the ball is SIZE3D.ball with every camera");
// banned: anything that could turn a camera or screen number into a size
const banned = [/\btvFig\b/, /\bFIG_NEW\b/, /\bTARGET_PX\b/, /\bpxPerM\b/, /\bTV_FIG_FIXED\b/, /\bKEEPER_SHARE\b/, /\bfigScale\b/, /setFigureScale/, /\bbc\.k\b/, /\bm2\.k\b/, /get\("fig"\)/, /get\("man"\)/, /ENGINE_VIEW_FIG_SCALE/, /def\.ballScale/];
const hits = banned.filter((r) => r.test(ev)).map(String);
ok(hits.length === 0, `no camera-, pixel- or flag-based size left in engineView (${hits.join(", ") || "none"})`);
const sizeLines = ev.split("\n").filter((l) => /SIZE3D\./.test(l));
const coupled = sizeLines.filter((l) => /(SIZE3D\.\w+\s*[*/]|[*/]\s*SIZE3D)/.test(l) && /(fov|camera|\.D\b|pxPer|innerHeight|clientHeight|\bW\b|\bH\b|manShare|elev)/.test(l));
ok(coupled.length === 0, `SIZE3D is never mixed with a camera or screen number (${coupled.length})`);
// ONE camera (Harry, 12 Oct 2026: no New | Old for decided things): no other camera path to size for
const otherCams = [/placeTvCamera/, /placeBroadcast/, /placeExactCamera/, /realCameraLook/, /get\("cam2d"\)/, /get\("bcam"\)/].filter((r) => r.test(ev)).map(String);
ok(otherCams.length === 0, `one 3D camera (the 2D's frame + set pieces): no Old, broadcast or exact camera, no ?cam2d / ?bcam (${otherCams.join(", ") || "none"})`);
ok(!/camera3d/.test(src("lib/star/lookRows.ts")) && !/camera3d/.test(src("components/star/DeviceSettings.tsx")), "no \"3D camera: New | Old\" row in Settings");
const m2c = src("lib/star/style3d/match2dCam.ts");
ok(!/get\("mscale"\)/.test(m2c), "?mscale= no longer read");

// other 3D screens on the same rule
const gp = src("lib/star/style3d/gameplay.ts");
ok(/const FIG_SCALE = SIZE3D\.man;/.test(gp) && !/H_FIG_SCALE/.test(gp) && /ball\.scale\.setScalar\(SIZE3D\.ball\)/.test(gp), "Style page Free Roam (gameplay.ts): men and ball real size");
const ag = src("lib/star/style3d/animGrid3d.ts");
ok(/const FIG = SIZE3D\.man;/.test(ag), "anim test page (animGrid3d.ts): men real size, its camera placed for them");
const p3 = src("lib/star/play3d/scene.ts");
ok(!/\.root\.scale\.setScalar/.test(p3), "drills (play3d/scene.ts): men never rescaled (real size)");

if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\nall passed");
