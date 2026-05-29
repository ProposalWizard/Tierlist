import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Daily Tic Tac Toe — Knowitball",
  description: "Play today's daily Football Tic Tac Toe challenge.",
  alternates: { canonical: "/tic-tac-toe/daily" },
};

export const dynamic = "force-dynamic";

export default async function DailyTicTacToePage() {
  const service = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: todayPuzzle } = await service
    .from("tictactoe_puzzles")
    .select("id")
    .eq("is_active", true)
    .eq("is_daily", true)
    .eq("daily_date", today)
    .single();

  if (todayPuzzle) {
    redirect(`/tic-tac-toe/${todayPuzzle.id}`);
  }

  const { data: latest } = await service
    .from("tictactoe_puzzles")
    .select("id, daily_date")
    .eq("is_active", true)
    .eq("is_daily", true)
    .order("daily_date", { ascending: false })
    .limit(1)
    .single();

  if (latest) {
    redirect(`/tic-tac-toe/${latest.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-black mb-2">No Daily Puzzle Yet</h1>
        <p className="text-gray-400 text-sm mb-6">Check back soon for a new daily challenge!</p>
        <Link
          href="/tic-tac-toe"
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 inline-block"
        >
          Back to Tic Tac Toe
        </Link>
      </div>
    </div>
  );
}
