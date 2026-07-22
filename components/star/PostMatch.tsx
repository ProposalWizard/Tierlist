"use client";
import type { MatchStats } from "@/lib/star/types";

interface Props {
  stats: MatchStats;
  homeTeam: string;
  awayTeam: string;
  onContinue: () => void;
}

export default function PostMatch({ stats, homeTeam, awayTeam, onContinue }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex items-center justify-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div className="bg-gray-700 rounded-t-xl border border-gray-600 py-2 px-3 text-center border-b-0">
          <div className="text-[10px] uppercase tracking-widest font-black text-gray-400">Full Time</div>
          <div className="text-lg font-black text-white mt-0.5 truncate">{homeTeam} {stats.homeScore} — {stats.awayScore} {awayTeam}</div>
        </div>
        <div className="bg-gray-800 border-x border-gray-600 py-3 text-center">
          <div className="text-xl font-black text-white uppercase tracking-wider">Match Stats</div>
        </div>

        <div className="bg-gray-700 border-x border-b border-gray-600">
          <Row label="Chances" value={stats.chances} />
          <Row label="Goals" value={stats.goals} highlight={stats.goals > 0} />
          <Row label="Assists" value={stats.assists} highlight={stats.assists > 0} />
          <Row label="Passes" value={stats.passes} />
          <RowRating label="Match Rating" value={stats.rating} />
          <RowStar label="Wage" value={stats.wage} />
          <RowStar label="Goal Bonus" value={stats.goalBonus} />
          <RowStar label="Sponsors" value={stats.sponsorPay} />
          <div className="bg-emerald-700 py-2 px-3 flex items-center border-t border-black/30">
            <div className="font-black text-white text-sm flex-1">Total Cash</div>
            <div className="flex items-center gap-1 font-black text-white text-sm">
              <StarIcon /> {stats.totalCash}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 p-2 bg-gray-800">
            <RelChip label="Boss" delta={stats.bossChange} />
            <RelChip label="Team" delta={stats.teamChange} />
            <RelChip label="Fans" delta={stats.fansChange} />
          </div>

          <div className="p-3 flex items-center gap-2 border-t border-black/30">
            <StarIcon large />
            <div className="text-sm font-black text-white flex-1">Star Rating</div>
            {stats.starMan && (
              <div className="bg-yellow-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase">Star Man!</div>
            )}
          </div>
        </div>

        <button
          onClick={onContinue}
          className="mt-3 w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-black transition flex items-center justify-center gap-2"
        >
          Continue
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center py-2 px-3 border-b border-black/30 ${highlight ? "bg-emerald-800/40" : ""}`}>
      <div className="font-black text-xs text-white flex-1">{label}</div>
      <div className={`font-black text-sm ${highlight ? "text-emerald-300" : "text-white"}`}>{value}</div>
    </div>
  );
}
function RowRating({ label, value }: { label: string; value: number }) {
  const color = value >= 8 ? "text-emerald-300" : value >= 7 ? "text-yellow-300" : value >= 6 ? "text-white" : "text-red-400";
  return (
    <div className="flex items-center py-2 px-3 border-b border-black/30 bg-emerald-800/50">
      <div className="font-black text-xs text-white flex-1">{label}</div>
      <div className={`font-black text-lg ${color}`}>{value.toFixed(1)}</div>
    </div>
  );
}
function RowStar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center py-2 px-3 border-b border-black/30">
      <div className="font-black text-xs text-white flex-1">{label}</div>
      <div className="flex items-center gap-1 font-black text-sm text-white">
        <StarIcon /> {value}
      </div>
    </div>
  );
}
function RelChip({ label, delta }: { label: string; delta: number }) {
  const bg = delta > 0 ? "bg-emerald-600" : delta < 0 ? "bg-red-600" : "bg-gray-600";
  const sign = delta > 0 ? "+" : "";
  return (
    <div className={`${bg} rounded-lg py-1.5 text-center`}>
      <div className="text-white font-black text-xs">{label} {sign}{delta}</div>
    </div>
  );
}
function StarIcon({ large }: { large?: boolean } = {}) {
  const s = large ? 22 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
