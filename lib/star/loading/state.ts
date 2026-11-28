/**
 * Is a loading screen up? (coordinator, 28 Nov 2026: the first-match energy
 * tip showed over the matchday programme as it lifted). While any loading
 * screen is on the phone, nothing may appear over or under it: tutorial
 * pointers wait (components/star/PointerTour.tsx), and the 3D match is held
 * (components/star/Match3DLayer.tsx) so its clock and first tip start at the lift.
 * Pure counting (tests/star/loadingScreens.mts); the React hook reads it.
 */
import { useSyncExternalStore } from "react";

let up = 0;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((f) => f());

/** A loading screen came up: call the returned function when it has gone. Safe to call that twice. */
export function curtainUp(): () => void {
  up++;
  tell();
  let done = false;
  return () => { if (done) return; done = true; up = Math.max(0, up - 1); tell(); };
}
export function curtainShowing(): boolean { return up > 0; }

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
/** True while any loading screen is up (false on the server). */
export const useCurtainUp = () => useSyncExternalStore(subscribe, curtainShowing, () => false);
