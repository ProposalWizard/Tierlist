"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Props {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export default function NavMenu({ isLoggedIn, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [unclaimedCount, setUnclaimedCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/objectives/unclaimed-count")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.count) setUnclaimedCount(d.count); })
      .catch(() => {});
  }, [isLoggedIn]);

  const ProfileLink = ({ onClick }: { onClick?: () => void }) => (
    <Link
      href="/profile"
      onClick={onClick}
      className="relative rounded-lg border border-gray-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:border-gray-500"
    >
      Profile
      {unclaimedCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-1 ring-gray-950">
          {unclaimedCount > 9 ? "9+" : unclaimedCount}
        </span>
      )}
    </Link>
  );

  const MobileProfileLink = () => (
    <Link
      href="/profile"
      onClick={() => setOpen(false)}
      className="relative flex items-center px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900"
    >
      Profile
      {unclaimedCount > 0 && (
        <span className="ml-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white">
          {unclaimedCount > 9 ? "9+" : unclaimedCount}
        </span>
      )}
    </Link>
  );

  return (
    <>
      {/* Desktop right-side buttons */}
      <div className="relative">
        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-lg border border-indigo-700 px-3 py-2 text-sm font-semibold text-indigo-300 transition-colors hover:border-indigo-500 hover:text-white"
                >
                  Admin
                </Link>
              )}
              <ProfileLink />
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
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
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 text-white hover:border-gray-500 md:hidden"
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
          {unclaimedCount > 0 && !open && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-1 ring-gray-950" />
          )}
        </button>

        {/* Mobile dropdown */}
        {open && (
          <div
            className="absolute right-0 top-full z-50 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-800 bg-gray-950 shadow-xl md:hidden"
          >
            <div className="flex flex-col py-2">
              {isLoggedIn ? (
                <>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="px-4 py-2.5 text-sm font-semibold text-indigo-300 hover:bg-gray-900 hover:text-white"
                    >
                      Admin
                    </Link>
                  )}
                  <MobileProfileLink />
                  <div className="mx-4 my-1 border-t border-gray-800" />
                  <form action="/api/auth/signout" method="POST">
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-white hover:bg-gray-900"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setOpen(false)}
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
