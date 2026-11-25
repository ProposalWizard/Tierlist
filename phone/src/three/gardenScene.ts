/**
 * THE GARDEN'S SCENE, loaded the first time the Garden opens. A plain `require`
 * on purpose (as ./Farewell3D.tsx loadScenes): the code is always inside the
 * app's one bundle, and only runs when the Garden starts.
 *
 * KIB RIDE (25 Nov 2026): the scene is the app's own copy of the website's garden with your horse to ride and your cars to
 * drive (./garden/sceneRide.ts, see ./garden/README.md). If it cannot start, the website's own garden scene (the one before,
 * unchanged) is started instead, so a fault in the ride code never costs you the garden.
 */
import type { GardenCallbacks, GardenController, GardenData } from "./garden/sceneRide";
import type { WalkStart } from "./walkHost";

export type GardenStart = WalkStart<GardenData, GardenCallbacks, GardenController>;

export function loadGardenStart(): GardenStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps"); // what the scene loads later (see that file)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ride = require("./garden/sceneRide") as typeof import("./garden/sceneRide");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const web = require("@/lib/star/garden3d/scene") as typeof import("@/lib/star/garden3d/scene");
  return async (container, cb, data, opts) => {
    try {
      return await ride.startGarden(container, cb, data, { quality: opts.quality });
    } catch (e) {
      // the ride scene threw while starting (and has let go of what it built): the website's garden, with no ride
      if (e instanceof Error && e.message === "disposed") throw e;
      console.warn("KIB RIDE: the garden with the ride could not start; the plain garden instead:", e instanceof Error ? e.message : e);
      const c = await web.startGarden(container, cb as unknown as import("@/lib/star/garden3d/scene").GardenCallbacks, data, { quality: opts.quality });
      return Object.assign(c, { ride: NO_RIDE }) as GardenController;
    }
  };
}

/** The ride's controller when the plain garden is running: nothing to ride, nothing to drive. */
const NO_RIDE: GardenController["ride"] = {
  mountHorse: () => false, driveCar: () => false, stop: () => {},
  info: () => ({ mode: "walk", phase: "on", canRide: false, canDrive: false, car: null, mph: 0, gait: "", off: true }),
  debug: () => ({ plain: true }),
  put: () => false, fault: () => {}, obstacles: () => ({ boxes: [], circles: [], limit: 18.3, extra: [] }),
};
