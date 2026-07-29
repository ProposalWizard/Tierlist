"use client";
import { useState } from "react";
import { POSITION_LABELS } from "@/lib/americanDraft";
import type { AmRoom, AmParticipant, AmPlayer } from "@/lib/americanDraft";

interface Props {
  room: AmRoom;
  participants: AmParticipant[];
  userId: string;
  onPick: (sofifaId: string) => Promise<void>;
}

const POS_BG: Record<string, string> = {
  GK: "bg-yellow-500", RB: "bg-blue-500", RWB: "bg-blue-500",
  CB: "bg-blue-500", LB: "bg-blue-500", LWB: "bg-blue-500",
  CDM: "bg-green-500", CM: "bg-green-500", CAM: "bg-green-500",
  RM: "bg-green-500", LM: "bg-green-500",
  RW: "bg-red-500", LW: "bg-red-500", ST: "bg-red-500", CF: "bg-red-500",
  ANY: "bg-purple-500",
};

const POS_TEXT: Record<string, string> = {
  GK: "text-yellow-400", RB: "text-blue-400", RWB: "text-blue-400",
  CB: "text-blue-400", LB: "text-blue-400", LWB: "text-blue-400",
  CDM: "text-green-400", CM: "text-green-400", CAM: "text-green-400",
  RM: "text-green-400", LM: "text-green-400",
  RW: "text-red-400", LW: "text-red-400", ST: "text-red-400", CF: "text-red-400",
  ANY: "text-purple-400",
};

function ovrColor(ovr: number): string {
  if (ovr >= 85) return "bg-amber-500";
  if (ovr >= 80) return "bg-emerald-500";
  if (ovr >= 75) return "bg-sky-500";
  return "bg-gray-600";
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

  async function handlePick() {
    if (picking) return;
    setPicking(true);
    await onPick(player.sofifa_id);
    setPicking(false);
  }

  const badgeBg = POS_BG[slotPosition] || "bg-gray-600";
  const badgeLabel = slotPosition === "ANY" ? "SUB" : slotPosition;

  return (
    <div
      className={`relative rounded-xl overflow-hidden border flex flex-col transition-all duration-150 ${
        canPick
          ? "border-white/20 hover:border-cyan-400/70 hover:shadow-[0_0_20px_rgba(6,182,212,0.25)]"
          : "border-white/[0.07] opacity-70"
      } bg-[#0a1120]`}
    >
      {/* Image area */}
      <div className="relative bg-gradient-to-b from-white/[0.04] to-transparent h-[72px] sm:h-[84px] shrink-0">
        {player.image_url ? (
          <img
            src={player.image_url}
            alt={player.name}
            className="w-full h-full object-cover object-top"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-7 h-7 text-white/10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
        )}
        {/* OVR badge */}
        <div className={`absolute top-1 left-1 ${ovrColor(player.ovr)} text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-none`}>
          {player.ovr}
        </div>
        {/* Slot position badge */}
        <div className={`absolute top-1 right-1 ${badgeBg} text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none`}>
          {badgeLabel}
        </div>
      </div>

      {/* Info */}
      <div className="px-2 pt-1.5 pb-1 flex-1">
        <div className="text-[11px] font-black text-white leading-tight line-clamp-1 mb-0.5">{player.name}</div>
        <div className="text-[9px] text-gray-400 truncate leading-tight">{player.club}</div>
      </div>

      {/* Pick button */}
      {canPick && (
        <button
          onClick={handlePick}
          disabled={picking}
          className="mx-2 mb-2 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(90deg,#0d9488,#06b6d4)" }}
        >
          {picking ? "…" : "Pick"}
        </button>
      )}
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

  const posTextColor = POS_TEXT[currentPosition] || "text-cyan-400";

  return (
    <div className="min-h-screen bg-[#050b14] flex flex-col lg:flex-row">
      {/* ── Sidebar: pick order ── */}
      <aside className="lg:w-60 xl:w-64 shrink-0 bg-[#060c1a] border-b lg:border-b-0 lg:border-r border-white/[0.06] flex flex-col">
        {/* Round / position header */}
        <div className="p-3 lg:p-4 border-b border-white/[0.06]">
          <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-0.5">
            Round {room.current_round + 1} of {totalRounds}
          </div>
          <div className={`text-base font-black uppercase italic leading-none ${posTextColor}`}>
            {posLabel}
          </div>
          {/* Progress bar */}
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

        {/* Pick order list */}
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
                    <div
                      className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black ${
                        isCurrent ? "bg-cyan-500 text-white" : "bg-white/10 text-gray-500"
                      }`}
                    >
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
                  {/* Last pick shown beneath */}
                  {p.last_pick && (
                    <div className="mt-1.5 flex items-center gap-1.5 pl-7">
                      {p.last_pick.image_url && (
                        <img
                          src={p.last_pick.image_url}
                          alt=""
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

      {/* ── Main: player grid ── */}
      <main className="flex-1 p-3 sm:p-4 lg:p-5 flex flex-col min-h-0">
        {/* Header */}
        <div className="mb-3 lg:mb-4">
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase italic leading-none">
            {posLabel}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {isMyTurn
              ? "Your pick — tap a player to select them"
              : `Waiting for ${currentPicker?.display_name ?? "…"} to pick`}
          </p>
        </div>

        {/* Turn banner */}
        {isMyTurn && (
          <div
            className="mb-3 px-3 py-2 rounded-xl border border-cyan-400/30 flex items-center gap-2"
            style={{ background: "rgba(6,182,212,0.08)" }}
          >
            <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
            <span className="text-sm font-bold text-cyan-300">It&apos;s your turn — choose a player</span>
          </div>
        )}

        {/* Player cards */}
        {room.round_players.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Loading players…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-2.5">
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
      </main>
    </div>
  );
}
