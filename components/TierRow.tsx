"use client";

import { useState, useRef, useEffect } from "react";
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
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select all text when editing starts
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commitEdit() {
    // If user cleared the label, revert to the tier letter
    setLabel((v) => v.trim() || tier);
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[100px] rounded-xl border transition-colors ${
        isOver
          ? "border-indigo-400 bg-gray-800"
          : "border-gray-700 bg-gray-900"
      }`}
    >
      {/* Tier label — click to edit */}
      <div
        className={`relative flex w-20 flex-shrink-0 items-center justify-center rounded-l-xl ${tierColor}`}
        title="Click to rename"
      >
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") { setLabel(tier); setEditing(false); }
            }}
            // Stop pointer events reaching the DnD context so dragging isn't triggered
            onPointerDown={(e) => e.stopPropagation()}
            maxLength={12}
            className="w-full bg-transparent text-center text-lg font-black text-gray-900 outline-none placeholder:text-gray-700"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            // Block pointer so DnD doesn't intercept the click
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-full w-full cursor-text items-center justify-center px-1 text-center text-xl font-black leading-tight text-gray-900 break-words hyphens-auto"
          >
            {label}
          </button>
        )}
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
