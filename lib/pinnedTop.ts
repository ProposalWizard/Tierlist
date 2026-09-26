/**
 * lib/pinnedTop.ts — two pinned bars, one under the other.
 *
 * A test screen's header is pinned to the top; the gallery's chip row and
 * Infinite Match's Edit / Save / Commit bar are pinned too. Both at `top: 0`
 * land on the same spot and one hides the other (seen 26 Sep 2026, the day
 * the pinned bars started working on phones). The header reports its height
 * as `--pinned-top`, and the second bar pins at `top: var(--pinned-top)`.
 */
import { useCallback, useEffect, useState } from "react";

export const PINNED_TOP = "var(--pinned-top, 0px)";

/** A ref for the header: keeps `--pinned-top` equal to its live height. */
export function usePinnedTop(): (el: HTMLElement | null) => void {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--pinned-top", `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty("--pinned-top"); };
  }, [el]);
  return useCallback((node: HTMLElement | null) => setEl(node), []);
}
