/**
 * THE NEW 3D CLIPS (Leo, 7 Oct 2026; lib/star/sprite3dAnim.ts, atlas 1).
 *
 *  1. Every new clip is in index.json: player clips 8 facings, keeper 4, the
 *     frame counts the picker expects, every cell inside atlas 1. The keeper's
 *     left-side saves mirror a right-side clip with the same shape.
 *  2. The old clips are untouched: same names, no `atlas`/`mirrorOf`, cells
 *     inside atlas 0, and atlas-0 / mask-0 are the files they were.
 *  3. The picker only ever answers with a NEW clip (or null = keep the old
 *     one), the strike lands inside the action's window, and every frame it
 *     can ask for exists.
 *  4. With Animations: Old nothing reaches it: in the match the new clips are
 *     only picked from `animNow` (filled only by animOf, which returns before
 *     it with Old) and from `kAnim` (null with Old).
 */
import fs from "node:fs";
import path from "node:path";
import { NEW_PLAYER_CLIPS, NEW_KEEPER_CLIPS } from "../../lib/star/sprites";
import { NEW_CLIP_SHAPE, outfieldClipFor, outfieldSpriteClip, keeperDiveClipNew, keeperStandingClip, keeperGetUpT, sideOfDive } from "../../lib/star/sprite3dAnim";
import { animDuration } from "../../lib/star/actionAnim";
import type { BallActionKind, BallActionMode, SaveResult } from "../../lib/star/canvasEngine";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const dir = path.resolve("public/star/sprites");
type Clip = { fps: number; loop: string; dirs: number; frames: number; strikeFrame?: number; atlas?: number; mirrorOf?: string; cells?: number[][] };
const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as {
  atlas: { color: string; mask: string; w: number; h: number };
  atlases?: Record<string, { color: string; mask: string; w: number; h: number }>;
  chars: Record<"player" | "keeper", { clips: Record<string, Clip> }>;
};

// ── 1. The new clips ──
const a1 = idx.atlases?.["1"];
check(!!a1, "index.json has no atlas 1");
if (a1) {
  check(fs.existsSync(path.join(dir, a1.color)), `missing ${a1.color}`);
  check(fs.existsSync(path.join(dir, a1.mask)), `missing ${a1.mask}`);
}
const inside = (cells: number[][], w: number, h: number, name: string) => {
  for (const [x, y, cw, ch] of cells) if (x < 0 || y < 0 || x + cw > w || y + ch > h || cw < 1 || ch < 1) { problems.push(`${name}: a cell outside its atlas`); return; }
};
for (const [char, list, dirs] of [["player", NEW_PLAYER_CLIPS, 8], ["keeper", NEW_KEEPER_CLIPS, 4]] as const) {
  for (const name of list) {
    const c = idx.chars[char].clips[name];
    if (!c) { problems.push(`${char}.${name} missing from index.json`); continue; }
    check(c.dirs === dirs, `${char}.${name}: ${c.dirs} facings, want ${dirs}`);
    check(c.frames >= 3 && c.fps > 0, `${char}.${name}: ${c.frames} frames at ${c.fps} fps`);
    check(c.loop === "once", `${char}.${name}: loop ${c.loop}`);
    if (c.mirrorOf) {
      const s = idx.chars[char].clips[c.mirrorOf];
      check(!!s && !s.mirrorOf && !!s.cells, `${char}.${name} mirrors ${c.mirrorOf}, which has no cells`);
      check(!!s && s.dirs === c.dirs && s.frames === c.frames, `${char}.${name} and ${c.mirrorOf} differ in shape`);
      check(!c.cells, `${char}.${name} mirrors and has its own cells too`);
    } else {
      check(c.atlas === 1, `${char}.${name} is not in atlas 1`);
      check((c.cells?.length ?? 0) === c.dirs * c.frames, `${char}.${name}: ${c.cells?.length} cells, want ${c.dirs * c.frames}`);
      if (a1 && c.cells) inside(c.cells, a1.w, a1.h, `${char}.${name}`);
    }
    if (char === "player") {
      const sh = NEW_CLIP_SHAPE[name];
      check(!!sh && sh.frames === c.frames, `NEW_CLIP_SHAPE.${name} says ${sh?.frames} frames, index.json ${c.frames}`);
      check((sh?.strike ?? null) === (c.strikeFrame ?? null), `NEW_CLIP_SHAPE.${name} strike ${sh?.strike} vs index ${c.strikeFrame}`);
    }
  }
}

// ── 2. The old clips are as they were ──
const OLD = { player: ["idle", "jog", "sprint", "kick", "celebrate"], keeper: ["ready", "jog", "diveR", "diveL"] } as const;
const OLD_SHAPE: Record<string, [number, number]> = { idle: [8, 4], jog: [8, 8], sprint: [8, 8], kick: [8, 6], celebrate: [8, 6], ready: [4, 4], diveR: [4, 6], diveL: [4, 6] };
for (const char of ["player", "keeper"] as const) {
  for (const name of OLD[char]) {
    const c = idx.chars[char].clips[name];
    if (!c) { problems.push(`old ${char}.${name} is gone`); continue; }
    check(c.atlas === undefined && c.mirrorOf === undefined, `old ${char}.${name} was moved`);
    const want = char === "keeper" && name === "jog" ? [4, 8] : OLD_SHAPE[name];
    check(c.dirs === want[0] && c.frames === want[1], `old ${char}.${name} changed shape`);
    if (c.cells) inside(c.cells, idx.atlas.w, idx.atlas.h, `old ${char}.${name}`);
  }
  const extra = Object.keys(idx.chars[char].clips).filter((n) => !(OLD[char] as readonly string[]).includes(n) && !((char === "player" ? NEW_PLAYER_CLIPS : NEW_KEEPER_CLIPS) as readonly string[]).includes(n));
  check(extra.length === 0, `${char} has clips nobody knows: ${extra.join(", ")}`);
}
check(idx.atlas.color === "atlas-0.webp" && idx.atlas.mask === "mask-0.png" && idx.atlas.w === 1024 && idx.atlas.h === 1251, "atlas 0's entry changed");
check(fs.statSync(path.join(dir, "atlas-0.webp")).size === 589626, "atlas-0.webp changed");
check(fs.statSync(path.join(dir, "mask-0.png")).size === 342281, "mask-0.png changed");

// ── 3. The picker ──
const NEW = new Set<string>([...NEW_PLAYER_CLIPS, ...NEW_KEEPER_CLIPS]);
const fps = (c: string) => idx.chars.player.clips[c]?.fps ?? 0;
const kinds: BallActionKind[] = ["shot", "pass", "clearance", "block", "touch"];
const modes: (BallActionMode | undefined)[] = [undefined, "ground", "volley", "header", "chip", "curl"];
let asked = 0;
for (const kind of kinds) for (const mode of modes) {
  const a = { kind, mode };
  const clip = outfieldClipFor(a);
  check(!!clip && NEW.has(clip), `${kind}/${mode} → ${clip}, not a new clip`);
  const dur = animDuration(a);
  for (let i = 0; i <= 40; i++) {
    const e = i === 40 ? dur : (dur * i) / 40;
    const r = outfieldSpriteClip(a, e, fps);
    if (!r) { problems.push(`${kind}/${mode} at ${e.toFixed(2)}s: no clip inside its window`); continue; }
    const c = idx.chars.player.clips[r.clip];
    const f = Math.floor(r.t * c.fps);
    check(f >= 0 && f < c.frames, `${kind}/${mode} at ${e.toFixed(2)}s asks for frame ${f} of ${c.frames}`);
    // It starts at the strike (the engine writes a strike down as it happens).
    if (e === 0 && c.strikeFrame != null) check(f === c.strikeFrame - 1 || f === c.strikeFrame, `${kind}/${mode} starts at frame ${f}, strike is ${c.strikeFrame}`);
    asked++;
  }
  check(outfieldSpriteClip(a, dur + 0.05, fps) === null, `${kind}/${mode} still playing after its window`);
  check(outfieldSpriteClip(a, -0.01, fps) === null, `${kind}/${mode} playing before it started`);
}
check(outfieldClipFor({ kind: "save" }) === null, "a save is not an outfield clip");
// Shots, passes and the rest are told apart.
check(outfieldClipFor({ kind: "shot", mode: "volley" }) === "volley" && outfieldClipFor({ kind: "shot", mode: "chip" }) === "chipKick"
  && outfieldClipFor({ kind: "shot", mode: "curl" }) === "shotKick" && outfieldClipFor({ kind: "pass", mode: "ground" }) === "passKick"
  && outfieldClipFor({ kind: "pass", mode: "header" }) === "header" && outfieldClipFor({ kind: "clearance", mode: "ground" }) === "clearance", "outfield mapping");

const saves: (SaveResult | undefined)[] = [undefined, "catch", "parry", "fumble", "push", "beaten"];
for (const save of saves) for (const z of [0.1, 0.9, 1.3, 2.0]) for (const high of [false, true]) for (const side of ["R", "L"] as const) {
  const c = keeperDiveClipNew(save, z, high, side);
  check(c === null || (NEW.has(c) && c.endsWith(side)), `dive ${save}/${z}/${high}/${side} → ${c}`);
}
check(keeperDiveClipNew("beaten", 2.0, false, "R") === "oneHandR" && keeperDiveClipNew("push", 0.2, false, "L") === "lowDiveL"
  && keeperDiveClipNew("parry", 0.9, false, "R") === "parryR" && keeperDiveClipNew("catch", 1.2, false, "R") === null, "keeper dive mapping");
check(keeperStandingClip("catch") === "catchHold" && keeperStandingClip("fumble") === "fumble" && keeperStandingClip("parry") === null, "keeper standing mapping");
check(sideOfDive("diveL") === "L" && sideOfDive("lowDiveR") === "R" && sideOfDive("getUpL") === "L", "sideOfDive");
const gu = idx.chars.keeper.clips.getUpR;
for (let g = 0; g <= 1; g += 0.05) { const f = Math.floor(keeperGetUpT(g, gu.frames, gu.fps) * gu.fps); check(f >= 0 && f < gu.frames, `getUp ${g} → frame ${f}`); }

// ── 4. Old never reaches it ──
const src = fs.readFileSync(path.resolve("components/star/CanvasMatch.tsx"), "utf8");
const animOf = src.slice(src.indexOf("const animOf = "), src.indexOf("const animOf = ") + 1200);
check(animOf.indexOf("if (!animNew) return null;") >= 0 && animOf.indexOf("if (!animNew) return null;") < animOf.indexOf("animNow.set("), "animOf fills animNow before checking Animations: Old");
check((src.match(/animNow\.set\(/g) ?? []).length === 1, "something else fills animNow");
check(/const kAnim0 = ka && /.test(src) && /const ka = animNew \?/.test(src), "the keeper's kAnim no longer depends on Animations: New");
for (const fn of ["keeperDiveClipNew(", "keeperStandingClip(", "keeperGetUpT("]) {
  const i = src.indexOf(fn);
  const before = src.slice(Math.max(0, i - 400), i);
  check(i >= 0 && /kAnim/.test(before), `${fn} is reached without kAnim`);
}

console.log(`checked ${NEW.size} new clips and ${asked} picker frames`);
if (problems.length) {
  console.error(`FAIL — ${problems.length} problem(s):\n  ` + problems.slice(0, 30).join("\n  "));
  process.exit(1);
}
console.log("PASS — every new clip is in atlas 1 with the right facings and frames; old clips and atlas 0 untouched; the picker only gives new clips, inside each window; Old never reaches it");
