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
  /** A whole picture of the reward standing on its podium (may be animated),
   *  drawn in place of the plain podium + box. */
  scene?: string;
  /** The podium's width as a share of the scene picture's width, so the
   *  podium comes out the same size as the plain ones (make_webp.py prints it). */
  sceneFit?: number;
}

/** The rewards, by level. Levels 5, 10 and 15 are DESIGN TESTS only (Mikey,
 *  1 Oct 2026): pictures to judge the look, nothing is given in the game.
 *  The car is a borrowed model shaped like a Ferrari 458 and must be swapped
 *  for an unbranded one before any of this is used for real. */
export const STAR_PASS_REWARDS: Partial<Record<number, StarPassReward>> = {
  5: { name: "Hop penalty run-up", scene: "/star/star-pass/reward-penalty.webp", sceneFit: 0.598 },
  10: { name: "Red sports car", scene: "/star/star-pass/reward-car.webp", sceneFit: 0.882 },
  15: { name: "Star ball", scene: "/star/star-pass/reward-ball.webp", sceneFit: 0.889 },
};

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
