"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TierlistPlayer } from "@/lib/types";

interface PlayerCardProps {
  player: TierlistPlayer;
  isDragging?: boolean;
}

export default function PlayerCard({ player, isDragging = false }: PlayerCardProps) {
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

  const initials = player.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        w-[88px] flex-shrink-0 cursor-grab select-none rounded-lg border
        border-gray-700 bg-gray-800 p-1.5 text-center shadow
        transition-colors hover:border-gray-500 hover:bg-gray-700
        active:cursor-grabbing
        ${isActive ? "opacity-40 ring-2 ring-indigo-400" : ""}
      `}
    >
      {/* Image — fills the card, large enough to be useful */}
      {player.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.image_url}
          alt={player.name}
          className="h-[72px] w-full rounded-md object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-[72px] w-full items-center justify-center rounded-md bg-indigo-700 text-sm font-bold text-white">
          {initials}
        </div>
      )}

      {/* Name label */}
      <p className="mt-1 truncate text-[11px] font-medium leading-tight text-white">
        {player.name}
      </p>
    </div>
  );
}
