/**
 * THE STAR PASS'S REWARDS (Mikey, 2 Oct 2026).
 *
 * At first a reward sat every 5 levels (5, 10 … 100). Since 5 Oct 2026 a
 * reward can sit at ANY level from 1 to 100 (Mikey: "2, 4, 6 … or 5, 10, 15
 * … or 10, 20, 30 … or 1 to 9 — choose in the Star Pass rewards area"). The
 * levels with a card on them are the stops on the road; level 100's stand is
 * always there. Which card sits where is the shared layout
 * (lib/star/starPassStore.ts, set on /admin/star-pass).
 */
export const PASS_TOP = 100;

export type RewardTier = "medium" | "great";

/** Every level a reward can sit at: 1 to 100. */
export const ALL_PASS_LEVELS: number[] = Array.from({ length: PASS_TOP }, (_, i) => i + 1);

export const isPassLevel = (n: number) => Number.isInteger(n) && n >= 1 && n <= PASS_TOP;

/** The stops on the road: every level with a card, plus level 100's stand. */
export function rewardLevelsOf(levels: Record<number, string>): number[] {
  const out = new Set<number>([PASS_TOP]);
  for (const [k, v] of Object.entries(levels)) if (v && isPassLevel(Number(k))) out.add(Number(k));
  return Array.from(out).sort((a, b) => a - b);
}

/** Every 10th level is a great reward (the big podium); every other level a medium one. */
export function rewardTier(level: number): RewardTier {
  return level % 10 === 0 ? "great" : "medium";
}

/** A reward shown as live 3D you can spin (components/star/Podium3D.tsx). */
export interface Live3D {
  podium: string;
  item: string;
  /** Where the item stands and how big, in Blender units (z up). */
  itemAt?: [number, number, number];
  itemScale?: number;
  /** Camera: height it looks at, distance back, tilt down (degrees). */
  look: number;
  dist: number;
  tilt: number;
  /** Canvas size in CSS px. */
  w: number;
  h: number;
  /** Tap-to-zoom: the point to look at (Blender coords) and how close. */
  zoom?: { at: [number, number, number]; dist: number };
}

// The rewards themselves live in the catalogue (lib/star/rewardCatalogue.ts)
// and which one sits at which level is the shared layout
// (lib/star/starPassStore.ts, set on /admin/star-pass).

/** The look of each stretch of the road: a new one every 20 levels. */
export interface StarPassTheme {
  key: "premier" | "europa" | "champions" | "worldcup" | "ballondor";
  from: number;
  to: number;
  /** The road's background: a painted floodlit pitch in this stretch's
   *  colours (tools/star-pass-art/make_backgrounds.py). */
  bg: string;
  /** The rail's colour and the glow on this stretch. */
  accent: string;
}

export const STAR_PASS_THEMES: StarPassTheme[] = [
  { key: "premier", from: 1, to: 20, accent: "#22e8d6",
    bg: "/star/star-pass/bg-premier.webp" },
  { key: "europa", from: 21, to: 40, accent: "#ff7a1a",
    bg: "/star/star-pass/bg-europa.webp" },
  { key: "champions", from: 41, to: 60, accent: "#cfe0ff",
    bg: "/star/star-pass/bg-champions.webp" },
  { key: "worldcup", from: 61, to: 80, accent: "#ffcc4d",
    bg: "/star/star-pass/bg-worldcup.webp" },
  { key: "ballondor", from: 81, to: 100, accent: "#ffd76a",
    bg: "/star/star-pass/bg-ballondor.webp" },
];

export function themeFor(level: number): StarPassTheme {
  return STAR_PASS_THEMES.find(t => level >= t.from && level <= t.to) ?? STAR_PASS_THEMES[0];
}
