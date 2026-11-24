/**
 * THE 3D TRAINING PITCH'S TWO SCENES, loaded the first time the training screen opens. A plain
 * `require` on purpose (as ./gardenScene.ts): the code is always inside the app's one bundle and
 * only runs when the pitch starts. Both scenes are the website's own and are not touched:
 *
 *   lib/star/training3d/scene.ts   createTrainingScene(container, data, { quality })
 *                                  the Crossbar Challenge's pitch (you and one team-mate, the training top)
 *   lib/star/play3d/scene.ts       createPlay3DScene(container, world, look, opts)
 *                                  every fully 3D drill (Two Touch, Free Roam, Headers & Volleys, Wembley, Pace Sprint),
 *                                  in look H's stadium (lib/star/style3d/real/play3dH.ts) as the website's Play3D.tsx does
 *
 * Neither is a walk-around place: they have no stick or look-round of their own (the screen reads the
 * touches and feeds the drill's World), so the controller the host sees gets two empty `setStick` and
 * `orbit`, and everything else of the scene's own controller stays reachable through it.
 */
import type { TrainingController, TrainingData } from "@/lib/star/training3d/scene";
import type { Play3DController, Play3DLook, CameraMode, PracticeFraming } from "@/lib/star/play3d/scene";
import type { World } from "@/lib/star/play3d/world";
import type { WalkController, WalkStart } from "./walkHost";

const NO_WALK: Pick<WalkController, "setStick" | "orbit"> = {
  setStick() { /* the screen's own touches */ },
  orbit() { /* the screen's own touches */ },
};
/** The scene's own controller, with the two things the host asks of every place added (its getters stay live). */
function asWalk<T extends object>(c: T): T & WalkController {
  return Object.assign(Object.create(c), NO_WALK) as T & WalkController;
}

// ── the Crossbar Challenge's pitch ─────────────────────────────────────────

export type TrainingWalk = TrainingController & WalkController;
export type TrainingStart = WalkStart<TrainingData, Record<string, never>, TrainingWalk>;

export function loadTrainingStart(): TrainingStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps"); // what the scenes load later with import()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./trainingDeps"); // what the training pitch adds to those
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/star/training3d/scene") as typeof import("@/lib/star/training3d/scene");
  return async (container, _cb, data, opts) => asWalk(await m.createTrainingScene(container, data, { quality: opts.quality }));
}

// ── a fully 3D drill ───────────────────────────────────────────────────────

export interface DrillSceneData {
  world: World;
  look: Play3DLook;
  camera: CameraMode;
  practice?: PracticeFraming;
  /** Every frame, with the seconds it ran (the screen reads the drill's numbers and its input here). */
  onFrame: (dt: number) => void;
  /** Look H's stadium colours (the website: the kit's shirt and trim, the away side blue). */
  colours: { home: string; home2: string; away: string };
  /** The headless checks only: no look H. */
  plain?: boolean;
}
export type DrillWalk = Play3DController & WalkController;
export type DrillStart = WalkStart<DrillSceneData, Record<string, never>, DrillWalk>;

export function loadDrillStart(): DrillStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./trainingDeps");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/star/play3d/scene") as typeof import("@/lib/star/play3d/scene");
  return async (container, _cb, d, opts) => {
    // look H (the website's Play3D.tsx: Decided, no toggle): the drill in a full stadium; if it cannot load, the plain pitch
    let h: { opts: object; frame(dt: number): void; dispose(): void } | null = null;
    if (!d.plain) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const hm = require("@/lib/star/style3d/real/play3dH") as typeof import("@/lib/star/style3d/real/play3dH");
        h = await hm.play3dH(d.world, { colours: d.colours });
      } catch (e) { console.warn("look H failed", e); h = null; }
    }
    const c = await m.createPlay3DScene(container, d.world, d.look, {
      camera: d.camera, quality: opts.quality, practice: d.practice,
      ...(h ? h.opts : {}),
      onFrame: (dt) => { h?.frame(dt); d.onFrame(dt); },
    });
    const w = asWalk(c);
    const dispose = c.dispose.bind(c);
    // the look's own pieces go with the scene
    Object.defineProperty(w, "dispose", { value: () => { try { h?.dispose(); } catch { /* gone */ } dispose(); }, configurable: true });
    return w;
  };
}
