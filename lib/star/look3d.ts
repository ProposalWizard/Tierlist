/**
 * Two Settings → Look switches for the 3D scenes, one phone at a time
 * (Harry's standing rule, 3 Oct 2026: every new look gets a toggle, default
 * New, and the old one stays exactly as it was).
 *
 *   3D people          New: the one body (lib/star/people3d.ts ONEBODY_FILES —
 *                      an ordinary waist, real fingers that grip the pen and
 *                      the handshake), in the signing, the 3D shop and the
 *                      garden. Old: each scene's people exactly as before.
 *   Talk to your manager   3D: the chat happens in the manager's office
 *                      (lib/star/office3d.ts). Old: the chat screen as before.
 */
import { useSyncExternalStore } from "react";

export type People3dLook = "new" | "old";
export type BossRoomLook = "3d" | "old";

interface Sw<V extends string> { key: string; values: readonly V[]; fallback: V }
const PEOPLE: Sw<People3dLook> = { key: "star-look-3d-people", values: ["new", "old"], fallback: "new" };
const ROOM: Sw<BossRoomLook> = { key: "star-look-boss-room", values: ["3d", "old"], fallback: "3d" };

const cache = new Map<string, string>();
const listeners = new Set<() => void>();

function read<V extends string>(s: Sw<V>): V {
  if (!cache.has(s.key)) {
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(s.key); } catch { v = null; }
    cache.set(s.key, v && (s.values as readonly string[]).includes(v) ? v : s.fallback);
  }
  return cache.get(s.key) as V;
}
function write<V extends string>(s: Sw<V>, v: V) {
  try { localStorage.setItem(s.key, v); } catch { /* in-memory still changes */ }
  cache.set(s.key, v);
  listeners.forEach((f) => f());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === PEOPLE.key || e.key === ROOM.key) { cache.delete(e.key); listeners.forEach((f) => f()); }
  });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export const people3dLook = (): People3dLook => read(PEOPLE);
export const setPeople3dLook = (v: People3dLook) => write(PEOPLE, v);
export const usePeople3dLook = () => useSyncExternalStore(subscribe, people3dLook, () => PEOPLE.fallback);
/** A 3D scene failed with the one body (Harry's iPhone, 5 Oct 2026: "The 3D
 *  shop didn't load"): use the old bodies for the rest of this visit, without
 *  changing the saved setting, so the scene can try again. */
export const fallBackToOldPeople = () => { cache.set(PEOPLE.key, "old"); };

export const bossRoomLook = (): BossRoomLook => read(ROOM);
export const setBossRoomLook = (v: BossRoomLook) => write(ROOM, v);
export const useBossRoomLook = () => useSyncExternalStore(subscribe, bossRoomLook, () => ROOM.fallback);
