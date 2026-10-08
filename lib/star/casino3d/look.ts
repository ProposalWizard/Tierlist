/**
 * THE CASINO'S LOOK SWITCH — Settings → Look → "Casino: 3D | Classic".
 * One phone at a time, 3D by default (Harry, 8 Oct 2026: "start work on
 * making the casino 3D and adding it to the garden/shop walkable area").
 *
 * 3D: Home → Casino opens the walk-around casino room
 * (components/star/Casino3D.tsx), if this phone can run 3D. Classic: the
 * casino menu exactly as before (components/star/Casino.tsx). Harry's
 * standing rule (3 Oct 2026): every new look gets a toggle and the old one
 * stays playable. Same pattern as lib/star/garden3d/look.ts.
 */
import { useSyncExternalStore } from "react";

export type Casino3dLook = "3d" | "classic";
export const CASINO3D_LOOK_KEY = "star-casino3d-look";
let stored: Casino3dLook | undefined;
const listeners = new Set<() => void>();

function read(): Casino3dLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(CASINO3D_LOOK_KEY) === "classic" ? "classic" : "3d";
  } catch {
    return "3d";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CASINO3D_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function casino3dLook(): Casino3dLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setCasino3dLook(v: Casino3dLook): void {
  try { localStorage.setItem(CASINO3D_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useCasino3dLook(): Casino3dLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    casino3dLook, () => "3d" as const,
  );
}

let possible: boolean | undefined;
/** Can this phone run the 3D room at all (three.js needs WebGL 2)? Asked
 *  once, the first time Home → Casino is opened; no means the classic menu. */
export function casino3dPossible(): boolean {
  if (possible !== undefined) return possible;
  if (typeof document === "undefined") return true;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    possible = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    possible = false;
  }
  return possible;
}
