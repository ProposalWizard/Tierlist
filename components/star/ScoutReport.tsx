"use client";
import type { ScoutReport, ScoutPlayer } from "@/lib/star/scoutReport";
import { SILHOUETTE_SRC } from "@/lib/silhouette";
import ImageWithFallback from "@/components/ImageWithFallback";

const RESULT_BG: Record<"W" | "D" | "L", string> = { W: "#16a34a", D: "#b98a1f", L: "#b91c1c" };

function PlayerCard({ icon, title, statIcon, player }: { icon: string; title: string; statIcon: string; player: ScoutPlayer }) {
  return (
    <div className="flex-1 rounded-lg bg-gray-700/70 border border-gray-600 px-2 py-2 text-center min-w-0">
      <ImageWithFallback
        src={player.image || SILHOUETTE_SRC}
        fallbackSrc={SILHOUETTE_SRC}
        alt=""
        className="mx-auto h-11 w-11 rounded-full bg-white/10 object-cover border border-white/10"
      />
      <div className="mt-1 text-[9px] font-black uppercase tracking-wide text-white/60">{icon} {title}</div>
      <div className="mt-0.5 text-[11px] font-black text-white truncate" title={player.name}>{player.name}</div>
      <div className="text-[10px] font-bold text-emerald-300">
        {statIcon} {player.value}{title === "Top Rated" ? " OVR" : ""} · {player.position}
      </div>
      {player.form && player.form.length > 0 && (
        <div className="mt-1 flex justify-center gap-0.5">
          {player.form.map((did, i) => (
            <span key={i} className={`grid h-3.5 w-3.5 place-items-center rounded-sm text-[8px] ${did ? "bg-emerald-500/30" : "bg-white/5"}`}>
              {did ? statIcon : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScoutReportCard({ report }: { report: ScoutReport }) {
  const noPlayerData = !report.topScorer && !report.topAssister && !report.bestPlayer;

  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Scout Report</span>
        {report.table && (
          <span className="text-[10px] font-bold text-white/70">{report.table.position}{ordinal(report.table.position)} in the table</span>
        )}
      </div>

      {noPlayerData ? (
        <div className="mt-2 text-[10px] text-white/60 text-center py-1">
          Not enough scouted on {report.club} yet.
        </div>
      ) : (
        <div className="mt-2.5 flex gap-1.5">
          {report.topScorer && <PlayerCard icon="⚽" statIcon="⚽" title="Top Scorer" player={report.topScorer} />}
          {report.topAssister && <PlayerCard icon="🎯" statIcon="🎯" title="Assist King" player={report.topAssister} />}
          {report.bestPlayer && <PlayerCard icon="⭐" statIcon="⭐" title="Top Rated" player={report.bestPlayer} />}
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div>
          <div className="text-[9px] font-black uppercase tracking-wide text-white/60 mb-1">Recent Form</div>
          {report.recentResults.length ? (
            <div className="space-y-1">
              {[...report.recentResults].reverse().map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[9px]">
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded text-[8px] font-black text-white"
                    style={{ background: RESULT_BG[r.result] }}
                  >
                    {r.result}
                  </span>
                  <span className="text-white/80 truncate">
                    {r.scoreFor}-{r.scoreAgainst} vs {r.opponent}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-white/50">No games played yet</div>
          )}
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-wide text-white/60 mb-1">League Table</div>
          {report.tableSnippet.length ? (
            <div className="space-y-0.5">
              {report.tableSnippet.map(row => (
                <div
                  key={row.club}
                  className={`flex items-center gap-1 text-[9px] rounded px-1 py-0.5 ${row.isOpponent ? "bg-emerald-500/20 text-emerald-200 font-black" : "text-white/70"}`}
                >
                  <span className="w-3.5 shrink-0 tabular-nums">{row.position}</span>
                  <span className="flex-1 truncate">{row.club}</span>
                  <span className="tabular-nums">{row.points}pts</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-white/50">Not in your division</div>
          )}
        </div>
      </div>

      {report.headToHead && (
        <div className="mt-2.5 text-[10px] text-white/70 text-center">
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
