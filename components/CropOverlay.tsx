"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  imageUrl: string;
  imageName: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
  /** Aspect ratio width:height. Default 1 (square). E.g. 3/2 for landscape. Ignored when freeform=true. */
  aspectRatio?: number;
  /** When true, shows the full image with a draggable/resizable crop rectangle instead of a fixed window. */
  freeform?: boolean;
}

export default function CropOverlay({ imageUrl, imageName, onCrop, onCancel, aspectRatio = 1, freeform = false }: Props) {
  if (freeform) {
    return <FreeformCrop imageUrl={imageUrl} imageName={imageName} onCrop={onCrop} onCancel={onCancel} />;
  }
  return <FixedCrop imageUrl={imageUrl} imageName={imageName} onCrop={onCrop} onCancel={onCancel} aspectRatio={aspectRatio} />;
}

/* ── Freeform crop: full image with resizable crop rectangle ── */
function FreeformCrop({ imageUrl, imageName, onCrop, onCancel }: { imageUrl: string; imageName: string; onCrop: (d: string) => void; onCancel: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dragMode, setDragMode] = useState<"move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, cx: 0, cy: 0, cw: 0, ch: 0 });

  const MIN_SIZE = 30;
  const MAX_DISPLAY = 560;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const handleLoad = (i: HTMLImageElement) => {
      setNaturalSize({ w: i.naturalWidth, h: i.naturalHeight });
      const scale = Math.min(MAX_DISPLAY / i.naturalWidth, MAX_DISPLAY / i.naturalHeight, 1);
      const dw = i.naturalWidth * scale;
      const dh = i.naturalHeight * scale;
      const pad = Math.min(dw, dh) * 0.05;
      setCrop({ x: pad, y: pad, w: dw - pad * 2, h: dh - pad * 2 });
    };
    img.onload = () => handleLoad(img);
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => handleLoad(img2);
      img2.onerror = () => setError("Failed to load image.");
      img2.src = imageUrl;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const displayScale = naturalSize ? Math.min(MAX_DISPLAY / naturalSize.w, MAX_DISPLAY / naturalSize.h, 1) : 1;
  const displayW = naturalSize ? naturalSize.w * displayScale : 0;
  const displayH = naturalSize ? naturalSize.h * displayScale : 0;

  const clampCrop = useCallback((c: { x: number; y: number; w: number; h: number }) => {
    let { x, y, w, h } = c;
    w = Math.max(MIN_SIZE, Math.min(w, displayW));
    h = Math.max(MIN_SIZE, Math.min(h, displayH));
    x = Math.max(0, Math.min(x, displayW - w));
    y = Math.max(0, Math.min(y, displayH - h));
    return { x, y, w, h };
  }, [displayW, displayH]);

  const onPointerDown = (e: React.PointerEvent, mode: typeof dragMode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode(mode);
    dragStart.current = { mx: e.clientX, my: e.clientY, cx: crop.x, cy: crop.y, cw: crop.w, ch: crop.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragMode) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const { cx, cy, cw, ch } = dragStart.current;

    if (dragMode === "move") {
      setCrop(clampCrop({ x: cx + dx, y: cy + dy, w: cw, h: ch }));
    } else {
      let nx = cx, ny = cy, nw = cw, nh = ch;
      if (dragMode.includes("w")) { nx = cx + dx; nw = cw - dx; }
      if (dragMode.includes("e")) { nw = cw + dx; }
      if (dragMode.includes("n")) { ny = cy + dy; nh = ch - dy; }
      if (dragMode.includes("s")) { nh = ch + dy; }
      if (nw < MIN_SIZE) { if (dragMode.includes("w")) { nx = cx + cw - MIN_SIZE; } nw = MIN_SIZE; }
      if (nh < MIN_SIZE) { if (dragMode.includes("n")) { ny = cy + ch - MIN_SIZE; } nh = MIN_SIZE; }
      setCrop(clampCrop({ x: nx, y: ny, w: nw, h: nh }));
    }
  };

  const onPointerUp = () => setDragMode(null);

  function applyCrop() {
    if (!naturalSize) return;
    setApplying(true);
    const sx = crop.x / displayScale;
    const sy = crop.y / displayScale;
    const sw = crop.w / displayScale;
    const sh = crop.h / displayScale;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d")!;

    const img = new Image();
    img.crossOrigin = "anonymous";
    const draw = (i: HTMLImageElement) => {
      ctx.drawImage(i, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      try { onCrop(canvas.toDataURL("image/png")); }
      catch { setError("Could not crop (cross-origin). Try re-uploading."); setApplying(false); }
    };
    img.onload = () => draw(img);
    img.onerror = () => { const i2 = new Image(); i2.onload = () => draw(i2); i2.src = imageUrl; };
    img.src = imageUrl;
  }

  const handleCursorMap: Record<string, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", move: "move" };
  const HANDLE = 12;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm p-4"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5">
        <p className="text-sm text-gray-300">Drag corners/edges to resize · drag inside to move</p>
        <button onClick={applyCrop} disabled={!naturalSize || applying}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
          {applying ? "Applying..." : "Apply Crop"}
        </button>
        <button onClick={onCancel}
          className="rounded-lg border border-gray-600 px-4 py-1.5 text-sm text-gray-300 transition-colors hover:border-gray-400 hover:text-white">
          Cancel
        </button>
      </div>

      {error && <p className="mb-3 max-w-md text-center text-sm text-red-400">{error}</p>}

      {naturalSize && (
        <div ref={containerRef} className="relative" style={{ width: displayW, height: displayH }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={imageName} draggable={false}
            className="pointer-events-none select-none w-full h-full rounded-lg" />

          {/* Dark overlay outside crop */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(to right, rgba(0,0,0,0.6) ${crop.x}px, transparent ${crop.x}px, transparent ${crop.x + crop.w}px, rgba(0,0,0,0.6) ${crop.x + crop.w}px)`,
          }} />
          <div className="absolute pointer-events-none" style={{ left: crop.x, top: 0, width: crop.w, height: crop.y, background: "rgba(0,0,0,0.6)" }} />
          <div className="absolute pointer-events-none" style={{ left: crop.x, top: crop.y + crop.h, width: crop.w, height: displayH - crop.y - crop.h, background: "rgba(0,0,0,0.6)" }} />

          {/* Crop border */}
          <div className="absolute border-2 border-white/80 pointer-events-none"
            style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}>
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
          </div>

          {/* Move handle (interior) */}
          <div style={{ position: "absolute", left: crop.x + HANDLE / 2, top: crop.y + HANDLE / 2, width: crop.w - HANDLE, height: crop.h - HANDLE, cursor: handleCursorMap.move }}
            onPointerDown={(e) => onPointerDown(e, "move")} />

          {/* Corner handles */}
          {(["nw", "ne", "sw", "se"] as const).map((corner) => {
            const isLeft = corner.includes("w");
            const isTop = corner.includes("n");
            return (
              <div key={corner} className="absolute bg-white border-2 border-indigo-500 rounded-sm"
                style={{
                  width: HANDLE, height: HANDLE,
                  left: (isLeft ? crop.x : crop.x + crop.w) - HANDLE / 2,
                  top: (isTop ? crop.y : crop.y + crop.h) - HANDLE / 2,
                  cursor: handleCursorMap[corner],
                }}
                onPointerDown={(e) => onPointerDown(e, corner)} />
            );
          })}

          {/* Edge handles */}
          {(["n", "s", "e", "w"] as const).map((edge) => {
            const isH = edge === "n" || edge === "s";
            return (
              <div key={edge} className="absolute bg-white/80 border border-indigo-400 rounded-sm"
                style={{
                  width: isH ? Math.min(crop.w * 0.3, 40) : 6,
                  height: isH ? 6 : Math.min(crop.h * 0.3, 40),
                  left: edge === "w" ? crop.x - 3 : edge === "e" ? crop.x + crop.w - 3 : crop.x + crop.w / 2 - Math.min(crop.w * 0.15, 20),
                  top: edge === "n" ? crop.y - 3 : edge === "s" ? crop.y + crop.h - 3 : crop.y + crop.h / 2 - Math.min(crop.h * 0.15, 20),
                  cursor: handleCursorMap[edge],
                }}
                onPointerDown={(e) => onPointerDown(e, edge)} />
            );
          })}

          {/* Size indicator */}
          <div className="absolute bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none"
            style={{ left: crop.x + crop.w / 2 - 30, top: crop.y + crop.h + 8 }}>
            {Math.round(crop.w / displayScale)} x {Math.round(crop.h / displayScale)}
          </div>
        </div>
      )}

      {!naturalSize && !error && <p className="text-sm text-gray-500">Loading image...</p>}
      <p className="mt-3 text-xs text-gray-500">Press Esc to cancel</p>
    </div>
  );
}

/* ── Fixed crop: fixed window with movable/zoomable image ── */
function FixedCrop({ imageUrl, imageName, onCrop, onCancel, aspectRatio }: { imageUrl: string; imageName: string; onCrop: (d: string) => void; onCancel: () => void; aspectRatio: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const CROP_BASE = 280;
  const CROP_W = aspectRatio >= 1 ? CROP_BASE : Math.round(CROP_BASE * aspectRatio);
  const CROP_H = aspectRatio >= 1 ? Math.round(CROP_BASE / aspectRatio) : CROP_BASE;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      const minScale = Math.max(CROP_W / img.naturalWidth, CROP_H / img.naturalHeight);
      setZoom(Math.max(minScale, 1));
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
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

  const clampOffset = useCallback(
    (ox: number, oy: number, z: number) => {
      if (!naturalSize) return { x: ox, y: oy };
      const imgW = naturalSize.w * z;
      const imgH = naturalSize.h * z;
      const maxX = Math.max(0, (imgW - CROP_W) / 2);
      const maxY = Math.max(0, (imgH - CROP_H) / 2);
      return { x: Math.min(maxX, Math.max(-maxX, ox)), y: Math.min(maxY, Math.max(-maxY, oy)) };
    },
    [naturalSize, CROP_W, CROP_H]
  );

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setOffset(clampOffset(dragStart.current.ox + e.clientX - dragStart.current.x, dragStart.current.oy + e.clientY - dragStart.current.y, zoom));
  }
  function onPointerUp() { setDragging(false); }

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
    const draw = (i: HTMLImageElement) => {
      const imgW = naturalSize.w * zoom;
      const imgH = naturalSize.h * zoom;
      const imgLeft = CROP_W / 2 + offset.x - imgW / 2;
      const imgTop = CROP_H / 2 + offset.y - imgH / 2;
      ctx.drawImage(i, -imgLeft / zoom, -imgTop / zoom, CROP_W / zoom, CROP_H / zoom, 0, 0, CROP_W, CROP_H);
      try { onCrop(canvas.toDataURL("image/png")); }
      catch { setError("Could not crop (cross-origin). Try re-uploading."); setApplying(false); }
    };
    img.onload = () => draw(img);
    img.onerror = () => { const i2 = new Image(); i2.onload = () => draw(i2); i2.src = imageUrl; };
    img.src = imageUrl;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm p-4">
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5">
        <p className="text-sm text-gray-300">Drag image to position · scroll to zoom</p>
        <button onClick={applyCrop} disabled={!naturalSize || applying}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
          {applying ? "Applying..." : "Apply Crop"}
        </button>
        <button onClick={onCancel}
          className="rounded-lg border border-gray-600 px-4 py-1.5 text-sm text-gray-300 transition-colors hover:border-gray-400 hover:text-white">
          Cancel
        </button>
      </div>

      {error && <p className="mb-3 max-w-md text-center text-sm text-red-400">{error}</p>}

      {naturalSize && (
        <div ref={containerRef} className="relative overflow-hidden rounded-xl border-2 border-white/30"
          style={{ width: CROP_W, height: CROP_H, cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={imageName} draggable={false} className="pointer-events-none select-none"
            style={{
              position: "absolute", width: naturalSize.w * zoom, height: naturalSize.h * zoom,
              left: CROP_W / 2 + offset.x - (naturalSize.w * zoom) / 2,
              top: CROP_H / 2 + offset.y - (naturalSize.h * zoom) / 2,
              maxWidth: "none",
            }} />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-white/60" />
            <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-white/60" />
            <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-white/60" />
            <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-white/60" />
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
          </div>
        </div>
      )}

      {!naturalSize && !error && <p className="text-sm text-gray-500">Loading image...</p>}

      {naturalSize && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-gray-500">Zoom</span>
          <input type="range" min={Math.max(CROP_W / naturalSize.w, CROP_H / naturalSize.h)} max={5} step={0.01} value={zoom}
            onChange={(e) => { const z = parseFloat(e.target.value); setZoom(z); setOffset((prev) => clampOffset(prev.x, prev.y, z)); }}
            className="w-40 accent-indigo-500" />
          <span className="w-10 text-right text-xs text-gray-400">{Math.round(zoom * 100)}%</span>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500">Press Esc to cancel</p>
    </div>
  );
}
