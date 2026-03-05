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
import ZoomOverlay from "./ZoomOverlay";
import CropOverlay from "./CropOverlay";
import LabelOverlay from "./LabelOverlay";
import { compressImage } from "@/lib/imageUtils";
import {
  DEFAULT_TIER_ROWS,
  IMAGE_STYLE_DIMS,
  type TierRowData,
  type TierlistPlayer,
  type ImageStyle,
} from "@/lib/types";

// ── Style selector config ──────────────────────────────────────────────────

const STYLE_OPTIONS: { key: ImageStyle; label: string }[] = [
  { key: "square",    label: "Square"    },
  { key: "landscape", label: "Landscape" },
  { key: "portrait",  label: "Portrait"  },
  { key: "circle",    label: "Circle"    },
  { key: "nocrop",    label: "No Crop"   },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface TierlistBoardProps {
  initialImages?: Array<{ id: string; name: string; image_url: string }>;
  mode?: "play" | "create";
}

// ── Unranked pool ──────────────────────────────────────────────────────────

function UnrankedPool({
  players,
  activePlayerId,
  imageStyle,
  zoomMode,
  cropMode,
  labelMode,
  onFilesAdded,
  onZoom,
  onCrop,
  onLabel,
}: {
  players: TierlistPlayer[];
  activePlayerId: string | null;
  imageStyle: ImageStyle;
  zoomMode: boolean;
  cropMode: boolean;
  labelMode: boolean;
  onFilesAdded: (files: FileList) => void;
  onZoom: (id: string) => void;
  onCrop: (id: string) => void;
  onLabel: (id: string) => void;
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
              imageStyle={imageStyle}
              zoomMode={zoomMode}
              cropMode={cropMode}
              labelMode={labelMode}
              onZoom={onZoom}
              onCrop={onCrop}
              onLabel={onLabel}
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

// ── Helpers ────────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const bytes = atob(data);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

// ── Main component ─────────────────────────────────────────────────────────

export default function TierlistBoard({
  initialImages,
  mode = "play",
}: TierlistBoardProps) {
  // ── Tier state ───────────────────────────────────────────────────────────
  const [tiers, setTiers] = useState<TierRowData[]>(() => DEFAULT_TIER_ROWS);

  const [tierMap, setTierMap] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {
      unranked: initialImages?.map((img) => img.id) ?? [],
    };
    for (const t of DEFAULT_TIER_ROWS) map[t.id] = [];
    return map;
  });

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

  const [fileMap, setFileMap] = useState<Record<string, File>>({});

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeId, setActiveId]         = useState<string | null>(null);
  const [imageStyle, setImageStyle]     = useState<ImageStyle>("square");
  const [zoomMode, setZoomMode]         = useState(false);
  const [cropMode, setCropMode]         = useState(false);
  const [labelMode, setLabelMode]       = useState(false);
  const [zoomedId, setZoomedId]         = useState<string | null>(null);
  const [croppingId, setCroppingId]     = useState<string | null>(null);
  const [labelingId, setLabelingId]     = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDownloading, setIsDownloading]     = useState(false);

  const tiersRef = useRef<HTMLDivElement>(null);
  const tierMapRef = useRef(tierMap);
  useLayoutEffect(() => { tierMapRef.current = tierMap; });

  const containerIdsRef = useRef<Set<string>>(new Set());
  useLayoutEffect(() => {
    containerIdsRef.current = new Set([...tiers.map((t) => t.id), "unranked"]);
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Image upload ─────────────────────────────────────────────────────────

  async function handleFilesAdded(files: FileList) {
    const newPlayers: TierlistPlayer[] = [];
    const newFiles: Record<string, File> = {};
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file).catch(() => file);
      const id = crypto.randomUUID();
      newPlayers.push({
        id, topic_id: "",
        name: file.name.replace(/\.[^/.]+$/, ""),
        position: null, club: null,
        image_url: URL.createObjectURL(compressed),
        created_at: new Date().toISOString(),
      });
      newFiles[id] = compressed;
    }
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
    if (tiers.length <= 1) return; // minimum 1 row
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

  // ── Zoom / crop mode toggles ─────────────────────────────────────────────

  function toggleZoom() {
    setZoomMode((v) => { if (!v) { setCropMode(false); setLabelMode(false); } return !v; });
  }
  function toggleCrop() {
    setCropMode((v) => { if (!v) { setZoomMode(false); setLabelMode(false); } return !v; });
  }
  function toggleLabel() {
    setLabelMode((v) => { if (!v) { setZoomMode(false); setCropMode(false); } return !v; });
  }

  // ── Crop result handler ──────────────────────────────────────────────────

  function handleLabelResult(playerId: string, label: string) {
    setPlayerMap((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], label: label || undefined },
    }));
    setLabelingId(null);
  }

  function handleCropResult(playerId: string, dataUrl: string) {
    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], "cropped.png", { type: "image/png" });
    setPlayerMap((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], image_url: dataUrl },
    }));
    setFileMap((prev) => ({ ...prev, [playerId]: file }));
    setCroppingId(null);
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

  // ── DnD helpers ──────────────────────────────────────────────────────────

  const findContainer = useCallback(
    (id: string): string | undefined => {
      for (const key of [...tiers.map((t) => t.id), "unranked"]) {
        if (tierMap[key]?.includes(id)) return key;
      }
      return undefined;
    },
    [tierMap, tiers]
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    const containerHit = pointerCollisions.find((c) =>
      containerIdsRef.current.has(c.id as string)
    );
    if (containerHit) {
      const itemIds = tierMapRef.current[containerHit.id as string] ?? [];
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
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setTierMap((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const overIndex = overItems.indexOf(oId);
      const newIndex = containerIdsRef.current.has(oId)
        ? overItems.length
        : overIndex >= 0 ? overIndex : overItems.length;
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
    if (!activeContainer || !overContainer || activeContainer !== overContainer) return;
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

  // ── Derived ──────────────────────────────────────────────────────────────

  const totalImages = Object.values(playerMap).length;
  const rankedCount = tiers.reduce((sum, t) => sum + (tierMap[t.id]?.length ?? 0), 0);
  const allImagesForUpload = Object.values(playerMap).map((p) => ({
    id: p.id,
    name: p.name,
    image_url: p.image_url ?? "",
    file: fileMap[p.id],
  }));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          {/* Tier rows — wrapped for screenshot */}
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
                isOnlyRow={tiers.length === 1}
                imageStyle={imageStyle}
                zoomMode={zoomMode}
                cropMode={cropMode}
                labelMode={labelMode}
                onLabelChange={(label) => updateTierLabel(tier.id, label)}
                onColorChange={(color) => updateTierColor(tier.id, color)}
                onDelete={() => deleteTier(tier.id)}
                onClear={() => clearTier(tier.id)}
                onAddAbove={() => addTier(tier.id, "above")}
                onAddBelow={() => addTier(tier.id, "below")}
                onZoom={setZoomedId}
                onCrop={setCroppingId}
                onLabel={setLabelingId}
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
            imageStyle={imageStyle}
            zoomMode={zoomMode}
            cropMode={cropMode}
            labelMode={labelMode}
            onFilesAdded={handleFilesAdded}
            onZoom={setZoomedId}
            onCrop={setCroppingId}
            onLabel={setLabelingId}
          />

          <DragOverlay>
            {activeId && playerMap[activeId] ? (
              <div className="rotate-2 scale-105 opacity-95 shadow-2xl">
                <PlayerCard
                  player={playerMap[activeId]}
                  imageStyle={imageStyle}
                />
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

        {/* ── Toolbar ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">

            {/* Image style selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Style
              </span>
              <div className="flex gap-1">
                {STYLE_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setImageStyle(key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      imageStyle === key
                        ? "bg-indigo-600 text-white"
                        : "border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zoom / Crop tools */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={toggleZoom}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  zoomMode
                    ? "bg-sky-600 text-white"
                    : "border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                }`}
                title="Click an image to zoom in. Scroll to resize."
              >
                🔍 Zoom {zoomMode && <span className="text-sky-200">ON</span>}
              </button>
              <button
                onClick={toggleCrop}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  cropMode
                    ? "bg-amber-600 text-white"
                    : "border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                }`}
                title="Click an image to open the crop editor."
              >
                ✂ Crop {cropMode && <span className="text-amber-200">ON</span>}
              </button>
              <button
                onClick={toggleLabel}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  labelMode
                    ? "bg-emerald-600 text-white"
                    : "border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                }`}
                title="Click an image to add a text label."
              >
                T Label {labelMode && <span className="text-emerald-200">ON</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons — download always, upload only in create mode */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={handleDownload}
            disabled={isDownloading || totalImages === 0}
            className="rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDownloading ? "Generating…" : "⬇ Download as Image"}
          </button>
          {mode === "create" && (
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={totalImages === 0}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Upload Tierlist
            </button>
          )}
        </div>
      </div>

      {/* Overlays — rendered outside the board div to avoid z-index issues */}
      {showUploadModal && (
        <UploadTierlistModal
          images={allImagesForUpload}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      {zoomedId && playerMap[zoomedId] && (
        <ZoomOverlay
          imageUrl={playerMap[zoomedId].image_url ?? ""}
          imageName={playerMap[zoomedId].name}
          onClose={() => setZoomedId(null)}
        />
      )}

      {croppingId && playerMap[croppingId] && (
        <CropOverlay
          imageUrl={playerMap[croppingId].image_url ?? ""}
          imageName={playerMap[croppingId].name}
          onCrop={(dataUrl) => handleCropResult(croppingId, dataUrl)}
          onCancel={() => setCroppingId(null)}
        />
      )}

      {labelingId && playerMap[labelingId] && (
        <LabelOverlay
          imageUrl={playerMap[labelingId].image_url ?? ""}
          imageName={playerMap[labelingId].name}
          currentLabel={playerMap[labelingId].label ?? ""}
          onSave={(label) => handleLabelResult(labelingId, label)}
          onCancel={() => setLabelingId(null)}
        />
      )}
    </>
  );
}
