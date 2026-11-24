/**
 * THE 3D SIGNING AND THE MANAGER'S OFFICE, loaded the first time one opens. A plain `require` on purpose (as
 * ./gardenScene.ts): the code is always inside the app's one bundle and only runs when a signing starts.
 * The scene is the website's own (lib/star/signing3dScene.ts), not touched. It is ONE scene with two stages:
 * the signing (you and the manager at a desk, the contract, the pen, the handshake) and the office (the same
 * room dressed as a working office, for the manager's talks).
 *
 * The website's screens (components/star/SigningScene3D.tsx, Office3D.tsx) call
 *   createSigningScene(container, options) -> handle
 * and this adapts that to the host's one shape, start(container, callbacks, data, { quality }), with the options
 * (without `onEvent`, which comes from the callbacks) as `data`. The handle gets the two things the host asks of every
 * place (a stick and a look-round: this scene has neither, the screen reads the touches), and everything else of it
 * (setShot, sign, skip, setYou, setTalking …) stays reachable.
 *
 * One browser piece the scene uses and the phone's JavaScript engine lacks, only while it starts: IntersectionObserver
 * (is the container on screen: here the host's pause and the screen say that, so it is always "yes").
 */
import type { SigningSceneHandle, SigningSceneOptions } from "@/lib/star/signing3dScene";
import type { WalkController, WalkStart } from "./walkHost";

export type SigningData = Omit<SigningSceneOptions, "onEvent" | "quality" | "body">;
export interface SigningCallbacks { onEvent?: (e: "stamp" | "shake" | "done") => void }
export type SigningWalk = SigningSceneHandle & WalkController;
export type SigningStart = WalkStart<SigningData, SigningCallbacks, SigningWalk>;

const NO_WALK: Pick<WalkController, "setStick" | "orbit"> = {
  setStick() { /* the screen's own touches */ },
  orbit() { /* the screen's own touches */ },
};

export function loadSigningStart(): SigningStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps"); // what the scenes load later with import()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./signingDeps"); // what the signing adds to those
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/star/signing3dScene") as typeof import("@/lib/star/signing3dScene");
  return async (container, cb, data, opts) => {
    const g = globalThis as unknown as { IntersectionObserver?: unknown };
    const had = Object.prototype.hasOwnProperty.call(g, "IntersectionObserver");
    const old = g.IntersectionObserver;
    // (where a real one exists, the web build, it would refuse the hollow container)
    g.IntersectionObserver = class { observe() { /* always on screen */ } unobserve() { /* nothing */ } disconnect() { /* nothing */ } };
    try {
      const h = await m.createSigningScene(container, { ...data, quality: opts.quality, onEvent: cb.onEvent });
      return Object.assign(Object.create(h), NO_WALK) as SigningWalk;
    } finally {
      if (had) g.IntersectionObserver = old; else delete g.IntersectionObserver;
    }
  };
}
