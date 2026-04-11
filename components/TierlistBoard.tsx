"use client";

import {
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
  useEffect,
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
import { compressImage, isAllowedImageType, ACCEPT_IMAGE_TYPES } from "@/lib/imageUtils";
import { processImage, detectFaceFromUrl } from "@/lib/faceDetection";
import {
  DEFAULT_TIER_ROWS,
  type TierRowData,
  type TierlistPlayer,
  type ImageStyle,
} from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface TierlistBoardProps {
  initialImages?: Array<{
    id: string;
    name: string;
    image_url: string;
    /** Server-provided face position (0–100 percentages). Null if not yet detected. */
    face_center?: { x: number; y: number } | null;
  }>;
  mode?: "play" | "create";
  isAdmin?: boolean;
  /** For Save to Profile feature */
  tierlistId?: string;
  tierlistTitle?: string;
  isLoggedIn?: boolean;
  /** Custom tier rows from DB — overrides the default S/A/B/C/D tiers */
  initialTiers?: Array<{ label: string; color: string }>;
}

// ── Unranked pool ──────────────────────────────────────────────────────────

function UnrankedPool({
  players,
  activePlayerId,
  imageStyle,
  zoomMode,
  cropMode,
  labelMode,
  removeMode,
  selectedForRemoval,
  isAddingImages,
  onFilesAdded,
  onZoom,
  onCrop,
  onLabel,
  onToggleRemove,
  isMobile = false,
  tapSelectedId = null,
  onTapSelect,
}: {
  players: TierlistPlayer[];
  activePlayerId: string | null;
  imageStyle: ImageStyle;
  zoomMode: boolean;
  cropMode: boolean;
  labelMode: boolean;
  removeMode: boolean;
  selectedForRemoval: Set<string>;
  isAddingImages: boolean;
  onFilesAdded: (files: FileList) => void;
  onZoom: (id: string) => void;
  onCrop: (id: string) => void;
  onLabel: (id: string) => void;
  onToggleRemove: (id: string) => void;
  isMobile?: boolean;
  tapSelectedId?: string | null;
  onTapSelect?: (id: string) => void;
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
          {isMobile ? "Unranked — tap image, then tap a tier" : "Unranked — drag into a tier"}
        </h3>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT_IMAGE_TYPES}
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
          className={`cursor-pointer rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700 ${
            isAddingImages ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {isAddingImages ? "Processing..." : "+ Add Images"}
        </label>
      </div>

      <div className="flex min-h-[60px] md:min-h-[88px] flex-wrap gap-[3px] md:gap-2">
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
        {players.length === 0 && (
          <span className="flex items-center text-xs text-gray-600 italic">
            {isMobile ? "Tap \"+ Add Images\" to get started" : "Click \"+ Add Images\" to get started"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Maximum file size allowed for a single image (5 MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Maximum number of image uploads allowed per minute */
const RATE_LIMIT_MAX = 25;
const RATE_LIMIT_WINDOW_MS = 60_000;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Simple client-side rate limiter: tracks timestamps of recent uploads */
const uploadTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  // Remove timestamps outside the window
  while (uploadTimestamps.length > 0 && uploadTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    uploadTimestamps.shift();
  }
  return uploadTimestamps.length >= RATE_LIMIT_MAX;
}

function recordUpload() {
  uploadTimestamps.push(Date.now());
}

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
  isAdmin: isAdminUser = false,
  tierlistId,
  tierlistTitle,
  isLoggedIn = false,
  initialTiers,
}: TierlistBoardProps) {
  // ── Tier state ───────────────────────────────────────────────────────────
  const [tiers, setTiers] = useState<TierRowData[]>(() => {
    if (initialTiers && initialTiers.length > 0) {
      return initialTiers.map((t, i) => ({
        id: `tier-${i}`,
        label: t.label,
        color: t.color,
      }));
    }
    return DEFAULT_TIER_ROWS;
  });

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
            // SSR-provided face centre — renders correctly on first paint,
            // no flash, no client-side detection needed for images that
            // already have a persisted face_center in the database.
            faceCenter: img.face_center ?? undefined,
            created_at: "",
          } satisfies TierlistPlayer,
        ])
      );
    }
  );

  const [fileMap, setFileMap] = useState<Record<string, File>>({});
  const [hasModified, setHasModified] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeId, setActiveId]         = useState<string | null>(null);
  const imageStyle: ImageStyle          = "square";
  const [zoomMode, setZoomMode]         = useState(false);
  const [cropMode, setCropMode]         = useState(false);
  const [labelMode, setLabelMode]       = useState(false);
  const [removeMode, setRemoveMode]     = useState(false);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());
  const [zoomedId, setZoomedId]         = useState<string | null>(null);
  const [croppingId, setCroppingId]     = useState<string | null>(null);
  const [labelingId, setLabelingId]     = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDownloading, setIsDownloading]     = useState(false);
  const [isSharing, setIsSharing]             = useState(false);
  const [isSavingToProfile, setIsSavingToProfile] = useState(false);
  const [savedToProfile, setSavedToProfile]       = useState(false);
  const [isAddingImages, setIsAddingImages]   = useState(false);
  // User-facing error/success banner
  const [boardError, setBoardError]           = useState<string | null>(null);

  // ── Mobile tap-to-place ──────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [tapSelectedId, setTapSelectedId] = useState<string | null>(null);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Lazy backfill: for images that don't yet have a persisted face_center
  // in the DB (pre-existing rows from before this feature shipped), run
  // detection client-side once, then POST the result to the backfill
  // endpoint so every subsequent visitor gets it instantly from SSR.
  //
  // Images WITH a face_center from SSR skip this entirely — zero flash,
  // zero work, the position is already in the rendered HTML.
  useEffect(() => {
    if (!initialImages?.length) return;
    const missing = initialImages.filter((img) => !img.face_center);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const img of missing) {
        if (cancelled) break;
        const fc = await detectFaceFromUrl(img.image_url).catch(() => null);
        if (cancelled) break;
        if (!fc) continue;

        // Update local state so the current visitor sees the new position.
        setPlayerMap((prev) => {
          const existing = prev[img.id];
          if (!existing) return prev;
          return { ...prev, [img.id]: { ...existing, faceCenter: fc } };
        });

        // Persist to DB so future visitors get it via SSR with no flash.
        // Fire-and-forget — failure just means we'll retry next visit.
        fetch(`/api/tierlist-images/${img.id}/face-center`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ face_center: fc }),
        }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [initialImages]);

  /** Move the tap-selected image to the given tier (mobile bottom bar) */
  function handleMobilePlace(tierId: string) {
    if (!tapSelectedId) return;
    const fromContainer = Object.keys(tierMap).find((key) =>
      tierMap[key]?.includes(tapSelectedId)
    );
    if (!fromContainer) { setTapSelectedId(null); return; }
    if (fromContainer === tierId) { setTapSelectedId(null); return; }
    setTierMap((prev) => ({
      ...prev,
      [fromContainer]: prev[fromContainer].filter((id) => id !== tapSelectedId),
      [tierId]: [...(prev[tierId] ?? []), tapSelectedId],
    }));

    // Auto-advance: select the next unranked image
    const unrankedIds = tierMap.unranked.filter((id) => id !== tapSelectedId);
    setTapSelectedId(unrankedIds.length > 0 ? unrankedIds[0] : null);
  }

  const tiersRef = useRef<HTMLDivElement>(null);
  const tierMapRef = useRef(tierMap);
  useLayoutEffect(() => { tierMapRef.current = tierMap; });

  const containerIdsRef = useRef<Set<string>>(new Set());
  useLayoutEffect(() => {
    containerIdsRef.current = new Set([...tiers.map((t) => t.id), "unranked"]);
  });

  const desktopSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const emptySensors = useSensors();
  const sensors = isMobile ? emptySensors : desktopSensors;

  // ── Image upload ─────────────────────────────────────────────────────────

  async function handleFilesAdded(files: FileList) {
    setBoardError(null);

    // Rate limit check (admins are exempt)
    if (!isAdminUser && isRateLimited()) {
      setBoardError("Upload limit reached. Please wait a minute.");
      return;
    }

    // Validate file types (JPG, PNG, WEBP only) and sizes (5 MB max)
    const validFiles: File[] = [];
    const rejectedType: string[] = [];
    const rejectedSize: string[] = [];
    for (const file of Array.from(files)) {
      if (!isAllowedImageType(file)) {
        rejectedType.push(file.name);
      } else if (file.size > MAX_FILE_SIZE) {
        rejectedSize.push(file.name);
      } else {
        validFiles.push(file);
      }
    }

    if (rejectedType.length > 0) {
      setBoardError("Unsupported image format. Allowed: JPG, PNG, WEBP, GIF, SVG, BMP, AVIF.");
      if (validFiles.length === 0) return;
    } else if (rejectedSize.length > 0) {
      setBoardError(
        rejectedSize.length === 1
          ? `"${rejectedSize[0]}" is too large. Maximum size is 5 MB.`
          : `${rejectedSize.length} image(s) exceeded the 5 MB size limit and were skipped.`
      );
    }

    if (validFiles.length === 0) return;

    setIsAddingImages(true);

    try {
      const newPlayers: TierlistPlayer[] = [];
      const newFiles: Record<string, File> = {};
      for (const file of validFiles) {
        const compressed = await compressImage(file).catch(() => file);
        // Detect face position (non-destructive — file is NOT modified)
        const { file: original, faceCenter } = await processImage(compressed).catch(() => ({ file: compressed, faceCenter: null }));
        const id = crypto.randomUUID();
        newPlayers.push({
          id, topic_id: "",
          name: file.name.replace(/\.[^/.]+$/, ""),
          position: null, club: null,
          image_url: URL.createObjectURL(original),
          created_at: new Date().toISOString(),
          faceCenter,
        });
        newFiles[id] = original;
        recordUpload();
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
      setHasModified(true);
    } catch (err) {
      console.error("Image upload error:", err);
      setBoardError("Failed to process images. Please try again.");
    } finally {
      setIsAddingImages(false);
    }
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

  // ── Mode toggles ─────────────────────────────────────────────────────────

  function setExclusiveMode(mode: "zoom" | "crop" | "label" | "remove" | null) {
    setZoomMode(mode === "zoom");
    setCropMode(mode === "crop");
    setLabelMode(mode === "label");
    setRemoveMode(mode === "remove");
    if (mode !== "remove") setSelectedForRemoval(new Set());
  }

  function toggleZoom() {
    setExclusiveMode(zoomMode ? null : "zoom");
  }
  function toggleCrop() {
    setExclusiveMode(cropMode ? null : "crop");
  }
  function toggleLabel() {
    setExclusiveMode(labelMode ? null : "label");
  }
  function toggleRemove() {
    if (removeMode) {
      setSelectedForRemoval(new Set());
      setExclusiveMode(null);
    } else {
      setExclusiveMode("remove");
    }
  }

  function toggleRemoveSelection(id: string) {
    setSelectedForRemoval((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    const toDelete = Array.from(selectedForRemoval);
    setPlayerMap((prev) => {
      const next = { ...prev };
      for (const id of toDelete) delete next[id];
      return next;
    });
    setTierMap((prev) => {
      const toDeleteSet = new Set(toDelete);
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter((id) => !toDeleteSet.has(id));
      }
      return next;
    });
    setSelectedForRemoval(new Set());
    setRemoveMode(false);
    setHasModified(true);
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
    setBoardError(null);
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
    } catch (err) {
      console.error("Download error:", err);
      setBoardError("Failed to generate tierlist image. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  // ── Share on X ───────────────────────────────────────────────────────────

  async function handleShareX() {
    if (!tiersRef.current || isSharing) return;
    setIsSharing(true);
    setBoardError(null);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(tiersRef.current, {
        backgroundColor: "#111827",
        useCORS: true,
        allowTaint: true,
        scale: 2,
      });

      // Download the tierlist image
      const link = document.createElement("a");
      link.download = "my-tierlist.png";
      link.href = canvas.toDataURL("image/png");
      link.click();

      // Open Twitter intent in a new tab
      const pageUrl = window.location.href;
      const twitterUrl =
        `https://twitter.com/intent/tweet?text=${encodeURIComponent("Check out my tierlist!")}&url=${encodeURIComponent(pageUrl)}`;
      window.open(twitterUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Share error:", err);
      setBoardError("Failed to generate tierlist image for sharing. Please try again.");
    } finally {
      setIsSharing(false);
    }
  }

  // ── Save to Profile ─────────────────────────────────────────────────────

  async function handleSaveToProfile() {
    if (!tiersRef.current || isSavingToProfile || !isLoggedIn) return;
    setIsSavingToProfile(true);
    setBoardError(null);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(tiersRef.current, {
        backgroundColor: "#111827",
        useCORS: true,
        allowTaint: true,
        scale: 2,
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))), "image/png");
      });

      const formData = new FormData();
      formData.append("image", blob, "tierlist.png");
      if (tierlistTitle) formData.append("tierlist_title", tierlistTitle);
      if (tierlistId) formData.append("tierlist_id", tierlistId);

      const res = await fetch("/api/profile/images", { method: "POST", body: formData });
      if (res.ok) {
        setSavedToProfile(true);
        setTimeout(() => setSavedToProfile(false), 3000);
      } else {
        setBoardError("Failed to save image to profile. Please try again.");
      }
    } catch (err) {
      console.error("Save to profile error:", err);
      setBoardError("Failed to save image to profile. Please try again.");
    } finally {
      setIsSavingToProfile(false);
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
  // Preserve visual order: tier rows first (top to bottom), then unranked
  const orderedIds = [
    ...tiers.flatMap((t) => tierMap[t.id] ?? []),
    ...(tierMap.unranked ?? []),
  ];
  const allImagesForUpload = orderedIds
    .map((id) => playerMap[id])
    .filter(Boolean)
    .map((p) => ({
      id: p.id,
      name: p.name,
      image_url: p.image_url ?? "",
      file: fileMap[p.id],
      face_center: p.faceCenter ?? null,
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
          <div ref={tiersRef} className="space-y-0 md:space-y-2 rounded-none md:rounded-xl bg-gray-950 p-0 md:p-2">
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
                removeMode={removeMode}
                selectedForRemoval={selectedForRemoval}
                onLabelChange={(label) => updateTierLabel(tier.id, label)}
                onColorChange={(color) => updateTierColor(tier.id, color)}
                onDelete={() => deleteTier(tier.id)}
                onClear={() => clearTier(tier.id)}
                onAddAbove={() => addTier(tier.id, "above")}
                onAddBelow={() => addTier(tier.id, "below")}
                onZoom={setZoomedId}
                onCrop={setCroppingId}
                onLabel={setLabelingId}
                onToggleRemove={toggleRemoveSelection}
                isMobile={isMobile}
                tapSelectedId={tapSelectedId}
                onTapSelect={(id) => setTapSelectedId(id === tapSelectedId ? null : id)}
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
            removeMode={removeMode}
            selectedForRemoval={selectedForRemoval}
            isAddingImages={isAddingImages}
            onFilesAdded={handleFilesAdded}
            onZoom={setZoomedId}
            onCrop={setCroppingId}
            onLabel={setLabelingId}
            onToggleRemove={toggleRemoveSelection}
            isMobile={isMobile}
            tapSelectedId={tapSelectedId}
            onTapSelect={(id) => setTapSelectedId(id === tapSelectedId ? null : id)}
          />

          {/* Zoom hint */}
          <p className="text-center text-xs text-gray-600 italic">
            Use the Zoom Feature to see Full Size Images
          </p>

          <DragOverlay>
            {activeId && playerMap[activeId] ? (
              <div className="opacity-90 shadow-2xl">
                <PlayerCard
                  player={playerMap[activeId]}
                  imageStyle={imageStyle}
                  isMobile={isMobile}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* ── Mobile bottom placement bar ── */}
        {isMobile && tapSelectedId && playerMap[tapSelectedId] && (
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-gray-950/95 px-3 py-2.5 backdrop-blur md:hidden">
            {/* Image info + close */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="h-10 w-10 flex-shrink-0 rounded-lg border border-gray-700 bg-gray-800"
                style={{
                  backgroundImage: `url("${playerMap[tapSelectedId].image_url}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {playerMap[tapSelectedId].name}
                </p>
              </div>
              <button
                onClick={() => setTapSelectedId(null)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            {/* Tier buttons grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {tiers.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => handleMobilePlace(tier.id)}
                  className="h-9 rounded-lg text-xs font-black text-gray-900 transition-all truncate px-1 active:scale-95"
                  style={{ backgroundColor: tier.color }}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Spacer for mobile bottom bar */}
        {isMobile && tapSelectedId && <div className="h-28 md:hidden" />}

        {/* Error / info banner */}
        {boardError && (
          <div className="flex items-center justify-between rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            <span>{boardError}</span>
            <button
              onClick={() => setBoardError(null)}
              className="ml-3 text-red-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Status bar */}
        {removeMode ? (
          <div className="flex items-center justify-between rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs">
            <span className="text-red-300">
              {selectedForRemoval.size === 0
                ? "Tap images to select them for removal"
                : `${selectedForRemoval.size} image${selectedForRemoval.size === 1 ? "" : "s"} selected`}
            </span>
            <div className="flex items-center gap-2">
              {selectedForRemoval.size > 0 && (
                <button
                  onClick={deleteSelected}
                  className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Delete {selectedForRemoval.size}
                </button>
              )}
              <button
                onClick={toggleRemove}
                className="rounded-lg border border-red-800 px-3 py-1 text-xs text-red-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : totalImages > 0 ? (
          <p className="text-right text-xs text-gray-500">
            {rankedCount} / {totalImages} images ranked
          </p>
        ) : null}

        {/* ── Toolbar ───────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900 px-2 py-2 md:px-4 md:py-3">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* Image tools */}
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <button
                onClick={toggleZoom}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  zoomMode
                    ? "bg-sky-600 text-white"
                    : "border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                }`}
                title="Click an image to zoom in."
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
              <button
                onClick={toggleRemove}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  removeMode
                    ? "bg-red-600 text-white"
                    : "border border-gray-700 text-gray-400 hover:border-red-600 hover:text-red-400"
                }`}
                title="Select images to remove them."
              >
                🗑 Remove {removeMode && <span className="text-red-200">ON</span>}
              </button>
              {removeMode && selectedForRemoval.size > 0 && (
                <button
                  onClick={deleteSelected}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500 animate-pulse"
                >
                  Delete {selectedForRemoval.size} image{selectedForRemoval.size === 1 ? "" : "s"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3 pt-1">
          <button
            onClick={handleDownload}
            disabled={isDownloading || totalImages === 0}
            className="rounded-xl border border-gray-700 px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDownloading ? "Generating…" : "⬇ Download"}
          </button>
          <button
            onClick={handleShareX}
            disabled={isSharing || totalImages === 0}
            className="rounded-xl border border-gray-700 px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSharing ? "Sharing…" : "𝕏 Share on X"}
          </button>
          {mode === "play" && isLoggedIn && (
            <button
              onClick={handleSaveToProfile}
              disabled={isSavingToProfile || savedToProfile || totalImages === 0}
              className={`rounded-xl px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                savedToProfile
                  ? "border border-green-500 bg-green-500/10 text-green-400"
                  : "border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white"
              }`}
            >
              {isSavingToProfile ? "Saving…" : savedToProfile ? "✓ Saved to Profile" : "💾 Save to Profile"}
            </button>
          )}
          {mode === "create" && (
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={totalImages === 0}
              className="rounded-xl bg-indigo-600 px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Upload Tierlist
            </button>
          )}
          {mode === "play" && hasModified && (
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={totalImages === 0}
              className="rounded-xl bg-indigo-600 px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save as New Tierlist
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
