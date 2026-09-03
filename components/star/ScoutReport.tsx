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

/**
 * Every card is themed by the role it's scouting — and, since the user's
 * own designed template art, backed by a real frame image per role:
 * public/star/scout/{scorer,assist,rated}-frame.png. Each is a portrait
 * card with a circular photo cutout (genuinely transparent — alpha 0, not
 * just a dark fill) and a glow underline, measured directly off the
 * uploaded files rather than eyeballed:
 *   - circle centre ≈ 50% across, ≈ 21.5% down; diameter ≈ 42% of width
 *   - glow underline ≈ 44% down
 *   - a dotted texture band starts ≈ 70% down, reserved for the stat boxes
 * All three templates measured within a percentage point of each other, so
 * one shared geometry (CARD_GEOM below) works for all three roles. The
 * player photo is a separate, lower layer positioned at that same circle —
 * the template's cutout is what actually makes it read as "in" the frame.
 */
const ROLE_THEME: Record<"scorer" | "assist" | "rated", { icon: string; label: string; accent: string; soft: string; frame: string }> = {
  scorer: { icon: "⚽", label: "Top Scorer", accent: "#38bdf8", soft: "rgba(56,189,248,0.16)", frame: "/star/scout/scorer-frame.png" },
  assist: { icon: "🎯", label: "Assist King", accent: "#fb7185", soft: "rgba(251,113,133,0.16)", frame: "/star/scout/assist-frame.png" },
  rated: { icon: "⭐", label: "Top Rated", accent: "#fbbf24", soft: "rgba(251,191,36,0.16)", frame: "/star/scout/rated-frame.png" },
};

/**
 * All fractions of the card's own width/height — see the doc comment above.
 * The circle's own bottom edge sits at ~35% and the glow underline at
 * ~44%: that ~9%-tall gap is real but too tight for the label to sit in
 * (its glow bleeds a few points further down than the hard alpha=0 edge,
 * so text placed right under the circle visually collides with it) — the
 * label/name/stat block instead sits as one group in the roomy gap BELOW
 * the underline (44% down to the ~70%-down dotted band), which is what
 * the underline is actually for: a divider between the photo and the
 * text, not a rule the text sits flush above.
 */
const CARD_GEOM = {
  aspect: "536 / 814",
  circle: { cx: 50, cy: 21.5, diameter: 42 },
  labelTop: 47,
  nameTop: 52.5,
  statTop: 58.5,
  boxesTop: 74,
};

/**
 * A scouted player, as a card — the user's own template art as the frame,
 * with the photo, label, name, stat line and recent-form boxes laid over it
 * at the measured positions in CARD_GEOM.
 */
function PlayerCard({ role, player }: { role: "scorer" | "assist" | "rated"; player: ScoutPlayer }) {
  const theme = ROLE_THEME[role];
  const g = CARD_GEOM;

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden rounded-xl" style={{ aspectRatio: g.aspect }}>
      {/* The photo sits BELOW the frame — the frame's circle is a real
          transparent cutout, so it shows through exactly there. */}
      <ImageWithFallback
        src={player.image || SILHOUETTE_SRC}
        fallbackSrc={SILHOUETTE_SRC}
        alt=""
        className="absolute rounded-full object-cover"
        style={{
          left: `${g.circle.cx}%`, top: `${g.circle.cy}%`,
          width: `${g.circle.diameter}%`, aspectRatio: "1 / 1",
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* The template itself — frame, glow ring, underline, dotted band. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={theme.frame} alt="" className="pointer-events-none absolute inset-0 h-full w-full" />

      <div
        className="absolute flex items-center justify-center gap-1 text-[8px] font-black uppercase tracking-wide"
        style={{ top: `${g.labelTop}%`, left: 0, right: 0, color: theme.accent }}
      >
        <span>{theme.icon}</span><span className="truncate">{theme.label}</span>
      </div>

      <div
        className="absolute px-2 text-center text-[12px] font-black text-white truncate"
        style={{ top: `${g.nameTop}%`, left: 0, right: 0 }}
        title={player.name}
      >
        {player.name}
      </div>

      <div
        className="absolute px-2 text-center text-[9px] font-bold truncate"
        style={{ top: `${g.statTop}%`, left: 0, right: 0, color: theme.accent }}
      >
        {theme.icon} {player.value}{role === "rated" ? " OVR" : ""} · {player.position}
      </div>

      {/* The three boxes from the template's dotted band — recent-form
          indicators: did they score/assist in each of the last few league
          games. The top-rated card has no single relevant per-match event
          to track (see ScoutPlayer.form's own doc comment), so it gets no
          boxes at all rather than three that can never mean anything. */}
      {player.form && (
        <div
          className="absolute flex justify-center gap-1.5 px-3"
          style={{ top: `${g.boxesTop}%`, left: 0, right: 0 }}
        >
          {player.form.slice(0, 3).map((did, i) => (
            <span
              key={i}
              className="grid aspect-square flex-1 place-items-center rounded-md border text-[11px]"
              style={{
                borderColor: did ? theme.accent : "rgba(255,255,255,0.15)",
                background: did ? theme.soft : "rgba(255,255,255,0.04)",
              }}
            >
              {did ? theme.icon : ""}
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
