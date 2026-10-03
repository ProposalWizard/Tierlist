/**
 * Who the player IS, as opposed to how good he is.
 *
 * A small leaf module: the things chosen once on the profile-setup screen and
 * then read all over the game — what he's called, what colour he is, which
 * foot he kicks with. Deliberately imports nothing but the shared types, so
 * anything at all can read it without dragging a dependency in.
 *
 * Added 18 September 2026 from direct product feedback on the very first
 * screen of the game ("you should have a nickname", "it should definitely
 * select your skin colour... 5 to 10 options", "you should be able to choose
 * a preferred foot, which is permanent").
 */
import type { StarPlayer } from "./types";

// ── Skin tone ───────────────────────────────────────────────────────────────

/**
 * The eight tones a player can be.
 *
 * `"light"` and `"dark"` are REAL entries in this list, not legacy aliases
 * kept alive out of politeness — they carry exactly the two hex values the
 * old two-button picker shipped (#d4a373 and #4a2b18). That is the whole
 * migration story: a save written before this existed already names one of
 * the eight, resolves to the identical colour it always had, and nothing has
 * to be rewritten on load. The other six are new room either side of them.
 *
 * Ordered light → dark, which is the order they're laid out in the picker.
 */
export const SKIN_TONES = [
  { id: "porcelain", label: "Porcelain", hex: "#f7dcc4" },
  { id: "fair", label: "Fair", hex: "#eec095" },
  { id: "light", label: "Light", hex: "#d4a373" },
  { id: "tan", label: "Tan", hex: "#c68642" },
  { id: "olive", label: "Olive", hex: "#a9714b" },
  { id: "brown", label: "Brown", hex: "#8d5524" },
  { id: "deep", label: "Deep", hex: "#6b3d1f" },
  { id: "dark", label: "Dark", hex: "#4a2b18" },
] as const;

export type SkinTone = (typeof SKIN_TONES)[number]["id"];

/** What a player with nothing on file is. The middle of the range, not an end of it. */
export const DEFAULT_SKIN_TONE: SkinTone = "tan";

/**
 * Turn whatever is actually stored into a tone that exists.
 *
 * Every read should go through this rather than trusting the field. A save is
 * a JSON blob on someone's phone: it can hold a value from a build that has
 * since been reverted, a hand-edited string, or nothing at all. None of those
 * should render a player with no head — they should render a plausible one.
 */
export function resolveSkinTone(value: unknown): SkinTone {
  if (typeof value !== "string") return DEFAULT_SKIN_TONE;
  const hit = SKIN_TONES.find((t) => t.id === value);
  return hit ? hit.id : DEFAULT_SKIN_TONE;
}

/** The colour to actually draw, for any stored value at all. */
export function skinToneHex(value: unknown): string {
  const id = resolveSkinTone(value);
  return SKIN_TONES.find((t) => t.id === id)!.hex;
}

// ── What he's called ────────────────────────────────────────────────────────

/**
 * The name to put in front of a person.
 *
 * A nickname, when he has one, is not a decoration — it is what he is
 * actually called, so commentary, the media feed and the team sheet should
 * all prefer it over the name on his passport. Absent (which is the common
 * case) this is exactly the `firstName lastName` every call site builds by
 * hand today, so adopting it can never change an existing career's output.
 */
export function displayName(player: Pick<StarPlayer, "firstName" | "lastName" | "nickname">): string {
  const nick = player.nickname?.trim();
  if (nick) return nick;
  return `${player.firstName} ${player.lastName}`.trim();
}

/**
 * The short form — a surname on a shirt, a commentary shout, a table row.
 *
 * Same rule: a nickname wins, because a nickname IS the short form. Falls
 * back to the surname, which is what every one of those call sites uses now.
 */
export function shortDisplayName(player: Pick<StarPlayer, "firstName" | "lastName" | "nickname">): string {
  const nick = player.nickname?.trim();
  if (nick) return nick;
  return player.lastName;
}

// ── Hair (the 3D avatar's) ──────────────────────────────────────────────────

/**
 * The hair his 3D body wears (the live 3D signing scene). Picked on the
 * profile screen; absent on every older save, which reads as short and dark
 * brown — what the scene always drew before this existed.
 */
export const HAIR_STYLES = [
  { id: "short", label: "Short" },
  { id: "long", label: "Long" },
  { id: "buzz", label: "Buzz" },
  { id: "none", label: "Shaved" },
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number]["id"];
export const DEFAULT_HAIR_STYLE: HairStyle = "short";

export const HAIR_COLOURS = [
  { id: "black", label: "Black", hex: "#17110d" },
  { id: "brown", label: "Brown", hex: "#3d2616" },
  { id: "fair", label: "Fair", hex: "#b88a4a" },
  { id: "blond", label: "Blond", hex: "#d7b26a" },
] as const;
export type HairColour = (typeof HAIR_COLOURS)[number]["id"];
export const DEFAULT_HAIR_COLOUR: HairColour = "brown";

export function resolveHairStyle(value: unknown): HairStyle {
  return HAIR_STYLES.some((h) => h.id === value) ? (value as HairStyle) : DEFAULT_HAIR_STYLE;
}

export function hairColourHex(value: unknown): string {
  return (HAIR_COLOURS.find((h) => h.id === value) ?? HAIR_COLOURS.find((h) => h.id === DEFAULT_HAIR_COLOUR)!).hex;
}

// ── Which foot ──────────────────────────────────────────────────────────────

export type PreferredFoot = "left" | "right";

/**
 * Chosen at creation and never again — there is deliberately no UI anywhere
 * else in the game that changes it. Absent means a career from before the
 * choice existed; right-footed is the honest default there (roughly three in
 * four real players), not a guess dressed up as data.
 */
export const DEFAULT_FOOT: PreferredFoot = "right";

export function resolveFoot(value: unknown): PreferredFoot {
  return value === "left" ? "left" : DEFAULT_FOOT;
}

// ── The number on his back ──────────────────────────────────────────────────

export const MIN_SQUAD_NUMBER = 1;
export const MAX_SQUAD_NUMBER = 99;

/**
 * The number he WANTS. Not necessarily the one he has.
 *
 * `career.squadNumber` (recognition.ts's assignSquadNumber) stays the number
 * the club actually gave him. This is the one he'd ask for, changeable at any
 * time — see the note on StarPlayer.preferredNumber.
 */
export function clampSquadNumber(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 9;
  return Math.min(MAX_SQUAD_NUMBER, Math.max(MIN_SQUAD_NUMBER, n));
}
