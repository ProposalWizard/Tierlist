"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampOffset, encodePortrait, initialView, portraitBytes, sourceRect, type CropView,
} from "@/lib/star/portrait";
import { kitsOf, labelInk } from "@/lib/star/kits";
import { paletteFor } from "@/lib/star/media/graphics/palette";

/**
 * TAKE A PICTURE, OR DON'T.
 *
 * Optional by design and it says so: the shirt is a real answer, not a
 * placeholder waiting to be filled, and most people will never open this. So the
 * control opens showing what the cards will use if you walk away from it.
 *
 * `capture="user"` on the input is what makes a phone offer the camera rather
 * than only the photo library. Desktops ignore it and show a file picker, which
 * is the right thing there.
 *
 * Nothing here uploads. See lib/star/portrait.ts.
 */

const VIEWPORT = 224;

interface Props {
  value?: string;
  onChange: (portrait: string | undefined) => void;
  /** For the preview, so you see the face in the colours it will be drawn in. */
  club: string;
  number?: number;
}

export default function PortraitPicker({ value, onChange, club, number }: Props) {
  const [raw, setRaw] = useState<string | null>(null);
  const [view, setView] = useState<CropView>({ zoom: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const kit = kitsOf(club).home;

  // Load the chosen file and open the crop centred on it.
  const take = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError("That file could not be read. Try another one.");
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => setError("That does not look like a picture.");
      img.onload = () => {
        imgRef.current = img;
        setSize({ w: img.naturalWidth, h: img.naturalHeight });
        setView(initialView(img.naturalWidth, img.naturalHeight, VIEWPORT));
        setRaw(src);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setView(v => clampOffset(
      { zoom: v.zoom, x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) },
      size.w, size.h, VIEWPORT,
    ));
  };
  const onPointerUp = () => { drag.current = null; };

  // Zooming about the centre rather than the top-left, which is what a pinch
  // does and what anybody expects. Without it the face slides out of frame every
  // time the slider moves.
  const setZoom = (z: number) => {
    setView((v) => {
      const cx = VIEWPORT / 2, cy = VIEWPORT / 2;
      const k = z / v.zoom;
      return clampOffset(
        { zoom: z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k },
        size.w, size.h, VIEWPORT,
      );
    });
  };

  const use = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = encodePortrait(img, sourceRect(view, size.w, size.h, VIEWPORT));
    if (!out) { setError("This browser could not process that picture."); return; }
    onChange(out);
    setRaw(null);
  };

  // Release the object the crop stage is holding when it closes.
  useEffect(() => () => { imgRef.current = null; }, []);

  const scale = raw ? Math.max(VIEWPORT / (size.w || 1), VIEWPORT / (size.h || 1)) * view.zoom : 1;

  return (
    <div className="rounded-lg border border-emerald-700 bg-emerald-900/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Your photo</span>
        <span className="text-[10px] font-bold text-white/70">Optional</span>
      </div>

      {raw ? (
        <>
          <div
            className="relative mx-auto mt-3 cursor-grab touch-none overflow-hidden rounded-lg border border-white/20 active:cursor-grabbing"
            style={{ width: VIEWPORT, height: VIEWPORT, backgroundColor: kit.shirt }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={raw}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left select-none"
              style={{ width: size.w * scale, height: size.h * scale, transform: `translate(${view.x}px, ${view.y}px)` }}
            />
          </div>
          <input
            type="range" min={1} max={3} step={0.02} value={view.zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
            aria-label="Zoom"
          />
          <p className="text-center text-[10px] font-bold text-white/70">Drag to move, slide to zoom</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => setRaw(null)}
              className="rounded-lg bg-gray-700 py-2 text-[12px] font-black text-white transition hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={use}
              className="rounded-lg bg-emerald-600 py-2 text-[12px] font-black text-white transition hover:bg-emerald-500"
            >
              Use this
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <TilePreview portrait={value} club={club} number={number} />
            <p className="flex-1 text-[11px] font-bold leading-snug text-white/85">
              {value
                ? "This is how you will appear on Player of the Month graphics."
                : "Without one you appear as the back of your shirt, which is what the preview shows."}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="cursor-pointer rounded-lg bg-emerald-600 py-2 text-center text-[12px] font-black text-white transition hover:bg-emerald-500">
              {value ? "Change photo" : "Add a photo"}
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ""; }}
              />
            </label>
            <button
              onClick={() => onChange(undefined)}
              disabled={!value}
              className={`rounded-lg py-2 text-[12px] font-black transition ${
                value ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-gray-800 text-white/45"}`}
            >
              Use my shirt
            </button>
          </div>
          {value && (
            <p className="mt-1.5 text-center text-[10px] font-bold text-white/60">
              Stored on this device only — about {Math.round(portraitBytes(value) / 1024)} KB.
            </p>
          )}
        </>
      )}

      {error && <p className="mt-2 text-[11px] font-bold text-red-300">{error}</p>}
    </div>
  );
}

/**
 * The tile as the graphics will draw it.
 *
 * Deliberately the same treatment rather than a plain thumbnail — the duotone
 * changes a photograph enough that judging it untreated tells you nothing about
 * whether you like it.
 */
function TilePreview({ portrait, club, number }: { portrait?: string; club: string; number?: number }) {
  const kit = kitsOf(club).home;
  const c = paletteFor(kit.shirt, kit.trim);
  return (
    <div className="relative h-16 w-16 shrink-0 isolate overflow-hidden rounded-lg" style={{ backgroundColor: kit.shirt }}>
      <div className="absolute inset-y-0 left-1 w-5 -skew-x-[14deg]" style={{ backgroundColor: kit.trim }} />
      {portrait ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={portrait}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: "grayscale(0.85) contrast(1.2) brightness(1.05)" }}
          />
          <div className="absolute inset-0" style={{ background: c.duoDark, mixBlendMode: "screen", opacity: 0.85 }} />
          <div className="absolute inset-0" style={{ background: c.duoLight, mixBlendMode: "multiply", opacity: 0.85 }} />
        </>
      ) : (
        <div
          className="absolute inset-0 grid place-items-center text-2xl font-black tabular-nums"
          style={{ color: labelInk(kit.shirt) }}
        >
          {number ?? 9}
        </div>
      )}
    </div>
  );
}
