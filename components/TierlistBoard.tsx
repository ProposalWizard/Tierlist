"use client";

import {
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
  useId,
} from "react";
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
import UploadTierlistModal from "./UploadTierlistModal";
import {
  DEFAULT_TIER_ROWS,
  type TierRowData,
  type TierlistPlayer,
} from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface TierlistBoardProps {
  /** Pre-populated images (from a saved tierlist) */
  initialImages?: Array<{ id: string; name: string; image_url: string }>;
  /** "create" mode shows Upload + Download buttons */
  mode?: "play" | "create";
}

// ── Unranked pool ──────────────────────────────────────────────────────────

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
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) {
              onFilesAdded(e.target.files);
              e.target.value = "";
            }
          }}
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

export default function TierlistBoard({
  initialImages,
  mode = "play",
}: TierlistBoardProps) {
  // Dynamic tier rows
  const [tiers, setTiers] = useState<TierRowData[]>(() => DEFAULT_TIER_ROWS);

  // Map of tier-row-id / "unranked" → ordered player IDs
  const [tierMap, setTierMap] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {
      unranked: initialImages?.map((img) => img.id) ?? [],
    };
    for (const t of DEFAULT_TIER_ROWS) map[t.id] = [];
    return map;
  });

  // Player metadata
  const [playerMap, setPlayerMap] = useState<Record<string, TierlistPlayer>>(
    () => {
      if (!initialImages?.length) return {};
      return Object.fromEntries(
        initialImages.map((img) => [
          img.id,
          {
            id: img.id,
            topic_id: "",
            name: img.name,
            position: null,
            club: null,
            image_url: img.image_url,
            created_at: "",
          } satisfies TierlistPlayer,
        ])
      );
    }
  );

  // File objects for locally-added images (needed for Supabase upload)
  const [fileMap, setFileMap] = useState<Record<string, File>>({});

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Ref for the tiers-only section used for screenshot download
  const tiersRef = useRef<HTMLDivElement>(null);

  // Keep a live ref to tierMap so collision detection never goes stale
  const tierMapRef = useRef(tierMap);
  useLayoutEffect(() => {
    tierMapRef.current = tierMap;
  });

  // Set of all valid droppable container IDs (updated each render)
  const containerIdsRef = useRef<Set<string>>(new Set());
  useLayoutEffect(() => {
    containerIdsRef.current = new Set([
      ...tiers.map((t) => t.id),
      "unranked",
    ]);
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Image upload ─────────────────────────────────────────────────────────

  function handleFilesAdded(files: FileList) {
    const newPlayers: TierlistPlayer[] = [];
    const newFiles: Record<string, File> = {};

    Array.from(files).forEach((file) => {
      const id = crypto.randomUUID();
      newPlayers.push({
        id,
        topic_id: "",
        name: file.name.replace(/\.[^/.]+$/, ""),
        position: null,
        club: null,
        image_url: URL.createObjectURL(file),
        created_at: new Date().toISOString(),
      });
      newFiles[id] = file;
    });

    setPlayerMap((prev) => ({
      ...prev,
      ...Object.fromEntries(newPlayers.map((p) => [p.id, p])),
    }));
    setFileMap((prev) => ({ ...prev, ...newFiles }));
    setTierMap((prev) => ({
      ...prev,
      unranked: [...prev.unranked, ...newPlayers.map((p) => p.id)],
    }));
  }

  // ── Tier row management ──────────────────────────────────────────────────

  function addTier(referenceId: string, position: "above" | "below") {
    const newTier: TierRowData = {
      id: crypto.randomUUID(),
      label: "New",
      color: "#94a3b8",
    };
    setTiers((prev) => {
      const idx = prev.findIndex((t) => t.id === referenceId);
      if (idx === -1) return [...prev, newTier];
      const next = [...prev];
      next.splice(position === "above" ? idx : idx + 1, 0, newTier);
      return next;
    });
    setTierMap((prev) => ({ ...prev, [newTier.id]: [] }));
  }

  function deleteTier(id: string) {
    const orphans = tierMap[id] ?? [];
    setTiers((prev) => prev.filter((t) => t.id !== id));
    setTierMap((prev) => {
      const next = { ...prev };
      delete next[id];
      next.unranked = [...next.unranked, ...orphans];
      return next;
    });
  }

  function clearTier(id: string) {
    const orphans = tierMap[id] ?? [];
    setTierMap((prev) => ({
      ...prev,
      [id]: [],
      unranked: [...prev.unranked, ...orphans],
    }));
  }

  function updateTierLabel(id: string, label: string) {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, label } : t)));
  }

  function updateTierColor(id: string, color: string) {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, color } : t)));
  }

  // ── Download as image ────────────────────────────────────────────────────

  async function handleDownload() {
    if (!tiersRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(tiersRef.current, {
        backgroundColor: "#111827",
        useCORS: true,
        allowTaint: true,
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = "tierlist.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setIsDownloading(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const findContainer = useCallback(
    (id: string): string | undefined => {
      for (const key of [...tiers.map((t) => t.id), "unranked"]) {
        if (tierMap[key]?.includes(id)) return key;
      }
      return undefined;
    },
    [tierMap, tiers]
  );

  // ── Collision detection ──────────────────────────────────────────────────
  //
  // 1. pointerWithin to find the container under the cursor.
  // 2. If that container has items, return the closest item within it.
  // 3. If empty, return the container itself.
  // 4. Fall back to closestCenter.

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);

    const containerHit = pointerCollisions.find((c) =>
      containerIdsRef.current.has(c.id as string)
    );

    if (containerHit) {
      const containerId = containerHit.id as string;
      const itemIds = tierMapRef.current[containerId] ?? [];

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

  // ── Drag handlers ────────────────────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const aId = active.id as string;
    const oId = over.id as string;

    const activeContainer = findContainer(aId);
    const overContainer = (
      containerIdsRef.current.has(oId) ? oId : findContainer(oId)
    ) as string | undefined;

    if (!activeContainer || !overContainer || activeContainer === overContainer)
      return;

    setTierMap((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const overIndex = overItems.indexOf(oId);
      const newIndex = containerIdsRef.current.has(oId)
        ? overItems.length
        : overIndex >= 0
        ? overIndex
        : overItems.length;

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== aId),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          aId,
          ...overItems.slice(newIndex),
        ],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const aId = active.id as string;
    const oId = over.id as string;

    const activeContainer = findContainer(aId);
    const overContainer = (
      containerIdsRef.current.has(oId) ? oId : findContainer(oId)
    ) as string | undefined;

    if (!activeContainer || !overContainer || activeContainer !== overContainer)
      return;

    const items = tierMap[activeContainer];
    const oldIndex = items.indexOf(aId);
    const newIndex = items.indexOf(oId);

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      setTierMap((prev) => ({
        ...prev,
        [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
      }));
    }
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  const totalImages = Object.values(playerMap).length;
  const rankedCount = tiers.reduce(
    (sum, t) => sum + (tierMap[t.id]?.length ?? 0),
    0
  );

  // All images for the upload modal (includes File ref if locally added)
  const allImagesForUpload = Object.values(playerMap).map((p) => ({
    id: p.id,
    name: p.name,
    image_url: p.image_url ?? "",
    file: fileMap[p.id],
  }));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {/* Tier rows — wrapped for screenshot capture */}
        <div ref={tiersRef} className="space-y-2 rounded-xl bg-gray-950 p-2">
          {tiers.map((tier) => (
            <TierRow
              key={tier.id}
              rowId={tier.id}
              label={tier.label}
              color={tier.color}
              players={
                (tierMap[tier.id] ?? [])
                  .map((id) => playerMap[id])
                  .filter(Boolean) as TierlistPlayer[]
              }
              activePlayerId={activeId}
              onLabelChange={(label) => updateTierLabel(tier.id, label)}
              onColorChange={(color) => updateTierColor(tier.id, color)}
              onDelete={() => deleteTier(tier.id)}
              onClear={() => clearTier(tier.id)}
              onAddAbove={() => addTier(tier.id, "above")}
              onAddBelow={() => addTier(tier.id, "below")}
            />
          ))}
        </div>

        <UnrankedPool
          players={
            (tierMap.unranked ?? [])
              .map((id) => playerMap[id])
              .filter(Boolean) as TierlistPlayer[]
          }
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

      {/* Create-mode action buttons */}
      {mode === "create" && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleDownload}
            disabled={isDownloading || totalImages === 0}
            className="rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDownloading ? "Generating…" : "⬇ Download as Image"}
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            disabled={totalImages === 0}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Upload Tierlist
          </button>
        </div>
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <UploadTierlistModal
          images={allImagesForUpload}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
}
