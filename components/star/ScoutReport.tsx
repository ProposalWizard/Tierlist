"use client";
import type { ScoutReport } from "@/lib/star/scoutReport";

/** Short internal keys → what the screen actually says. */
const FACTOR_LABEL: Record<string, string> = {
  Attack: "Attacking Threat",
  Midfield: "Midfield Control",
  Defence: "Defensive Solidity",
  Depth: "Squad Depth",
  Form: "Current Form",
};

function FactorBar({ label, level, tone }: { label: string; level: number; tone: "strength" | "weakness" }) {
  const color = tone === "strength" ? "bg-emerald-400" : "bg-red-500";
  return (
    <div className="flex items-center justify-between gap-2 text-[10px]">
      <span className="text-white/85 font-bold truncate">{FACTOR_LABEL[label] ?? label}</span>
      <span className="flex gap-0.5 shrink-0">
        {[1, 2, 3].map(i => (
          <span key={i} className={`h-1.5 w-3.5 rounded-full ${i <= level ? color : "bg-white/15"}`} />
        ))}
      </span>
    </div>
  );
}

function PlayerCard({ icon, title, name, stat }: { icon: string; title: string; name: string; stat: string }) {
  return (
    <div className="flex-1 rounded-lg bg-gray-700/70 border border-gray-600 px-2 py-2 text-center min-w-0">
      <div className="text-base">{icon}</div>
      <div className="text-[9px] font-black uppercase tracking-wide text-white/60">{title}</div>
      <div className="mt-0.5 text-[11px] font-black text-white truncate" title={name}>{name}</div>
      <div className="text-[10px] font-bold text-emerald-300">{stat}</div>
    </div>
  );
}

export default function ScoutReportCard({ report }: { report: ScoutReport }) {
  const noData = !report.topScorer && !report.topAssister && !report.bestPlayer
    && report.strengths.length === 0 && report.weaknesses.length === 0;

  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Scout Report</span>
        {report.table && (
          <span className="text-[10px] font-bold text-white/70">{report.table.position}{ordinal(report.table.position)} in the table</span>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/70">
        <span>🏟️ {report.ground.name}</span>
        <span>Crowd: {report.ground.crowd.toLocaleString()}</span>
      </div>

      {noData ? (
        <div className="mt-2 text-[10px] text-white/60 text-center py-1">
          Not enough scouted on {report.club} yet.
        </div>
      ) : (
        <>
          {(report.topScorer || report.topAssister || report.bestPlayer) && (
            <div className="mt-2.5 flex gap-1.5">
              {report.topScorer && (
                <PlayerCard icon="⚽" title="Top Scorer" name={report.topScorer.name} stat={`${report.topScorer.value} goals`} />
              )}
              {report.topAssister && (
                <PlayerCard icon="🎯" title="Assist King" name={report.topAssister.name} stat={`${report.topAssister.value} assists`} />
              )}
              {report.bestPlayer && (
                <PlayerCard icon="⭐" title="Top Rated" name={report.bestPlayer.name} stat={`${report.bestPlayer.value} OVR`} />
              )}
            </div>
          )}

          {(report.strengths.length > 0 || report.weaknesses.length > 0) && (
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <div>
                <div className="text-[9px] font-black uppercase tracking-wide text-emerald-300 mb-1">Strengths</div>
                <div className="space-y-1">
                  {report.strengths.length
                    ? report.strengths.map(f => <FactorBar key={f.label} label={f.label} level={f.level} tone="strength" />)
                    : <div className="text-[10px] text-white/50">Nothing stands out</div>}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-wide text-red-400 mb-1">Weaknesses</div>
                <div className="space-y-1">
                  {report.weaknesses.length
                    ? report.weaknesses.map(f => <FactorBar key={f.label} label={f.label} level={f.level} tone="weakness" />)
                    : <div className="text-[10px] text-white/50">Nothing obvious</div>}
                </div>
              </div>
            </div>
          )}

          <div className="mt-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 text-[10px] text-emerald-100">
            💡 {report.tacticalHint}
          </div>
        </>
      )}

      {report.headToHead && (
        <div className="mt-2 text-[10px] text-white/70 text-center">
          Your record vs {report.club}: <span className="text-white font-bold">
            {report.headToHead.wins}W {report.headToHead.draws}D {report.headToHead.losses}L
          </span>
        </div>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
