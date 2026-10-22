/**
 * THE SEASON AWARDS NIGHT — who stands where and when (Leo's tonight plan,
 * part 13a: "a smaller hall, the same system" as the Ballon d'Or night).
 *
 * Pure. The 3D room is lib/star/awardsNight3d.ts; the screen around it (and
 * the drawn room for a phone that can't run 3D) is
 * components/star/SeasonAwardsNight.tsx. Both read this one plan, so the
 * words and the people keep the same time.
 *
 * Five awards, in this order: Golden Boot, Assist King, Golden Glove, Young
 * Player, Player of the Season. Each award (about 8 s):
 *   the host calls the award → the three nominees → "And the winner is…"
 *   → the name → the winner walks up from his table onto the stage → he
 *   lifts the trophy → next.
 * A tap skips to the next award; "Skip all" ends the night.
 *
 * Metres; y up; the stage faces +z (the camera). The stage is low (STAGE_H)
 * with steps at the front left; round tables stand in front of it.
 */
import type { AwardWinner, SeasonAwardKey, SeasonAwardStats } from "./seasonAwards";

export const AWARD_ORDER: SeasonAwardKey[] = ["goldenBoot", "assistKing", "goldenGlove", "youngPlayerOfSeason", "playerOfSeason"];

export const AWARD_INFO: Record<SeasonAwardKey, { label: string; unit: string; icon: string }> = {
  goldenBoot: { label: "Golden Boot", unit: "goals", icon: "👟" },
  assistKing: { label: "Assist King", unit: "assists", icon: "🎯" },
  goldenGlove: { label: "Golden Glove", unit: "clean sheets", icon: "🧤" },
  youngPlayerOfSeason: { label: "Young Player of the Season", unit: "votes", icon: "💎" },
  playerOfSeason: { label: "Player of the Season", unit: "votes", icon: "🌟" },
};

/** The room's fixed marks. */
export const ROOM = {
  /** The stage's height off the floor. */
  stageH: 0.42,
  /** The stage's front edge (z). */
  stageFront: 0.75,
  /** Where the winner stands to lift the trophy. */
  spot: { x: -0.35, z: 0.1 },
  /** The host's lectern. */
  lectern: { x: 1.45, z: 0.25 },
  /** The steps: their foot on the floor and their top on the stage. */
  stepFoot: { x: -1.45, z: 1.75 },
  stepTop: { x: -1.45, z: 0.7 },
  /** The trophy table, behind the spot. */
  trophyTable: { x: 0.55, z: -0.35 },
  /** The round tables (centre x, z) and their radius. */
  tables: [
    { x: -2.6, z: 3.1 }, { x: 0.55, z: 3.35 }, { x: 3.2, z: 3.05 },
    { x: -4.0, z: 5.4 }, { x: -1.05, z: 5.75 }, { x: 1.95, z: 5.7 }, { x: 4.6, z: 5.3 },
  ] as readonly { x: number; z: number }[],
  tableR: 0.72,
} as const;

/** Where a winner waits: the stage side of one of the two front tables. */
const SEATS: readonly { x: number; z: number }[] = [
  { x: -3.0, z: 2.0 }, { x: -2.6, z: 2.0 }, { x: -2.2, z: 2.0 },
  { x: 0.05, z: 2.22 }, { x: 0.55, z: 2.22 },
];

export interface AwardCall {
  key: SeasonAwardKey;
  label: string;
  unit: string;
  icon: string;
  /** Up to three, best first; [0] is the winner. */
  nominees: AwardWinner[];
  winner: AwardWinner;
  /** Who walks up (a stable id: the same man for two awards is one person). */
  winnerId: string;
  /** Where he waits before his walk. */
  seat: { x: number; z: number };
  /** Beats, seconds from the start of the night. */
  from: number;
  nomineesAt: number;
  envelopeAt: number;
  revealAt: number;
  walkFrom: number;
  walkTo: number;
  end: number;
}

export interface AwardsPlan {
  season: number;
  awards: AwardCall[];
  /** The room before the first award. */
  introEnd: number;
  end: number;
  /** How many awards are yours. */
  yourWins: number;
}

/** Small, seeded: the same night is laid out the same way every time. */
function rand(seed: number, k: number): number {
  let h = (seed * 2654435761 + k * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

export const personId = (w: Pick<AwardWinner, "name" | "club" | "isYou">) => (w.isYou ? "you" : `${w.name}|${w.club}`);

/**
 * The three up for an award: the stats' own list when the save has one, else
 * (an older save) the winner alone — never made-up names.
 */
export function nomineesFor(stats: SeasonAwardStats, key: SeasonAwardKey): AwardWinner[] {
  const winner = stats[key];
  if (!winner) return [];
  const list = (stats.nominees?.[key] ?? []).filter((n) => n.name);
  const rest = list.filter((n) => personId(n) !== personId(winner)).slice(0, 2);
  return [winner, ...rest];
}

/** Lengths of each part of an award, seconds. */
export const BEAT = { call: 1.4, nominees: 2.1, envelope: 0.9, toWalk: 0.2, walk: 2.3, moment: 1.4 } as const;
export const INTRO = 2.0;

/** The night's plan from the season's award stats. Awards with no winner are left out. */
export function awardsPlan(stats: SeasonAwardStats, seed = 1): AwardsPlan {
  const awards: AwardCall[] = [];
  const seats = new Map<string, { x: number; z: number }>();
  // Each different winner gets his own seat (seeded order), so two awards for one man come from one table.
  const free = [...SEATS];
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed, i) * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  let t = INTRO;
  for (const key of AWARD_ORDER) {
    const nominees = nomineesFor(stats, key);
    if (nominees.length === 0) continue;
    const winner = nominees[0];
    const id = personId(winner);
    if (!seats.has(id)) seats.set(id, free[seats.size % free.length]);
    // A touch of seeded variety in how long the envelope takes.
    const envelope = BEAT.envelope + rand(seed + hashName(key), 7) * 0.3;
    const from = t;
    const nomineesAt = from + BEAT.call;
    const envelopeAt = nomineesAt + BEAT.nominees;
    const revealAt = envelopeAt + envelope;
    const walkFrom = revealAt + BEAT.toWalk;
    const walkTo = walkFrom + BEAT.walk;
    const end = walkTo + BEAT.moment;
    const info = AWARD_INFO[key];
    awards.push({ key, ...info, nominees, winner, winnerId: id, seat: seats.get(id)!, from, nomineesAt, envelopeAt, revealAt, walkFrom, walkTo, end });
    t = end;
  }
  return { season: stats.season, awards, introEnd: INTRO, end: t, yourWins: awards.filter((a) => a.winner.isYou).length };
}

/** The award on at time t (the last one once the night is over), or null in the intro. */
export function awardAt(plan: AwardsPlan, t: number): AwardCall | null {
  if (t < plan.introEnd) return null;
  for (const a of plan.awards) if (t < a.end) return a;
  return plan.awards[plan.awards.length - 1] ?? null;
}

export type AwardBeat = "intro" | "call" | "nominees" | "envelope" | "reveal" | "walk" | "moment" | "done";

export function beatAt(plan: AwardsPlan, t: number): AwardBeat {
  if (t >= plan.end) return "done";
  const a = awardAt(plan, t);
  if (!a) return "intro";
  if (t >= a.walkTo) return "moment";
  if (t >= a.walkFrom) return "walk";
  if (t >= a.revealAt) return "reveal";
  if (t >= a.envelopeAt) return "envelope";
  if (t >= a.nomineesAt) return "nominees";
  return "call";
}

/** Where a tap goes: the start of the next award, or the end of the night. */
export function skipTarget(plan: AwardsPlan, t: number): number {
  for (const a of plan.awards) if (a.from > t + 1e-6) return a.from;
  return plan.end;
}

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

export interface WinnerPos { x: number; y: number; z: number; /** Facing (y rotation; 0 = to the camera). */ yaw: number; walking: boolean; onStage: boolean; seen: boolean }

/**
 * Where an award's winner is at time t: by his table until the walk, then
 * to the foot of the steps, up them, across to the spot, and turned to the room.
 * Seen from the start of his walk (the camera is on the screen as his name
 * is said) to the end of his award.
 */
export function winnerPosAt(a: AwardCall, t: number): WinnerPos {
  const seen = t >= a.walkFrom && t < a.end;
  const pts = [
    { x: a.seat.x, y: 0, z: a.seat.z },
    { x: ROOM.stepFoot.x, y: 0, z: ROOM.stepFoot.z },
    { x: ROOM.stepTop.x, y: ROOM.stageH, z: ROOM.stepTop.z },
    { x: ROOM.spot.x, y: ROOM.stageH, z: ROOM.spot.z },
  ];
  const lens = [1, 2, 3].map((i) => Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const total = lens.reduce((s, l) => s + l, 0);
  const k = smooth((t - a.walkFrom) / (a.walkTo - a.walkFrom));
  if (t < a.walkFrom) {
    // Standing by his table, turned to the stage.
    const yaw = Math.atan2(ROOM.stepFoot.x - a.seat.x, ROOM.stepFoot.z - a.seat.z);
    return { ...pts[0], yaw, walking: false, onStage: false, seen };
  }
  if (k >= 1) {
    // On the spot: turn from walking (+x) to the room over half a second.
    const turn = smooth((t - a.walkTo) / 0.5);
    const from = Math.atan2(pts[3].x - pts[2].x, pts[3].z - pts[2].z);
    return { ...pts[3], yaw: from * (1 - turn), walking: false, onStage: true, seen };
  }
  let d = k * total;
  for (let i = 0; i < 3; i++) {
    if (d <= lens[i] || i === 2) {
      const u = Math.min(1, d / Math.max(1e-6, lens[i]));
      const p0 = pts[i], p1 = pts[i + 1];
      return {
        x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u, z: p0.z + (p1.z - p0.z) * u,
        yaw: Math.atan2(p1.x - p0.x, p1.z - p0.z), walking: true, onStage: i === 2, seen,
      };
    }
    d -= lens[i];
  }
  return { ...pts[3], yaw: 0, walking: false, onStage: true, seen };
}

/** How far the trophy has gone from its table into the winner's hands (0..1). */
export function trophyLiftAt(a: AwardCall, t: number): number {
  return smooth((t - a.walkTo + 0.1) / 0.6);
}
