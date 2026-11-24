"use client";
/**
 * Shared pieces of the decision screens: the still behind a moment (until the
 * 3D world is wired in), the stage-size hook, reduced motion, and the "X will
 * remember that." notice (shown only when a memory was really written).
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { rememberNotice, type Remembered } from "@/lib/star/life/decision";

/** A picture behind the moment: the 3D scene goes here later. `focus` is the
 *  speaker's head as fractions of the picture (he keeps his colour there). */
export interface DecisionBackdrop { src: string; w: number; h: number; focus: { x: number; y: number } }

/** The two test stills (frames of the world kit's bench). */
export const STILL_TALK: DecisionBackdrop = { src: "/star/life/still-bench-talk.webp", w: 780, h: 1548, focus: { x: 0.767, y: 0.378 } };
export const STILL_GROUP: DecisionBackdrop = { src: "/star/life/still-bench-group.webp", w: 780, h: 1170, focus: { x: 0.429, y: 0.5 } };
/** The other man on the group still (for a chat bubble over his head). */
export const STILL_GROUP_OTHER = { x: 0.7, y: 0.5 };

export function useStageSize<T extends HTMLElement>(): [RefObject<T>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 390, h: 844 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth || 390, h: el.clientHeight || 844 });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    try {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      setR(m.matches);
      const on = () => setR(m.matches);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    } catch { return undefined; }
  }, []);
  return r;
}

/** Where the picture sits: it fills a phone (cover, kept on the speaker);
 *  on a wide screen it stands full height in the middle over a blurred copy. */
export interface Placed { left: number; top: number; width: number; height: number; wide: boolean }
export function placeStill(W: number, H: number, b: DecisionBackdrop, headAt = 0.42, zoom = 1): Placed {
  const wide = W / H > (b.w / b.h) * 1.6;
  if (wide) {
    const s = H / b.h;
    return { left: (W - b.w * s) / 2, top: 0, width: b.w * s, height: H, wide };
  }
  const s = Math.max(W / b.w, H / b.h) * zoom;
  const dw = b.w * s, dh = b.h * s;
  const left = Math.min(0, Math.max(W - dw, W / 2 - b.focus.x * dw));
  const top = Math.min(0, Math.max(H - dh, H * headAt - b.focus.y * dh));
  return { left, top, width: dw, height: dh, wide };
}
export const pointOn = (p: Placed, fx: number, fy: number) => ({ x: p.left + fx * p.width, y: p.top + fy * p.height });

export function RememberToast({ remembered, top }: { remembered: Remembered[] | undefined; top?: number }) {
  const n = rememberNotice(remembered);
  if (!n) return null;
  return (
    <div className="dd-toast" style={top !== undefined ? { top } : undefined} data-remember role="status">
      <div className="l1">↻ <em>{n.who}</em> {n.line}</div>
      <div className="l2">{n.why}</div>
    </div>
  );
}
