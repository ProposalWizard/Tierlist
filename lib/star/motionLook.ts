/**
 * MOTION: MOCAP | OLD — Settings → Look, one phone at a time, Mocap by default.
 *
 * Harry, 9 Oct 2026: "the animations across everything also need to be
 * perfect … strive for something that we will review and be AMAZED by."
 * Mocap: real human motion capture (the CMU Graphics Lab database, free for
 * any use) put onto our skeletons by tools/mocap3d → public/star/anims3d/
 * mocap.glb (the 3D people) and mocap-ual.glb (the old shop/garden
 * footballer). Its clips go in over the old hand-made ones BY NAME
 * (idle, jog, kick_r, shot_r, header_stand …), so every 3D screen that loads
 * clips through footballAnims.ts / people3d.ts picks them up.
 * Old: the hand-made clips exactly as before (tools/anims3d).
 *
 * Every new look gets a toggle and the old one stays (Harry, 3 Oct 2026).
 */
import { useSyncExternalStore } from "react";

export type MotionLook = "mocap" | "old";
export const MOTION_LOOK_KEY = "star-look-motion";
let stored: MotionLook | undefined;
const listeners = new Set<() => void>();

function read(): MotionLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(MOTION_LOOK_KEY) === "old" ? "old" : "mocap";
  } catch {
    return "mocap";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === MOTION_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function motionLook(): MotionLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setMotionLook(v: MotionLook): void {
  try { localStorage.setItem(MOTION_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useMotionLook(): MotionLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    motionLook, () => "mocap" as const,
  );
}
