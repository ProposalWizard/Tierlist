import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Daily Tic Tac Toe — Knowitball",
  description: "Play today's daily Football Tic Tac Toe or catch up on ones you missed.",
  alternates: { canonical: "/tic-tac-toe/daily" },
};

export const revalidate = 60;

interface DailyPuzzle {
  id: string;
  title: string;
  difficulty: string;
  daily_date: string | null;
}

interface ScoreRow {
  puzzle_id: string;
  score: number;
  max_score: number;
  hints_used: number;
  time_seconds: number | null;
}

export default async function DailyTicTacToePage() {
  const service = createServiceClient();

  const { data: puzzles } = await service
    .from("tictactoe_puzzles")
    .select("id, title, difficulty, daily_date")
    .eq("is_active", true)
    .eq("is_daily", true)
    .order("daily_date", { ascending: false });

  const items: DailyPuzzle[] = (puzzles ?? []) as DailyPuzzle[];

  let scores: ScoreRow[] = [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user && items.length > 0) {
    const puzzleIds = items.map((p) => p.id);
    const { data: scoreData } = await service
      .from("tictactoe_scores")
      .select("puzzle_id, score, max_score, hints_used, time_seconds")
      .eq("user_id", user.id)
      .in("puzzle_id", puzzleIds);
    scores = (scoreData ?? []) as ScoreRow[];
  }

  const scoreMap = new Map(scores.map((s) => [s.puzzle_id, s]));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-10 text-center">
        <Link
          href="/tic-tac-toe"
          className="mb-3 inline-block text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Back to Tic Tac Toe
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
          Daily Tic Tac Toe
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
          A new challenge every day. Play today&apos;s or catch up on ones you missed.
        </p>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {!user && (
          <div className="mb-6 rounded-xl border border-indigo-700/50 bg-indigo-900/20 p-4 text-center">
            <p className="text-sm text-indigo-300">
              <Link href="/auth?next=/tic-tac-toe/daily" className="font-bold underline hover:text-indigo-200">
                Sign in
              </Link>{" "}
              to track your scores across daily challenges.
            </p>
          </div>
        )}

        {items.length === 0 ? (
          <div className="py-24 text-center text-gray-500">
            No daily challenges available yet. Check back soon!
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((puzzle, idx) => {
              const userScore = scoreMap.get(puzzle.id);
              const played = !!userScore;
              const pct = userScore && userScore.max_score > 0
                ? Math.round((userScore.score / userScore.max_score) * 100)
                : 0;

              return (
                <Link
                  key={puzzle.id}
                  href={`/tic-tac-toe/${puzzle.id}`}
                  className={`group flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                    played
                      ? "border-gray-700 bg-gray-900 hover:border-gray-600"
                      : "border-indigo-700/50 bg-gradient-to-r from-indigo-900/20 to-gray-900 hover:border-indigo-600"
                  }`}
                >
                  {/* Number */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-sm font-black text-gray-400">
                    {idx + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${played ? "text-gray-300" : "text-white"}`}>
                      {puzzle.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      {puzzle.daily_date && <span>{puzzle.daily_date}</span>}
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${
                          puzzle.difficulty === "easy"
                            ? "bg-green-900/50 text-green-400"
                            : puzzle.difficulty === "medium"
                            ? "bg-yellow-900/50 text-yellow-400"
                            : "bg-red-900/50 text-red-400"
                        }`}
                      >
                        {puzzle.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Score / Status */}
                  <div className="shrink-0 text-right">
                    {played ? (
                      <div>
                        <p className="text-lg font-black text-white">
                          {userScore.score}
                          <span className="text-gray-500 text-sm"> / {userScore.max_score}</span>
                        </p>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-bold text-gray-500">{pct}%</span>
                          {userScore.time_seconds != null && (
                            <span className="text-xs font-mono font-bold text-indigo-400">
                              {userScore.time_seconds >= 3600
                                ? `${Math.floor(userScore.time_seconds / 3600)}:${String(Math.floor((userScore.time_seconds % 3600) / 60)).padStart(2, "0")}:${String(userScore.time_seconds % 60).padStart(2, "0")}`
                                : `${Math.floor(userScore.time_seconds / 60)}:${String(userScore.time_seconds % 60).padStart(2, "0")}`}
                            </span>
                          )}
                          {userScore.hints_used > 0 && (
                            <span className="text-xs font-bold text-amber-400">
                              {userScore.hints_used} hint{userScore.hints_used !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="rounded-lg bg-indigo-600/20 border border-indigo-700/50 px-3 py-1.5 text-xs font-bold text-indigo-400 group-hover:bg-indigo-600/30">
                        Play
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
