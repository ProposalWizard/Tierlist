"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface GameLink {
  name: string;
  description: string;
  href: string;
  comingSoon?: boolean;
}

const GAMES: GameLink[] = [
  { name: "Home",                description: "Browse all games & news",                 href: "/"           },
  { name: "Tierlists",           description: "Create & play drag-and-drop tierlists",    href: "/tierlists"  },
  { name: "PL Draft",            description: "Build a dream XI from random FIFA rosters", href: "/draft"     },
  { name: "Ten-A-Ball",          description: "Football trivia — ten questions, ten lives", href: "/tenable"  },
  { name: "Football Tic Tac Toe",description: "Pick players to fill the grid",            href: "/tic-tac-toe"},
  { name: "Blind Rankings",      description: "Rank players without knowing who's next",   href: "/blind-rankings" },
  { name: "Ballon d'Or",         description: "Live a career and win the world's greatest award", href: "/ballon-dor" },
];

const COMING_SOON: GameLink[] = [
  { name: "Player Ratings",description: "Rate and compare players",                         href: "#", comingSoon: true },
  { name: "Squad Builder", description: "Build and share your ultimate squad",              href: "#", comingSoon: true },
];

export default function GameSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors hover:text-white"
        aria-label="Open game menu"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {createPortal(
        <>
          {/* Overlay */}
          <div
            className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
            onClick={() => setOpen(false)}
          />

          {/* Sidebar */}
          <div
            className={`fixed left-0 top-0 z-[70] flex h-full w-80 flex-col bg-gray-950 border-r border-gray-800 shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Knowitball Games
              </span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:text-white"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Game list */}
            <nav className="flex-1 overflow-y-auto overscroll-contain py-2">
              {/* Live games */}
              <p className="mx-4 mb-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-600">Games</p>
              {GAMES.map((game) => {
                const isActive = pathname === game.href || (game.href !== "/" && pathname.startsWith(game.href));
                return (
                  <Link
                    key={game.href}
                    href={game.href}
                    className={`group mx-3 my-0.5 block rounded-lg px-3 py-3 transition-colors ${
                      isActive
                        ? "bg-purple-900/30 text-white"
                        : "text-white hover:bg-gray-900 hover:text-white"
                    }`}
                  >
                    <span className="text-sm font-bold">{game.name}</span>
                    <p className={`mt-0.5 text-xs ${isActive ? "text-purple-300" : "text-gray-400 group-hover:text-gray-300"}`}>
                      {game.description}
                    </p>
                  </Link>
                );
              })}

              {/* Coming soon */}
              <div className="mx-4 my-3 border-t border-gray-800/60" />
              <p className="mx-4 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-600">Coming Soon</p>
              {COMING_SOON.map((game) => (
                <div
                  key={game.name}
                  className="mx-3 my-0.5 rounded-lg px-3 py-3 opacity-40 cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{game.name}</span>
                    <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      Soon
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{game.description}</p>
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-gray-800 px-5 py-4">
              <p className="text-[10px] text-white">knowitball.co.uk</p>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
