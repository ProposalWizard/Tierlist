/**
 * THE KIT, PAINTED ONTO THE 3D BODY — which parts of the bare CC0 body are
 * shirt, shorts, socks and boots.
 *
 * The Quaternius body comes bare. Rather than model clothes, every vertex
 * gets four numbers (one per garment): positive means "covered", negative
 * "not", and the size is roughly how far (in metres) it is from that
 * garment's edge. The shader reads them interpolated across each triangle
 * and colours a pixel where the number is above zero — so a hem is a clean
 * straight line through the triangles, not a jagged triangle edge. Same idea
 * as the Blender footballer's rest-pose masks (tools/blender-footballer).
 *
 * Which garment a vertex can belong to comes from the bone that moves it
 * most (its biggest skin weight); where along that bone it sits decides the
 * hems: sleeves end half way down the upper arm, shorts half way down the
 * thigh, socks start just under the knee, boots from the ankle.
 *
 * Pure: plain arrays in, a Float32Array out — no three.js needed to test it.
 */

export type V3 = [number, number, number];

export interface KitInput {
  positions: ArrayLike<number>; // xyz per vertex, bind pose
  skinIndex: ArrayLike<number>; // 4 per vertex
  skinWeight: ArrayLike<number>; // 4 per vertex
  boneNames: string[];
  /** Each bone's head (joint) position, in the same space as `positions`. */
  boneHeads: V3[];
}

/** Where the hems sit, as a fraction along the bone (0 = its joint). */
export const HEMS = {
  sleeve: 0.48, // upper arm
  shorts: 0.5, // thigh
  socksTop: 0.2, // calf, just under the knee
  boots: 0.9, // calf, the ankle
  /** Metres above the pelvis joint where the shirt stops / the shorts start. */
  shirtBottom: 0.05,
  shortsTop: 0.13,
  /** Metres below the neck joint where the collar sits. */
  collar: 0.0,
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.sqrt(dot(a, a));

/** -> 4 floats per vertex: shirt, shorts, socks, boots. */
export function kitMasks(inp: KitInput): Float32Array {
  const n = inp.positions.length / 3;
  const out = new Float32Array(n * 4);
  const idx = (name: string) => inp.boneNames.indexOf(name);
  const head = (name: string): V3 => inp.boneHeads[idx(name)];
  const pelvis = head("pelvis");
  const neck = head("neck_01");
  const up0 = sub(head("Head"), pelvis);
  const up: V3 = [up0[0] / len(up0), up0[1] / len(up0), up0[2] / len(up0)];

  /** Where `p` sits along bone a→b: 0 at a, 1 at b; plus the bone length. */
  const along = (p: V3, a: string, b: string) => {
    const A = head(a), B = head(b);
    const d = sub(B, A);
    const L = len(d);
    return { t: dot(sub(p, A), d) / (L * L), L };
  };

  for (let v = 0; v < n; v++) {
    const p: V3 = [inp.positions[v * 3], inp.positions[v * 3 + 1], inp.positions[v * 3 + 2]];
    let best = -1, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = inp.skinWeight[v * 4 + k];
      if (w > bw) { bw = w; best = inp.skinIndex[v * 4 + k]; }
    }
    const bone = inp.boneNames[best] ?? "";
    const side = bone.endsWith("_l") ? "l" : bone.endsWith("_r") ? "r" : "";
    const h = dot(sub(p, pelvis), up); // height above the pelvis joint
    const collar = dot(sub(neck, pelvis), up) - HEMS.collar - h; // >0 below the collar line

    let shirt = -1, shorts = -1, socks = -1, boots = -1;

    if (/^spine_|^clavicle_|^neck_/.test(bone)) {
      shirt = Math.min(collar, h - HEMS.shirtBottom);
    } else if (bone === "pelvis") {
      shirt = h - HEMS.shirtBottom;
      shorts = HEMS.shortsTop - h;
    } else if (/^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)_/.test(bone)) {
      const { t, L } = along(p, `upperarm_${side}`, `lowerarm_${side}`);
      shirt = (HEMS.sleeve - t) * L;
    } else if (/^thigh_/.test(bone)) {
      const { t, L } = along(p, `thigh_${side}`, `calf_${side}`);
      shorts = Math.min((HEMS.shorts - t) * L, HEMS.shortsTop - h);
    } else if (/^calf_/.test(bone)) {
      const { t, L } = along(p, `calf_${side}`, `foot_${side}`);
      socks = (t - HEMS.socksTop) * L;
      boots = (t - HEMS.boots) * L;
    } else if (/^(foot|ball)_/.test(bone)) {
      boots = 1;
      socks = 1;
    }
    out[v * 4] = shirt;
    out[v * 4 + 1] = shorts;
    out[v * 4 + 2] = socks;
    out[v * 4 + 3] = boots;
  }
  return out;
}
