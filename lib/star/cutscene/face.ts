/**
 * THE CUT-SCENE FACE — the same heads as the game (the one body,
 * lib/star/people3d.ts), made to hold a close-up in the Golden Hour look.
 *
 * Harry, 9 Oct 2026: "I don't want dodgy player faces, weird pen signings,
 * weird emotions. We don't need lips moving and perfection but it needs to
 * pass … strive for something that we will review and be AMAZED by."
 *
 * What changes on the head (only on a person made for a cut scene; the game's
 * own people are untouched):
 *   - Painted skin: the photo-scanned texture's skin goes to one flat tone (the
 *     career's skin-tone setting), lit in soft toon bands with warm shadows
 *     and a golden rim from behind. No face photo is ever laid on.
 *   - Real eyes: the painted eyes are cut out of the head and a lens-shaped
 *     eyeball sits behind each opening. Its own shader draws the white, the
 *     iris (limbal ring, a lighter lower half), the pupil, two catchlights,
 *     and the eyelids WITH their lash line, so a blink or a squint is just
 *     the lid line moving. The iris follows the gaze; the lids follow it a
 *     little too (looking down drops the upper lid, as real lids do).
 *   - Painted brows, lash lines, a crease over each eye, lips and the mouth,
 *     drawn crisp at any distance (they are worked out per pixel from where
 *     the point sits on the head, not from a picture).
 *   - Six face shapes (morph targets) made from the head itself: smile
 *     (corners up and out, cheeks up, the eye smile), frown, jaw open, brows
 *     up, brows in, lips pressed. The painted mouth and brows ride on them.
 *
 * Positions are the REST pose in metres: y up, z out of the face, his left at +x.
 */
import type * as THREE from "three";
import { PEOPLE3D_SHADER, type Person3D, type PersonModel } from "../people3d";

type Three = typeof import("three");
type V2 = [number, number];
type V3 = [number, number, number];

/** Where each head's features are, measured from its own painted texture
 *  (tools/cutscene/measure_faces.py: an orthographic front render). */
export interface FaceLandmarks {
  /** Iris centres, his right (−x) then his left (+x). */
  eyes: [V2, V2];
  /** The skin's depth at the iris centres. */
  eyeZ: number;
  browY: number;
  mouthY: number;
  mouthZ: number;
  /** Half the mouth's width. */
  mouthW: number;
  nose: V3;
  chinY: number;
}

export const FACE_LANDMARKS: Record<PersonModel, FaceLandmarks> = {
  player: { eyes: [[-0.0354, 1.6811], [0.0346, 1.6815]], eyeZ: 0.0634, browY: 1.6974, mouthY: 1.6078, mouthZ: 0.0753, mouthW: 0.0235, nose: [-0.0004, 1.6425, 0.0933], chinY: 1.573 },
  "player-buzz": { eyes: [[-0.0364, 1.695], [0.0343, 1.6948]], eyeZ: 0.081, browY: 1.7085, mouthY: 1.6185, mouthZ: 0.0891, mouthW: 0.025, nose: [-0.001, 1.655, 0.1097], chinY: 1.586 },
  "player-long": { eyes: [[-0.0368, 1.683], [0.0349, 1.6827]], eyeZ: 0.0707, browY: 1.699, mouthY: 1.6005, mouthZ: 0.0758, mouthW: 0.0235, nose: [-0.001, 1.6425, 0.0997], chinY: 1.568 },
  manager: { eyes: [[-0.0393, 1.6702], [0.0364, 1.6718]], eyeZ: 0.0845, browY: 1.6865, mouthY: 1.584, mouthZ: 0.0903, mouthW: 0.026, nose: [-0.0015, 1.63, 0.1188], chinY: 1.559 },
};

/** The eye opening cut in the head (metres): half width, height over and under the iris centre, outer-corner lift. */
const APERTURE = { halfW: 0.0142, up: 0.0064, low: 0.0047, tilt: 0.0006 };
/** The eyeball: a lens (an ellipsoid), its radii, set this far behind the skin. */
const EYEBALL = { rx: 0.0158, ry: 0.0122, rz: 0.0098, back: 0.0013 };

// ── Expression parameters ─────────────────────────────────────────────────

/** Everything a face can do. All 0 = a calm, neutral face. */
export interface FaceParams {
  /** Mouth corners: −1 down (sad) … 1 up (big smile). */
  smile: number;
  /** Jaw open 0 … 1. */
  open: number;
  /** Mouth pulled wide (a grin, a roar, effort) 0 … 1. */
  wide: number;
  /** Teeth showing when open: 0 upper only … 1 both rows (gritted). */
  teeth: number;
  /** Lips pressed together and in (determined). */
  press: number;
  /** Cheeks up: the eyes smile (0 … 1). */
  cheek: number;
  /** Brows: whole raise, inner ends up (sad/moved), inner ends down and in (focus/anger). */
  browUp: number;
  browSad: number;
  browAngry: number;
  /** Upper lid: 0 shut, 1 open as normal, 1.3 wide. */
  lid: number;
  /** Lower lid raised (a squint) 0 … 1. */
  lidLow: number;
  /** Wet eyes and a tear (0 … 1). */
  tear: number;
}

export const NEUTRAL_FACE: FaceParams = {
  smile: 0.04, open: 0, wide: 0, teeth: 0, press: 0, cheek: 0, browUp: 0, browSad: 0, browAngry: 0, lid: 1, lidLow: 0, tear: 0,
};

/** The named expressions (Harry's list, plus effort for the goal run). */
export const EXPRESSIONS = {
  neutral: NEUTRAL_FACE,
  smile: { ...NEUTRAL_FACE, smile: 0.6, cheek: 0.55, browUp: 0.12, lid: 0.95, lidLow: 0.3 },
  joy: { ...NEUTRAL_FACE, smile: 1, open: 0.85, wide: 0.55, teeth: 0.15, cheek: 1, browUp: 0.7, lid: 0.85, lidLow: 0.55 },
  roar: { ...NEUTRAL_FACE, smile: 0.55, open: 1, wide: 0.75, teeth: 0.45, cheek: 0.8, browUp: 0.35, browAngry: 0.25, lid: 0.8, lidLow: 0.5 },
  determined: { ...NEUTRAL_FACE, smile: -0.1, press: 0.8, browAngry: 0.85, lid: 0.82, lidLow: 0.35 },
  effort: { ...NEUTRAL_FACE, smile: 0.25, open: 0.32, wide: 0.9, teeth: 1, browAngry: 1, cheek: 0.45, lid: 0.7, lidLow: 0.6 },
  proud: { ...NEUTRAL_FACE, smile: 0.5, cheek: 0.4, browUp: 0.25, press: 0.15, lid: 0.92, lidLow: 0.25 },
  emotional: { ...NEUTRAL_FACE, smile: 0.5, cheek: 0.45, browSad: 0.85, press: 0.25, lid: 0.82, lidLow: 0.35, tear: 1 },
  disappointed: { ...NEUTRAL_FACE, smile: -0.7, browSad: 0.6, browUp: 0.1, press: 0.35, lid: 0.68, lidLow: 0.1 },
  surprised: { ...NEUTRAL_FACE, open: 0.45, browUp: 1, lid: 1.3, smile: 0 },
  talk: { ...NEUTRAL_FACE, smile: 0.2, open: 0.25, cheek: 0.15 },
} satisfies Record<string, FaceParams>;
export type ExpressionName = keyof typeof EXPRESSIONS;

const KEYS = Object.keys(NEUTRAL_FACE) as (keyof FaceParams)[];

/** a + (b − a)·k on every number. */
export function mixFace(a: FaceParams, b: FaceParams, k: number): FaceParams {
  const o = { ...a };
  for (const key of KEYS) o[key] = a[key] + (b[key] - a[key]) * k;
  return o;
}

/** A weighted blend of named expressions (weights need not add to 1: the rest is neutral). */
export function blendExpressions(w: Partial<Record<ExpressionName, number>>): FaceParams {
  const o = { ...NEUTRAL_FACE };
  for (const [name, wt] of Object.entries(w) as [ExpressionName, number][]) {
    if (!wt) continue;
    const e = EXPRESSIONS[name];
    for (const key of KEYS) o[key] += (e[key] - NEUTRAL_FACE[key]) * wt;
  }
  return o;
}

// ── The head's shader ─────────────────────────────────────────────────────

const FACE_HEAD = /* glsl */ `
uniform vec3 uEyeR, uEyeL;
uniform vec4 uFaceB;     // brow y, mouth y, mouth half width, chin y
uniform vec3 uNose;
uniform vec4 uAp;        // aperture half width, up, low, tilt
uniform vec3 uSkinF, uHairF, uLashC;
uniform vec4 uMouthA;    // smile, open, wide, teeth
uniform vec4 uMouthB;    // press, cheek, tear, beard
uniform vec3 uBrow;      // up, sad, angry
uniform float uEyeZ;
float cfSmooth(float e, float x, float aa) { return smoothstep(e - aa, e + aa, x); }

// One eye's opening, lash, crease and lower lash (q: front x, y; side: +1 his left).
vec4 cfEye(vec2 q, vec3 E, float side, float aa) {
  float u = (q.x - E.x) * side / uAp.x;
  float t = clamp(u, -1.0, 1.0);
  float k = max(0.0, 1.0 - t * t);
  float yu = E.y + uAp.y * pow(k, 0.5) * (1.0 - 0.16 * t) + uAp.w * t;
  float yl = E.y - uAp.z * pow(k, 0.75) * (1.0 + 0.12 * t) + uAp.w * t * 0.3;
  float inX = 1.0 - cfSmooth(1.0, abs(u), aa / uAp.x);
  float inside = inX * cfSmooth(yl, q.y, aa) * (1.0 - cfSmooth(yu, q.y, aa));
  float dU = q.y - yu;
  float lw = 0.00055 + 0.0011 * smoothstep(-0.6, 1.0, u);
  float flick = smoothstep(0.85, 1.0, u) * (1.0 - smoothstep(1.0, 1.16, u));
  float lashX = max(inX, flick);
  float lash = lashX * cfSmooth(-0.0002, dU, aa) * (1.0 - cfSmooth(lw + flick * 0.0006, dU, aa));
  float cy = yu + 0.0042 + 0.0006 * u;
  float crease = smoothstep(-0.75, -0.4, u) * (1.0 - smoothstep(0.75, 1.0, u)) * (1.0 - cfSmooth(0.00032, abs(q.y - cy), aa));
  float dL = yl - q.y;
  float lower = smoothstep(-0.4, 0.2, u) * inX * cfSmooth(-0.0001, dL, aa) * (1.0 - cfSmooth(0.00045, dL, aa));
  return vec4(inside, lash, crease, lower);
}

// One brow's coverage (side: +1 his left).
float cfBrow(vec2 q, float side, float aa) {
  float ax = (q.x - uNose.x) * side;
  float t = (ax - 0.0095 + uBrow.z * 0.0018) / 0.0435;
  float tc = clamp(t, 0.0, 1.0);
  float b = uFaceB.x;
  float y0 = b - 0.0014 + uBrow.y * 0.0042 - uBrow.z * 0.0032 + uBrow.x * 0.0028;
  float y1 = b + 0.0030 + uBrow.x * 0.0036 + uBrow.y * 0.0006 - uBrow.z * 0.0008;
  float y2 = b - 0.0012 + uBrow.x * 0.0024 - uBrow.y * 0.0022 + uBrow.z * 0.0006;
  float L0 = (tc - 0.58) * (tc - 1.0) / 0.58;
  float L1 = tc * (tc - 1.0) / (0.58 * -0.42);
  float L2 = tc * (tc - 0.58) / 0.42;
  float yc = y0 * L0 + y1 * L1 + y2 * L2;
  float th = 0.0021 * (1.0 - 0.62 * tc) + 0.00045;
  float d = abs(q.y - yc) - th;
  float ends = smoothstep(-0.03, 0.03, t) * (1.0 - smoothstep(0.95, 1.03, t));
  float hairy = 0.75 + 0.25 * sin(t * 160.0 + q.y * 1800.0);
  return ends * (1.0 - cfSmooth(0.0, d, aa * 1.5)) * mix(1.0, hairy, smoothstep(-0.0004, 0.0, d));
}`;

const FACE_PAINT = /* glsl */ `
{
  // ── The cut-scene face ──
  vec2 q = r.xy;
  float aa = max(fwidth(r.y), 0.00008);
  float frontF = smoothstep(0.02, 0.22, vRestN.z) * step(uEyeZ - 0.03, r.z);
  float faceBox = frontF * (1.0 - smoothstep(0.052, 0.06, abs(r.x - uNose.x))) * step(uFaceB.w - 0.004, r.y) * (1.0 - smoothstep(uFaceB.x + 0.009, uFaceB.x + 0.014, r.y));
  float tl = clamp(lum / uSkinRef, 0.84, 1.1);
  vec3 sk = uSkinF * mix(1.0, tl, 0.45);
  col = mix(col, sk, max(skin, faceBox));
  // Hair: the chosen colour, the scan's strand shading kept but its white scratches gone.
  float hl = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)) / uHairL, 0.86, 1.12) * (0.82 + 0.18 * smoothstep(-0.4, 0.6, vRestN.y));
  float sheen = smoothstep(0.45, 0.7, vRestN.y) * (1.0 - smoothstep(0.75, 0.95, vRestN.y)) * (0.6 + 0.4 * sin(r.x * 900.0 + r.z * 500.0));
  col = mix(col, uHairF * hl * (1.0 + 0.35 * sheen), hair * (1.0 - faceBox));

  if (faceBox > 0.0) {
    // Soft painted form: socket shade under the brow, warm nose, blush.
    for (int i = 0; i < 2; i++) {
      vec3 E = i == 0 ? uEyeR : uEyeL;
      vec2 so = (q - vec2(E.x, E.y + 0.0045)) / vec2(0.019, 0.0095);
      col *= mix(1.0, 0.93, exp(-dot(so, so) * 1.5));
      vec2 bl = (q - vec2(E.x + (i == 0 ? -0.004 : 0.004), E.y - 0.024 + uMouthB.y * 0.003)) / vec2(0.016, 0.009);
      col = mix(col, col * vec3(1.06, 0.84, 0.82), (0.22 + 0.3 * uMouthB.y) * exp(-dot(bl, bl) * 1.6));
    }
    vec2 nt = (q - uNose.xy - vec2(0.0, -0.002)) / vec2(0.008, 0.006);
    col = mix(col, col * vec3(1.05, 0.9, 0.88), 0.35 * exp(-dot(nt, nt)));
    for (int i = 0; i < 2; i++) {
      float sd = i == 0 ? -1.0 : 1.0;
      vec2 nn = (q - vec2(uNose.x + sd * 0.0072, uNose.y - 0.0085)) / vec2(0.0032, 0.0016);
      col = mix(col, col * vec3(0.55, 0.38, 0.34), 0.75 * (1.0 - smoothstep(0.6, 1.0, length(nn))));
    }

    // The mouth (q in mouth units: u across, v up).
    float mw0 = uFaceB.z;
    float sm = uMouthA.x, op = uMouthA.y, wd = uMouthA.z, th = uMouthA.w, pr = uMouthB.x;
    float mw = mw0 * (1.0 + 0.12 * max(sm, 0.0) + 0.2 * wd - 0.1 * pr);
    float u = (q.x - uNose.x) / mw;
    float v = (q.y - uFaceB.y) / mw0;
    float aav = aa / mw0;
    float k = max(0.0, 1.0 - u * u);
    float yc = (sm > 0.0 ? 0.2 : 0.15) * sm * u * u - 0.04 * sm;
    float yt = yc + op * (0.06 + 0.16 * wd) * pow(k, 0.55);
    float yb = yc - op * (0.42 + 0.08 * wd) * pow(k, 0.7 - 0.25 * wd);
    float inX = 1.0 - cfSmooth(1.0, abs(u), aav * 2.0);
    // lips: upper a touch darker, lower lighter with a sheen, a shade under it
    float lipU = inX * cfSmooth(yt, v, aav) * (1.0 - cfSmooth(yt + 0.2 * pow(k, 0.5) * (1.0 - 0.6 * pr), v, aav * 3.0));
    float lipL = inX * (1.0 - cfSmooth(yb, v, aav)) * cfSmooth(yb - 0.26 * pow(k, 0.5) * (1.0 - 0.6 * pr), v, aav * 4.0);
    col = mix(col, col * vec3(0.86, 0.64, 0.6), 0.55 * lipU);
    col = mix(col, col * vec3(0.98, 0.76, 0.72), 0.45 * lipL);
    float under = inX * exp(-pow((v - (yb - 0.38)) / 0.09, 2.0)) * pow(k, 0.7);
    col *= mix(1.0, 0.9, under * (1.0 - 0.5 * op));
    // the opening
    float open = step(0.004, op) * inX * cfSmooth(yb, v, aav) * (1.0 - cfSmooth(yt, v, aav));
    if (open > 0.0) {
      vec3 m = vec3(0.16, 0.025, 0.03);
      float h = max(yt - yb, 0.001);
      float topT = cfSmooth(yt - (0.12 + 0.06 * wd) * min(1.0, op * 2.5), v, aav) * (1.0 - smoothstep(0.82, 0.97, abs(u)));
      float botT = th * (1.0 - cfSmooth(yb + 0.1 * min(1.0, op * 3.0), v, aav)) * (1.0 - smoothstep(0.72, 0.92, abs(u)));
      vec2 tg = vec2(u / 0.6, (v - yb - 0.05) / max(0.13, h * 0.45));
      float tongue = (1.0 - th) * (1.0 - cfSmooth(1.0, length(tg), 0.08)) * step(v, yb + h * 0.5);
      m = mix(m, vec3(0.55, 0.13, 0.15), tongue);
      vec3 teeth = vec3(0.92, 0.88, 0.8) * (0.86 + 0.14 * smoothstep(0.0, 0.6, 1.0 - abs(u)));
      m = mix(m, teeth, max(topT, botT));
      float rimD = min(v - yb, yt - v) / max(h, 0.05);
      m *= mix(0.55, 1.0, smoothstep(0.0, 0.25, rimD));
      col = mix(col, m, open);
    }
    // the line between the lips (closed) and the edge of the opening
    float lw = (0.028 + 0.016 * pr) * pow(k, 0.4) + 0.006;
    float lineC = inX * (1.0 - cfSmooth(lw, abs(v - yc), aav)) * (1.0 - step(0.004, op));
    float edge = inX * step(0.004, op) * (1.0 - cfSmooth(lw * 0.9, min(abs(v - yt), abs(v - yb)), aav));
    // corner tucks when smiling (or pulled down when sad)
    float tuck = 0.0;
    for (int i = 0; i < 2; i++) {
      float sd = i == 0 ? -1.0 : 1.0;
      vec2 cc = vec2(u - sd * (1.0 + 0.04 * abs(sm)), v - (yc + (sm > 0.0 ? 0.2 : 0.15) * sm + 0.07 * sm));
      tuck += abs(sm) * (1.0 - cfSmooth(0.022, abs(length(cc / vec2(0.09, 0.14)) - 1.0) * 0.1, aav)) * step(-0.2 * sd, -sd * cc.x + 0.05) ;
    }
    vec3 lineCol = vec3(0.28, 0.1, 0.08);
    col = mix(col, lineCol, max(max(lineC, edge), min(1.0, tuck) * 0.7));
    // smile lines from the nose wings
    float sl = max(sm, 0.0) * 0.6 + uMouthB.y * 0.35;
    if (sl > 0.01) {
      for (int i = 0; i < 2; i++) {
        float sd = i == 0 ? -1.0 : 1.0;
        float ya = uNose.y - 0.006, yb2 = uFaceB.y - 0.004;
        float tt = clamp((ya - q.y) / (ya - yb2), 0.0, 1.0);
        float xx = uNose.x + sd * (0.019 + (mw + 0.005 - 0.019) * tt + 0.004 * sin(3.14159 * tt));
        float on = step(yb2, q.y) * step(q.y, ya) * smoothstep(0.0, 0.25, tt) * (1.0 - smoothstep(0.75, 1.0, tt));
        col = mix(col, col * vec3(0.8, 0.62, 0.58), sl * 0.55 * on * (1.0 - cfSmooth(0.0005, abs(q.x - xx), aa)));
      }
    }
    // beard (the manager's), painted under the nose and round the jaw
    if (uMouthB.w > 0.0) {
      float bx = abs(q.x - uNose.x);
      float cheekLine = uFaceB.y + 0.026 - bx * 0.15;
      float bm = step(q.y, uNose.y - 0.0115) * (1.0 - smoothstep(cheekLine - 0.004, cheekLine, q.y)) * (1.0 - smoothstep(0.052, 0.06, bx));
      float lips = inX * cfSmooth(yb - 0.2, v, aav) * (1.0 - cfSmooth(yt + 0.16, v, aav));
      bm *= (1.0 - lips) * (1.0 - open);
      float grain = 0.82 + 0.18 * sin(q.x * 4100.0) * sin(q.y * 3700.0 + q.x * 900.0);
      col = mix(col, uHairF * 1.25 * grain, uMouthB.w * bm);
    }

    // Brows and the eyes' painted lines; the openings themselves are cut out.
    float br = max(cfBrow(q, -1.0, aa), cfBrow(q, 1.0, aa));
    col = mix(col, uHairF * 0.75, br * 0.96);
    vec4 eR = cfEye(q, uEyeR, -1.0, aa);
    vec4 eL = cfEye(q, uEyeL, 1.0, aa);
    float lash = max(eR.y, eL.y), crease = max(eR.z, eL.z), lowl = max(eR.w, eL.w);
    col = mix(col, uLashC, lash);
    col = mix(col, col * vec3(0.7, 0.52, 0.48), 0.55 * crease);
    col = mix(col, col * vec3(0.6, 0.42, 0.38), 0.5 * lowl);
    // a tear on the cheek
    if (uMouthB.z > 0.01) {
      vec2 td = (q - vec2(uEyeL.x + 0.004, uEyeL.y - 0.014)) / vec2(0.0018, 0.0026);
      float tear = uMouthB.z * (1.0 - smoothstep(0.7, 1.0, length(td)));
      col = mix(col, vec3(0.95, 0.97, 1.0), tear * 0.75);
    }
    if (max(eR.x, eL.x) > 0.5) discard;
  }
}`;

/** The eyeball's own shader: white, iris, pupil, catchlights, the lids and lashes. */
const EYE_VERT_HEAD = `varying vec3 vEyeP;`;
const EYE_FRAG_HEAD = /* glsl */ `
varying vec3 vEyeP;
uniform vec3 uGaze, uIris, uSkinE, uLashC;
uniform vec2 uLid;     // upper lid edge, lower lid edge (unit eyeball height)
uniform float uSide, uWet;
float eyeCatch = 0.0;`;
const EYE_FRAG_BODY = /* glsl */ `
{
  vec3 p = normalize(vEyeP);
  float x = p.x * uSide;
  float aa = max(fwidth(p.y), 0.002);
  float lu = uLid.x * sqrt(max(0.0, 1.0 - 0.7 * p.x * p.x)) - 0.05 * x;
  float ll = uLid.y * sqrt(max(0.0, 1.0 - 0.55 * p.x * p.x)) + 0.03 * x;
  float closed = 1.0 - smoothstep(0.0, 0.08, lu - ll);
  float meet = mix(lu, (lu + ll) * 0.5, closed);
  float upper = smoothstep(meet - aa, meet + aa, p.y);
  float lower = 1.0 - smoothstep(ll - aa, ll + aa, p.y);
  float lidM = max(max(upper, lower), closed);

  vec3 g = normalize(uGaze);
  float cd = dot(p, g);
  vec3 pp = p - g * cd;
  vec3 up0 = normalize(vec3(0.0, 1.0, 0.0) - g * g.y);
  vec3 rt = cross(up0, g);
  vec2 ip = vec2(dot(pp, rt), dot(pp, up0)) / 0.47;
  float ir = length(ip);
  float iaa = aa * 2.5;
  vec3 scl = vec3(0.95, 0.9, 0.86) * (1.0 - 0.28 * smoothstep(0.35, 0.95, abs(p.x)));
  vec3 iris = uIris * (0.8 + 0.45 * smoothstep(-0.1, -0.85, ip.y) * smoothstep(0.25, 0.55, ir));
  iris *= 0.9 + 0.1 * sin(atan(ip.y, ip.x) * 23.0);
  iris = mix(iris, uIris * 0.32, smoothstep(0.72, 0.95, ir));
  iris = mix(iris, vec3(0.02, 0.012, 0.01), 1.0 - smoothstep(0.36 - iaa, 0.36 + iaa, ir));
  float irisM = (1.0 - smoothstep(1.0 - iaa, 1.0 + iaa, ir)) * step(0.0, cd);
  vec3 eye = mix(scl, iris, irisM);
  eye = mix(eye, vec3(0.86, 0.6, 0.58), smoothstep(0.78, 0.98, -x) * 0.6);
  float sh = smoothstep(meet - 0.5, meet, p.y);
  eye *= mix(1.0, 0.5, sh);
  // catchlights: a big one up-left of the pupil, a small one down-right
  float c1 = 1.0 - smoothstep(0.17, 0.2, length(ip - vec2(-0.3, 0.32)));
  float c2 = 1.0 - smoothstep(0.065, 0.085, length(ip - vec2(0.3, -0.26)));
  eyeCatch = (c1 + 0.8 * c2 + uWet * 0.6 * (1.0 - smoothstep(0.0, 0.06, abs(p.y - ll - 0.04)))) * irisM * (1.0 - lidM) * (1.0 - 0.7 * sh);
  eyeCatch += uWet * 0.35 * (1.0 - lidM) * (1.0 - smoothstep(0.0, 0.05, abs(p.y - ll - 0.035)));

  vec3 lid = uSkinE * (upper > 0.5 ? 0.95 : 1.0);
  float lw = 0.07 + 0.09 * smoothstep(-0.5, 1.0, x);
  float lashU = smoothstep(meet - aa, meet, p.y) * (1.0 - smoothstep(meet + lw - aa, meet + lw + aa, p.y));
  float lashL = (1.0 - smoothstep(ll - 0.035, ll, p.y)) * smoothstep(ll - 0.035 - aa, ll - 0.035, p.y) * smoothstep(-0.4, 0.3, x) * (1.0 - closed);
  lid = mix(lid, uLashC, max(lashU, lashL * 0.6));
  diffuseColor.rgb = mix(eye, lid, lidM);
}`;

// ── Lighting: soft bands, warm shadows, a gold rim ────────────────────────

/** The toon ramp: a soft step at the terminator (Golden Hour look A). */
export function makeToonRamp(T: Three): THREE.DataTexture {
  const n = 64;
  const d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1); // dotNL * 0.5 + 0.5
    const s = 1 / (1 + Math.exp(-(x - 0.5) * 11));
    const v = 0.5 + 0.47 * s + 0.05 * Math.max(0, (x - 0.82) / 0.18);
    d.set([Math.round(v * 255), Math.round(v * 255), Math.round(v * 255), 255], i * 4);
  }
  const t = new T.DataTexture(d, n, 1);
  t.magFilter = T.LinearFilter; t.minFilter = T.LinearFilter; t.needsUpdate = true;
  return t;
}

/** Shared lighting extras (one set per scene): rim direction (world), colour, and the shadow tint. */
export interface CutLight { rimDir: THREE.Vector3; rimColor: THREE.Color; rim: { value: number }; shadeTint: THREE.Color }

export function makeCutLight(T: Three): CutLight {
  return { rimDir: new T.Vector3(0.4, 0.25, -0.9).normalize(), rimColor: new T.Color("#ffc27a"), rim: { value: 0.55 }, shadeTint: new T.Color(0.97, 0.86, 0.84) };
}

const LIGHT_HEAD = /* glsl */ `
uniform vec3 uRimDirV, uRimCol, uShadeTint;
uniform float uRimK;`;
const LIGHT_RIM = /* glsl */ `
{
  vec3 vv = normalize(vViewPosition);
  float fr = pow(1.0 - clamp(dot(normal, -vv) * -1.0 + 0.0, 0.0, 1.0), 1.0);
  float ndv = clamp(dot(normal, normalize(-vViewPosition)), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 3.0) * smoothstep(-0.1, 0.5, dot(normal, uRimDirV));
  totalEmissiveRadiance += uRimCol * rim * uRimK * diffuseColor.rgb * 2.2;
}`;
const LIGHT_TINT = /* glsl */ `
{
  float lv = dot(outgoingLight, vec3(0.333)) / max(dot(diffuseColor.rgb, vec3(0.333)), 1e-3);
  outgoingLight *= mix(uShadeTint, vec3(1.0), smoothstep(0.45, 1.05, lv));
}
#include <opaque_fragment>`;

/** Patch a toon material with the rim and warm shadows (call before first use). */
function lightUniforms(T: Three, L: CutLight) {
  return {
    uRimDirV: { value: new T.Vector3() }, uRimCol: { value: L.rimColor }, uShadeTint: { value: L.shadeTint }, uRimK: L.rim,
  };
}

// ── Building it ───────────────────────────────────────────────────────────

/** The six face shapes, in the order of the morph targets. */
const SHAPES = ["smile", "frown", "jaw", "browUp", "browIn", "press"] as const;

export interface FaceRig {
  model: PersonModel;
  lm: FaceLandmarks;
  /** The current face (write to it, or use setParams). */
  params: FaceParams;
  /** Where the eyes look, in the head's rest frame (a unit vector; +z = straight ahead). */
  gaze: THREE.Vector3;
  eyes: THREE.Mesh[];
  /** Uniforms shared with the body (skin, hair …). */
  u: Record<string, { value: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  eyeU: Record<string, { value: any }>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Call each frame (after posing), with the camera, to push params into the shaders. */
  apply(camera: THREE.Camera | null, blink: number): void;
  dispose(): void;
}

export interface FaceOptions {
  skin: string;
  hair?: string;
  /** Iris colour. */
  iris?: string;
  /** Painted beard / stubble 0 … 1 (managers). */
  beard?: number;
  light: CutLight;
  ramp: THREE.Texture;
}

/** Turn a made person (makePerson3d) into a cut-scene person: painted toon
 *  body, real eyes, face shapes. Call once, before dressPerson3d or after. */
export function addCutsceneFace(T: Three, p: Person3D, o: FaceOptions): FaceRig {
  const model = p.meta.model;
  const lm = FACE_LANDMARKS[model];
  const body = p.body;
  const old = body.material as THREE.MeshStandardMaterial;

  // The body's own geometry is shared by every copy of this file: a copy for the shapes.
  const geo = body.geometry.clone();
  buildFaceShapes(T, geo, lm);
  body.geometry = geo;
  p.outline.geometry = geo;
  body.updateMorphTargets();
  p.outline.updateMorphTargets();
  p.outline.morphTargetInfluences = body.morphTargetInfluences;

  const lin = (hex: string) => new T.Color(hex);
  const skinC = lin(o.skin);
  const hairC = lin(o.hair ?? "#2b1b12");
  const eyeL = lm.eyes[1], eyeR = lm.eyes[0];
  const fu = {
    uEyeR: { value: new T.Vector3(eyeR[0], eyeR[1], lm.eyeZ) },
    uEyeL: { value: new T.Vector3(eyeL[0], eyeL[1], lm.eyeZ) },
    uFaceB: { value: new T.Vector4(lm.browY, lm.mouthY, lm.mouthW, lm.chinY) },
    uNose: { value: new T.Vector3(...lm.nose) },
    uAp: { value: new T.Vector4(APERTURE.halfW, APERTURE.up, APERTURE.low, APERTURE.tilt) },
    uSkinF: { value: new T.Vector3(skinC.r, skinC.g, skinC.b) },
    uHairF: { value: new T.Vector3(hairC.r, hairC.g, hairC.b) },
    uLashC: { value: new T.Vector3(0.07, 0.035, 0.025) },
    uMouthA: { value: new T.Vector4() },
    uMouthB: { value: new T.Vector4(0, 0, 0, o.beard ?? 0) },
    uBrow: { value: new T.Vector3() },
    uEyeZ: { value: lm.eyeZ },
  };
  const lu = lightUniforms(T, o.light);
  const mat = new T.MeshToonMaterial({ map: old.map, normalMap: old.normalMap ?? null, gradientMap: o.ramp });
  if (old.normalMap) mat.normalScale = new T.Vector2(0.35, 0.35);
  const { VERT_HEAD, FRAG_HEAD, FRAG_BODY } = PEOPLE3D_SHADER;
  const paint = FRAG_BODY.replace(/diffuseColor\.rgb = col;\s*\}\s*$/, `${FACE_PAINT}\n  diffuseColor.rgb = col;\n}`);
  if (paint === FRAG_BODY) throw new Error("cut-scene face: the body shader changed shape");
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, p.u, fu, lu);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>${VERT_HEAD}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position;\nvRestN = normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>${FRAG_HEAD}${FACE_HEAD}${LIGHT_HEAD}`)
      .replace("#include <map_fragment>", `#include <map_fragment>${paint}`)
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nvec3 p3GeoN = normal;")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = normalize(mix(normal, p3GeoN, 0.55));")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>${LIGHT_RIM}`)
      .replace("#include <opaque_fragment>", LIGHT_TINT);
  };
  mat.customProgramCacheKey = () => "cutscene-face-v1";
  body.material = mat;
  old.dispose?.();

  // Warm, thin outline that stays thin in close-ups.
  const om = p.outline.material as THREE.MeshBasicMaterial;
  om.color = new T.Color("#3b2416");

  // The eyes, hung on the head bone at their rest place.
  const head = p.bones.Head;
  const hi = body.skeleton.bones.indexOf(head);
  const restToHead = body.skeleton.boneInverses[hi].clone().multiply(body.bindMatrix);
  const eyeGeo = new T.SphereGeometry(1, 40, 28);
  const sockGeo = new T.SphereGeometry(1, 20, 14);
  const irisC = lin(o.iris ?? "#5a3a22");
  const eyes: THREE.Mesh[] = [];
  const eyeU: Record<string, { value: any }>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let i = 0; i < 2; i++) {
    const e = i === 0 ? eyeR : eyeL;
    const side = i === 0 ? -1 : 1;
    const centre = new T.Vector3(e[0], e[1], lm.eyeZ - EYEBALL.rz - EYEBALL.back);
    const place = restToHead.clone().multiply(new T.Matrix4().compose(centre, new T.Quaternion(), new T.Vector3(EYEBALL.rx, EYEBALL.ry, EYEBALL.rz)));
    const eu = {
      uGaze: { value: new T.Vector3(0, 0, 1) }, uIris: { value: new T.Vector3(irisC.r, irisC.g, irisC.b) },
      uSkinE: fu.uSkinF, uLashC: fu.uLashC, uLid: { value: new T.Vector2(0.5, -0.62) }, uSide: { value: side }, uWet: { value: 0 },
    };
    const em = new T.MeshToonMaterial({ gradientMap: o.ramp });
    em.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, eu, lu);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>\n${EYE_VERT_HEAD}`)
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvEyeP = position;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>\n${EYE_FRAG_HEAD}${LIGHT_HEAD}`)
        .replace("#include <map_fragment>", `#include <map_fragment>\n${EYE_FRAG_BODY}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.97, 0.92) * eyeCatch * 1.6;${LIGHT_RIM}`)
        .replace("#include <opaque_fragment>", LIGHT_TINT);
    };
    em.customProgramCacheKey = () => "cutscene-eye-v1";
    const eye = new T.Mesh(eyeGeo, em);
    eye.name = `eye${side > 0 ? "L" : "R"}`;
    eye.matrixAutoUpdate = false;
    eye.matrix.copy(place);
    eye.frustumCulled = false;
    head.add(eye);
    // A dark socket behind it, so no gap ever shows the inside of the head.
    const sock = new T.Mesh(sockGeo, new T.MeshBasicMaterial({ color: 0x2a140c, side: T.BackSide }));
    sock.matrixAutoUpdate = false;
    sock.matrix.copy(restToHead.clone().multiply(new T.Matrix4().compose(centre.clone().add(new T.Vector3(0, 0, -0.001)), new T.Quaternion(), new T.Vector3(EYEBALL.rx * 1.12, EYEBALL.ry * 1.12, EYEBALL.rz * 1.05))));
    sock.frustumCulled = false;
    head.add(sock);
    eyes.push(eye);
    eyeU.push(eu);
  }

  const gaze = new T.Vector3(0, 0, 1);
  const params = { ...NEUTRAL_FACE };
  const rimV = new T.Vector3();
  const rig: FaceRig = {
    model, lm, params, gaze, eyes, u: fu, eyeU,
    apply(camera, blink) {
      const f = rig.params;
      const inf = body.morphTargetInfluences!;
      const pos = (x: number) => Math.max(0, x);
      inf[0] = Math.min(1, pos(f.smile) * 0.9 + f.cheek * 0.35);
      inf[1] = pos(-f.smile) * 0.9;
      inf[2] = f.open;
      inf[3] = f.browUp;
      inf[4] = Math.max(f.browAngry, f.browSad * 0.25);
      inf[5] = f.press;
      fu.uMouthA.value.set(f.smile, f.open, f.wide, f.teeth);
      fu.uMouthB.value.set(f.press, f.cheek, f.tear, fu.uMouthB.value.w);
      fu.uBrow.value.set(f.browUp, f.browSad, f.browAngry);
      // lids: upper edge from the opening and blink; lower from squint and cheeks
      const g = rig.gaze;
      const open = Math.max(0, f.lid) * (1 - blink);
      const up = -0.42 + 0.95 * open + 0.3 * Math.min(0, g.y) + 0.12 * Math.max(0, g.y);
      const low = -0.64 + 0.3 * f.lidLow + 0.16 * f.cheek + 0.12 * Math.min(0, g.y);
      for (const eu of eyeU) {
        eu.uGaze.value.copy(g);
        eu.uLid.value.set(Math.min(0.78, up), low);
        eu.uWet.value = f.tear;
      }
      if (camera) {
        rimV.copy(o.light.rimDir).transformDirection(camera.matrixWorldInverse);
        lu.uRimDirV.value.copy(rimV);
      }
    },
    dispose() {
      eyeGeo.dispose(); sockGeo.dispose(); geo.dispose(); mat.dispose();
      for (const e of eyes) (e.material as THREE.Material).dispose();
    },
  };
  return rig;
}

/** Set skin/hair/iris after the fact (the career's look changed). */
export function setFaceColours(T: Three, rig: FaceRig, c: { skin?: string; hair?: string; iris?: string; beard?: number }) {
  if (c.skin) { const k = new T.Color(c.skin); rig.u.uSkinF.value.set(k.r, k.g, k.b); }
  if (c.hair) { const k = new T.Color(c.hair); rig.u.uHairF.value.set(k.r, k.g, k.b); }
  if (c.iris) { const k = new T.Color(c.iris); for (const e of rig.eyeU) e.uIris.value.set(k.r, k.g, k.b); }
  if (c.beard !== undefined) rig.u.uMouthB.value.w = c.beard;
}

// ── The face shapes (morph targets), made from the head's own rest positions ──

function gauss(dx: number, dy: number, dz: number, sx: number, sy: number, sz: number) {
  return Math.exp(-((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy) + (dz * dz) / (sz * sz)));
}

/** The shape deltas at a rest point (metres), one per SHAPES entry. */
export function faceShapeDeltas(lm: FaceLandmarks, x: number, y: number, z: number, out: Float32Array /* 6*3 */) {
  out.fill(0);
  if (y < lm.chinY - 0.06 || y > lm.browY + 0.05 || z < lm.eyeZ - 0.06) return;
  const cx = lm.nose[0];
  const front = Math.min(1, Math.max(0, (z - (lm.eyeZ - 0.05)) / 0.03));
  for (const s of [-1, 1]) {
    // smile: corners up, out and back; cheeks up and forward; the lower lids pushed up.
    const C = gauss(x - (cx + s * lm.mouthW), y - lm.mouthY, z - lm.mouthZ + 0.004, 0.011, 0.009, 0.02) * front;
    out[0] += s * 0.0018 * C; out[1] += 0.0034 * C; out[2] += -0.0014 * C;
    const K = gauss(x - (cx + s * 0.034), y - (lm.mouthY + 0.03), 0, 0.016, 0.013, 1) * front;
    out[1] += 0.0024 * K; out[2] += 0.0016 * K;
    const e = lm.eyes[s < 0 ? 0 : 1];
    const U = gauss(x - e[0], y - (e[1] - 0.0085), 0, 0.012, 0.005, 1) * front;
    out[1] += 0.0011 * U; out[2] += 0.0006 * U;
    // frown: corners down
    out[4] += -0.0029 * C; out[3] += -s * 0.0004 * C;
    // brows in: inner ends down, in and forward
    const B = gauss(x - (cx + s * 0.015), y - lm.browY, 0, 0.011, 0.008, 1) * front;
    out[12] += -s * 0.0014 * B; out[13] += -0.0019 * B; out[14] += 0.0008 * B;
    // press: corners in, lips back
    out[15] += -s * 0.0011 * C;
  }
  // brows up: the band over the eyes
  const BU = Math.exp(-((y - lm.browY) ** 2) / 0.009 ** 2) * (1 - Math.min(1, Math.max(0, (Math.abs(x - cx) - 0.045) / 0.015))) * front;
  out[10] += 0.0024 * BU;
  // press: the lips back a touch
  const P = gauss(x - cx, y - lm.mouthY, 0, 0.022, 0.007, 1) * front;
  out[17] += -0.0011 * P;
  // jaw: everything under the lip line turns down about a hinge by the ears
  const below = Math.min(1, Math.max(0, (lm.mouthY + 0.0006 - y) / 0.0035));
  const neck = 1 - Math.min(1, Math.max(0, (lm.chinY - 0.012 - y) / 0.03));
  const wide = 1 - Math.min(1, Math.max(0, (Math.abs(x - cx) - 0.05) / 0.025));
  const hz = lm.mouthZ - 0.085, hy = lm.mouthY + 0.006;
  const dzj = z - hz;
  const w = below * neck * wide * Math.min(1, Math.max(0, dzj / 0.03));
  if (w > 0) {
    const a = 0.13 * w;
    const dy = y - hy, dz = dzj;
    const ny = dy * Math.cos(a) - dz * Math.sin(a);
    const nz = dy * Math.sin(a) + dz * Math.cos(a);
    out[7] += ny - dy; out[8] += nz - dz;
  }
}

function buildFaceShapes(T: Three, geo: THREE.BufferGeometry, lm: FaceLandmarks) {
  const pos = geo.getAttribute("position");
  const n = pos.count;
  const D = SHAPES.map(() => new Float32Array(n * 3));
  const tmp = new Float32Array(SHAPES.length * 3);
  const touched: number[] = [];
  for (let i = 0; i < n; i++) {
    faceShapeDeltas(lm, pos.getX(i), pos.getY(i), pos.getZ(i), tmp);
    let any = false;
    for (let s = 0; s < SHAPES.length; s++) {
      const dx = tmp[s * 3], dy = tmp[s * 3 + 1], dz = tmp[s * 3 + 2];
      if (dx || dy || dz) { D[s][i * 3] = dx; D[s][i * 3 + 1] = dy; D[s][i * 3 + 2] = dz; any = true; }
    }
    if (any) touched.push(i);
  }
  // Normal changes: the same way for the base and each shape, so seams cancel.
  const index = geo.getIndex();
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i); }
  const near = new Uint8Array(n);
  for (const i of touched) near[i] = 1;
  const tris: number[] = [];
  const idx = index ? (index.array as ArrayLike<number>) : null;
  const triCount = idx ? idx.length / 3 : n / 3;
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    if (near[a] || near[b] || near[c]) tris.push(a, b, c);
  }
  const normalsOf = (Q: Float32Array) => {
    const N = new Float32Array(n * 3);
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], c = tris[t + 2];
      const ux = Q[b * 3] - Q[a * 3], uy = Q[b * 3 + 1] - Q[a * 3 + 1], uz = Q[b * 3 + 2] - Q[a * 3 + 2];
      const vx = Q[c * 3] - Q[a * 3], vy = Q[c * 3 + 1] - Q[a * 3 + 1], vz = Q[c * 3 + 2] - Q[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { N[k * 3] += nx; N[k * 3 + 1] += ny; N[k * 3 + 2] += nz; }
    }
    for (const i of touched) {
      const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1;
      N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l;
    }
    return N;
  };
  const N0 = normalsOf(P);
  geo.morphAttributes.position = [];
  geo.morphAttributes.normal = [];
  for (let s = 0; s < SHAPES.length; s++) {
    const Q = P.slice();
    for (const i of touched) { Q[i * 3] += D[s][i * 3]; Q[i * 3 + 1] += D[s][i * 3 + 1]; Q[i * 3 + 2] += D[s][i * 3 + 2]; }
    const N1 = normalsOf(Q);
    const DN = new Float32Array(n * 3);
    for (const i of touched) for (let k = 0; k < 3; k++) DN[i * 3 + k] = N1[i * 3 + k] - N0[i * 3 + k];
    const pa = new T.Float32BufferAttribute(D[s], 3); pa.name = SHAPES[s];
    const na = new T.Float32BufferAttribute(DN, 3); na.name = SHAPES[s];
    geo.morphAttributes.position.push(pa);
    geo.morphAttributes.normal.push(na);
  }
  geo.morphTargetsRelative = true;
}
