/**
 * THE BALLON D'OR NIGHT AND THE SEASON AWARDS NIGHT, loaded the first time one opens. A plain `require` on purpose
 * (as ./gardenScene.ts and ./signingScene.ts): the code is always inside the app's one bundle and only runs when a
 * night starts. The scenes are the website's own (lib/star/ballonDor3d.ts, lib/star/awardsNight3d.ts), not touched.
 *
 * Both are `create…(container, options) -> handle`, and their options carry the night's plan, the people's kits and
 * `clock` (a function that says how many seconds into the night it is: the screen owns it, so the words and the
 * stage keep time). This adapts that to the host's one shape, start(container, callbacks, data, { quality }), with
 * the options (without `tier`, which comes from the host's quality) as `data`. The handle gets the two things the
 * host asks of every place (a stick and a look-round: a night has neither) and a `stats` for "Show 3D speed";
 * `debugSeek` (a still at second t) stays reachable.
 *
 * Not carried over: the clubs' crests on the shirts' chests (the website draws each crest from a picture; the phone
 * has no picture decoder for a crest's drawing, and the scenes keep the drawn shield on the chest when none is
 * given: lib/star/crestTexture.ts's own words, "a crest that fails leaves the shield").
 */
import type { AwardsSceneHandle, AwardsSceneOptions } from "@/lib/star/awardsNight3d";
import type { NightSceneHandle, NightSceneOptions } from "@/lib/star/ballonDor3d";
import type { Quality3d } from "@/lib/star/three3d/quality";
import type { WalkController, WalkStart } from "./walkHost";

export type BallonData = Omit<NightSceneOptions, "tier" | "crests">;
export type AwardsData = Omit<AwardsSceneOptions, "tier" | "crests">;
export type NightCallbacks = Record<string, never>;
type Info = { tier: Quality3d; t: number; people: number; calls: number; triangles: number };
export type BallonWalk = NightSceneHandle & WalkController;
export type AwardsWalk = AwardsSceneHandle & WalkController;
export type BallonStart = WalkStart<BallonData, NightCallbacks, BallonWalk>;
export type AwardsStart = WalkStart<AwardsData, NightCallbacks, AwardsWalk>;

function asController<H extends { debugInfo(): Info }>(h: H): H & WalkController {
  return Object.assign(Object.create(h), {
    setStick() { /* a night has no stick */ },
    orbit() { /* nor a look-round */ },
    stats() { const i = h.debugInfo(); return { calls: i.calls, triangles: i.triangles, quality: i.tier }; },
  }) as H & WalkController;
}

export function loadBallonStart(): BallonStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps"); // what the scenes load later with import() (three's helpers, the people)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/star/ballonDor3d") as typeof import("@/lib/star/ballonDor3d");
  return async (container, _cb, data, opts) => asController(await m.createNightScene(container, { ...data, tier: opts.quality }));
}

export function loadAwardsStart(): AwardsStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/star/awardsNight3d") as typeof import("@/lib/star/awardsNight3d");
  return async (container, _cb, data, opts) => asController(await m.createAwardsScene(container, { ...data, tier: opts.quality }));
}
