/**
 * A STYLE A FACE THAT MOVES (B5, 20 Oct 2026; Harry on the Home player: "eyes
 * maybe blinking and looking around and talking, maybe slightly moving their
 * lips"; the 3D plan step 4: "blinks, eyes that look at the other person, a
 * real smile at a trophy, a frown at bad news").
 *
 * On one made person (makePerson3d, a Style A head) it adds:
 *   - the six face shapes of the cut-scene face (cutscene/face.ts: smile,
 *     frown, jaw open, brows up, brows in, lips pressed), built from THIS
 *     head's own measured spots (faceLandmarks.ts), so the painted mouth and
 *     brows move with the skin;
 *   - the eye and mouth paint in the body shader (toon/shader.ts TOON_FACE):
 *     the painted iris slides where he looks, the lids blink and narrow, the
 *     mouth opens over its own lips.
 * No photo faces (Harry, 12 Oct 2026: off for everyone): only the drawn head.
 * The geometry becomes this person's own copy (the shapes live on it), so
 * only add a face where one is seen up close: cut scenes and Home.
 */
import type * as THREE from "three";
import type { Person3D } from "../../people3d";
import { buildFaceShapes, blendExpressions, NEUTRAL_FACE, type FaceLandmarks, type FaceParams, type ExpressionName } from "../../cutscene/face";
import { TOON_FACE_LANDMARKS, type ToonFaceLandmarks } from "./faceLandmarks";

type Three = typeof import("three");

/** Everything the face does this frame. */
export interface ToonFaceState {
  /** The expression (cutscene/face.ts FaceParams; NEUTRAL_FACE = calm). */
  face: FaceParams;
  /** 0 open … 1 shut. */
  blink: number;
  /** Where the eyes look: −1..1 across (his left +), −1..1 up. */
  gaze: [number, number];
  /** The voice: the mouth open 0..1 on top of the expression's own. */
  talk: number;
}

export interface ToonFaceRig {
  landmarks: ToonFaceLandmarks;
  set(s: Partial<ToonFaceState>): void;
  dispose(): void;
}

/** Faces move (the bench's before/after: `?face=old` on a test page keeps the painted faces still). */
export const TOON_FACE_ON = { on: typeof window === "undefined" || new URLSearchParams(window.location.search).get("face") !== "old" };

/** The cut-scene face's landmarks from a Style A head's measured ones. */
export function toonFaceLandmarks(lm: ToonFaceLandmarks): FaceLandmarks {
  return {
    eyes: [[lm.iris[0][0], lm.iris[0][1]], [lm.iris[1][0], lm.iris[1][1]]],
    eyeZ: lm.eyeZ, browY: lm.browY, mouthY: lm.mouth[1], mouthZ: lm.mouth[3], mouthW: lm.mouth[2],
    nose: lm.nose, chinY: lm.chinY,
  };
}

/** The game's named looks (types.ts Expression) as the cut-scene face's expressions. */
export const TOON_EXPRESSIONS: Record<string, Partial<Record<ExpressionName, number>>> = {
  neutral: {}, smile: { smile: 1 }, grin: { joy: 0.55, smile: 0.45 }, elated: { joy: 1 }, proud: { proud: 1 },
  determined: { determined: 1 }, focused: { determined: 0.6 }, tense: { determined: 0.5, surprised: 0.15 },
  sad: { disappointed: 0.8, emotional: 0.3 }, crying: { emotional: 1 }, angry: { determined: 1, roar: 0.3 },
  shocked: { surprised: 1 }, disappointed: { disappointed: 1 }, smirk: { smile: 0.55 }, talking: { talk: 1 },
  shout: { roar: 1 }, "eyes-closed": {}, joy: { joy: 1 }, roar: { roar: 1 }, surprised: { surprised: 1 },
  emotional: { emotional: 1 }, effort: { effort: 1 }, talk: { talk: 1 },
};

/** A face for this person, or null (not a Style A head, or no measured face for it). */
export function addToonFace(T: Three, p: Person3D): ToonFaceRig | null {
  const lm = p.toonHead ? TOON_FACE_LANDMARKS[p.toonHead] : undefined;
  if (!lm || !p.u.uTfOn || !TOON_FACE_ON.on) return null;
  const body = p.body;
  const shared = body.geometry;
  const geo = shared.clone();
  buildFaceShapes(T, geo, toonFaceLandmarks(lm));
  body.geometry = geo;
  p.outline.geometry = geo;
  body.updateMorphTargets();
  p.outline.updateMorphTargets();
  p.outline.morphTargetInfluences = body.morphTargetInfluences;

  const u = p.u as Record<string, { value: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  u.uTfOn.value.set(1, 0, 0, 0);
  u.uTfEyeR.value.set(...lm.eyes[0]);
  u.uTfEyeL.value.set(...lm.eyes[1]);
  u.uTfMouth.value.set(lm.mouth[0], lm.mouth[1], lm.mouth[2], 0);
  // the head's own paint, made linear like the picture the shader reads
  u.uTfWhite.value = new T.Color(lm.colors.white);
  u.uTfLidC.value = new T.Color(lm.colors.lid);
  u.uTfLash.value = new T.Color(lm.colors.lash);

  const state: ToonFaceState = { face: { ...NEUTRAL_FACE }, blink: 0, gaze: [0, 0], talk: 0 };
  const push = () => {
    const f = state.face;
    const inf = body.morphTargetInfluences!;
    const pos = (x: number) => Math.max(0, x);
    const open = Math.min(1, f.open + state.talk * 0.75);
    inf[0] = Math.min(1, pos(f.smile) * 0.9 + f.cheek * 0.35);
    inf[1] = pos(-f.smile) * 0.9;
    // no jaw shape: the opening is drawn over the lips (TOON_FACE), where the jaw shape would carry
    // the drawing down off the lips with the chin
    inf[2] = 0;
    inf[3] = f.browUp;
    inf[4] = Math.max(f.browAngry, f.browSad * 0.25);
    inf[5] = f.press * (1 - Math.min(1, state.talk));
    u.uTfOn.value.set(1, Math.min(1, Math.max(0, state.blink)), open, f.wide);
    // the upper lid heavier with a frown or a sad face (lid < 1); a smile lifts the lower lid
    u.uTfGaze.value.set(state.gaze[0], state.gaze[1], Math.min(1, Math.max(0, 1 + (f.lid - 1) * 0.6)), Math.min(0.6, f.lidLow * 0.5 + f.cheek * 0.2));
  };
  push();
  return {
    landmarks: lm,
    set(s) {
      if (s.face) state.face = s.face;
      if (s.blink !== undefined) state.blink = s.blink;
      if (s.gaze) state.gaze = [Math.max(-1, Math.min(1, s.gaze[0])), Math.max(-1, Math.min(1, s.gaze[1]))];
      if (s.talk !== undefined) state.talk = Math.max(0, Math.min(1, s.talk));
      push();
    },
    dispose() {
      body.geometry = shared;
      p.outline.geometry = shared;
      geo.dispose();
      u.uTfOn.value.set(0, 0, 0, 0);
    },
  };
}

/** A blend of the game's named looks (types.ts Expression) → the face's numbers. */
export function toonFaceFor(weights: Partial<Record<string, number>>): FaceParams {
  const w: Partial<Record<ExpressionName, number>> = {};
  let eyesShut = 0;
  for (const [name, k] of Object.entries(weights)) {
    if (!k) continue;
    if (name === "eyes-closed") { eyesShut = Math.max(eyesShut, k); continue; }
    for (const [e, x] of Object.entries(TOON_EXPRESSIONS[name] ?? {}) as [ExpressionName, number][]) w[e] = (w[e] ?? 0) + x * k;
  }
  const f = blendExpressions(w);
  if (eyesShut) f.lid = f.lid * (1 - eyesShut);
  return f;
}

/**
 * Small eye movements while he stands (Home, a cut scene's quiet moments):
 * the eyes rest, then jump to a new spot every second or two, the way eyes
 * really move (saccades), from t alone (the same t gives the same look).
 */
export function wanderGaze(t: number, seed: number): [number, number] {
  const hash = (n: number) => { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  // jumps at uneven times: each hold 0.7–2.2 s
  let at = 0, k = 0;
  while (true) { const d = 0.7 + 1.5 * hash(k); if (at + d > t % 60) break; at += d; k++; if (k > 200) break; }
  const look = hash(k + 1000) < 0.45; // a little under half the time: straight ahead
  if (look) return [0, 0];
  return [(hash(k + 2000) * 2 - 1) * 0.85, (hash(k + 3000) * 2 - 1) * 0.45];
}

/** A natural blink pattern from t: one every 2.5–5 s, 0.14 s long. */
export function blinkAt(t: number, seed: number): number {
  const hash = (n: number) => { const x = Math.sin(n * 91.7 + seed * 47.3) * 43758.5453; return x - Math.floor(x); };
  let at = 0.6 + hash(0) * 2, k = 1;
  const tt = t % 120;
  while (at + 0.14 < tt && k < 400) { at += 2.5 + 2.5 * hash(k); k++; }
  const x = (tt - at) / 0.14;
  return x > 0 && x < 1 ? Math.sin(x * Math.PI) : 0;
}
