"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TierlistPlayer, ImageStyle } from "@/lib/types";
import { IMAGE_STYLE_DIMS, IMAGE_STYLE_DIMS_MOBILE } from "@/lib/types";

interface PlayerCardProps {
  player: TierlistPlayer;
  isDragging?: boolean;
  imageStyle?: ImageStyle;
  zoomMode?: boolean;
  cropMode?: boolean;
  labelMode?: boolean;
  removeMode?: boolean;
  isSelectedForRemoval?: boolean;
  onZoom?: (id: string) => void;
  onCrop?: (id: string) => void;
  onLabel?: (id: string) => void;
  onToggleRemove?: (id: string) => void;
  isMobile?: boolean;
  isTapSelected?: boolean;
  onTapSelect?: (id: string) => void;
}

export default function PlayerCard({
  player,
  isDragging = false,
  imageStyle = "square",
  zoomMode = false,
  cropMode = false,
  labelMode = false,
  removeMode = false,
  isSelectedForRemoval = false,
  onZoom,
  onCrop,
  onLabel,
  onToggleRemove,
  isMobile = false,
  isTapSelected = false,
  onTapSelect,
}: PlayerCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const anyMode = zoomMode || cropMode || labelMode || removeMode;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: player.id, disabled: anyMode });

  const dims = isMobile ? IMAGE_STYLE_DIMS_MOBILE[imageStyle] : IMAGE_STYLE_DIMS[imageStyle];
  const isActive = isDragging || isSortableDragging;

  function handleClick(e: React.MouseEvent) {
    if (isSortableDragging) return;
    if (removeMode && onToggleRemove) { e.stopPropagation(); onToggleRemove(player.id); return; }
    if (zoomMode && onZoom)          { e.stopPropagation(); onZoom(player.id);           return; }
    if (cropMode && onCrop)          { e.stopPropagation(); onCrop(player.id);           return; }
    if (labelMode && onLabel)        { e.stopPropagation(); onLabel(player.id);          return; }
    if (isMobile && onTapSelect && !anyMode) { e.stopPropagation(); onTapSelect(player.id); return; }
  }

  const initials = player.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        width: dims.width,
        height: dims.height,
        flexShrink: 0,
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`
        relative select-none overflow-hidden shadow ${isMobile ? "border" : "border-2"}
        ${dims.circle ? "rounded-full" : "rounded-md md:rounded-lg"}
        ${isActive ? "opacity-40 ring-2 ring-indigo-400" : ""}
        ${isTapSelected
          ? "border-indigo-400 ring-2 ring-indigo-400 ring-offset-1 ring-offset-gray-950"
          : removeMode && isSelectedForRemoval
          ? "border-red-500 ring-2 ring-red-500 ring-offset-1 ring-offset-gray-950"
          : removeMode
          ? "border-black hover:border-red-400"
          : "border-black"}
        ${anyMode
          ? "cursor-pointer active:cursor-pointer"
          : isMobile
          ? "cursor-pointer"
          : "cursor-grab active:cursor-grabbing"}
      `}
    >
      {player.image_url && !imgFailed ? (
        <>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundImage: `url("${player.image_url}")`,
              backgroundSize: dims.contain ? "contain" : "cover",
              backgroundPosition: player.faceCenter
                ? `${player.faceCenter.x}% ${player.faceCenter.y}%`
                : "center",
              backgroundRepeat: "no-repeat",
              backgroundColor: dims.contain ? "#1f2937" : undefined,
            }}
          />
          {/* Hidden img to detect broken images */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={player.image_url}
            alt=""
            className="sr-only"
            onError={() => setImgFailed(true)}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-800 text-[10px] text-gray-500">
          {player.image_url ? "Image unavailable" : initials}
        </div>
      )}

      {/* Label overlay */}
      {player.label && !dims.circle && (
        <div className="absolute bottom-0 left-0 right-0 bg-white px-0.5 py-px">
          <span className="block truncate text-center text-[9px] font-semibold leading-tight text-black">
            {player.label}
          </span>
        </div>
      )}

      {/* Remove mode: selected checkmark overlay */}
      {removeMode && isSelectedForRemoval && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white shadow">
            ✓
          </div>
        </div>
      )}

      {/* Remove mode: hover hint (unselected) */}
      {removeMode && !isSelectedForRemoval && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100 bg-red-900/20">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-red-400 bg-transparent" />
        </div>
      )}
    </div>
  );
}
