"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  imageUrl: string;
  imageName: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

/**
 * Square crop overlay — the user drags the image behind a fixed square window.
 * Supports pinch/scroll zoom and touch drag.
 */
export default function CropOverlay({ imageUrl, imageName, onCrop, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Position of the image relative to the crop window (px offset)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  // Size of the square crop window
  const CROP_SIZE = 280;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Load the image to get natural dimensions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      // Set initial zoom so image covers the crop square
      const minScale = CROP_SIZE / Math.min(img.naturalWidth, img.naturalHeight);
      setZoom(Math.max(minScale, 1));
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
      // Try without CORS
      const img2 = new Image();
      img2.onload = () => {
        setNaturalSize({ w: img2.naturalWidth, h: img2.naturalHeight });
        const minScale = CROP_SIZE / Math.min(img2.naturalWidth, img2.naturalHeight);
        setZoom(Math.max(minScale, 1));
        setOffset({ x: 0, y: 0 });
      };
      img2.onerror = () => setError("Failed to load image.");
      img2.src = imageUrl;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Clamp offset so image always covers the crop square
  const clampOffset = useCallback(
    (ox: number, oy: number, z: number) => {
      if (!naturalSize) return { x: ox, y: oy };
      const imgW = naturalSize.w * z;
      const imgH = naturalSize.h * z;
      // Image center is at (CROP_SIZE/2 + ox, CROP_SIZE/2 + oy)
      // Image left edge = CROP_SIZE/2 + ox - imgW/2 must be <= 0
      // Image right edge = CROP_SIZE/2 + ox + imgW/2 must be >= CROP_SIZE
      const maxX = Math.max(0, (imgW - CROP_SIZE) / 2);
      const maxY = Math.max(0, (imgH - CROP_SIZE) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, ox)),
        y: Math.min(maxY, Math.max(-maxY, oy)),
      };
    },
    [naturalSize]
  );

  // Mouse/touch drag handlers
  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, zoom));
  }

  function onPointerUp() {
    setDragging(false);
  }

  // Scroll to zoom
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (!naturalSize) return;
    const minScale = CROP_SIZE / Math.min(naturalSize.w, naturalSize.h);
    const newZoom = Math.max(minScale, Math.min(zoom - e.deltaY * 0.002, 5));
    setZoom(newZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, newZoom));
  }

  function applyCrop() {
    if (!naturalSize) return;
    setApplying(true);

    const canvas = document.createElement("canvas");
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext("2d")!;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Calculate source rect in natural image coords
      const imgW = naturalSize.w * zoom;
      const imgH = naturalSize.h * zoom;
      const imgLeft = CROP_SIZE / 2 + offset.x - imgW / 2;
      const imgTop = CROP_SIZE / 2 + offset.y - imgH / 2;

      // The crop window is (0,0)→(CROP_SIZE,CROP_SIZE) in display coords
      // Source in natural: sx = (0 - imgLeft) / zoom, etc.
      const sx = (0 - imgLeft) / zoom;
      const sy = (0 - imgTop) / zoom;
      const sw = CROP_SIZE / zoom;
      const sh = CROP_SIZE / zoom;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CROP_SIZE, CROP_SIZE);
      try {
        onCrop(canvas.toDataURL("image/png"));
      } catch {
        setError("Could not crop this image (cross-origin restriction). Try re-uploading it.");
        setApplying(false);
      }
    };
    img.onerror = () => {
      // Try without CORS
      const img2 = new Image();
      img2.onload = () => {
        const imgW = naturalSize.w * zoom;
        const imgH = naturalSize.h * zoom;
        const imgLeft = CROP_SIZE / 2 + offset.x - imgW / 2;
        const imgTop = CROP_SIZE / 2 + offset.y - imgH / 2;
        const sx = (0 - imgLeft) / zoom;
        const sy = (0 - imgTop) / zoom;
        const sw = CROP_SIZE / zoom;
        const sh = CROP_SIZE / zoom;
        ctx.drawImage(img2, sx, sy, sw, sh, 0, 0, CROP_SIZE, CROP_SIZE);
        try {
          onCrop(canvas.toDataURL("image/png"));
        } catch {
          setError("Could not crop this image due to a cross-origin restriction. Re-upload the image to crop it.");
          setApplying(false);
        }
      };
      img2.src = imageUrl;
    };
    img.src = imageUrl;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm p-4">
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5">
        <p className="text-sm text-gray-300">Drag image to position · scroll to zoom</p>
        <button
          onClick={applyCrop}
          disabled={!naturalSize || applying}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {applying ? "Applying…" : "Apply Crop"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-600 px-4 py-1.5 text-sm text-gray-300 transition-colors hover:border-gray-400 hover:text-white"
        >
          Cancel
        </button>
      </div>

      {error && (
        <p className="mb-3 max-w-md text-center text-sm text-red-400">{error}</p>
      )}

      {/* Crop area — fixed square with movable image behind */}
      {naturalSize && (
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl border-2 border-white/30"
          style={{
            width: CROP_SIZE,
            height: CROP_SIZE,
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageName}
            draggable={false}
            className="pointer-events-none select-none"
            style={{
              position: "absolute",
              width: naturalSize.w * zoom,
              height: naturalSize.h * zoom,
              left: CROP_SIZE / 2 + offset.x - (naturalSize.w * zoom) / 2,
              top: CROP_SIZE / 2 + offset.y - (naturalSize.h * zoom) / 2,
              maxWidth: "none",
            }}
          />
          {/* Corner indicators */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-white/60" />
            <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-white/60" />
            <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-white/60" />
            <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-white/60" />
            {/* Grid lines */}
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
          </div>
        </div>
      )}

      {!naturalSize && !error && (
        <p className="text-sm text-gray-500">Loading image…</p>
      )}

      {/* Zoom slider */}
      {naturalSize && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-gray-500">Zoom</span>
          <input
            type="range"
            min={CROP_SIZE / Math.min(naturalSize.w, naturalSize.h)}
            max={5}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              const z = parseFloat(e.target.value);
              setZoom(z);
              setOffset((prev) => clampOffset(prev.x, prev.y, z));
            }}
            className="w-40 accent-indigo-500"
          />
          <span className="w-10 text-right text-xs text-gray-400">{Math.round(zoom * 100)}%</span>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500">Press Esc to cancel</p>
    </div>
  );
}
