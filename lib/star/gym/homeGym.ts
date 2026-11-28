/**
 * HOME GYMS BY HOUSE LEVEL (Harry, 28 Nov 2026). Your house gets a gym of its size, built from the club
 * gym's own machines and games (world3d/gymPlace.ts, games.ts, games2.ts): never a copy of a game.
 *
 *   starter, flat   a workout corner: a mat and dumbbells        push-ups, plank                       (2)
 *   penthouse       a small gym room: a bench and cardio          + bench press, treadmill              (4)
 *   house           a garage gym                                  + back squat (rack), pull-ups         (6)
 *   villa           a full gym room with a mirror wall            + heavy bag, box jumps, mobility      (9)
 *   estate          a private gym with everything                 + Nordics, Copenhagen, ladder, landing (13)
 *                   and a sauna door ("coming soon")
 *
 * The brief said "a bench + bike" for the penthouse. There is no bike game and no bike pose (a new game
 * would break the "no copy, no new clip" rule), so the penthouse's cardio machine is the club's treadmill.
 *
 * Same save, same limits: an exercise at home is the club gym's own `gymExercise` on `career.gym`
 * (the daily ring, the gap's cap, the window), with the gym effect flag exactly as the club gym
 * (GYM_CAREER_EFFECT "off" today). On top, a home exercise costs game minutes on the career clock
 * (life/houseActs.ts GYM_MINS, life/clock.ts passTime), like every other thing in the house.
 *
 * Where each room's walls stand: a box in the club gym's own metres (the machines keep their spots, so
 * every pose and contact is the club gym's), checked in tests/star/homeGym.mts: every machine of the
 * tier, its stand spot and the way in fit inside with room to walk.
 *
 * Pure: no three.js. Test: tests/star/homeGym.mts.
 */
import type { CareerState } from "../types";
import type { HomeTier } from "../home3d/homes";
import type { GymGameKind, GameResult } from "./games";
import { gymExercise, GYM_CAREER_EFFECT, type GymCareerOut, type GymEffectMode } from "./progress";
import { passTime, clockOf, absOf, hhmm } from "../life/clock";
import { GYM_MINS } from "../life/houseActs";

export type HomeGymKind = "corner" | "room" | "garage" | "full" | "private";

export interface HomeGymPlan {
  tier: HomeTier;
  kind: HomeGymKind;
  /** What the card and the sign call it. */
  label: string;
  /** The exercises it has (the club gym's own games). */
  kinds: GymGameKind[];
  /** The room's walls, in the club gym's metres: x0, x1, z0, z1 (the club gym is -5..5 by -4..4). */
  box: [number, number, number, number];
  /** The way in (the south wall), across. */
  doorX: number;
  /** A live mirror wall (north). */
  mirror: boolean;
  /** A sauna door (estate): its card says "coming soon". */
  sauna: boolean;
  /** A dumbbell rack along the west wall: from z0 to z1 (null: a pair on the floor by the mat). */
  rack: [number, number] | null;
  /** The house's own room this gym is (its floor and paint, home3d/roomBuild.ts ROOM_LOOK): the villa's and the
   *  estate's gym room, so walking in from it looks the same. Absent: the house's main finish (homes.ts). */
  look?: { floor: import("../home3d/homes").FloorKind; wall: string };
}

const CORNER: GymGameKind[] = ["pushup", "plank"];
const ROOM: GymGameKind[] = [...CORNER, "bench", "treadmill"];
const GARAGE: GymGameKind[] = [...ROOM, "squat", "pullup"];
const FULL: GymGameKind[] = [...GARAGE, "bag", "boxjump", "mobility"];
const PRIVATE: GymGameKind[] = [...FULL, "nordic", "copenhagen", "ladder", "landing"];

export const HOME_GYMS: Record<HomeTier, HomeGymPlan> = {
  starter: { tier: "starter", kind: "corner", label: "Workout corner", kinds: CORNER, box: [-1.5, 2.5, 0.2, 4.8], doorX: 0.3, mirror: false, sauna: false, rack: null },
  flat: { tier: "flat", kind: "corner", label: "Workout corner", kinds: CORNER, box: [-1.5, 2.5, 0.2, 4.8], doorX: 0.3, mirror: false, sauna: false, rack: [0.7, 2.1] },
  penthouse: { tier: "penthouse", kind: "room", label: "Home gym", kinds: ROOM, box: [-3.7, 3.9, -3.2, 3.0], doorX: 0, mirror: false, sauna: false, rack: [0.2, 2.0] },
  house: { tier: "house", kind: "garage", label: "Garage gym", kinds: GARAGE, box: [-3.7, 5.5, -4.4, 3.4], doorX: 0, mirror: false, sauna: false, rack: [0.3, 2.4] },
  villa: { tier: "villa", kind: "full", label: "Home gym", kinds: FULL, box: [-5, 5, -4, 4], doorX: 0, mirror: true, sauna: false, rack: [-2.9, -0.6], look: { floor: "boards", wall: "#d9dcdf" } },
  estate: { tier: "estate", kind: "private", label: "Private gym", kinds: PRIVATE, box: [-5, 6.6, -4, 4], doorX: 0, mirror: true, sauna: true, rack: [-2.9, -0.6], look: { floor: "boards", wall: "#d9dcdf" } },
};

/** The home gym of a tier. */
export function homeGymOf(tier: HomeTier): HomeGymPlan {
  return HOME_GYMS[tier] ?? HOME_GYMS.starter;
}

/** The exercises a tier's home gym has. */
export const homeGymKinds = (tier: HomeTier): GymGameKind[] => [...homeGymOf(tier).kinds];

/**
 * What each machine takes on the floor (the machine, its stand spot, a body's room round them), in the club
 * gym's metres: x0, x1, z0, z1. Read off world3d/gymPlace.ts buildGymRoom and gymPoses2.ts GYM2.
 */
export const MACHINE_FOOT: Record<GymGameKind, [number, number, number, number]> = {
  pushup: [-0.3, 1.8, 1.05, 2.4],
  plank: [-0.3, 1.8, 1.05, 2.4],
  nordic: [-0.4, 1.5, 2.05, 3.4],
  mobility: [-0.4, 1.5, 2.05, 3.4],
  bench: [-3.05, -1.5, -2.0, -0.3],
  treadmill: [2.09, 3.01, -2.65, 0.2],
  squat: [-0.45, 1.75, -3.85, -1.6],
  pullup: [3.5, 4.9, 1.5, 2.8],
  bag: [-4.3, -1.8, 0.4, 2.7],
  boxjump: [1.9, 2.5, 0.45, 1.7],
  copenhagen: [2.85, 3.85, 0.45, 1.65],
  ladder: [1.7, 4.0, 2.7, 3.2],
  landing: [2.7, 3.5, 1.15, 2.45],
};

/** Where you stand when you walk in: just inside the door, facing in (north). */
export function homeGymStart(tier: HomeTier): { x: number; z: number; yaw: number } {
  const p = homeGymOf(tier);
  // a step in and to the side of the door: camera D then has room behind him (at the door it sat on the wall)
  return { x: p.doorX - 0.9, z: p.box[3] - 1.5, yaw: Math.PI };
}

export interface HomeExerciseOut extends GymCareerOut {
  /** Game minutes it took (the clock stops at time to leave for a match, so maybe fewer). */
  mins: number;
  /** "20 minutes later · 14:30". */
  sub: string;
}

/**
 * One exercise in your home gym: the club gym's own `gymExercise` (the same numbers, ring, caps and window
 * in the save; the effect flag as the club gym), then its minutes on the career clock.
 */
export function homeGymExercise(c: CareerState, result: Pick<GameResult, "kind" | "quality">, mode: GymEffectMode = GYM_CAREER_EFFECT): HomeExerciseOut {
  const r = gymExercise(c, result, mode);
  const before = absOf(clockOf(r.career));
  const spent = passTime(r.career, GYM_MINS[result.kind] ?? 20);
  const mins = absOf(clockOf(spent)) - before;
  const at = hhmm(clockOf(spent).m);
  const sub = mins > 0 ? `${mins} minutes later · ${at}` : `${at} · time to leave for the match`;
  return { ...r, career: spent, out: { ...r.out, words: [r.out.words, sub].filter(Boolean).join(" ") }, mins, sub };
}

/** Where the gym came from, and so where its "‹ back" goes. */
export type GymFrom = "training" | "home" | "compound";

/** The back pill's words and where it leads (pure, so the page and the test page read the same). */
export function gymBack(from: GymFrom): { label: string; to: "skills" | "home-3d" | "compound" } {
  if (from === "home") return { label: "House", to: "home-3d" };
  if (from === "compound") return { label: "Compound", to: "compound" };
  return { label: "Training", to: "skills" };
}
