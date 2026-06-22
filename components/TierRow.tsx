"use client";

import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import PlayerCard from "./PlayerCard";
import { TIER_COLOR_OPTIONS } from "@/lib/types";
import type { TierlistPlayer, ImageStyle } from "@/lib/types";

interface TierRowProps {
  rowId: string;
  label: string;
  color: string;
  players: TierlistPlayer[];
  activePlayerId: string | null;
  isOnlyRow: boolean;
  imageStyle: ImageStyle;
  zoomMode: boolean;
  cropMode: boolean;
  labelMode: boolean;
  removeMode: boolean;
  selectedForRemoval: Set<string>;
  onLabelChange: (label: string) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onZoom: (id: string) => void;
  onCrop: (id: string) => void;
  onLabel: (id: string) => void;
  onToggleRemove: (id: string) => void;
  isMobile?: boolean;
  tapSelectedId?: string | null;
  onTapSelect?: (id: string) => void;
}

export default function TierRow({
  rowId,
  label,
  color,
  players,
  activePlayerId,
  isOnlyRow,
  imageStyle,
  zoomMode,
  cropMode,
  labelMode,
  removeMode,
  selectedForRemoval,
  onLabelChange,
  onColorChange,
  onDelete,
  onClear,
  onAddAbove,
  onAddBelow,
  onZoom,
  onCrop,
  onLabel,
  onToggleRemove,
  isMobile = false,
  tapSelectedId = null,
  onTapSelect,
}: TierRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: rowId });
  const [localLabel, setLocalLabel] = useState(label);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => setLocalLabel(label), [label]);

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
      className={`flex min-h-[48px] md:min-h-[112px] rounded-none md:rounded-xl border transition-colors ${
        isOver ? "border-indigo-400 bg-gray-800" : "border-gray-700 bg-gray-900"
      }`}
    >
      {/* ── Tier label ─────────────────────────────────────────────── */}
      <div
        className="flex w-[72px] flex-shrink-0 items-center justify-center rounded-none md:rounded-l-xl md:w-44 p-0.5 md:p-0"
        style={{ backgroundColor: color }}
      >
        {isMobile ? (
          <span
            className="w-full text-center text-[11px] font-black leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)] break-words overflow-hidden"
            style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as const }}
          >
            {localLabel}
          </span>
        ) : (
          <input
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { setLocalLabel(label); e.currentTarget.blur(); }
            }}
            maxLength={14}
            title="Click to rename this tier"
            className="w-full cursor-text bg-transparent px-2 text-center text-2xl font-black text-white outline-none [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
          />
        )}
      </div>

      {/* ── Player area ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-wrap content-start gap-[3px] p-[3px] md:gap-2 md:p-2">
        <SortableContext
          items={players.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isDragging={activePlayerId === player.id}
              imageStyle={imageStyle}
              zoomMode={zoomMode}
              cropMode={cropMode}
              labelMode={labelMode}
              removeMode={removeMode}
              isSelectedForRemoval={selectedForRemoval.has(player.id)}
              onZoom={onZoom}
              onCrop={onCrop}
              onLabel={onLabel}
              onToggleRemove={onToggleRemove}
              isMobile={isMobile}
              isTapSelected={tapSelectedId === player.id}
              onTapSelect={onTapSelect}
            />
          ))}
        </SortableContext>
        {players.length === 0 && !isMobile && (
          <span className="flex items-center text-xs text-white italic">
            Drop images here
          </span>
        )}
      </div>

      {/* ── Settings button + dropdown (desktop only) ──────────────── */}
      <div className={`relative flex-shrink-0 items-start p-1.5 ${isMobile ? "hidden" : "flex"}`} ref={settingsRef}>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors ${
            showSettings ? "bg-gray-700 text-white" : "text-white hover:bg-gray-700 hover:text-white"
          }`}
          title="Row settings"
        >
          ⚙
        </button>

        {showSettings && (
          <div className="absolute right-0 top-10 z-50 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-700 bg-gray-900 p-3 shadow-2xl">
            {/* Colour picker */}
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white">
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

            <button
              onClick={() => { onAddAbove(); setShowSettings(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white transition-colors hover:bg-gray-800 hover:text-white"
            >
              ↑ Add Row Above
            </button>
            <button
              onClick={() => { onAddBelow(); setShowSettings(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white transition-colors hover:bg-gray-800 hover:text-white"
            >
              ↓ Add Row Below
            </button>

            <div className="my-2 border-t border-gray-700" />

            <button
              onClick={() => { onClear(); setShowSettings(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-yellow-400 transition-colors hover:bg-gray-800"
            >
              Clear Row
            </button>
            <button
              onClick={() => { onDelete(); setShowSettings(false); }}
              disabled={isOnlyRow}
              title={isOnlyRow ? "Cannot delete the last row" : undefined}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-400 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete Row
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
