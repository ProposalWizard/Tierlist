/**
 * THE GARDEN'S SCENE, loaded the first time the Garden opens. A plain `require`
 * on purpose (as ./Farewell3D.tsx loadScenes): the code is always inside the
 * app's one bundle, and only runs when the Garden starts.
 */
import type { GardenCallbacks, GardenController, GardenData } from "@/lib/star/garden3d/scene";
import type { WalkStart } from "./walkHost";

export type GardenStart = WalkStart<GardenData, GardenCallbacks, GardenController>;

export function loadGardenStart(): GardenStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps"); // what the scene loads later (see that file)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/star/garden3d/scene") as typeof import("@/lib/star/garden3d/scene");
  return (container, cb, data, opts) => m.startGarden(container, cb, data, { quality: opts.quality });
}
