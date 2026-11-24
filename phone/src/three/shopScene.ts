/**
 * THE 3D SHOP'S SCENE, loaded the first time the shop opens. A plain `require` on purpose
 * (as ./gardenScene.ts): the code is always inside the app's one bundle and only runs when
 * the shop starts. The scene is the website's own (lib/star/shop3d/scene.ts), not touched.
 *
 * The website's screen (components/star/Shop3D.tsx) calls
 *   startShop(container, callbacks, kit, displays, options)
 * and this adapts that to the host's one shape, start(container, callbacks, data, { quality }),
 * with the kit, the displays and the options as `data`.
 */
import type { Display, DisplayId } from "@/lib/star/shop3d/catalogue";
import type { KitColours, ShopCallbacks, ShopController, ShopPlayer } from "@/lib/star/shop3d/scene";
import type { WalkStart } from "./walkHost";

export interface ShopData {
  kit: KitColours;
  displays: Record<DisplayId, Display>;
  /** Start just inside the front doors (you came in from the garden). */
  atDoor: boolean;
  /** The shirt number on his back. */
  number: number;
  player: ShopPlayer;
  /** The headless checks only: every frame moves the game on by this many seconds (a slow software GL still gets somewhere). */
  fixedStep?: number;
}

export type ShopStart = WalkStart<ShopData, ShopCallbacks, ShopController>;

export function loadShopStart(): ShopStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps"); // what the scenes load later with import() (the shop asks for the same ones)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/star/shop3d/scene") as typeof import("@/lib/star/shop3d/scene");
  return (container, cb, data, opts) => m.startShop(container, cb, data.kit, data.displays, {
    quality: opts.quality, atDoor: data.atDoor, number: data.number, player: data.player, fixedStep: data.fixedStep,
  });
}
