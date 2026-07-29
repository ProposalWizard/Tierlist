"use client";
import { useState } from "react";
import { POSITION_LABELS } from "@/lib/americanDraft";
import { getFlagUrl } from "@/lib/nationalities";
import type { AmRoom, AmParticipant, AmPlayer } from "@/lib/americanDraft";

const SILHOUETTE_SRC = "/84eaf89921b5683f425ebabcb7983508-Photoroom.png";

interface Props {
  room: AmRoom;
  participants: AmParticipant[];
  userId: string;
  onPick: (sofifaId: string) => Promise<void>;
}

// Position accent colors — used for the diagonal streak overlay and the
// small position label at top-right of each card. Deliberately kept as
// hex so we can compose gradients and alpha values from them.
const POS_ACCENT: Record<string, string> = {
  GK: "#facc15",   RB: "#3b82f6",  RWB: "#3b82f6",
  CB: "#3b82f6",   LB: "#3b82f6",  LWB: "#3b82f6",
  CDM: "#22c55e",  CM: "#22c55e",  CAM: "#22c55e",
  RM: "#22c55e",   LM: "#22c55e",
  RW: "#ef4444",   LW: "#ef4444",  ST: "#ef4444",  CF: "#ef4444",
  ANY: "#a855f7",
};

const POS_TEXT: Record<string, string> = {
  GK: "text-yellow-400", RB: "text-blue-400", RWB: "text-blue-400",
  CB: "text-blue-400", LB: "text-blue-400", LWB: "text-blue-400",
  CDM: "text-green-400", CM: "text-green-400", CAM: "text-green-400",
  RM: "text-green-400", LM: "text-green-400",
  RW: "text-red-400", LW: "text-red-400", ST: "text-red-400", CF: "text-red-400",
  ANY: "text-purple-400",
};

// OVR is styled as a clean bright number over a subtle dark chip — the
// tier color leaks through as a soft text glow rather than a solid pill.
function ovrTextColor(ovr: number): string {
  if (ovr >= 85) return "text-amber-400";
  if (ovr >= 80) return "text-emerald-400";
  if (ovr >= 75) return "text-sky-400";
  return "text-gray-300";
}

function PlayerCard({
  player, canPick, onPick, slotPosition,
}: {
  player: AmPlayer;
  canPick: boolean;
  onPick: (id: string) => void;
  slotPosition: string;
}) {
  const [picking, setPicking] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [clubLogoFailed, setClubLogoFailed] = useState(false);
  const [flagFailed, setFlagFailed] = useState(false);

  async function handlePick() {
    if (picking || !canPick) return;
    setPicking(true);
    await onPick(player.sofifa_id);
    setPicking(false);
  }

  const accent = POS_ACCENT[slotPosition] || "#64748b";
  const badgeLabel = slotPosition === "ANY" ? "SUB" : slotPosition;
  const showImage = !!player.image_url && !imgFailed;
  const showClubLogo = !!player.club_logo_url && !clubLogoFailed;
  const flagUrl = getFlagUrl(player.nationality);
  const showFlag = !!flagUrl && !flagFailed;

  return (
    <div
      onClick={canPick ? handlePick : undefined}
      className={`relative rounded-2xl overflow-hidden border flex flex-col aspect-[3/4] transition-all duration-150 select-none ${
        canPick
          ? "border-white/10 hover:border-cyan-400/50 hover:shadow-[0_0_24px_rgba(6,182,212,0.20)] cursor-pointer active:scale-[0.98]"
          : "border-white/[0.05] opacity-60"
      }`}
      style={{ background: "linear-gradient(180deg,#0d1a2b 0%,#08121f 100%)" }}
    >
      {/* ── Image area — top two-thirds ── */}
      <div className="relative flex-[2] overflow-hidden">
        {/* Two subtle diagonal streaks in the position color — spaced out,
            not a repeating pattern. */}
        <div
          className="absolute -right-4 top-4 h-40 w-24 rotate-[35deg] rounded-full blur-2xl opacity-25 pointer-events-none"
          style={{ background: accent }}
        />
        <div
          className="absolute right-1 top-8 h-24 w-[2px] rotate-[35deg] opacity-40 pointer-events-none"
          style={{ background: accent }}
        />
        <div
          className="absolute right-4 top-2 h-16 w-[1px] rotate-[35deg] opacity-25 pointer-events-none"
          style={{ background: accent }}
        />

        {/* Player face — sits on the bottom of the image area so head + shoulders read naturally */}
        {showImage ? (
          <img
            src={player.image_url!}
            alt={player.name}
            referrerPolicy="no-referrer"
            className="absolute inset-x-0 bottom-0 w-full h-full object-contain object-bottom"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <img
            src={SILHOUETTE_SRC}
            alt=""
            className="absolute inset-x-0 bottom-0 w-full h-full object-contain object-bottom opacity-45"
          />
        )}

        {/* OVR — clean big number, no chunky pill */}
        <div className={`absolute top-2 left-2.5 ${ovrTextColor(player.ovr)} text-xl sm:text-2xl font-black leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tabular-nums`}>
          {player.ovr}
        </div>

        {/* Position — clean bold text with a thin outlined chip */}
        <div
          className="absolute top-2 right-2 text-[11px] font-black uppercase tracking-wider leading-none px-1.5 py-1 rounded-md border"
          style={{
            color: accent,
            borderColor: `${accent}66`,
            background: "rgba(0,0,0,0.35)",
          }}
        >
          {badgeLabel}
        </div>
      </div>

      {/* ── Info + pick — bottom third ── */}
      <div className="relative flex-1 px-2.5 pt-1.5 pb-2 flex flex-col justify-between border-t border-white/[0.04]">
        <div>
          <div className="text-[13px] font-black text-white leading-tight line-clamp-1">
            {player.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400 leading-tight">
            {showClubLogo ? (
              <img
                src={player.club_logo_url!}
                alt=""
                className="w-3.5 h-3.5 shrink-0 object-contain"
                onError={() => setClubLogoFailed(true)}
              />
            ) : (
              <span className="w-3.5 h-3.5 shrink-0 inline-block rounded-full bg-white/[0.06]" />
            )}
            <span className="truncate flex-1">{player.club}</span>
            {showFlag && (
              <img
                src={flagUrl!}
                alt=""
                className="w-3.5 h-2.5 shrink-0 rounded-[1px] object-cover"
                onError={() => setFlagFailed(true)}
              />
            )}
          </div>
        </div>

        {canPick && (
          <button
            onClick={e => { e.stopPropagation(); handlePick(); }}
            disabled={picking}
            className="mt-1.5 w-full py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}
          >
            {picking ? "…" : "PICK"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AmericanDraftRoom({ room, participants, userId, onPick }: Props) {
  const pickOrder = room.pick_order;
  const currentPickerId = pickOrder[room.current_pick_idx];
  const isMyTurn = currentPickerId === userId;
  const currentPosition = room.position_sequence[room.current_round] || "ANY";
  const posLabel = POSITION_LABELS[currentPosition] || currentPosition;
  const currentPicker = participants.find(p => p.user_id === currentPickerId);
  const totalRounds = room.position_sequence.length;
  const picksLeft = room.round_players.length;

  const posTextColor = POS_TEXT[currentPosition] || "text-cyan-400";

  return (
    <div className="min-h-screen bg-[#060d1a] flex flex-col lg:flex-row">
      {/* ── Sidebar ── */}
      <aside className="lg:w-60 xl:w-64 shrink-0 bg-[#07101f] border-b lg:border-b-0 lg:border-r border-white/[0.06] flex flex-col">
        {/* Round header */}
        <div className="p-3 lg:p-4 border-b border-white/[0.06]">
          <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-0.5">
            Round {room.current_round + 1} of {totalRounds}
          </div>
          <div className={`text-base font-black uppercase italic leading-none ${posTextColor}`}>
            {posLabel}
          </div>
          <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(room.current_round / totalRounds) * 100}%`,
                background: "linear-gradient(90deg,#0d9488,#06b6d4)",
              }}
            />
          </div>
        </div>

        {/* Pick order */}
        <div className="p-3 lg:p-4 flex-1">
          <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-2.5">Pick Order</div>
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0 lg:overflow-visible">
            {pickOrder.map((uid, idx) => {
              const p = participants.find(x => x.user_id === uid);
              if (!p) return null;
              const hasPicked = idx < room.current_pick_idx;
              const isCurrent = idx === room.current_pick_idx;
              const isMe = uid === userId;

              return (
                <div
                  key={uid}
                  className={`shrink-0 lg:shrink-0 min-w-[140px] lg:min-w-0 rounded-xl p-2 lg:p-2.5 border transition-all ${
                    isCurrent
                      ? "border-cyan-400/40 bg-cyan-400/[0.08]"
                      : hasPicked
                      ? "border-white/[0.05] bg-white/[0.02] opacity-55"
                      : "border-white/[0.06] bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black ${
                      isCurrent ? "bg-cyan-500 text-white" : "bg-white/10 text-gray-500"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-bold truncate leading-tight ${isMe ? "text-cyan-300" : "text-white"}`}>
                        {p.display_name}{isMe ? " (You)" : ""}
                      </div>
                      <div className="text-[9px] leading-tight">
                        {isCurrent ? (
                          <span className="text-cyan-400 font-bold">Picking now…</span>
                        ) : hasPicked ? (
                          <span className="text-emerald-400">Picked ✓</span>
                        ) : (
                          <span className="text-gray-600">Waiting</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {p.last_pick && (
                    <div className="mt-1.5 flex items-center gap-1.5 pl-7">
                      {p.last_pick.image_url && (
                        <img
                          src={p.last_pick.image_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-4 h-4 rounded-full object-cover shrink-0"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <span className="text-[9px] text-gray-400 truncate">{p.last_pick.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-h-0">
        {/* Top header bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] flex items-center justify-between bg-[#07101f]">
          <div className="flex items-center gap-2">
            {isMyTurn ? (
              <>
                <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                </svg>
                <span className="text-sm font-black text-white uppercase tracking-wide">
                  It&apos;s your turn{" "}
                  <span className="text-gray-400 font-semibold normal-case tracking-normal">— Choose a player</span>
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="text-sm font-semibold text-gray-300">
                  Waiting for <span className="text-white font-bold">{currentPicker?.display_name ?? "…"}</span> to pick
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Picks Left</span>
            <span className="text-lg font-black text-white tabular-nums">{picksLeft}</span>
          </div>
        </div>

        {/* Player grid */}
        <div className="flex-1 p-3 sm:p-4 lg:p-5 overflow-y-auto">
          {room.round_players.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              Loading players…
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-2.5 max-w-6xl mx-auto">
              {room.round_players.map(player => (
                <PlayerCard
                  key={player.sofifa_id}
                  player={player}
                  canPick={isMyTurn}
                  onPick={onPick}
                  slotPosition={currentPosition}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom hint bar */}
        {isMyTurn && (
          <div className="px-4 py-2.5 border-t border-white/[0.05] flex items-center justify-center gap-2 bg-[#07101f]">
            <svg className="w-3.5 h-3.5 text-cyan-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
            </svg>
            <span className="text-[11px] text-gray-400">
              <span className="text-cyan-400 font-bold">Choose wisely.</span> Great teams are built one pick at a time.
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
