"use client";
import { useEffect, useState } from "react";
import type { CareerState } from "@/lib/star/types";

interface Props {
  career: CareerState;
  onContinue: (userWon: boolean) => void;
}

interface Nominee {
  name: string;
  club: string;
  score: number;
  isUser: boolean;
}

export default function BallonDor({ career, onContinue }: Props) {
  const [reveal, setReveal] = useState(0);
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Compute user's Ballon d'Or score
    const avgRating = career.seasonStats.ratingCount > 0
      ? career.seasonStats.totalRating / career.seasonStats.ratingCount
      : 6;
    const userScore =
      career.seasonStats.goals * 4 +
      career.seasonStats.assists * 2 +
      avgRating * 10 +
      career.seasonStats.starMan * 3;

    // Fetch top FC26 PL players
    fetch("/api/draft/clubs")
      .then((r) => r.json())
      .then(async (d: { clubs: { name: string; seasons: number[] }[] }) => {
        const clubs = (d.clubs ?? []).filter((c) => c.seasons.includes(2026)).slice(0, 8);
        // Grab a top player from each club
        const results = await Promise.all(
          clubs.map(async (c) => {
            try {
              const r = await fetch(`/api/draft/roster?club=${encodeURIComponent(c.name)}&year=2026`);
              if (!r.ok) return null;
              const data = await r.json();
              const top = (data.roster ?? []).sort((a: { overall: number }, b: { overall: number }) => b.overall - a.overall)[0];
              if (!top) return null;
              // Give them a "season score" based on their overall + slight randomness
              const base = top.overall - 55;
              const noise = (Math.random() - 0.5) * 20;
              return {
                name: top.name as string,
                club: c.name,
                score: base * 4 + noise,
                isUser: false,
              };
            } catch { return null; }
          })
        );
        const pool: Nominee[] = results.filter((n): n is Nominee => n !== null);
        pool.push({
          name: `${career.player.firstName} ${career.player.lastName}`,
          club: career.player.club,
          score: userScore,
          isUser: true,
        });
        pool.sort((a, b) => b.score - a.score);
        setNominees(pool.slice(0, 5));
        setLoading(false);
      })
      .catch(() => {
        setNominees([{
          name: `${career.player.firstName} ${career.player.lastName}`,
          club: career.player.club,
          score: userScore,
          isUser: true,
        }]);
        setLoading(false);
      });
  }, [career]);

  useEffect(() => {
    if (loading || nominees.length === 0) return;
    if (reveal >= nominees.length) return;
    const t = setTimeout(() => setReveal((r) => r + 1), 1500);
    return () => clearTimeout(t);
  }, [reveal, nominees, loading]);

  const winner = nominees[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-yellow-950 to-black text-white flex flex-col items-center py-4 px-3 relative overflow-hidden">
      {/* Sparkle overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{
        background: "radial-gradient(circle at 20% 30%, rgba(251,191,36,0.15) 0%, transparent 40%), radial-gradient(circle at 80% 60%, rgba(251,191,36,0.15) 0%, transparent 40%)",
      }} />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-4">
          <div className="inline-block px-6 py-1 rounded-full border-2 border-yellow-500 text-yellow-300 text-[10px] font-black tracking-[0.3em] uppercase">
            Ceremony
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-yellow-300 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]">
            Ballon d&apos;Or
          </h1>
          <div className="text-yellow-500 text-xs font-bold mt-1">Season {career.season}</div>
        </div>

        {loading && <div className="text-center py-12 text-yellow-300">Preparing nominees...</div>}

        {!loading && (
          <>
            {/* Winner reveal */}
            {reveal >= nominees.length && winner && (
              <div className="bg-gradient-to-b from-yellow-500 to-yellow-700 border-4 border-yellow-300 rounded-2xl p-5 text-center shadow-[0_0_40px_rgba(251,191,36,0.6)] mb-4">
                <div className="text-xs font-black text-black tracking-widest uppercase">🏆 Winner 🏆</div>
                <div className="text-2xl font-black text-black mt-2">{winner.name}</div>
                <div className="text-sm font-black text-black/80 mt-1">{winner.club}</div>
                {winner.isUser && (
                  <div className="mt-3 py-2 bg-black/30 rounded-lg text-white font-black text-lg">
                    YOU WIN THE BALLON D&apos;OR!
                  </div>
                )}
              </div>
            )}

            {/* Nominees list bottom-up */}
            <div className="bg-gray-900/70 border border-yellow-800 rounded-xl overflow-hidden backdrop-blur">
              <div className="bg-yellow-900/50 px-3 py-1 text-yellow-300 text-[10px] font-black uppercase tracking-widest text-center">
                Top 5 Nominees
              </div>
              {nominees.slice().reverse().map((n, i) => {
                const rank = nominees.length - i;
                const revealed = reveal > (nominees.length - rank);
                return (
                  <div
                    key={`${n.name}-${rank}`}
                    className={`flex items-center gap-2 py-2 px-3 border-t border-yellow-900/30 transition-opacity duration-500 ${
                      revealed ? "opacity-100" : "opacity-20"
                    } ${n.isUser ? "bg-emerald-800/40" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                      rank === 1 ? "bg-yellow-400 text-black" :
                      rank === 2 ? "bg-gray-300 text-black" :
                      rank === 3 ? "bg-yellow-700 text-white" :
                      "bg-gray-700 text-white"
                    }`}>
                      {rank}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-sm text-white truncate">{revealed ? n.name : "???"}</div>
                      <div className="text-[10px] text-gray-400 truncate">{revealed ? n.club : ""}</div>
                    </div>
                    {revealed && (
                      <div className="font-black text-yellow-300 text-sm">{Math.round(n.score)}</div>
                    )}
                    {n.isUser && (
                      <div className="ml-1 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded">YOU</div>
                    )}
                  </div>
                );
              })}
            </div>

            {reveal >= nominees.length && (
              <button
                onClick={() => onContinue(winner?.isUser ?? false)}
                className="mt-4 w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-xl font-black transition hover:from-yellow-400"
              >
                Continue to Next Season →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
