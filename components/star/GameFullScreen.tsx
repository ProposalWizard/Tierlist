"use client";
import { usePathname } from "next/navigation";

/**
 * THE GAME FILLS THE PHONE (Harry, 1 Oct 2026: "maybe you need to remember to
 * do it in full screen as well"). On /star-dev only, the site's own top menu
 * and footer are hidden, so the career is the whole screen like an app — the
 * top bar (ui/GameBar.tsx) is the first thing on it. Pure CSS (globals.css,
 * `[data-star-game]`): the marker is in the server-rendered page, so there is
 * no flash of the site menu, and the shell measures its height after it has
 * gone. Every other page, and the other /star-*-dev tools, keep the menu.
 */
export default function GameFullScreen() {
  const path = usePathname();
  return path === "/star-dev" ? <div data-star-game hidden /> : null;
}
