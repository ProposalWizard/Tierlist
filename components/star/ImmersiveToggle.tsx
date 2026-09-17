"use client";
import { useEffect, useState } from "react";

/**
 * FULL SCREEN — "JUST THE GAME."
 *
 * Requested directly: a button that removes the site's own chrome around
 * the game (the persistent top nav, the footer) AND the browser's own UI
 * (the address bar, the tabs), leaving only the game's own rectangle on
 * screen.
 *
 * Two genuinely different things, done together:
 *  1. The site's own chrome — CSS-only, via a `knowitball-immersive` class
 *     on <body> that hides everything tagged `data-global-chrome`
 *     (GlobalNav's <nav>, SiteFooter's <footer> — see globals.css). Pure
 *     React state here couldn't reach across the layout boundary (GlobalNav
 *     is a server component rendered once, above this one, in
 *     app/layout.tsx) without a much bigger refactor — a body class is the
 *     one thing both sides can agree on without either needing to know the
 *     other exists.
 *  2. The browser's own UI — the real Fullscreen API
 *     (`requestFullscreen`/`exitFullscreen`). This is the ONLY way a website
 *     can ever hide a browser's address bar/tabs; no amount of CSS reaches
 *     outside the page itself. Not available on every platform (notably
 *     iPhone Safari has no Fullscreen API for arbitrary elements at all —
 *     iPad and desktop browsers support it) — the site-chrome half above
 *     still works everywhere regardless, so the button is never a no-op,
 *     just sometimes only half of what it asks for.
 *
 * The native `fullscreenchange` event (fired when the user backs out via
 * Esc or the browser's own UI, not this button) keeps the body class and
 * this button's own label in sync either way.
 */

const IMMERSIVE_CLASS = "knowitball-immersive";

function isNativelyFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

export default function ImmersiveToggle() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => {
      // Backed out via Esc/the browser's own UI — drop the site-chrome hide
      // too, so the two halves of this never end up out of sync.
      if (!isNativelyFullscreen()) {
        document.body.classList.remove(IMMERSIVE_CLASS);
        setActive(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.body.classList.remove(IMMERSIVE_CLASS);
    };
  }, []);

  const enter = async () => {
    document.body.classList.add(IMMERSIVE_CLASS);
    setActive(true);
    try {
      // iPhone Safari has no Fullscreen API at all — the site-chrome hide
      // above still applies regardless, so this failing silently is the
      // right behaviour, not an error to surface.
      await document.documentElement.requestFullscreen?.();
    } catch { /* platform doesn't support it — the CSS half still worked */ }
  };

  const exit = async () => {
    document.body.classList.remove(IMMERSIVE_CLASS);
    setActive(false);
    if (isNativelyFullscreen()) {
      try { await document.exitFullscreen(); } catch { /* ignore */ }
    }
  };

  return (
    <button
      onClick={active ? exit : enter}
      aria-label={active ? "Exit full screen" : "Full screen"}
      className="fixed right-2 top-2 z-[999] grid h-8 w-8 place-items-center rounded-full bg-black/50 text-sm text-white shadow-lg backdrop-blur hover:bg-black/70"
    >
      {active ? "⤢" : "⛶"}
    </button>
  );
}
