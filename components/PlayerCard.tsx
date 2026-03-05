"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TierlistPlayer, ImageStyle } from "@/lib/types";
import { IMAGE_STYLE_DIMS } from "@/lib/types";

interface PlayerCardProps {
  player: TierlistPlayer;
  isDragging?: boolean;
  imageStyle?: ImageStyle;
  zoomMode?: boolean;
  cropMode?: boolean;
  labelMode?: boolean;
  onZoom?: (id: string) => void;
  onCrop?: (id: string) => void;
  onLabel?: (id: string) => void;
}

export default function PlayerCard({
  player,
  isDragging = false,
  imageStyle = "square",
  zoomMode = false,
  cropMode = false,
  labelMode = false,
  onZoom,
  onCrop,
  onLabel,
}: PlayerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: player.id });

  const dims = IMAGE_STYLE_DIMS[imageStyle];
  const isActive = isDragging || isSortableDragging;
  const interactive = zoomMode || cropMode || labelMode;

  function handleClick(e: React.MouseEvent) {
    if (isSortableDragging) return;
    if (zoomMode && onZoom)   { e.stopPropagation(); onZoom(player.id);  return; }
    if (cropMode && onCrop)   { e.stopPropagation(); onCrop(player.id);  return; }
    if (labelMode && onLabel) { e.stopPropagation(); onLabel(player.id); return; }
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
        relative select-none overflow-hidden shadow border-2 border-black
        ${dims.circle ? "rounded-full" : "rounded-lg"}
        ${isActive ? "opacity-40 ring-2 ring-indigo-400" : ""}
        ${interactive
          ? "cursor-pointer hover:ring-2 hover:ring-indigo-300 active:cursor-pointer"
          : "cursor-grab active:cursor-grabbing"}
      `}
    >
      {player.image_url ? (
        /*
         * Using a background-image div instead of <img> so that
         * html2canvas correctly respects the cover/contain cropping
         * when the user downloads the tierlist as an image.
         */
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage: `url("${player.image_url}")`,
            backgroundSize: dims.contain ? "contain" : "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundColor: dims.contain ? "#1f2937" : undefined,
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-indigo-700 text-sm font-bold text-white">
          {initials}
        </div>
      )}

      {/* Label overlay at the bottom of the card */}
      {player.label && !dims.circle && (
        <div className="absolute bottom-0 left-0 right-0 bg-white px-0.5 py-px">
          <span className="block truncate text-center text-[9px] font-semibold leading-tight text-black">
            {player.label}
          </span>
        </div>
      )}
    </div>
  );
}
