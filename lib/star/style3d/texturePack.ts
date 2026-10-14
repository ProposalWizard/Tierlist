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
 * Every pack uses the classic ball (white, clear black pentagons,
 * real/ball.ts) since 13 Oct 2026 (Harry: "u cant see the black spots on it").
 *
 * Not a three.js file: Settings imports it. `?pack=real|light|cartoon|bright` on
 * any page overrides it for that page only (stills, the perf harness).
 */
import { useSyncExternalStore } from "react";

export type TexturePack = "real" | "light" | "cartoon" | "bright";

export const TEXTURE_PACK_KEY = "star-3d-texture-pack";
export const TEXTURE_PACK_DEFAULT: TexturePack = "real";
const VALUES: readonly TexturePack[] = ["real", "light", "cartoon", "bright"];
export const TEXTURE_PACK_NAMES: Record<TexturePack, string> = { real: "Realism + cartoon", light: "Light", cartoon: "Cartoon", bright: "Bright" };

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
