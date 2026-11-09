/**
 * components/GlobalNav.tsx
 * Persistent top navigation bar rendered in the root layout.
 * Server component that reads nothing from the request: who is signed in, and
 * whether they are an admin, is asked by the browser (NavAccount.tsx). It used
 * to ask the server here, which made EVERY page build per visit (Mikey, 6 Nov
 * 2026: the site ran out of Vercel's free server time).
 * Mobile hamburger menu is handled by the NavMenu client component.
 */

import Link from "next/link";
import GameSidebar from "./GameSidebar";
import NavGameLinks from "./NavGameLinks";
import NavAccount, { NavAdminTools } from "./NavAccount";

export default function GlobalNav() {
  return (
    <nav data-global-chrome className="relative sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <div className="relative mx-auto flex items-center max-w-7xl px-4 py-3 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <GameSidebar />
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            KNOWITBALL
          </Link>
        </div>
        <div className="flex-1 min-w-0">
          <NavGameLinks />
        </div>
        <div className="shrink-0">
          {/* A guest (lib/guest/config.ts) still sees "Sign in". */}
          <NavAccount />
        </div>
      </div>
      <NavGameLinks mobile />
      {/* Admin-only slide-out for every admin page and dev sandbox, and the
          Team room's chat bubble (Harry, 19 Oct 2026). Both portal into <body>,
          so they stay reachable on immersive pages where this <nav> itself is
          display:none. A local dev build shows them to everyone (never the
          live site). */}
      <NavAdminTools />
    </nav>
  );
}
