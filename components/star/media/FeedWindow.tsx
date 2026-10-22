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
    const io = new IntersectionObserver(es => {
      for (const e of es) subs.get(e.target)?.(e.isIntersecting);
    }, { root, rootMargin: `${NEAR_PX}px 0px` });
    setWatch({
      observe: (el, on) => { subs.set(el, on); io.observe(el); return () => { subs.delete(el); io.unobserve(el); }; },
    });
    return () => io.disconnect();
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
