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

export default async function GlobalNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userIsAdmin = user ? await isAdmin(user.id) : false;

  return (
    <nav className="relative sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <div className="relative mx-auto grid max-w-7xl grid-cols-3 items-center px-4 py-3">
        <div className="flex items-center gap-2">
          <GameSidebar />
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            KNOWITBALL
          </Link>
        </div>
        <div className="flex justify-center">
          <NavGameLinks />
        </div>
        <div className="flex justify-end">
          <NavMenu isLoggedIn={!!user} isAdmin={userIsAdmin} />
        </div>
      </div>
      <NavGameLinks mobile />
    </nav>
  );
}
