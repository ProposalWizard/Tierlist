"use client";
import { useEffect, useState } from "react";

/**
 * FULL SCREEN — "JUST THE GAME."
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
 *     still works everywhere regardless, so toggling it on is never a no-op,
 *     just sometimes only half of what it asks for.
 *
 * ── Moved into Settings, reported directly ──
 *
 * This used to be a fixed floating button in the corner of every screen.
 * Reported directly: on a real phone, that button sits right where the
 * Settings button already is for most layouts, so it was permanently in the
 * way rather than a convenience. Asked directly which fix made more sense —
 * shrinking/repositioning it, or moving it into Settings as a plain on/off
 * switch — and agreed a Settings switch is the better call: no floating
 * element left anywhere to collide with anything else on any device, and it
 * matches every other toggle-shaped preference in this game (Post-Match
 * Reactions, Player Graphics) rather than needing its own special case.
 *
 * `useImmersiveMode()` is the whole mechanism, exported as a hook so
 * SettingsScreen can render a plain switch against it — no more floating
 * button component at all.
 */

const IMMERSIVE_CLASS = "knowitball-immersive";

function isNativelyFullscreen(): boolean {
  return typeof document !== "undefined" && document.fullscreenElement !== null;
}

export function useImmersiveMode() {
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

  const toggle = () => { if (active) void exit(); else void enter(); };

  return { active, enter, exit, toggle };
}
