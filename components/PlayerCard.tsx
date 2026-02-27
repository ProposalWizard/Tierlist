"use client";

/**
 * components/PlayerCard.tsx
 *
 * A draggable card representing a single football player.
 *
 * Uses @dnd-kit/sortable's useSortable hook so it can be picked up
 * and dropped into any TierRow or the unranked pool.
 *
 * Props:
 *  - player: the player data to render
 *  - isDragging: passed from the parent to dim the original card
 *               while a drag overlay is showing
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TierlistPlayer } from "@/lib/types";

interface PlayerCardProps {
  player: TierlistPlayer;
  /** True while this card is being actively dragged (overlay active) */
  isDragging?: boolean;
}

export default function PlayerCard({ player, isDragging = false }: PlayerCardProps) {
  // useSortable gives us ref/style for smooth animated repositioning
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isActive = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-dnd-dragging={isActive}
      className={`
        flex cursor-grab select-none flex-col items-center justify-center
        gap-1 rounded-lg border border-gray-700 bg-gray-800 p-2
        text-center shadow transition-all
        hover:border-gray-500 hover:bg-gray-700
        active:cursor-grabbing
        ${isActive ? "opacity-40 ring-2 ring-indigo-400" : ""}
      `}
    >
      {/* Player avatar – show initials if no image */}
      {player.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.image_url}
          alt={player.name}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white">
          {/* Show first letter of each word in the name */}
          {player.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
      )}

      {/* Player name */}
      <span className="text-xs font-semibold leading-tight text-white">
        {player.name}
      </span>

      {/* Position + club badge */}
      <span className="text-[10px] leading-none text-gray-400">
        {[player.position, player.club].filter(Boolean).join(" · ")}
      </span>
    </div>
  );
}
