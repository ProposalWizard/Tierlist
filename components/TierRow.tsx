"use client";

import { useDroppable } from "@dnd-kit/core";
import PlayerCard from "./PlayerCard";
import type { Tier, TierlistPlayer } from "@/lib/types";
import { TIER_COLORS } from "@/lib/types";

interface TierRowProps {
  tier: Tier;
  players: TierlistPlayer[];
  activePlayerId: string | null;
}

export default function TierRow({ tier, players, activePlayerId }: TierRowProps) {
  // The entire row is the droppable target — gives a large hit area
  const { setNodeRef, isOver } = useDroppable({ id: tier });

  const tierColor = TIER_COLORS[tier];

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[80px] rounded-xl border transition-colors ${
        isOver
          ? "border-indigo-400 bg-gray-800"
          : "border-gray-700 bg-gray-900"
      }`}
    >
      {/* Tier label */}
      <div
        className={`flex w-14 flex-shrink-0 items-center justify-center rounded-l-xl text-2xl font-black text-gray-900 ${tierColor}`}
      >
        {tier}
      </div>

      {/* Player area */}
      <div className="flex flex-1 flex-wrap gap-2 p-2">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            isDragging={activePlayerId === player.id}
          />
        ))}
        {players.length === 0 && (
          <span className="flex items-center text-xs text-gray-600 italic">
            Drop players here
          </span>
        )}
      </div>
    </div>
  );
}
