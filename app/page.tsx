import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Knowitball — Football Games & Challenges",
  description:
    "Tierlists, blind rankings, tic tac toe and more football games. Test your knowledge and compete with friends.",
  alternates: { canonical: "/" },
};

const games = [
  { name: "Tierlists", href: "/tierlists" },
  { name: "Draft", href: "/draft" },
  { name: "Tic Tac Toe", href: "/tic-tac-toe" },
  { name: "Ten-A-Ball", href: "/tenable" },
  { name: "Blind Rank", href: "/blind-rankings" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 text-white relative">
      {/* Objectives badge */}
      <Link
        href="/profile"
        className="fixed top-20 right-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-900/40 transition-all hover:scale-105 active:scale-95"
      >
        <span className="text-xs font-black text-white">Objectives</span>
        <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[9px] font-black text-white uppercase tracking-wider">New</span>
      </Link>
      <h1 className="text-5xl font-black tracking-tight md:text-7xl">
        KNOWITBALL
      </h1>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        {games.map((game) => (
          <Link
            key={game.href}
            href={game.href}
            className="text-lg font-bold text-white transition-colors hover:text-white md:text-xl"
          >
            {game.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
