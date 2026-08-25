"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LIVE_GAMES = [
  { name: "Draft", href: "/draft" },
  { name: "Tic Tac Toe", href: "/tic-tac-toe" },
  { name: "Ten-A-Ball", href: "/tenable" },
  { name: "Rankings", href: "/tierlists" },
  { name: "Road to the Ballon d'Or", href: "/star-dev", beta: true },
];

/** Same amber pill used everywhere else a live-but-unfinished game is marked
 *  — see GameSidebar.tsx and app/admin/page.tsx. */
function BetaBadge() {
  return (
    <span className="rounded-full bg-amber-500/20 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-400">
      Beta
    </span>
  );
}

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
              className={`flex flex-shrink-0 items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-purple-700/40 text-purple-300"
                  : "text-white hover:bg-gray-800/70"
              }`}
            >
              {g.name}
              {g.beta && <BetaBadge />}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-0.5 overflow-x-auto w-full" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
      {LIVE_GAMES.map(g => {
        const isActive = pathname === g.href || pathname.startsWith(g.href + "/");
        return (
          <Link
            key={g.href}
            href={g.href}
            className={`flex flex-shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
              isActive
                ? "bg-purple-700/40 text-purple-300"
                : "text-white hover:bg-gray-800/70"
            }`}
          >
            {g.name}
            {g.beta && <BetaBadge />}
          </Link>
        );
      })}
    </div>
  );
}
