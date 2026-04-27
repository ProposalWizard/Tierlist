"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TIERLIST_PATHS = ["/", "/find", "/play", "/vote", "/create"];

function isTierlistPage(path: string) {
  return TIERLIST_PATHS.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")));
}

interface Props {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export default function NavMenu({ isLoggedIn, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const showTierlistLinks = isTierlistPage(pathname);

  return (
    <>
      {/* Desktop center links — only on tierlist pages */}
      {showTierlistLinks && (
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-3 md:flex">
          <Link
            href="/find"
            className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:text-white"
          >
            Find a Tierlist
          </Link>
          {isLoggedIn && (
            <Link
              href="/create"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              + Create
            </Link>
          )}
        </div>
      )}

      {/* Desktop right-side buttons */}
      <div className="relative">
        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn ? (
            <>
              {isAdmin && (
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

        {/* Mobile hamburger button */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Mobile dropdown */}
        {open && (
          <div
            className="absolute right-0 top-full z-50 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-800 bg-gray-950 shadow-xl md:hidden"
            onClick={() => setOpen(false)}
          >
            <div className="flex flex-col py-2">
              {showTierlistLinks && (
                <>
                  <Link
                    href="/find"
                    className="px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-900 hover:text-white"
                  >
                    Find a Tierlist
                  </Link>
                  {isLoggedIn && (
                    <Link
                      href="/create"
                      className="px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-900 hover:text-white"
                    >
                      + Create Tierlist
                    </Link>
                  )}
                </>
              )}
              {isLoggedIn ? (
                <>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="px-4 py-2.5 text-sm font-semibold text-indigo-300 hover:bg-gray-900 hover:text-white"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    className="px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-900 hover:text-white"
                  >
                    Profile
                  </Link>
                  <div className="mx-4 my-1 border-t border-gray-800" />
                  <form action="/api/auth/signout" method="POST">
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-400 hover:bg-gray-900 hover:text-white"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/auth"
                  className="mx-3 my-2 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
