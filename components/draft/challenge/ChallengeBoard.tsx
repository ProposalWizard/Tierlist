"use client";
import DraftPlayerCard from "@/components/draft/american/DraftPlayerCard";
import type { AmPlayer } from "@/lib/americanDraft";
import { matchedPosition } from "@/lib/challengeDraft";
import type { Brief } from "@/lib/challengeDraft";

/** Accent per brief kind, so a round reads at a glance. */
const KIND_ACCENT: Record<string, string> = {
  rating: "#06b6d4",
  stat: "#f59e0b",
  nation: "#22c55e",
  position: "#3b82f6",
  club: "#a855f7",
  era: "#ec4899",
  age: "#14b8a6",
  wildcard: "#ffffff",
};

const KIND_LABEL: Record<string, string> = {
  rating: "Rating band",
  stat: "Attribute",
  nation: "Nationality",
  position: "Position",
  club: "Club",
  era: "Era",
  age: "Age",
  wildcard: "Wildcard",
};

interface Props {
  brief: Brief;
  round: number;
  totalRounds: number;
  players: AmPlayer[];
  picks: { brief: Brief; player: AmPlayer }[];
  loading: boolean;
  error: string | null;
  onPick: (sofifaId: string) => void | Promise<void>;
  onRestart: () => void;
  /** Cards this round should hold — drives the loading skeleton. */
  boardSize: number;
}

export default function ChallengeBoard({
  brief, round, totalRounds, players, picks, loading, error, onPick, onRestart, boardSize,
}: Props) {
  const accent = KIND_ACCENT[brief.kind] ?? "#06b6d4";

  return (
    <div className="min-h-screen bg-[#060d1a] flex flex-col lg:flex-row">
      {/* ── Sidebar: the brief, then your squad so far ── */}
      <aside className="lg:w-64 xl:w-72 shrink-0 bg-[#07101f] border-b lg:border-b-0 lg:border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold tracking-widest text-white/70 uppercase">
              Round {round + 1} of {totalRounds}
            </span>
            <span
              className="text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded border"
              style={{ color: accent, borderColor: `${accent}55`, background: `${accent}14` }}
            >
              {KIND_LABEL[brief.kind] ?? brief.kind}
            </span>
          </div>

          <div
            className="text-xl font-black uppercase italic leading-none mb-1.5"
            style={{ color: accent }}
          >
            {brief.title}
          </div>
          <p className="text-[11px] text-white/85 leading-snug">{brief.detail}</p>

          <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(round / totalRounds) * 100}%`,
                background: "linear-gradient(90deg,#0d9488,#06b6d4)",
              }}
            />
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-[9px] font-bold tracking-widest text-white/70 uppercase mb-2.5">
            Your squad ({picks.length})
          </div>
          {picks.length === 0 ? (
            <p className="text-[11px] text-white/70">Nothing drafted yet.</p>
          ) : (
            <div className="space-y-1.5">
              {picks.map(({ brief: b, player }, i) => (
                <div key={`${player.sofifa_id}-${i}`} className="flex items-center gap-2">
                  <span className="w-4 text-[9px] font-black text-white/75 tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-white truncate leading-tight">
                      {player.name}
                    </div>
                    <div className="text-[9px] text-white/75 truncate leading-tight">
                      {matchedPosition(b, player.positions)
                        ?? (player.positions || "").split(",")[0]?.trim()} · {b.title}
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-emerald-400 tabular-nums">
                    {player.ovr}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/[0.06]">
          <button
            onClick={onRestart}
            className="w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/85 border border-white/15 hover:text-white hover:border-white/25 transition-colors"
          >
            Restart draft
          </button>
        </div>
      </aside>

      {/* ── Board ── */}
      <main className="flex-1 flex flex-col min-h-0">
        <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] bg-[#07101f]">
          <span className="text-sm font-black text-white uppercase italic tracking-tight">
            Pick one
          </span>
          <span className="ml-2 text-[11px] text-white/75">
            {players.length} available
          </span>
        </div>

        {error && (
          <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-center">
            <span className="text-red-400 text-xs font-semibold">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
              {Array.from({ length: boardSize }, (_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.05] aspect-[3/4] animate-pulse"
                  style={{ background: "linear-gradient(180deg,#0d1a2b 0%,#08121f 100%)" }}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
              {players.map(p => (
                <DraftPlayerCard
                  key={`${p.sofifa_id}-${p.fifa_year}`}
                  player={p}
                  canPick
                  onPick={onPick}
                  slotPosition="ANY"
                  displayPosition={matchedPosition(brief, p.positions)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
