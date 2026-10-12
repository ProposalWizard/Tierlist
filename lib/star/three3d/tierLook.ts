/**
 * Settings → Look → "3D quality look: New | Old" (one phone at a time).
 *
 * Harry, 12 Oct 2026: "we need a way for say medium/low to not look terrible
 * using every percent of optimisation we can". Every iPhone opens on Medium,
 * weaker phones on Low. New buys the High look cheaply instead of switching
 * it off (lib/star/style3d/real/post.ts, real/look.ts):
 *   Medium  the far stands' soft focus back on (it reads a picture the pass
 *           already drew), the bloom read once instead of inside every FXAA
 *           read (pays for it), a light sharpen from FXAA's own samples, the
 *           pitch, crowd and boards filtered at 8x.
 *   Low     the broadcast grade (S-curve, saturation, warm lights / cool
 *           shadows) folded into the tone map every material already runs:
 *           no extra pass. A long soft shadow from each man along the sun
 *           (same draw as the contact shadow). The pitch filtered at 4x.
 *   Emergency rungs (any tier): the same tone-map grade instead of plain ACES.
 * Old: each tier exactly as it was before.
 *
 * Not a three.js file: Settings imports it. `?tierlook=old|new` on any page
 * overrides it for that page only (stills, the perf harness).
 */
import { useSyncExternalStore } from "react";

export type TierLook = "new" | "old";

const KEY = "star-3d-tier-look";
const VALUES: readonly TierLook[] = ["new", "old"];
export const TIER_LOOK_DEFAULT: TierLook = "new";
let cached: TierLook | null = null;
const listeners = new Set<() => void>();

function urlOverride(): TierLook | null {
  try {
    if (typeof location === "undefined") return null;
    const v = new URLSearchParams(location.search).get("tierlook");
    return v === "old" || v === "new" ? v : null;
  } catch { return null; }
}

export function tierLook(): TierLook {
  return urlOverride() ?? "new"; // Decided, no toggle (12 Oct 2026): the stored choice is ignored (?look3dq= still forces it on a test page).
}
export function setTierLook(v: TierLook) {
  try { localStorage.setItem(KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { cached = null; listeners.forEach((f) => f()); } });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useTierLook = () => useSyncExternalStore(subscribe, tierLook, () => TIER_LOOK_DEFAULT);

/** True when the cheap-look additions are on (New). */
export const tierLookNew = () => tierLook() === "new";
