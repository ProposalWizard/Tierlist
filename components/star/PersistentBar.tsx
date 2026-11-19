"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import MainBar from "./MainBar";
import { useBar, setBar, clearBar, latest, type BarProps } from "@/lib/star/barSlot";

/**
 * THE ONE BOTTOM BAR (lib/star/barSlot.ts). Mounted once in the game's layout:
 * it stays on screen between screens, so a tap never rebuilds it. Its height
 * is written to --kib-bar-h so a screen that lays the bar out in its own
 * column (DashboardShell) keeps exactly the same space for it.
 */
export default function PersistentBar() {
  const props = useBar();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== "function") return;
    // Only a real, new height: a hidden bar (0) must not change the page's
    // variable, or every style on the page is re-checked twice per tap.
    let last = 0;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h <= 0 || h === last) return;
      last = h;
      document.documentElement.style.setProperty("--kib-bar-h", `${h}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40" data-main-bar-fixed data-persistent-bar style={props ? undefined : { display: "none" }}>
      <div ref={ref} className="mx-auto w-full max-w-md">{props && <MainBar {...props}
        onNavigate={(t) => (latest() ?? props).onNavigate(t)}
        onHome={() => (latest() ?? props).onHome?.()} />}</div>
    </div>
  );
}

let nextOwner = 1;
/** A screen's say in the one bar. Renders nothing. */
export function BarSlot(props: BarProps) {
  const owner = useRef(0);
  if (!owner.current) owner.current = nextOwner++;
  // Before paint, so the lit tab changes on the tap's own frame.
  useLayoutEffect(() => { setBar(owner.current, props); });
  useLayoutEffect(() => () => clearBar(owner.current), []);
  return null;
}
export type { BarProps };
