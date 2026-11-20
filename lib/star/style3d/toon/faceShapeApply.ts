/**
 * A FACE TYPE (faceShape.ts) put on one Style A person: his own copy of the body's vertices with
 * the front of the face moved by the face's rule, the normals turned with it. The file's own rest
 * pose rides along as `aRest`, which the body's shader paints from (TOON_AREST), so the kit lines,
 * the masks, the haircut and the moving face stay exactly where they were.
 *
 *   applyToonFaceShape(T, person, "a1", 1);   // after makePerson3d, before addToonFace
 * Returns false (nothing changed) for "base", a head with no measured face, or a body already
 * rebuilt to other proportions (it has its own aRest).
 */
import type * as THREE from "three";
import type { Person3D } from "../../people3d";
import { TOON_FACE_LANDMARKS } from "./faceLandmarks";
import { TOON_SHAPE_HEADS } from "./bodies";
import { TOON_FACE_FILE_LANDMARKS } from "./faceFileLandmarks";
import { TOON_FACE_TYPES, faceFrame, faceShapePoint, faceZone, faceOutlineZone, type FaceShape, type ToonFaceId } from "./faceShape";

type Three = typeof THREE;

export function applyToonFaceShape(T: Three, p: Person3D, face: ToonFaceId, k = 1): boolean {
  const shape = TOON_FACE_TYPES[face]?.shape;
  if (!shape || face === "base" || !p.toonHead) return false;
  return applyToonFaceShapeRaw(T, p, shape, k, false);
}

/**
 * The same, for any set of changes (a FaceId's own mould, faceIdApply.ts). `onRebuilt`: also on a body
 * already rebuilt to other proportions (it carries the file's rest as aRest): the rule is worked out on the
 * file's own rest pose and each point's move is added to where the rebuild put it (the rebuild carries the
 * head as one piece, so the move holds).
 */
export function applyToonFaceShapeRaw(T: Three, p: Person3D, shape: FaceShape, k = 1, onRebuilt = true): boolean {
  if (!p.toonHead) return false;
  const lm = TOON_FACE_FILE_LANDMARKS[p.meta.file ?? ""] ?? TOON_FACE_LANDMARKS[p.toonHead];
  const geo0 = p.body.geometry;
  const rest0 = geo0.getAttribute("aRest");
  if (!lm || (rest0 && !onRebuilt)) return false;
  const kit = p.meta.kit as { collarY?: number };
  const F = faceFrame(lm, p.meta.face as never, kit.collarY ?? p.meta.face.chinY - 0.03);
  const geo = geo0.clone();
  const pos0 = geo0.getAttribute("position"), nor0 = geo0.getAttribute("normal");
  const n = pos0.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  const E = 2e-4;
  // a re-shaped head (broad jaw, long face, round face, older) already has its own outline: the face type goes on gentler
  const kk = k * (TOON_SHAPE_HEADS.includes(p.toonHead) ? 0.6 : 1);
  const f = (q: [number, number, number]) => faceShapePoint(q, F, shape, kk);
  for (let i = 0; i < n; i++) {
    const at: [number, number, number] = [pos0.getX(i), pos0.getY(i), pos0.getZ(i)];
    const q: [number, number, number] = rest0 ? [rest0.getX(i), rest0.getY(i), rest0.getZ(i)] : at;
    let nx = nor0.getX(i), ny = nor0.getY(i), nz = nor0.getZ(i);
    if (q[1] < F.chinY - 0.06 || (faceZone(q, F) <= 0 && faceOutlineZone(q, F) <= 0)) { P.set(at, i * 3); N.set([nx, ny, nz], i * 3); continue; }
    const o = f(q);
    P.set([at[0] + o[0] - q[0], at[1] + o[1] - q[1], at[2] + o[2] - q[2]], i * 3);
    // the normal through the rule's own slopes: two tangents, moved, crossed
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let t1: [number, number, number] = Math.abs(ny) < 0.9 ? [nz, 0, -nx] : [0, nz, -ny];
    const t1l = Math.hypot(...t1); t1 = [t1[0] / t1l, t1[1] / t1l, t1[2] / t1l];
    const t2: [number, number, number] = [ny * t1[2] - nz * t1[1], nz * t1[0] - nx * t1[2], nx * t1[1] - ny * t1[0]];
    const a = f([q[0] + t1[0] * E, q[1] + t1[1] * E, q[2] + t1[2] * E]), b = f([q[0] + t2[0] * E, q[1] + t2[1] * E, q[2] + t2[2] * E]);
    const ax = a[0] - o[0], ay = a[1] - o[1], az = a[2] - o[2], bx = b[0] - o[0], by = b[1] - o[1], bz = b[2] - o[2];
    let cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const cl = Math.hypot(cx, cy, cz) || 1; cx /= cl; cy /= cl; cz /= cl;
    if (cx * nx + cy * ny + cz * nz < 0) { cx = -cx; cy = -cy; cz = -cz; }
    N.set([cx, cy, cz], i * 3);
  }
  if (!rest0) geo.setAttribute("aRest", new T.BufferAttribute(new Float32Array(pos0.array as ArrayLike<number>), 3));
  geo.setAttribute("position", new T.BufferAttribute(P, 3));
  geo.setAttribute("normal", new T.BufferAttribute(N, 3));
  p.body.geometry = geo;
  p.outline.geometry = geo;
  const mat = p.body.material as THREE.MeshStandardMaterial;
  mat.defines = { ...(mat.defines ?? {}), TOON_AREST: "" };
  mat.needsUpdate = true;
  return true;
}
