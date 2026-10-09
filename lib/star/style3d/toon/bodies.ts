/**
 * STYLE A PEOPLE — which body, skin and hair each person gets, and how a club
 * kit maps onto the textured kit. Pure (no three.js): tested in
 * tests/star/toonPeople.mts.
 *
 *   Your player: the body, skin and hair you chose (Settings → Your look;
 *     CareerState.player.body3d, skinTone, hairColour), set by the page with
 *     setToonYou().
 *   Everyone else: a pick seeded by their id, the same every time (a team-mate
 *     always has the same body, skin and hair).
 */
import { SKIN_TONES, HAIR_COLOURS } from "../../playerIdentity";

export type ToonBody = "c1" | "c2" | "c3";
export const TOON_BODIES: readonly ToonBody[] = ["c1", "c2", "c3"];
export const TOON_BODY_LABEL: Record<ToonBody, string> = { c1: "Slim", c2: "Strong", c3: "Tall" };

export const TOON_FILES: Record<ToonBody, string> = {
  c1: "/star/people3d/toon-c1.glb",
  c2: "/star/people3d/toon-c2.glb",
  c3: "/star/people3d/toon-c3.glb",
};

/** Every body is scaled to this (metres). */
export const TOON_HEIGHT = 1.83;

/** A stable 32-bit hash of an id (FNV-1a). */
export function hashId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function resolveToonBody(v: unknown): ToonBody {
  return (TOON_BODIES as readonly unknown[]).includes(v) ? (v as ToonBody) : "c1";
}

/** Seeded body for anyone who isn't you. */
export function toonBodyFor(id: string): ToonBody {
  return TOON_BODIES[hashId(`${id}#body`) % TOON_BODIES.length];
}

/** Seeded skin (one of the game's own eight tones). */
export function toonSkinFor(id: string): string {
  return SKIN_TONES[hashId(`${id}#skin`) % SKIN_TONES.length].hex;
}

/** Seeded hair: mostly dark, sometimes brown, fair or blond (as a squad is). */
export function toonHairFor(id: string): string {
  const r = hashId(`${id}#hair`) % 100;
  const id_ = r < 50 ? "black" : r < 80 ? "brown" : r < 92 ? "fair" : "blond";
  return HAIR_COLOURS.find((h) => h.id === id_)!.hex;
}

export interface ToonPick { body: ToonBody; skin: string; hair: string }
export function toonPickFor(id: string): ToonPick {
  return { body: toonBodyFor(id), skin: toonSkinFor(id), hair: toonHairFor(id) };
}

// ── You ─────────────────────────────────────────────────────────────────

let you: ToonPick = { body: "c1", skin: SKIN_TONES[3].hex, hair: HAIR_COLOURS[1].hex };
/** The page sets this from the career (and Settings → Your look on a change). */
export function setToonYou(p: Partial<ToonPick>) { you = { ...you, ...p, body: resolveToonBody(p.body ?? you.body) }; }
export function toonYou(): ToonPick { return you; }

// ── Kits ────────────────────────────────────────────────────────────────

export interface ToonKitColours { shirt: string; shorts: string; socks: string; trim: string }

/**
 * A club kit (shirt + trim, optional shorts/socks) → the textured kit's parts.
 * Shorts take their own colour, else the trim (the game's convention); socks
 * take the shirt; the trim is the collar, cuffs, shorts hem, sock tops and the
 * shirt number. Kit clashes are settled before this (kits.ts kitsFor), so the
 * colours given are already the ones that don't clash.
 */
export function toonKitColours(kit: { shirt: string; trim: string; shorts?: string; socks?: string }): ToonKitColours {
  return { shirt: kit.shirt, shorts: kit.shorts ?? kit.trim, socks: kit.socks ?? kit.shirt, trim: kit.trim };
}

/** Managers, staff and presenters: smart clothes, never a kit. */
export const TOON_SUIT = { coat: "#1f2533", trousers: "#232733", shirt: "#eef0f2", tie: "#7a1d2b", shoes: "#141416" } as const;

/** Does this person wear the suit? (a manager; a cut-scene person whose outfit is not a kit). */
export function toonWearsSuit(role: string, outfit?: string): boolean {
  if (role === "manager") return true;
  if (outfit && !/^(kit|keeper)/.test(outfit)) return true;
  return false;
}
