"use client";
/**
 * components/teamRoom/roomPrefs.ts — the Team room's per-device settings
 * (Harry, 25 Oct 2026: the channel list is "clearly closable … remembered per
 * device"). Each lives in this browser only: your phone and your laptop each
 * keep their own. Every read and write is wrapped, so a private window works
 * with the defaults.
 */
import { useEffect, useState } from "react";

const EVENT = "kib-tr-prefs";

export const LIST_W = { start: 220, min: 180, max: 320 } as const;
export const THREAD_W = { start: 380, min: 320, max: 560 } as const;

export interface RoomPrefs {
  /** The channel list is open (computer). */
  listOpen: boolean;
  listW: number;
  threadW: number;
  /** Message look: Clean (36 px faces) or Compact (20 px, less space). */
  density: "clean" | "compact";
  /** Sections folded in the list ("channels", "dms", "bots", "starred"). */
  folded: string[];
  /** Starred channels (slugs), at the top of the list. */
  starred: string[];
  /** Messages saved for later (ids), newest first. */
  later: number[];
}

const DEFAULTS: RoomPrefs = { listOpen: true, listW: LIST_W.start, threadW: THREAD_W.start, density: "clean", folded: [], starred: [], later: [] };
const KEY = "kib-tr-prefs";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
const nums = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && Number.isFinite(x)) : []);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 40) : []);

/** Read and clean the saved settings (never throws). */
export function readPrefs(): RoomPrefs {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    return {
      listOpen: j.listOpen !== false,
      listW: clamp(Number(j.listW) || LIST_W.start, LIST_W.min, LIST_W.max),
      threadW: clamp(Number(j.threadW) || THREAD_W.start, THREAD_W.min, THREAD_W.max),
      density: j.density === "compact" ? "compact" : "clean",
      folded: strs(j.folded),
      starred: strs(j.starred),
      later: nums(j.later).slice(0, 200),
    };
  } catch { return { ...DEFAULTS }; }
}

export function setPrefs(patch: Partial<RoomPrefs>) {
  const next = { ...readPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* server */ }
}

/** The settings, live (changes in another tab show here too). Defaults on the first paint. */
export function useRoomPrefs(): RoomPrefs {
  const [p, setP] = useState<RoomPrefs>(DEFAULTS);
  useEffect(() => {
    const sync = () => setP(readPrefs());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return p;
}

export const toggleIn = <T,>(list: readonly T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [x, ...list]);
export { clamp };
