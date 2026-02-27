"use client";

/**
 * components/TierRow.tsx
 *
 * One horizontal tier row (S / A / B / C / D).
 *
 * Renders a coloured tier label on the left and a droppable zone
 * on the right.  Uses @dnd-kit/sortable's SortableContext so the
 * players inside can be reordered within the tier and dragged
 * across tiers.
 *
 * The droppable container id is the tier label itself ("S", "A", …).
 */

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import PlayerCard from "./PlayerCard";
import type { Tier, TierlistPlayer } from "@/lib/types";
import { TIER_COLORS } from "@/lib/types";

interface TierRowProps {
  tier: Tier;
  players: TierlistPlayer[];
  /** The player id that is currently being dragged (or null) */
  activePlayerId: string | null;
}

export default function TierRow({ tier, players, activePlayerId }: TierRowProps) {
  // Register this row as a droppable target keyed by the tier label
  const { setNodeRef, isOver } = useDroppable({ id: tier });

  const tierColor = TIER_COLORS[tier];

  return (
    <div
      className={`flex min-h-[80px] rounded-xl border transition-colors ${
        isOver
          ? "border-indigo-400 bg-gray-800"
          : "border-gray-700 bg-gray-900"
      }`}
    >
      {/* Tier label column */}
      <div
        className={`flex w-14 flex-shrink-0 items-center justify-center rounded-l-xl text-2xl font-black text-gray-900 ${tierColor}`}
      >
        {tier}
      </div>

      {/* Droppable player area */}
      <div
        ref={setNodeRef}
        className="flex flex-1 flex-wrap gap-2 p-2"
      >
        {/* SortableContext enables animated reordering within the tier */}
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

        {/* Placeholder text when the tier is empty */}
        {players.length === 0 && (
          <span className="flex items-center text-xs text-gray-600 italic">
            Drop players here
          </span>
        )}
      </div>
    </div>
  );
}
