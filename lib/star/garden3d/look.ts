/**
 * THE 3D GARDEN'S LOOK SWITCH — Settings → Look → "3D garden: New | Old".
 * One phone at a time, New by default.
 *
 * Harry's standing rule (3 Oct 2026): every new look gets a toggle and the
 * old one stays playable. New is the 5 Oct 2026 look pass (golden-hour light,
 * the shop's own player, a real shop front: ./scene.ts). Old is the garden
 * exactly as it was before it (./sceneOld.ts). Same pattern as the shop's
 * "3D shop player" switch (lib/star/signing3d.ts).
 */
import { useSyncExternalStore } from "react";

export type Garden3dLook = "new" | "old";
export const GARDEN3D_LOOK_KEY = "star-garden3d-look";
let stored: Garden3dLook | undefined;
const listeners = new Set<() => void>();

function read(): Garden3dLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(GARDEN3D_LOOK_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === GARDEN3D_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function garden3dLook(): Garden3dLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setGarden3dLook(v: Garden3dLook): void {
  try { localStorage.setItem(GARDEN3D_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useGarden3dLook(): Garden3dLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    garden3dLook, () => "new" as const,
  );
}
