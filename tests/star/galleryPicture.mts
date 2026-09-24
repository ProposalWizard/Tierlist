/**
 * tests/star/galleryPicture.mts — the gallery / highlights PICTURE is the
 * chance Play will show: same turn, same size, same kits, same drag feel.
 *
 * Three asks from Harry (24 Sep 2026):
 *   1. "Match corners to play" — a corner / byline cross is watched from the
 *      side in the game (CanvasMatch's `toPx`); the picture now turns too.
 *   2. "Make the image bigger" — a bigger picture and Play, with the drag
 *      read against the real match's canvas so the feel does not change.
 *   3. "The picture draws the real kits too" — the kits CanvasMatch will pick.
 */
import { buildScenario, SCENARIO_KINDS, dragForFullPower, VIEW_ASPECT, type ScenarioKind, type Vec2 } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { frameFromScenario, frameFacing, frameScreen, frameCssSize, lookInKit, type Frame } from "@/lib/star/scenarioFrame";
import { applyOverride } from "@/lib/star/scenarioEdit";
import {
  testPlayWidth, realMatchWidth, realMatchHeight, testMatchKits, buildTestCareer, TEST_PLAY_MAX_W,
} from "@/lib/star/engineProfile";
import { DEFAULT_PLAY_SETTINGS } from "@/lib/star/playArea";
import { kitsFor } from "@/lib/star/kits";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

/** CanvasMatch's own `toPx`, copied here ONLY to check the picture against
 *  it — in CSS pixels rather than device pixels (the dpr cancels). */
function matchToPx(f: Frame, W: number, H: number, v: Vec2): { x: number; y: number } {
  const vp = f.camera;
  const fx = (v.x - vp.x1) / (vp.x2 - vp.x1);
  const fy = (v.y - vp.y1) / (vp.y2 - vp.y1);
  if (f.facing === "right") return { x: (1 - fy) * W, y: fx * H };
  if (f.facing === "left") return { x: fy * W, y: (1 - fx) * H };
  return { x: fx * W, y: fy * H };
}

// ── 1. The turn ──────────────────────────────────────────────────────────
console.log("\nCORNERS AND BYLINE CROSSES ARE TURNED LIKE PLAY");
const W = 366;
let turned = 0, portrait = 0, samePx = 0, roundTrip = 0, n = 0, upright = 0, nUp = 0;
for (const kind of SCENARIO_KINDS as readonly ScenarioKind[]) {
  for (let s = 0; s < 20; s++) {
    const sc = buildScenario(kind, mulberry32(9_000 + s * 31 + kind.length));
    const f = frameFromScenario(sc);
    const size = frameCssSize(f, { baseW: W, maxW: W, maxH: 4000 });
    const scr = frameScreen(f, size.cssW, size.cssH);
    const wide = kind === "corner" || kind === "byline_cross";
    if (wide) {
      n++;
      if (frameFacing(f) !== "up") turned++;
      if (Math.abs(size.cssH / size.cssW - 1 / VIEW_ASPECT) < 0.01 && size.cssW === W) portrait++;
      let same = true, back = true;
      for (const v of [...f.items.map((it) => it.at), f.ball]) {
        const a = scr.toScreen(v), b = matchToPx(f, size.cssW, size.cssH, v);
        if (Math.abs(a.x - b.x) > 0.6 || Math.abs(a.y - b.y) > 0.6) same = false;
        const w = scr.toWorld(a.x, a.y);
        if (Math.abs(w.x - v.x) > 1e-6 || Math.abs(w.y - v.y) > 1e-6) back = false;
      }
      if (same) samePx++;
      if (back) roundTrip++;
    } else {
      nUp++;
      if (frameFacing(f) === "up") upright++;
    }
  }
}
ok(turned === n, `every corner / byline cross is turned (${turned}/${n})`);
ok(portrait === n, `…and drawn portrait 5:8 at the match's width (${portrait}/${n})`);
ok(samePx === n, `every figure and the ball on the same pixel as the match's toPx, within 0.6 px (${samePx}/${n})`);
ok(roundTrip === n, `a drag lands on the right pitch spot: toWorld(toScreen(v)) = v (${roundTrip}/${n})`);
ok(upright === nUp, `every other kind stays upright (${upright}/${nUp})`);

// A camera override (the camera picker) keeps the turn and the shape.
{
  const sc = buildScenario("corner", mulberry32(4242));
  const f = frameFromScenario(sc);
  const c = f.camera;
  const moved = applyOverride(f, { items: {}, camera: { x1: c.x1 - 3, x2: c.x2 - 3, y1: c.y1 + 2, y2: c.y2 + 2 } });
  ok(frameFacing(moved) === frameFacing(f) && frameFacing(f) !== "up", "a camera picked on the whole pitch keeps the corner turned");
}
// Mutation check: an un-turned mapping would NOT match the match's pixels.
{
  const sc = buildScenario("corner", mulberry32(77));
  const f = frameFromScenario(sc);
  const size = frameCssSize({ ...f, facing: "up" }, { baseW: W, maxW: W, maxH: 4000 });
  const flat = frameScreen({ ...f, facing: "up" }, size.cssW, size.cssH);
  const a = flat.toScreen(f.ball), b = matchToPx(f, size.cssW, size.cssH, f.ball);
  ok(Math.hypot(a.x - b.x, a.y - b.y) > 20, `the old flat picture really was somewhere else (ball ${Math.hypot(a.x - b.x, a.y - b.y).toFixed(0)} px off)`);
}

// ── 2. Size and drag feel ─────────────────────────────────────────────────
console.log("\nBIGGER PICTURE, SAME KICK");
ok(testPlayWidth(390, 844) === realMatchWidth(390), `phone 390×844: picture = real match ${realMatchWidth(390)} px (full width)`);
const lap = testPlayWidth(1280, 900);
ok(lap > realMatchWidth(1280) && lap <= TEST_PLAY_MAX_W && lap / VIEW_ASPECT <= 900, `laptop 1280×900: ${lap} px wide, ${Math.round(lap / VIEW_ASPECT)} px tall (real match ${realMatchWidth(1280)})`);
ok(testPlayWidth(0, 0) === realMatchWidth(0), "unmeasured screen: the real match's default, never 0");
let never = true;
for (let vw = 200; vw <= 2600; vw += 37) for (let vh = 300; vh <= 1600; vh += 53) {
  const w = testPlayWidth(vw, vh);
  if (w < realMatchWidth(vw) || w > Math.max(realMatchWidth(vw), TEST_PLAY_MAX_W) || w > Math.max(realMatchWidth(vw), vw - 24)) never = false;
}
ok(never, "never smaller than the real match, never past 520, never wider than the screen");

/** CanvasMatch's `screenPull` → `powerFromDrag`, for a straight drag of
 *  `px` CSS pixels down the screen on a canvas `canvasW` wide. */
const power = (px: number, canvasW: number, refH: number | undefined, skill: number) => {
  const H = canvasW / VIEW_ASPECT;
  let pull = px / H;
  if (refH && refH > 0) pull *= H / refH;
  return Math.min(1, pull / dragForFullPower(skill));
};
const skill = DEFAULT_PLAY_SETTINGS.power;
const drag = 60;
const phone = power(drag, 366, undefined, skill);
const career = power(drag, realMatchWidth(1280), undefined, skill);
const big = power(drag, 480, undefined, skill);
const bigRef = power(drag, 480, realMatchHeight(1280), skill);
const phoneBig = power(drag, 480, realMatchHeight(390), skill);
console.log(`  a ${drag} px drag, power skill ${skill}:`);
console.log(`    career match on a phone (366 px):        ${(phone * 100).toFixed(1)}%`);
console.log(`    career match on a laptop (384 px):       ${(career * 100).toFixed(1)}%`);
console.log(`    480 px canvas, no reference:             ${(big * 100).toFixed(1)}%`);
console.log(`    480 px canvas, laptop reference (614 px): ${(bigRef * 100).toFixed(1)}%`);
console.log(`    480 px canvas, phone reference (586 px):  ${(phoneBig * 100).toFixed(1)}%`);
ok(Math.abs(bigRef - career) < 1e-9, "480 px with the prop kicks exactly like the laptop's real match");
ok(big < career - 0.05, "…and without it, 480 px would kick softer");

// ── 3. Kits ──────────────────────────────────────────────────────────────
console.log("\nTHE PICTURE WEARS PLAY'S KITS");
let same = 0, differ = 0, kn = 0;
for (let seed = 1; seed <= 25; seed++) {
  const k = testMatchKits(DEFAULT_PLAY_SETTINGS, seed);
  const b = buildTestCareer(DEFAULT_PLAY_SETTINGS, seed);
  if (!k || !b) continue;
  kn++;
  const { career: c, fixture: fx } = b;
  // CanvasMatch, lines around its kitsRef: exactly this call.
  const m = fx.home
    ? kitsFor(c.player.club, fx.opponent, c.clubKits?.[c.player.club], c.clubKits?.[fx.opponent])
    : kitsFor(fx.opponent, c.player.club, c.clubKits?.[fx.opponent], c.clubKits?.[c.player.club]);
  const home = fx.home !== false;
  const ours = home ? m.home : m.away, theirs = home ? m.away : m.home;
  if (k.ours.shirt === ours.shirt && k.theirs.shirt === theirs.shirt && k.keeper.shirt === m.keeper.shirt) same++;
  if (k.ours.shirt !== k.theirs.shirt) differ++;
}
ok(kn > 0 && same === kn, `same kits as the match for every seed (${same}/${kn})`);
ok(differ === kn, `your side and theirs never share a shirt (${differ}/${kn})`);
{
  const k = testMatchKits(DEFAULT_PLAY_SETTINGS, 1)!;
  const f = frameFromScenario(buildScenario("one_on_one", mulberry32(3)));
  const you = f.items.find((it) => it.side === "you")!;
  const gk = f.items.find((it) => it.keeper)!;
  const def = f.items.find((it) => it.side === "opponent" && !it.keeper)!;
  ok(lookInKit(you, k).shirt === k.ours.shirt && lookInKit(you, k).star === true && lookInKit(you, k).label === "YOU", "you: our shirt, and still the star and the YOU label");
  ok(lookInKit(gk, k).shirt === k.keeper.shirt, "their keeper: the keeper kit");
  ok(lookInKit(def, k).shirt === k.theirs.shirt && lookInKit(def, k).label === def.look.label, "a defender: their shirt, his label kept");
  ok(lookInKit(def, undefined) === def.look, "no kits: the diagram colours, unchanged");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
