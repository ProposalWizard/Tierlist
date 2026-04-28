import Link from "next/link";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Knowitball — Football Games & Challenges",
  description:
    "Tierlists, blind rankings, tic tac toe and more football games. Test your knowledge and compete with friends.",
  alternates: { canonical: "/" },
};

export const revalidate = 60;

interface GameMode {
  name: string;
  description: string;
  href: string;
  color: string;
  borderColor: string;
  hoverBorder: string;
  badgeClass: string;
  icon: string;
  stat?: string;
}

export default async function HomePage() {
  const service = createServiceClient();

  const [tierlistRes, blindRes, tttRes] = await Promise.all([
    service.from("tierlists").select("id", { count: "exact", head: true }),
    service.from("blind_rankings").select("id", { count: "exact", head: true }).eq("is_active", true),
    service.from("tictactoe_puzzles").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const games: GameMode[] = [
    {
      name: "Tierlists",
      description: "Drag and drop players into S, A, B, C, D tiers. Create your own or play community tierlists.",
      href: "/tierlists",
      color: "from-indigo-600/20 to-gray-900",
      borderColor: "border-indigo-800/50",
      hoverBorder: "hover:border-indigo-500",
      badgeClass: "bg-indigo-900/50 text-indigo-300 border-indigo-700",
      icon: "🏆",
      stat: `${tierlistRes.count ?? 0} tierlists`,
    },
    {
      name: "Blind Rankings",
      description: "Players appear one at a time — rank them without knowing who's coming next.",
      href: "/blind-rankings",
      color: "from-amber-600/20 to-gray-900",
      borderColor: "border-amber-800/50",
      hoverBorder: "hover:border-amber-500",
      badgeClass: "bg-amber-900/50 text-amber-300 border-amber-700",
      icon: "🎯",
      stat: `${blindRes.count ?? 0} rankings`,
    },
    {
      name: "Football Tic Tac Toe",
      description: "Name players that match two conditions per square. Score points for rare answers!",
      href: "/tic-tac-toe",
      color: "from-purple-600/20 to-gray-900",
      borderColor: "border-purple-800/50",
      hoverBorder: "hover:border-purple-500",
      badgeClass: "bg-purple-900/50 text-purple-300 border-purple-700",
      icon: "❌⭕",
      stat: `${tttRes.count ?? 0} puzzles`,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-16 text-center">
        <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
          Knowitball
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-gray-400">
          Football games, challenges, and community rankings. Pick a game and test your knowledge.
        </p>
      </div>

      {/* Game cards */}
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link
              key={game.href}
              href={game.href}
              className={`group flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b ${game.color} ${game.borderColor} ${game.hoverBorder} transition-all hover:shadow-lg hover:shadow-gray-900/50`}
            >
              <div className="flex flex-1 flex-col p-6">
                <span className="text-4xl">{game.icon}</span>
                <h2 className="mt-4 text-xl font-black text-white group-hover:text-gray-100">
                  {game.name}
                </h2>
                <p className="mt-2 flex-1 text-sm text-gray-400">
                  {game.description}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${game.badgeClass}`}>
                    {game.stat}
                  </span>
                  <span className="text-sm font-bold text-gray-500 transition-colors group-hover:text-white">
                    Play →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
