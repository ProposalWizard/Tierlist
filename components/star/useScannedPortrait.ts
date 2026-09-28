"use client";
import { useEffect, useState } from "react";
import { cachedScanOf, isScannablePortrait, scanLegacyPortrait } from "@/lib/star/faceScan";

/**
 * An old save's photo, scanned (faceScan.ts) the first time it is shown.
 *
 * Photos picked before the face scan existed are solid squares with the room
 * behind them. The first time one is drawn, it is scanned once in the
 * background (after the page has settled) and the result is cached in this
 * browser, so every later visit reads it straight away. Until then — or if it
 * can't be scanned — this returns undefined and the old photo is used as it
 * always was.
 */
export function useScannedPortrait(url: string | undefined): string | undefined {
  const [scanned, setScanned] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!isScannablePortrait(url)) { setScanned(undefined); return; }
    const hit = cachedScanOf(url);
    if (hit !== undefined) { setScanned(hit ?? undefined); return; }
    let alive = true;
    const run = () => { void scanLegacyPortrait(url).then((v) => { if (alive) setScanned(v ?? undefined); }); };
    const idle = "requestIdleCallback" in window;
    const h = idle ? window.requestIdleCallback(run, { timeout: 4000 }) : window.setTimeout(run, 1500);
    return () => {
      alive = false;
      if (idle) window.cancelIdleCallback(h); else window.clearTimeout(h);
    };
  }, [url]);
  return scanned;
}
