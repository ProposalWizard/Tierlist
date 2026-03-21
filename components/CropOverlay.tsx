"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  imageUrl: string;
  imageName: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
  /** Aspect ratio width:height. Default 1 (square). E.g. 3/2 for landscape. */
  aspectRatio?: number;
}

/**
 * Crop overlay — the user drags the image behind a fixed crop window.
 * Supports pinch/scroll zoom and touch drag.
 * Supports configurable aspect ratio (default: square).
 */
export default function CropOverlay({ imageUrl, imageName, onCrop, onCancel, aspectRatio = 1 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Position of the image relative to the crop window (px offset)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  // Crop window dimensions based on aspect ratio
  const CROP_BASE = 280;
  const CROP_W = aspectRatio >= 1 ? CROP_BASE : Math.round(CROP_BASE * aspectRatio);
  const CROP_H = aspectRatio >= 1 ? Math.round(CROP_BASE / aspectRatio) : CROP_BASE;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Prevent background scroll when overlay is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  // Load the image to get natural dimensions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      // Set initial zoom so image covers the crop window
      const minScale = Math.max(CROP_W / img.naturalWidth, CROP_H / img.naturalHeight);
      setZoom(Math.max(minScale, 1));
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
      // Try without CORS
      const img2 = new Image();
      img2.onload = () => {
        setNaturalSize({ w: img2.naturalWidth, h: img2.naturalHeight });
        const minScale = Math.max(CROP_W / img2.naturalWidth, CROP_H / img2.naturalHeight);
        setZoom(Math.max(minScale, 1));
        setOffset({ x: 0, y: 0 });
      };
      img2.onerror = () => setError("Failed to load image.");
      img2.src = imageUrl;
    };
    img.src = imageUrl;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Clamp offset so image always covers the crop window
  const clampOffset = useCallback(
    (ox: number, oy: number, z: number) => {
      if (!naturalSize) return { x: ox, y: oy };
      const imgW = naturalSize.w * z;
      const imgH = naturalSize.h * z;
      const maxX = Math.max(0, (imgW - CROP_W) / 2);
      const maxY = Math.max(0, (imgH - CROP_H) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, ox)),
        y: Math.min(maxY, Math.max(-maxY, oy)),
      };
    },
    [naturalSize, CROP_W, CROP_H]
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

  // Scroll to zoom — uses native event listener with passive:false to properly prevent scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !naturalSize) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (!naturalSize) return;
      const minScale = Math.max(CROP_W / naturalSize.w, CROP_H / naturalSize.h);
      setZoom((prevZoom) => {
        const newZoom = Math.max(minScale, Math.min(prevZoom - e.deltaY * 0.002, 5));
        setOffset((prev) => clampOffset(prev.x, prev.y, newZoom));
        return newZoom;
      });
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [naturalSize, CROP_W, CROP_H, clampOffset]);

  function applyCrop() {
    if (!naturalSize) return;
    setApplying(true);

    const canvas = document.createElement("canvas");
    canvas.width = CROP_W;
    canvas.height = CROP_H;
    const ctx = canvas.getContext("2d")!;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const imgW = naturalSize.w * zoom;
      const imgH = naturalSize.h * zoom;
      const imgLeft = CROP_W / 2 + offset.x - imgW / 2;
      const imgTop = CROP_H / 2 + offset.y - imgH / 2;

      const sx = (0 - imgLeft) / zoom;
      const sy = (0 - imgTop) / zoom;
      const sw = CROP_W / zoom;
      const sh = CROP_H / zoom;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CROP_W, CROP_H);
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
        const imgLeft = CROP_W / 2 + offset.x - imgW / 2;
        const imgTop = CROP_H / 2 + offset.y - imgH / 2;
        const sx = (0 - imgLeft) / zoom;
        const sy = (0 - imgTop) / zoom;
        const sw = CROP_W / zoom;
        const sh = CROP_H / zoom;
        ctx.drawImage(img2, sx, sy, sw, sh, 0, 0, CROP_W, CROP_H);
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

      {/* Crop area — fixed window with movable image behind */}
      {naturalSize && (
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl border-2 border-white/30"
          style={{
            width: CROP_W,
            height: CROP_H,
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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
              left: CROP_W / 2 + offset.x - (naturalSize.w * zoom) / 2,
              top: CROP_H / 2 + offset.y - (naturalSize.h * zoom) / 2,
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
            min={Math.max(CROP_W / naturalSize.w, CROP_H / naturalSize.h)}
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
