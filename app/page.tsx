import Link from "next/link";
import type { Metadata } from "next";
import ObjectivesToast from "@/components/ObjectivesToast";

export const metadata: Metadata = {
  title: "Knowitball — Football Games & Challenges",
  description:
    "Tierlists, blind rankings, tic tac toe and more football games. Test your knowledge and compete with friends.",
  alternates: { canonical: "/" },
};

const games = [
  { name: "Draft", href: "/draft" },
  { name: "Tic Tac Toe", href: "/tic-tac-toe" },
  { name: "Ten-A-Ball", href: "/tenable" },
  { name: "Rankings", href: "/tierlists" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 text-white relative">
      <ObjectivesToast />
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

      {/* Requested directly: this hero row had its own separate, hardcoded
          four-game list (never imported NavGameLinks, so it silently drifted
          from the site-wide nav the moment Road to Ballon d'Or was added
          there) — given its own centered line below the rest, with the same
          Beta pill the top nav already uses for it. */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        <Link
          href="/star-dev"
          className="text-lg font-bold text-white transition-colors hover:text-white md:text-xl"
        >
          Road to Ballon d&apos;Or
        </Link>
        <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400">
          Beta
        </span>
      </div>
    </div>
  );
}
