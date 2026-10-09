/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DRESS THE 3D PLAYER IN AN OUTFIT — the one place the home (and the garden
 * and shop, for the casual set) make "you" in clothes. ./outfits.ts says WHAT
 * you wear; this builds the body wearing it.
 *
 *   kit     the 3D shop's own player, exactly as the shop makes him
 *           (people3d.ts: Settings → "3D people" / "3D body" pick the body),
 *           in your club's home or away kit, your number, your boot colour.
 *   casual  Player style New (Style A): the same toon body and head as the
 *           kit, in its long-sleeve "suit" paint, coloured from the set.
 *           Player style Old: the parametric human (human3d/human.ts) in one of its outfits
 *           (tracksuit, tee and jeans, shirt, quarter-zip, coat), recoloured.
 *           Built from the human file whatever "3D body" says, because the
 *           one body has no clothes but the kit.
 *
 * ── THE STYLE A HOOK ─────────────────────────────────────────────────────
 * Style A's new bodies (C1/C2/C3, toon material, textured kits) drop in here
 * and only here: register a maker with `setWearerBody(fn)` (e.g. from the
 * Style A look module when its toggle is on). It gets the same WearInput and
 * must return a Person3D (people3d.ts) on the game skeleton, so every clip,
 * the gait and the mirror keep working. Return null to fall back to the
 * makers below. The casual garments are the human's own clothes meshes; to
 * refit them to a Style A body, give that body the same outfit parts (see
 * human3d/human.ts partsFor) or paint its clothes from `colours` below.
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { Person3D } from "../people3d";
import { loadPeople3d, loadToonHead, makePerson3d, dressPerson3d, playerModelFor, relaxHands } from "../people3d";
import { playerStyleLook } from "../style3d/toon/look";
import { toonYou } from "../style3d/toon/bodies";
import { people3dLook } from "../look3d";
import { makeHuman, defaultHumanSpec, HUMAN3D_FILE, type HumanSpec } from "../human3d/human";
import { loadGltfCached } from "../three3d/perf";
import type { Worn, Kit2 } from "./outfits";

export interface WearInput {
  worn: Worn;
  /** The club's two kits (home and away), and the shirt-number texture (or null). */
  kits: { home: Kit2; away: Kit2 };
  number: any | null;
  skin: string;
  hair: string;
  hairStyle?: "short" | "long" | "buzz" | "none";
  outline: number;
  castShadow: boolean;
}

export type WearerMaker = (T: any, SkeletonUtils: any, loader: any, w: WearInput) => Promise<Person3D | null>;
let custom: WearerMaker | null = null;
/** Style A: put your own body maker in front of ours (null: back to ours). */
export function setWearerBody(fn: WearerMaker | null) { custom = fn; }

let humanFile: Promise<any> | null = null;

/** A person wearing `w.worn`. */
export async function buildWearer(T: any, SkeletonUtils: any, loader: any, w: WearInput): Promise<Person3D> {
  if (custom) {
    const p = await custom(T, SkeletonUtils, loader, w).catch((e) => { console.error("wearer body (custom) failed", e); return null; });
    if (p) return p;
  }
  const SK = SkeletonUtils.default ?? SkeletonUtils;
  const model = playerModelFor(w.hairStyle);
  const anims = await loadPeople3d(loader, "anims");
  // Style A (Player style: New): YOUR head and build for every outfit (one head file), so changing
  // clothes never swaps his look back (Harry, 9 Oct 2026: "changing clothes changed my player's style back")
  const toon = playerStyleLook() === "new";
  if (w.worn.kind === "casual" && toon) {
    const g = await loadToonHead(loader, toonYou().head);
    const p = makePerson3d(T, SK, g, anims, { outline: w.outline, castShadow: w.castShadow, you: true });
    const c = w.worn.set.colours(w.kits.home);
    dressPerson3d(T, p, { skin: toonYou().skin, hair: toonYou().hair, kit: { shirt: c.main ?? "#7a7f87", trim: c.accent ?? c.main ?? "#7a7f87", shorts: c.trousers, socks: c.trousers } });
    paintCasualToon(T, p, c);
    relaxHands(T, p);
    return p;
  }
  if (w.worn.kind === "casual") {
    humanFile ??= loadGltfCached(loader, HUMAN3D_FILE).catch((e) => { humanFile = null; throw e; });
    const g = await humanFile;
    const set = w.worn.set;
    const spec: HumanSpec = { ...defaultHumanSpec(model), outfit: set.outfit, colours: set.colours(w.kits.home), scarf: !!set.scarf };
    const p = makeHuman(T, SK, g, anims, spec, { outline: 0, castShadow: w.castShadow });
    // grey 0: makeHuman calls anyone out of kit a "manager", whose hair dressPerson3d greys by default
    dressPerson3d(T, p, { skin: w.skin, hair: w.hair, grey: 0 });
    relaxHands(T, p);
    return p;
  }
  // Style A: YOUR head and build in the kit (one head file)
  const g = toon ? await loadToonHead(loader, toonYou().head) : await loadPeople3d(loader, model, people3dLook());
  const p = makePerson3d(T, SK, g, anims, { outline: w.outline, castShadow: w.castShadow, you: true });
  dressPerson3d(T, p, {
    skin: toon ? toonYou().skin : w.skin, hair: toon ? toonYou().hair : w.hair, kit: w.kits[w.worn.kit], number: w.number,
    accessories: [{ slot: "boots", color: w.worn.boots }],
  });
  relaxHands(T, p);
  return p;
}

/**
 * A casual set on a Style A body: its own "suit" mode (style3d/toon/shader.ts),
 * which already draws long sleeves and trousers over the kit body's bare arms
 * and legs. Top = the set's main colour, trousers, shoes; the open V at the
 * neck shows the set's second colour (the coat's white shirt) with the scarf or
 * accent as the "tie"; a plain top keeps it all one colour. No badge, no number.
 */
function paintCasualToon(T: any, p: Person3D, c: Partial<Record<"main" | "second" | "accent" | "trousers" | "shoes" | "scarf", string>>) {
  const main = c.main ?? "#7a7f87";
  const u = p.u as Record<string, { value: any }>;
  if (!u.uSuit) return;
  u.uSuit.value = 1;
  u.uSuitCoat.value = new T.Color(main);
  u.uSuitTrousers.value = new T.Color(c.trousers ?? "#2a2d34");
  u.uShoes.value = new T.Color(c.shoes ?? "#f2f2ef");
  u.uSuitShirt.value = new T.Color(c.second ?? main);
  u.uSuitTie.value = new T.Color(c.scarf ?? c.second ?? main);
  if (u.uBadgeOn) u.uBadgeOn.value = 0;
  if (u.uNumOn) u.uNumOn.value = 0;
}

/** Repaint a kit-wearing person for another kit or boot colour without rebuilding him. */
export function repaintKit(T: any, p: Person3D, w: WearInput) {
  if (w.worn.kind !== "kit") return;
  const toon = !!p.toon;
  dressPerson3d(T, p, {
    skin: toon ? toonYou().skin : w.skin, hair: toon ? toonYou().hair : w.hair, kit: w.kits[w.worn.kit], number: w.number,
    accessories: [{ slot: "boots", color: w.worn.boots }],
  });
}
