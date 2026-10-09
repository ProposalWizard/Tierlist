/**
 * WHAT YOU WEAR — the wardrobe in your 3D home (Harry, 9 Oct 2026: "imagine
 * you actually had your current house with all your stuff and that's where
 * you change clothes"; earlier: "normal clothes when you're not walking into
 * the training area").
 *
 * Three rails: casual sets, your club kits, your boots. What you pick is saved
 * on the career (`CareerState.outfit`, types.ts). The garden and the 3D shop
 * show the casual set when you last picked one; the training pitch, the match
 * and anything that is football always show the kit.
 *
 * The casual sets are the human body's own outfits (lib/star/human3d/human.ts:
 * "tracksuit", "casual", "shirt", "quarterzip", "coat"), recoloured. Pure:
 * tested in tests/star/home3d.mts. The 3D side is ./wear.ts.
 */
import type { CareerState } from "../types";
import type { Outfit, HumanSpec } from "../human3d/human";
import { baseIdOf } from "../shopDefaults";
import { BOOT_COLOURS } from "../shop3d/catalogue";

export type CasualId = "hoodie" | "tee" | "shirt" | "tracksuit" | "coat";
export type KitId = "home" | "away";
export type OutfitChoice = NonNullable<CareerState["outfit"]>;

export interface Kit2 { shirt: string; trim: string }

export interface CasualSet {
  id: CasualId;
  label: string;
  /** One short line for the card. */
  line: string;
  /** The human body's outfit it is. */
  outfit: Outfit;
  /** Its colours (the club tracksuit and the coat's scarf take the club's). */
  colours: (kit: Kit2) => NonNullable<HumanSpec["colours"]>;
  /** A coat scarf. */
  scarf?: boolean;
  /** The swatch on the card and the colour of the garment on the rail. */
  swatch: (kit: Kit2) => [string, string];
}

export const CASUAL_SETS: CasualSet[] = [
  {
    id: "hoodie", label: "Hoodie & joggers", line: "Grey hoodie, dark joggers, trainers", outfit: "tracksuit",
    colours: () => ({ main: "#7a7f87", second: "#7a7f87", accent: "#6b7079", trousers: "#2e3138", shoes: "#f2f2ef" }),
    swatch: () => ["#7a7f87", "#2e3138"],
  },
  {
    id: "tee", label: "Tee & jeans", line: "White tee, blue jeans, trainers", outfit: "casual",
    colours: () => ({ main: "#f1efe9", second: "#f1efe9", accent: "#d9d4ca", trousers: "#34507a", shoes: "#f2f2ef" }),
    swatch: () => ["#f1efe9", "#34507a"],
  },
  {
    id: "shirt", label: "Shirt & chinos", line: "Pale blue shirt, sand chinos, brown shoes", outfit: "shirt",
    colours: () => ({ main: "#c9d7ea", second: "#c9d7ea", accent: "#8aa1c2", trousers: "#b79b6e", shoes: "#4a2c1a" }),
    swatch: () => ["#c9d7ea", "#b79b6e"],
  },
  {
    id: "tracksuit", label: "Club tracksuit", line: "Your club's colours, zip top", outfit: "quarterzip",
    colours: (k) => ({ main: k.shirt, second: k.trim, accent: k.trim, trousers: k.shirt, shoes: "#f2f2ef" }),
    swatch: (k) => [k.shirt, k.trim],
  },
  {
    id: "coat", label: "Smart coat", line: "Navy coat, white shirt, club scarf", outfit: "coat", scarf: true,
    colours: (k) => ({ main: "#1f2a44", second: "#f4f4f2", accent: "#8a1d2c", trousers: "#2a2d34", shoes: "#16110e", scarf: k.shirt }),
    swatch: () => ["#1f2a44", "#2a2d34"],
  },
];

export const DEFAULT_OUTFIT: OutfitChoice = { wear: "kit", casual: "hoodie", kit: "home", boots: "own" };

export function casualSet(id: string | undefined): CasualSet {
  return CASUAL_SETS.find((s) => s.id === id) ?? CASUAL_SETS[0];
}

/** The saved choice, tidied (an unknown casual id falls back to the hoodie). */
export function outfitOf(career: Pick<CareerState, "outfit">): OutfitChoice {
  const o = career.outfit;
  if (!o) return { ...DEFAULT_OUTFIT };
  return {
    wear: o.wear === "casual" ? "casual" : "kit",
    casual: casualSet(o.casual).id,
    kit: o.kit === "away" ? "away" : "home",
    boots: o.boots === "plain" ? "plain" : "own",
  };
}

/** The career with this choice saved (a new object; nothing else changes). */
export function withOutfit<C extends Pick<CareerState, "outfit">>(career: C, choice: Partial<OutfitChoice>): C {
  const next = { ...outfitOf(career), ...choice };
  return { ...career, outfit: outfitOf({ outfit: next }) };
}

/** Where you are: what you wear there follows from the choice. */
export type Place = "home" | "garden" | "shop" | "training";

/** What to dress the 3D player in. */
export type Worn =
  | { kind: "kit"; kit: KitId; boots: string }
  | { kind: "casual"; set: CasualSet };

/** The boot colour on your feet: your current boot's, or plain black. */
export function bootColourOf(career: Pick<CareerState, "currentBoot">, boots: "plain" | "own" | undefined): string {
  if (boots === "plain") return "#141416";
  const b = career.currentBoot;
  if (!b) return "#141416";
  return BOOT_COLOURS[baseIdOf(b)] ?? "#141416";
}

/**
 * What you wear at a place. In the home you wear what you last picked. In the
 * garden and the shop: the casual set if you last picked one, else the kit.
 * At training: always the kit.
 */
export function wornAt(career: Pick<CareerState, "outfit" | "currentBoot">, place: Place): Worn {
  const o = outfitOf(career);
  const kit: Worn = { kind: "kit", kit: o.kit, boots: bootColourOf(career, o.boots) };
  if (place === "training") return kit;
  return o.wear === "casual" ? { kind: "casual", set: casualSet(o.casual) } : kit;
}

/** The boots on the wardrobe shelf: plain ones always, and the pair you own now. */
export interface BootChoice { id: "plain" | "own"; label: string; colour: string; model: string | null }

/** The shop's boot families → the home's light copy of its generated model (tools/home3d/make_lods.mjs). */
export const BOOT_LOD: Record<string, string> = {
  starter: "/star/home3d/boot-starter-lod.glb", speed: "/star/home3d/boot-speed-lod.glb",
  control: "/star/home3d/boot-control-lod.glb", curl: "/star/home3d/boot-classic-lod.glb",
  power: "/star/home3d/boot-power-lod.glb", elite: "/star/home3d/boot-elite-lod.glb",
  maestro: "/star/home3d/boot-maestro-lod.glb",
};

export function bootChoices(career: Pick<CareerState, "currentBoot">): BootChoice[] {
  const out: BootChoice[] = [{ id: "plain", label: "Plain black", colour: "#141416", model: BOOT_LOD.starter }];
  const b = career.currentBoot;
  if (b && b.id) {
    const base = baseIdOf(b);
    out.push({ id: "own", label: b.matches > 0 ? `${b.name} · ${b.matches} left` : `${b.name} (worn out)`, colour: BOOT_COLOURS[base] ?? "#141416", model: BOOT_LOD[base] ?? BOOT_LOD.starter });
  }
  return out;
}

/** The shop's car families → the home's light copy of its generated model (drive window). */
export const CAR_LOD: Record<string, string> = {
  "car-1": "/star/home3d/car-family-lod.glb", "car-2": "/star/home3d/car-hatch-lod.glb",
  suv: "/star/home3d/car-suv-lod.glb", "car-3": "/star/home3d/car-sports-lod.glb",
  classic: "/star/home3d/car-classic-lod.glb", "car-4": "/star/home3d/car-super-lod.glb",
};
/** Each car's real length, metres (as the shop stands them: shop3d/scene.ts CAR_H_LENGTH). */
export const CAR_LENGTH: Record<string, number> = { "car-1": 4.3, "car-2": 4.1, suv: 4.95, "car-3": 4.35, classic: 4.5, "car-4": 4.6 };

/** The cars you own that the drive can show (most valuable first), at most `max`. */
export function carsOnDrive(career: Pick<CareerState, "ownedItems">, max: number): { id: string; model: string; length: number; level: number }[] {
  const best = new Map<string, number>();
  for (const it of career.ownedItems ?? []) {
    const id = baseIdOf(it);
    if (!CAR_LOD[id]) continue;
    best.set(id, Math.max(best.get(id) ?? 0, it.level ?? 1));
  }
  const ORDER = ["car-4", "car-3", "classic", "suv", "car-1", "car-2"];
  return ORDER.filter((id) => best.has(id)).slice(0, Math.max(0, max))
    .map((id) => ({ id, model: CAR_LOD[id], length: CAR_LENGTH[id] ?? 4.3, level: best.get(id)! }));
}
