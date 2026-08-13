"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import type { BDCareer } from "@/lib/ballonDorTypes";
import { computeLegacy, legacyTierMeta } from "@/lib/ballonDorEngine";

interface Props {
  career: BDCareer;
  onNewCareer: () => void;
}

export default function BDLegacy({ career, onNewCareer }: Props) {
  const legacy = useMemo(() => computeLegacy(career), [career]);
  const meta = legacyTierMeta(legacy.tier);
  const player = career.player;
  const isDefOrGK = player.position === 'GK' || player.position === 'DEF';

  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!shareRef.current || sharing) return;
    setSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: "#030712",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `ballon-dor-legacy-${player.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      const text = `${player.name} retires a ${legacy.tier} — ${legacy.bdoWins}× Ballon d'Or, ${legacy.seasonsPlayed} seasons, Legacy score ${legacy.score.toLocaleString()}. 🏅`;
      const url = typeof window !== "undefined" ? window.location.href : "";
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        "_blank",
      );
    } catch (err) {
      console.error("Legacy share failed:", err);
    } finally {
      setSharing(false);
    }
  }, [sharing, player.name, legacy]);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-900 px-4 py-3">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <a href="/" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition">
            <span>←</span> Back to KnowItBall
          </a>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">Career Legacy</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 space-y-4">
        {/* Shareable card */}
        <div ref={shareRef} className="rounded-2xl border border-gray-800 bg-gray-950 p-6 space-y-5">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-gray-500 mb-2">Career Complete</p>
            <div className="flex items-center justify-center gap-3">
              {player.imageUrl && (
                <img src={player.imageUrl} alt={player.name} className="h-12 w-12 rounded-full object-cover border-2 border-gray-700" />
              )}
              <h1 className="text-2xl font-black text-white">{player.name}</h1>
            </div>
            <p className="text-xs text-gray-500 mt-1">{player.position} · Retired at {player.age}</p>
          </div>

          {/* Tier badge */}
          <div className="text-center py-3">
            <div
              className="inline-flex flex-col items-center gap-1 rounded-2xl border px-8 py-4"
              style={{ borderColor: meta.color + '66', background: meta.color + '18' }}
            >
              <span className="text-3xl font-black tracking-tight" style={{ color: meta.color }}>{legacy.tier}</span>
              <span className="text-sm font-black text-white">{legacy.score.toLocaleString()} <span className="text-gray-500 font-semibold">Legacy</span></span>
            </div>
            <p className="mt-3 text-xs text-gray-400 leading-relaxed">{meta.blurb}</p>
          </div>

          {/* Totals grid */}
          <div className="grid grid-cols-3 gap-2">
            <LegacyStat label="Seasons" value={legacy.seasonsPlayed} />
            <LegacyStat label="Ballon d'Ors" value={legacy.bdoWins} gold />
            <LegacyStat label="Podiums" value={legacy.podiums} />
            <LegacyStat label={isDefOrGK ? 'Clean Sheets' : 'Goals'} value={isDefOrGK ? legacy.totalCleanSheets : legacy.totalGoals} />
            <LegacyStat label="Assists" value={legacy.totalAssists} />
            <LegacyStat label="Peak OVR" value={legacy.peakOverall} />
          </div>

          {legacy.bdoWinYears.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-1">Ballon d'Or Wins</p>
              <p className="text-sm font-black text-amber-300">{legacy.bdoWinYears.join(' · ')}</p>
            </div>
          )}

          {legacy.trophies.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Honours</p>
              <div className="flex flex-wrap gap-1.5">
                {legacy.trophies.map(t => (
                  <span key={t.name} className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-400">
                    {t.emoji} {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {legacy.bestSeason && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Best Season</p>
              <p className="text-sm font-black text-white">
                Season {legacy.bestSeason.number} · {legacy.bestSeason.year} · {legacy.bestSeason.club}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {isDefOrGK
                  ? `${legacy.bestSeason.cleanSheets} clean sheets`
                  : `${legacy.bestSeason.goals}G · ${legacy.bestSeason.assists}A`}
                {' · '}Rating {legacy.bestSeason.rating.toFixed(1)}
                {legacy.bestSeason.bdoRank === 1 ? ' · 🥇 Ballon d\'Or'
                  : legacy.bestSeason.bdoRank > 0 ? ` · BdO #${legacy.bestSeason.bdoRank}` : ''}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Clubs</p>
            <p className="text-xs text-gray-400">{legacy.clubs.join(' · ')}</p>
          </div>
        </div>

        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-full rounded-xl border border-gray-700 bg-gray-900 py-3.5 text-sm font-bold text-white transition hover:border-gray-500 hover:bg-gray-800 disabled:opacity-50"
        >
          {sharing ? 'Preparing image…' : '📸 Share your legacy'}
        </button>

        <button
          onClick={onNewCareer}
          className="w-full rounded-2xl bg-amber-500 py-4 text-sm font-black text-black transition hover:bg-amber-400"
        >
          Start New Career →
        </button>
      </div>
    </div>
  );
}

function LegacyStat({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 text-center">
      <p className={`text-xl font-black ${gold ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
