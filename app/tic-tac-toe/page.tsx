import Link from "next/link";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Football Tic Tac Toe — Knowitball",
  description: "Test your football knowledge in this 3x3 grid challenge. Name players that match two conditions per square!",
  alternates: { canonical: "/tic-tac-toe" },
};

export const revalidate = 60;

interface PuzzleRow {
  id: string;
  title: string;
  difficulty: string;
  is_daily: boolean;
  daily_date: string | null;
  category: string | null;
  created_at: string;
}

export default async function TicTacToeListPage() {
  const service = createServiceClient();

  const { data: puzzles } = await service
    .from("tictactoe_puzzles")
    .select("id, title, difficulty, is_daily, daily_date, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const items: PuzzleRow[] = (puzzles ?? []) as PuzzleRow[];

  const daily = items.find((p) => p.is_daily);
  // category column may not exist until migration is run — filter safely
  const official = items.filter((p) => !p.is_daily && (p.category ?? null) !== "User Created");
  const userCreated = items.filter((p) => (p.category ?? null) === "User Created");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-10 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-700 bg-indigo-900/30 px-3 py-1 text-xs font-semibold text-indigo-300 mb-3">
          Football Tic Tac Toe
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
          Football Tic Tac Toe
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
          Name players that match two conditions per square. Score points for rare answers!
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href="/tic-tac-toe/daily"
            className="rounded-xl border border-amber-700 bg-amber-900/30 px-6 py-2.5 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-900/50"
          >
            Daily Challenges
          </Link>
          <Link
            href="/tic-tac-toe/create"
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
          >
            + Create Your Own
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Daily puzzle */}
        {daily && (
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-bold uppercase text-amber-400">Daily Challenge</h2>
            <Link
              href={`/tic-tac-toe/${daily.id}`}
              className="group block overflow-hidden rounded-xl border border-amber-700/50 bg-gradient-to-r from-amber-900/20 to-gray-900 p-6 transition-colors hover:border-amber-600"
            >
              <h3 className="text-xl font-black text-white group-hover:text-amber-300">{daily.title}</h3>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                <span className={`rounded-full px-2 py-0.5 font-bold ${
                  daily.difficulty === "easy" ? "bg-green-900/50 text-green-400" :
                  daily.difficulty === "medium" ? "bg-yellow-900/50 text-yellow-400" :
                  "bg-red-900/50 text-red-400"
                }`}>{daily.difficulty}</span>
                {daily.daily_date && <span>{daily.daily_date}</span>}
              </div>
              <div className="mt-3">
                <span className="rounded-lg bg-amber-600/20 border border-amber-700/50 px-4 py-1.5 text-sm font-bold text-amber-400">
                  Play Now
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Official puzzles */}
        {official.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-bold uppercase text-gray-400">All Puzzles</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {official.map((p) => (
                <Link
                  key={p.id}
                  href={`/tic-tac-toe/${p.id}`}
                  className="group rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-indigo-600 hover:bg-gray-800/50"
                >
                  <h3 className="font-bold text-white group-hover:text-indigo-300">{p.title}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <span className={`rounded-full px-2 py-0.5 font-bold ${
                      p.difficulty === "easy" ? "bg-green-900/50 text-green-400" :
                      p.difficulty === "medium" ? "bg-yellow-900/50 text-yellow-400" :
                      "bg-red-900/50 text-red-400"
                    }`}>{p.difficulty}</span>
                  </div>
                  <div className="mt-3">
                    <span className="rounded-lg bg-indigo-600/20 border border-indigo-700/50 px-3 py-1 text-xs font-semibold text-indigo-400">
                      Play
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* User-created puzzles */}
        {userCreated.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-bold uppercase text-purple-400">User Created</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {userCreated.map((p) => (
                <Link
                  key={p.id}
                  href={`/tic-tac-toe/${p.id}`}
                  className="group rounded-xl border border-purple-800/50 bg-gray-900 p-5 transition-colors hover:border-purple-600 hover:bg-gray-800/50"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white group-hover:text-purple-300">{p.title}</h3>
                    <span className="rounded bg-purple-900/50 px-1.5 py-0.5 text-[10px] font-bold text-purple-400">
                      Community
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <span className={`rounded-full px-2 py-0.5 font-bold ${
                      p.difficulty === "easy" ? "bg-green-900/50 text-green-400" :
                      p.difficulty === "medium" ? "bg-yellow-900/50 text-yellow-400" :
                      "bg-red-900/50 text-red-400"
                    }`}>{p.difficulty}</span>
                  </div>
                  <div className="mt-3">
                    <span className="rounded-lg bg-purple-600/20 border border-purple-700/50 px-3 py-1 text-xs font-semibold text-purple-400">
                      Play
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="py-24 text-center text-gray-500">
            No puzzles available yet. Be the first to create one!
          </div>
        )}
      </main>
    </div>
  );
}
