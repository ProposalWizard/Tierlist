/**
 * WHAT EACH DISPLAY IN THE 3D SHOP SELLS — read from the real shop data on
 * this branch (lib/star/shopData.ts), not typed in again. Test area only:
 * nothing here buys anything; the page shows "Bought (test only)".
 *
 * Four displays: the boots on their plinths, the car on the turntable, the
 * KIB can fridge and the counter (a watch and jewellery case). Each item
 * comes in the shop's five levels, one per money rung (Starter … World
 * Class); KIB cans are the exception — the real shop has three cans, not
 * five levels.
 *
 * In a career the prices are the career's own (a boot sponsor's 25% off, a
 * can priced off your wage): pass `prices`. The test page leaves it out and
 * shows the shop's list prices.
 */
import { BOOTS_ALL_LEVELS, LIFESTYLE_ALL_LEVELS, KIB_CANS, kibCanEffectLabel, baseIdOf, type KibCan } from "../shopData";
import { SHOP_TIERS } from "../economy";

export type DisplayId = "boots" | "car" | "cans" | "counter" | "homes";

export interface ShopLevel {
  /** "L1" … "L5", or the can's own name. */
  label: string;
  /** Starter / Semi-Pro / … — which money rung it is priced for. */
  rung: string;
  price: number;
  /** One short line on what it gives you. */
  gives: string;
}

export interface ShopItem {
  id: string;
  name: string;
  /** Colour the 3D model is drawn in when this item is picked. */
  colour: string;
  levels: ShopLevel[];
  /** A real 3D model (.glb) of it, made from the same Blender model as the
   *  shop picture (tools/shop3d/export_items.py). */
  model?: string;
  /** Which level that model is of. */
  modelLevel?: number;
  /** No 3D model: the shop picture of a level, shown in a light box. */
  picture?: (level: number) => string;
}

export interface ShopPrices {
  boot?: (price: number) => number;
  can?: (can: KibCan) => number;
}

export interface Display {
  id: DisplayId;
  title: string;
  items: ShopItem[];
}

const RUNG = SHOP_TIERS.map((t) => t.label);

/** A colour per boot, so each pair on the wall reads as a different boot. */
const BOOT_COLOURS: Record<string, string> = {
  starter: "#f4f4f2", speed: "#ffd21f", power: "#e8322b", control: "#2f7bff",
  elite: "#1b1b1f", curl: "#19c2b4", maestro: "#9b4dff",
};

/** A paint colour per car. */
const CAR_COLOURS: Record<string, string> = {
  "car-1": "#8aa0b8", "car-2": "#e04a3a", suv: "#2b2f36", "car-3": "#f2c230",
  classic: "#1f5a3c", "car-4": "#ff6a00", bike: "#c81e1e", jet: "#e8e4da",
};

/** The car families, and which level each .glb was exported at (a mix of
 *  paints: the shop paints every family the same colour at one level). */
export const CAR_MODEL_LEVEL: Record<string, number> = { "car-1": 2, "car-2": 4, suv: 3, "car-3": 5, classic: 3, "car-4": 4 };
const carFile = (id: string) => `/star/shop3d/items/${id.startsWith("car-") ? id : `car-${id}`}.glb`;
export const BOOT_MODEL_LEVEL = 3;

function boots(pr: ShopPrices): ShopItem[] {
  const byBase = new Map<string, typeof BOOTS_ALL_LEVELS>();
  for (const b of BOOTS_ALL_LEVELS) {
    const id = baseIdOf(b);
    if (!byBase.has(id)) byBase.set(id, []);
    byBase.get(id)!.push(b);
  }
  return Array.from(byBase.entries()).map(([id, rows]) => {
    const sorted = [...rows].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    return {
      id,
      name: sorted[0].name,
      colour: BOOT_COLOURS[id] ?? "#dddddd",
      model: `/star/shop3d/items/boot-${id}.glb`,
      modelLevel: BOOT_MODEL_LEVEL,
      levels: sorted.map((b) => ({
        label: `L${b.level ?? 1}`,
        rung: RUNG[(b.level ?? 1) - 1] ?? "",
        price: pr.boot ? pr.boot(b.price) : b.price,
        gives: [
          `+${b.power} power`, `+${b.technique} technique`,
          b.curve ? "curve" : "", b.extraTouch ? "extra touch" : "",
          `${b.matches} matches`,
        ].filter(Boolean).join(" · "),
      })),
    };
  });
}

function lifestyle(category: "vehicle" | "item" | "property", only?: string[]): ShopItem[] {
  const byBase = new Map<string, typeof LIFESTYLE_ALL_LEVELS>();
  for (const it of LIFESTYLE_ALL_LEVELS) {
    if (it.category !== category) continue;
    const id = baseIdOf(it);
    if (only && !only.includes(id)) continue;
    if (!byBase.has(id)) byBase.set(id, []);
    byBase.get(id)!.push(it);
  }
  const ids = only ?? Array.from(byBase.keys());
  return ids.filter((id) => byBase.has(id)).map((id) => {
    const rows = [...byBase.get(id)!].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    return {
      id,
      name: rows[0].name,
      colour: CAR_COLOURS[id] ?? "#c9a24a",
      ...(category === "vehicle"
        ? { model: carFile(id), modelLevel: CAR_MODEL_LEVEL[id] }
        : { picture: (lv: number) => `/shop/${id}-L${Math.max(1, Math.min(rows.length, lv))}.webp` }),
      levels: rows.map((r) => ({
        label: `L${r.level ?? 1}`,
        rung: RUNG[(r.level ?? 1) - 1] ?? "",
        price: r.price,
        gives: `+${r.lifestyleValue} status`,
      })),
    };
  });
}

function cans(pr: ShopPrices): ShopItem[] {
  return [{
    id: "kib",
    name: "KIB Cans",
    colour: "#ff8a1f",
    levels: KIB_CANS.map((c) => ({
      label: c.name.replace(" KIB Can", ""),
      rung: "",
      price: pr.can ? pr.can(c) : c.price,
      gives: kibCanEffectLabel(c),
    })),
  }];
}

/**
 * `h`: the 3D look H (Settings → Look → "3D look"). Look H shows every vehicle on
 * the turntable (the motorbike and the private jet too) and adds the homes'
 * model table; Old keeps today's six cars and no homes (an empty display).
 */
export function shopDisplays(prices: ShopPrices = {}, opts: { h?: boolean } = {}): Record<DisplayId, Display> {
  const cars = ["car-1", "car-2", "suv", "car-3", "classic", "car-4"];
  return {
    boots: { id: "boots", title: "Boots", items: boots(prices) },
    car: { id: "car", title: opts.h ? "Motors" : "Cars", items: lifestyle("vehicle", opts.h ? ["bike", ...cars, "jet"] : cars) },
    cans: { id: "cans", title: "KIB Cans", items: cans(prices) },
    counter: { id: "counter", title: "Watches & jewellery", items: lifestyle("item", ["smartwatch", "silver", "gold", "diamond", "rolex"]) },
    homes: { id: "homes", title: "Homes", items: opts.h ? lifestyle("property", ["flat-1", "flat-2", "penthouse", "stable", "house-1", "villa", "house-2", "estate", "island"]) : [] },
  };
}

/** Colours for the can tiers, in the fridge (the real shop's three cans). */
export const CAN_COLOURS = ["#ff8a1f", "#3b82f6", "#a855f7"];
