/**
 * components/GlobalNav.tsx
 * Persistent top navigation bar rendered in the root layout.
 * Server component — fetches auth user and admin status.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export default async function GlobalNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userIsAdmin = user ? await isAdmin(user.id) : false;

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Tierlist Maker
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/find"
            className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:text-white"
          >
            Find a Tierlist
          </Link>

          {user ? (
            <>
              {userIsAdmin && (
                <Link
                  href="/admin"
                  className="rounded-lg border border-indigo-700 px-3 py-2 text-xs font-semibold text-indigo-300 transition-colors hover:border-indigo-500 hover:text-white"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/profile"
                className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
              >
                Profile
              </Link>
              <Link
                href="/create"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                + Create Tierlist
              </Link>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
