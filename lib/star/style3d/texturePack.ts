/**
 * Settings → "Texture pack: Realism + cartoon | Light | Cartoon | Bright" (Harry,
 * 13 Oct 2026, career 3D match playtest: "the shadow does not help at all …
 * Can we make a different skin that we can just toggle between? … Let's make
 * one that's fully cartoon, like fully the same as our people. Let's make one
 * that just is less dark because the shadow is annoying … make the grass a
 * much lighter green. Make the ball a better ball with like clear black on it.")
 *
 * A player preference, per phone (like 3D quality). It dresses the career
 * 3D match's world: pitch, stadium, sky, light, ball. The men, their sizes and
 * the camera are the same in every pack.
 *
 *   real     Realism + cartoon: look H as it was (the default, unchanged).
 *   light    between the two (Harry, 13 Oct 2026: "inbetween the current [and]
 *            the bright one with dirt, a bit too bright"): grass half way to
 *            Bright's, a little more sky light, half the stand shade; the sun's
 *            shadows, the wear and the dirt all stay. Realism's ball.
 *   cartoon  the world in the same flat cel style as the Style A men: flat
 *            grass with simple mow stripes, flat-coloured stands, a plain
 *            sky, no cast shadows, no baked shade, no colour grade.
 *   bright   look H much lighter: light green grass, no cast shadows and no
 *            baked stand shadow, more sky light, a touch more exposure.
 *
 * Eight more (Harry, 14 Oct 2026: "I want that to go to like 8, 9, 10, 11, 12
 * texture packs", and "one between Cartoon and Light"), each data for the same
 * machinery (lib/star/style3d/real/packSpecs.ts): soft, broadcast, sunset,
 * night, rain, winter, retro, pastel. The lines below say what each looks like.
 *
 * Every pack uses the classic ball (white, clear black pentagons,
 * real/ball.ts) since 13 Oct 2026 (Harry: "u cant see the black spots on it").
 *
 * Not a three.js file: Settings imports it. `?pack=<id>` on
 * any page overrides it for that page only (stills, the perf harness).
 */
import { useSyncExternalStore } from "react";

export type TexturePack = "real" | "arcade" | "light" | "soft" | "cartoon" | "bright" | "broadcast" | "sunset" | "night" | "rain" | "winter" | "retro" | "pastel";
/** The packs that dress the 3D world. Arcade wears Realism's world (see worldPack). */
export type WorldPack = Exclude<TexturePack, "arcade">;

export const TEXTURE_PACK_KEY = "star-3d-texture-pack";
export const TEXTURE_PACK_DEFAULT: TexturePack = "real";
export const TEXTURE_PACK_NAMES: Record<TexturePack, string> = {
  real: "Realism + cartoon", arcade: "Arcade", light: "Light", soft: "Soft", cartoon: "Cartoon", bright: "Bright",
  broadcast: "Broadcast", sunset: "Sunset", night: "Floodlights", rain: "Rain", winter: "Winter", retro: "Retro 90s", pastel: "Pastel",
};
/** Every pack, in the order the Settings dropdown lists them (the key order of TEXTURE_PACK_NAMES). */
export const TEXTURE_PACKS = Object.keys(TEXTURE_PACK_NAMES) as TexturePack[];
const VALUES: readonly TexturePack[] = TEXTURE_PACKS;
/** One line under each pack's name in the dropdown (Harry, 14 Oct 2026). */
export const TEXTURE_PACK_LINES: Record<TexturePack, string> = {
  real: "Today's look: real grass, sun and shadows.",
  arcade: "Today's look, with arcade sounds.",
  light: "Half way to Bright. Dirt and shadows kept.",
  cartoon: "Flat colours, like the players.",
  bright: "Light green grass, no big shadows.",
  soft: "Between Cartoon and Light: smooth grass, soft shadows.",
  broadcast: "Deep green, strong stripes, sharp TV colours.",
  sunset: "Always golden hour: warm orange light, long shadows.",
  night: "Always a night game under four floodlights.",
  rain: "Grey sky, a soaked shiny pitch, mist in the stands.",
  winter: "Cold and clear: pale grass, frost at the edges.",
  retro: "A 90s TV match: faded yellowy colours and grain.",
  pastel: "The cartoon world in soft pastel colours.",
};
/**
 * The dropdown's picture of each pack: the same chance, the same camera, golden
 * hour, rendered from the real 3D match with ?pack=<id> (scripts/cam3d/stills.mjs),
 * cropped to 288x201 WebP. A new pack with no picture yet shows its name only.
 */
export const TEXTURE_PACK_PREVIEW: Partial<Record<TexturePack, string>> = Object.fromEntries(
  TEXTURE_PACKS.map((id) => [id, `/star/texture-packs/${id}.webp`]),
);

/**
 * ARCADE (Harry, 14 Oct 2026: "instead of a toggle for the noises/look make it
 * a texture pack again"). The default pitch look (Realism's world), plus the
 * "Arcade pop" action banners (components/star/ArcadeBanner.tsx; not shown since 27 Oct 2026, Mikey's pop-ups are the only ones, FACT-UI-017) and the Arcade
 * sound set (scripts/sfx/arcade.py). Every other pack keeps the old banners and
 * the old sounds, exactly as before. A pack that does not say gets "old".
 */
export type BannerStyle = "arcade" | "old";
export type SoundSet = "arcade" | "old";
const PACK_BANNERS: Partial<Record<TexturePack, BannerStyle>> = { arcade: "arcade" };
const PACK_SOUNDS: Partial<Record<TexturePack, SoundSet>> = { arcade: "arcade" };
export const bannerStyleOf = (p: TexturePack): BannerStyle => PACK_BANNERS[p] ?? "old";
export const soundSetOf = (p: TexturePack): SoundSet => PACK_SOUNDS[p] ?? "old";
/** The 3D world a pack wears: Arcade wears Realism's. */
export const worldPackOf = (p: TexturePack): WorldPack => (p === "arcade" ? "real" : p);
/** This phone's pack, as each part sees it. */
export const bannerStyle = (): BannerStyle => bannerStyleOf(texturePack());
export const soundSet = (): SoundSet => soundSetOf(texturePack());
export const worldPack = (): WorldPack => worldPackOf(texturePack());

export function parseTexturePack(v: string | null | undefined): TexturePack | null {
  return v && (VALUES as readonly string[]).includes(v) ? (v as TexturePack) : null;
}

function urlOverride(): TexturePack | null {
  try {
    if (typeof location === "undefined") return null;
    return parseTexturePack(new URLSearchParams(location.search).get("pack"));
  } catch { return null; }
}

let cached: TexturePack | null = null;
const listeners = new Set<() => void>();

export function texturePack(): TexturePack {
  const u = urlOverride();
  if (u) return u;
  if (cached === null) {
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(TEXTURE_PACK_KEY); } catch { v = null; }
    cached = parseTexturePack(v) ?? TEXTURE_PACK_DEFAULT;
  }
  return cached;
}

export function setTexturePack(v: TexturePack) {
  try { localStorage.setItem(TEXTURE_PACK_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === TEXTURE_PACK_KEY) { cached = null; listeners.forEach((f) => f()); }
  });
}
/** Called with no arguments whenever the pack changes (the 3D match rebuilds its world). */
export const onTexturePack = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useTexturePack = () => useSyncExternalStore(onTexturePack, texturePack, () => TEXTURE_PACK_DEFAULT);
