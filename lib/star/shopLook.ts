/**
 * THE 2D SHOP LOOK SWITCH — Settings → Look → "Shop: New | Old". One phone
 * at a time, New by default.
 *
 * Harry, 9 Oct 2026: "completely rebuild the shop ui too because right now it
 * sucks (use higgs for this) this is the 2d shop im talking about." New = the
 * store in components/star/shop2d/ (Higgsfield store art, framed cards, a
 * level ladder, a confirm sheet and a purchase burst). Old = the shop exactly
 * as it was (components/star/Shop.tsx, ShopPage.tsx). Every new look gets a
 * toggle and the old one stays (Harry, 3 Oct 2026). Same pattern as homeLook.ts.
 */
import { useSyncExternalStore } from "react";

export type ShopLook = "new" | "old";
export const SHOP_LOOK_KEY = "star-shop-look";
let stored: ShopLook | undefined;
const listeners = new Set<() => void>();

function read(): ShopLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(SHOP_LOOK_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === SHOP_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function shopLook(): ShopLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setShopLook(v: ShopLook): void {
  try { localStorage.setItem(SHOP_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useShopLook(): ShopLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    shopLook, () => "new" as const,
  );
}
