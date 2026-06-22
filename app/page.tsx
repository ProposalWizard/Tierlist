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
  { name: "Blind Rankings", href: "/blind-rankings" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 text-white">
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
