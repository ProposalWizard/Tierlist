"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * ADMIN NAV — every admin page and every dev sandbox, one slide-out panel.
 *
 * Requested directly: "an admin-only side panel, like how there is a side
 * panel that has Knowitball games... if I'm on the scenario page, I can
 * easily get back to the homepage, and if I'm on the homepage, then I can
 * easily get back to the scenario page."
 *
 * Three things about how this is wired, all deliberate:
 *
 *  1. ADMIN GATE IS SERVER-SIDE. This component is only ever rendered by
 *     GlobalNav, inside `{userIsAdmin && ...}` — the same `isAdmin(user.id)`
 *     (lib/admin.ts, service-role, bypasses RLS) call the nav already makes
 *     for its own /admin link. A non-admin never receives this markup at
 *     all, so there is nothing client-side to flip. The pages themselves
 *     keep whatever gate they already have; this is only a shortcut for
 *     someone who is already allowed in.
 *
 *  2. EVERYTHING IS PORTALED TO <body>. Nothing renders inline in the nav.
 *     That matters because immersive pages (/star-gallery-dev, star-dev's
 *     Full Screen switch) hide the whole nav with
 *     `body.knowitball-immersive [data-global-chrome] { display: none }`
 *     (globals.css). A portal's DOM lives in <body>, not under the hidden
 *     parent, so the panel survives — which is the point, since the gallery
 *     is exactly the page you want to navigate away from.
 *
 *  3. THE EDGE TAB IS DESKTOP ONLY, EXCEPT ON FULL-SCREEN PAGES. "Have that
 *     somewhere on the screen on PC, more so than mobile." On a phone the
 *     same list opens from the menu ("Admin & Dev tools", NavMenu.tsx, via
 *     OPEN_ADMIN_NAV_EVENT) — before that, a phone reached /admin and
 *     nothing else: the gallery, Play Area and training had no link at all.
 *     A full-screen page (gallery, Play Area, highlights) hides the menu, and
 *     the gallery has no way out, so there the tab shows on a phone too —
 *     and never on top of the pitch or a button (see placeTab below).
 */

/** Where the phone tab may sit, and how wide it is. */
type TabSpot = { top: number; slim: boolean };

const TAB_H = 82;
const FULL_W = 24;
/** Every phone test screen leaves at least 12 px of gutter left of the
 *  pitch (measured: highlights 12, gallery 15, on SE / 13 / Pixel 5). */
const SLIM_W = 10;

/**
 * THE PHONE TAB NEVER SITS ON THE PITCH. Harry, 26 Sep 2026: the mid-left
 * tab covered 14 px of the pitch's edge, so a drag starting there opened the
 * menu. This looks down the left edge, nearest the middle first, for a spot
 * where the full tab covers nothing drawn (no pitch, control, card or
 * label); failing that, a spot for a 10 px sliver, which fits in the gutter
 * beside the pitch.
 */
function placeTab(): TabSpot {
  const H = window.innerHeight, W = window.innerWidth;
  // What is drawn at one point of the left edge, ignoring this panel: a
  // pitch, a control, or any card/bar/label narrower than the page counts as
  // taken; only the page's own full-width background is free.
  const taken = (x: number, y: number): boolean => {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest("[data-admin-nav]")) continue;
      if (el === document.body || el === document.documentElement) return false;
      if (el.matches("canvas, button, a, input, select, textarea, label, [role=button]")) return true;
      return el.getBoundingClientRect().width < W - 8;
    }
    return false;
  };
  const STEP = 6;
  const rows = Math.ceil(H / STEP);
  const col = (x: number) => Array.from({ length: rows }, (_, i) => taken(x, i * STEP + 1));
  const full = [col(2), col(FULL_W / 2), col(FULL_W - 2)];
  const slim = [col(2), col(SLIM_W - 2)];
  const clear = (top: number, cols: boolean[][]) => {
    for (let i = Math.floor((top - 2) / STEP); i <= Math.ceil((top + TAB_H + 2) / STEP); i++) {
      if (i < 0 || i >= rows) continue;
      if (cols.some((c) => c[i])) return false;
    }
    return true;
  };
  const lo = 60, hi = Math.max(lo, H - 60 - TAB_H), mid = (H - TAB_H) / 2;
  const tops: number[] = [];
  for (let d = 0; d <= H; d += 12) {
    if (mid - d >= lo) tops.push(Math.round(mid - d));
    if (d && mid + d <= hi) tops.push(Math.round(mid + d));
    if (mid - d < lo && mid + d > hi) break;
  }
  for (const t of tops) if (clear(t, full)) return { top: t, slim: false };
  for (const t of tops) if (clear(t, slim)) return { top: t, slim: true };
  return { top: Math.round(mid), slim: true };
}

/** Fired by the phone menu to open this panel. */
export const OPEN_ADMIN_NAV_EVENT = "knowitball:open-admin-nav";

interface AdminLink {
  name: string;
  href: string;
}

interface AdminGroup {
  label: string;
  links: AdminLink[];
}

/* Every route below is a real page under app/. Nothing invented. */
const GROUPS: AdminGroup[] = [
  {
    label: "Site",
    links: [
      { name: "Homepage", href: "/" },
      { name: "Profile", href: "/profile" },
      { name: "Patch Notes", href: "/admin/patch-notes" },
    ],
  },
  {
    label: "Admin",
    links: [
      { name: "Admin Dashboard", href: "/admin" },
      { name: "XP & Rewards", href: "/admin/xp" },
      { name: "Custom Clubs", href: "/admin/custom-clubs" },
      { name: "CL Draft", href: "/admin/cl-draft" },
      { name: "Football Data", href: "/admin/football" },
      { name: "Players", href: "/admin/football/players" },
      { name: "PL Clubs", href: "/admin/football/pl-clubs" },
      { name: "Scrape / Import", href: "/admin/football/scrape" },
    ],
  },
  {
    label: "Star Career",
    links: [
      { name: "Road to Ballon d'Or", href: "/star-dev" },
      { name: "Scenario Gallery", href: "/star-gallery-dev" },
      { name: "Play Area", href: "/star-play-dev" },
      { name: "Scenario Builder", href: "/star-scenario-dev" },
      { name: "Training Levels", href: "/star-training-dev" },
      { name: "Squad Builder", href: "/lineups" },
      { name: "Tuning", href: "/star-tuning-dev" },
      { name: "Media Lab", href: "/star-dev/media-lab" },
    ],
  },
  {
    label: "Sandboxes",
    links: [
      { name: "Match Engine", href: "/star-match-dev" },
      { name: "Dribble", href: "/star-dribble-dev" },
      { name: "Live Attack", href: "/star-attack-dev" },
      { name: "Bicycle Kick", href: "/star-bicycle-dev" },
      { name: "Draft (dev)", href: "/draft-dev" },
      { name: "Draft (dev 2)", href: "/draft-dev2" },
      { name: "Challenge Draft", href: "/draft-challenge-dev" },
      { name: "Draft Design Preview", href: "/draft/preview" },
      { name: "Profile (new)", href: "/profile-new" },
    ],
  },
];

/** Longest matching href wins, so /admin/football/players doesn't also light up /admin. */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const g of GROUPS) {
    for (const l of g.links) {
      const hit = l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(l.href + "/");
      if (hit && (best === null || l.href.length > best.length)) best = l.href;
    }
  }
  return best;
}

export default function AdminNavPanel() {
  const [open, setOpen] = useState(false);
  // createPortal needs a real document, which does not exist during SSR.
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const current = activeHref(pathname);

  // A full-screen page hides the menu, so the tab is the only way out there.
  const [immersive, setImmersive] = useState(false);
  const [spot, setSpot] = useState<TabSpot | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ADMIN_NAV_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ADMIN_NAV_EVENT, onOpen);
  }, []);
  useEffect(() => {
    const read = () => setImmersive(document.body.classList.contains("knowitball-immersive"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  // Re-place the phone tab as the page moves under it (a new picture, a
  // scroll, an opened editor) — a few times a second, like the page guide.
  useEffect(() => {
    if (!immersive) { setSpot(null); return; }
    const place = () => {
      if (window.innerWidth >= 1024) { setSpot(null); return; }
      const next = placeTab();
      setSpot((cur) => (cur && cur.top === next.top && cur.slim === next.slim ? cur : next));
    };
    place();
    const id = window.setInterval(place, 500);
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [immersive]);

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onKey]);

  if (!mounted) return null;

  return createPortal(
    <div data-admin-nav>
      {/* Edge tab — left edge, vertically centred so it clears the top-left
          hamburger and any game UI pinned to the corners. Desktop always; a
          phone only on a full-screen page, where the menu is hidden. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        style={spot ? { top: spot.top, height: TAB_H, width: spot.slim ? SLIM_W : FULL_W, transform: "none" } : undefined}
        className={`fixed left-0 top-1/2 z-[80] -translate-y-1/2 items-center justify-center gap-1.5 overflow-hidden rounded-r-lg border border-l-0 border-amber-500/40 bg-gray-950/80 py-4 text-amber-400 shadow-lg backdrop-blur transition-all hover:bg-gray-900 hover:text-amber-300 lg:flex lg:pl-1.5 lg:pr-2 ${immersive ? "flex" : "hidden"} ${
          open ? "pointer-events-none opacity-0" : "opacity-70 hover:opacity-100"
        }`}
      >
        {spot?.slim ? (
          <span className="h-full w-[3px] rounded-full bg-amber-400" />
        ) : (
          <span className="text-[10px] font-black uppercase tracking-[0.2em] [writing-mode:vertical-rl]">
            Admin
          </span>
        )}
      </button>

      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[85] bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div
        className={`fixed left-0 top-0 z-[90] flex h-full w-80 max-w-[85vw] flex-col border-r border-amber-500/30 bg-gray-950 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Admin &amp; Dev
          </span>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-gray-900"
            aria-label="Close admin menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain py-2">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="mx-4 mb-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                {group.label}
              </p>
              {group.links.map((link) => {
                const isActive = current === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`group mx-3 my-0.5 flex min-h-[40px] items-center justify-between gap-3 rounded-lg px-3 py-1.5 transition-colors lg:min-h-0 ${
                      isActive
                        ? "bg-amber-500/15 text-white"
                        : "text-white hover:bg-gray-900"
                    }`}
                  >
                    <span className="text-sm font-bold lg:whitespace-nowrap">{link.name}</span>
                    <span
                      className={`hidden shrink-0 whitespace-nowrap font-mono text-[9px] sm:inline ${
                        isActive ? "text-amber-400" : "text-gray-600 group-hover:text-gray-500"
                      }`}
                    >
                      {link.href}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-800 px-5 py-3">
          <p className="text-[10px] text-gray-500">Admin only · not public</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
