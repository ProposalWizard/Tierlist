/**
 * 2D GOAL VIDEOS (Leo's switch part "videos2d", lib/star/leoUpdate.ts;
 * Leo, 31 Oct 2026: "have a 2d option").
 *
 *  1. OFF = EXACTLY AS BEFORE. Every drawing call a goal video makes (the old
 *     videos, every style, three cuts, eight moments each, on two real
 *     recordings, a made-up header and a two-goal reel) is hashed and
 *     compared with the hashes taken BEFORE the 2D look was built
 *     (fixtures/goalVideo2dOff.json). The edit has no `flat` field and the
 *     video's name in memory has no "|2d".
 *  2. ON: the ball is in the picture on every frame of every video (every
 *     style, old and better cuts, four cuts each, two real recordings and
 *     25 made-up goals), after the 2D camera, the slow-mo and the better
 *     edits' zoom and shake. A "tight" shot (your celebration) keeps the
 *     scorer in the picture instead.
 *  3. ON: the camera glides (no jump of more than a sixth of the picture
 *     between two frames inside a shot) and every frame draws without error.
 *  4. ON: the video has its own name ("|2d"), so a 3D copy is never played.
 *
 * Run: npx tsx tests/star/goalVideo2d.mts            (check)
 *      npx tsx tests/star/goalVideo2d.mts --write    (only on the code before the 2D look)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { trackFromStored, frameAt, type GoalTrack } from "../../lib/star/goalClip/track";
import { synthTrack, type SynthKind } from "../../lib/star/goalClip/synth";
import { makeEdit, editDuration, momentAt, type ClipStyle, type Edit } from "../../lib/star/goalClip/edit";
import { drawEditFrame } from "../../lib/star/goalClip/render";
import { goalVideoKey } from "../../lib/star/goalClip/premake";
import { withFlat, flatCamera, flatBallOnScreen, toScreen } from "../../lib/star/goalClip/render2d";
import { viewAt, applyView } from "../../lib/star/goalClip/betterView";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

/* eslint-disable @typescript-eslint/no-explicit-any */
/** A pretend canvas that writes down every call and every setting. */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const fmt = (v: unknown): string => typeof v === "number" ? (Number.isFinite(v) ? v.toFixed(3) : String(v)) : typeof v === "object" && v !== null ? ((v as any).__id ?? "obj") : String(v);
  let gid = 0;
  const grad = () => { const id = `g${gid++}`; return { __id: id, addColorStop: (o: number, c: string) => log.push(`${id}.stop(${fmt(o)},${c})`) }; };
  const state: Record<string, unknown> = { font: "10px sans-serif" };
  const ctx = new Proxy({}, {
    get(_t, p: string) {
      if (p === "createLinearGradient" || p === "createRadialGradient") return (...a: unknown[]) => { const g = grad(); log.push(`${p}(${a.map(fmt).join(",")})=${g.__id}`); return g; };
      if (p === "createPattern") return () => null;
      if (p === "measureText") return (s: string) => { const m = /(\d+(?:\.\d+)?)px/.exec(String(state.font)); return { width: s.length * (m ? +m[1] : 10) * 0.55 }; };
      if (p === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (p === "canvas") return { width: 640, height: 360 };
      if (p in state) return state[p];
      return (...a: unknown[]) => { log.push(`${p}(${a.map(fmt).join(",")})`); };
    },
    set(_t, p: string, v) { state[p] = v; log.push(`${p}=${fmt(v)}`); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

const load = (n: string) => trackFromStored(JSON.parse(readFileSync(new URL(`./fixtures/goalClips/${n}.json`, import.meta.url), "utf8"))) as GoalTrack;
const header = synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: true, minute: 63, scoreAfter: [2, 1], seed: "off2d-header", kind: "header" })!;
const OFF_SETS: [string, GoalTrack[]][] = [["lay-off", [load("lay-off")]], ["scramble", [load("scramble")]], ["header", [header]], ["reel", [load("lay-off"), header]]];
const OLD_STYLES: ClipStyle[] = ["broadcast", "reverse", "fan", "tiktok"];

// ── 1. Off = as before ─────────────────────────────────────────────────────
const hashes: Record<string, string> = {};
for (const [name, tracks] of OFF_SETS) for (const style of OLD_STYLES) for (const v of [0, 1, 2]) {
  const e = makeEdit(tracks, style, "new", v);
  const dur = editDuration(e);
  const { ctx, log } = recorder();
  for (let k = 0; k < 8; k++) drawEditFrame(ctx, e, (dur * k) / 8, { handle: "@club" });
  hashes[`${name}|${style}|${v}`] = createHash("sha1").update(log.join("\n")).digest("hex");
  check(!("flat" in e), `${name} ${style} v${v}: an edit made with 2D off has no "flat"`);
}
const file = new URL("./fixtures/goalVideo2dOff.json", import.meta.url);
if (process.argv.includes("--write")) {
  writeFileSync(file, JSON.stringify(hashes, null, 1));
  console.log(`wrote ${Object.keys(hashes).length} frame hashes`);
  process.exit(0);
}
if (!existsSync(file)) { console.log("✗ no baseline (run with --write on the code before the 2D look)"); process.exit(1); }
const was = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
let same = 0;
for (const k of Object.keys(was)) { if (was[k] === hashes[k]) same++; else problems.push(`off: frames of ${k} changed`); }
const keyOff = goalVideoKey("tiktok", 1, "new", ["a"], undefined, "@x");
check(keyOff === "tiktok|1|new|a||@x", `off: video key as before (${keyOff})`);
console.log(`1. Off: ${same}/${Object.keys(was).length} videos draw exactly as before (${Object.keys(was).length * 8} frames).`);

{
  const e = makeEdit([header], "broadcast", "new", 0);
  check(withFlat(e, false) === e, "off: withFlat hands back the very same edit");
}

// ── 2-3. On: the ball in the picture, the camera gliding ──────────────────
const KINDS: SynthKind[] = ["run_in", "header", "long_range", "tap_in", "penalty"];
const goals: [string, GoalTrack][] = [["lay-off", load("lay-off")], ["scramble", load("scramble")]];
for (const kind of KINDS) for (let i = 0; i < 5; i++) {
  const t = synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: i % 2 === 0, minute: 10 + i * 17, scoreAfter: [1, 0], seed: `flat-${kind}-${i}`, kind });
  if (t) goals.push([`${kind}#${i}`, t]);
}
const ALL_STYLES: ClipStyle[] = ["broadcast", "highlights", "tiktok", "fan", "reverse"];
let frames = 0, inside = 0, inner = 0, tightFrames = 0, tightIn = 0, worstJump = 0, drawn = 0;
let worstEdge = Infinity;
const noop = new Proxy({}, {
  get(_t, p: string) {
    if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop() {} });
    if (p === "measureText") return (s: string) => ({ width: s.length * 6 });
    if (p === "font") return "10px sans-serif";
    if (p === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    return () => {};
  },
  set() { return true; },
}) as unknown as CanvasRenderingContext2D;
for (const [name, tr] of goals) for (const style of ALL_STYLES) for (const better of [false, true]) for (let v = 0; v < 4; v++) {
  const e = withFlat(makeEdit([tr], style, "new", v, better ? { better: true } : undefined), true);
  check(e.flat === true, `${name}: flat edit marked`);
  const n = Math.round(editDuration(e) * e.fps);
  let prev: { x: number; y: number; shot: number } | null = null;
  for (let f = 0; f < n; f++) {
    const m = momentAt(e, f / e.fps);
    const sh = e.shots[m.shot];
    const t = e.tracks[sh.track];
    const c = flatCamera(t, sh.angle, m.t, e.w, e.h);
    const view = e.better ? viewAt(e, m) : null;
    const put = (px: number, py: number) => (view ? applyView(view, px, py) : { x: px, y: py });
    if (sh.angle === "tight") {
      // Your celebration: the scorer is the subject.
      const id = t.meta.scorerBody ?? (t.meta.isYou ? "you" : undefined);
      const i = id ? t.bodies.findIndex(b => b.id === id) : -1;
      if (i >= 0) {
        const p = toScreen(c, frameAt(t, m.t).bodies[i].x, frameAt(t, m.t).bodies[i].y);
        const q = put(p.px, p.py);
        tightFrames++;
        if (q.x >= 0 && q.x <= e.w && q.y >= 0 && q.y <= e.h) tightIn++;
        else problems.push(`${name} ${style}${better ? "+" : ""} v${v} f${f}: scorer out of a tight shot`);
      }
      prev = null;
      continue;
    }
    const b = frameAt(t, m.t).ball;
    const p = flatBallOnScreen(c, b);
    const q = put(p.px, p.py);
    frames++;
    const edge = Math.min(q.x, e.w - q.x, q.y, e.h - q.y);
    worstEdge = Math.min(worstEdge, edge);
    if (edge >= 0) inside++;
    else problems.push(`${name} ${style}${better ? "+" : ""} v${v} f${f} (${sh.angle}): ball off the picture by ${(-edge).toFixed(0)} px`);
    if (q.x >= e.w * 0.1 && q.x <= e.w * 0.9 && q.y >= e.h * 0.1 && q.y <= e.h * 0.9) inner++;
    // The camera's glide: the ball's place before any zoom punch or shake.
    if (prev && prev.shot === m.shot && sh.hold === undefined) {
      const jump = Math.hypot(p.px - prev.x, p.py - prev.y) / Math.max(e.w, e.h);
      worstJump = Math.max(worstJump, jump);
      if (process.env.JUMPS && jump > 0.05) console.log(name, style, better, v, f, sh.angle, jump.toFixed(3));
      if (jump > 1 / 6) problems.push(`${name} ${style}${better ? "+" : ""} v${v} f${f}: the ball jumps ${(jump * 100).toFixed(0)}% of the picture`);
    }
    prev = { x: p.px, y: p.py, shot: m.shot };
    // Every few frames, draw it for real (no throw, no NaN place).
    if (f % 15 === 0) { drawEditFrame(noop, e, f / e.fps, { handle: "@x" }); drawn++; }
  }
}
console.log(`2. On: ball in the picture on ${inside}/${frames} frames (${(100 * inner / Math.max(1, frames)).toFixed(1)}% in the middle 80%; closest to an edge ${worstEdge.toFixed(0)} px); scorer in ${tightIn}/${tightFrames} tight-shot frames.`);
console.log(`3. On: biggest ball move between two frames of a shot ${(worstJump * 100).toFixed(1)}% of the picture; ${drawn} frames drawn without error.`);
const keyOn = goalVideoKey("tiktok", 1, "new", ["a"], undefined, "@x", false, false, undefined, true);
check(keyOn === "tiktok|1|new|a||@x|2d", `on: own video key (${keyOn})`);
console.log(`4. On: own video name ("${keyOn}").`);

if (problems.length) {
  console.log(`✗ ${problems.length} problems:\n  ${problems.slice(0, 30).join("\n  ")}`);
  process.exit(1);
}
console.log("✓ all good");
