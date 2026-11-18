"use client";
/**
 * lib/adminLook.ts — two small per-device switches for the admin pages.
 *
 *  - The look: "ops" (Ops room: near-black, deep green, glass) or "light"
 *    (Clean light: white, one grass-green accent). Harry, 18 Oct 2026:
 *    "let's build ops board and clean light with a toggle".
 *    19 Oct 2026, two more from 8 Higgsfield looks ("D and F are my picks"):
 *    "broadcast" (D: midnight blue, floodlights, slanted TV bars) and
 *    "bento" (F: a soft colour per group). Both show every group at once.
 *  - Admin mode: on = the admin side menu shows on every page, opened on the
 *    admin pages for the page you are on. Off = it hides until you turn it
 *    back on (Settings → Developer, or the menu's "Admin & Dev tools").
 *    Harry, 18 Oct 2026: "whenever you're on a page the side bar would take
 *    you to an appropriate admin page … maybe an on/off toggle in settings".
 *
 * Both live in this browser only (localStorage), and both answer the same
 * way before and after loading so a page never flashes the wrong look.
 */
import { useEffect, useState } from "react";

/** "house" is THE admin look (Harry, 12 Nov 2026, picked from option pictures:
 *  "A for admin home and C for the rest"): calm tiles on the admin home, a dark
 *  green side menu, green-tinted paper and rows on every other page. The four
 *  older looks stay on the switch as skins (RUL-UI-007). */
export type AdminLook = "house" | "ops" | "light" | "broadcast" | "bento";
export const ADMIN_LOOKS: { id: AdminLook; name: string }[] = [
  { id: "house", name: "Knowitball" },
  { id: "broadcast", name: "Broadcast" },
  { id: "bento", name: "Bento" },
  { id: "ops", name: "Ops room" },
  { id: "light", name: "Clean light" },
];
/** Kept for old callers only. Since 20 Oct 2026 every look has the SAME layout
 *  (Harry: "everything to look the same, but with a different kind of skin");
 *  never branch a layout on the look. */
export const isBoardLook = (l: AdminLook) => l === "broadcast" || l === "bento";
/** The two light looks (for anything that paints itself dark or light). */
export const isLightLook = (l: AdminLook) => l === "house" || l === "light" || l === "bento";
/** A new key on 12 Nov 2026, so everyone starts on the Knowitball look once
 *  (the old key, "kib-admin-look", is left alone and no longer read). */
const LOOK_KEY = "kib-admin-look-2";
const MODE_KEY = "kib-admin-mode";
const EVENT = "knowitball:admin-prefs";

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private mode */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* server */ }
}

/** Never chosen = the Knowitball look (Harry, 12 Nov 2026; it was Clean light
 *  from 20 Oct 2026). Anyone who picks another look after that keeps it. */
export const getAdminLook = (): AdminLook => {
  const v = read(LOOK_KEY);
  return v === "ops" || v === "broadcast" || v === "bento" || v === "light" ? v : "house";
};
export const setAdminLook = (l: AdminLook) => write(LOOK_KEY, l);
/** On unless switched off: today's admin tab was always there for admins. */
export const getAdminMode = (): boolean => read(MODE_KEY) !== "off";
export const setAdminMode = (on: boolean) => write(MODE_KEY, on ? "on" : "off");

function usePref<T>(get: () => T, fallback: T): T {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    const sync = () => setV(get());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, [get]);
  return v;
}

export const useAdminLook = () => usePref(getAdminLook, "house" as AdminLook);
export const useAdminMode = () => usePref(getAdminMode, true);
