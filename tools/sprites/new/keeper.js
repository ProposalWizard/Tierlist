// THE KEEPER CATCHES (Leo, 26 Oct 2026: "make it so the goalie actually catches the
// ball … ball should go in his hands and move with the goalie if he dives … dive more
// realistic and fall on floor and if he gets up get up"). Keeper clips keyed on the
// people3d skeleton, same sign guide as defs.js / aerials.js:
//   UpLeg x<0 swings the foot FORWARD; Leg x>0 bends the knee; Arm x<0 raises it
//   forward; LeftArm z>0 / RightArm z<0 out to the side (±170 = straight up);
//   ForeArm x<0 bends the elbow; Spine x>0 bends forward, z>0 leans to his right,
//   y>0 turns to his left. Hips turns the WHOLE man about his hips (z>0 rolls him
//   onto his right side). hips: [x, y, z] metres; x<0 = to his RIGHT, y = up.
//
// Unlike defs.js (one pose per baked frame) these are KEYS at times (seconds); the
// baker samples `frames` frames from 0 to the last key and every number between two
// keys runs on a smooth curve (Catmull-Rom, eased at the first and last key), so
// 16-20 frames come out of 6-9 keys without a jerk.
//
// Dives go to his RIGHT; the L clips are the R ones drawn flipped (mirrorOf), like
// oneHandL. Each baked cell carries `pts`: ONE point, the centre of the ball between
// his gloves (keeperBall in bake-new.html), so the game can put the ball in his hands.
// contactFrame = gloves meet the ball; landFrame = his body hits the grass.
//
// Bake:  node tools/sprites/new/bake-new.mjs keepers both
// Look:  node tools/sprites/new/bake-new.mjs keepersheet a "kCatchDiveR:1"
// Check: node tools/sprites/new/bake-new.mjs keeperbones a kCatchDiveR   (RUL-3D-005)
(() => {
const arms = (l, r, lx = 0, rx = 0) => ({ LeftArm: [lx, 0, l * 0.5], RightArm: [rx, 0, -r * 0.5] });
const knees = (a, b = a, ul = -a / 2, ur = -b / 2) => ({ LeftUpLeg: [ul, 0, 0], LeftLeg: [a, 0, 0], RightUpLeg: [ur, 0, 0], RightLeg: [b, 0, 0] });
// The set stance every save starts from (defs.js setPose).
const SET = { ...arms(35, 35, -20, -20), ...knees(40, 40, -30, -30), Spine: [18, 0, 0], hips: [0, -0.12, 0] };
// Arm paths, measured with keeperbones (real cm, Style A / current body). Arms go up THROUGH THE
// FRONT (Arm x), never out to the side, so the gloves stay together the whole way.
// Euler XYZ: Arm z acts first, on the hanging arm: LeftArm z<0 / RightArm z>0 = inward.
const REACH = { LeftArm: [-155, 0, -10], RightArm: [-155, 0, 10], LeftForeArm: [0, 0, -22], RightForeArm: [0, 0, 22] }; // gloves ~30/24 cm apart, overhead
const FACE = { LeftArm: [-115, 0, -4], RightArm: [-115, 0, 4], LeftForeArm: [0, 0, -40], RightForeArm: [0, 0, 40] };    // ball in front of his face
const CHEST = { LeftArm: [-72, 0, 4], RightArm: [-72, 0, -4], LeftForeArm: [0, 0, -56], RightForeArm: [0, 0, 56] };     // the W at his chest, ~1.4 m
const HUG = { LeftArm: [-55, 0, 10], LeftForeArm: [0, 0, -65], RightArm: [-55, 0, -10], RightForeArm: [0, 0, 65] };     // 22-29 cm, ball 42-59 cm off the chest bone
/** The arms part way from pose A to pose B (f = 0..1). */
const ARMS = ["LeftArm", "RightArm", "LeftForeArm", "RightForeArm"];
const mix = (A, B, f) => Object.fromEntries(ARMS.map((k) => { const a = A[k] ?? [0, 0, 0], b = B[k] ?? [0, 0, 0]; return [k, a.map((v, i) => v + (b[i] - v) * f)]; }));
// Lying on his right side (Hips rolled ~90°); the floor rule in the baker sets him ON the grass.
const lieLegs = { LeftUpLeg: [-30, 0, 0], LeftLeg: [40, 0, 0], RightUpLeg: [-10, 0, 0], RightLeg: [30, 0, 0] };
const curlLegs = { LeftUpLeg: [-42, 0, 0], LeftLeg: [60, 0, 0], RightUpLeg: [-24, 0, 0], RightLeg: [50, 0, 0] };
const stand = (o = {}) => ({ ...knees(12, 12, -6, -6), Spine: [6, 0, 0], hips: [0, -0.03, 0], ...o });

const K = {};
// ── Diving catch, mid/high, to his right ──
// air: the seconds he is off the grass (the baker's floor rule keeps every other frame on it).
K.kCatchDiveR = { fps: 22, frames: 19, contactT: 0.37, landT: 0.55, air: [0.15, 0.55], hold: "both", keys: [
  { t: 0.00, ...SET },
  // load: a short step, weight onto the right leg, arms start up through the front
  { t: 0.09, LeftArm: [-50, 0, 6], RightArm: [-50, 0, -6], LeftUpLeg: [-16, 0, 8], LeftLeg: [28, 0, 0], RightUpLeg: [-36, 0, -12], RightLeg: [62, 0, 0], Spine: [14, 0, 10], Hips: [0, 0, 8], hips: [-0.14, -0.18, 0] },
  // push off the right leg, arms driving up, body tipping over to his right
  { t: 0.18, ...mix(FACE, REACH, 0.5), LeftUpLeg: [-34, 0, 10], LeftLeg: [52, 0, 0], RightUpLeg: [-6, 0, -6], RightLeg: [12, 0, 0], Spine: [6, 0, 8], Hips: [0, 0, 36], hips: [-0.4, -0.02, 0.03] },
  // in the air, laying out
  { t: 0.28, ...REACH, LeftUpLeg: [-22, 0, 6], LeftLeg: [36, 0, 0], RightUpLeg: [-2, 0, -4], RightLeg: [10, 0, 0], Spine: [3, 0, 4], Hips: [0, 0, 70], hips: [-0.74, 0.08, 0.06] },
  // flat out, gloves round the ball (contact)
  { t: 0.37, ...REACH, LeftUpLeg: [-14, 0, 4], LeftLeg: [24, 0, 0], RightUpLeg: [0, 0, -2], RightLeg: [8, 0, 0], Spine: [2, 0, 2], Hips: [0, 0, 86], hips: [-0.98, 0.1, 0.08] },
  // ball pulled down in front of his face as he drops
  { t: 0.47, ...FACE, LeftUpLeg: [-18, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [-4, 0, 0], RightLeg: [16, 0, 0], Spine: [8, 0, 0], Hips: [0, 0, 90], hips: [-1.12, -0.3, 0.1] },
  // lands on his side, the ball into his chest
  { t: 0.55, ...HUG, ...lieLegs, Spine: [14, 0, -4], neck: [10, 0, 0], Hips: [0, 0, 92], hips: [-1.2, -0.7, 0.1] },
  // a small bump (rolls a touch toward his front)
  { t: 0.62, ...HUG, ...lieLegs, LeftUpLeg: [-36, 0, 0], Spine: [16, 0, -6], neck: [12, 0, 0], Hips: [0, 0, 97], hips: [-1.24, -0.7, 0.1] },
  // settled, curled round it
  { t: 0.82, ...HUG, ...curlLegs, Spine: [20, 0, -4], neck: [14, 0, 0], Hips: [0, 0, 92], hips: [-1.26, -0.7, 0.1] },
] };

// ── Low diving catch along the grass, to his right: the near knee folds, he goes down sideways ──
K.kCatchLowR = { fps: 22, frames: 17, contactT: 0.30, landT: 0.30, air: [0.12, 0.3], hold: "both", keys: [
  { t: 0.00, ...SET },
  { t: 0.09, ...mix(SET, FACE, 0.5), LeftUpLeg: [-20, 0, 14], LeftLeg: [30, 0, 0], RightUpLeg: [-50, 0, -14], RightLeg: [90, 0, 0], Spine: [24, 0, 12], Hips: [0, 0, 20], hips: [-0.16, -0.3, 0.02] },
  { t: 0.18, ...mix(FACE, REACH, 0.6), LeftUpLeg: [-14, 0, 10], LeftLeg: [24, 0, 0], RightUpLeg: [-26, 0, -6], RightLeg: [44, 0, 0], Spine: [14, 0, 8], Hips: [0, 0, 56], hips: [-0.46, -0.42, 0.04] },
  // stretched along the grass, gloves behind the ball (contact) as his side lands
  { t: 0.30, ...REACH, LeftUpLeg: [-12, 0, 4], LeftLeg: [22, 0, 0], RightUpLeg: [-4, 0, 0], RightLeg: [14, 0, 0], Spine: [6, 0, 2], Hips: [0, 0, 90], hips: [-0.9, -0.7, 0.06] },
  { t: 0.36, ...REACH, LeftUpLeg: [-14, 0, 2], LeftLeg: [24, 0, 0], RightUpLeg: [-4, 0, 0], RightLeg: [16, 0, 0], Spine: [6, 0, 0], Hips: [0, 0, 93], hips: [-0.96, -0.7, 0.07] },
  // ball gathered in front of his face, then into his chest
  { t: 0.46, ...FACE, ...lieLegs, Spine: [10, 0, -2], Hips: [0, 0, 92], hips: [-1.0, -0.7, 0.08] },
  { t: 0.56, ...HUG, ...lieLegs, Spine: [16, 0, -4], neck: [12, 0, 0], Hips: [0, 0, 94], hips: [-1.02, -0.7, 0.08] },
  { t: 0.74, ...HUG, ...curlLegs, Spine: [20, 0, -4], neck: [14, 0, 0], Hips: [0, 0, 92], hips: [-1.02, -0.7, 0.08] },
] };

// ── Diving parry: the near (right) palm pushes it wide ──
const PALM = { RightArm: [-150, 0, 4], RightForeArm: [0, 0, 8] };
K.kParryDiveR = { fps: 22, frames: 17, contactT: 0.29, landT: 0.55, air: [0.15, 0.55], hold: "R", keys: [
  { t: 0.00, ...SET },
  { t: 0.09, LeftArm: [-50, 0, 6], RightArm: [-50, 0, -6], LeftUpLeg: [-16, 0, 8], LeftLeg: [28, 0, 0], RightUpLeg: [-36, 0, -12], RightLeg: [62, 0, 0], Spine: [14, 0, 10], Hips: [0, 0, 8], hips: [-0.14, -0.18, 0] },
  { t: 0.18, LeftArm: [-70, 0, 20], LeftForeArm: [0, 0, -20], RightArm: [-120, 0, 0], LeftUpLeg: [-34, 0, 10], LeftLeg: [52, 0, 0], RightUpLeg: [-6, 0, -6], RightLeg: [12, 0, 0], Spine: [6, 0, 8], Hips: [0, 0, 40], hips: [-0.42, 0, 0.03] },
  // contact at the top of the flight: the right arm long, the palm through the ball
  { t: 0.29, LeftArm: [-95, 0, 30], LeftForeArm: [0, 0, -30], ...PALM, LeftUpLeg: [-18, 0, 6], LeftLeg: [30, 0, 0], RightUpLeg: [-2, 0, -4], RightLeg: [10, 0, 0], Spine: [3, 0, 4], Hips: [0, 0, 74], hips: [-0.8, 0.1, 0.06] },
  // follow through: the palm pushes on, past his head, as he flattens out
  { t: 0.38, LeftArm: [-100, 0, 34], LeftForeArm: [0, 0, -30], RightArm: [-170, 0, -6], LeftUpLeg: [-14, 0, 4], LeftLeg: [24, 0, 0], RightUpLeg: [0, 0, -2], RightLeg: [8, 0, 0], Spine: [2, 0, 2], Hips: [0, 0, 87], hips: [-1.02, 0.04, 0.08] },
  { t: 0.47, LeftArm: [-90, 0, 28], LeftForeArm: [0, 0, -30], RightArm: [-160, 0, 6], RightForeArm: [0, 0, 12], LeftUpLeg: [-18, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [-4, 0, 0], RightLeg: [16, 0, 0], Spine: [6, 0, 0], Hips: [0, 0, 90], hips: [-1.14, -0.3, 0.1] },
  // lands on his side, arms out to break the fall
  { t: 0.55, LeftArm: [-80, 0, 20], LeftForeArm: [0, 0, -30], RightArm: [-150, 0, 10], RightForeArm: [0, 0, 20], ...lieLegs, Spine: [8, 0, -2], Hips: [0, 0, 92], hips: [-1.2, -0.7, 0.1] },
  { t: 0.62, LeftArm: [-75, 0, 18], LeftForeArm: [0, 0, -34], RightArm: [-145, 0, 10], RightForeArm: [0, 0, 24], ...lieLegs, LeftUpLeg: [-36, 0, 0], Spine: [10, 0, -4], Hips: [0, 0, 97], hips: [-1.24, -0.7, 0.1] },
  { t: 0.78, LeftArm: [-65, 0, 14], LeftForeArm: [0, 0, -40], RightArm: [-140, 0, 10], RightForeArm: [0, 0, 30], ...curlLegs, Spine: [12, 0, -4], Hips: [0, 0, 92], hips: [-1.26, -0.7, 0.1] },
] };

// ── Get up with the ball: from his side, onto a knee, up, ball held in both hands ──
// Starts on kCatchDiveR's last pose, with the anchor moved under his hips (the dive's landM).
const kneelUp = { LeftUpLeg: [-80, 0, 0], LeftLeg: [88, 0, 0], RightUpLeg: [6, 0, 0], RightLeg: [100, 0, 0] };
K.kGetUpBallR = { fps: 15, frames: 14, hold: "both", from: ["kCatchDiveR", -1], keys: [
  { t: 0.00, from: true },
  // rolls up off his side, the top leg comes round to plant
  { t: 0.18, ...HUG, LeftUpLeg: [-70, 0, 0], LeftLeg: [90, 0, 0], RightUpLeg: [-40, 0, 0], RightLeg: [100, 0, 0], Spine: [28, 0, -4], neck: [10, 0, 0], Hips: [0, 0, 55], hips: [0, -0.62, 0.05] },
  // up on the right knee, left foot planted, chest over the ball
  { t: 0.38, ...HUG, ...kneelUp, Spine: [22, 0, 0], neck: [6, 0, 0], Hips: [0, 0, 8], hips: [0, -0.42, 0.04] },
  { t: 0.54, ...HUG, LeftUpLeg: [-56, 0, 0], LeftLeg: [76, 0, 0], RightUpLeg: [-12, 0, 0], RightLeg: [74, 0, 0], Spine: [18, 0, 0], neck: [4, 0, 0], hips: [0, -0.28, 0.02] },
  // standing, the ball held at his chest (= kHoldBall)
  { t: 0.72, ...HUG, ...knees(28, 28, -16, -16), Spine: [10, 0, 0], hips: [0, -0.08, 0] },
  { t: 0.88, ...HUG, ...stand() },
] };
// ── Get up without the ball (after a parry) ──
K.kGetUpR = { fps: 15, frames: 12, hold: "none", from: ["kParryDiveR", -1], keys: [
  { t: 0.00, from: true },
  // the right forearm pushes him up, the top leg comes round
  { t: 0.16, LeftArm: [-60, 0, 20], LeftForeArm: [0, 0, -30], RightArm: [-90, 0, 0], RightForeArm: [0, 0, 40], LeftUpLeg: [-70, 0, 0], LeftLeg: [90, 0, 0], RightUpLeg: [-40, 0, 0], RightLeg: [100, 0, 0], Spine: [26, 0, -4], Hips: [0, 0, 55], hips: [0, -0.62, 0.05] },
  { t: 0.34, ...arms(30, 30, -40, -40), ...kneelUp, Spine: [24, 0, 0], Hips: [0, 0, 8], hips: [0, -0.42, 0.04] },
  { t: 0.50, ...arms(30, 30, -25, -25), LeftUpLeg: [-56, 0, 0], LeftLeg: [76, 0, 0], RightUpLeg: [-12, 0, 0], RightLeg: [74, 0, 0], Spine: [20, 0, 0], hips: [0, -0.28, 0.02] },
  { t: 0.64, ...arms(30, 30, -20, -20), ...knees(34, 34, -24, -24), Spine: [14, 0, 0], hips: [0, -0.1, 0] },
  { t: 0.78, ...arms(22, 22, -8, -8), ...stand() },
] };

// ── Standing catch at chest height ──
K.kCatchChest = { fps: 18, frames: 11, contactT: 0.17, hold: "both", keys: [
  { t: 0.00, ...SET },
  // hands up into the W, behind the ball
  { t: 0.10, ...mix(SET, CHEST, 0.8), ...knees(32, 32, -22, -22), Spine: [12, 0, 0], hips: [0, -0.1, 0] },
  { t: 0.17, ...CHEST, ...knees(30, 30, -20, -20), Spine: [10, 0, 0], hips: [0, -0.09, 0] },
  // give: taken and pulled in
  { t: 0.30, ...mix(CHEST, HUG, 0.6), ...knees(34, 34, -22, -22), Spine: [18, 0, 0], neck: [8, 0, 0], hips: [0, -0.1, -0.03] },
  // hugged into his chest, head over it
  { t: 0.44, ...HUG, ...knees(26, 26, -16, -16), Spine: [22, 0, 0], neck: [12, 0, 0], hips: [0, -0.08, -0.02] },
  { t: 0.58, ...HUG, ...stand() },
] };

// ── Ball at his feet: the stoop. He bends from the hips over it, legs together, gloves on the grass
// in front of his toes behind the ball, scoops it up and pulls it into his chest.
// (Measured: the ball's centre 30 cm up (Style A) / 47 cm (current body) at contact, nothing under 14 cm.)
const legs2 = (a, ul) => ({ LeftUpLeg: [ul, 0, 0], LeftLeg: [a, 0, 0], RightUpLeg: [ul, 0, 0], RightLeg: [a, 0, 0] });
const armsDown = (x, fz) => ({ LeftArm: [x, 0, -12], RightArm: [x, 0, 12], LeftForeArm: [0, 0, -fz], RightForeArm: [0, 0, fz] });
const STOOP = { ...armsDown(-85, 16), ...legs2(100, -118), Hips: [60, 0, 0], Spine: [20, 0, 0], neck: [-35, 0, 0] };
K.kCatchFeet = { fps: 16, frames: 12, contactT: 0.28, hold: "both", keys: [
  { t: 0.00, ...SET },
  { t: 0.14, ...armsDown(-70, 14), ...legs2(80, -95), Hips: [42, 0, 0], Spine: [22, 0, 0], neck: [-25, 0, 0] },
  // gloves behind the ball on the grass (contact)
  { t: 0.28, ...STOOP },
  // scooped up in front of him as he straightens
  { t: 0.40, ...armsDown(-112, 26), ...legs2(80, -98), Hips: [45, 0, 0], Spine: [12, 0, 0], neck: [-20, 0, 0] },
  // into his chest
  { t: 0.54, ...HUG, ...legs2(40, -40), Hips: [16, 0, 0], Spine: [14, 0, 0], neck: [6, 0, 0] },
  { t: 0.70, ...HUG, ...stand() },
] };

// ── Standing with the ball held at his chest (loops: a slow breath) ──
K.kHoldBall = { fps: 6, frames: 6, loop: "loop", hold: "both", keys: [
  { t: 0, ...HUG, ...stand() },
  { t: 3, ...HUG, LeftArm: [-58, 0, 10], RightArm: [-58, 0, -10], ...stand({ Spine: [3, 0, 0], neck: [-3, 0, 0], hips: [0, -0.02, 0] }) },
  { t: 6, ...HUG, ...stand() },
] };

// contactT / landT (seconds) → the baked frame nearest to them.
for (const def of Object.values(K)) {
  const T = def.keys[def.keys.length - 1].t, n = def.frames, step = def.loop === "loop" ? T / n : T / (n - 1);
  if (def.contactT != null) def.contactFrame = Math.round(def.contactT / step);
  if (def.landT != null) def.landFrame = Math.round(def.landT / step);
}
window.KEEPER2 = K;
window.KEEPER2_MIRRORS = { kCatchDiveL: "kCatchDiveR", kCatchLowL: "kCatchLowR", kParryDiveL: "kParryDiveR", kGetUpBallL: "kGetUpBallR", kGetUpL: "kGetUpR" };
window.KEEPER2_ORDER = ["kCatchDiveR", "kCatchLowR", "kParryDiveR", "kGetUpBallR", "kGetUpR", "kCatchChest", "kCatchFeet", "kHoldBall"];

// ── Keys → one pose per baked frame ──
const BONES = (keys) => [...new Set(keys.flatMap((k) => Object.keys(k).filter((n) => n !== "t" && n !== "from")))];
/** The frame times: even from 0 to the last key (a loop: the last key = the first, left out). */
window.keeperTimes = (def) => {
  const T = def.keys[def.keys.length - 1].t, n = def.frames;
  return Array.from({ length: n }, (_, i) => (def.loop === "loop" ? (T * i) / n : (T * i) / (n - 1)));
};
/** The pose at time t: each number on a Catmull-Rom curve through the keys (flat at the ends). */
function poseAt(keys, t) {
  let k = 0; while (k + 1 < keys.length - 1 && keys[k + 1].t <= t) k++;
  const a = keys[k], b = keys[Math.min(k + 1, keys.length - 1)];
  const u = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0;
  const prev = keys[k - 1], next = keys[k + 2];
  const out = {};
  for (const bn of BONES(keys)) {
    const v = (key) => key[bn] ?? [0, 0, 0];
    out[bn] = [0, 1, 2].map((c) => {
      const p0 = v(a)[c], p1 = v(b)[c], dt = b.t - a.t;
      const m0 = prev ? ((p1 - v(prev)[c]) / (b.t - prev.t)) * dt : 0;
      const m1 = next ? ((v(next)[c] - p0) / (next.t - a.t)) * dt : 0;
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
    });
  }
  return out;
}
/** A clip's keys with its `from` key filled in (another clip's last key, the anchor moved under his hips). */
window.keeperKeys = (name) => {
  const def = K[name];
  if (!def.from) return def.keys;
  const src = K[def.from[0]].keys, last = src[src.length - 1];
  const { t: _t, ...p } = last;
  const h = p.hips ?? [0, 0, 0];
  return def.keys.map((k) => (k.from ? { ...p, hips: [0, h[1], 0], t: k.t } : k));
};
/** One pose per baked frame (the shape defs.js uses), registered as CLIPS[name] for makeClip. */
window.keeperPoses = (name) => {
  const def = K[name], keys = window.keeperKeys(name);
  return window.keeperTimes(def).map((t) => poseAt(keys, t));
};
})();
