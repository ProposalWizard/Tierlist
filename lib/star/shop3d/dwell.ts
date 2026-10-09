/**
 * WHEN AN ITEM'S CARD OPENS IN THE 3D SHOP (Harry, 9 Oct 2026: "when you
 * walk past stuff in the shop it's too easy for it to pop up on screen").
 *
 * Before: the card opened the moment he stepped into a display's area. The
 * boots' area is the whole west strip of the shop (x < −2.75, 8.2 m long),
 * so walking down that side opened the boots card at once.
 *
 * Now the card opens only when one of these holds for DWELL_S (0.4 s):
 *   - he has STOPPED (under STOP_SPEED) within STOP_R of an item, or
 *   - he FACES an item (within FACE_DEG) within FACE_R of it,
 * or straight away when a tap walked him there (the caller passes `arrived`).
 * Walking past at walking pace never opens it. Distances are to the item's
 * front (a plinth's edge, the turntable's edge, the fridge door, the counter).
 * Leaving the display's area closes it, as before. Pure: tests/star/shop3dDwell.mts.
 */
export const DWELL_S = 0.4;
export const STOP_SPEED = 0.35;
export const STOP_R = 1.5;
export const FACE_R = 1.2;
export const FACE_DEG = 45;

export interface DwellIn {
  /** Is he inside a display's area at all? */
  inZone: boolean;
  /** Metres from him to the nearest item's front. */
  dist: number;
  /** Metres a second. */
  speed: number;
  /** Radians between where he faces and the item. */
  faceOff: number;
  /** A tap-walk to this display just arrived. */
  arrived?: boolean;
}

/** The dwell timer after dt seconds, and whether the card should be open. */
export function stepDwell(timer: number, open: boolean, s: DwellIn, dt: number): { timer: number; open: boolean } {
  if (!s.inZone) return { timer: 0, open: false };
  if (open) return { timer, open: true };
  if (s.arrived) return { timer: DWELL_S, open: true };
  const stopped = s.speed < STOP_SPEED && s.dist <= STOP_R;
  const facing = s.dist <= FACE_R && Math.abs(s.faceOff) <= (FACE_DEG * Math.PI) / 180 && s.speed < 1.2;
  const t = stopped || facing ? timer + dt : 0;
  return { timer: t, open: t >= DWELL_S };
}
