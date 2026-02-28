"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { TierlistPlayer } from "@/lib/types";

interface PlayerCardProps {
  player: TierlistPlayer;
  /** True while this card is being actively dragged (overlay active) */
  isDragging?: boolean;
}

export default function PlayerCard({ player, isDragging = false }: PlayerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isCurrentlyDragging,
  } = useDraggable({ id: player.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const isActive = isDragging || isCurrentlyDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        flex cursor-grab select-none flex-col items-center justify-center
        gap-1 rounded-lg border border-gray-700 bg-gray-800 p-2
        text-center shadow transition-colors
        hover:border-gray-500 hover:bg-gray-700
        active:cursor-grabbing
        ${isActive ? "opacity-40 ring-2 ring-indigo-400" : ""}
      `}
    >
      {player.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.image_url}
          alt={player.name}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white">
          {player.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
      )}

      <span className="text-xs font-semibold leading-tight text-white">
        {player.name}
      </span>

      <span className="text-[10px] leading-none text-gray-400">
        {[player.position, player.club].filter(Boolean).join(" · ")}
      </span>
    </div>
  );
}
