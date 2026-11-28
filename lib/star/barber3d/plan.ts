/**
 * THE BARBER'S SHOP, the plan (pure, no three.js; tests/star/barber.mts). The room behind the shopping street's
 * BARBER door (lib/star/street3d/plan.ts), code-built in the street's look: one small room, so it stays well under
 * a phone's budget (docs/plans/STAR_PASS_BARBER_FOOD_PLAN.md 2.9: Mikey's S20 already lags in the garden).
 *
 * Plan (metres, your frame): the door is in the front wall (z = +HALF_D) and you walk in facing -z. The mirror wall
 * is on your left (x = -HALF_W): two red barber chairs face it, yours the nearer. Along the right wall: a waiting
 * bench (one customer on it), the counter with the till by the door, the striped pole on the wall. A shelf of
 * tins runs under the mirror. Two windows either side of the door look out on the street.
 */
export type XZ = [number, number];

/** Half the room's width (x) and depth (z), and its height. */
export const HALF_W = 2.7;
export const HALF_D = 3.4;
export const ROOM_H = 3.0;
/** The doorway in the front wall: its middle x and half width. */
export const DOOR_X = 0.6;
export const DOOR_HALF = 0.55;

/** The chairs: where each stands, facing the mirror (yaw: 0 faces +z; -π/2 faces -x, the mirror wall). */
export const CHAIR_YAW = -Math.PI / 2;
export const CHAIRS: XZ[] = [[-1.55, 0.55], [-1.55, -1.45]];
/** Your chair (the nearer the door). */
export const YOUR_CHAIR = 0;
/** The seat's top (m) and how far its front edge is in front of the hips. */
export const SEAT_Y = 0.6;
export const SEAT_FRONT = 0.24;
/** The mirror on the wall: its middle height, its width and height. */
export const MIRROR = { y: 1.55, w: 4.4, h: 1.1 };
/** The counter under the mirror: its depth from the wall and top height. */
export const SHELF = { d: 0.42, y: 0.92 };
/** The waiting bench along the right wall (its middle z, its length), facing -x. */
export const BENCH = { x: HALF_W - 0.42, z: -1.2, len: 1.6, y: 0.46, yaw: -Math.PI / 2 };
/** The till counter by the door, on the right. */
export const COUNTER = { x: 1.75, z: 2.2, w: 1.5, d: 0.6, h: 1.02 };
/** Where the barber stands: behind your chair (a step back from it, towards the room). */
export const BARBER_SPOT: XZ = [-0.82, 0.42];
/** Where he waits while you choose: by the counter, looking at you. */
export const BARBER_WAIT: XZ = [0.9, 1.4];

/** Where you come in (just inside the door) and the walk to your chair (a step in front of it). */
export const ENTER: XZ = [DOOR_X, HALF_D - 0.45];
export function walkIn(): XZ[] {
  const c = CHAIRS[YOUR_CHAIR];
  return [ENTER, [DOOR_X - 0.1, 1.6], [c[0] + 0.62, c[1] + 0.05]];
}
/** The walk out: from the chair back to the door, then through it. */
export function walkOut(): XZ[] {
  const c = CHAIRS[YOUR_CHAIR];
  return [[c[0] + 0.62, c[1] + 0.05], [DOOR_X - 0.1, 1.6], ENTER, [DOOR_X, HALF_D + 0.6]];
}

/** Every solid on the floor [x0, x1, z0, z1] (the walk and the people keep a body's width off them). */
export function barberSolids(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  out.push([-HALF_W, -HALF_W + SHELF.d, -HALF_D, HALF_D]); // the counter under the mirror
  out.push([BENCH.x - 0.25, HALF_W, BENCH.z - BENCH.len / 2, BENCH.z + BENCH.len / 2]);
  out.push([COUNTER.x - COUNTER.w / 2, COUNTER.x + COUNTER.w / 2, COUNTER.z - COUNTER.d / 2, COUNTER.z + COUNTER.d / 2]);
  for (const [x, z] of CHAIRS) out.push([x - 0.33, x + 0.33, z - 0.33, z + 0.33]);
  return out;
}

/** The fixed camera shots (position, look-at), for a phone held upright and a wide screen. */
export type Shot = "enter" | "chair" | "mirror" | "cut" | "leave";
export function shotOf(s: Shot, tall: boolean): { pos: [number, number, number]; look: [number, number, number]; fov: number } {
  const c = CHAIRS[YOUR_CHAIR];
  const headY = SEAT_Y + 0.78;
  switch (s) {
    // from the back of the room by the bench: the door, the chairs and the mirror on the left, your walk to the chair
    case "enter": return { pos: [1.35, 2.15, -3.05], look: [-0.45, 0.95, 1.5], fov: tall ? 70 : 58 };
    // a three-quarter front close on your head and shoulders in the chair (between you and the mirror); on a
    // phone the head sits in the top part, over the style list
    case "chair": return { pos: [c[0] - 0.95, headY + 0.16, c[1] + 1.3], look: [c[0] - 0.12, headY - (tall ? 0.36 : 0.12), c[1] + 0.05], fov: tall ? 50 : 38 };
    // "in the mirror": from the mirror, your face straight on
    case "mirror": return { pos: [c[0] - 0.98, headY + 0.04, c[1] + 0.02], look: [c[0], headY - (tall ? 0.14 : 0.02), c[1]], fov: tall ? 46 : 36 };
    // the cut: from behind, to one side: the barber working behind you, you and the mirror
    case "cut": return { pos: [c[0] + 0.2, headY + 0.5, c[1] + 2.7], look: [c[0] + 0.42, headY - 0.3, c[1]], fov: tall ? 62 : 48 };
    case "leave": return { pos: [1.35, 2.15, -3.05], look: [-0.2, 0.95, 1.9], fov: tall ? 70 : 58 };
  }
}
