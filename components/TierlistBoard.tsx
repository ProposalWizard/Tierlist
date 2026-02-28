"use client";

import { useState, useCallback, useRef, useLayoutEffect, useId } from "react";
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
import { TIERS, type Tier, type TierMap, type TierlistPlayer } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────

const CONTAINER_IDS = new Set<string>([...TIERS, "unranked"]);

// ── Unranked pool (with "Add Images" button) ───────────────────────────────

function UnrankedPool({
  players,
  activePlayerId,
  onFilesAdded,
}: {
  players: TierlistPlayer[];
  activePlayerId: string | null;
  onFilesAdded: (files: FileList) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });
  const inputId = useId();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(e.target.files);
      // reset so the same file can be re-added if desired
      e.target.value = "";
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-3 transition-colors ${
        isOver
          ? "border-indigo-400 bg-gray-800"
          : "border-dashed border-gray-700 bg-gray-900/50"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Unranked — drag into a tier
        </h3>

        {/* Hidden file input */}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={handleChange}
        />
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
        >
          + Add Images
        </label>
      </div>

      <div className="flex min-h-[88px] flex-wrap gap-2">
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
            Click &quot;+ Add Images&quot; to get started
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function TierlistBoard() {
  // All state is purely client-side — no DB queries needed
  const [tierMap, setTierMap] = useState<TierMap>({
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    unranked: [],
  });

  // Map of id → player object (includes blob URLs)
  const [playerMap, setPlayerMap] = useState<Record<string, TierlistPlayer>>({});

  const [activeId, setActiveId] = useState<string | null>(null);

  // Stable ref so collision detection never goes stale
  const tierMapRef = useRef(tierMap);
  useLayoutEffect(() => {
    tierMapRef.current = tierMap;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Image upload ───────────────────────────────────────────────────────

  function handleFilesAdded(files: FileList) {
    const newPlayers: TierlistPlayer[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      topic_id: "",
      // Strip extension to use as display name
      name: file.name.replace(/\.[^/.]+$/, ""),
      position: null,
      club: null,
      image_url: URL.createObjectURL(file),
      created_at: new Date().toISOString(),
    }));

    setPlayerMap((prev) => ({
      ...prev,
      ...Object.fromEntries(newPlayers.map((p) => [p.id, p])),
    }));

    setTierMap((prev) => ({
      ...prev,
      unranked: [...prev.unranked, ...newPlayers.map((p) => p.id)],
    }));
  }

  // ── Helpers ────────────────────────────────────────────────────────────

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
  // 1. pointerWithin to find the container the cursor is inside.
  // 2. If that container has items, return the closest item within it
  //    (so useSortable animates within-container sorting correctly).
  // 3. If the container is empty, return the container itself.
  // 4. Fall back to closestCenter.

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);

    const containerHit = pointerCollisions.find((c) =>
      CONTAINER_IDS.has(c.id as string)
    );

    if (containerHit) {
      const containerId = containerHit.id as string;
      const itemIds =
        tierMapRef.current[containerId as Tier | "unranked"] ?? [];

      if (itemIds.length > 0) {
        const closest = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) =>
            itemIds.includes(c.id as string)
          ),
        });
        if (closest.length > 0) return closest;
      }

      return [containerHit];
    }

    return closestCenter(args);
  }, []);

  // ── Drag handlers ──────────────────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  /** Handles cross-container moves with live feedback. */
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = (
      CONTAINER_IDS.has(overId) ? overId : findContainer(overId)
    ) as Tier | "unranked" | undefined;

    if (!activeContainer || !overContainer || activeContainer === overContainer)
      return;

    setTierMap((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const overIndex = overItems.indexOf(overId);

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

  /** Confirms within-container reordering on drop. */
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

  // ── Render ─────────────────────────────────────────────────────────────

  const totalImages = Object.values(playerMap).length;
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
          onFilesAdded={handleFilesAdded}
        />

        <DragOverlay>
          {activeId && playerMap[activeId] ? (
            <div className="rotate-2 scale-105 opacity-95 shadow-2xl">
              <PlayerCard player={playerMap[activeId]} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Status bar */}
      {totalImages > 0 && (
        <p className="text-right text-xs text-gray-500">
          {rankedCount} / {totalImages} images ranked
        </p>
      )}
    </div>
  );
}
