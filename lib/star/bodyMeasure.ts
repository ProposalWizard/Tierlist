/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MEASURING A 3D PERSON (B5b, 20 Oct 2026) — his skinned mesh as it stands now
 * (pose him first: the bind pose, or any frame), read the way a tailor would:
 * height, head, neck, shoulders across the deltoids, chest, waist, hips, where
 * the hips, crotch, knees and ankles are, arm length, hands, feet, and where
 * his kit ends (shorts hem, sock top). Each vertex counts for the body part its
 * strongest bone belongs to, so an arm hanging by the hip is never read as hip.
 * Works on any people3d person (Style A, the human, the one body) in the
 * browser or in Node (no WebGL). The guide's own numbers: lib/star/bodyGuide.ts.
 */
import type { BodyMeasure } from "./bodyGuide";

type Part = "head" | "neck" | "torso" | "arm" | "hand" | "leg" | "foot";
function partOf(bone: string): Part {
  if (/^(Head|head_end|headfront)$/.test(bone)) return "head";
  if (/^neck/.test(bone)) return "neck";
  if (/Hand(Thumb|Index|Middle|Ring|Little)|Hand$/.test(bone)) return "hand";
  if (/Shoulder|Arm|ForeArm/.test(bone)) return "arm";
  if (/Foot|ToeBase/.test(bone)) return "foot";
  if (/UpLeg|Leg/.test(bone)) return "leg";
  return "torso";
}

/** Every skinned vertex of the person's body now, world metres, with its part. */
export function skinnedPoints(T: any, body: any): { p: Float32Array; part: Part[] } {
  const g = body.geometry;
  const pos = g.getAttribute("position"), si = g.getAttribute("skinIndex"), sw = g.getAttribute("skinWeight");
  const bones = body.skeleton.bones;
  body.updateMatrixWorld(true);
  body.skeleton.update();
  const n = pos.count;
  const p = new Float32Array(n * 3);
  const part: Part[] = new Array(n);
  const v = new T.Vector3();
  for (let i = 0; i < n; i++) {
    body.getVertexPosition(i, v);
    v.applyMatrix4(body.matrixWorld);
    p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z;
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    part[i] = partOf(bones[best]?.name ?? "");
  }
  return { p, part };
}

/**
 * The measures of a person standing at `root` facing +z (yaw 0, his left +x).
 * `kit`: his kit lines' rest heights (Style A meta.kit), already in this pose's metres, or null.
 */
export function measurePerson(T: any, person: any, kit?: { shortsLoY?: number; sockY?: number } | null, chinY?: number): BodyMeasure {
  const { p, part } = skinnedPoints(T, person.body);
  const n = part.length;
  const root = new T.Vector3(); person.root.getWorldPosition(root);
  const bone = (name: string) => { const b = person.bones[name]; const v = new T.Vector3(); b?.getWorldPosition(v); return v.sub(root); };
  let top = -Infinity, bottom = Infinity;
  for (let i = 0; i < n; i++) { top = Math.max(top, p[i * 3 + 1]); bottom = Math.min(bottom, p[i * 3 + 1]); }
  const H = top - bottom;
  const y0 = bottom;
  /**
   * The body's width in a band of heights (from the floor): the run of surface either side of the middle
   * line, stopping at the first gap of `gap` metres or more (the gap between the body and an arm hanging by it).
   * `parts` limits which vertices count (the deltoids: arms and body).
   */
  const BODY: Part[] = ["torso", "leg", "arm"]; // the body surface, an arm only where it joins on
  const width = (lo: number, hi: number, parts: Part[], contiguous = false, gap = 0.06) => {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const y = p[i * 3 + 1] - y0;
      if (y < lo || y > hi || !parts.includes(part[i])) continue;
      xs.push(p[i * 3] - root.x);
    }
    if (!xs.length) return 0;
    if (!contiguous) return Math.max(...xs) - Math.min(...xs);
    const run = (sgn: number) => {
      const v = xs.map((x) => x * sgn).filter((x) => x > -0.02).sort((a, b) => a - b);
      let edge = 0;
      for (const x of v) { if (x - edge > gap) break; edge = Math.max(edge, x); }
      return edge;
    };
    return run(1) + run(-1);
  };
  const shJ = (bone("LeftArm").y + bone("RightArm").y) / 2 + (root.y - y0);
  const hipJ = (bone("LeftUpLeg").y + bone("RightUpLeg").y) / 2 + (root.y - y0);
  const knee = (bone("LeftLeg").y + bone("RightLeg").y) / 2 + (root.y - y0);
  // chin: the given rest chin, else the lowest head vertex in front
  let chin = chinY !== undefined ? chinY - y0 : Infinity;
  if (chinY === undefined) for (let i = 0; i < n; i++) if (part[i] === "head") chin = Math.min(chin, p[i * 3 + 1] - y0);
  const headH = H - chin;
  // the waist: the narrowest torso band between the hips and the chest
  let waist = Infinity;
  for (let y = hipJ + 0.08; y < shJ - 0.25; y += 0.01) { const w = width(y - 0.02, y + 0.02, BODY, true, 0.035); if (w > 0.1) waist = Math.min(waist, w); }
  // the crotch: the lowest body point on the middle line (between the legs), above the knees
  let crotchLow = hipJ;
  for (let i = 0; i < n; i++) if (Math.abs(p[i * 3] - root.x) < 0.02 && p[i * 3 + 1] - y0 < hipJ && p[i * 3 + 1] - y0 > 0.4) crotchLow = Math.min(crotchLow, p[i * 3 + 1] - y0);
  // the hand: wrist to the farthest hand vertex; the fingertips' height; the arm: shoulder joint to fingertip
  const wrist = bone("LeftHand");
  let hand = 0, tipY = Infinity, tip = wrist.clone();
  for (let i = 0; i < n; i++) {
    if (part[i] !== "hand" || p[i * 3] - root.x < 0) continue;
    const v = new T.Vector3(p[i * 3] - root.x, p[i * 3 + 1] - root.y, p[i * 3 + 2] - root.z);
    const d = v.distanceTo(wrist);
    if (d > hand) { hand = d; tip = v; }
    tipY = Math.min(tipY, p[i * 3 + 1] - y0);
  }
  const sh = bone("LeftArm");
  const arm = sh.distanceTo(bone("LeftForeArm")) + bone("LeftForeArm").distanceTo(wrist) + wrist.distanceTo(tip);
  // the foot: heel to toe of the left foot
  let fz0 = Infinity, fz1 = -Infinity;
  for (let i = 0; i < n; i++) if (part[i] === "foot" && p[i * 3] - root.x > 0) { fz0 = Math.min(fz0, p[i * 3 + 2]); fz1 = Math.max(fz1, p[i * 3 + 2]); }
  const deltoids = width(shJ - 0.06, shJ + 0.03, ["arm", "torso"], true);
  // the side view down the middle line (his front is +z): chest depth at the nipples, the chest's stand-out over the hips
  const zAt = (yy: number, f: (a: number, b: number) => number, init: number, parts: Part[] = ["torso"], half = 0.12) => {
    let z = init;
    for (let i = 0; i < n; i++) if (parts.includes(part[i]) && Math.abs(p[i * 3] - root.x) < half && Math.abs(p[i * 3 + 1] - y0 - yy) < 0.02) z = f(z, p[i * 3 + 2] - root.z);
    return z;
  };
  const nip = 0.72 * H, chestFront = zAt(nip, Math.max, -9), chestBack = zAt(nip, Math.min, 9);
  const chinFront = zAt(chin + 0.01, Math.max, -9, ["head", "neck"], 0.03);
  return {
    height: H, headH, headsTall: H / headH, neck: chin - shJ, deltoids, headsWide: deltoids / headH,
    chest: width(shJ - 0.2, shJ - 0.16, ["torso"], true, 0.035), waist: waist === Infinity ? 0 : waist, hips: width(hipJ - 0.04, hipJ + 0.04, ["torso", "leg"], true),
    hipJoint: hipJ, crotch: crotchLow, knee, legShare: hipJ / H, arm, fingertip: tipY === Infinity ? 0 : tipY, hand, foot: fz1 - fz0,
    shortsHem: kit?.shortsLoY !== undefined ? kit.shortsLoY - y0 : 0, sockTop: kit?.sockY !== undefined ? kit.sockY - y0 : 0,
    chestDepth: chestFront - chestBack, chestOut: chestFront - chinFront,
  };
}

/** A texture's picture as a PNG data URL (tools/bodies/graft.py reads the MakeHuman skin through the bench). */
export function pictureDataUrl(image: unknown): string | null {
  const im = image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!im || typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  c.getContext("2d")!.drawImage(im, 0, 0);
  return c.toDataURL("image/png");
}
