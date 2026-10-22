"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

/**
 * ONLY THE POSTS NEAR THE SCREEN ARE DRAWN (Leo, 22 Oct 2026: "I will NOT
 * tolerate loading times even on bad phones").
 *
 * The feed used to build every post at once — up to 150, each with its
 * picture or video — before the first one showed. Measured on a phone slowed
 * 6×: 4.7 s to the first post, 71 posts drawn. Now each post sits in a slot;
 * a slot more than about a screen and a half away holds only an empty box of
 * the post's height, so the scroll bar and the scroll position stay right.
 * One watcher (IntersectionObserver) for the whole list, on the list's own
 * scrolling box.
 */

/** How far beyond the screen a post is still drawn (px, above and below). */
const NEAR_PX = 1100;

interface Watch {
  observe: (el: Element, on: (near: boolean) => void) => () => void;
}
const WatchCtx = createContext<Watch | null>(null);

/** Wrap the list's scrolling box. `scroller` is that box. */
export function FeedWindow({ scroller, children }: { scroller: React.RefObject<HTMLElement>; children: React.ReactNode }) {
  const [watch, setWatch] = useState<Watch | null>(null);
  useEffect(() => {
    const root = scroller.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const subs = new Map<Element, (near: boolean) => void>();
    // Posts coming near are drawn ONE PER FRAME, nearest the screen first,
    // so a fast scroll never builds five posts in one go (a 150-175 ms
    // freeze on a slowed phone). Posts going away are emptied at once.
    const queue = new Map<Element, number>();
    let frame = 0;
    const pump = () => {
      frame = 0;
      let best: Element | null = null, bestD = Infinity;
      const mid = root.getBoundingClientRect();
      const c = mid.top + mid.height / 2;
      for (const [el] of Array.from(queue)) {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - c);
        if (d < bestD) { bestD = d; best = el; }
      }
      if (best) { queue.delete(best); subs.get(best)?.(true); }
      if (queue.size) frame = requestAnimationFrame(pump);
    };
    const io = new IntersectionObserver(es => {
      for (const e of es) {
        if (e.isIntersecting) queue.set(e.target, 1);
        else { queue.delete(e.target); subs.get(e.target)?.(false); }
      }
      if (queue.size && !frame) frame = requestAnimationFrame(pump);
    }, { root, rootMargin: `${NEAR_PX}px 0px` });
    setWatch({
      observe: (el, on) => { subs.set(el, on); io.observe(el); return () => { subs.delete(el); queue.delete(el); io.unobserve(el); }; },
    });
    return () => { io.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [scroller]);
  return <WatchCtx.Provider value={watch}>{children}</WatchCtx.Provider>;
}

/** Heights of posts drawn before, so an emptied slot keeps its size. */
const heights = new Map<string, number>();

/**
 * One post's slot. `first` posts are drawn straight away (the top of the
 * feed, before the watcher has looked); the rest wait until they come near.
 */
export function FeedSlot({ id, estimate, first, children }: { id: string; estimate: number; first: boolean; children: React.ReactNode }) {
  const watch = useContext(WatchCtx);
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(first);
  useEffect(() => {
    const el = ref.current;
    if (!watch || !el) return;
    return watch.observe(el, n => {
      if (!n && el.offsetHeight > 0) heights.set(id, el.offsetHeight);
      setNear(n);
    });
  }, [watch, id]);
  // No watcher (an old browser): draw everything, as before.
  const show = near || (!watch && typeof IntersectionObserver === "undefined");
  return (
    <div ref={ref} data-feed-slot={show ? "drawn" : "empty"} style={show ? undefined : { height: heights.get(id) ?? estimate }}>
      {show ? children : null}
    </div>
  );
}
