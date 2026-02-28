"use client";

import { useState, useCallback, useRef, useLayoutEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";

import TierRow from "./TierRow";
import PlayerCard from "./PlayerCard";
import {
  TIERS,
  type Tier,
  type TierMap,
  type TierlistPlayer,
  type TierlistTopic,
} from "@/lib/types";
import type { SaveRankingPayload } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface TierlistBoardProps {
  topic: TierlistTopic;
  players: TierlistPlayer[];
  existingRankings: { player_id: string; tier: Tier }[];
  userId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildInitialTierMap(
  players: TierlistPlayer[],
  existingRankings: { player_id: string; tier: Tier }[]
): TierMap {
  const map: TierMap = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    unranked: players.map((p) => p.id),
  };

  for (const { player_id, tier } of existingRankings) {
    map.unranked = map.unranked.filter((id) => id !== player_id);
    map[tier].push(player_id);
  }

  return map;
}

const CONTAINER_IDS = new Set<string>([...TIERS, "unranked"]);

// ── Unranked pool ─────────────────────────────────────────────────────────

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
      ref={setNodeRef}
      className={`rounded-xl border p-3 transition-colors ${
        isOver
          ? "border-indigo-400 bg-gray-800"
          : "border-dashed border-gray-700 bg-gray-900/50"
      }`}
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Unranked Players — drag into a tier
      </h3>
      <div className="flex min-h-[60px] flex-wrap gap-2">
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
}: TierlistBoardProps) {
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  const [tierMap, setTierMap] = useState<TierMap>(() =>
    buildInitialTierMap(players, existingRankings)
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Keep a ref to tierMap so the collision detection callback (stable ref)
  // always sees the latest state without needing to be recreated.
  const tierMapRef = useRef(tierMap);
  useLayoutEffect(() => {
    tierMapRef.current = tierMap;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Find which container a player currently lives in
  const findContainer = useCallback(
    (id: string): Tier | "unranked" | undefined => {
      for (const key of [...TIERS, "unranked"] as Array<Tier | "unranked">) {
        if (tierMap[key].includes(id)) return key;
      }
      return undefined;
    },
    [tierMap]
  );

  // ── Collision detection ────────────────────────────────────────────────
  //
  // Strategy:
  //  1. Use pointerWithin to find which container the cursor is inside.
  //  2. If that container has items, return the closest ITEM within it
  //     (so useSortable can animate within-container reordering).
  //  3. If the container is empty, return the container itself
  //     (so an empty tier row is still a valid drop target).
  //  4. Fall back to closestCenter when the cursor isn't inside any container.
  //
  // This correctly handles all four cases:
  //  - drag unranked → tier           (cross-container, tier may be empty)
  //  - drag tier → different tier     (cross-container)
  //  - drag within tier to reorder    (within-container sort)
  //  - drag within unranked to reorder (within-container sort)

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);

    // Find the first collision that is a container (not a player card)
    const containerHit = pointerCollisions.find((c) =>
      CONTAINER_IDS.has(c.id as string)
    );

    if (containerHit) {
      const containerId = containerHit.id as string;
      const itemIds =
        tierMapRef.current[containerId as Tier | "unranked"] ?? [];

      if (itemIds.length > 0) {
        // Return the closest item within this container so sorting works
        const closest = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) =>
            itemIds.includes(c.id as string)
          ),
        });
        if (closest.length > 0) return closest;
      }

      // Container is empty — return the container itself as the target
      return [containerHit];
    }

    // Cursor not inside any container — fall back to closest center overall
    return closestCenter(args);
  }, []); // tierMapRef is a stable ref, no deps needed

  // ── Drag handlers ──────────────────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  /**
   * onDragOver handles CROSS-container moves with live feedback.
   * Within-container reordering is handled entirely by useSortable transforms
   * and confirmed in onDragEnd.
   */
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = (
      CONTAINER_IDS.has(overId) ? overId : findContainer(overId)
    ) as Tier | "unranked" | undefined;

    // Skip if same container — useSortable handles the visual shifting itself
    if (!activeContainer || !overContainer || activeContainer === overContainer)
      return;

    setTierMap((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const activeIndex = activeItems.indexOf(activeId);
      const overIndex = overItems.indexOf(overId);

      // Insert before/after the hovered item, or at end if hovering the container
      const newIndex = CONTAINER_IDS.has(overId)
        ? overItems.length
        : overIndex >= 0
        ? overIndex
        : overItems.length;

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
   * onDragEnd confirms within-container reordering.
   * Cross-container moves were already committed in onDragOver.
   */
  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = (
      CONTAINER_IDS.has(overId) ? overId : findContainer(overId)
    ) as Tier | "unranked" | undefined;

    if (!activeContainer || !overContainer || activeContainer !== overContainer)
      return;

    // Within-container reorder
    const items = tierMap[activeContainer];
    const oldIndex = items.indexOf(activeId);
    const newIndex = items.indexOf(overId);

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      setTierMap((prev) => ({
        ...prev,
        [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
      }));
    }
  }

  // ── Save handler ──────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);

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
        body: JSON.stringify({
          topic_id: topic.id,
          rankings,
        } satisfies SaveRankingPayload),
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

  const rankedCount = TIERS.reduce((sum, t) => sum + tierMap[t].length, 0);

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {TIERS.map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            players={tierMap[tier].map((id) => playerMap[id]).filter(Boolean)}
            activePlayerId={activeId}
          />
        ))}

        <UnrankedPool
          players={tierMap.unranked.map((id) => playerMap[id]).filter(Boolean)}
          activePlayerId={activeId}
        />

        <DragOverlay>
          {activeId && playerMap[activeId] ? (
            <div className="rotate-2 scale-105 shadow-2xl opacity-95">
              <PlayerCard player={playerMap[activeId]} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Save section */}
      <div className="flex items-center justify-between rounded-xl border border-gray-700 bg-gray-900 p-4">
        <span className="text-sm text-gray-400">
          {rankedCount}/{players.length} players ranked
        </span>

        <div className="flex items-center gap-3">
          {saveMessage && (
            <span
              className={`text-sm ${
                saveMessage.type === "success"
                  ? "text-green-400"
                  : "text-red-400"
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
