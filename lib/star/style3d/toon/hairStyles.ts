/**
 * TOON HAIR — the modelled hairstyles a Style A person can wear on top of a close-cut head
 * (Harry, 20 Nov 2026: "still more hairstyles, dreads are common in football, try and model new
 * head shapes and hair"). Pure (no three.js): the list, which hair texture each suits (RUL-3D-010:
 * a style follows the person's heritage, never picked apart from it), and which head file each fits.
 * The meshes: tools/hair3d/build_hair.py (Blender) → public/star/people3d/hair/. Worn with
 * lib/star/style3d/toon/hair.ts. Tested in tests/star/peoplePresets.mts.
 */
import type { ToonHead } from "./bodies";

export type HairTexture = "straight" | "wavy" | "curly" | "coily";

export type ToonHair =
  | "locsShort" | "locsLong" | "locsBun" | "afro" | "highTop" | "twists" | "braids" | "curlyTop"
  | "crew" | "slickBack" | "ponytail" | "manBun" | "mullet" | "thinning" | "receding";

export interface ToonHairInfo {
  label: string;
  /** The hair textures this style is worn in. */
  textures: readonly HairTexture[];
  /** The head's own modelled hair under it: 0 kept (it reads as the fade or the short sides), 1 painted as skin (the mesh is all the hair there is). */
  scalp: number;
  /** How much of the painted sheen band it takes (coily hair is matt). */
  sheen: number;
  /** The game's hair-style word (playerIdentity.ts HAIR_STYLES). */
  word: "short" | "long" | "buzz";
  /** Triangles (on the Buzz & beard head; tools/hair3d/build_hair.py prints them). */
  tris: number;
}

const ALL: readonly HairTexture[] = ["straight", "wavy", "curly", "coily"];
export const TOON_HAIR_INFO: Record<ToonHair, ToonHairInfo> = {
  locsShort: { label: "Short locs", textures: ["coily"], scalp: 0, sheen: 0.25, word: "short", tris: 2698 },
  locsLong: { label: "Shoulder locs", textures: ["coily"], scalp: 0, sheen: 0.25, word: "long", tris: 3628 },
  locsBun: { label: "Locs tied up", textures: ["coily"], scalp: 0, sheen: 0.25, word: "long", tris: 3768 },
  afro: { label: "Short afro", textures: ["coily"], scalp: 0, sheen: 0.15, word: "short", tris: 1740 },
  highTop: { label: "High-top", textures: ["coily"], scalp: 0, sheen: 0.15, word: "short", tris: 1092 },
  twists: { label: "Twists", textures: ["coily"], scalp: 0, sheen: 0.25, word: "short", tris: 2024 },
  braids: { label: "Braids", textures: ["coily"], scalp: 0, sheen: 0.3, word: "long", tris: 3205 },
  curlyTop: { label: "Curly top", textures: ["curly", "coily"], scalp: 0, sheen: 0.35, word: "short", tris: 2688 },
  crew: { label: "Crew cut", textures: ["straight", "wavy", "curly"], scalp: 0, sheen: 0.8, word: "short", tris: 540 },
  slickBack: { label: "Slick back", textures: ["straight", "wavy"], scalp: 0, sheen: 1, word: "short", tris: 1080 },
  ponytail: { label: "Tied back", textures: ["straight", "wavy"], scalp: 0, sheen: 1, word: "long", tris: 930 },
  manBun: { label: "Man bun", textures: ["straight", "wavy"], scalp: 0, sheen: 1, word: "long", tris: 1124 },
  mullet: { label: "Mullet", textures: ["straight", "wavy"], scalp: 0, sheen: 0.8, word: "long", tris: 1014 },
  thinning: { label: "Thinning", textures: ALL, scalp: 1, sheen: 0.6, word: "short", tris: 408 },
  receding: { label: "Receding", textures: ALL, scalp: 1, sheen: 0.7, word: "short", tris: 660 },
};
export const TOON_HAIRS = Object.keys(TOON_HAIR_INFO) as ToonHair[];
/** The afro-textured styles (worn only by people whose hair is coily: tests/star/peoplePresets.mts). */
export const COILY_HAIRS: readonly ToonHair[] = TOON_HAIRS.filter((h) => TOON_HAIR_INFO[h].textures.every((t) => t === "coily"));

/**
 * Which hair set a head wears: the meshes are built on one head's scalp ("h3" Buzz & beard,
 * "m2" Fade & beard); a re-shaped head keeps that skull, so it wears the same set. Heads with their
 * own modelled haircut (Curls, Quiff, Bun …) wear none.
 */
export const TOON_HAIR_BASE: Partial<Record<ToonHead, "h3" | "m2">> = { h3: "h3", h7: "h3", h8: "h3", h9: "h3", m2: "m2", m3: "m2" };
/** A re-shaped head whose skull sits higher than its base's (metres up): the hair moves with it. */
export const TOON_HAIR_LIFT: Partial<Record<ToonHead, number>> = { h8: 0.022 };
export const toonHairFits = (head: ToonHead) => !!TOON_HAIR_BASE[head];
export const toonHairFile = (hair: ToonHair, head: ToonHead) => `/star/people3d/hair/hair-${TOON_HAIR_BASE[head] ?? "h3"}-${hair}.glb`;
