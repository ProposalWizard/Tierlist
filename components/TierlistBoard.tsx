"use client";

/**
 * components/TierlistBoard.tsx
 *
 * Main drag-and-drop tierlist board.
 *
 * Architecture:
 *  ┌──────────────────────────────────────────┐
 *  │  DndContext  (top-level drag orchestrator)│
 *  │  ┌──────────────────────────────────────┐│
 *  │  │  TierRow S  [droppable + sortable]   ││
 *  │  │  TierRow A  [droppable + sortable]   ││
 *  │  │  TierRow B  [droppable + sortable]   ││
 *  │  │  TierRow C  [droppable + sortable]   ││
 *  │  │  TierRow D  [droppable + sortable]   ││
 *  │  │  Unranked Pool  [droppable pool]     ││
 *  │  └──────────────────────────────────────┘│
 *  │  DragOverlay  (floating preview card)    │
 *  └──────────────────────────────────────────┘
 *
 * State management:
 *  tierMap: Record<Tier | "unranked", string[]>
 *    Maps each tier (and the unranked pool) to an array of player IDs.
 *    This is the single source of truth for where each player lives.
 *
 * Drag logic:
 *  onDragStart  → record the active player ID.
 *  onDragOver   → move the player to the hover container in real time
 *                 (provides live visual feedback).
 *  onDragEnd    → confirm the final placement; remove from old container.
 *
 * The UNIQUE constraint is enforced by the tierMap itself: a player ID
 * can only appear in one bucket at a time (we always remove before adding).
 *
 * Saving:
 *  The "Save Rankings" button calls POST /api/tierlist/save with the
 *  current tierMap (excluding "unranked" players).
 */

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  closestCorners,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

import TierRow from "./TierRow";
import PlayerCard from "./PlayerCard";
import { TIERS, type Tier, type TierMap, type TierlistPlayer, type TierlistTopic } from "@/lib/types";
import type { SaveRankingPayload } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface TierlistBoardProps {
  topic: TierlistTopic;
  players: TierlistPlayer[];
  /** Previously saved rankings from the DB (empty array if none) */
  existingRankings: { player_id: string; tier: Tier }[];
  userId: string;
}

// ── Helper: build initial tierMap from existing DB rankings ───────────────

function buildInitialTierMap(
  players: TierlistPlayer[],
  existingRankings: { player_id: string; tier: Tier }[]
): TierMap {
  // Start with all tiers empty and all players in "unranked"
  const map: TierMap = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    unranked: players.map((p) => p.id),
  };

  // Apply existing rankings, moving players out of "unranked"
  for (const { player_id, tier } of existingRankings) {
    map.unranked = map.unranked.filter((id) => id !== player_id);
    map[tier].push(player_id);
  }

  return map;
}

// ── Unranked pool droppable component ─────────────────────────────────────

function UnrankedPool({
  players,
  activePlayerId,
}: {
  players: TierlistPlayer[];
  activePlayerId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        isOver ? "border-indigo-400 bg-gray-800" : "border-dashed border-gray-700 bg-gray-900/50"
      }`}
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Unranked Players — drag into a tier
      </h3>
      <div ref={setNodeRef} className="flex min-h-[60px] flex-wrap gap-2">
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
            All players ranked!
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function TierlistBoard({
  topic,
  players,
  existingRankings,
  userId,
}: TierlistBoardProps) {
  // Build a quick lookup: player id → full player object
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  // The single source of truth for player placement
  const [tierMap, setTierMap] = useState<TierMap>(() =>
    buildInitialTierMap(players, existingRankings)
  );

  // The player currently being dragged (for DragOverlay)
  const [activeId, setActiveId] = useState<string | null>(null);

  // UI feedback for save operation
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ── DnD sensors ─────────────────────────────────────────────────────────
  // PointerSensor requires a 5px movement before starting a drag
  // to avoid triggering drag on accidental tiny taps/clicks.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // ── Find which container a player currently lives in ─────────────────────
  const findContainer = useCallback(
    (playerId: string): Tier | "unranked" | undefined => {
      for (const key of [...TIERS, "unranked"] as Array<Tier | "unranked">) {
        if (tierMap[key].includes(playerId)) return key;
      }
      return undefined;
    },
    [tierMap]
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  /**
   * onDragOver fires continuously while dragging.
   * We update the tierMap here to give live visual feedback as the
   * drag card hovers over a different tier row.
   */
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    // The "over" target is either a container id or another player id
    const overContainer =
      (tierMap[overId as Tier | "unranked"] !== undefined
        ? overId
        : findContainer(overId)) as Tier | "unranked" | undefined;

    if (
      !activeContainer ||
      !overContainer ||
      activeContainer === overContainer
    ) {
      return;
    }

    setTierMap((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];

      const activeIndex = activeItems.indexOf(activeId);
      const overIndex = overItems.indexOf(overId);

      // Insert at appropriate position in the target container
      let newIndex: number;
      if (tierMap[overId as Tier | "unranked"] !== undefined) {
        // Dropped directly onto a container – add to end
        newIndex = overItems.length;
      } else {
        // Dropped on a player – insert before/after based on position
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== activeId),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          activeId,
          ...overItems.slice(newIndex),
        ],
      };
    });
  }

  /**
   * onDragEnd fires once the user releases the drag.
   * If dropped in the same container, handle reordering.
   * If over nothing, revert (no-op – position unchanged from onDragOver).
   */
  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer =
      (tierMap[overId as Tier | "unranked"] !== undefined
        ? overId
        : findContainer(overId)) as Tier | "unranked" | undefined;

    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      // Reorder within the same container
      const items = tierMap[activeContainer];
      const oldIndex = items.indexOf(activeId);
      const newIndex = items.indexOf(overId);

      if (oldIndex !== newIndex) {
        setTierMap((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
        }));
      }
    }
    // Cross-container movement was already handled in onDragOver
  }

  // ── Save handler ─────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);

    // Build the payload: only include players that are in a real tier
    const rankings: SaveRankingPayload["rankings"] = [];
    for (const tier of TIERS) {
      for (const playerId of tierMap[tier]) {
        rankings.push({ player_id: playerId, tier });
      }
    }

    try {
      const res = await fetch("/api/tierlist/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic_id: topic.id, rankings } satisfies SaveRankingPayload),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Failed to save");
      }

      setSaveMessage({ type: "success", text: "Rankings saved!" });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Derived data for rendering ────────────────────────────────────────────

  // How many players have been placed in a tier
  const rankedCount = TIERS.reduce((sum, t) => sum + tierMap[t].length, 0);

  return (
    <div className="space-y-3">
      {/* ── DnD context wraps all interactive elements ─────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {/* Tier rows S → D */}
        {TIERS.map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            players={tierMap[tier].map((id) => playerMap[id]).filter(Boolean)}
            activePlayerId={activeId}
          />
        ))}

        {/* Unranked pool below the tiers */}
        <UnrankedPool
          players={tierMap.unranked.map((id) => playerMap[id]).filter(Boolean)}
          activePlayerId={activeId}
        />

        {/* DragOverlay renders a floating copy of the card being dragged.
            This is the card the user "holds" – the original fades (via
            the isDragging prop on PlayerCard). */}
        <DragOverlay>
          {activeId && playerMap[activeId] ? (
            <div className="rotate-2 scale-105 shadow-2xl opacity-95">
              <PlayerCard player={playerMap[activeId]} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Save section ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-gray-700 bg-gray-900 p-4">
        <span className="text-sm text-gray-400">
          {rankedCount}/{players.length} players ranked
        </span>

        <div className="flex items-center gap-3">
          {/* Inline feedback message */}
          {saveMessage && (
            <span
              className={`text-sm ${
                saveMessage.type === "success" ? "text-green-400" : "text-red-400"
              }`}
            >
              {saveMessage.text}
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Rankings"}
          </button>
        </div>
      </div>
    </div>
  );
}
