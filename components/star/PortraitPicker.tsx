"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampOffset, encodePortrait, initialView, portraitBytes, sourceRect, type CropView,
} from "@/lib/star/portrait";
import { kitsOf, labelInk } from "@/lib/star/kits";
import { paletteFor } from "@/lib/star/media/graphics/palette";
import { FAKE_FACES } from "@/lib/star/fakeFaces";

/**
 * TAKE A PICTURE, OR DON'T.
 *
 * Optional by design and it says so: the shirt is a real answer, not a
 * placeholder waiting to be filled, and most people will never open this. So the
 * control opens showing what the cards will use if you walk away from it.
 *
 * ── TWO BUTTONS, BECAUSE `capture` IS A REPLACEMENT AND NOT AN ADDITION ──
 *
 * This has now been reported from both directions, and the two reports are
 * both correct — they are about different buttons:
 *
 *   "on a phone this let you take a new photo but never pick one you
 *    already had"
 *   "'Add a photo' still doesn't work in terms of using your camera, so
 *    maybe it should say 'Take a photo' — 'Add a photo' and 'Take a photo',
 *    and 'Take a photo' would use the camera"
 *
 * The mechanism behind both: `capture` does not ADD a camera option to the
 * native chooser, it REPLACES the chooser — a mobile browser that honours it
 * opens the camera app directly, with no way through to the library. So one
 * input cannot be both, and the fix is the one the report describes: two
 * inputs, each honest about which it is.
 *
 *   ADD A PHOTO   — bare `accept="image/*"`, no `capture`. The phone's own
 *                   chooser, which on iOS and Android already offers Camera
 *                   alongside Photo Library. Unchanged from before.
 *   TAKE A PHOTO  — the same input plus `capture="user"`, which asks for the
 *                   FRONT camera (`"environment"` would be the rear one, and
 *                   this is a portrait of your own face).
 *
 * ── What this does on a desktop, stated plainly ──
 *
 * Nothing. `capture` is specified as a hint, and every desktop browser
 * ignores it: Chrome, Safari and Firefox on a laptop all open the ordinary
 * file picker for BOTH buttons, so on a MacBook the two are indistinguishable
 * and that is not a bug. Reaching a laptop webcam at all means
 * `getUserMedia` — a live `<video>` preview, a shutter button, a permission
 * prompt, and a `<canvas>` grab — which is a real component rather than an
 * attribute, and is deliberately not built here: the game is mobile-first and
 * portrait-phone-first, and on the device this is actually used on, `capture`
 * is the correct and complete answer.
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
                : "Without one you'll show up as a generic face in matches, and as the back of your shirt on Player of the Month graphics."}
            </p>
          </div>

          {/* Picking and taking are a pair and sit on one row; the shirt is
              the third, different answer and gets its own — see below. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="cursor-pointer rounded-lg bg-emerald-600 py-2 text-center text-[12px] font-black text-white transition hover:bg-emerald-500">
              {value ? "Change photo" : "Add a photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ""; }}
              />
            </label>
            <label className="cursor-pointer rounded-lg bg-emerald-700 py-2 text-center text-[12px] font-black text-white transition hover:bg-emerald-600">
              Take a photo
              <input
                type="file"
                accept="image/*"
                // The whole difference between this button and the one beside
                // it. "user" is the front camera — this is a portrait of your
                // own face, not a picture of something in front of you. See
                // the note at the top of this file for what it does on a
                // desktop, which is nothing.
                capture="user"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ""; }}
              />
            </label>
          </div>

          {/* ── THE SHIRT IS AN ANSWER, NOT A GREYED-OUT ACTION ──
              Reported as "doesn't even pop up anymore". It was never removed
              — it has always rendered right here — but it is only ever an
              ACTION when there is a photo to clear, so on a fresh career it
              was a dark grey slab with dimmed text sitting in the corner of a
              two-button row, which is exactly what a missing button looks
              like.
              It now says what it means. With no photo set the shirt is
              already what you will be shown as, so this reads as the SELECTED
              state (ringed, ticked, "Using your shirt") rather than as a
              button somebody has switched off; with a photo set it is a live
              button that clears it. Same single call to `onChange(undefined)`
              either way. */}
          <button
            onClick={() => onChange(undefined)}
            disabled={!value}
            className={`mt-2 w-full rounded-lg py-2 text-[12px] font-black transition ${
              value
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "border border-emerald-400/70 bg-emerald-500/15 text-emerald-200"}`}
          >
            {value ? "Use my shirt" : "✓ Using your shirt"}
          </button>
          {value && !FAKE_FACES.includes(value) && (
            <p className="mt-1.5 text-center text-[10px] font-bold text-white/60">
              Stored on this device only — about {Math.round(portraitBytes(value) / 1024)} KB.
            </p>
          )}

          <div className="mt-3 border-t border-emerald-800/60 pt-3">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
              Or pick a face
            </span>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {FAKE_FACES.map((src, i) => (
                <button
                  key={src}
                  onClick={() => onChange(src)}
                  className={`relative aspect-square overflow-hidden rounded-md border-2 transition ${
                    value === src ? "border-emerald-400" : "border-white/15 hover:border-white/50"
                  }`}
                  style={{ backgroundColor: kit.shirt }}
                  aria-label={`Fake face ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
                </button>
              ))}
            </div>
          </div>
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
