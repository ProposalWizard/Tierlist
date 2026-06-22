"use client";
import { useState } from "react";
import Link from "next/link";

export default function TicTacToeMainPage() {
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-700 bg-indigo-900/30 px-3 py-1 text-xs font-semibold text-indigo-300 mb-4">
          Football Tic Tac Toe
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl mb-3">
          Football Tic Tac Toe
        </h1>
        <p className="mx-auto max-w-sm text-sm text-white mb-4">
          Name players that match two conditions per square. Score points for rare answers!
        </p>

        <button
          onClick={() => setShowHowToPlay(true)}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-white hover:text-white hover:border-gray-500 transition-colors mb-6"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How to Play
        </button>

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
            <div className="text-2xl font-black text-white group-hover:text-white">
              Daily Archive
            </div>
            <p className="mt-1 text-sm text-white">
              Browse the archive and see your stats
            </p>
          </Link>
        </div>
      </div>

      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowHowToPlay(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900 rounded-t-2xl">
              <h2 className="text-base font-black text-white">How to Play</h2>
              <button onClick={() => setShowHowToPlay(false)} className="text-white hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-5 text-sm text-white">
              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">The Grid</h3>
                <p>You&apos;re given a 3x3 grid. Each row and column has a label — a club, nationality, league, or category. Name a player that matches BOTH the row and column labels for each square.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Scoring</h3>
                <p>Earn points for each correct answer. Rarer players score more points. Fill all 9 squares for a bonus.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">No Repeats</h3>
                <p>You can&apos;t use the same player in more than one square.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">2 Player Mode</h3>
                <p>Take turns naming players. Get three in a row for a bonus. Most points wins.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Tips</h3>
                <ul className="space-y-1 list-disc list-inside text-white">
                  <li>Think of obscure players for higher scores.</li>
                  <li>Plan ahead so you don&apos;t waste key players.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
