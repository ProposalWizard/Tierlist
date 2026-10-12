/**
 * ONE MAN, ONE LOOK (Harry, 12 Oct 2026: players must not all look the same).
 * Pure and seeded off the player's id, so a man looks the same every match and
 * on every screen. Kept free of three.js so the 2D re-bake can use it later.
 *
 * Built only from what Style A already has (the Home player look): six heads
 * (h1..h6: face and haircut modelled in), three builds (c1 Slim, c2 Strong,
 * c3 Tall), a small height range on top, the game's skin tones and hair
 * colours, and a boot colour. No new model, no new material: the body's own
 * uniforms carry skin, hair and boots, so 22 different men cost what 22 alike did.
 *
 * By position (when known):
 *   GK, CB  — more often Tall, a touch taller
 *   CDM     — more often Strong (stockier)
 *   wingers — more often Slim, a touch shorter, flair hair more often
 *   strikers, attacking mids — mixed, flair hair more often
 * "Flair" = the Bun (top-knot, h4) or the Quiff (h2), and bleached / blond hair.
 * Long hair, mohawks and braids need new heads (not built yet).
 *
 * Skin: a real player's own tone when the caller has it (from his face photo
 * or nation), else seeded.
 */
import { hashId, type ToonHead, type ToonBody } from "./style3d/toon/bodies";
import { SKIN_TONES, HAIR_COLOURS } from "./playerIdentity";

export type PlayerRole = "GK" | "CB" | "FB" | "CDM" | "CM" | "CAM" | "W" | "ST";

export interface PlayerLookInput {
  /** Stable id: the same id is the same man everywhere. */
  id: string;
  /** His position, if known (a squad position like "LW" or a role). */
  position?: string;
  /** His real skin tone (hex), if known (face photo or nation). */
  skin?: string;
}

export interface PlayerLook {
  head: ToonHead;
  body: ToonBody;
  /** Extra height on top of the build (1 = as built). */
  height: number;
  skin: string;
  hair: string;
  boots: string;
  /** He got a flair haircut or colour. */
  flair: boolean;
}

/** A squad position ("LW", "RB", "GK" …) as one of the eight roles. */
export function roleOf(position?: string): PlayerRole | undefined {
  const p = (position ?? "").toUpperCase();
  if (!p) return undefined;
  if (p === "GK" || p === "KEEPER") return "GK";
  if (p === "CB" || p === "LCB" || p === "RCB" || p === "SW") return "CB";
  if (/^(L|R)(B|WB)$/.test(p) || p === "WB" || p === "FB") return "FB";
  if (p === "CDM" || p === "DM" || p === "LDM" || p === "RDM") return "CDM";
  if (p === "CM" || p === "LCM" || p === "RCM") return "CM";
  if (p === "CAM" || p === "AM") return "CAM";
  if (/^(L|R)(W|M)$/.test(p) || p === "W") return "W";
  if (p === "ST" || p === "CF" || p === "LS" || p === "RS" || p === "LF" || p === "RF") return "ST";
  return undefined;
}

/** Build weights [Slim, Strong, Tall], height range and flair chance (0..1) per role. */
const ROLE: Record<PlayerRole | "any", { build: [number, number, number]; h: [number, number]; flair: number }> = {
  GK: { build: [1, 2, 6], h: [1.02, 1.06], flair: 0.1 },
  CB: { build: [1, 3, 5], h: [1.01, 1.05], flair: 0.1 },
  FB: { build: [4, 2, 1], h: [0.97, 1.01], flair: 0.25 },
  CDM: { build: [1, 6, 2], h: [0.99, 1.03], flair: 0.15 },
  CM: { build: [3, 3, 2], h: [0.97, 1.02], flair: 0.25 },
  CAM: { build: [4, 2, 1], h: [0.96, 1.0], flair: 0.45 },
  W: { build: [6, 1, 1], h: [0.95, 0.99], flair: 0.5 },
  ST: { build: [2, 3, 3], h: [0.97, 1.04], flair: 0.4 },
  any: { build: [3, 3, 2], h: [0.97, 1.03], flair: 0.25 },
};
const BODIES: ToonBody[] = ["c1", "c2", "c3"];
const PLAIN_HEADS: ToonHead[] = ["h1", "h3", "h5", "h6"];
const FLAIR_HEADS: ToonHead[] = ["h2", "h4"];
/** Boots: mostly black, then the bright colours real players wear (no brands). */
const BOOTS = ["#141416", "#141416", "#141416", "#f4f4f4", "#e11d48", "#f97316", "#facc15", "#22d3ee", "#a3e635", "#1d4ed8", "#d946ef", "#f5d0a9"];

const u01 = (id: string, salt: string) => (hashId(`${id}#${salt}`) % 10007) / 10007;
function weighted<T>(items: T[], w: number[], r: number): T {
  const sum = w.reduce((a, b) => a + b, 0);
  let x = r * sum;
  for (let i = 0; i < items.length; i++) { x -= w[i]; if (x < 0) return items[i]; }
  return items[items.length - 1];
}

/** His look, the same every time for the same id (and position). */
export function playerLookFor(p: PlayerLookInput): PlayerLook {
  const role = roleOf(p.position);
  const R = ROLE[role ?? "any"];
  const body = weighted(BODIES, R.build, u01(p.id, "build"));
  const height = R.h[0] + (R.h[1] - R.h[0]) * u01(p.id, "height");
  const flair = u01(p.id, "flair") < R.flair;
  const head = flair ? FLAIR_HEADS[hashId(`${p.id}#fhead`) % FLAIR_HEADS.length] : PLAIN_HEADS[hashId(`${p.id}#head`) % PLAIN_HEADS.length];
  const skin = p.skin ?? SKIN_TONES[hashId(`${p.id}#skin`) % SKIN_TONES.length].hex;
  const hr = u01(p.id, "hair");
  const hairId = flair
    ? (hr < 0.45 ? "blond" : hr < 0.65 ? "fair" : hr < 0.85 ? "black" : "brown") // bleached / blond more often
    : (hr < 0.5 ? "black" : hr < 0.8 ? "brown" : hr < 0.92 ? "fair" : "blond");
  const hair = (HAIR_COLOURS.find((h) => h.id === hairId) ?? HAIR_COLOURS[0]).hex;
  const boots = BOOTS[hashId(`${p.id}#boots`) % BOOTS.length];
  return { head, body, height, skin, hair, boots, flair };
}
