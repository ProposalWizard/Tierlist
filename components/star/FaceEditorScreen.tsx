"use client";
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import {
  loadFaceStyle, saveFaceStyle, DEFAULT_FACE_STYLE, FACE_SCALE_RANGE, FACE_OFFSET_RANGE,
  CROP_VIEWPORT, CROP_ZOOM_RANGE, type FaceStyle,
} from "@/lib/star/faceStyle";
import { coverScale, clampOffset, initialView } from "@/lib/star/portrait";
import { drawPlayerHead } from "@/lib/star/drawPlayerHead";
import { kitsOf } from "@/lib/star/kits";

/**
 * A PROPER FACE EDITOR, NOT A SLIDER.
 *
 * A single scale slider (the first version of this, in Settings) was
 * reported back directly as not enough: "i want a proper well made player
 * graphic editor... select a player, see how they look, move the face
 * around, adjust the size/scale, edit things like whether or not theres a
 * normal 'face' circle behind the face picture, add/edit an outline with
 * colour and size and thickness... every player looks exactly how i
 * envision." One shared FaceStyle applies everywhere a head draws — this is
 * a WYSIWYG tool for it, not a per-player override system: "every player"
 * here means the one style reaching every figure uniformly, previewed
 * against whichever real squad player you pick to check it against.
 *
 * The preview canvas calls the exact same drawPlayerHead() a real match
 * calls, with the exact same FaceStyle object — there is no second,
 * approximate drawing routine here that could quietly disagree with what a
 * match actually shows.
 *
 * The Crop Photo section reuses PortraitPicker.tsx's own crop geometry
 * (coverScale/clampOffset/initialView, lib/star/portrait.ts) — real player
 * photos can include more than just the face (neck, a bit of shirt
 * collar), so there needed to be a way to pick which part of the photo
 * actually shows, independent of what its own real alpha shape traces.
 */

const SIZE = 260;
const FIGURE_R = 72;
const HEAD_BASE_R = FIGURE_R * 0.26;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export default function FaceEditorScreen({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const squad = career.squad ?? [];
  const firstWithPhoto = squad.find(p => p.imageUrl);
  const [selectedId, setSelectedId] = useState<string>(firstWithPhoto?.id ?? squad[0]?.id ?? "");
  const selected = squad.find(p => p.id === selectedId) ?? squad[0];

  const [style, setStyle] = useState<FaceStyle>(loadFaceStyle);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const cropDragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [cropImgSize, setCropImgSize] = useState({ w: 0, h: 0 });

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#134e2a";
    ctx.fillRect(0, 0, SIZE, SIZE);

    const kit = kitsOf(career.player.club).home;
    const cx = SIZE / 2, cy = SIZE * 0.7, r = FIGURE_R;

    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.78, r * 0.30, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy - r * 0.8);
    ctx.lineCap = "round";

    // A simple, representative body — not the configurable part, so it
    // doesn't need to be the exact shared code footballer() uses, only
    // recognisably the same proportions.
    ctx.strokeStyle = "#c68642";
    ctx.lineWidth = Math.max(2, r * 0.24);
    ctx.beginPath(); ctx.moveTo(-r * 0.24, r * 0.18); ctx.lineTo(-r * 0.24, r * 0.80); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.24, r * 0.18); ctx.lineTo(r * 0.24, r * 0.80); ctx.stroke();

    ctx.fillStyle = kit.trim;
    ctx.beginPath();
    ctx.roundRect?.(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36, r * 0.12);
    if (!ctx.roundRect) ctx.rect(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36);
    ctx.fill();

    ctx.strokeStyle = "#c68642";
    ctx.lineWidth = Math.max(2, r * 0.20);
    ctx.beginPath(); ctx.moveTo(-r * 0.34, -r * 0.30); ctx.lineTo(-r * 0.58, -r * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.34, -r * 0.30); ctx.lineTo(r * 0.58, -r * 0.02); ctx.stroke();

    ctx.fillStyle = kit.shirt;
    ctx.beginPath();
    ctx.roundRect?.(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72, r * 0.17);
    if (!ctx.roundRect) ctx.rect(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = kit.trim;
    ctx.stroke();

    // ── The actual configurable part — real code, real match, this preview. ──
    drawPlayerHead(ctx, 0, -r * 0.76, HEAD_BASE_R, r, imgRef.current ?? undefined, style);

    ctx.restore();
  };

  // Load whichever player's photo is selected. A fresh Image per selection
  // rather than a cache — only one is ever shown here at a time.
  useEffect(() => {
    imgRef.current = null;
    setCropImgSize({ w: 0, h: 0 });
    draw();
    const url = selected?.imageUrl;
    if (!url) return;
    const img = new Image();
    img.onload = () => { imgRef.current = img; draw(); };
    img.onerror = () => { imgRef.current = null; draw(); };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => { saveFaceStyle(style); draw(); }, [style]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: style.offsetX, oy: style.offsetY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    setStyle(s => ({
      ...s,
      offsetX: clamp(d.ox + dx / HEAD_BASE_R, ...FACE_OFFSET_RANGE),
      offsetY: clamp(d.oy + dy / HEAD_BASE_R, ...FACE_OFFSET_RANGE),
    }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  // The crop photo's own natural size, once it's loaded — snaps the shared
  // crop to a sensible centred start for THIS photo, but only while it's
  // still genuinely untouched (exactly the default {1,0,0}); the moment a
  // real drag or zoom moves it even slightly, this never fires again for
  // any player, which is the point — it should never fight your own edit.
  const onCropImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setCropImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    setStyle(s => (s.crop.zoom !== 1 || s.crop.x !== 0 || s.crop.y !== 0)
      ? s
      : { ...s, crop: initialView(img.naturalWidth, img.naturalHeight, CROP_VIEWPORT) });
  };
  const onCropPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    cropDragRef.current = { x: e.clientX, y: e.clientY, ox: style.crop.x, oy: style.crop.y };
  };
  const onCropPointerMove = (e: React.PointerEvent) => {
    const d = cropDragRef.current;
    if (!d || !cropImgSize.w) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    setStyle(s => ({
      ...s,
      crop: clampOffset({ zoom: s.crop.zoom, x: d.ox + dx, y: d.oy + dy }, cropImgSize.w, cropImgSize.h, CROP_VIEWPORT),
    }));
  };
  const onCropPointerUp = () => { cropDragRef.current = null; };

  // Zooming about the centre of the viewport, not the top-left — same
  // reasoning as PortraitPicker's own setZoom: without it the face slides
  // out of frame every time the slider moves.
  const setCropZoom = (z: number) => {
    setStyle((s) => {
      if (!cropImgSize.w) return { ...s, crop: { ...s.crop, zoom: z } };
      const c = CROP_VIEWPORT / 2;
      const k = z / s.crop.zoom;
      return {
        ...s,
        crop: clampOffset(
          { zoom: z, x: c - (c - s.crop.x) * k, y: c - (c - s.crop.y) * k },
          cropImgSize.w, cropImgSize.h, CROP_VIEWPORT,
        ),
      };
    });
  };

  const set = <K extends keyof FaceStyle>(key: K, value: FaceStyle[K]) =>
    setStyle(s => ({ ...s, [key]: value }));

  const cropDisplayScale = cropImgSize.w ? coverScale(cropImgSize.w, cropImgSize.h, CROP_VIEWPORT) * style.crop.zoom : 1;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-md px-3 py-3">
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1 px-3 py-1.5 bg-gray-700 rounded-lg text-xs font-black text-white hover:bg-gray-600"
        >
          ← Settings
        </button>
        <h1 className="text-lg font-black">Player Graphics</h1>
        <p className="mt-1 text-[11px] font-semibold text-white/70">
          Applies to every real player on the pitch — pick one below just to see it, then drag the face or use the sliders to get it exactly right. Saves as you go; takes effect next match.
        </p>

        {squad.length > 0 && (
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="mt-3 w-full rounded-lg bg-gray-900 border border-gray-700 px-2 py-2 text-sm text-white"
          >
            {squad.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.position}{p.imageUrl ? "" : " (no photo)"}
              </option>
            ))}
          </select>
        )}

        <div className="mt-3 flex justify-center rounded-xl border border-gray-700 bg-gray-900 p-2">
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="touch-none cursor-grab rounded-lg active:cursor-grabbing"
            style={{ width: SIZE, height: SIZE }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
        <p className="mt-1 text-center text-[10px] font-bold text-white/60">Drag the face to move it</p>

        {selected?.imageUrl && (
          <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Crop Photo</div>
            <p className="mt-1 text-[11px] font-semibold text-white/90">
              Real photos include the neck and shirt — drag to move, slide to zoom in, so just the face is what lands inside the circle. One shared crop, used for every real player's photo.
            </p>
            <div
              className="relative mx-auto mt-2 touch-none overflow-hidden rounded-lg border border-white/20 cursor-grab active:cursor-grabbing"
              style={{ width: CROP_VIEWPORT, height: CROP_VIEWPORT, backgroundColor: "#111" }}
              onPointerDown={onCropPointerDown}
              onPointerMove={onCropPointerMove}
              onPointerUp={onCropPointerUp}
              onPointerCancel={onCropPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={selected.id}
                src={selected.imageUrl}
                alt=""
                draggable={false}
                onLoad={onCropImgLoad}
                className="pointer-events-none absolute left-0 top-0 max-w-none select-none origin-top-left"
                style={cropImgSize.w ? {
                  width: cropImgSize.w * cropDisplayScale,
                  height: cropImgSize.h * cropDisplayScale,
                  transform: `translate(${style.crop.x}px, ${style.crop.y}px)`,
                } : undefined}
              />
              {/* The circle everything outside it will be cropped away from —
                  a huge same-shape box-shadow spread, the standard CSS way to
                  darken everything except a circular window with no canvas
                  math of its own to get wrong. */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }}
              />
            </div>
            <input
              type="range" min={CROP_ZOOM_RANGE[0]} max={CROP_ZOOM_RANGE[1]} step={0.02} value={style.crop.zoom}
              onChange={e => setCropZoom(Number(e.target.value))}
              className="mt-2 w-full accent-emerald-500"
              aria-label="Crop zoom"
            />
          </div>
        )}

        <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3 space-y-3">
          <Row label="Size" value={`${style.scale.toFixed(2)}x`}>
            <input type="range" min={FACE_SCALE_RANGE[0]} max={FACE_SCALE_RANGE[1]} step={0.05} value={style.scale}
              onChange={e => set("scale", Number(e.target.value))} className="w-full accent-emerald-500" />
          </Row>
          <Row label="Left / Right" value={style.offsetX.toFixed(2)}>
            <input type="range" min={FACE_OFFSET_RANGE[0]} max={FACE_OFFSET_RANGE[1]} step={0.05} value={style.offsetX}
              onChange={e => set("offsetX", Number(e.target.value))} className="w-full accent-emerald-500" />
          </Row>
          <Row label="Up / Down" value={style.offsetY.toFixed(2)}>
            <input type="range" min={FACE_OFFSET_RANGE[0]} max={FACE_OFFSET_RANGE[1]} step={0.05} value={style.offsetY}
              onChange={e => set("offsetY", Number(e.target.value))} className="w-full accent-emerald-500" />
          </Row>

          <label className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-white/85">Backing circle</span>
            <span className="flex items-center gap-2">
              <input type="color" value={style.backingColor}
                onChange={e => set("backingColor", e.target.value)}
                disabled={!style.showBacking}
                className="h-7 w-9 rounded border border-gray-600 bg-transparent disabled:opacity-40" />
              <input type="checkbox" checked={style.showBacking}
                onChange={e => set("showBacking", e.target.checked)}
                className="h-4 w-4 accent-emerald-500" />
            </span>
          </label>
          <p className="text-[10px] font-semibold text-white/55 -mt-2">
            Off shows the photo alone with nothing behind it — a player with no photo yet still gets this fill regardless, so a head is never left blank.
          </p>

          <label className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-white/85">Outline</span>
            <span className="flex items-center gap-2">
              <input type="color" value={toHex(style.outlineColor)}
                onChange={e => set("outlineColor", e.target.value)}
                disabled={!style.outlineEnabled}
                className="h-7 w-9 rounded border border-gray-600 bg-transparent disabled:opacity-40" />
              <input type="checkbox" checked={style.outlineEnabled}
                onChange={e => set("outlineEnabled", e.target.checked)}
                className="h-4 w-4 accent-emerald-500" />
            </span>
          </label>
          <Row label="Outline thickness" value={style.outlineWidth.toFixed(1)}>
            <input type="range" min={0} max={4} step={0.1} value={style.outlineWidth}
              disabled={!style.outlineEnabled}
              onChange={e => set("outlineWidth", Number(e.target.value))}
              className="w-full accent-emerald-500 disabled:opacity-40" />
          </Row>
          <p className="text-[10px] font-semibold text-white/55 -mt-2">
            A ring around the circle itself, in this colour and thickness.
          </p>

          <button
            onClick={() => setStyle(DEFAULT_FACE_STYLE)}
            className="w-full py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-[11px] font-black text-white"
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-white/85">{label}</span>
        <span className="text-[11px] font-black tabular-nums text-white/70">{value}</span>
      </div>
      {children}
    </div>
  );
}

/** <input type="color"> requires a #rrggbb value — the default outline is an
 *  rgba() string no such input can show, so it falls back to a plain black
 *  swatch rather than leaving the picker blank or throwing. Picking a new
 *  colour always writes a real #rrggbb from here on. */
function toHex(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000";
}
