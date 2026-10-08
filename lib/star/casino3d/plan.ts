/**
 * THE 3D CASINO'S FLOOR PLAN — where everything stands (metres; the doors
 * are at +z). Pure numbers, no three.js, so the tests can read it
 * (tests/star/casino3dGames.mts). lib/star/casino3d/scene.ts builds the room
 * from these.
 */
import type { XZ } from "../tapWalk";

/** The stations: the same ids as the casino's games (components/star/Casino.tsx). */
export type CasinoStation = "roulette" | "blackjack" | "slots" | "horses" | "bets" | "goalie";

export const ROOM = { x: 7, z: 8, h: 4.2 };
export const DOOR_HALF = 1.1;
export const DOOR_H = 2.7;
export const ROUL = { x: -3.4, z: -0.8, rx: 1.7, rz: 0.95 };
/** The roulette wheel inside the table (table-local x), its height and size. */
export const WHEEL = { dx: -1.0, y: 1.035, r: 0.5 };
export const BJ = { x: 3.4, z: -1.6, r: 1.45 };
export const SLOT_X = -6.35;
export const SLOT_Z = [1.2, 2.5, 3.8, 5.1];
/** The machine you play: the second one (the first and last have punters). */
export const PLAY_SLOT = 1;
export const SCREEN = { x: -1.6, w: 6.0, h: 3.0, y: 2.45 };
export const BETS = { x: 6.0, z0: 1.4, z1: 5.0 };
export const ARCADE = { x: 5.3, z: -6.95 };
export const START = { x: 0, z: ROOM.z - 2.6 };
/** The bar, back left: the counter (its long side along z). */
export const BAR = { x: -5.75, z0: -6.9, z1: -3.6, top: 1.0 };

/**
 * Where walking up to each station shows its card. The racing screen's area
 * is the floor right in front of the screen only: until 8 Oct 2026 it ran to
 * x = −4.9, which reached the bar (you stand at about x = −5.1 to drink) and
 * showed "Horse racing" at the bar.
 */
export const ZONES: { id: CasinoStation; inside: (x: number, z: number) => boolean }[] = [
  { id: "roulette", inside: (x, z) => Math.hypot((x - ROUL.x) / 1.35, z - ROUL.z) < 2.4 },
  { id: "blackjack", inside: (x, z) => Math.hypot(x - BJ.x, z - BJ.z) < 2.9 && z > BJ.z - 0.4 },
  { id: "slots", inside: (x, z) => x < -4.3 && z > 0.4 && z < 5.9 },
  { id: "horses", inside: (x, z) => z < -4.9 && Math.abs(x - SCREEN.x) < 2.3 },
  { id: "goalie", inside: (x, z) => Math.hypot(x - ARCADE.x, z - (ARCADE.z + 1.5)) < 1.5 },
  { id: "bets", inside: (x, z) => x > 4.2 && z > BETS.z0 - 0.4 && z < BETS.z1 + 0.4 },
];

/** The station whose card shows when you stand at (x, z), if any. */
export function stationAt(x: number, z: number): CasinoStation | null {
  for (const zn of ZONES) if (zn.inside(x, z)) return zn.id;
  return null;
}

/** Where you stand to play each station, and what you face. */
export const STAND: Record<CasinoStation, { at: XZ; face: XZ }> = {
  roulette: { at: [ROUL.x + 0.4, ROUL.z + 2.0], face: [ROUL.x, ROUL.z] },
  blackjack: { at: [BJ.x, BJ.z + 2.45], face: [BJ.x, BJ.z] },
  slots: { at: [-4.9, SLOT_Z[PLAY_SLOT]], face: [SLOT_X, SLOT_Z[PLAY_SLOT]] },
  horses: { at: [SCREEN.x, -5.6], face: [SCREEN.x, -ROOM.z] },
  goalie: { at: [ARCADE.x, ARCADE.z + 1.6], face: [ARCADE.x, ARCADE.z] },
  bets: { at: [4.65, (BETS.z0 + BETS.z1) / 2], face: [ROOM.x, (BETS.z0 + BETS.z1) / 2] },
};

/** The stations whose game plays in the room itself (the rest open the flat screen). */
export type InRoomGame = "roulette" | "slots" | "blackjack" | "horses";
export const IN_ROOM_GAMES: InRoomGame[] = ["roulette", "slots", "blackjack", "horses"];
export const isInRoomGame = (s: CasinoStation | null): s is InRoomGame => !!s && (IN_ROOM_GAMES as string[]).includes(s);

/**
 * The camera's close-up for each in-room game: where it sits and what it
 * looks at. The lower part of a phone screen has the bet buttons on it, so
 * each shot puts the thing being played in the top half.
 */
export const FOCUS: Record<InRoomGame, { pos: [number, number, number]; look: [number, number, number] }> = {
  roulette: { pos: [ROUL.x + WHEEL.dx + 0.05, 2.35, ROUL.z + 1.05], look: [ROUL.x + WHEEL.dx, 0.72, ROUL.z - 0.05] },
  slots: { pos: [SLOT_X + 1.65, 1.95, SLOT_Z[PLAY_SLOT] + 0.32], look: [SLOT_X, 1.36, SLOT_Z[PLAY_SLOT] - 0.04] },
  blackjack: { pos: [BJ.x, 2.05, BJ.z + 1.5], look: [BJ.x, 0.55, BJ.z + 0.5] },
  horses: { pos: [SCREEN.x, 2.15, -3.4], look: [SCREEN.x, 2.0, -ROOM.z] },
};
