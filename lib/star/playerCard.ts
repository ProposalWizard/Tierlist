/**
 * THE PLAYER CARD — a FIFA-style card for your own player (Harry, 22 Oct
 * 2026: "we should be building a 'card' with the players stats as we go";
 * picked: FIFA-style card).
 *
 * Pure: no React. The card (components/star/PlayerCard.tsx) reads only this.
 *
 * The overall is the game's own one (rating.ts displayOverall off
 * career.starRating, 30-100), never a new formula. The six numbers are your
 * six trained skills, unchanged.
 */
import type { CareerState, Skills } from "./types";
import { displayOverall } from "./rating";
import { aerialOf } from "./aerial";

export type CardTier = "bronze" | "silver" | "gold" | "special";

/**
 * THE ONE PLACE the tier lines live. An overall AT a line is the higher tier.
 *
 * Why these numbers: the game's overall sits on the same 1-100 scale as the
 * real players' FIFA overalls on every team sheet (teamsheet.ts puts you
 * next to them), so the card uses FIFA's own lines: under 65 bronze, 65 to
 * 74 silver, 75 and up gold. Measured on the game's own scale (rating.ts):
 * a new career (all six skills 40) is 58 = bronze; every skill near 50 is
 * 65 = silver; near 64 is 75 = gold. "Special" is for the top: 88 needs
 * about 83 in every skill (or a little less with trophies), which only a
 * player at the very top reaches.
 */
export const CARD_TIERS: { tier: CardTier; from: number }[] = [
  { tier: "special", from: 88 },
  { tier: "gold", from: 75 },
  { tier: "silver", from: 65 },
  { tier: "bronze", from: 0 },
];

export function cardTier(overall: number): CardTier {
  for (const t of CARD_TIERS) if (overall >= t.from) return t.tier;
  return "bronze";
}

export type CardStatKey = keyof Skills;

/** The six stats, in card order, with their three-letter labels. */
export const CARD_STATS: { key: CardStatKey; label: string; name: string }[] = [
  { key: "pace", label: "PAC", name: "Pace" },
  { key: "power", label: "POW", name: "Power" },
  { key: "technique", label: "TEC", name: "Technique" },
  { key: "vision", label: "VIS", name: "Vision" },
  { key: "freeKick", label: "FK", name: "Free Kick" },
  { key: "aerial", label: "AIR", name: "Aerial & Acrobatics" },
];

const whole = (v: unknown, fallback = 40): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(1, Math.min(99, Math.round(v))) : fallback;

/** A skill as the card shows it: a whole number, 1 to 99 (a FIFA card never
 *  shows 100). An old save with no Aerial reads it the game's way (aerialOf). */
export function cardStatValues(skills: Partial<Skills> | undefined): Record<CardStatKey, number> {
  const s = (skills ?? {}) as Partial<Skills>;
  return {
    pace: whole(s.pace),
    power: whole(s.power),
    technique: whole(s.technique),
    vision: whole(s.vision),
    freeKick: whole(s.freeKick),
    aerial: whole(aerialOf(s)),
  };
}

/** Which stats went UP since the card last saw them, and by how much. A stat
 *  that went down or stayed shows nothing. Empty when there is no "before". */
export function cardGains(
  before: Partial<Record<CardStatKey, number>> | null | undefined,
  after: Record<CardStatKey, number>,
): Partial<Record<CardStatKey, number>> {
  const out: Partial<Record<CardStatKey, number>> = {};
  if (!before) return out;
  for (const { key } of CARD_STATS) {
    const b = before[key];
    if (typeof b === "number" && after[key] > b) out[key] = after[key] - b;
  }
  return out;
}

export interface CardData {
  overall: number;
  tier: CardTier;
  position: string;
  stats: Record<CardStatKey, number>;
}

/** Everything the card shows that is a number or a word from the career. */
export function cardData(career: Pick<CareerState, "starRating" | "skills" | "player">): CardData {
  const overall = Math.min(99, displayOverall(typeof career.starRating === "number" ? career.starRating : 2.5));
  return {
    overall,
    tier: cardTier(overall),
    position: (career.player?.position || "ST").toUpperCase(),
    stats: cardStatValues(career.skills),
  };
}
