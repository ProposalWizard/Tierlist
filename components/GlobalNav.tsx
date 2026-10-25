/**
 * components/GlobalNav.tsx
 * Persistent top navigation bar rendered in the root layout.
 * Server component — fetches auth user and admin status.
 * Mobile hamburger menu is handled by the NavMenu client component.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import NavMenu from "./NavMenu";
import GameSidebar from "./GameSidebar";
import NavGameLinks from "./NavGameLinks";
import AdminNavPanel from "./AdminNavPanel";
import ChatBubble from "./teamRoom/ChatBubble";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";

export default async function GlobalNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userIsAdmin = user ? await isAdmin(user.id) : false;

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
          <NavMenu isLoggedIn={!!user && user.is_anonymous !== true} isAdmin={userIsAdmin} />
        </div>
      </div>
      <NavGameLinks mobile />
      {/* Admin-only slide-out for every admin page and dev sandbox. Rendered
          here because this is where the server-side isAdmin() answer already
          lives — but it portals everything into <body>, so it stays reachable
          on immersive pages where this <nav> itself is display:none. */}
      {/* A local dev build shows it to everyone, like AdminOnly (never the live site). */}
      {(userIsAdmin || offlineDevPlayEnabled()) && <AdminNavPanel />}
      {/* The Team room's chat bubble (Harry, 19 Oct 2026): admin and test pages only, portaled the same way. */}
      {(userIsAdmin || offlineDevPlayEnabled()) && <ChatBubble />}
    </nav>
  );
}
