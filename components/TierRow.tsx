"use client";

import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import PlayerCard from "./PlayerCard";
import { TIER_COLOR_OPTIONS } from "@/lib/types";
import type { TierlistPlayer } from "@/lib/types";

interface TierRowProps {
  rowId: string;
  label: string;
  color: string;
  players: TierlistPlayer[];
  activePlayerId: string | null;
  onLabelChange: (label: string) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
}

export default function TierRow({
  rowId,
  label,
  color,
  players,
  activePlayerId,
  onLabelChange,
  onColorChange,
  onDelete,
  onClear,
  onAddAbove,
  onAddBelow,
}: TierRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: rowId });
  const [localLabel, setLocalLabel] = useState(label);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Sync if parent changes the label
  useEffect(() => setLocalLabel(label), [label]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showSettings) return;
    function handlePointerDown(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showSettings]);

  function commitLabel() {
    const trimmed = localLabel.trim() || label;
    setLocalLabel(trimmed);
    onLabelChange(trimmed);
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[100px] rounded-xl border transition-colors ${
        isOver ? "border-indigo-400 bg-gray-800" : "border-gray-700 bg-gray-900"
      }`}
    >
      {/* ── Tier label ─────────────────────────────────────────────── */}
      <div
        className="flex w-20 flex-shrink-0 items-center justify-center rounded-l-xl"
        style={{ backgroundColor: color }}
      >
        <input
          value={localLabel}
          onChange={(e) => setLocalLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setLocalLabel(label);
              e.currentTarget.blur();
            }
          }}
          maxLength={14}
          title="Click to rename this tier"
          className="w-full cursor-text bg-transparent px-1 text-center text-xl font-black text-white outline-none [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
        />
      </div>

      {/* ── Player area ────────────────────────────────────────────── */}
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

      {/* ── Settings button + dropdown ──────────────────────────────── */}
      <div className="relative flex flex-shrink-0 items-start p-1.5" ref={settingsRef}>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors ${
            showSettings
              ? "bg-gray-700 text-white"
              : "text-gray-500 hover:bg-gray-700 hover:text-white"
          }`}
          title="Row settings"
        >
          ⚙
        </button>

        {showSettings && (
          <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-gray-700 bg-gray-900 p-3 shadow-2xl">
            {/* Colour picker */}
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Colour
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {TIER_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => onColorChange(c)}
                  style={{ backgroundColor: c }}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c ? "scale-110 border-white" : "border-transparent"
                  }`}
                  title={c}
                />
              ))}
            </div>

            <div className="my-2 border-t border-gray-700" />

            {/* Add row buttons */}
            <button
              onClick={() => { onAddAbove(); setShowSettings(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              ↑ Add Row Above
            </button>
            <button
              onClick={() => { onAddBelow(); setShowSettings(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              ↓ Add Row Below
            </button>

            <div className="my-2 border-t border-gray-700" />

            {/* Danger zone */}
            <button
              onClick={() => { onClear(); setShowSettings(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-yellow-400 transition-colors hover:bg-gray-800"
            >
              Clear Row
            </button>
            <button
              onClick={() => { onDelete(); setShowSettings(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-400 transition-colors hover:bg-gray-800"
            >
              Delete Row
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
