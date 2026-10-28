/**
 * STAR PASS ART (Mikey, 28 Oct 2026: "make proper art for them"; "tap it and
 * see a zoomed-in version that you can spin").
 *
 * Every built-in Star Pass reward has two pictures, both made in Blender by
 * tools/star-pass-art/ (read its README):
 *   - a STILL on its podium for the road (render_pass_rewards*.py → make_webp.py,
 *     sizes in starPassArtData.ts), so the road never runs live 3D (that lagged);
 *   - a 3D model to SPIN in the tap-to-preview (the same script with GLB=1),
 *     standing on its podium's own model.
 *
 * Pure: no React.
 */
import type { Live3D } from "./starPassRewards";
import { PASS_STILLS } from "./starPassArtData";

const ART = "/star/star-pass";

/** Card id → the Blender job that made its art. */
export const JOB_OF: Record<string, string> = {
  // the rewards that were a plain box until 28 Oct 2026
  "acc-boots-blackout": "boots-blackout", "acc-boots-volt": "boots-volt", "acc-boots-gold": "boots-gold",
  "acc-boots-signature": "boots-signature", "acc-tape-white": "tape-white", "acc-headband-white": "headband-white",
  "acc-headband-ninja": "headband-ninja", "acc-snood-black": "snood-black", "acc-sleeves-black": "sleeves-black",
  "acc-armband-rainbow": "armband-rainbow", "acc-armband-classic": "armband-classic", "acc-gloves-gold": "gloves-gold",
  "acc-celeb-hands-up": "celeb-hands-up", "acc-celeb-arms-out": "celeb-arms-out", "acc-celeb-knee-slide": "celeb-knee-slide",
  "acc-celeb-corner-flag": "celeb-corner-flag", "acc-celeb-backflip": "celeb-backflip", "acc-celeb-own-name": "celeb-own-name",
  "acc-celeb-statue": "celeb-statue",
  "runup-stroll": "stroll", "runup-two_step": "two_step", "runup-sprint": "sprint", "runup-arc": "arc", "runup-golden": "golden",
  "runup-fk_power_stance": "fk_power_stance", "runup-fk_stance_sprint": "fk_stance_sprint", "runup-fk_calm_curl": "fk_calm_curl",
  "runup-fk_stutter_curl": "fk_stutter_curl", "runup-fk_angled_whip": "fk_angled_whip", "runup-fk_long_diagonal": "fk_long_diagonal",
  "runup-fk_leaf": "fk_leaf",
  // the two live-3D cards get a still for the road
  "pass-star-ball": "star-ball", "pass-gold-aviators": "gold-aviators",
  // the collectibles of 25 Oct 2026: a 3D model to spin
  "pass-scuffed-ball": "scuffed-ball", "pass-used-hatchback": "hatchback", "pass-steel-watch": "steel-watch",
  "pass-red-sports-car": "sports-car", "pass-penthouse": "penthouse", "pass-iced-chain": "iced-chain",
  "pass-european-ball": "european-ball", "pass-gold-watch": "gold-watch", "pass-supercar": "supercar",
  "pass-trophy-wall": "trophy-wall", "pass-mansion": "mansion", "pass-night-suit": "night-suit",
  "pass-golden-ball": "golden-ball", "pass-private-jet": "private-jet", "pass-hof-plaque": "hof-plaque",
  "pass-diamond-watch": "diamond-watch", "pass-golden-set": "golden-set",
};

/** Job → its podium (theme-tier, or null when the stand is in the model) and
 *  the Blender camera it was framed with (look height, distance). */
const NEW_M: [number, number] = [1.9, 15.0];
const NEW_G: [number, number] = [2.15, 16.5];
const SPIN: Record<string, [string | null, number, number]> = {
  "boots-blackout": ["premier-great", ...NEW_G], "boots-volt": ["europa-great", ...NEW_G],
  "boots-gold": ["champions-great", ...NEW_G], "boots-signature": ["worldcup-medium", ...NEW_M],
  "tape-white": ["premier-medium", ...NEW_M], "headband-white": ["premier-medium", ...NEW_M],
  "headband-ninja": ["champions-medium", ...NEW_M], "snood-black": ["europa-medium", ...NEW_M],
  "sleeves-black": ["europa-medium", ...NEW_M], "armband-rainbow": ["worldcup-medium", ...NEW_M],
  "armband-classic": ["worldcup-medium", ...NEW_M], "gloves-gold": ["ballondor-medium", ...NEW_M],
  "celeb-hands-up": ["premier-medium", ...NEW_M], "celeb-arms-out": ["premier-medium", ...NEW_M],
  "celeb-knee-slide": ["europa-medium", ...NEW_M], "celeb-corner-flag": ["champions-medium", ...NEW_M],
  "celeb-backflip": ["worldcup-medium", ...NEW_M], "celeb-own-name": ["worldcup-medium", ...NEW_M],
  "celeb-statue": ["ballondor-medium", ...NEW_M],
  stroll: ["premier-medium", ...NEW_M], two_step: ["premier-medium", ...NEW_M], sprint: ["europa-medium", ...NEW_M],
  arc: ["champions-medium", ...NEW_M], golden: ["ballondor-medium", ...NEW_M],
  fk_power_stance: ["premier-medium", ...NEW_M], fk_stance_sprint: ["europa-medium", ...NEW_M],
  fk_calm_curl: ["europa-medium", ...NEW_M], fk_stutter_curl: ["champions-medium", ...NEW_M],
  fk_angled_whip: ["champions-medium", ...NEW_M], fk_long_diagonal: ["worldcup-medium", ...NEW_M],
  fk_leaf: ["ballondor-medium", ...NEW_M],
  "star-ball": ["europa-medium", ...NEW_M], "gold-aviators": ["champions-medium", ...NEW_M],
  "scuffed-ball": ["premier-medium", 1.55, 13.5], "european-ball": ["champions-medium", 1.55, 13.5],
  "golden-ball": ["ballondor-medium", 1.55, 13.5], hatchback: ["premier-great", 1.95, 16.5],
  "sports-car": ["europa-great", 1.85, 16.5], supercar: ["worldcup-great", 1.85, 16.5],
  "steel-watch": ["europa-medium", 2.1, 15.0], "gold-watch": ["worldcup-medium", 2.1, 15.0],
  "diamond-watch": ["ballondor-medium", 2.1, 15.0], "iced-chain": ["champions-medium", 2.8, 16.5],
  penthouse: ["champions-great", 3.2, 19.5], "trophy-wall": ["worldcup-medium", 2.3, 16.0],
  mansion: ["worldcup-great", 2.15, 17.5], "night-suit": ["ballondor-medium", 2.6, 17.0],
  "private-jet": ["ballondor-great", 2.6, 18.0], "hof-plaque": ["ballondor-medium", 1.85, 15.0],
  "golden-set": [null, 2.7, 20.0],
};

/** The 3D you can spin in the preview, at a canvas size. */
export function spinFor(cardId: string, w = 340, h = 380): Live3D | undefined {
  const job = JOB_OF[cardId];
  const s = job ? SPIN[job] : undefined;
  if (!s) return undefined;
  return { podium: s[0] ? `${ART}/3d/podium-${s[0]}.glb` : "", item: `${ART}/3d/reward-${job}.glb`, look: s[1], dist: s[2], tilt: 70, w, h };
}

/** The still on its podium for the road, when it has been made. */
export function stillFor(cardId: string): { scene: string; sceneFit: number; sceneAspect: number } | undefined {
  const job = JOB_OF[cardId];
  const s = job ? PASS_STILLS[job] : undefined;
  return s ? { scene: `${ART}/reward-${job}.webp`, sceneFit: s[0], sceneAspect: s[1] } : undefined;
}
