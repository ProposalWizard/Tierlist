"use client";

/**
 * THE SHOP BASKET (v0.24, Harry, 2 Oct 2026, P2-25): "maybe you have a basket
 * and you can add more than one thing at a time while you're in the shop and
 * things kind of come off the shelves and empty out … and then they just say
 * like sold out."
 *
 * One basket for the whole shop: it lives in this module, not in a screen, so
 * it stays full while you move between the Boots and Style pages. Paying
 * calls the real buy handlers one at a time (Shop.tsx), so every price, rule
 * and sponsor discount is exactly the one-tap Buy's.
 *
 * Only things you own ONE of go in (Harry's lead, 2 Oct): boots and Style
 * items. Cans are bought in numbers on their own page.
 *  - Boots: you wear one pair. The basket holds one boot; add more of the
 *    SAME boot to take up to 3 pairs (their matches stack, as they always
 *    have). A different boot swaps the one in the basket.
 *  - Style items: one of each (a higher level of the same item swaps it).
 *
 * Nothing here is saved: the basket is gone on a reload, which is fine for a
 * few taps' worth of choosing.
 */
import { useSyncExternalStore } from "react";
import type { Boot, OwnedItem } from "@/lib/star/types";
import { baseIdOf } from "@/lib/star/shopData";

export type BasketEntry =
  | { key: string; kind: "boot"; boot: Boot; qty: number }
  | { key: string; kind: "item"; item: OwnedItem; qty: 1 };

/**
 * THE BASKET IS SWITCHED OFF (v0.25). Mikey and Harry, reviewing v0.24
 * (points 43 and 50): "not necessary … easier to just buy with one tap",
 * "you should still be able to press Buy Now", and the basket for Style items
 * is "on hold for now". With this off, every boot has a one-tap Buy now and
 * no basket button shows. The basket code stays, so turning it back on is
 * this one line.
 */
export const BASKET_ON = false;

/** Most pairs of one boot in one go. */
export const MAX_PAIRS = 3;

let entries: BasketEntry[] = [];
const subs = new Set<() => void>();
const set = (next: BasketEntry[]) => { entries = next; subs.forEach((f) => f()); };

export const basket = {
  get: () => entries,
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  /** Add a boot. Returns a short note when it swapped or capped something. */
  addBoot(boot: Boot): string | null {
    const same = entries.find((e) => e.kind === "boot" && e.boot.id === boot.id);
    if (same) {
      if (same.qty >= MAX_PAIRS) return `${MAX_PAIRS} pairs is the most at once`;
      set(entries.map((e): BasketEntry => (e === same && e.kind === "boot" ? { ...e, qty: e.qty + 1 } : e)));
      return null;
    }
    const other = entries.find((e) => e.kind === "boot");
    set([...entries.filter((e) => e.kind !== "boot"), { key: `boot:${boot.id}`, kind: "boot", boot, qty: 1 }]);
    return other && other.kind === "boot" ? `You wear one pair — swapped out ${other.boot.name}` : null;
  },
  addItem(item: OwnedItem): string | null {
    const base = baseIdOf(item);
    const other = entries.find((e) => e.kind === "item" && baseIdOf(e.item) === base);
    set([...entries.filter((e) => !(e.kind === "item" && baseIdOf(e.item) === base)), { key: `item:${item.id}`, kind: "item", item, qty: 1 }]);
    return other && other.kind === "item" && other.item.id !== item.id ? `Swapped for level ${item.level ?? 1}` : null;
  },
  remove(key: string) { set(entries.filter((e) => e.key !== key)); },
  /** One less pair of a boot, or out altogether. */
  removeOne(key: string) {
    set(entries.flatMap((e): BasketEntry[] => (e.key !== key ? [e] : e.kind === "boot" && e.qty > 1 ? [{ ...e, qty: e.qty - 1 }] : [])));
  },
  clear() { set([]); },
};

/** What the basket costs. */
export const basketTotal = (list: BasketEntry[]) =>
  list.reduce((n, e) => n + (e.kind === "boot" ? e.boot.price * e.qty : e.item.price), 0);

/** How many things are in it (pairs counted one by one). */
export const basketCount = (list: BasketEntry[]) => list.reduce((n, e) => n + e.qty, 0);

const EMPTY: BasketEntry[] = [];
export function useBasket(): BasketEntry[] {
  return useSyncExternalStore(basket.subscribe, basket.get, () => EMPTY);
}

/** Is this boot (one level of it) in the basket, and how many pairs? */
export const bootInBasket = (list: BasketEntry[], id: string) => {
  const e = list.find((x) => x.kind === "boot" && x.boot.id === id);
  return e ? e.qty : 0;
};
