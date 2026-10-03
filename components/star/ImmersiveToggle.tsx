"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * FULL SCREEN — "JUST THE GAME."
 *
 * Two different things, done together:
 *  1. The site's own chrome — CSS-only, via a `knowitball-immersive` class on
 *     <body> that hides everything tagged `data-global-chrome` (globals.css).
 *  2. The browser's own bars — the real Fullscreen API. This is the only way
 *     a web page can hide an address bar.
 *
 * ── What works where (checked 2 Oct 2026, v0.25, Harry + Mikey live test) ──
 *
 *  - Android Chrome, desktop Chrome/Edge/Firefox/Safari, iPad Safari: the real
 *    Fullscreen API works. The switch in Settings uses it.
 *  - iPhone Safari (and every iPhone browser — they are all Safari inside):
 *    NO Fullscreen API for pages at all, only for <video>. Calling it does
 *    nothing. The only way to run with no browser bars on an iPhone is to add
 *    the game to the Home Screen and open it from that icon: the web manifest
 *    (public/star-app.webmanifest, display "standalone") and the
 *    apple-mobile-web-app-capable tag (app/star-dev/layout.tsx) make that
 *    open as an app. So on an iPhone, Settings shows a short "Add to Home
 *    Screen" tip instead of a switch that cannot work.
 *  - Opened from the Home Screen (any phone): already full screen, nothing to
 *    switch.
 *
 * ── Staying in full screen ──
 *
 * Reported in the same test: something "takes me out of full screen" when a
 * screen opens. A browser drops full screen on its own for several things a
 * page cannot stop: a native confirm()/alert() box, the photo picker, the
 * keyboard on some Android versions, the system back gesture, Esc. The two
 * confirm() boxes are gone (askConfirm.ts). For the rest, the choice is now
 * REMEMBERED per device and full screen is asked for again on the very next
 * tap whenever it was lost — a browser only allows it inside a tap, so that
 * is the earliest moment it can come back. Turning the switch off in Settings
 * is the only thing that stops it.
 */

const IMMERSIVE_CLASS = "knowitball-immersive";
const PREF_KEY = "star-fullscreen";

/** How full screen can work on this device. */
export type FullscreenSupport =
  /** The real Fullscreen API is there (Android, desktop, iPad). */
  | "native"
  /** Already running from the Home Screen with no browser bars. */
  | "standalone"
  /** An iPhone in the browser: only "Add to Home Screen" gives no bars. */
  | "ios"
  /** Nothing works (a very old browser). */
  | "none";

type FsDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

function fsDoc(): FsDoc { return document as FsDoc; }

function isNativelyFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = fsDoc();
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

export function fullscreenSupport(): FullscreenSupport {
  if (typeof window === "undefined") return "none";
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true
    || window.matchMedia?.("(display-mode: standalone)").matches
    || window.matchMedia?.("(display-mode: fullscreen)").matches;
  if (standalone) return "standalone";
  const ua = navigator.userAgent;
  // An iPhone never gets page full screen, whatever a flag says: every
  // browser on it is Safari inside. Checked before the flags on purpose.
  if (/iPhone|iPod/.test(ua)) return "ios";
  const d = fsDoc();
  if (d.fullscreenEnabled || d.webkitFullscreenEnabled) return "native";
  const iOS = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return iOS ? "ios" : "none";
}

function readPref(): boolean {
  try { return localStorage.getItem(PREF_KEY) === "1"; } catch { return false; }
}
function writePref(on: boolean) {
  try { localStorage.setItem(PREF_KEY, on ? "1" : "0"); } catch { /* private mode */ }
}

async function requestNative() {
  if (isNativelyFullscreen()) return;
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch { /* not inside a tap, or not allowed — the next tap tries again */ }
}

export function useImmersiveMode() {
  const [active, setActive] = useState(false);
  const [support, setSupport] = useState<FullscreenSupport>("none");
  // The player's choice, kept in a ref so the tap listener reads it live.
  const wantRef = useRef(false);

  useEffect(() => {
    setSupport(fullscreenSupport());
    const want = readPref();
    wantRef.current = want;
    if (want) {
      document.body.classList.add(IMMERSIVE_CLASS);
      setActive(true);
    }
    // A browser only lets a page go full screen inside a tap. Whenever the
    // player wants it and it has been lost (photo picker, keyboard, back
    // gesture, a reload), the next tap anywhere brings it back.
    const onTap = (e: Event) => {
      // The Settings switch itself decides on its own (turning it off must
      // not first turn it back on).
      if ((e.target as Element | null)?.closest?.("[data-fs-toggle]")) return;
      if (wantRef.current && !isNativelyFullscreen() && fullscreenSupport() === "native") void requestNative();
    };
    document.addEventListener("click", onTap, true);
    document.addEventListener("keydown", onTap, true);
    return () => {
      document.removeEventListener("click", onTap, true);
      document.removeEventListener("keydown", onTap, true);
      document.body.classList.remove(IMMERSIVE_CLASS);
    };
  }, []);

  const enter = useCallback(async () => {
    wantRef.current = true;
    writePref(true);
    document.body.classList.add(IMMERSIVE_CLASS);
    setActive(true);
    await requestNative();
  }, []);

  const exit = useCallback(async () => {
    wantRef.current = false;
    writePref(false);
    document.body.classList.remove(IMMERSIVE_CLASS);
    setActive(false);
    if (isNativelyFullscreen()) {
      const d = fsDoc();
      try {
        if (d.exitFullscreen) await d.exitFullscreen();
        else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
      } catch { /* ignore */ }
    }
  }, []);

  const toggle = useCallback(() => { if (wantRef.current) void exit(); else void enter(); }, [enter, exit]);

  return { active, support, enter, exit, toggle };
}
