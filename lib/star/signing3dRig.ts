/**
 * THE 3D SIGNING SCENE'S PEOPLE — clothes, face, accessories and posing,
 * built on the one rigged body (public/star/signing3d/people.glb, the CC0
 * Quaternius "Superhero_Male" with 65 bones).
 *
 * Harry, 2 Oct 2026: "Make the cutscene 3D live. Use a rig body, but if they
 * choose a skin tone, if they have a face picture, or if they have any
 * accessories, put that in there … do all of the movement stuff as well."
 *
 * Everything here works in the body's REST pose (a T-pose, metres, y up,
 * facing +z, his left at +x). Clothes are cut from the body itself:
 *
 *   - a copy of the body is smoothed (so the "superhero" muscles don't show:
 *     the cloth bridges the dips between them) and pushed out along the
 *     normals, then skinned to the same bones, so it moves with him;
 *   - where each garment starts and stops (hems, cuffs, a V-neck, a tie) is
 *     worked out per pixel from the rest position, so the edges are straight;
 *   - the skin under the cloth is taken out of the body, so it can never
 *     poke through.
 *
 * Each accessory is its own mesh. The ones that wrap the body (headband,
 * snood, sleeves, wrist tape, gloves, armband, boots) are cut from the body
 * the same way and skinned to the bones they sit on (head, neck, arm, wrist,
 * hand, foot); the sunglasses are a rigid model hung on the head bone. One
 * model fits every player because every player is this body.
 *
 * Posing is done on top of the animation clips each frame: a two-bone arm IK
 * that turns whole bones (so it works whatever way each bone's axes point),
 * a hand that can be set to any direction, finger curls, a spine lean and a
 * head turn. Pure maths on three.js objects; no React.
 */
import type * as THREE from "three";

type Three = typeof import("three");

// ── Rest-pose landmarks ─────────────────────────────────────────────────────

export interface Landmarks {
  neckY: number;
  headY: number;
  shoulderX: number;
  elbowX: number;
  wristX: number;
  armY: number;
  hipY: number;
  kneeY: number;
  ankleY: number;
}

/** Read off the rest skeleton (call before any clip has posed it). */
export function landmarksOf(T: Three, root: THREE.Object3D): Landmarks {
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const at = (name: string) => {
    const b = root.getObjectByName(name);
    const v = new T.Vector3();
    if (b) b.getWorldPosition(v);
    return v.applyMatrix4(inv);
  };
  return {
    neckY: at("neck_01").y,
    headY: at("Head").y,
    shoulderX: Math.abs(at("upperarm_l").x),
    elbowX: Math.abs(at("lowerarm_l").x),
    wristX: Math.abs(at("hand_l").x),
    armY: at("upperarm_l").y,
    hipY: at("pelvis").y,
    kneeY: at("calf_l").y,
    ankleY: at("foot_l").y,
  };
}

// ── Garments ────────────────────────────────────────────────────────────────

/**
 * One piece of cloth. `glsl` is the body of `vec4 garment(vec3 r)`: return the
 * colour with alpha 1 where the cloth is, alpha 0 where it isn't. The two JS
 * tests mirror it loosely: `touches` picks the body triangles the cloth is
 * built from, `covers` (with a safety margin) the skin it hides.
 */
export interface GarmentSpec {
  name: string;
  glsl: string;
  touches: (x: number, y: number, z: number) => boolean;
  covers: (x: number, y: number, z: number) => boolean;
  /** How far out from the skin, metres. */
  offset: (x: number, y: number, z: number) => number;
  /** Smoothing passes (0 keeps every bump: gloves). */
  smooth: number;
  uniforms?: Record<string, { value: unknown }>;
  roughness?: number;
  metalness?: number;
  /** Draw order nudge, so an outer layer wins over an inner one. */
  layer?: number;
}

const glslColour = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x808080;
  // sRGB → linear, as three.js works in linear.
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return `vec3(${lin((n >> 16) & 255).toFixed(4)}, ${lin((n >> 8) & 255).toFixed(4)}, ${lin(n & 255).toFixed(4)})`;
};

/** Every landmark as a GLSL constant block. */
const lmGlsl = (L: Landmarks) =>
  `float NECK = ${L.neckY.toFixed(4)}; float HIP = ${L.hipY.toFixed(4)}; float KNEE = ${L.kneeY.toFixed(4)};
   float ANKLE = ${L.ankleY.toFixed(4)}; float SHX = ${L.shoulderX.toFixed(4)}; float ELX = ${L.elbowX.toFixed(4)};
   float WRX = ${L.wristX.toFixed(4)}; float ARMY = ${L.armY.toFixed(4)};
   float ax = abs(r.x);
   bool arm = ax > SHX - 0.03 && r.y > ARMY - 0.16;
   bool hand = ax > WRX - 0.004 && r.y > ARMY - 0.16;
   float nd = length(vec2(r.x, r.z + 0.045));
   bool headZone = r.y > NECK + (r.z < -0.03 ? 0.05 : 0.035) && ax < 0.13 && !arm;`;

const isArm = (L: Landmarks, x: number, y: number) => Math.abs(x) > L.shoulderX - 0.03 && y > L.armY - 0.16;
const isHead = (L: Landmarks, x: number, y: number, z: number) => y > L.neckY + 0.04 && Math.abs(x) < 0.13 && z > -0.2 && !isArm(L, x, y);

/** The football kit: shirt (with its number on the back), shorts, socks. */
export function kitSpec(L: Landmarks, k: { shirt: string; trim: string; shorts: string; socks: string }): GarmentSpec[] {
  const sleeveEnd = L.shoulderX + 0.15;
  const shirt: GarmentSpec = {
    name: "shirt",
    glsl: `${lmGlsl(L)}
      vec3 SH = ${glslColour(k.shirt)}; vec3 TR = ${glslColour(k.trim)};
      if (hand) return vec4(0.0);
      if (arm) {
        if (ax > ${sleeveEnd.toFixed(4)}) return vec4(0.0);
        return vec4(ax > ${(sleeveEnd - 0.016).toFixed(4)} ? TR : SH, 1.0);
      }
      if (r.y < HIP - 0.015) return vec4(0.0);
      // Over the shoulders, up to the neck; a V-neck at the front.
      if (r.y > NECK + 0.11 || headZone) return vec4(0.0);
      // A round collar in the trim colour; a short V at the front.
      float collar = r.z > 0.0 ? NECK - 0.012 - 0.035 * max(0.0, 1.0 - ax / 0.055) : NECK + 0.03;
      if (nd < 0.1 || (r.z > 0.0 && ax < 0.06)) {
        if (r.y > collar) return vec4(0.0);
        if (r.y > collar - 0.018) return vec4(TR, 1.0);
      }
      // The number on the back.
      if (r.z < -0.02) {
        vec2 uv = vec2(0.5 - r.x / 0.30, (r.y - (NECK - 0.43)) / 0.30);
        if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
          vec4 n = texture2D(uNumber, uv);
          return vec4(mix(SH, TR, n.a), 1.0);
        }
      }
      return vec4(SH, 1.0);`,
    touches: (x, y, z) => (isArm(L, x, y) ? Math.abs(x) < sleeveEnd + 0.03 : y > L.hipY - 0.05 && y < L.neckY + 0.13 && !isHead(L, x, y, z)),
    covers: (x, y, z) => (isArm(L, x, y) ? Math.abs(x) < sleeveEnd - 0.03 : y > L.hipY + 0.03 && (y < L.neckY - 0.13 || (y < L.neckY + 0.03 && Math.hypot(x, z + 0.045) > 0.1))),
    offset: (x, y) => (isArm(L, x, y) ? 0.014 : 0.016 + 0.006 * smoothstep(L.hipY + 0.3, L.hipY + 0.02, y)),
    smooth: 40,
    roughness: 0.8,
    layer: 2,
  };
  const shorts: GarmentSpec = {
    name: "shorts",
    glsl: `${lmGlsl(L)}
      vec3 SO = ${glslColour(k.shorts)};
      if (arm) return vec4(0.0);
      float top = HIP - 0.005, bottom = KNEE + 0.15;
      if (r.y > top || r.y < bottom) return vec4(0.0);
      return vec4(r.y < bottom + 0.012 ? SO * 0.82 : SO, 1.0);`,
    touches: (x, y) => !isArm(L, x, y) && y < L.hipY + 0.05 && y > L.kneeY + 0.12,
    covers: (x, y) => !isArm(L, x, y) && y < L.hipY - 0.01 && y > L.kneeY + 0.19,
    offset: (x, y) => 0.014 + 0.016 * smoothstep(L.hipY - 0.05, L.kneeY + 0.2, y),
    smooth: 30,
    roughness: 0.75,
    layer: 1,
  };
  const socks: GarmentSpec = {
    name: "socks",
    glsl: `${lmGlsl(L)}
      vec3 SK = ${glslColour(k.socks)}; vec3 TR = ${glslColour(k.trim)};
      if (arm) return vec4(0.0);
      float top = KNEE - 0.04;
      if (r.y > top || r.y < ANKLE - 0.06) return vec4(0.0);
      return vec4(r.y > top - 0.03 ? TR : SK, 1.0);`,
    touches: (x, y) => !isArm(L, x, y) && y < L.kneeY - 0.01 && y > L.ankleY - 0.1,
    covers: (x, y) => !isArm(L, x, y) && y < L.kneeY - 0.08 && y > L.ankleY - 0.02,
    offset: () => 0.006,
    smooth: 6,
    roughness: 0.9,
    layer: 1,
  };
  return [shirt, shorts, socks];
}

/** The manager's suit: jacket (white shirt and tie in its V), trousers. */
export function suitSpec(L: Landmarks, k: { suit: string; tie: string; shirt?: string }): GarmentSpec[] {
  const shirtCol = k.shirt ?? "#eef1f5";
  const hem = L.hipY - 0.14;
  /** How high the collar stands at the back of the neck, above the neck joint. */
  const BACK_COLLAR = 0.085;
  const jacket: GarmentSpec = {
    name: "jacket",
    glsl: `${lmGlsl(L)}
      vec3 SU = ${glslColour(k.suit)}; vec3 SHT = ${glslColour(shirtCol)}; vec3 TIE = ${glslColour(k.tie)};
      if (hand) return vec4(0.0);
      if (arm) {
        if (ax > WRX - 0.02) return vec4(0.0);
        if (ax > WRX - 0.032) return vec4(SHT, 1.0);
        return vec4(SU, 1.0);
      }
      if (r.y < ${hem.toFixed(4)}) return vec4(0.0);
      // Round the back of the neck the collar stands up to just under the
      // hair (a jacket never shows the nape and upper back); at the front it
      // stays low for the V.
      float backK = 1.0 - smoothstep(-0.075, -0.02, r.z);
      float colTop = NECK + 0.035 + ${(BACK_COLLAR - 0.035).toFixed(4)} * backK;
      if (r.y > NECK + 0.13 || (r.y > colTop && ax < 0.13 && !arm)) return vec4(0.0);
      if (backK > 0.5 && nd < 0.1 && r.y > colTop - 0.026) return vec4(SHT, 1.0);
      if (backK > 0.5 && nd < 0.1 && r.y > colTop - 0.032) return vec4(SU * 0.6, 1.0);
      // The front opening: shirt and tie in a V up to the collar.
      float vb = NECK - 0.25;
      float vHalf = 0.072 * clamp((r.y - vb) / (NECK + 0.035 - vb), 0.0, 1.0);
      if (r.z > 0.0 && ax < vHalf) {
        float tw = r.y > NECK - 0.03 ? 0.019 : 0.014 + 0.005 * clamp((NECK - 0.06 - r.y) / 0.2, 0.0, 1.0);
        if (ax < tw && r.y < NECK - 0.002) return vec4(r.y > NECK - 0.03 ? TIE * 0.85 : TIE, 1.0);
        return vec4(SHT, 1.0);
      }
      // The shirt collar round the sides of the neck.
      if (nd < 0.1 && r.y > NECK - 0.035 && backK <= 0.5) return vec4(SHT, 1.0);
      if (r.z > 0.0) {
        if (ax < vHalf + 0.012 && r.y > vb) return vec4(SU * 0.6, 1.0);
        if (ax < 0.006 && r.y < vb) return vec4(SU * 0.55, 1.0);
      }
      if (r.y < ${(hem + 0.012).toFixed(4)}) return vec4(SU * 0.7, 1.0);
      return vec4(SU, 1.0);`,
    touches: (x, y, z) => (isArm(L, x, y) ? Math.abs(x) < L.wristX
      : y > hem - 0.04 && y < L.neckY + 0.13 && (!isHead(L, x, y, z) || (z < -0.02 && y < L.neckY + BACK_COLLAR + 0.02 && Math.abs(x) < 0.1))),
    covers: (x, y, z) => (isArm(L, x, y) ? Math.abs(x) < L.wristX - 0.05 : y > hem + 0.04 && (y < L.neckY - 0.06 || (y < L.neckY + 0.03 && Math.hypot(x, z + 0.045) > 0.1))),
    // Close round the neck (a collar, not a ruff), looser over the belly.
    offset: (x, y) => (isArm(L, x, y) ? 0.016
      : (0.022 + 0.022 * smoothstep(L.hipY + 0.36, L.hipY + 0.06, y)) * (1 - 0.55 * smoothstep(L.neckY - 0.1, L.neckY - 0.01, y))),
    smooth: 50,
    roughness: 0.7,
    layer: 2,
  };
  const trousers: GarmentSpec = {
    name: "trousers",
    glsl: `${lmGlsl(L)}
      vec3 SU = ${glslColour(k.suit)};
      if (arm) return vec4(0.0);
      if (r.y > HIP + 0.04 || r.y < ANKLE + 0.02) return vec4(0.0);
      return vec4(SU * 0.92, 1.0);`,
    touches: (x, y) => !isArm(L, x, y) && y < L.hipY + 0.06 && y > L.ankleY - 0.01,
    covers: (x, y) => !isArm(L, x, y) && y < L.hipY && y > L.ankleY + 0.06,
    offset: () => 0.016,
    smooth: 30,
    roughness: 0.72,
    layer: 1,
  };
  return [jacket, trousers];
}

/** Footwear: football boots, or a suit's shoes. */
export function footSpec(L: Landmarks, colour: string, sole: string, shiny = false): GarmentSpec {
  return {
    name: "boots",
    glsl: `${lmGlsl(L)}
      vec3 C = ${glslColour(colour)}; vec3 S = ${glslColour(sole)};
      if (arm || r.y > ANKLE + 0.045) return vec4(0.0);
      return vec4(r.y < 0.012 ? S : C, 1.0);`,
    touches: (x, y) => !isArm(L, x, y) && y < L.ankleY + 0.07,
    covers: (x, y) => !isArm(L, x, y) && y < L.ankleY + 0.02,
    offset: () => 0.011,
    smooth: 8,
    roughness: shiny ? 0.25 : 0.55,
    metalness: shiny ? 0.35 : 0,
    layer: 2,
  };
}

/** A long base layer under the shirt, to the wrist. */
export function sleevesSpec(L: Landmarks, colour: string): GarmentSpec {
  return {
    name: "sleeves",
    glsl: `${lmGlsl(L)}
      if (!arm || hand || ax > WRX - 0.012 || ax < SHX + 0.11) return vec4(0.0);
      return vec4(${glslColour(colour)}, 1.0);`,
    // Only below the shirt's own sleeve (under it, it would only poke through).
    touches: (x, y) => isArm(L, x, y) && Math.abs(x) < L.wristX && Math.abs(x) > L.shoulderX + 0.09,
    covers: (x, y) => isArm(L, x, y) && Math.abs(x) < L.wristX - 0.04,
    offset: () => 0.008,
    smooth: 8,
    roughness: 0.85,
    layer: 1,
  };
}

/** Tape round both wrists. */
export function wristTapeSpec(L: Landmarks, colour: string): GarmentSpec {
  return {
    name: "tape",
    glsl: `${lmGlsl(L)}
      if (!arm || ax > WRX - 0.004 || ax < WRX - 0.055) return vec4(0.0);
      float s = fract((ax - WRX) / 0.011);
      return vec4(${glslColour(colour)} * (s < 0.15 ? 0.82 : 1.0), 1.0);`,
    touches: (x, y) => isArm(L, x, y) && Math.abs(x) > L.wristX - 0.07 && Math.abs(x) < L.wristX + 0.01,
    covers: () => false,
    offset: () => 0.012,
    smooth: 4,
    roughness: 0.9,
    layer: 3,
  };
}

/** Gloves: the hands, with a cuff. */
export function glovesSpec(L: Landmarks, colour: string, cuff?: string): GarmentSpec {
  return {
    name: "gloves",
    glsl: `${lmGlsl(L)}
      if (!arm || ax < WRX - 0.035) return vec4(0.0);
      return vec4(ax < WRX - 0.012 ? ${glslColour(cuff ?? colour)} : ${glslColour(colour)}, 1.0);`,
    touches: (x, y) => isArm(L, x, y) && Math.abs(x) > L.wristX - 0.05,
    covers: (x, y) => isArm(L, x, y) && Math.abs(x) > L.wristX - 0.02,
    offset: (x) => (Math.abs(x) < L.wristX ? 0.009 : 0.0035),
    smooth: 0,
    roughness: 0.6,
    layer: 3,
  };
}

/** The armband on the left upper arm (stripes for the rainbow one). */
/** A sweatband round the forehead (a second colour makes a stripe). */
export function headbandSpec(L: Landmarks, browY: number, colour: string, colour2?: string): GarmentSpec {
  const a = browY + 0.018, b = browY + 0.058;
  return {
    name: "headband",
    glsl: `${lmGlsl(L)}
      if (arm || r.y < ${a.toFixed(4)} || r.y > ${b.toFixed(4)}) return vec4(0.0);
      float t = (r.y - ${a.toFixed(4)}) / ${(b - a).toFixed(4)};
      ${colour2 ? `if (t > 0.38 && t < 0.62) return vec4(${glslColour(colour2)}, 1.0);` : ""}
      return vec4(${glslColour(colour)} * (t < 0.1 || t > 0.9 ? 0.8 : 1.0), 1.0);`,
    touches: (x, y) => !isArm(L, x, y) && y > a - 0.02 && y < b + 0.02 && Math.abs(x) < 0.15,
    covers: () => false,
    offset: (x, y, z) => (z > 0.02 ? 0.006 : 0.016),
    smooth: 6,
    roughness: 0.9,
    layer: 6,
  };
}

/** A snood round the neck. */
export function snoodSpec(L: Landmarks, colour: string): GarmentSpec {
  const a = L.neckY - 0.03, b = L.neckY + 0.06;
  return {
    name: "snood",
    glsl: `${lmGlsl(L)}
      if (arm || r.y < ${a.toFixed(4)} || r.y > ${b.toFixed(4)} || nd > 0.11) return vec4(0.0);
      float rib = fract(r.y / 0.012);
      return vec4(${glslColour(colour)} * (rib < 0.2 ? 0.8 : 1.0), 1.0);`,
    touches: (x, y, z) => !isArm(L, x, y) && y > a - 0.02 && y < b + 0.02 && Math.hypot(x, z + 0.045) < 0.13,
    covers: (x, y, z) => !isArm(L, x, y) && y > a + 0.015 && y < b - 0.03 && Math.hypot(x, z + 0.045) < 0.09,
    offset: () => 0.018,
    smooth: 14,
    roughness: 0.85,
    layer: 5,
  };
}

export function armbandSpec(L: Landmarks, colours: string[]): GarmentSpec {
  const a = L.shoulderX + 0.095, b = a + 0.045;
  const stripes = colours.length > 1
    ? colours.map((c, i) => `if (t < ${((i + 1) / colours.length).toFixed(4)}) return vec4(${glslColour(c)}, 1.0);`).join("\n")
    : "";
  return {
    name: "armband",
    glsl: `${lmGlsl(L)}
      if (!arm || r.x < 0.0 || ax < ${a.toFixed(4)} || ax > ${b.toFixed(4)}) return vec4(0.0);
      float t = (ax - ${a.toFixed(4)}) / ${(b - a).toFixed(4)};
      ${stripes}
      return vec4(${glslColour(colours[0])} * (t < 0.12 || t > 0.88 ? 0.75 : 1.0), 1.0);`,
    touches: (x, y) => isArm(L, x, y) && x > 0 && x > a - 0.03 && x < b + 0.03,
    covers: () => false,
    offset: () => 0.02,
    smooth: 10,
    roughness: 0.6,
    layer: 4,
  };
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Bring the "superhero" arms to a footballer's: every arm point is drawn in
 * towards the bone line (upper arm the most, forearm less, the hand not at
 * all), fading out into the shoulder. Rest pose only, before anything is
 * built from the body, so clothes and accessories follow.
 */
/** How thick the arms stay (1 = the model's "superhero" arms). */
export const ARM_KEEP = { upper: 0.72, fore: 0.76 };
/** The hands, scaled about the wrist (the model's are a size too big). */
export const HAND_SCALE = 0.88;

export function slimArms(T: Three, root: THREE.Object3D, geo: THREE.BufferGeometry, L: Landmarks) {
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const at = (n: string) => { const v = new T.Vector3(); root.getObjectByName(n)!.getWorldPosition(v); return v.applyMatrix4(inv); };
  const sh = at("upperarm_l"), el = at("lowerarm_l"), wr = at("hand_l");
  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
  const axisAt = (ax: number) => (ax < el.x
    ? [lerp(sh.y, el.y, (ax - sh.x) / (el.x - sh.x)), lerp(sh.z, el.z, (ax - sh.x) / (el.x - sh.x))]
    : [lerp(el.y, wr.y, (ax - el.x) / (wr.x - el.x)), lerp(el.z, wr.z, (ax - el.x) / (wr.x - el.x))]);
  // How much of each ring is kept: about three-quarters along the upper arm
  // and the forearm (a footballer's, not a bodybuilder's), full at the wrist.
  const k = (ax: number) => {
    if (ax < L.shoulderX - 0.07) return 1;
    if (ax < L.shoulderX + 0.06) return lerp(1, ARM_KEEP.upper, (ax - (L.shoulderX - 0.07)) / 0.13);
    if (ax < L.elbowX - 0.03) return ARM_KEEP.upper;
    if (ax < L.elbowX + 0.03) return lerp(ARM_KEEP.upper, ARM_KEEP.fore, (ax - (L.elbowX - 0.03)) / 0.06);
    if (ax < L.wristX - 0.06) return ARM_KEEP.fore;
    if (ax < L.wristX) return lerp(ARM_KEEP.fore, 0.9, (ax - (L.wristX - 0.06)) / 0.06);
    return lerp(0.9, 1, (ax - L.wristX) / 0.03);
  };
  const p = geo.attributes.position.array as Float32Array;
  for (let i = 0; i < p.length; i += 3) {
    const ax = Math.abs(p[i]);
    if (ax < L.shoulderX - 0.07 || ax > L.wristX + 0.03) continue;
    const [cy, cz] = axisAt(ax);
    const dy = p[i + 1] - cy, dz = p[i + 2] - cz;
    const r = Math.hypot(dy, dz);
    // Near the bone line only: the chest and back next to the armpit stay.
    const near = 1 - Math.min(1, Math.max(0, (r - 0.085) / 0.04));
    if (near <= 0) continue;
    const f = 1 + (k(ax) - 1) * near;
    p[i + 1] = cy + dy * f;
    p[i + 2] = cz + dz * f;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
}

/** The welded body: rest positions shared across the UV seams. */
export interface WeldedBody {
  pos: Float32Array;     // per original vertex, rest
  nrm: Float32Array;     // per original vertex, welded (smooth across seams)
  canon: Int32Array;     // original vertex → canonical id
  canonCount: number;
  adj: number[][];       // canonical neighbours
  index: ArrayLike<number>;
}

export function weldBody(geo: THREE.BufferGeometry): WeldedBody {
  const p = geo.attributes.position.array as Float32Array;
  const n = geo.attributes.normal.array as Float32Array;
  const count = geo.attributes.position.count;
  const map = new Map<string, number>();
  const canon = new Int32Array(count);
  let k = 0;
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(p[i * 3] * 1e4)},${Math.round(p[i * 3 + 1] * 1e4)},${Math.round(p[i * 3 + 2] * 1e4)}`;
    let c = map.get(key);
    if (c === undefined) { c = k++; map.set(key, c); }
    canon[i] = c;
  }
  const cn = new Float32Array(k * 3);
  for (let i = 0; i < count; i++) { const c = canon[i]; cn[c * 3] += n[i * 3]; cn[c * 3 + 1] += n[i * 3 + 1]; cn[c * 3 + 2] += n[i * 3 + 2]; }
  const nrm = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = canon[i];
    const x = cn[c * 3], y = cn[c * 3 + 1], z = cn[c * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l;
  }
  const index = geo.index!.array;
  const adjSet: Set<number>[] = Array.from({ length: k }, () => new Set<number>());
  for (let t = 0; t < index.length; t += 3) {
    const a = canon[index[t]], b = canon[index[t + 1]], c = canon[index[t + 2]];
    adjSet[a].add(b); adjSet[a].add(c); adjSet[b].add(a); adjSet[b].add(c); adjSet[c].add(a); adjSet[c].add(b);
  }
  return { pos: p, nrm, canon, canonCount: k, adj: adjSet.map((s) => Array.from(s)), index };
}

/** A garment as its own skinned mesh on the body's skeleton. */
export function buildGarment(T: Three, body: THREE.SkinnedMesh, W: WeldedBody, spec: GarmentSpec): THREE.SkinnedMesh {
  const { pos, nrm, canon, index } = W;
  const src = body.geometry;
  const count = src.attributes.position.count;
  // The triangles the cloth is made from.
  const tris: number[] = [];
  const used = new Uint8Array(count);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (spec.touches(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]) || spec.touches(pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]) || spec.touches(pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2])) {
      tris.push(a, b, c); used[a] = used[b] = used[c] = 1;
    }
  }
  // Smooth the canonical positions the cloth uses (and their ring).
  const K = W.canonCount;
  const cp = new Float32Array(K * 3);
  const active = new Uint8Array(K);
  for (let i = 0; i < count; i++) {
    const c = canon[i];
    cp[c * 3] = pos[i * 3]; cp[c * 3 + 1] = pos[i * 3 + 1]; cp[c * 3 + 2] = pos[i * 3 + 2];
    if (used[i]) active[c] = 1;
  }
  const tmp = new Float32Array(K * 3);
  for (let it = 0; it < spec.smooth; it++) {
    tmp.set(cp);
    for (let c = 0; c < K; c++) {
      if (!active[c]) continue;
      const nb = W.adj[c];
      if (!nb.length) continue;
      let x = 0, y = 0, z = 0;
      for (const j of nb) { x += tmp[j * 3]; y += tmp[j * 3 + 1]; z += tmp[j * 3 + 2]; }
      const inv = 1 / nb.length;
      // Hands keep their fingers apart: never smooth past the wrist.
      // Taubin: shrink then grow back, so the cloth keeps its size.
      const lam = Math.abs(tmp[c * 3]) > 0.66 && tmp[c * 3 + 1] > 1.25 ? 0 : it % 2 === 0 ? 0.55 : -0.5;
      cp[c * 3] = tmp[c * 3] + (x * inv - tmp[c * 3]) * lam;
      cp[c * 3 + 1] = tmp[c * 3 + 1] + (y * inv - tmp[c * 3 + 1]) * lam;
      cp[c * 3 + 2] = tmp[c * 3 + 2] + (z * inv - tmp[c * 3 + 2]) * lam;
    }
  }
  // Out along the normal, never closer to the skin than most of the offset.
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    if (!used[i]) continue;
    const c = canon[i];
    const ox = pos[i * 3], oy = pos[i * 3 + 1], oz = pos[i * 3 + 2];
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
    const off = spec.offset(ox, oy, oz);
    // Only the part of the smoothing along the normal is kept: each cloth
    // point stays straight over its own skin point, so it bends with exactly
    // the same bones and never tears away from it when an arm or the back
    // moves. It still fills the dips between the muscles and eases over the
    // bulges, which is what hides the "superhero" build.
    let d = (cp[c * 3] - ox) * nx + (cp[c * 3 + 1] - oy) * ny + (cp[c * 3 + 2] - oz) * nz + off;
    // Where the skin under it is taken out, the cloth may sit a little inside
    // where a muscle was. Near an edge, where skin still shows, it stays out.
    // Near an edge it also never stands further out than its own offset:
    // the smoothing bridges the hollow between neck and shoulder, and at a
    // collar or a cuff that bridge is a loose flap of cloth that tears and
    // flies about as the neck or the wrist turns.
    const cov = spec.covers(ox, oy, oz);
    const min = cov ? off * 0.25 : off * 0.85;
    const max = cov ? off + 0.04 : off * 1.12;
    d = Math.min(max, Math.max(min, d));
    const x = ox + nx * d, y = oy + ny * d, z = oz + nz * d;
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  // Compact to the used vertices.
  const remap = new Int32Array(count).fill(-1);
  let m = 0;
  for (let i = 0; i < count; i++) if (used[i]) remap[i] = m++;
  const P = new Float32Array(m * 3), R = new Float32Array(m * 3);
  const SI = new Uint16Array(m * 4), SW = new Float32Array(m * 4);
  const si = src.attributes.skinIndex.array as ArrayLike<number>;
  const sw = src.attributes.skinWeight.array as ArrayLike<number>;
  for (let i = 0; i < count; i++) {
    const j = remap[i];
    if (j < 0) continue;
    for (let q = 0; q < 3; q++) { P[j * 3 + q] = out[i * 3 + q]; R[j * 3 + q] = pos[i * 3 + q]; }
    for (let q = 0; q < 4; q++) { SI[j * 4 + q] = si[i * 4 + q]; SW[j * 4 + q] = sw[i * 4 + q]; }
  }
  const idx = new Uint32Array(tris.length);
  for (let t = 0; t < tris.length; t++) idx[t] = remap[tris[t]];
  // Smooth normals across the seams (per canonical vertex).
  const cnrm = new Float32Array(K * 3);
  for (let t = 0; t < tris.length; t += 3) {
    const a = remap[tris[t]], b = remap[tris[t + 1]], c = remap[tris[t + 2]];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const v of [tris[t], tris[t + 1], tris[t + 2]]) { const cc = canon[v]; cnrm[cc * 3] += fx; cnrm[cc * 3 + 1] += fy; cnrm[cc * 3 + 2] += fz; }
  }
  const N = new Float32Array(m * 3);
  for (let i = 0; i < count; i++) {
    const j = remap[i];
    if (j < 0) continue;
    const c = canon[i];
    const x = cnrm[c * 3], y = cnrm[c * 3 + 1], z = cnrm[c * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    N[j * 3] = x / l; N[j * 3 + 1] = y / l; N[j * 3 + 2] = z / l;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(P, 3));
  geo.setAttribute("normal", new T.BufferAttribute(N, 3));
  geo.setAttribute("restPos", new T.BufferAttribute(R, 3));
  geo.setAttribute("skinIndex", new T.BufferAttribute(SI, 4));
  geo.setAttribute("skinWeight", new T.BufferAttribute(SW, 4));
  geo.setIndex(new T.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();

  const mat = new T.MeshStandardMaterial({
    color: 0xffffff, roughness: spec.roughness ?? 0.75, metalness: spec.metalness ?? 0, side: T.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -(spec.layer ?? 1), polygonOffsetUnits: -(spec.layer ?? 1),
  });
  const uniforms = spec.uniforms ?? {};
  const needsNumber = spec.glsl.includes("uNumber");
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 restPos;\nvarying vec3 vRest;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = restPos;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRest;\n${needsNumber ? "uniform sampler2D uNumber;" : ""}\nvec4 garment(vec3 r) {\n${spec.glsl}\n}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\nvec4 gC = garment(vRest);\nif (gC.a < 0.5) discard;\ndiffuseColor.rgb = gC.rgb;");
  };
  mat.customProgramCacheKey = () => `garment-${spec.name}-${spec.glsl.length}-${hashStr(spec.glsl)}`;
  const mesh = new T.SkinnedMesh(geo, mat);
  mesh.name = `garment-${spec.name}`;
  mesh.frustumCulled = false;
  mesh.bind(body.skeleton, body.bindMatrix);
  return mesh;
}

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Take the skin under the cloth out of the body, so it never pokes through. */
export function hideCoveredSkin(T: Three, body: THREE.SkinnedMesh, W: WeldedBody, specs: Pick<GarmentSpec, "covers">[]) {
  const { pos, index } = W;
  const covered = (i: number) => specs.some((s) => s.covers(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  const keep: number[] = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (covered(a) && covered(b) && covered(c)) continue;
    keep.push(a, b, c);
  }
  body.geometry.setIndex(new T.BufferAttribute(new Uint32Array(keep), 1));
}

// ── The face picture ────────────────────────────────────────────────────────

/** Where the body's own face is, in the rest pose. */
export interface FaceFrame { chinY: number; eyeY: number; browY: number; frontZ: number; }

export function faceFrameOf(W: WeldedBody, L: Landmarks): FaceFrame {
  const { pos } = W;
  let chinY = Infinity, frontZ = -Infinity;
  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (Math.abs(x) < 0.012 && y > L.neckY && y < L.headY + 0.2) {
      if (z > 0.06 && y < chinY) chinY = y;
      if (z > frontZ) frontZ = z;
    }
  }
  // Measured on this head (its own eye and eyebrow meshes): the eyes sit
  // 0.119 m over the chin, the brows 0.13 m.
  return { chinY, eyeY: chinY + 0.119, browY: chinY + 0.13, frontZ };
}

/**
 * The player's photo as a decal over the front of the head.
 *
 * A flat photo laid over a modelled nose and lips reads as two faces at once,
 * so the body's own face is first softened in place (the nose and lips eased
 * back towards a smooth front, more in the middle, none at the edges). The
 * decal is then the head's own triangles a hair's breadth out, with the
 * picture projected straight on from the front. `img` is the fitted head
 * (faceFit.ts): its chin and brow-to-chin height line up with the body's.
 *
 * This CHANGES `body`'s rest positions: the caller keeps a clean copy and
 * puts it back before building a different face.
 */
/** A photo's face box (chin to brow line, faceFit.ts) in metres on this head, across. */
const FACE_SPAN_M = 0.118;

export function buildFaceDecal(
  T: Three, body: THREE.SkinnedMesh, W: WeldedBody, F: FaceFrame,
  img: { canvas: HTMLCanvasElement | HTMLImageElement; chinX: number; chinY: number; faceH: number },
  /** Multiplies the photo's colour, so its skin meets the body's skin tone. */
  tint: [number, number, number] = [1, 1, 1],
): THREE.SkinnedMesh {
  const { nrm, index } = W;
  const src = body.geometry;
  const posAttr = src.attributes.position as THREE.BufferAttribute;
  const pos = posAttr.array as Float32Array;
  const count = posAttr.count;
  const cw = img.canvas.width, ch = img.canvas.height;
  // Picture px per metre. Across: the photo's eyes as far apart as this
  // head's. Up and down a touch less, and anchored on the eyes (the photo's
  // eyes are 3/4 of its face box over its chin), so the photo's eyes, nose
  // and mouth land on this head's and its chin melts into this (longer) jaw.
  const sx = img.faceH / FACE_SPAN_M;
  const sy = sx / 1.15;
  const eyePx = img.chinY - 0.75 * img.faceH;
  const zMin = F.frontZ - 0.12;
  const inFace = (x: number, y: number, z: number) => z > zMin && y > F.chinY - 0.045 && y < F.browY + 0.12 && Math.abs(x) < 0.1;

  // 1. Soften the face itself (canonical vertices, so the seams stay shut).
  const K = W.canonCount;
  const cp = new Float32Array(K * 3), orig = new Float32Array(K * 3), wgt = new Float32Array(K);
  const active = new Uint8Array(K);
  const sm = (e0: number, e1: number, v: number) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < count; i++) {
    const c = W.canon[i];
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    cp[c * 3] = orig[c * 3] = x; cp[c * 3 + 1] = orig[c * 3 + 1] = y; cp[c * 3 + 2] = orig[c * 3 + 2] = z;
    if (inFace(x, y, z)) {
      active[c] = 1;
      wgt[c] = 0.97 * (1 - sm(0.045, 0.085, Math.abs(x))) * sm(F.chinY - 0.01, F.chinY + 0.02, y) * (1 - sm(F.browY, F.browY + 0.05, y));
    }
  }
  const tmp = new Float32Array(K * 3);
  for (let it = 0; it < 18; it++) {
    tmp.set(cp);
    for (let c = 0; c < K; c++) {
      if (!active[c]) continue;
      const nb = W.adj[c];
      let x = 0, y = 0, z = 0;
      for (const j of nb) { x += tmp[j * 3]; y += tmp[j * 3 + 1]; z += tmp[j * 3 + 2]; }
      const inv = 1 / nb.length;
      cp[c * 3] += (x * inv - tmp[c * 3]) * 0.5;
      cp[c * 3 + 1] += (y * inv - tmp[c * 3 + 1]) * 0.5;
      cp[c * 3 + 2] += (z * inv - tmp[c * 3 + 2]) * 0.5;
    }
  }
  for (let i = 0; i < count; i++) {
    const c = W.canon[i];
    if (!active[c]) continue;
    const w = wgt[c];
    for (let q = 0; q < 3; q++) pos[i * 3 + q] = orig[c * 3 + q] + (cp[c * 3 + q] - orig[c * 3 + q]) * w;
  }
  posAttr.needsUpdate = true;

  // 2. The decal: the softened face, just out from it.
  const tris: number[] = [];
  const used = new Uint8Array(count);
  const ok = (i: number) => inFace(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (ok(a) && ok(b) && ok(c)) { tris.push(a, b, c); used[a] = used[b] = used[c] = 1; }
  }
  const remap = new Int32Array(count).fill(-1);
  let m = 0;
  for (let i = 0; i < count; i++) if (used[i]) remap[i] = m++;
  const P = new Float32Array(m * 3), N = new Float32Array(m * 3), UV = new Float32Array(m * 2), A = new Float32Array(m);
  const SI = new Uint16Array(m * 4), SW = new Float32Array(m * 4);
  const si = src.attributes.skinIndex.array as ArrayLike<number>;
  const sw = src.attributes.skinWeight.array as ArrayLike<number>;
  for (let i = 0; i < count; i++) {
    const j = remap[i];
    if (j < 0) continue;
    const c = W.canon[i];
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
    const out = 0.0016;
    P[j * 3] = x + nx * out; P[j * 3 + 1] = y + ny * out; P[j * 3 + 2] = z + nz * out;
    N[j * 3] = nx; N[j * 3 + 1] = ny; N[j * 3 + 2] = nz;
    // Picture pixel straight in front of the ORIGINAL point. (His left, +x,
    // is the picture's right: the photo looks at us.)
    const ox = orig[c * 3], oy = orig[c * 3 + 1];
    const px = img.chinX + ox * sx;
    const py = eyePx - (oy - F.eyeY) * sy;
    UV[j * 2] = px / cw;
    UV[j * 2 + 1] = 1 - py / ch;
    // Fade where the head turns away from the projection, and at the sides.
    const facing = Math.min(1, Math.max(0, (nz - 0.2) / 0.35));
    const side = Math.min(1, Math.max(0, (0.095 - Math.abs(ox)) / 0.03));
    // Only the face itself (an oval from the chin to just above the brows):
    // the photo's own hair, ears and neck are left to the 3D head, and the
    // oval's edge fades into the skin.
    const ex = (px - img.chinX) / (img.faceH * 0.47);
    const ey = (py - (img.chinY - img.faceH * 0.56)) / (img.faceH * 0.66);
    const oval = 1 - sm(0.72, 1.0, Math.hypot(ex, ey));
    A[j] = facing * side * oval;
    for (let q = 0; q < 4; q++) { SI[j * 4 + q] = si[i * 4 + q]; SW[j * 4 + q] = sw[i * 4 + q]; }
  }
  const idx = new Uint32Array(tris.length);
  for (let t = 0; t < tris.length; t++) idx[t] = remap[tris[t]];
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(P, 3));
  geo.setAttribute("normal", new T.BufferAttribute(N, 3));
  geo.setAttribute("uv", new T.BufferAttribute(UV, 2));
  geo.setAttribute("fade", new T.BufferAttribute(A, 1));
  geo.setAttribute("skinIndex", new T.BufferAttribute(SI, 4));
  geo.setAttribute("skinWeight", new T.BufferAttribute(SW, 4));
  geo.setIndex(new T.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const tex = img.canvas instanceof HTMLCanvasElement ? new T.CanvasTexture(img.canvas) : new T.Texture(img.canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.needsUpdate = true;
  const mat = new T.MeshStandardMaterial({
    map: tex, transparent: true, roughness: 0.62, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float fade;\nvarying float vFade;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = fade;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFade;")
      .replace("#include <map_fragment>", `#include <map_fragment>
if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) discard;
diffuseColor.rgb *= vec3(${tint.map((v) => v.toFixed(4)).join(", ")});
diffuseColor.a *= vFade;
if (diffuseColor.a < 0.02) discard;`);
  };
  mat.customProgramCacheKey = () => `face-decal-${tint.map((v) => v.toFixed(3)).join(",")}`;
  const mesh = new T.SkinnedMesh(geo, mat);
  mesh.name = "face-decal";
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.bind(body.skeleton, body.bindMatrix);
  return mesh;
}

// ── Posing ──────────────────────────────────────────────────────────────────

/** Turn `bone` (in world space) by `q`, keeping its parent where it is. */
export function rotateBoneWorld(T: Three, bone: THREE.Object3D, q: THREE.Quaternion) {
  const pq = new T.Quaternion();
  bone.parent!.getWorldQuaternion(pq);
  const wq = new T.Quaternion();
  bone.getWorldQuaternion(wq);
  wq.premultiply(q);
  bone.quaternion.copy(pq.invert().multiply(wq));
  bone.updateMatrixWorld(true);
}

/** Set `bone`'s world rotation outright. */
export function setBoneWorldQuat(T: Three, bone: THREE.Object3D, wq: THREE.Quaternion) {
  const pq = new T.Quaternion();
  bone.parent!.getWorldQuaternion(pq);
  bone.quaternion.copy(pq.invert().multiply(wq.clone()));
  bone.updateMatrixWorld(true);
}

/** Turn `bone` so the point `from` (world) on it swings to point at `to`. */
export function aimBone(T: Three, bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, weight = 1) {
  const b = new T.Vector3();
  bone.getWorldPosition(b);
  const d1 = from.clone().sub(b).normalize();
  const d2 = to.clone().sub(b).normalize();
  if (d1.lengthSq() < 1e-8 || d2.lengthSq() < 1e-8) return;
  const q = new T.Quaternion().setFromUnitVectors(d1, d2);
  if (weight < 1) q.slerp(new T.Quaternion(), 1 - weight);
  rotateBoneWorld(T, bone, q);
}

const wp = (T: Three, o: THREE.Object3D) => { const v = new T.Vector3(); o.getWorldPosition(v); return v; };

/**
 * Two-bone IK: put the wrist (`hand`'s origin) on `target`, with the elbow
 * bent towards `pole` (a world direction). Blended with whatever the clip
 * had by `weight`.
 */
export function solveArm(
  T: Three, upper: THREE.Bone, lower: THREE.Bone, hand: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3, weight = 1,
) {
  if (weight <= 0) return;
  const q0u = upper.quaternion.clone(), q0l = lower.quaternion.clone();
  const S = wp(T, upper), E = wp(T, lower), H = wp(T, hand);
  const a = S.distanceTo(E), b = E.distanceTo(H);
  const toT = target.clone().sub(S);
  const d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, toT.length()));
  const dir = toT.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0);
  perp.normalize();
  const Ed = S.clone().add(dir.clone().multiplyScalar(a * cosA)).add(perp.multiplyScalar(a * sinA));
  aimBone(T, upper, E, Ed);
  const H2 = wp(T, hand);
  const Td = S.clone().add(dir.clone().multiplyScalar(d));
  aimBone(T, lower, H2, Td);
  if (weight < 1) {
    upper.quaternion.copy(q0u.slerp(upper.quaternion, weight));
    upper.updateMatrixWorld(true);
    lower.quaternion.copy(q0l.slerp(lower.quaternion, weight));
    lower.updateMatrixWorld(true);
  }
}

/** A hand's own axes in its bone space, read from the rest pose (palms down). */
export interface HandAxes { along: THREE.Vector3; palm: THREE.Vector3; side: THREE.Vector3 }

export function handAxesOf(T: Three, hand: THREE.Bone, middle: THREE.Object3D): HandAxes {
  const hq = new T.Quaternion();
  hand.getWorldQuaternion(hq);
  const inv = hq.clone().invert();
  const along = wp(T, middle).sub(wp(T, hand)).normalize().applyQuaternion(inv);
  const palm = new T.Vector3(0, -1, 0).applyQuaternion(inv);
  palm.sub(along.clone().multiplyScalar(palm.dot(along))).normalize();
  const side = new T.Vector3().crossVectors(along, palm).normalize();
  return { along, palm, side };
}

/** The world rotation that points the fingers along `along` and the palm at `palm`. */
export function handWorldQuat(T: Three, ax: HandAxes, along: THREE.Vector3, palm: THREE.Vector3): THREE.Quaternion {
  const a = along.clone().normalize();
  const p = palm.clone().sub(a.clone().multiplyScalar(palm.dot(a))).normalize();
  const s = new T.Vector3().crossVectors(a, p);
  const mw = new T.Matrix4().makeBasis(a, p, s);
  const ml = new T.Matrix4().makeBasis(ax.along, ax.palm, ax.side);
  return new T.Quaternion().setFromRotationMatrix(mw.multiply(ml.transpose()));
}

/** Curl a finger's three bones towards the palm, by an angle each (radians). */
export function curlFinger(T: Three, bones: THREE.Object3D[], angles: number[], palmWorld: THREE.Vector3) {
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    const child = bone.children.find((c) => (c as THREE.Bone).isBone);
    if (!child || !angles[i]) continue;
    const dir = wp(T, child).sub(wp(T, bone)).normalize();
    const axis = new T.Vector3().crossVectors(dir, palmWorld).normalize();
    if (axis.lengthSq() < 1e-8) continue;
    rotateBoneWorld(T, bone, new T.Quaternion().setFromAxisAngle(axis, angles[i]));
  }
}
