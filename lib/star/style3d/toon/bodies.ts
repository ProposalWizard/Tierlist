/**
 * STYLE A PEOPLE — which body, skin and hair each person gets, and how a club
 * kit maps onto the textured kit. Pure (no three.js): tested in
 * tests/star/toonPeople.mts.
 *
 *   Your player: the head, build, skin and hair you chose (Settings → Your look;
 *     CareerState.player.head3d, body3d, skinTone, hairColour), set by the page
 *     with setToonYou().
 *   Everyone else: a pick seeded by their id, the same every time (a team-mate
 *     always has the same head, build, skin and hair).
 */
import { SKIN_TONES, HAIR_COLOURS } from "../../playerIdentity";

/**
 * BUILD: Slim / Strong / Tall (Settings → Your look → Body). One build works on
 * every head: it scales the whole person a little (TOON_BUILD_SCALE), so the
 * clips, the kit and the hands are the same on all three.
 */
export type ToonBody = "c1" | "c2" | "c3";
export const TOON_BODIES: readonly ToonBody[] = ["c1", "c2", "c3"];
export const TOON_BODY_LABEL: Record<ToonBody, string> = { c1: "Slim", c2: "Strong", c3: "Tall" };
/** [across, up, front-to-back] on the person's own frame. */
export const TOON_BUILD_SCALE: Record<ToonBody, [number, number, number]> = {
  c1: [0.95, 1, 0.95],
  c2: [1.07, 1, 1.06],
  c3: [1, 1.05, 1],
};

/**
 * HEADS (Harry, 9 Oct 2026: he picked "Stylised" on the heads sheet; "several
 * face and hair variants so a squad doesn't look cloned"). Each head is its own
 * generated body (face, haircut and beard modelled in), shared skeleton and
 * clips. Skin and hair colour are recoloured on top, so a head is a face and a
 * haircut, not a skin tone. Players wear the kit; the suit heads are for
 * managers, staff and presenters.
 */
export type ToonHead = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "m1" | "m2";
export const TOON_PLAYER_HEADS: readonly ToonHead[] = ["h1", "h2", "h3", "h4", "h5", "h6"];
export const TOON_SUIT_HEADS: readonly ToonHead[] = ["m1", "m2"];
export const TOON_HEADS: readonly ToonHead[] = [...TOON_PLAYER_HEADS, ...TOON_SUIT_HEADS];
export const TOON_HEAD_LABEL: Record<ToonHead, string> = {
  h1: "Curls", h2: "Quiff", h3: "Buzz & beard", h4: "Bun", h5: "Fringe", h6: "Crop & beard", m1: "Grey & stubble", m2: "Fade & beard",
};
export const TOON_FILES: Record<ToonHead, string> = {
  h1: "/star/people3d/toon-p1.glb",
  h2: "/star/people3d/toon-p2.glb",
  h3: "/star/people3d/toon-p3.glb",
  h4: "/star/people3d/toon-p4.glb",
  h5: "/star/people3d/toon-p5.glb",
  h6: "/star/people3d/toon-p6.glb",
  m1: "/star/people3d/toon-mgr.glb",
  m2: "/star/people3d/toon-mgr2.glb",
};
/** A small face picture of each head (Settings → Your look). */
export const toonHeadPicture = (h: ToonHead) => `/star/people3d/toon-${h}.webp`;

/** Every person is scaled to this (metres) before his build. */
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
export function resolveToonHead(v: unknown): ToonHead {
  return (TOON_PLAYER_HEADS as readonly unknown[]).includes(v) ? (v as ToonHead) : "h1";
}

/** Seeded head for anyone who isn't you: a player head, or a suit head for smart clothes. */
export function toonHeadFor(id: string, suit = false): ToonHead {
  const pool = suit ? TOON_SUIT_HEADS : TOON_PLAYER_HEADS;
  return pool[hashId(`${id}#head`) % pool.length];
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

export interface ToonPick { body: ToonBody; head: ToonHead; skin: string; hair: string }
export function toonPickFor(id: string, suit = false): ToonPick {
  return { body: toonBodyFor(id), head: toonHeadFor(id, suit), skin: toonSkinFor(id), hair: suit ? toonGreyHairFor(id) : toonHairFor(id) };
}

/** Managers and staff: older, so greyer (mostly grey, some dark). */
export function toonGreyHairFor(id: string): string {
  const r = hashId(`${id}#hair`) % 100;
  return r < 55 ? "#9a9590" : r < 80 ? "#5b5550" : HAIR_COLOURS[0].hex;
}

/** The spare-body bin a person belongs in (scenes that reuse bodies, engineView). */
export function toonKey(head: ToonHead, body: ToonBody): string { return `${head}|${body}`; }

// ── You ─────────────────────────────────────────────────────────────────

let you: ToonPick = { body: "c1", head: "h1", skin: SKIN_TONES[3].hex, hair: HAIR_COLOURS[1].hex };
/** The page sets this from the career (and Settings → Your look on a change). */
export function setToonYou(p: Partial<ToonPick>) { you = { ...you, ...p, body: resolveToonBody(p.body ?? you.body), head: resolveToonHead(p.head ?? you.head) }; }
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
