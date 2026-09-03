"use client";
import type { ScoutReport, ScoutPlayer } from "@/lib/star/scoutReport";
import { SILHOUETTE_SRC } from "@/lib/silhouette";
import ImageWithFallback from "@/components/ImageWithFallback";
import { kitsOf, labelInk } from "@/lib/star/kits";
import { initials } from "@/components/star/ClubCrest";

const RESULT_BG: Record<"W" | "D" | "L", string> = { W: "#16a34a", D: "#b98a1f", L: "#b91c1c" };

/** A club, as a small circular badge only — no name label underneath, for a
 *  row that already prints the club name as text beside it (recent form,
 *  the table snippet). Same "shirt with initials" device as ClubCrest,
 *  just without its bundled name row. */
function MiniCrest({ club, size = 16 }: { club: string; size?: number }) {
  const kit = kitsOf(club).home;
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full border font-black"
      style={{
        height: size, width: size, backgroundColor: kit.shirt, borderColor: kit.trim,
        color: labelInk(kit.shirt), fontSize: Math.max(6, Math.round(size * 0.32)),
      }}
    >
      {initials(club)}
    </div>
  );
}

/** Every card is themed by the role it's scouting — matches the reference
 *  concept's blue / rose / gold split so the three read as distinct at a
 *  glance even before a photo fills the frame in. */
const ROLE_THEME: Record<"scorer" | "assist" | "rated", { icon: string; label: string; accent: string; soft: string }> = {
  scorer: { icon: "⚽", label: "Top Scorer", accent: "#38bdf8", soft: "rgba(56,189,248,0.16)" },
  assist: { icon: "🎯", label: "Assist King", accent: "#fb7185", soft: "rgba(251,113,133,0.16)" },
  rated: { icon: "⭐", label: "Top Rated", accent: "#fbbf24", soft: "rgba(251,191,36,0.16)" },
};

/**
 * A scouted player, as a card.
 *
 * The top of the card — everything inside the image frame — is the part
 * meant to eventually carry a designed portrait per role (see `player.image`):
 * this component reserves the frame, themes it, and vignettes it so it reads
 * as a real card even filled with just the silhouette placeholder. Swap a
 * real image in per player and nothing else here needs to change; it's drawn
 * with `object-fit: cover` against a fixed frame, so a portrait cropped
 * roughly 4:5 (taller than wide, like the reference cards) will fill it
 * cleanly.
 */
function PlayerCard({ role, player }: { role: "scorer" | "assist" | "rated"; player: ScoutPlayer }) {
  const theme = ROLE_THEME[role];
  const headline = role === "scorer" ? `⚽ ${player.value} Goal${player.value === 1 ? "" : "s"}`
    : role === "assist" ? `🎯 ${player.value} Assist${player.value === 1 ? "" : "s"}`
      : `⭐ ${player.value} OVR`;

  return (
    <div
      className="flex-1 min-w-0 overflow-hidden rounded-xl border bg-gray-900/80"
      style={{ borderColor: `${theme.accent}80`, boxShadow: `0 0 14px -6px ${theme.accent}` }}
    >
      <div
        className="flex items-center gap-1 px-1.5 py-1 text-[8px] font-black uppercase tracking-wide"
        style={{ background: theme.soft, color: theme.accent }}
      >
        <span>{theme.icon}</span><span className="truncate">{theme.label}</span>
      </div>

      {/* The image frame — see the doc comment above for the shape a real
          portrait should arrive in. */}
      <div className="relative h-24 w-full" style={{ background: `linear-gradient(160deg, ${theme.soft}, rgba(3,7,18,0.9))` }}>
        <ImageWithFallback
          src={player.image || SILHOUETTE_SRC}
          fallbackSrc={SILHOUETTE_SRC}
          alt=""
          className="h-full w-full object-cover object-top"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-gray-950/95 to-transparent" />
      </div>

      <div className="px-2 pt-1.5 pb-2 text-center">
        <div className="text-[11px] font-black text-white truncate" title={player.name}>{player.name}</div>
        <div className="mt-0.5 text-[9px] font-bold truncate" style={{ color: theme.accent }}>
          {headline} · {player.position}
        </div>

        <div className="mt-1.5 grid grid-cols-3 gap-1 border-t border-white/10 pt-1.5">
          <Stat label="GLS" value={player.goals} />
          <Stat label="AST" value={player.assists} />
          <Stat label="OVR" value={player.overall} />
        </div>

        {player.form && player.form.length > 0 && (
          <div className="mt-1.5 flex justify-center gap-0.5">
            {player.form.map((did, i) => (
              <span
                key={i}
                className={`grid h-3.5 w-3.5 place-items-center rounded-sm text-[8px] ${did ? "" : "bg-white/5"}`}
                style={did ? { background: theme.soft, color: theme.accent } : undefined}
              >
                {did ? (role === "assist" ? "🎯" : "⚽") : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[7px] font-bold uppercase tracking-wide text-white/45">{label}</div>
      <div className="text-[11px] font-black text-white tabular-nums">{value}</div>
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
          <span className="text-[10px] font-bold text-white/90">{report.table.position}{ordinal(report.table.position)} in the table</span>
        )}
      </div>

      {noPlayerData ? (
        <div className="mt-2 text-[10px] text-white/60 text-center py-1">
          Not enough scouted on {report.club} yet.
        </div>
      ) : (
        <div className="mt-2.5 flex gap-1.5">
          {report.topScorer && <PlayerCard role="scorer" player={report.topScorer} />}
          {report.topAssister && <PlayerCard role="assist" player={report.topAssister} />}
          {report.bestPlayer && <PlayerCard role="rated" player={report.bestPlayer} />}
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div>
          <div className="text-[9px] font-black uppercase tracking-wide text-emerald-300/90 mb-1">Recent Form</div>
          {report.recentResults.length ? (
            <div className="space-y-1">
              {[...report.recentResults].reverse().map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-md px-1 py-1 text-[9px]"
                  style={{ background: `${RESULT_BG[r.result]}26`, boxShadow: `inset 2px 0 0 0 ${RESULT_BG[r.result]}` }}
                >
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded text-[8px] font-black text-white"
                    style={{ background: RESULT_BG[r.result] }}
                  >
                    {r.result}
                  </span>
                  <MiniCrest club={r.opponent} />
                  <span className="text-white truncate">
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
          <div className="text-[9px] font-black uppercase tracking-wide text-emerald-300/90 mb-1">League Table</div>
          {report.tableSnippet.length ? (
            <div className="space-y-0.5">
              {report.tableSnippet.map(row => (
                <div
                  key={row.club}
                  className={`flex items-center gap-1 rounded-md px-1 py-1 text-[9px] ${
                    row.isOpponent ? "bg-emerald-500 text-gray-950 font-black shadow-[0_0_10px_-2px_rgba(16,185,129,0.9)]" : "text-white/90"}`}
                >
                  <span className="w-3.5 shrink-0 tabular-nums">{row.position}</span>
                  <MiniCrest club={row.club} size={14} />
                  <span className="flex-1 truncate">{row.club}</span>
                  <span className={`tabular-nums font-bold ${row.isOpponent ? "" : "text-emerald-300"}`}>{row.points}pts</span>
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
