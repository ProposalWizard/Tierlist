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
 * "Take a photo" is its own button with its own path (see startTakePhoto): the
 * phone's front camera on touch devices, a live webcam preview on a computer.
 *
 * No `capture` attribute on the "Add a photo" input, deliberately — that attribute doesn't
 * just ADD a camera option, it makes most mobile browsers skip the native
 * chooser entirely and jump straight into the camera app, with no way to
 * reach the photo library at all. Reported directly: on a phone this let
 * you take a new photo but never pick one you already had. A bare
 * `type="file" accept="image/*"` is what makes a phone show its normal
 * chooser (camera OR library) — the same one a desktop's file picker is a
 * different flavour of.
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

  // Open the crop centred on a loaded picture — shared by every way of
  // getting one in (a chosen file, the phone's camera app, the webcam).
  const takeSrc = useCallback((src: string) => {
    setError(null);
    const img = new Image();
    img.onerror = () => setError("That does not look like a picture.");
    img.onload = () => {
      imgRef.current = img;
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
      setView(initialView(img.naturalWidth, img.naturalHeight, VIEWPORT));
      setRaw(src);
    };
    img.src = src;
  }, []);

  const take = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError("That file could not be read. Try another one.");
    reader.onload = () => takeSrc(String(reader.result));
    reader.readAsDataURL(file);
  }, [takeSrc]);

  // ── Take a photo ──
  //
  // Two genuinely different things behind one button, because a phone and a
  // computer do this completely differently. A phone (coarse pointer) hands
  // off to its own camera app via a SEPARATE input carrying `capture="user"`
  // (the front camera) — kept off the "Add a photo" input on purpose, see the
  // header note, since `capture` on that one would lock the library out. A
  // computer has no camera app to hand off to, so it gets a live webcam
  // preview (getUserMedia) with a Capture button instead; the captured frame
  // then flows into the exact same crop stage as an uploaded file.
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCam(false);
  }, []);

  const startTakePhoto = async () => {
    setError(null);
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (coarse) { cameraInputRef.current?.click(); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open a camera here. Use Add a photo instead.");
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setCam(true);
    } catch {
      setError("Couldn't open the camera — check the browser's camera permission, or use Add a photo instead.");
    }
  };

  // Attach the stream once the <video> actually exists in the DOM.
  useEffect(() => {
    const v = videoRef.current;
    if (cam && v && streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => { /* autoplay refusal — the user can still hit Capture */ });
    }
  }, [cam]);

  // Never leave the camera light on behind a closed panel.
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) { setError("This browser could not process that picture."); return; }
    // Mirrored, to match the mirrored preview — what you saw is what you get.
    ctx.translate(c.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    const src = c.toDataURL("image/jpeg", 0.92);
    stopCamera();
    takeSrc(src);
  };

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

      {cam ? (
        <>
          <div className="relative mx-auto mt-3 overflow-hidden rounded-lg border border-white/20 bg-black" style={{ width: VIEWPORT, height: VIEWPORT }}>
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full -scale-x-100 object-cover"
            />
          </div>
          <p className="mt-2 text-center text-[10px] font-bold text-white/70">Line yourself up, then take it</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={stopCamera}
              className="rounded-lg bg-gray-700 py-2 text-[12px] font-black text-white transition hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={snap}
              className="rounded-lg bg-emerald-600 py-2 text-[12px] font-black text-white transition hover:bg-emerald-500"
            >
              Capture
            </button>
          </div>
        </>
      ) : raw ? (
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
            <button
              onClick={startTakePhoto}
              className="rounded-lg bg-sky-600 py-2 text-[12px] font-black text-white transition hover:bg-sky-500"
            >
              Take a photo
            </button>
            {/* Phone-only path for Take a photo: the front camera via the
                device's own camera app. A separate input from Add a photo's
                on purpose — see the header note on `capture`. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ""; }}
            />
            <button
              onClick={() => onChange(undefined)}
              disabled={!value}
              className={`col-span-2 rounded-lg py-2 text-[12px] font-black transition ${
                value ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-gray-800 text-white/45"}`}
            >
              Use my shirt
            </button>
          </div>
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
