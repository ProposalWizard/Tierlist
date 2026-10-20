/**
 * THE BODY GUIDE (B5b, 20 Oct 2026; Harry: "make the bodies not look badly
 * proportioned"). A real adult male footballer drawn to a given height, the
 * yardstick every Style A body is judged against on the bench's Body page
 * (/star-3d-bench-dev/body): the same height, an outline from the front and
 * from the side, and the heights and widths that matter.
 *
 * The numbers are fractions of height from Drillis & Contini (body segment
 * lengths) and the usual figure-drawing canon for an athletic man (7.5–8
 * heads tall, shoulders about two heads wide, hips narrower than shoulders),
 * with a footballer's kit worn the modern way: shorts to mid-thigh, socks
 * pulled up to just under the knee. Pure (no three.js): tests/star/bodyGuide.mts.
 */

export interface GuideMark { id: string; label: string; y: number }
export interface GuideWidth { id: string; label: string; y: number; w: number }

/** Heights as a share of the man's height (crown = 1). */
export const GUIDE_FRAC = {
  crown: 1, chin: 0.87, shoulder: 0.818, shoulderJoint: 0.8, armpit: 0.74, nipple: 0.72, elbow: 0.63,
  waist: 0.6, hipJoint: 0.53, wrist: 0.485, crotch: 0.47, fingertip: 0.38, shortsHem: 0.39, knee: 0.285,
  sockTop: 0.255, calf: 0.2, ankle: 0.039,
} as const;

/** The head: 0.13 of height (7.7 heads tall). Widths (metres at 1.86 m, scaled with height). */
export const GUIDE_HEAD = 0.13;
const W186 = { head: 0.155, neck: 0.125, deltoids: 0.48, chest: 0.37, waist: 0.31, hips: 0.35, thigh: 0.155, knee: 0.1, calf: 0.105, ankle: 0.07, foot: 0.283 };

/** The marks drawn across the guide (heights in metres for a man `H` tall). */
export function guideMarks(H: number): GuideMark[] {
  const f = GUIDE_FRAC;
  return [
    { id: "crown", label: "crown", y: f.crown * H }, { id: "chin", label: "chin", y: f.chin * H },
    { id: "shoulder", label: "shoulders", y: f.shoulder * H }, { id: "elbow", label: "elbow", y: f.elbow * H },
    { id: "waist", label: "waist", y: f.waist * H }, { id: "crotch", label: "crotch", y: f.crotch * H },
    { id: "shortsHem", label: "shorts hem (mid-thigh)", y: f.shortsHem * H }, { id: "knee", label: "knee", y: f.knee * H },
    { id: "sockTop", label: "sock top (under the knee)", y: f.sockTop * H }, { id: "ankle", label: "ankle", y: f.ankle * H },
  ];
}

/** The widths the bench measures (front view), metres for a man `H` tall. */
export function guideWidths(H: number): GuideWidth[] {
  const k = H / 1.86, f = GUIDE_FRAC;
  return [
    { id: "head", label: "head width", y: (1 - GUIDE_HEAD / 2) * H, w: W186.head * k },
    { id: "deltoids", label: "shoulders (deltoids)", y: (f.shoulderJoint - 0.012) * H, w: W186.deltoids * k },
    { id: "chest", label: "chest", y: f.nipple * H, w: W186.chest * k },
    { id: "waist", label: "waist", y: f.waist * H, w: W186.waist * k },
    { id: "hips", label: "hips", y: f.hipJoint * H, w: W186.hips * k },
  ];
}

type P = [number, number];
/**
 * The front outline, his right side then mirrored (x across, y up, metres),
 * arms hanging a little out from the sides (the stance the bench shows).
 */
export function guideFront(H: number): { body: P[]; armL: P[]; armR: P[] } {
  const k = H / 1.86, F = GUIDE_FRAC;
  const y = (f: number) => f * H, x = (m: number) => m * k;
  const headTop = H, chin = y(F.chin), headMid = (headTop + chin) / 2, hw = x(W186.head) / 2;
  // the head as an egg (wider at the cheekbones, narrowing to the chin)
  const head: P[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI; // 0 = crown, pi = chin
    const r = Math.sin(a) * hw * (a > Math.PI * 0.55 ? 1 - 0.35 * ((a - Math.PI * 0.55) / (Math.PI * 0.45)) : 1);
    head.push([r, headMid + Math.cos(a) * (headTop - chin) / 2]);
  }
  const side: P[] = [
    ...head,
    [x(W186.neck) / 2, chin - 0.01 * H], [x(W186.neck) / 2 + 0.005, y(0.84)],
    [x(W186.deltoids) / 2 - 0.05 * k, y(F.shoulder)], [x(W186.deltoids) / 2, y(F.shoulderJoint - 0.015)],
    [x(W186.chest) / 2 + 0.01 * k, y(F.armpit)], [x(W186.chest) / 2, y(F.nipple)], [x(W186.waist) / 2, y(F.waist)],
    [x(W186.hips) / 2, y(F.hipJoint)], [x(W186.hips) / 2 - 0.005, y(F.crotch)], [x(W186.thigh) + 0.012 * k, y(F.shortsHem)],
    [x(W186.knee) + 0.03 * k, y(F.knee)], [x(W186.calf) + 0.035 * k, y(F.calf)], [x(W186.ankle) + 0.03 * k, y(F.ankle + 0.02)],
    [x(0.16), 0], [x(0.025), 0], [x(0.035), y(F.ankle + 0.03)], [x(0.03), y(F.knee)], [x(0.012), y(F.crotch - 0.01)], [0, y(F.crotch)],
  ];
  // one side from the crown down and up the inner leg to the crotch, then its mirror back up to the crown
  const body: P[] = [...side, ...side.slice().reverse().map(([a, b]) => [-a, b] as P)];
  // arms: from the shoulder joint down to the fingertips, 7° out from the side
  const arm = (s: number): P[] => {
    const sx = s * x(W186.deltoids / 2 - 0.035), sy = y(F.shoulderJoint);
    const out = Math.tan((7 * Math.PI) / 180);
    const at = (fy: number, half: number): [P, P] => { const yy = y(fy); const cx = sx + s * (sy - yy) * out; return [[cx - half, yy], [cx + half, yy]]; };
    const a = at(F.shoulderJoint - 0.01, x(0.055)), b = at(F.elbow, x(0.04)), c = at(F.wrist, x(0.03)), d = at(F.fingertip + 0.01, x(0.035));
    return [a[0], b[0], c[0], d[0], [(d[0][0] + d[1][0]) / 2, y(F.fingertip)], d[1], c[1], b[1], a[1]];
  };
  return { body, armL: arm(1), armR: arm(-1) };
}

/** The side outline (z his front, y up, metres). */
export function guideSide(H: number): P[] {
  const k = H / 1.86, F = GUIDE_FRAC;
  const y = (f: number) => f * H, z = (m: number) => m * k;
  // front edge from the crown down to the toes, then the back edge up
  const front: P[] = [
    [z(0.0), H], [z(0.08), y(0.985)], [z(0.105), y(0.95)], [z(0.115), y(0.92)], [z(0.105), y(0.895)], [z(0.075), y(F.chin)],
    [z(0.06), y(0.85)], [z(0.07), y(F.shoulder)], [z(0.125), y(F.nipple)], [z(0.1), y(F.waist)], [z(0.085), y(F.hipJoint)],
    [z(0.09), y(F.shortsHem)], [z(0.06), y(F.knee)], [z(0.055), y(F.calf)], [z(0.04), y(F.ankle + 0.02)], [z(0.22), 0],
  ];
  const back: P[] = [
    [z(-0.06), 0], [z(-0.06), y(F.ankle + 0.02)], [z(-0.07), y(F.calf)], [z(-0.05), y(F.knee)], [z(-0.075), y(F.shortsHem)],
    [z(-0.12), y(F.crotch + 0.04)], [z(-0.105), y(F.hipJoint + 0.04)], [z(-0.08), y(F.waist)], [z(-0.11), y(F.armpit)],
    [z(-0.1), y(F.shoulder)], [z(-0.055), y(0.85)], [z(-0.075), y(0.9)], [z(-0.095), y(0.95)], [z(-0.06), y(0.99)],
  ];
  return [...front, ...back];
}

/** What the bench measures on a body, beside the guide's own value (metres, or a share of height). */
export interface BodyMeasure { height: number; headH: number; headsTall: number; neck: number; deltoids: number; headsWide: number; chest: number; waist: number; hips: number; hipJoint: number; crotch: number; knee: number; legShare: number; arm: number; fingertip: number; hand: number; foot: number; shortsHem: number; sockTop: number;
  /** Side view: the chest's depth front to back at the nipples, and how far the chest stands out in front of the chin (Harry, 18:41: "the chest comes out a bit much"). */
  chestDepth: number; chestOut: number }

/** The guide's own measures for a man `H` tall (to set beside a body's). */
export function guideMeasure(H: number): BodyMeasure {
  const k = H / 1.86, F = GUIDE_FRAC;
  return {
    height: H, headH: GUIDE_HEAD * H, headsTall: 1 / GUIDE_HEAD, neck: (F.chin - F.shoulderJoint) * H, deltoids: W186.deltoids * k,
    headsWide: W186.deltoids / (GUIDE_HEAD * 1.86), chest: W186.chest * k, waist: W186.waist * k, hips: W186.hips * k,
    hipJoint: F.hipJoint * H, crotch: F.crotch * H, knee: F.knee * H, legShare: F.hipJoint, arm: (F.shoulderJoint - F.fingertip) * H,
    fingertip: F.fingertip * H, hand: 0.108 * H, foot: W186.foot * k, shortsHem: F.shortsHem * H, sockTop: F.sockTop * H,
    chestDepth: 0.235 * k, chestOut: 0.05 * k,
  };
}
