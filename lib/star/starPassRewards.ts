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

export interface StarPassReward {
  name: string;
  /** A picture of it; the placeholder box shows when there is none. */
  image?: string;
}

/** The rewards, by level. Empty until Mikey decides them. */
export const STAR_PASS_REWARDS: Partial<Record<number, StarPassReward>> = {};

/** The look of each stretch of the road: a new one every 20 levels. */
export interface StarPassTheme {
  key: "premier" | "europa" | "champions" | "worldcup" | "ballondor";
  from: number;
  to: number;
  /** The road's background, as CSS. */
  bg: string;
  /** The rail's colour and the glow on this stretch. */
  accent: string;
}

export const STAR_PASS_THEMES: StarPassTheme[] = [
  { key: "premier", from: 1, to: 20, accent: "#22e8d6",
    bg: "radial-gradient(70% 40% at 80% 30%, rgba(233,0,123,.28), transparent 70%), radial-gradient(60% 40% at 15% 75%, rgba(0,255,224,.18), transparent 70%), linear-gradient(180deg, #2a0730, #1a0420)" },
  { key: "europa", from: 21, to: 40, accent: "#ff7a1a",
    bg: "repeating-linear-gradient(135deg, rgba(255,122,26,.07) 0 14px, transparent 14px 40px), radial-gradient(70% 45% at 50% 50%, rgba(255,110,20,.22), transparent 70%), linear-gradient(180deg, #160d08, #0b0807)" },
  { key: "champions", from: 41, to: 60, accent: "#cfe0ff",
    bg: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.9) 0 1px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(255,255,255,.8) 0 1px, transparent 2px), radial-gradient(circle at 45% 85%, rgba(255,255,255,.7) 0 1px, transparent 2px), radial-gradient(60% 45% at 50% 45%, rgba(120,150,255,.25), transparent 70%), linear-gradient(180deg, #061033, #030818)" },
  { key: "worldcup", from: 61, to: 80, accent: "#ffcc4d",
    bg: "radial-gradient(70% 45% at 50% 40%, rgba(255,204,77,.25), transparent 70%), repeating-linear-gradient(90deg, rgba(20,120,70,.18) 0 22px, transparent 22px 44px), linear-gradient(180deg, #06301c, #041a10)" },
  { key: "ballondor", from: 81, to: 100, accent: "#ffd76a",
    bg: "radial-gradient(circle at 25% 30%, rgba(255,230,150,.9) 0 1px, transparent 2px), radial-gradient(circle at 75% 70%, rgba(255,230,150,.8) 0 1.5px, transparent 2.5px), radial-gradient(70% 50% at 50% 40%, rgba(255,200,80,.35), transparent 70%), linear-gradient(180deg, #4a0610, #24030a)" },
];

export function themeFor(level: number): StarPassTheme {
  return STAR_PASS_THEMES.find(t => level >= t.from && level <= t.to) ?? STAR_PASS_THEMES[0];
}
