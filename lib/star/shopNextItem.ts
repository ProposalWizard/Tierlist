/**
 * WHERE THE SHOP LANDS YOU — "start on the next item" (Harry, 12 Oct 2026:
 * "after you buy, it starts you on the next item, so you're not overloaded with
 * stuff you can never buy and not scrolling through stuff you've already got").
 *
 * When a category opens, and right after a purchase, the shop shows the
 * cheapest item you don't own yet. Locked items (higher star rating) are
 * skipped while an open one is left. Owned items stay reachable by swiping
 * back; you just don't start on them.
 */
export interface ShelfItem { owned: boolean; locked: boolean; price: number }

/** The index (in shelf order) of the item to land on. */
export function nextUpIndex(items: ShelfItem[], fallback = 0): number {
  const byPrice = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.price - b.price || a.i - b.i);
  const open = byPrice.find((it) => !it.owned && !it.locked);
  if (open) return open.i;
  const any = byPrice.find((it) => !it.owned);
  if (any) return any.i;
  return Math.max(0, Math.min(items.length - 1, fallback));
}
