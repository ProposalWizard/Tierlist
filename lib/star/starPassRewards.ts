/**
 * THE STAR PASS'S REWARDS (Mikey, 2 Oct 2026).
 *
 * A reward every 5 levels from 5 to 100: the 5s are medium rewards, the 10s
 * great ones. What each one IS is Mikey's call and is not decided yet, so
 * every slot shows a placeholder until a line is added to STAR_PASS_REWARDS.
 *
 * Adding a reward later: one line here, e.g.
 *   15: { name: "Knee-slide celebration", image: "/star/rewards/kneeslide.webp" },
 * The Star Pass screen (components/star/StarRatingSheet.tsx) shows it on its
 * platform. Giving the reward to the player (claiming) is built when the
 * first real reward is.
 */
export const STAR_PASS_STEP = 5;

export type RewardTier = "medium" | "great";

/** 5, 10, 15 … 100. */
export const REWARD_LEVELS: number[] = Array.from({ length: 100 / STAR_PASS_STEP }, (_, i) => (i + 1) * STAR_PASS_STEP);

/** Every 10th level is a great reward; the 5s in between are medium. */
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
