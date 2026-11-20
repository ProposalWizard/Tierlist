/**
 * A FACE ID (faceId.ts) put on one Style A person:
 *   - the mould (jaw, chin, cheeks, nose, face length …) moved on his own copy of the mesh
 *     (faceShapeApply.ts: the file's rest pose rides along as aRest, so everything painted or
 *     drawn stays on the skin);
 *   - the drawn face switched on in his body's shader (faceIdShader.ts, `#define TOON_FACEID`)
 *     and its numbers handed over.
 *
 *   applyToonFaceId(T, person, faceId);   // after makePerson3d + dressPerson3d, before addToonFace
 *
 * Returns false (nothing changed) on a head with no measured face. Only for people seen up
 * close (cut scenes, portraits): a far crowd keeps the painted head and pays nothing.
 */
import type * as THREE from "three";
import type { Person3D } from "../../people3d";
import { TOON_SHAPE_HEADS, type ToonHead } from "./bodies";
import { TOON_FACE_LANDMARKS } from "./faceLandmarks";
import { TOON_FACE_FILE_LANDMARKS } from "./faceFileLandmarks";
import { applyToonFaceShapeRaw } from "./faceShapeApply";
import { HEAD_LEAN, type FaceId } from "./faceId";
import type { FaceShape } from "./faceShape";

type Three = typeof THREE;

/** The heads whose own picture has a beard painted in (it is painted out under a FaceId; his own is drawn). */
export const TOON_PAINTED_BEARD: readonly ToonHead[] = ["h3", "h6", "m1", "m2", "h7", "h8", "h9", "m3"];

const LIP_SCALE = 1.45;

/** Fine detail by the game's quality: a computer or a close-up, a phone, the weakest phones. */
export const FACE_DETAIL = { high: 1, medium: 0.5, low: 0 } as const;

/** Change a drawn face's detail later (the quality governor stepping down or up). */
export function setToonFaceDetail(p: Person3D, detail: number): void {
  const u = p.u as Record<string, { value: { w: number } }>;
  if (u.uFiLm3) u.uFiLm3.value.w = Math.max(0, Math.min(1, detail));
}

export interface FaceIdOptions {
  /** Fine detail (hairs, freckles, folds): 1 full (a computer, a close-up), 0.5 a phone, 0 none. */
  detail?: number;
  /** Leave the mesh alone (only the drawn face). */
  noMould?: boolean;
}

export function applyToonFaceId(T: Three, p: Person3D, f: FaceId, opts: FaceIdOptions = {}): boolean {
  if (!p.toonHead) return false;
  const lm = TOON_FACE_FILE_LANDMARKS[p.meta.file ?? ""] ?? TOON_FACE_LANDMARKS[p.toonHead];
  const u = p.u as Record<string, { value: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!lm || !u.uFiLm1) return false;
  if (!opts.noMould) {
    // a lean build on the broad-jaw or round-face head file starts by taking that file's own puff off
    // (HEAD_LEAN); the fuller builds keep it. At full strength on the re-shaped heads (the face types go
    // on those gentler, a FaceId's own mould does not).
    const lean = HEAD_LEAN[p.toonHead], keep = f.faceBuild === "heavy" ? 1 : f.faceBuild === "soft" ? 0.6 : 0;
    const shape: FaceShape = { ...f.shape };
    if (lean) for (const [key, v] of Object.entries(lean) as [keyof FaceShape, number][]) shape[key] = (shape[key] ?? 0) + v * (1 - keep);
    applyToonFaceShapeRaw(T, p, shape, TOON_SHAPE_HEADS.includes(p.toonHead) ? 1 / 0.6 : 1);
  }

  const cx = (lm.eyes[0][0] + lm.eyes[1][0]) / 2, eyeDX = (lm.eyes[1][0] - lm.eyes[0][0]) / 2, eyeY = (lm.eyes[0][1] + lm.eyes[1][1]) / 2;
  // the head's own eye size, part of the way (the big-eyed heads keep a bigger eye)
  const es = 1.1 * Math.pow(Math.min(1.05, Math.max(0.85, (lm.eyes[0][2] + lm.eyes[1][2]) / 2 / 0.0185)), 0.6);
  const mouthW = Math.min(0.031, Math.max(0.024, lm.mouth[2])) * f.mouthW;
  const eyeUp = f.eyeUp * es;
  // the brow sits on the head's own modelled ridge
  const browH = Math.max(eyeUp + f.browT * 1.3 + 0.004, lm.browY - eyeY - 0.0073 + (f.browH - 0.0212));
  u.uFiLm1.value.set(cx, eyeDX, eyeY, lm.browY);
  u.uFiLm2.value.set(lm.nose[1], lm.nose[2], lm.mouth[1], lm.chinY);
  u.uFiLm3.value.set(mouthW, p.meta.joints.Head?.[2] ?? 0.045, TOON_PAINTED_BEARD.includes(p.toonHead) ? 1 : 0, opts.detail ?? 1);
  u.uFiEye.value.set(f.eyeW * es, eyeUp, f.eyeLow * es, f.eyeTilt);
  u.uFiEye2.value.set(f.eyeGap, f.eyeDy, f.irisR * es, f.crease);
  u.uFiEye3.value.set(f.hood, f.socket, f.lash, f.underEye);
  u.uFiEye4.value.set(f.eyeRound, f.eyeInner, 0, 0);
  u.uFiBrowA.value.set(browH, f.browT, f.browArch, f.browTilt);
  u.uFiBrowB.value.set(f.browLen, f.browGap, f.browTaper, f.browPeak);
  // (a toon head is about 1.3 times a real one: the lips drawn to its scale)
  u.uFiMouth.value.set(mouthW, f.lipUp * LIP_SCALE, f.lipLow * LIP_SCALE, f.lipTone);
  u.uFiMarks.value.set(f.freckles, f.age, f.blush, f.mole);
  u.uFiMole.value.set(f.moleX, f.moleY, f.mouthDy, f.browDensity);
  u.uFiBeard.value.set(f.beardCheek, f.beardChin, f.beardMous, f.beardDensity);
  u.uFiBeard2.value.set(f.beardLine, f.beardStrap, f.beardSoul, f.beardLen);
  u.uFiIris.value = new T.Color(f.iris);
  u.uFiLip.value = new T.Color(f.lip);
  u.uFiBrowC.value = new T.Color(f.brow);
  const mat = p.body.material as THREE.MeshStandardMaterial;
  if (!mat.defines || mat.defines.TOON_FACEID === undefined) {
    mat.defines = { ...(mat.defines ?? {}), TOON_FACEID: "" };
    mat.needsUpdate = true;
  }
  return true;
}

/** Has this person a drawn face (applyToonFaceId)? */
export function hasToonFaceId(p: Person3D): boolean {
  return (p.body.material as THREE.MeshStandardMaterial).defines?.TOON_FACEID !== undefined;
}
