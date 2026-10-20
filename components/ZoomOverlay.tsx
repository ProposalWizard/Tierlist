"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Props {
  imageUrl: string;
  imageName: string;
  onClose: () => void;
}

const MIN = 0.5;
const MAX = 4;
const clampScale = (v: number) => Math.min(MAX, Math.max(MIN, v));

export default function ZoomOverlay({ imageUrl, imageName, onClose }: Props) {
  const [scale, setScale] = useState(1);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setScale((prev) => clampScale(prev - e.deltaY * 0.0015));
  }, []);

  useEffect(() => {
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Phone fix (20 Oct 2026): a phone has no mouse wheel, so the picture
  // could not be zoomed at all. Two fingers pinch it; the − and + buttons
  // work everywhere.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const spread = () => {
    const [a, b] = Array.from(pointers.current.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) pinch.current = { dist: spread(), scale };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current && pinch.current.dist > 0) {
      setScale(clampScale(pinch.current.scale * (spread() / pinch.current.dist)));
    }
  };
  // A pinch must not close the picture: its fingers lift on the backdrop.
  const pinchEndAt = useRef(0);
  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2 && pinch.current) { pinch.current = null; pinchEndAt.current = Date.now(); }
  };
  const step = (by: number) => setScale((s) => clampScale(Math.round((s + by) * 4) / 4));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      style={{ touchAction: "none" }}
      onClick={() => { if (Date.now() - pinchEndAt.current < 500) return; onClose(); }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {/* Image — stops click from bubbling to backdrop */}
      <div
        className="max-w-[90vw] max-h-[90vh]"
        style={{ transform: `scale(${scale})`, transition: "transform 0.08s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imageName}
          draggable={false}
          className="block max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
        />
      </div>

      <div
        className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => step(-0.25)}
          disabled={scale <= MIN}
          aria-label="Zoom out"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl font-bold text-white ring-1 ring-white/30 hover:bg-white/25 disabled:opacity-40"
        >
          −
        </button>
        <span className="w-14 text-center text-sm font-bold tabular-nums text-white">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => step(0.25)}
          disabled={scale >= MAX}
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl font-bold text-white ring-1 ring-white/30 hover:bg-white/25 disabled:opacity-40"
        >
          +
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-3 text-xs text-white select-none">
        Pinch, scroll or use − / + to zoom · Tap outside to close
      </p>
    </div>
  );
}
