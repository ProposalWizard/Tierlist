"use client";
/**
 * components/teamRoom/roomLook.ts — the Team room's own Dark / Light switch
 * (Harry, 12 Nov 2026: "Midnight slate and Light C as dark/light mode").
 *
 *   Dark  = "Midnight slate": warm greys, one green.
 *   Light = "Light C": green-tinted paper, white cards, a dark green channel
 *           list (the admin's Knowitball look).
 *   Auto  = follow this device's own dark / light setting (the start).
 *
 * Kept on this device only. The paint is components/teamRoom/roomLook.css.
 */
import { useEffect, useState } from "react";

export type RoomLookPref = "auto" | "dark" | "light";
export type RoomLook = "slate" | "lightc";
const KEY = "kib-tr-look";
const EVENT = "kib-tr-look";

export const cleanLookPref = (v: unknown): RoomLookPref => (v === "dark" || v === "light" ? v : "auto");
/** The look to paint: your pick, else the device's own setting. */
export const lookFor = (pref: RoomLookPref, deviceDark: boolean): RoomLook => (pref === "dark" || (pref === "auto" && deviceDark) ? "slate" : "lightc");

export function readLookPref(): RoomLookPref {
  try { return cleanLookPref(localStorage.getItem(KEY)); } catch { return "auto"; }
}
export function setLookPref(p: RoomLookPref) {
  try { if (p === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch { /* private window */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* server */ }
}

/** Your pick and the look it gives, live. Dark on the very first paint, then the real one. */
export function useRoomLook(): { pref: RoomLookPref; look: RoomLook } {
  const [v, setV] = useState<{ pref: RoomLookPref; look: RoomLook }>({ pref: "auto", look: "slate" });
  useEffect(() => {
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => { const pref = readLookPref(); setV({ pref, look: lookFor(pref, q.matches) }); };
    sync();
    q.addEventListener("change", sync);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { q.removeEventListener("change", sync); window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return v;
}
