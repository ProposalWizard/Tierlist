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

  // ── Multiplayer. Omitted entirely in the solo sandbox. ──
  /** Draft order for THIS round, already snaked. */
  pickOrder?: string[];
  currentPickIdx?: number;
  /** userId → display name. */
  names?: Record<string, string>;
  /** userId → their most recent pick, shown under their name. */
  lastPick?: Record<string, { name: string; image_url: string | null }>;
  /** This client's user id, so it can tell whose turn it is. */
  userId?: string;
  /** Seconds left on the current turn; null when there is no clock. */
  secondsLeft?: number | null;
  /** True while this client's own pick is in flight. */
  locked?: boolean;
}

export default function ChallengeBoard({
  brief, round, totalRounds, players, picks, loading, error, onPick, onRestart, boardSize,
  pickOrder, currentPickIdx = 0, names = {}, lastPick = {}, userId, secondsLeft, locked,
}: Props) {
  const accent = KIND_ACCENT[brief.kind] ?? "#06b6d4";

  // Solo when there is no order to show. Everything below branches on this
  // rather than on a separate mode flag, so the sandbox and a real room share
  // one board.
  const multiplayer = !!pickOrder && pickOrder.length > 0;
  const currentPickerId = multiplayer ? pickOrder![currentPickIdx] : undefined;
  const isMyPick = !multiplayer || currentPickerId === userId;
  const canPick = isMyPick && !locked;

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

          {multiplayer && secondsLeft !== null && secondsLeft !== undefined && (
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-black tabular-nums leading-none ${
                  secondsLeft <= 10 ? "text-red-400" : "text-white"
                }`}
                aria-live={secondsLeft <= 10 ? "polite" : "off"}
              >
                {secondsLeft}s
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/75">
                {secondsLeft === 0 ? "auto-picking" : isMyPick ? "your pick" : "on the clock"}
              </span>
            </div>
          )}

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

        {multiplayer && (
          <div className="p-4 border-b border-white/[0.06]">
            <div className="text-[9px] font-bold tracking-widest text-white/70 uppercase mb-2.5">
              Pick order
            </div>
            <div className="flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0 lg:overflow-visible">
              {pickOrder!.map((uid, idx) => {
                const isCurrent = idx === currentPickIdx;
                const hasPicked = idx < currentPickIdx;
                const isMe = uid === userId;
                const theirLast = lastPick[uid];
                return (
                  <div
                    key={uid}
                    className={`shrink-0 min-w-[140px] lg:min-w-0 rounded-xl p-2 border transition-all ${
                      isCurrent
                        ? "border-cyan-400/40 bg-cyan-400/[0.08]"
                        : hasPicked
                          ? "border-white/[0.05] bg-white/[0.02] opacity-70"
                          : "border-white/[0.06] bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black ${
                        isCurrent ? "bg-cyan-500 text-white" : "bg-white/10 text-white/85"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-bold truncate leading-tight ${isMe ? "text-cyan-300" : "text-white"}`}>
                          {names[uid] ?? "Player"}{isMe ? " (You)" : ""}
                        </div>
                        <div className="text-[9px] leading-tight">
                          {isCurrent ? (
                            <span className="text-cyan-400 font-bold">Picking now…</span>
                          ) : hasPicked ? (
                            <span className="text-emerald-400">Picked</span>
                          ) : (
                            <span className="text-white/75">Waiting</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {theirLast && (
                      <div className="mt-1.5 flex items-center gap-1.5 pl-7">
                        {theirLast.image_url && (
                          <img
                            src={theirLast.image_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-4 h-4 rounded-full object-cover shrink-0"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        )}
                        <span className="text-[9px] text-white/75 truncate">{theirLast.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            {!multiplayer || isMyPick
              ? (locked ? "Confirming…" : "Pick one")
              : `${names[currentPickerId!] ?? "Player"} is picking`}
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
                  canPick={canPick}
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
