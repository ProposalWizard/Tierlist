"use client";
import { useRef, type ReactNode } from "react";

/**
 * SWIPE BACK (Mikey's playtest, 21 Oct 2026): "it goes into this and then
 * you can't swipe back". Wraps a full screen reached by swiping (the
 * Showroom from Home's right edge) so a swipe to the right goes back.
 *
 * A swipe is at least 80px across and mostly sideways. One that starts on
 * something that scrolls sideways (a row of tabs or items) is left to it.
 */
const MIN_DX = 80;

function scrollsSideways(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const ox = getComputedStyle(n).overflowX;
    if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
}

export default function SwipeBack({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const begin = (target: EventTarget, x: number, y: number) => {
    start.current = scrollsSideways(target as Element) ? null : { x, y };
  };
  const end = (x: number, y: number) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = x - s.x, dy = Math.abs(y - s.y);
    if (dx >= MIN_DX && dy < dx * 0.6) onBack();
  };
  // Touch on a phone (a pointer there is cancelled once the page pans);
  // a mouse drag on a computer.
  return (
    <div
      onTouchStart={(e) => { const t = e.touches[0]; if (t) begin(e.target, t.clientX, t.clientY); }}
      onTouchEnd={(e) => { const t = e.changedTouches[0]; if (t) end(t.clientX, t.clientY); }}
      onPointerDown={(e) => { if (e.pointerType === "mouse") begin(e.target, e.clientX, e.clientY); }}
      onPointerUp={(e) => { if (e.pointerType === "mouse") end(e.clientX, e.clientY); }}
    >
      {children}
    </div>
  );
}
