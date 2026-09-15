/**
 * FAKE FACES — for every player who has no real one.
 *
 * Requested directly: "fake faces for all players who have no faces
 * (fake/generated players as well as the user if they dont have an
 * inputted photo)... I dont wanna see ANY circle faces anymore." Seven
 * AI-generated headshots, composed the same way a real SoFIFA portrait is
 * (head/neck/shirt collar on a transparent background), uploaded straight
 * into `public/`.
 *
 * `fakeFaceFor(key)` is a deterministic pick, not a live dice roll — "made"
 * once, at the point a player object is actually constructed (a generated
 * squad member, a real DB row with no scraped photo yet), so the SAME
 * player shows the SAME fake face on every future render/session rather
 * than reshuffling underneath you. It reads as "randomly assigned when the
 * player was made" because different players hash to different faces, not
 * because any single player's face changes.
 */

export const FAKE_FACES: string[] = [
  "/ChatGPT Image Sep 15, 2026, 11_23_12 PM.png",
  "/ChatGPT Image Sep 15, 2026, 11_23_25 PM.png",
  "/ChatGPT Image Sep 15, 2026, 11_23_33 PM.png",
  "/ChatGPT Image Sep 15, 2026, 11_23_40 PM.png",
  "/ChatGPT Image Sep 15, 2026, 11_23_47 PM.png",
  "/ChatGPT Image Sep 15, 2026, 11_24_29 PM.png",
  "/ChatGPT Image Sep 15, 2026, 11_24_37 PM.png",
];

/** What "no photo uploaded, no fake face picked either" defaults to. */
export const DEFAULT_FAKE_FACE = FAKE_FACES[0];

/** Same djb2-xor hash clubNameSeed (squadData.ts) already uses, for a
 *  stable numeric spread from any id/name string. */
function hashKey(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = (((h << 5) + h) ^ key.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** A stable, pseudo-random fake face for a given player id — the same id
 *  always lands on the same face. */
export function fakeFaceFor(key: string): string {
  return FAKE_FACES[hashKey(key) % FAKE_FACES.length];
}
