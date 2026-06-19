"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LIVE_GAMES = [
  { name: "Tierlists", href: "/tierlists" },
  { name: "PL Draft", href: "/draft" },
  { name: "Tic Tac Toe", href: "/tic-tac-toe" },
  { name: "Ten-A-Ball", href: "/tenable" },
  { name: "Blind Rankings", href: "/blind-rankings" },
];

export default function NavGameLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <div
        className="md:hidden flex overflow-x-auto border-t border-gray-800/60 px-3 py-1.5 gap-1"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {LIVE_GAMES.map(g => {
          const isActive = pathname === g.href || pathname.startsWith(g.href + "/");
          return (
            <Link
              key={g.href}
              href={g.href}
              className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-purple-700/40 text-purple-300"
                  : "text-gray-300 hover:text-white hover:bg-gray-800/70"
              }`}
            >
              {g.name}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-0.5">
      {LIVE_GAMES.map(g => {
        const isActive = pathname === g.href || pathname.startsWith(g.href + "/");
        return (
          <Link
            key={g.href}
            href={g.href}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              isActive
                ? "bg-purple-700/40 text-purple-300"
                : "text-gray-400 hover:text-white hover:bg-gray-800/70"
            }`}
          >
            {g.name}
          </Link>
        );
      })}
    </div>
  );
}
