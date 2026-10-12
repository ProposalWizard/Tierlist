/**
 * THE SHOP PICTURES SWITCH — Settings → Look → "Shop pictures: New | Old".
 * One phone at a time, New by default.
 *
 * Harry, 12 Oct 2026: "there are amazing models in the actual 3D shop, but in
 * the 2D shop … everything's a really bad version of the model." New = the
 * showroom's big stills rendered from the 3D shop's own generated models
 * (public/star/shop2d/items3d/, made by tools/shop2d/render_from_3d/). Old = the
 * Blender drawings as before (public/star/shop2d/items/). Every new look gets a
 * toggle and the old one stays (Harry, 3 Oct 2026). Same pattern as shopLook.ts.
 */
import { useSyncExternalStore } from "react";

export type ShopPicsLook = "new" | "old";
export const SHOP_PICS_KEY = "star-shop-pics-look";
let stored: ShopPicsLook | undefined;
const listeners = new Set<() => void>();

function read(): ShopPicsLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(SHOP_PICS_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === SHOP_PICS_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function shopPicsLook(): ShopPicsLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setShopPicsLook(v: ShopPicsLook): void {
  try { localStorage.setItem(SHOP_PICS_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useShopPicsLook(): ShopPicsLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    shopPicsLook, () => "new" as const,
  );
}

/**
 * Families the 3D shop has a model for. Vehicles have one picture per level
 * (the model repainted on the old ladder: worn → blue → red → black → gold);
 * the rest have one picture for every level, exactly as the 3D shop shows them.
 */
const PER_LEVEL = new Set(["car-1", "car-2", "car-3", "car-4", "classic", "bike", "suv", "jet"]);
const ONE_PICTURE = new Set([
  "flat-1", "flat-2", "penthouse", "stable", "house-1", "villa", "house-2", "estate", "island",
  "smartwatch", "silver", "gold", "diamond", "rolex",
]);
const BOOTS = new Set(["starter", "control", "speed", "curl", "power", "elite", "maestro"]);

/** The 3D-model still for one item level, or null when there is none (the old drawing stays). */
export function shopPic3d(kind: "boot" | "style", base: string, level: number): string | null {
  const lv = Math.max(1, Math.min(5, level));
  if (kind === "boot") return BOOTS.has(base) ? `/star/shop2d/items3d/boot-${base}.webp` : null;
  if (PER_LEVEL.has(base)) return `/star/shop2d/items3d/${base}-L${lv}.webp`;
  if (ONE_PICTURE.has(base)) return `/star/shop2d/items3d/${base}.webp`;
  return null;
}
