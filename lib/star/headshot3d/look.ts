/**
 * A PLAYER'S HEADSHOT FROM THE 3D MODEL — who he looks like (B15, 20 Oct 2026).
 *
 * Harry: "Player of the Month and similar cards … the drawn heads look
 * unprofessional — they should be headshots shot from our 3D model, not the
 * old 2D style." This file is the pure part (no three.js, tested in
 * tests/star/headshot3d.mts): which Style A head, build, skin and hair a man
 * gets, the kit he wears, and the key his picture is kept under.
 *
 *   Everyone else: playerLookFor (lib/star/playerLook.ts), seeded off his id,
 *     the "one man, one look" the 3D match men use. The same id is the same
 *     face on every card and every device.
 *   You: your own look (Settings → Your look: head, build, skin, hair).
 *
 * The camera, the lens and the studio light are FIXED (HEADSHOT_SHOT): the
 * same in every picture. A man is never resized to fit the frame (3D sizes
 * never change, Harry 12 Oct 2026); the camera is aimed at his head.
 */
import { playerLookFor } from "../playerLook";
import type { ToonBody, ToonHead, ToonPick } from "../style3d/toon/bodies";

/** Bump this when the camera, light, pose or expression change: every kept picture is then made again. */
export const HEADSHOT_VERSION = 1;

/** The picture, in pixels (square). The biggest card shows it at 112 px wide (224 on a 2× phone). */
export const HEADSHOT_PX = 256;

/**
 * THE ONE PORTRAIT SHOT. Distances in metres from the man's head bone, angles
 * in degrees. Head and shoulders: the crown just under the top edge, the
 * frame cut across the chest. Tuned by eye on the bench sheet
 * (/star-3d-bench-dev/headshots).
 */
export const HEADSHOT_SHOT = {
  /** The lens (vertical field of view). A longer lens flattens the face like a portrait lens does. */
  fov: 20,
  /** How far the camera stands from the head. */
  distance: 1.55,
  /** The camera's height above the head bone (a little above it: eye level). */
  camUp: 0.08,
  /** The point the camera looks at, above the head bone (puts the eyes in the top third). */
  aimUp: 0.04,
  /** The body turned this far from the camera (a quarter turn reads as posed, not a passport photo). */
  bodyTurn: 16,
  /** The face turned back toward the camera by this much: it points bodyTurn − headBack degrees off the lens (measured, maker.ts aimFace). */
  headBack: 12,
  /** A small, closed smile (0..1). */
  smile: 0.3,
} as const;

/**
 * THE STUDIO LIGHT, fixed for every picture: a warm key from the front left
 * and above, a cool sky fill, a soft rim from behind (drawn in his own
 * shader: toon/shader.ts TOON_RIM, no extra light). Straight to the picture
 * through three's ACES, so skin takes the B5 skin curve (TN_ACES_SCREEN).
 */
export const HEADSHOT_LIGHT = {
  sky: "#c7d6f0", ground: "#5a5048", hemi: 1.15,
  key: "#fff0dc", keyIntensity: 2.6, keyFrom: [-2.2, 3.2, 3.6] as [number, number, number],
  rim: "#fff4e6", rimStrength: 0.8, rimFrom: [0.45, 0.5, -1] as [number, number, number],
} as const;

export interface HeadshotKit { shirt: string; trim: string; shorts?: string }

/** Everything that changes the picture. Two men with the same look give the same pixels. */
export interface HeadshotLook {
  head: ToonHead;
  body: ToonBody;
  skin: string;
  hair: string;
  shirt: string;
  trim: string;
  shorts: string;
}

export interface HeadshotWho {
  /** His stable id (squad id; "you" for you). */
  id: string;
  /** True for your own player: your chosen look, not a seeded one. */
  you?: boolean;
  /** His squad position, when known (playerLookFor weights builds and haircuts by it). */
  position?: string;
  /** His real skin tone, when known. */
  skin?: string;
  kit: HeadshotKit;
}

const hex = (c: string) => c.trim().toLowerCase();

/** His look for the picture. `youPick` is your look (toonYou()) — passed in so this stays pure. */
export function headshotLookFor(w: HeadshotWho, youPick?: ToonPick): HeadshotLook {
  const kit = { shirt: hex(w.kit.shirt), trim: hex(w.kit.trim), shorts: hex(w.kit.shorts ?? w.kit.trim) };
  if (w.you && youPick) {
    return { head: youPick.head, body: youPick.body, skin: hex(youPick.skin), hair: hex(youPick.hair), ...kit };
  }
  const l = playerLookFor({ id: w.id, position: w.position, skin: w.skin });
  return { head: l.head, body: l.body, skin: hex(l.skin), hair: hex(l.hair), ...kit };
}

/** The key his picture is kept under (memory and this device's database): version, his id and his look. */
export function headshotKey(id: string, look: HeadshotLook): string {
  return [`hs${HEADSHOT_VERSION}`, id, look.head, look.body, look.skin, look.hair, look.shirt, look.trim, look.shorts].join("|");
}

/** The id a card uses for a man it only knows by name and club (the PotM rule: `${club}|${name}`). */
export function headshotIdFor(name: string, club: string, isYou?: boolean, squadId?: string): string {
  if (isYou) return "you";
  return squadId ?? `${club}|${name}`;
}

/**
 * What a card shows while it waits, and after (pure, so it can be tested):
 *   "picture" — the 3D headshot is ready;
 *   "drawn"   — anything else: still being made, not started, no WebGL, or the render failed.
 * A card is never blank: the drawn head is there until the picture lands.
 */
export type HeadshotState = "waiting" | "ready" | "failed";
export function headshotView(state: HeadshotState, url: string | null): "picture" | "drawn" {
  return state === "ready" && !!url ? "picture" : "drawn";
}
