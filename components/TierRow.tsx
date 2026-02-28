"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import PlayerCard from "./PlayerCard";
import type { Tier, TierlistPlayer } from "@/lib/types";
import { TIER_COLORS } from "@/lib/types";

interface TierRowProps {
  tier: Tier;
  players: TierlistPlayer[];
  activePlayerId: string | null;
}

export default function TierRow({ tier, players, activePlayerId }: TierRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: tier });
  const tierColor = TIER_COLORS[tier];

  const [label, setLabel] = useState(tier as string);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[100px] rounded-xl border transition-colors ${
        isOver
          ? "border-indigo-400 bg-gray-800"
          : "border-gray-700 bg-gray-900"
      }`}
    >
      {/* Tier label — always an input so it's always editable */}
      <div
        className={`flex w-28 flex-shrink-0 items-center justify-center rounded-l-xl ${tierColor}`}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => setLabel((v) => v.trim() || tier)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") { setLabel(tier); e.currentTarget.blur(); }
          }}
          maxLength={14}
          title="Click to rename this tier"
          className="w-full cursor-text bg-transparent px-1 text-center text-xl font-black text-white outline-none [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]"
        />
      </div>

      {/* Player area */}
      <div className="flex flex-1 flex-wrap gap-2 p-2">
        <SortableContext
          items={players.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isDragging={activePlayerId === player.id}
            />
          ))}
        </SortableContext>
        {players.length === 0 && (
          <span className="flex items-center text-xs text-gray-600 italic">
            Drop images here
          </span>
        )}
      </div>
    </div>
  );
}
