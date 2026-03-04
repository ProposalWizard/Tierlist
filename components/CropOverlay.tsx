"use client";

import { useState, useRef, useEffect } from "react";

interface Rect { x: number; y: number; w: number; h: number }

interface Props {
  imageUrl: string;
  imageName: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export default function CropOverlay({ imageUrl, imageName, onCrop, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [sel, setSel] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function relPos(e: React.MouseEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const pos = relPos(e);
    setStart(pos);
    setSel({ x: pos.x, y: pos.y, w: 0, h: 0 });
    setDragging(true);
    setError(null);
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    const pos = relPos(e);
    setSel({
      x: Math.min(pos.x, start.x),
      y: Math.min(pos.y, start.y),
      w: Math.abs(pos.x - start.x),
      h: Math.abs(pos.y - start.y),
    });
  }

  function onMouseUp() { setDragging(false); }

  function applyCrop() {
    if (!sel || sel.w < 5 || sel.h < 5 || !imgRef.current || !containerRef.current) return;
    setApplying(true);

    const cRect = containerRef.current.getBoundingClientRect();
    const scaleX = imgRef.current.naturalWidth  / cRect.width;
    const scaleY = imgRef.current.naturalHeight / cRect.height;

    const cropX = sel.x * scaleX;
    const cropY = sel.y * scaleY;
    const cropW = sel.w * scaleX;
    const cropH = sel.h * scaleY;

    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(cropW);
    canvas.height = Math.round(cropH);
    const ctx = canvas.getContext("2d")!;

    // Try with CORS first (needed for Supabase URLs), fall back to tainted canvas
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      try {
        onCrop(canvas.toDataURL("image/png"));
      } catch {
        setError("Could not crop this image (cross-origin restriction). Try downloading and re-uploading it.");
        setApplying(false);
      }
    };
    img.onerror = () => {
      // CORS failed — try without (canvas will be tainted, can't export)
      const img2 = new Image();
      img2.onload = () => {
        ctx.drawImage(img2, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
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

  const canApply = sel && sel.w >= 5 && sel.h >= 5;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm p-4">
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5">
        <p className="text-sm text-gray-300">Drag to select the crop area</p>
        <button
          onClick={applyCrop}
          disabled={!canApply || applying}
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

      {/* Image + crop overlay */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-xl"
        style={{ cursor: "crosshair", display: "inline-block" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt={imageName}
          draggable={false}
          className="block rounded-xl"
          style={{
            maxWidth: "88vw",
            maxHeight: "72vh",
            objectFit: "contain",
            userSelect: "none",
          }}
        />

        {/* Dark overlay panels around selection */}
        {sel && sel.w > 2 && sel.h > 2 && (() => {
          const { x, y, w, h } = sel;
          return (
            <div className="pointer-events-none absolute inset-0">
              {/* Top */}
              <div className="absolute left-0 right-0 top-0 bg-black/55" style={{ height: y }} />
              {/* Bottom */}
              <div className="absolute left-0 right-0 bottom-0 bg-black/55" style={{ top: y + h }} />
              {/* Left */}
              <div className="absolute left-0 bg-black/55" style={{ top: y, height: h, width: x }} />
              {/* Right */}
              <div className="absolute right-0 bg-black/55" style={{ top: y, height: h, left: x + w }} />
              {/* Selection border */}
              <div
                className="absolute border-2 border-white"
                style={{ left: x, top: y, width: w, height: h }}
              />
              {/* Corner handles */}
              {[[x-3,y-3],[x+w-3,y-3],[x-3,y+h-3],[x+w-3,y+h-3]].map(([lx,ly], i) => (
                <div
                  key={i}
                  className="absolute h-2.5 w-2.5 rounded-sm bg-white"
                  style={{ left: lx, top: ly }}
                />
              ))}
            </div>
          );
        })()}
      </div>

      <p className="mt-3 text-xs text-gray-500">Press Esc to cancel</p>
    </div>
  );
}
