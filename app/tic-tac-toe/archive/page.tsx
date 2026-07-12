import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Daily Archive — Football Tic Tac Toe",
  description:
    "Browse all past daily Football Tic Tac Toe puzzles and see your stats.",
  alternates: { canonical: "/tic-tac-toe/archive" },
};

export const dynamic = "force-dynamic";

interface PuzzleRow {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "extreme";
  is_daily: boolean;
  daily_date: string | null;
  created_at: string;
  row_labels: string[];
  col_labels: string[];
}

interface ScoreRow {
  puzzle_id: string;
  score: number;
  max_score: number;
  hints_used: number;
  time_seconds: number | null;
  completed_at: string;
  is_second_chance: boolean;
}

interface RatingRow {
  puzzle_id: string;
  rating: number;
}

function Stars({ rating }: { rating: number }) {
  const starPath = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z";
  return (
    <div className="flex gap-px">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = Math.min(1, Math.max(0, rating - i));
        const isHalf = filled > 0 && filled < 1;
        const isFull = filled >= 1;
        return (
          <span key={i} className="relative h-3 w-3 flex-shrink-0">
            <svg viewBox="0 0 20 20" className="absolute inset-0 h-full w-full text-gray-600" fill="currentColor">
              <path d={starPath} />
            </svg>
            {(isFull || isHalf) && (
              <span className={`absolute inset-y-0 left-0 overflow-hidden ${isHalf ? "w-1/2" : "w-full"}`}>
                <svg viewBox="0 0 20 20" className="absolute inset-0 h-3 w-3 text-amber-400" fill="currentColor">
                  <path d={starPath} />
                </svg>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function scoreColor(pct: number): string {
  if (pct >= 90) return "text-green-400";
  if (pct >= 70) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  if (pct >= 30) return "text-orange-400";
  return "text-red-400";
}

function scoreBorderColor(pct: number): string {
  if (pct >= 90) return "border-green-500/60";
  if (pct >= 70) return "border-emerald-500/40";
  if (pct >= 50) return "border-amber-500/40";
  if (pct >= 30) return "border-orange-500/40";
  return "border-red-500/40";
}

function scoreBgGlow(pct: number): string {
  if (pct >= 90) return "bg-green-500/5";
  if (pct >= 70) return "bg-emerald-500/5";
  if (pct >= 50) return "bg-amber-500/5";
  return "bg-gray-900";
}

function formatTime(s: number): string {
  if (s >= 3600) {
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function MiniGrid({
  rows,
  cols,
  played,
}: {
  rows: string[];
  cols: string[];
  played: boolean;
}) {
  return (
    <div className={`grid grid-cols-4 gap-px text-[6px] leading-tight ${played ? "opacity-30" : "opacity-20"}`}>
      {/* Top-left empty */}
      <div />
      {cols.map((c, i) => (
        <div
          key={`c${i}`}
          className="truncate text-center font-bold text-white px-0.5"
        >
          {c.slice(0, 3)}
        </div>
      ))}
      {rows.map((r, ri) => (
        <React.Fragment key={`row${ri}`}>
          <div
            className="truncate font-bold text-white text-right pr-0.5"
          >
            {r.slice(0, 3)}
          </div>
          {[0, 1, 2].map((ci) => (
            <div
              key={`${ri}-${ci}`}
              className="aspect-square rounded-[2px] border border-gray-600/50 bg-gray-800/50"
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

export default async function ArchivePage() {
  const service = createServiceClient();

  const today = new Date().toISOString().slice(0, 10);
  const { data: puzzles } = await service
    .from("tictactoe_puzzles")
    .select(
      "id, title, difficulty, is_daily, daily_date, created_at, row_labels, col_labels, display_order"
    )
    .eq("is_active", true)
    .eq("is_daily", true)
    // Hide pre-scheduled FUTURE dailies — playing tomorrow's puzzle today
    // burns the one-score-per-puzzle slot before it becomes the real daily.
    // (Dateless dailies stay visible.)
    .or(`daily_date.lte.${today},daily_date.is.null`)
    .order("display_order", { ascending: false })
    .order("daily_date", { ascending: false });

  const items: PuzzleRow[] = (puzzles ?? []) as PuzzleRow[];

  let scores: ScoreRow[] = [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const puzzleIds = items.map((p) => p.id);

  const [scoreData, ratingsData] = await Promise.all([
    user && puzzleIds.length > 0
      ? service
          .from("tictactoe_scores")
          .select("puzzle_id, score, max_score, hints_used, time_seconds, completed_at, is_second_chance")
          .eq("user_id", user.id)
          .in("puzzle_id", puzzleIds)
      : Promise.resolve({ data: [] }),
    puzzleIds.length > 0
      ? service
          .from("tictactoe_difficulty_ratings")
          .select("puzzle_id, rating")
          .in("puzzle_id", puzzleIds)
      : Promise.resolve({ data: [] }),
  ]);

  scores = (scoreData.data ?? []) as ScoreRow[];

  // Build average rating map: puzzle_id → average (rounded to nearest 0.5)
  const rawRatings = (ratingsData.data ?? []) as RatingRow[];
  const ratingAccum = new Map<string, { sum: number; count: number }>();
  for (const r of rawRatings) {
    const cur = ratingAccum.get(r.puzzle_id) ?? { sum: 0, count: 0 };
    ratingAccum.set(r.puzzle_id, { sum: cur.sum + r.rating, count: cur.count + 1 });
  }
  const avgRatingMap = new Map<string, number>();
  ratingAccum.forEach(({ sum, count }, puzzleId) => {
    const avg = sum / count;
    avgRatingMap.set(puzzleId, Math.min(5, Math.max(0.5, Math.round(avg * 2) / 2)));
  });

  const scoreMap = new Map(scores.map((s) => [s.puzzle_id, s]));

  // Aggregate stats
  const totalPlayed = scores.length;
  const totalPuzzles = items.length;
  const avgPct =
    scores.length > 0
      ? Math.round(
          scores.reduce(
            (sum, s) =>
              sum + (s.max_score > 0 ? (s.score / s.max_score) * 100 : 0),
            0
          ) / scores.length
        )
      : 0;
  const bestPct =
    scores.length > 0
      ? Math.round(
          Math.max(
            ...scores.map((s) =>
              s.max_score > 0 ? (s.score / s.max_score) * 100 : 0
            )
          )
        )
      : 0;
  const perfectCount = scores.filter(
    (s) => s.max_score > 0 && s.score >= s.max_score
  ).length;
  const totalTimeSec = scores.reduce(
    (sum, s) => sum + (s.time_seconds ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-10 text-center">
        <Link
          href="/tic-tac-toe"
          className="mb-3 inline-block text-xs font-bold text-white transition-colors hover:text-gray-300"
        >
          &larr; Back to Tic Tac Toe
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
          Daily Archive
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-white">
          Every daily challenge so far. How many have you completed?
        </p>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Stats bar */}
        {user && scores.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className="text-2xl font-black text-white">
                {totalPlayed}
                <span className="text-sm font-bold text-white">
                  {" "}
                  / {totalPuzzles}
                </span>
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-white">
                Played
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className={`text-2xl font-black ${scoreColor(avgPct)}`}>
                {avgPct}%
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-white">
                Avg Score
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className={`text-2xl font-black ${scoreColor(bestPct)}`}>
                {bestPct}%
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-white">
                Best Score
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className="text-2xl font-black text-amber-400">
                {perfectCount}
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-white">
                Perfect
              </p>
            </div>
          </div>
        )}

        {!user && (
          <div className="mb-6 rounded-xl border border-indigo-700/50 bg-indigo-900/20 p-4 text-center">
            <p className="text-sm text-indigo-300">
              <Link
                href="/auth?next=/tic-tac-toe/archive"
                className="font-bold underline hover:text-indigo-200"
              >
                Sign in
              </Link>{" "}
              to track your scores and stats.
            </p>
          </div>
        )}

        {/* Time played stat - subtle, below main stats */}
        {user && totalTimeSec > 0 && (
          <div className="mb-6 text-center">
            <span className="text-xs font-bold text-white">
              Total time played:{" "}
              <span className="font-mono text-white">
                {totalTimeSec >= 3600
                  ? `${Math.floor(totalTimeSec / 3600)}h ${Math.floor((totalTimeSec % 3600) / 60)}m`
                  : `${Math.floor(totalTimeSec / 60)}m ${totalTimeSec % 60}s`}
              </span>
            </span>
          </div>
        )}

        {/* Puzzle grid */}
        {items.length === 0 ? (
          <div className="py-24 text-center text-white">
            No puzzles available yet.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {items.map((puzzle, idx) => {
              const userScore = scoreMap.get(puzzle.id);
              const played = !!userScore;
              const pct =
                userScore && userScore.max_score > 0
                  ? Math.round(
                      (userScore.score / userScore.max_score) * 100
                    )
                  : 0;
              const avgRating = avgRatingMap.get(puzzle.id);
              const starRating = avgRating ?? { easy: 1, medium: 3, extreme: 5 }[puzzle.difficulty] ?? 3;

              return (
                <div key={puzzle.id} className="group flex flex-col">
                <Link
                  href={`/tic-tac-toe/${puzzle.id}`}
                  className="relative block"
                  title={puzzle.title}
                >
                  {/* Card */}
                  <div
                    className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                      played
                        ? `${scoreBorderColor(pct)} ${scoreBgGlow(pct)} hover:brightness-110`
                        : "border-gray-800 bg-gray-900 hover:border-gray-600 hover:bg-gray-800/80"
                    }`}
                  >
                    {/* "Played!" ribbon */}
                    {played && (
                      <div className="absolute right-0 top-0 z-10">
                        <div className="rounded-bl-lg bg-green-600 px-1.5 py-0.5 text-[9px] font-black uppercase leading-tight text-white shadow-lg sm:text-[10px]">
                          Played!
                        </div>
                      </div>
                    )}

                    {/* Daily badge */}
                    {puzzle.is_daily && (
                      <div className="absolute left-0 top-0 z-10">
                        <div className="rounded-br-lg bg-amber-600 px-1.5 py-0.5 text-[9px] font-black uppercase leading-tight text-white shadow-lg sm:text-[10px]">
                          Daily
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex h-full flex-col items-center justify-center p-2">
                      {played ? (
                        <>
                          {/* Score percentage */}
                          <span
                            className={`text-2xl font-black sm:text-3xl ${scoreColor(pct)}`}
                          >
                            {pct}%
                          </span>
                          {/* Score bar */}
                          <div className="mt-1.5 h-1 w-3/4 overflow-hidden rounded-full bg-gray-800">
                            <div
                              className={`h-full rounded-full ${
                                pct >= 90
                                  ? "bg-green-500"
                                  : pct >= 70
                                    ? "bg-emerald-500"
                                    : pct >= 50
                                      ? "bg-amber-500"
                                      : pct >= 30
                                        ? "bg-orange-500"
                                        : "bg-red-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {/* Score detail */}
                          <span className="mt-1 text-[9px] font-bold text-white sm:text-[10px]">
                            {userScore.score}/{userScore.max_score}
                          </span>
                          {/* Time */}
                          {userScore.time_seconds != null && (
                            <span className="mt-0.5 font-mono text-[8px] text-white sm:text-[9px]">
                              {formatTime(userScore.time_seconds)}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Mini grid preview */}
                          <div className="mb-2 w-full max-w-[80%]">
                            <MiniGrid
                              rows={puzzle.row_labels}
                              cols={puzzle.col_labels}
                              played={false}
                            />
                          </div>
                          {/* Question mark overlay */}
                          <span className="absolute inset-0 flex items-center justify-center text-4xl font-black text-white transition-colors group-hover:text-gray-500 sm:text-5xl">
                            ?
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Below card: stars + title */}
                  <div className="mt-1.5 flex flex-col items-center gap-0.5 px-1">
                    <Stars rating={starRating} />
                    <p className="w-full truncate text-center text-[10px] font-bold text-white group-hover:text-gray-300 sm:text-xs">
                      {puzzle.title}
                    </p>
                  </div>
                </Link>
                {played && !userScore?.is_second_chance && (
                  <a
                    href={`/tic-tac-toe/${puzzle.id}?second-chance=true`}
                    className="mt-1.5 block rounded-lg border border-amber-700/40 bg-amber-900/20 py-1 text-center text-[9px] font-bold text-amber-400 transition-colors hover:bg-amber-900/40 sm:text-[10px]"
                  >
                    ↺ Second Chance
                  </a>
                )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
