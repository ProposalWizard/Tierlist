import { nextUpIndex } from "../../lib/star/shopNextItem";
import { loadShopItemsView, saveShopItemsView, SHOP_ITEMS_VIEW_DEFAULT, SHOP_ITEMS_VIEW_KEY } from "../../lib/star/shopItemsView";

/**
 * The shop lands on the cheapest item you don't own yet (lib/star/shopNextItem.ts),
 * and remembers 1 | 3 | 5 items on screen per device (lib/star/shopItemsView.ts).
 */
const problems: string[] = [];
const eq = (got: unknown, want: unknown, what: string) => { if (got !== want) problems.push(`${what}: got ${got}, want ${want}`); };
const it = (owned: boolean, price: number, locked = false) => ({ owned, price, locked });

eq(nextUpIndex([it(false, 1), it(false, 5)]), 0, "nothing owned → first");
eq(nextUpIndex([it(true, 1), it(true, 5), it(false, 9)]), 2, "skips owned");
eq(nextUpIndex([it(true, 1), it(false, 9), it(false, 5)]), 2, "price order, not shelf order");
eq(nextUpIndex([it(true, 1), it(false, 5, true), it(false, 9)]), 2, "skips locked while an open one is left");
eq(nextUpIndex([it(true, 1), it(false, 5, true)]), 1, "only a locked one left → that one");
eq(nextUpIndex([it(true, 1), it(true, 5)], 1), 1, "everything owned → stays put");
eq(nextUpIndex([it(true, 1), it(true, 5)], 9), 1, "fallback is clamped");
eq(nextUpIndex([it(false, 3), it(false, 3)]), 0, "equal prices keep shelf order");

// the 1 | 3 | 5 switch: default 3, remembered, junk ignored
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
};
eq(loadShopItemsView(), SHOP_ITEMS_VIEW_DEFAULT, "default");
eq(SHOP_ITEMS_VIEW_DEFAULT, 5, "default is 5 (Mikey, 25 Oct 2026: the shop opens on 5 a screen)");
saveShopItemsView(5); eq(loadShopItemsView(), 5, "remembers 5");
saveShopItemsView(1); eq(loadShopItemsView(), 1, "remembers 1");
store.set(SHOP_ITEMS_VIEW_KEY, "7"); eq(loadShopItemsView(), SHOP_ITEMS_VIEW_DEFAULT, "junk → default");

if (problems.length) {
  console.log(`shopNextItem: ${problems.length} problem(s)`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("shopNextItem: next-item landing and the 1|3|5 switch OK");
