/**
 * SMALL MEN READ CLEANLY (Harry, 12 Oct 2026, on a Medium match crop: "I just don't
 * like how pixely the players look ... compared to [the Home player] it doesn't
 * seem the same"). A real-size man in the 3D match is ~35 px tall on a phone.
 * Sizes stay real (size3d.ts); these only change how such a small man is drawn:
 *
 * - `mediumDpr`: the drawing buffer's pixel ratio on Medium AND High (an iPhone screen is 3). Approved by Harry,
 *   12 Oct 2026: "that's how I WANTED THE CHARACTERS TO LOOK" (px 2.5, ink 2.2, flat cel).
 * - `outlinePx`: an ink line round every man, this many SCREEN pixels thick
 *   whatever his distance (the Home player's outline, kept at its on-screen
 *   thickness). 0: none (Medium had no outline before).
 * - `flatCel`: flat cel colour, 2–3 tones (no sky/grass gradient, no rim).
 * - `kitNoise`: the kit's fine weave and seam texture (mush at 35 px).
 * - `mapBias`: mip bias on the skin/hair picture (softer, flatter far away).
 *
 * Looks only; nothing reads the camera to size anything. The values are the pick from the
 * 12 Oct 2026 comparison sheets (scratchpad size1/14-*, 16-*): Harry chose 2.5 as the base, then the
 * thinner ink (2.2 px, Harry: the 2.8 one is not needed) with map bias 1.5.
 */
export const SMALL_MEN = {
  mediumDpr: 2.5,
  outlinePx: 2.2,
  flatCel: true,
  kitNoise: false,
  mapBias: 1.5,
};

/**
 * FAR, SMALL MEN (Harry, 12 Oct 2026: players look "blocky" when the camera is far, clear when close).
 * Cause: Medium draws the men with no anti-aliasing (no MSAA; the post pass leaves men's insides alone),
 * so on a man only 40–60 drawing pixels tall the 2.2 px ink and the hard light/shade step break into
 * stair-steps and specks that are a big share of him. Below `fromPx` drawing pixels tall the ink thins
 * (to `minK` of its width at `toPx`) and the light/shade step gets a soft edge one pixel wide
 * (people3d.ts outline, toon/shader.ts). At `fromPx` and above nothing changes. Drawing px = CSS px × 2.5.
 */
export const SMALL_INK = { fromPx: 70, toPx: 35, minK: 0.6 };
