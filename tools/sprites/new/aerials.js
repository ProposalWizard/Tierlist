// HEADERS AND VOLLEYS YOU SEE HAPPEN (Harry, 25 Oct 2026) — the aerial moves'
// 3D clips, keyframed on the people3d skeleton like defs.js (same sign guide:
// UpLeg x<0 swings the foot FORWARD; Leg x>0 bends the knee; Arm x<0 raises it
// forward; LeftArm z>0 / RightArm z<0 out to the side (arms() halves it);
// Spine x>0 bends forward; Spine/Hips z>0 leans to his right; y>0 turns to his
// left. hips: [x, y, z] metres. A child bone's turn is in the standing body's
// axes; Hips turns the whole man about his hips (x>0 pitches him forward).
// All kicks right-footed (a left-footer is drawn mirrored, as the kick is).
//
// One pose per baked frame. `contactFrame` is the frame the ball is met (the
// "Head it?" / "Volley it?" screen opens on it); `point` is which baked point
// is the ball's centre there (head / chest / foot). Must match
// lib/star/aerialMoves.ts AERIAL_SPECS (frames, contactFrame, clip names) —
// tests/star/aerialMoves.mts checks the index against it.
//
// Bake: node tools/sprites/new/bake-new.mjs aerials [a|current|both]
// Look: node tools/sprites/new/bake-new.mjs aerialsheet a "airBicycle:2,6"
const arms = (l, r, lx = 0, rx = 0) => ({ LeftArm: [lx, 0, l * 0.5], RightArm: [rx, 0, -r * 0.5] });
const knees = (a, b = a, ul = -a / 2, ur = -b / 2) => ({ LeftUpLeg: [ul, 0, 0], LeftLeg: [a, 0, 0], RightUpLeg: [ur, 0, 0], RightLeg: [b, 0, 0] });
window.AERIALS = {
  // ── Standing header: up on his toes, the head cocked back, then snapped through ──
  airStandHeader: { fps: 10, contactFrame: 3, point: "head", poses: [
    { ...arms(30, 30, -10, -10), ...knees(24), Spine: [-6, 0, 0], neck: [-10, 0, 0], hips: [0, -0.05, 0] },
    { ...arms(45, 45, -35, -35), ...knees(8), Spine: [-16, 0, 0], neck: [-20, 0, 0], hips: [0, 0.02, 0] },
    { ...arms(55, 55, -30, -30), ...knees(10), Spine: [-6, 0, 0], neck: [-8, 0, 0], hips: [0, 0.02, 0] },
    { ...arms(55, 55, -20, -20), ...knees(12), Spine: [10, 0, 0], neck: [16, 0, 0], Head: [8, 0, 0], hips: [0, 0.01, 0] },
    { ...arms(35, 35, -10, -10), ...knees(16), Spine: [18, 0, 0], neck: [20, 0, 0], Head: [6, 0, 0], hips: [0, -0.02, 0] },
    { ...arms(20, 20), ...knees(16), Spine: [8, 0, 0], neck: [6, 0, 0], hips: [0, -0.03, 0] },
  ] },
  // ── Jumping header: crouch, arms swing up, arched in the air, head through ──
  airJumpHeader: { fps: 10, contactFrame: 4, point: "head", poses: [
    { ...arms(25, 25, 35, 35), ...knees(60, 60, -32, -32), Spine: [18, 0, 0], hips: [0, -0.13, 0] },
    { ...arms(40, 40, -110, -110), ...knees(12, 12, -6, -6), Spine: [-8, 0, 0], neck: [-12, 0, 0], hips: [0, 0, 0] },
    { ...arms(80, 80, -50, -50), ...knees(70, 70, -22, -22), Spine: [-18, 0, 0], neck: [-16, 0, 0] },
    { ...arms(75, 75, -40, -40), ...knees(66, 66, -26, -26), Spine: [-8, 0, 0], neck: [-6, 0, 0] },
    { ...arms(55, 55, -20, -20), ...knees(62, 62, -30, -30), Spine: [20, 0, 0], neck: [20, 0, 0], Head: [10, 0, 0] },
    { ...arms(35, 35), ...knees(40, 40, -26, -26), Spine: [24, 0, 0], neck: [16, 0, 0] },
    { ...arms(30, 30), ...knees(48, 48, -26, -26), Spine: [16, 0, 0], hips: [0, -0.09, 0] },
  ] },
  // ── Diving header: thrown forward flat, head up to meet it, arms out to land ──
  airDivingHeader: { fps: 10, contactFrame: 4, point: "head", poses: [
    { ...arms(20, 20, 30, 30), ...knees(50, 50, -30, -30), Hips: [20, 0, 0], neck: [-12, 0, 0], hips: [0, -0.12, 0] },
    { ...arms(30, 30, -60, -60), LeftUpLeg: [6, 0, 0], LeftLeg: [24, 0, 0], RightUpLeg: [18, 0, 0], RightLeg: [34, 0, 0], Hips: [45, 0, 0], neck: [-32, 0, 0], hips: [0, -0.04, 0] },
    { ...arms(40, 40, -80, -80), LeftUpLeg: [12, 0, 0], LeftLeg: [22, 0, 0], RightUpLeg: [18, 0, 0], RightLeg: [28, 0, 0], Hips: [68, 0, 0], neck: [-48, 0, 0], Head: [-8, 0, 0] },
    { ...arms(55, 55, -72, -72), LeftUpLeg: [12, 0, 0], LeftLeg: [18, 0, 0], RightUpLeg: [16, 0, 0], RightLeg: [22, 0, 0], Hips: [80, 0, 0], neck: [-56, 0, 0], Head: [-6, 0, 0] },
    { ...arms(70, 70, -45, -45), LeftUpLeg: [10, 0, 0], LeftLeg: [16, 0, 0], RightUpLeg: [14, 0, 0], RightLeg: [20, 0, 0], Hips: [86, 0, 0], neck: [-50, 0, 0], Head: [4, 0, 0] },
    { ...arms(90, 90, -65, -65), LeftUpLeg: [8, 0, 0], LeftLeg: [24, 0, 0], RightUpLeg: [10, 0, 0], RightLeg: [30, 0, 0], Hips: [88, 0, 0], neck: [-42, 0, 0], hips: [0, -0.2, 0] },
    { ...arms(60, 60, -88, -88), LeftUpLeg: [4, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [6, 0, 0], RightLeg: [36, 0, 0], Hips: [90, 0, 0], neck: [-36, 0, 0], hips: [0, -0.62, 0] },
  ] },
  // ── Chest-down volley: chest presented, the ball cushioned and dropped, then struck on the laces ──
  airChestVolley: { fps: 10, contactFrame: 5, chestFrame: 1, point: "foot", poses: [
    { ...arms(35, 35, -15, -15), ...knees(20), Spine: [-16, 0, 0], neck: [10, 0, 0], hips: [0, -0.04, 0] },
    { ...arms(60, 60, -25, -25), ...knees(24), Spine: [-26, 0, 0], neck: [18, 0, 0], hips: [0, -0.05, 0] },
    { ...arms(50, 50, -15, -15), ...knees(20), Spine: [-8, 0, 0], neck: [20, 0, 0], hips: [0, -0.05, 0] },
    { ...arms(55, 25, 0, 20), LeftUpLeg: [-14, 0, 0], LeftLeg: [26, 0, 0], RightUpLeg: [30, 0, 0], RightLeg: [92, 0, 0], Spine: [6, -8, 0], neck: [16, 0, 0], hips: [0, -0.06, 0] },
    { ...arms(65, 32, -5, 20), LeftUpLeg: [-14, 0, 0], LeftLeg: [26, 0, 0], RightUpLeg: [-28, 0, 0], RightLeg: [52, 0, 0], Spine: [0, 0, 0], neck: [12, 0, 0], hips: [0, -0.06, 0] },
    { ...arms(72, 40, -15, 20), LeftUpLeg: [-12, 0, 0], LeftLeg: [24, 0, 0], RightUpLeg: [-62, 0, 0], RightLeg: [10, 0, 0], RightFoot: [25, 0, 0], Spine: [-10, 10, 0], neck: [8, 0, 0], hips: [0, -0.06, 0] },
    { ...arms(70, 45, -20, 15), LeftUpLeg: [-6, 0, 0], LeftLeg: [16, 0, 0], RightUpLeg: [-86, 0, 0], RightLeg: [8, 0, 0], RightFoot: [25, 0, 0], Spine: [-16, 14, 0], hips: [0, -0.03, 0.03] },
  ] },
  // ── Front volley: leg cocked, laces through it at knee height, the boot finishing high ──
  airFrontVolley: { fps: 10, contactFrame: 3, point: "foot", poses: [
    { ...arms(55, 22, 0, 25), LeftUpLeg: [-16, 0, 0], LeftLeg: [26, 0, 0], RightUpLeg: [40, 0, 0], RightLeg: [100, 0, 0], Spine: [8, -10, 0], hips: [0, -0.05, 0] },
    { ...arms(65, 30, 0, 18), LeftUpLeg: [-12, 0, 0], LeftLeg: [26, 0, 0], RightUpLeg: [2, 0, 0], RightLeg: [86, 0, 0], Spine: [2, -5, 0], hips: [0, -0.06, 0] },
    { ...arms(72, 38, -10, 22), LeftUpLeg: [-10, 0, 0], LeftLeg: [24, 0, 0], RightUpLeg: [-50, 0, 0], RightLeg: [40, 0, 0], Spine: [-6, 5, 0], hips: [0, -0.06, 0] },
    { ...arms(78, 46, -20, 20), LeftUpLeg: [-8, 0, 0], LeftLeg: [22, 0, 0], RightUpLeg: [-76, 0, 0], RightLeg: [8, 0, 0], RightFoot: [25, 0, 0], Spine: [-14, 12, 0], hips: [0, -0.06, 0] },
    { ...arms(75, 45, -20, 20), LeftUpLeg: [-6, 0, 0], LeftLeg: [18, 0, 0], RightUpLeg: [-98, 0, 0], RightLeg: [4, 0, 0], RightFoot: [25, 0, 0], Spine: [-18, 16, 0], hips: [0, -0.03, 0.03] },
    { ...arms(35, 26), ...knees(16), RightUpLeg: [-30, 0, 0], RightLeg: [40, 0, 0], Spine: [0, 4, 0], hips: [0, -0.03, 0.04] },
  ] },
  // ── Side volley: thrown over to his left, the right leg swung round flat ──
  airSideVolley: { fps: 10, contactFrame: 3, point: "foot", poses: [
    { ...arms(50, 25), Hips: [0, 0, -12], LeftLeg: [22, 0, 0], RightUpLeg: [20, 0, -20], RightLeg: [85, 0, 0], Spine: [6, 0, 6], hips: [0, -0.04, 0] },
    { ...arms(80, 40), Hips: [0, 0, -28], LeftUpLeg: [-8, 0, 18], LeftLeg: [24, 0, 0], RightUpLeg: [-20, 0, -60], RightLeg: [75, 0, 0], Spine: [0, 0, 12], hips: [0, -0.06, 0] },
    { ...arms(95, 50), Hips: [0, 0, -38], LeftUpLeg: [-6, 0, 26], LeftLeg: [20, 0, 0], RightUpLeg: [-40, -10, -80], RightLeg: [40, 0, 0], Spine: [0, 8, 16], hips: [0, -0.07, 0] },
    { ...arms(100, 55), Hips: [0, 0, -45], LeftUpLeg: [-4, 0, 30], LeftLeg: [18, 0, 0], RightUpLeg: [-55, -15, -88], RightLeg: [10, 0, 0], RightFoot: [10, 0, 0], Spine: [0, 14, 18], hips: [0, -0.08, 0] },
    { ...arms(90, 45), Hips: [0, 0, -40], LeftUpLeg: [-4, 0, 24], LeftLeg: [18, 0, 0], RightUpLeg: [-62, -25, -70], RightLeg: [12, 0, 0], Spine: [-4, 22, 14], hips: [0, -0.06, 0] },
    { ...arms(45, 25), Hips: [0, 0, -12], ...knees(18), RightUpLeg: [-20, 0, -18], RightLeg: [40, 0, 0], Spine: [4, 6, 4], hips: [0, -0.03, 0] },
  ] },
  // ── Bicycle kick: back to goal, the left leg swung up, the body laid back, the right foot over the head ──
  airBicycle: { fps: 10, contactFrame: 4, point: "foot", poses: [
    { ...arms(40, 40, -20, -20), LeftUpLeg: [-30, 0, 0], LeftLeg: [50, 0, 0], RightUpLeg: [-10, 0, 0], RightLeg: [30, 0, 0], Spine: [-10, 0, 0], hips: [0, -0.08, 0] },
    { ...arms(70, 70, -40, -40), Hips: [-35, 0, 0], LeftUpLeg: [-80, 0, 0], LeftLeg: [55, 0, 0], RightUpLeg: [8, 0, 0], RightLeg: [40, 0, 0], neck: [10, 0, 0], hips: [0, -0.1, 0] },
    { ...arms(100, 100, -30, -30), Hips: [-70, 0, 0], LeftUpLeg: [-40, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [-62, 0, 0], RightLeg: [50, 0, 0], neck: [20, 0, 0], hips: [0, -0.2, 0] },
    { ...arms(120, 120, -20, -20), Hips: [-95, 0, 0], LeftUpLeg: [-10, 0, 0], LeftLeg: [40, 0, 0], RightUpLeg: [-96, 0, 0], RightLeg: [28, 0, 0], neck: [26, 0, 0], hips: [0, -0.3, 0] },
    { ...arms(140, 140, -10, -10), Hips: [-110, 0, 0], LeftUpLeg: [0, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [-110, 0, 0], RightLeg: [4, 0, 0], RightFoot: [30, 0, 0], neck: [30, 0, 0], hips: [0, -0.36, 0] },
    { ...arms(150, 150, -5, -5), Hips: [-118, 0, 0], LeftUpLeg: [-8, 0, 0], LeftLeg: [36, 0, 0], RightUpLeg: [-78, 0, 0], RightLeg: [20, 0, 0], neck: [30, 0, 0], hips: [0, -0.5, 0] },
    { ...arms(120, 120, 10, 10), Hips: [-90, 0, 0], ...knees(60, 60, -40, -40), neck: [24, 0, 0], hips: [0, -0.74, 0] },
  ] },
  // ── Scorpion kick: back to goal, diving forward, the right heel flicked up over his back ──
  airScorpion: { fps: 10, contactFrame: 4, point: "foot", poses: [
    { ...arms(30, 30), ...knees(30), Spine: [10, 0, 0], hips: [0, -0.05, 0] },
    { ...arms(40, 40, -60, -60), Hips: [30, 0, 0], LeftUpLeg: [-20, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [10, 0, 0], RightLeg: [40, 0, 0], neck: [-20, 0, 0], hips: [0, -0.08, 0] },
    { ...arms(50, 50, -90, -90), Hips: [55, 0, 0], LeftUpLeg: [-6, 0, 0], LeftLeg: [24, 0, 0], RightUpLeg: [18, 0, 0], RightLeg: [90, 0, 0], neck: [-36, 0, 0], hips: [0, -0.16, 0] },
    { ...arms(60, 60, -80, -80), Hips: [70, 0, 0], LeftUpLeg: [4, 0, 0], LeftLeg: [24, 0, 0], RightUpLeg: [24, 0, 0], RightLeg: [128, 0, 0], neck: [-46, 0, 0], hips: [0, -0.24, 0] },
    { ...arms(75, 75, -70, -70), Hips: [78, 0, 0], LeftUpLeg: [10, 0, 0], LeftLeg: [28, 0, 0], RightUpLeg: [28, 0, 0], RightLeg: [142, 0, 0], RightFoot: [-25, 0, 0], neck: [-50, 0, 0], hips: [0, -0.3, 0] },
    { ...arms(90, 90, -80, -80), Hips: [85, 0, 0], LeftUpLeg: [8, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [18, 0, 0], RightLeg: [112, 0, 0], neck: [-44, 0, 0], hips: [0, -0.45, 0] },
    { ...arms(70, 70, -90, -90), Hips: [88, 0, 0], ...knees(40, 40, 0, 0), neck: [-36, 0, 0], hips: [0, -0.68, 0] },
  ] },
};
Object.assign(window.CLIPS, window.AERIALS);
