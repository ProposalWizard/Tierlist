/**
 * The 3D signing prototype's script and pictures (/star-3d-area-dev/signing).
 * Pictures: tools/blender-signing/signing.py, one set per skin tone, in
 * public/star/signing3d/<beat>-<skin>.webp.
 */

export type SigningSkin = "light" | "medium" | "dark";
export type SigningShot = "talk" | "reply" | "contract" | "signing" | "signed";

export const SIGNING_SKINS: { id: SigningSkin; label: string; dot: string }[] = [
  { id: "light", label: "Light", dot: "#e8b48f" },
  { id: "medium", label: "Medium", dot: "#a8693f" },
  { id: "dark", label: "Dark", dot: "#5a341c" },
];

/** A few lines across the desk. "talk" = over your shoulder at him; "reply"
 *  = over his shoulder at you. */
export const SIGNING_LINES: { who: "boss" | "you"; shot: "talk" | "reply"; text: string }[] = [
  { who: "boss", shot: "talk", text: "Sit down, son. I watched every kick of that trial." },
  { who: "you", shot: "reply", text: "Thanks, boss. I want to play." },
  { who: "boss", shot: "talk", text: "You'll get your chance. Two seasons, the number 39 shirt." },
  { who: "you", shot: "reply", text: "Where do I sign?" },
  { who: "boss", shot: "talk", text: "Read it first. Then it's yours." },
];

export function signingShot(shot: SigningShot, skin: SigningSkin): string {
  return `/star/signing3d/${shot}-${skin}.webp`;
}
