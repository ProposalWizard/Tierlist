/**
 * CRASH-LOOP GUARD (Mikey, 19 Nov 2026: the app closed after the trial and would
 * not open again). A crash inside the phone's graphics code closes the app before
 * any error screen can show, and reopening went straight back to the same screen.
 *
 * Each risky part writes a mark before it starts and clears it once it has run
 * for a moment. If the app dies in between, the mark is still there next launch:
 * that part is switched off (its plain fallback is used) and the app says which
 * part it was, so it can be fixed.
 */
import { useEffect, useState } from "react";
import { createMMKV } from "react-native-mmkv";

export type RiskyPart = "3d" | "badges" | "player-drawing" | "goal-video";
export const PART_NAMES: Record<RiskyPart, string> = {
  "3d": "the 3D player and 3D scenes",
  badges: "the club badges",
  "player-drawing": "the drawn player",
  "goal-video": "goal videos",
};
const kv = createMMKV({ id: "knowitball-safety" });
const RUNNING = "running:";
const OFF = "off:";

// What crashed last time: any part still marked running from the previous launch.
const trippedNow: RiskyPart[] = [];
for (const k of kv.getAllKeys()) {
  if (k.startsWith(RUNNING)) {
    const part = k.slice(RUNNING.length) as RiskyPart;
    kv.remove(k);
    kv.set(OFF + part, "1");
    trippedNow.push(part);
  }
}
/** Parts that crashed on the last launch (shown once). */
export function justTripped(): RiskyPart[] { return trippedNow; }
export function partOff(part: RiskyPart): boolean { return kv.getString(OFF + part) === "1"; }
export function turnPartBackOn(part: RiskyPart) { kv.remove(OFF + part); }

const live = new Map<RiskyPart, number>();
function start(part: RiskyPart) { live.set(part, (live.get(part) ?? 0) + 1); kv.set(RUNNING + part, "1"); }
function done(part: RiskyPart) { kv.remove(RUNNING + part); }

/**
 * Use in a risky component: returns false when the part is switched off (use the
 * fallback). While mounted, the part is marked as starting until `settleMs` has
 * passed without a crash. `delayMs` waits before saying yes, so parts that start
 * together on one screen start one after another and a crash names the right one.
 */
export function useRiskyPart(part: RiskyPart, opts: { settleMs?: number; delayMs?: number } = {}): boolean {
  const off = partOff(part);
  // no wait: marked at once, during the first draw, since the crash can come in it
  const [go, setGo] = useState(() => { if (!off && !opts.delayMs) { start(part); return true; } return false; });
  useEffect(() => {
    if (off) return;
    let t1: ReturnType<typeof setTimeout> | undefined;
    const t0 = setTimeout(() => {
      if (opts.delayMs) { start(part); setGo(true); }
      t1 = setTimeout(() => done(part), opts.settleMs ?? 4000);
    }, opts.delayMs ?? 0);
    return () => { clearTimeout(t0); if (t1) clearTimeout(t1); };
  }, [off, part, opts.delayMs, opts.settleMs]);
  return !off && go;
}
