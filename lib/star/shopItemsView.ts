/**
 * HOW MANY SHOP ITEMS ON SCREEN — the 1 | 3 | 5 switch in the shop header.
 * A player preference, kept on this device; not a New/Old look toggle.
 *
 * Harry and Mikey, 12 Oct 2026: Mikey ("I have to swipe right 7 times to see
 * the mansion") wanted 3 items with the side ones faded; Harry wanted "a toggle
 * for how many items on screen... one item, 3 items, 5 items". 3 is the default.
 *   1 = the showroom (one item fills the screen);
 *   3 = the centre item large, the one before and after it small and faded;
 *   5 = a compact list (phone) / row of cards (PC), name, price, owned/locked.
 */
export type ShopItemsView = 1 | 3 | 5;
export const SHOP_ITEMS_VIEW_KEY = "star-shop-items-view";
// 5 by default since 25 Oct 2026 (Mikey: "make it the default for everyone").
export const SHOP_ITEMS_VIEW_DEFAULT: ShopItemsView = 5;

export function loadShopItemsView(): ShopItemsView {
  try {
    const v = Number(localStorage.getItem(SHOP_ITEMS_VIEW_KEY));
    return v === 1 || v === 3 || v === 5 ? v : SHOP_ITEMS_VIEW_DEFAULT;
  } catch {
    return SHOP_ITEMS_VIEW_DEFAULT;
  }
}

export function saveShopItemsView(v: ShopItemsView): void {
  try { localStorage.setItem(SHOP_ITEMS_VIEW_KEY, String(v)); } catch { /* the switch still works this visit */ }
}
