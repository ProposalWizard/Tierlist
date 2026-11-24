/**
 * YOUR HOUSE'S SCENE, loaded the first time the house opens. A plain `require` on purpose
 * (as ./gardenScene.ts and ./shopScene.ts): the code is always inside the app's one bundle and
 * only runs when the house starts. The scene is the website's own (lib/star/home3d/scene.ts),
 * not touched.
 *
 * The website's screen (components/star/Home3D.tsx) calls
 *   startHome(container, callbacks, homeData, options)
 * and this adapts that to the host's one shape, start(container, callbacks, data, { quality }),
 * with the home's data and the options as `data`.
 */
import type { HomeCallbacks, HomeController, HomeData, HomeOptions } from "@/lib/star/home3d/scene";
import type { WalkStart } from "./walkHost";

export interface HouseData {
  /** What the house is built from (the website's homeSceneData). */
  home: HomeData;
  /** A living house (homes.ts LIVING_TIERS): things you use and team-mates round. Absent: the quiet rooms. */
  living?: HomeOptions["living"];
  /** The 3D phone: open in his eyes (he is hidden), the camera eases out later (HomeController.easePov). */
  pov?: boolean;
  /** The headless checks only: every frame moves the game on by this many seconds. */
  fixedStep?: number;
}

export type HouseStart = WalkStart<HouseData, HomeCallbacks, HomeController>;

export function loadHouseStart(): HouseStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps"); // what the scenes load later with import()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./houseDeps"); // what the house adds to those (the mirror, the living rooms' people)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/star/home3d/scene") as typeof import("@/lib/star/home3d/scene");
  return (container, cb, data, opts) => m.startHome(container, cb, data.home, {
    quality: opts.quality,
    lookH: true, // look H is the only look (look3dStyle.ts)
    fixedStep: data.fixedStep,
    ...(data.pov ? { pov: true } : {}),
    ...(data.living ? { living: data.living } : {}),
  });
}
