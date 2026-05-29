import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Football Tic Tac Toe — Knowitball",
  description: "Test your football knowledge in this 3x3 grid challenge. Name players that match two conditions per square!",
  alternates: { canonical: "/tic-tac-toe" },
};

export default function TicTacToeMainPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-700 bg-indigo-900/30 px-3 py-1 text-xs font-semibold text-indigo-300 mb-4">
          Football Tic Tac Toe
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl mb-3">
          Football Tic Tac Toe
        </h1>
        <p className="mx-auto max-w-sm text-sm text-gray-400 mb-10">
          Name players that match two conditions per square. Score points for rare answers!
        </p>

        <div className="space-y-4">
          <Link
            href="/tic-tac-toe/daily"
            className="group block w-full rounded-2xl border-2 border-amber-700 bg-gradient-to-r from-amber-900/30 to-amber-800/10 p-6 transition-all hover:border-amber-500 hover:from-amber-900/50 hover:to-amber-800/20"
          >
            <div className="text-2xl font-black text-amber-300 group-hover:text-amber-200">
              Daily
            </div>
            <p className="mt-1 text-sm text-amber-400/70">
              A new challenge every day
            </p>
          </Link>

          <Link
            href="/tic-tac-toe/easy"
            className="group block w-full rounded-2xl border-2 border-green-700 bg-gradient-to-r from-green-900/30 to-green-800/10 p-6 transition-all hover:border-green-500 hover:from-green-900/50 hover:to-green-800/20"
          >
            <div className="text-2xl font-black text-green-300 group-hover:text-green-200">
              Easy
            </div>
            <p className="mt-1 text-sm text-green-400/70">
              Jump into a random easy puzzle
            </p>
          </Link>

          <Link
            href="/tic-tac-toe/archive"
            className="group block w-full rounded-2xl border-2 border-gray-700 bg-gradient-to-r from-gray-800/50 to-gray-800/20 p-6 transition-all hover:border-gray-500 hover:from-gray-800/70 hover:to-gray-800/40"
          >
            <div className="text-2xl font-black text-gray-300 group-hover:text-white">
              Past Dailies
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Browse the archive and see your stats
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
