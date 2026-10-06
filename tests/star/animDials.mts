/**
 * THE ANIMATION DIALS AND SWITCHES (lib/star/animDials.ts, Leo 6 Oct 2026).
 *
 *  1. Stored values are made safe: clamped, broken ones back to default.
 *  2. They persist on this phone and come back.
 *  3. With the first version's dials the live pose functions draw EXACTLY
 *     the first version's numbers (a frozen copy in fixtures/).
 *  4. A family switched off draws exactly what the Old game draws, and the
 *     figure code with the new pose fields left out is untouched.
 *  5. The bigger look really is bigger, and still ends inside its window.
 */
import {
  sanitizeAnimSettings, setAnimSettings, animSettings, resetAnimSettings, _forgetAnimSettings,
  exportAnimSettings, importAnimSettings, setAnimDial, setAnimFamily,
  DEFAULT_ANIM_DIALS, FIRST_VERSION_DIALS, DIAL_INFO, DIAL_KEYS, ANIM_FAMILIES,
} from "../../lib/star/animDials";
import {
  outfieldAnimFrame, keeperAnimFrame, keeperLeanWithAnim, animFromAction, animDuration, STRIKE_S,
} from "../../lib/star/actionAnim";
import type { BallAction } from "../../lib/star/canvasEngine";
import { oneFootKickFeet } from "../../lib/star/figure3d";
import { feetFor } from "../../lib/star/fiveASide/render";
import { firstOutfieldAnimFrame, firstKeeperAnimFrame, firstKeeperLean } from "./fixtures/actionAnimFirstVersion";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// A stand-in for the browser's storage.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage;

// ── 1. Clamping and defaults ──
{
  const s = sanitizeAnimSettings(null);
  check(JSON.stringify(s.dials) === JSON.stringify(DEFAULT_ANIM_DIALS), "nothing stored is not the defaults");
  check(ANIM_FAMILIES.every((f) => s.on[f.id]), "a family is off by default");
  const wild = sanitizeAnimSettings({ dials: { strikeSwing: 99, exaggeration: -5, plantBend: "x", parry: NaN }, on: { shots: false, touch: "no" } });
  check(wild.dials.strikeSwing === DIAL_INFO.strikeSwing.max, "a huge dial is not clamped to its max");
  check(wild.dials.exaggeration === DIAL_INFO.exaggeration.min, "a negative dial is not clamped to its min");
  check(wild.dials.plantBend === DEFAULT_ANIM_DIALS.plantBend && wild.dials.parry === DEFAULT_ANIM_DIALS.parry, "a broken dial does not go back to its default");
  check(wild.on.shots === false && wild.on.touch === true, "switches are not read safely");
  for (const k of DIAL_KEYS) {
    const i = DIAL_INFO[k];
    check(DEFAULT_ANIM_DIALS[k] >= i.min && DEFAULT_ANIM_DIALS[k] <= i.max, `default ${k} outside its slider`);
    check(FIRST_VERSION_DIALS[k] >= i.min && FIRST_VERSION_DIALS[k] <= i.max, `first-version ${k} outside its slider`);
  }
}

// ── 2. Persisting ──
{
  resetAnimSettings();
  setAnimDial("strikeSwing", 2.1);
  setAnimFamily("headers", false);
  _forgetAnimSettings();
  const back = animSettings();
  check(back.dials.strikeSwing === 2.1 && back.on.headers === false, "dials and switches do not come back from storage");
  const text = exportAnimSettings();
  resetAnimSettings();
  check(animSettings().dials.strikeSwing === DEFAULT_ANIM_DIALS.strikeSwing, "Reset does not reset");
  check(importAnimSettings(text)?.dials.strikeSwing === 2.1, "Copy → Paste does not round-trip");
  check(importAnimSettings("hello") === null && importAnimSettings("{}") === null, "junk pasted is applied");
  store.set("star-anim-dials", "{not json");
  _forgetAnimSettings();
  check(animSettings().dials.strikeSwing === DEFAULT_ANIM_DIALS.strikeSwing, "broken storage is not the defaults");
  resetAnimSettings();
  setAnimSettings({ dials: DEFAULT_ANIM_DIALS, on: Object.fromEntries(ANIM_FAMILIES.map((f) => [f.id, true])) as never });
}

// ── 3. First-version dials = the first version, number for number ──
const scene = {};
const MODES: [BallAction["kind"], BallAction["mode"], number][] = [
  ["touch", "ground", 0], ["touch", "volley", 0.7], ["touch", "header", 1.3],
  ["shot", "ground", 0], ["shot", "curl", 0], ["shot", "volley", 0.7], ["shot", "chip", 0], ["shot", "header", 2],
  ["pass", "ground", 0], ["pass", "header", 2], ["clearance", "ground", 0], ["clearance", "header", 2], ["block", "ground", 0],
];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let compared = 0;
for (const [kind, mode, z] of MODES) {
  const a = animFromAction({ kind, mode, actor: "run0", seq: 1, t: 0, at: { x: 0, y: 0, z } }, 0, scene);
  const d = animDuration(a);
  for (const foot of [1, -1]) {
    for (let i = -2; i <= 62; i++) {
      const e = (i / 60) * d;
      const live = outfieldAnimFrame(a, e, foot, FIRST_VERSION_DIALS);
      const old = firstOutfieldAnimFrame(a, e, foot);
      compared++;
      if (!old || !live) { check(!old && !live, `${kind}/${mode} at ${e.toFixed(3)}: one draws, the other not`); continue; }
      const strip = (p: Record<string, unknown>) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
      check(same(strip(live.pose), strip(old.pose)) && live.liftR === old.liftR && live.lean === old.lean && live.kickClipU === old.kickClipU,
        `${kind}/${mode} foot ${foot} at ${e.toFixed(3)}: first-version dials draw ${JSON.stringify(live.pose)} lean ${live.lean}, first version drew ${JSON.stringify(old.pose)} lean ${old.lean}`);
      check(live.flash === 0, `${kind}/${mode}: a flash with the first version's dials`);
    }
  }
}
for (const [save, z, high] of [["catch", 1, false], ["push", 2.2, true], ["parry", 0.4, false], ["fumble", 0.8, false], ["beaten", 2.3, false]] as const) {
  const a = animFromAction({ kind: "save", save, actor: "keeper", seq: 1, t: 0, at: { x: 0, y: 0, z } }, 0, scene);
  for (let i = 0; i <= 100; i++) {
    const e = i * 0.02;
    const live = keeperAnimFrame(a, e, high, FIRST_VERSION_DIALS);
    const old = firstKeeperAnimFrame(a, e, high);
    compared++;
    const { flashSize, ...rest } = live;
    check(same(rest, old) && flashSize === 1, `keeper ${save} at ${e}: ${JSON.stringify(live)} vs ${JSON.stringify(old)}`);
    for (const lr of [-1.6, -0.7, 0, 0.5, 1.4]) {
      check(keeperLeanWithAnim(lr, live, FIRST_VERSION_DIALS.oneHandLean) === firstKeeperLean(lr, old), `keeper ${save} lean ${lr} at ${e} differs`);
    }
  }
}

// ── 4. Off = Old ──
// No animation: the keeper's lean is exactly what it was.
for (const lr of [-1.75, -0.3, 0, 0.9, 1.75]) check(keeperLeanWithAnim(lr, null, 1.15) === lr, `no animation changes the keeper's lean ${lr}`);
// The figure code without the new pose fields is exactly the old figure.
for (const kick of [0.1, 0.5, 1]) for (const kf of [1, -1]) {
  const r = 40;
  check(same(oneFootKickFeet(r, 0.26, kick, kf), oneFootKickFeet(r, 0.26, kick, kf, 1, 0, 0)), "the new kick-feet defaults move a foot");
  const base = { kick, kickFoot: kf, armSpread: 0.3 };
  check(same(feetFor(r, base), feetFor(r, { ...base, swingAmp: 1, swingCross: 0, plantBend: 0 })), "feetFor with the new fields at rest moves a foot");
}
// (The family switch itself: the match and the gallery both return no
// animation for a family that is off, so the man is drawn with his Old pose.
// That decision is one line in each — CanvasMatch's animOf and
// animGallery's isNew — and is checked by eye on the test page.)

// ── 5. Bigger, and still inside the window ──
{
  const shot = animFromAction({ kind: "shot", mode: "ground", actor: "run0", seq: 1, t: 0, at: { x: 0, y: 0, z: 0 } }, 0, scene);
  const r = 40;
  // How far the striking boot travels, and the leg's widest angle off vertical.
  const travel = (D: typeof DEFAULT_ANIM_DIALS) => {
    let path = 0, ang = 0; let prev: { rx: number; ry: number } | null = null;
    for (let i = 0; i <= 60; i++) {
      const f = outfieldAnimFrame(shot, (i / 60) * STRIKE_S, 1, D)!;
      const ft = feetFor(r, f.pose);
      if (prev) path += Math.hypot(ft.rx - prev.rx, ft.ry - prev.ry);
      prev = ft;
      ang = Math.max(ang, Math.atan2(Math.abs(ft.rx - 0.16 * r), -0.34 * r * -1 + ft.ry) * 180 / Math.PI);
    }
    return { path, ang };
  };
  const o = travel(FIRST_VERSION_DIALS), n = travel(DEFAULT_ANIM_DIALS);
  check(n.path > o.path * 1.5, `the driven shot's boot travel grew only ${o.path.toFixed(1)} → ${n.path.toFixed(1)}`);
  console.log(`driven shot (r=40): boot travel ${o.path.toFixed(1)} → ${n.path.toFixed(1)} px; widest leg angle ${o.ang.toFixed(0)}° → ${n.ang.toFixed(0)}°`);
  // Exaggeration 0 = standing still; the window is the same at any setting.
  const flat = outfieldAnimFrame(shot, STRIKE_S * 0.3, 1, { ...DEFAULT_ANIM_DIALS, exaggeration: 0 })!;
  check(flat.pose.kick === 0 && flat.lean === 0 && flat.liftR === 0, "exaggeration 0 still moves him");
  check(outfieldAnimFrame(shot, STRIKE_S + 0.01, 1, { ...DEFAULT_ANIM_DIALS, exaggeration: 2, strikeSwing: 2.5 }) === null, "big dials make the strike last longer");
  const fl = outfieldAnimFrame(shot, 0, 1, DEFAULT_ANIM_DIALS)!;
  check(fl.flash === 1 && fl.dust, "no flash and dust at the boot of a ground shot");
  // Mirrors still mirror.
  for (const [kind, mode, z] of MODES) {
    const a = animFromAction({ kind, mode, actor: "run0", seq: 1, t: 0, at: { x: 0, y: 0, z } }, 0, scene);
    const d = animDuration(a);
    const rr = outfieldAnimFrame(a, d * 0.3, 1)!, ll = outfieldAnimFrame(a, d * 0.3, -1)!;
    check(Math.abs(rr.lean + ll.lean) < 1e-9, `${kind}/${mode}: left and right lean are not mirrors`);
  }
}

console.log(`compared ${compared} first-version frames`);
if (problems.length) {
  console.error(`FAIL — ${problems.length} problem(s):\n  ` + problems.slice(0, 20).join("\n  "));
  process.exit(1);
}
console.log("PASS — dials clamp, persist and round-trip; the first version's dials draw the first version exactly; at rest the figure is unchanged");
