/**
 * THE 3D CASINO ROOM'S LOOK — Settings → Look → "Casino look: New | Old".
 *
 * Harry, 9 Oct 2026 (iPhone screenshots, "about 3/10"): jagged edges, flat
 * white chandelier bulbs (one filled the screen when the camera came close),
 * no camera limit, flat light with no shadows, plain colour walls and floor,
 * signs half hidden behind a lamp, a low-poly plant.
 *
 *   New  the golden-hour room (lib/star/casino3d/hRoom.ts): a warm key light
 *        with soft shadows, contact shadows under the furniture, crystal
 *        chandeliers with a glow, woven walls and a carpet with a pile, signs
 *        clear of the lamps, the shared look-around camera that never enters
 *        a lamp or a wall, and the broadcast picture (bloom, grade)
 *   Old  the room exactly as before
 *
 * One phone at a time, New by default. Same pattern as ./look.ts.
 */
import { useSyncExternalStore } from "react";

export type CasinoRoomLook = "new" | "old";
export const CASINO_ROOM_LOOK_KEY = "star-casino-room-look";
let stored: CasinoRoomLook | undefined;
const listeners = new Set<() => void>();

function read(): CasinoRoomLook {
  try {
    if (typeof location !== "undefined") {
      const q = new URLSearchParams(location.search).get("casinoLook");
      if (q === "new" || q === "old") return q;
    }
    return typeof localStorage !== "undefined" && localStorage.getItem(CASINO_ROOM_LOOK_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CASINO_ROOM_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function casinoRoomLook(): CasinoRoomLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setCasinoRoomLook(v: CasinoRoomLook): void {
  try { localStorage.setItem(CASINO_ROOM_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useCasinoRoomLook(): CasinoRoomLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    casinoRoomLook, () => "new" as const,
  );
}
