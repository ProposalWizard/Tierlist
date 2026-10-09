/**
 * A career screen that downloads only when it is first needed
 * (speed job D, 9 Oct 2026: "loading times eradicated").
 *
 * /star-dev used to pull every screen of the game — the Old UI, the shop,
 * the casino, the trial, every 3D room — before Home could answer a tap.
 * Each screen wrapped in `lazyScreen` becomes its own small file instead.
 *
 * Why not plain next/dynamic: it shows nothing for a frame every time the
 * screen mounts, even once it is downloaded. Here, once the file is in, the
 * screen renders straight away with no blank frame; and `preloadScreens`
 * fetches them quietly after Home is up, so by the time you tap one it is
 * already there.
 *
 * One rule kept on purpose: an instance decides at mount whether it is the
 * direct or the waiting kind and never switches, so a screen's own state is
 * never thrown away by the file arriving.
 */
import { createElement, lazy, Suspense, useRef, type ComponentProps, type ComponentType } from "react";

export interface LazyScreen<P> {
  (props: P): ReturnType<typeof createElement> | null;
  preload: () => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyScreen<C extends ComponentType<any>>(
  load: () => Promise<{ default: C }>,
): LazyScreen<ComponentProps<C>> {
  let mod: C | null = null;
  let pending: Promise<void> | null = null;
  const preload = (): Promise<void> => {
    if (mod) return Promise.resolve();
    if (!pending) {
      pending = load().then((m) => { mod = m.default; }, (e) => { pending = null; throw e; });
    }
    return pending;
  };
  const Waiting = lazy(async () => { await preload(); return { default: mod as C }; });
  function Screen(props: ComponentProps<C>) {
    const direct = useRef<boolean | null>(null);
    if (direct.current === null) direct.current = mod !== null;
    if (direct.current && mod) return createElement(mod, props);
    return createElement(Suspense, { fallback: null }, createElement(Waiting, props));
  }
  (Screen as LazyScreen<ComponentProps<C>>).preload = preload;
  return Screen as LazyScreen<ComponentProps<C>>;
}

/**
 * Fetch these screens in the background, one at a time, when the phone is
 * idle. Safe to call more than once; a failed download is simply tried again
 * the next time the screen is opened.
 */
export function preloadScreens(screens: { preload: () => Promise<void> }[], startDelayMs = 1500): () => void {
  if (typeof window === "undefined") return () => {};
  let stopped = false;
  type IdleWin = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const w = window as IdleWin;
  const idle = (cb: () => void) => (w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout: 2000 }) : window.setTimeout(cb, 120));
  let i = 0;
  const step = () => {
    if (stopped || i >= screens.length) return;
    const s = screens[i++];
    s.preload().catch(() => {}).finally(() => { if (!stopped) idle(step); });
  };
  const t = window.setTimeout(() => idle(step), startDelayMs);
  return () => { stopped = true; window.clearTimeout(t); };
}
