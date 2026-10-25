// New match clips, authored on the people3d skeleton. One pose per baked frame.
// Sign guide (base pose, world axes, degrees): UpLeg x<0 swings the foot FORWARD; Leg x>0 bends
// the knee (foot back); Arm x<0 raises it forward; LeftArm z>0 / RightArm z<0 lifts it out to the
// side (to ±170 = straight up); Spine x>0 bends forward; Spine/Hips z>0 leans to his right;
// y>0 turns to his left. hips: [x, y, z] metres (y<0 = crouch). All kicks are right-footed.
// From above (25° off straight down) any spread reads big, so side lifts are halved.
const arms = (l, r, lx = 0, rx = 0) => ({ LeftArm: [lx, 0, l * 0.5], RightArm: [rx, 0, -r * 0.5] });
const knees = (a, b = a, ul = -a / 2, ur = -b / 2) => ({ LeftUpLeg: [ul, 0, 0], LeftLeg: [a, 0, 0], RightUpLeg: [ur, 0, 0], RightLeg: [b, 0, 0] });
window.CLIPS = {
  // ── Outfield (8 facings) ──
  touch: { fps: 9, poses: [
    { ...arms(8, 8), ...knees(15), RightUpLeg: [-25, -10, 0], RightLeg: [30, 0, 0], Spine: [8, 0, 0], hips: [0, -0.03, 0] },
    { ...arms(32, 30), LeftLeg: [18, 0, 0], LeftUpLeg: [-8, 0, 0], RightUpLeg: [-38, -20, 0], RightLeg: [14, 0, 0], RightFoot: [-20, 0, 0], Spine: [14, 0, 0], hips: [0, -0.05, 0] },
    { ...arms(26, 26), LeftLeg: [22, 0, 0], LeftUpLeg: [-12, 0, 0], RightUpLeg: [-18, -10, 0], RightLeg: [26, 0, 0], Spine: [16, 0, 0], hips: [0, -0.06, 0] },
    { ...arms(18, 18), ...knees(18), Spine: [13, 0, 0], hips: [0, -0.045, 0] },
  ] },
  passKick: { fps: 10, strikeFrame: 2, poses: [
    { ...arms(11, 9), LeftUpLeg: [-12, 0, 0], LeftLeg: [18, 0, 0], RightUpLeg: [28, 0, 0], RightLeg: [55, 0, 0], Spine: [10, 0, 0], hips: [0, -0.04, 0] },
    { ...arms(30, 22), LeftUpLeg: [-14, 0, 0], LeftLeg: [22, 0, 0], RightUpLeg: [0, -40, 0], RightLeg: [28, 0, 0], Spine: [9, 0, 0], hips: [0, -0.05, 0] },
    { ...arms(42, 28), LeftUpLeg: [-15, 0, 0], LeftLeg: [24, 0, 0], RightUpLeg: [-38, -45, 0], RightLeg: [6, 0, 0], Spine: [6, 0, 0], hips: [0, -0.06, 0] },
    { ...arms(38, 26), LeftUpLeg: [-12, 0, 0], LeftLeg: [20, 0, 0], RightUpLeg: [-52, -30, 0], RightLeg: [10, 0, 0], Spine: [2, 0, 0], hips: [0, -0.05, 0] },
    { ...arms(24, 20), ...knees(14), RightUpLeg: [-16, 0, 0], RightLeg: [28, 0, 0], Spine: [6, 0, 0], hips: [0, -0.03, 0] },
  ] },
  shotKick: { fps: 10, strikeFrame: 2, poses: [
    { ...arms(55, 22, 0, 25), LeftUpLeg: [-18, 0, 0], LeftLeg: [28, 0, 0], RightUpLeg: [42, 0, 0], RightLeg: [105, 0, 0], Spine: [14, -12, 0], hips: [0, -0.06, 0] },
    { ...arms(62, 28, 0, 15), LeftUpLeg: [-18, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [8, 0, 0], RightLeg: [88, 0, 0], Spine: [10, -6, 0], hips: [0, -0.07, 0] },
    { ...arms(72, 38, -10, 25), LeftUpLeg: [-18, 0, 0], LeftLeg: [28, 0, 0], RightUpLeg: [-48, 0, 0], RightLeg: [14, 0, 0], RightFoot: [25, 0, 0], Spine: [-4, 10, 0], hips: [0, -0.07, 0] },
    { ...arms(75, 45, -20, 20), LeftUpLeg: [-8, 0, 0], LeftLeg: [18, 0, 0], RightUpLeg: [-95, 0, 0], RightLeg: [0, 0, 0], RightFoot: [25, 0, 0], Spine: [-16, 18, 0], hips: [0, -0.03, 0.03] },
    { ...arms(55, 35, -10, 10), LeftUpLeg: [-6, 0, 0], LeftLeg: [14, 0, 0], RightUpLeg: [-72, 0, 0], RightLeg: [28, 0, 0], Spine: [-10, 12, 0], hips: [0, -0.02, 0.04] },
    { ...arms(30, 22), ...knees(16), RightUpLeg: [-30, 0, 0], RightLeg: [42, 0, 0], Spine: [2, 4, 0], hips: [0, -0.03, 0.05] },
  ] },
  volley: { fps: 10, strikeFrame: 2, poses: [
    { ...arms(50, 25), Hips: [0, 0, -10], LeftLeg: [22, 0, 0], RightUpLeg: [20, 0, -20], RightLeg: [85, 0, 0], Spine: [6, 0, 6], hips: [0, -0.04, 0] },
    { ...arms(80, 40), Hips: [0, 0, -26], LeftLeg: [24, 0, 0], LeftUpLeg: [-8, 0, 18], RightUpLeg: [-22, 0, -58], RightLeg: [72, 0, 0], Spine: [0, 0, 12], hips: [0, -0.06, 0] },
    { ...arms(95, 50), Hips: [0, 0, -36], LeftLeg: [20, 0, 0], LeftUpLeg: [-6, 0, 26], RightUpLeg: [-52, -15, -72], RightLeg: [12, 0, 0], Spine: [0, 12, 16], hips: [0, -0.07, 0] },
    { ...arms(90, 45), Hips: [0, 0, -30], LeftLeg: [18, 0, 0], LeftUpLeg: [-4, 0, 22], RightUpLeg: [-62, -20, -55], RightLeg: [10, 0, 0], Spine: [-4, 18, 12], hips: [0, -0.05, 0] },
    { ...arms(45, 25), Hips: [0, 0, -10], ...knees(18), RightUpLeg: [-20, 0, -18], RightLeg: [40, 0, 0], Spine: [4, 6, 4], hips: [0, -0.03, 0] },
  ] },
  chipKick: { fps: 10, strikeFrame: 2, poses: [
    { ...arms(28, 22), LeftUpLeg: [-12, 0, 0], LeftLeg: [20, 0, 0], RightUpLeg: [22, 0, 0], RightLeg: [62, 0, 0], Spine: [6, 0, 0], hips: [0, -0.04, 0] },
    { ...arms(38, 28), LeftUpLeg: [-14, 0, 0], LeftLeg: [24, 0, 0], RightUpLeg: [-4, 0, 0], RightLeg: [38, 0, 0], Spine: [-4, 0, 0], hips: [0, -0.05, 0] },
    { ...arms(55, 42, -25, -15), LeftUpLeg: [-12, 0, 0], LeftLeg: [22, 0, 0], RightUpLeg: [-32, 0, 0], RightLeg: [8, 0, 0], RightFoot: [-25, 0, 0], Spine: [-16, 0, 0], hips: [0, -0.04, 0] },
    { ...arms(60, 50, -35, -25), LeftUpLeg: [-8, 0, 0], LeftLeg: [16, 0, 0], RightUpLeg: [-42, 0, 0], RightLeg: [10, 0, 0], Spine: [-14, 0, 0], hips: [0, -0.03, 0] },
    { ...arms(30, 25), ...knees(14), RightUpLeg: [-14, 0, 0], RightLeg: [26, 0, 0], Spine: [-4, 0, 0], hips: [0, -0.03, 0] },
  ] },
  header: { fps: 9, strikeFrame: 3, poses: [
    { ...arms(25, 25, 35, 35), ...knees(60, 60, -32, -32), Spine: [18, 0, 0], hips: [0, -0.13, 0] },
    { ...arms(40, 40, -110, -110), ...knees(12, 12, -6, -6), Spine: [-8, 0, 0], neck: [-12, 0, 0], hips: [0, 0, 0] },
    { ...arms(80, 80, -40, -40), ...knees(75, 75, -28, -28), Spine: [-16, 0, 0], neck: [-14, 0, 0] },
    { ...arms(55, 55, -20, -20), ...knees(65, 65, -30, -30), Spine: [24, 0, 0], neck: [22, 0, 0], Head: [10, 0, 0] },
    { ...arms(30, 30), ...knees(48, 48, -26, -26), Spine: [16, 0, 0], hips: [0, -0.09, 0] },
  ] },
  block: { fps: 7, strikeFrame: 1, poses: [
    { ...arms(10, 10, 20, 20), Hips: [0, 0, 10], LeftUpLeg: [-30, 0, 0], LeftLeg: [45, 0, 0], RightUpLeg: [-30, 0, -30], RightLeg: [22, 0, 0], Spine: [20, 0, -6], hips: [0, -0.12, 0] },
    { ...arms(8, 8, 28, 28), Hips: [0, 0, 24], LeftUpLeg: [-42, 0, 0], LeftLeg: [65, 0, 0], RightUpLeg: [-58, 0, -55], RightLeg: [4, 0, 0], RightFoot: [-20, 0, 0], Spine: [24, 0, -12], hips: [0, -0.2, 0] },
    { ...arms(8, 8, 26, 26), Hips: [0, 0, 22], LeftUpLeg: [-42, 0, 0], LeftLeg: [65, 0, 0], RightUpLeg: [-55, 0, -52], RightLeg: [6, 0, 0], RightFoot: [-20, 0, 0], Spine: [24, 0, -10], hips: [0, -0.19, 0] },
    { ...arms(8, 8, 10, 10), Hips: [0, 0, 6], ...knees(30), RightUpLeg: [-22, 0, -14], RightLeg: [26, 0, 0], Spine: [14, 0, -3], hips: [0, -0.08, 0] },
  ] },
  clearance: { fps: 10, strikeFrame: 2, poses: [
    { ...arms(60, 40, -30, 20), LeftUpLeg: [-18, 0, 0], LeftLeg: [28, 0, 0], RightUpLeg: [46, 0, 0], RightLeg: [108, 0, 0], Spine: [16, -10, 0], hips: [0, -0.06, 0] },
    { ...arms(70, 45, -25, 15), LeftUpLeg: [-18, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [10, 0, 0], RightLeg: [92, 0, 0], Spine: [10, -4, 0], hips: [0, -0.07, 0] },
    { ...arms(88, 62, -20, 10), LeftUpLeg: [-16, 0, 0], LeftLeg: [26, 0, 0], RightUpLeg: [-58, 0, 0], RightLeg: [14, 0, 0], Spine: [-10, 10, 0], hips: [0, -0.06, 0] },
    { ...arms(110, 100, -20, -20), LeftUpLeg: [-4, 0, 0], LeftLeg: [12, 0, 0], RightUpLeg: [-112, 0, 0], RightLeg: [0, 0, 0], Spine: [-26, 16, 0], hips: [0, 0, 0.04] },
    { ...arms(80, 70, -15, -10), LeftUpLeg: [-4, 0, 0], LeftLeg: [12, 0, 0], RightUpLeg: [-90, 0, 0], RightLeg: [22, 0, 0], Spine: [-16, 10, 0], hips: [0, -0.01, 0.05] },
    { ...arms(35, 28), ...knees(16), RightUpLeg: [-30, 0, 0], RightLeg: [42, 0, 0], Spine: [0, 4, 0], hips: [0, -0.03, 0.06] },
  ] },
};
// ── Keeper (4 facings). Dives: the pose is a leap; the baker lays it over to his right (and mirrors for L). ──
const kStretch = (o) => ({ LeftUpLeg: [6, 0, 0], LeftLeg: [10, 0, 0], RightUpLeg: [-28, 0, -10], RightLeg: [55, 0, 0], ...o });
const setPose = { ...arms(35, 35, -20, -20), ...knees(40, 40, -30, -30), Spine: [18, 0, 0], hips: [0, -0.12, 0] };
const oneHand = { dive: 1, fps: 9, diveOpts: { maxRoll: (46 * Math.PI) / 180, carry: -0.45, drop: 0.12 }, poses: [
  setPose,
  kStretch({ LeftArm: [-10, 0, 45], RightArm: [-10, 0, -140], Spine: [4, 0, 12], hips: [0, -0.04, 0] }),
  kStretch({ LeftArm: [10, 0, 25], LeftForeArm: [-30, 0, 0], RightArm: [-5, 0, -172], Spine: [0, 0, 18], Spine01: [0, 0, 8] }),
  kStretch({ LeftArm: [15, 0, 4], LeftForeArm: [-25, 0, 0], RightArm: [-5, 0, -178], Spine: [0, 0, 20], Spine01: [0, 0, 10] }),
  kStretch({ LeftArm: [15, 0, 4], LeftForeArm: [-25, 0, 0], RightArm: [-5, 0, -178], Spine: [0, 0, 20], Spine01: [0, 0, 10] }),
  kStretch({ LeftArm: [10, 0, 30], LeftForeArm: [-30, 0, 0], RightArm: [-10, 0, -165], Spine: [0, 0, 16], Spine01: [0, 0, 8], RightUpLeg: [-40, 0, -10], RightLeg: [70, 0, 0] }),
] };
const lowDive = { dive: 1, fps: 9, diveOpts: { maxRoll: (88 * Math.PI) / 180, carry: -0.8, drop: 0.3 }, poses: [
  { ...setPose, hips: [0, -0.18, 0], ...knees(55, 55, -35, -35) },
  kStretch({ LeftArm: [-20, 0, 120], RightArm: [-20, 0, -130], Spine: [10, 0, 8], hips: [0, -0.1, 0] }),
  kStretch({ LeftArm: [-15, 0, 160], RightArm: [-15, 0, -165], Spine: [6, 0, 8], RightUpLeg: [-14, 0, -6], RightLeg: [30, 0, 0] }),
  kStretch({ LeftArm: [-12, 0, 168], RightArm: [-12, 0, -172], Spine: [4, 0, 6], RightUpLeg: [-10, 0, -4], RightLeg: [20, 0, 0] }),
  kStretch({ LeftArm: [-12, 0, 168], RightArm: [-12, 0, -172], Spine: [4, 0, 6], RightUpLeg: [-10, 0, -4], RightLeg: [20, 0, 0] }),
  kStretch({ LeftArm: [-30, 0, 150], RightArm: [-30, 0, -160], Spine: [10, 0, 6], RightUpLeg: [-30, 0, -6], RightLeg: [50, 0, 0] }),
] };
const parry = { dive: 1, fps: 9, diveOpts: { maxRoll: (66 * Math.PI) / 180, carry: -0.7, drop: 0.24 }, poses: [
  setPose,
  kStretch({ LeftArm: [-50, 0, 20], LeftForeArm: [-60, 0, 0], RightArm: [-30, 0, -120], Spine: [4, 0, 10], hips: [0, -0.05, 0] }),
  kStretch({ LeftArm: [-60, 0, 15], LeftForeArm: [-80, 0, 0], RightArm: [-60, 0, -130], RightHand: [-50, 0, 0], Spine: [0, 0, 14] }),
  kStretch({ LeftArm: [-60, 0, 15], LeftForeArm: [-80, 0, 0], RightArm: [-60, 0, -135], RightHand: [-55, 0, 0], Spine: [0, 0, 16] }),
  kStretch({ LeftArm: [-55, 0, 15], LeftForeArm: [-70, 0, 0], RightArm: [-55, 0, -135], RightHand: [-40, 0, 0], Spine: [0, 0, 14] }),
  kStretch({ LeftArm: [-30, 0, 30], LeftForeArm: [-50, 0, 0], RightArm: [-20, 0, -150], Spine: [4, 0, 10], RightUpLeg: [-40, 0, -10], RightLeg: [70, 0, 0] }),
] };
const mirrorOf = (c) => ({ ...c, dive: -c.dive });
Object.assign(window.CLIPS, {
  oneHandR: oneHand, oneHandL: mirrorOf(oneHand),
  lowDiveR: lowDive, lowDiveL: mirrorOf(lowDive),
  parryR: parry, parryL: mirrorOf(parry),
  catchHold: { fps: 8, poses: [
    { ...arms(15, 15, -70, -70), ...knees(30, 30, -20, -20), Spine: [14, 0, 0], hips: [0, -0.08, 0] },
    { LeftArm: [-55, 0, 0], LeftForeArm: [-90, -55, 0], RightArm: [-55, 0, 0], RightForeArm: [-90, 55, 0], ...knees(26, 26, -16, -16), Spine: [18, 0, 0], hips: [0, -0.07, 0] },
    { LeftArm: [-45, 0, 0], LeftForeArm: [-105, -60, 0], RightArm: [-45, 0, 0], RightForeArm: [-105, 60, 0], ...knees(22, 22, -14, -14), Spine: [24, 0, 0], neck: [10, 0, 0], hips: [0, -0.06, 0] },
    { LeftArm: [-45, 0, 0], LeftForeArm: [-105, -60, 0], RightArm: [-45, 0, 0], RightForeArm: [-105, 60, 0], ...knees(14, 14, -8, -8), Spine: [16, 0, 0], neck: [6, 0, 0], hips: [0, -0.04, 0] },
  ] },
  fumble: { fps: 8, poses: [
    { LeftArm: [-55, 0, 0], LeftForeArm: [-90, -55, 0], RightArm: [-55, 0, 0], RightForeArm: [-90, 55, 0], ...knees(26, 26, -16, -16), Spine: [18, 0, 0], hips: [0, -0.07, 0] },
    { ...arms(55, 55, -50, -50), ...knees(30, 30, -20, -20), Spine: [10, 0, 0], neck: [-10, 0, 0], hips: [0, -0.09, 0] },
    { ...arms(80, 75, -30, -30), ...knees(60, 60, -30, -30), Spine: [30, 0, 0], hips: [0, -0.22, 0] },
    { ...arms(30, 30, -60, -60), LeftUpLeg: [-5, 0, 0], LeftLeg: [100, 0, 0], RightUpLeg: [-5, 0, 0], RightLeg: [100, 0, 0], Spine: [38, 0, 0], hips: [0, -0.42, 0] },
    { ...arms(20, 20, -85, -85), LeftUpLeg: [-10, 0, 0], LeftLeg: [100, 0, 0], RightUpLeg: [-10, 0, 0], RightLeg: [100, 0, 0], Spine: [50, 0, 0], hips: [0, -0.44, 0.04] },
    { ...arms(20, 20, -75, -75), LeftUpLeg: [-10, 0, 0], LeftLeg: [100, 0, 0], RightUpLeg: [-60, 0, 0], RightLeg: [80, 0, 0], Spine: [42, 0, 0], hips: [0, -0.36, 0.04] },
  ] },
});
const getUp = { dive: 1, fps: 7, diveP: [1, 0.8, 0.5, 0.2, 0], poses: [
  kStretch({ LeftArm: [-20, 0, 120], RightArm: [-20, 0, -130], Spine: [8, 0, 6] }),
  { LeftArm: [-60, 0, 30], RightArm: [0, 0, -40], RightForeArm: [-40, 0, 0], LeftUpLeg: [-70, 0, 0], LeftLeg: [100, 0, 0], RightUpLeg: [-10, 0, 0], RightLeg: [60, 0, 0], Spine: [24, 0, 10], hips: [0, -0.2, 0] },
  { ...arms(25, 25, -30, -30), LeftUpLeg: [-80, 0, 0], LeftLeg: [100, 0, 0], RightUpLeg: [-5, 0, 0], RightLeg: [95, 0, 0], Spine: [30, 0, 4], hips: [0, -0.35, 0] },
  { ...arms(25, 25, -10, -10), ...knees(70, 70, -45, -45), Spine: [26, 0, 0], hips: [0, -0.24, 0] },
  { ...arms(30, 30, -20, -20), ...knees(36, 36, -26, -26), Spine: [16, 0, 0], hips: [0, -0.1, 0] },
] };
Object.assign(window.CLIPS, { getUpR: getUp, getUpL: mirrorOf(getUp) });
// Size trim (7 Oct 2026): the in-between frame each outfield clip could lose with the least change.
{
  const C = window.CLIPS;
  const drop = (nm, i, fps, strike) => { C[nm] = { ...C[nm], poses: C[nm].poses.filter((_, k) => k !== i), fps, ...(strike != null ? { strikeFrame: strike } : {}) }; };
  drop("touch", 2, 7); drop("passKick", 1, 8, 1); drop("volley", 3, 8); drop("chipKick", 3, 8);
  drop("block", 2, 5); drop("shotKick", 4, 8.5); drop("clearance", 4, 8.5);
}
