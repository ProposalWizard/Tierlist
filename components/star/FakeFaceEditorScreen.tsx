"use client";
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { FACE_SCALE_RANGE, FACE_OFFSET_RANGE, CROP_VIEWPORT, CROP_ZOOM_RANGE, loadFaceStyle } from "@/lib/star/faceStyle";
import {
  loadFakeFaceStyle, saveFakeFaceStyle, DEFAULT_FAKE_FACE_STYLE, type FakeFaceStyle,
} from "@/lib/star/fakeFaceStyle";
import { FAKE_FACES } from "@/lib/star/fakeFaces";
import { coverScale, clampOffset, initialView } from "@/lib/star/portrait";
import { drawPlayerHead } from "@/lib/star/drawPlayerHead";
import { kitsOf } from "@/lib/star/kits";

/**
 * THE OTHER FACE EDITOR — for the seven FAKE headshots specifically.
 *
 * Requested directly, once fake faces (lib/star/fakeFaces.ts) were live and
 * assigned to every player who has no real photo: "make a fake face player
 * face editor to go along with the player face editor. because the images
 * are different so need different values and cropped parts etc." Real
 * player photos and these seven AI-generated ones are two different
 * batches of images with two different framings — the ONE shared FaceStyle
 * (faceStyle.ts) that already tunes real photos would misplace a fake one
 * if it were forced to share the same scale/offset/crop.
 *
 * A near-exact structural twin of FaceEditorScreen.tsx — same WYSIWYG
 * canvas, same drag-to-move, same Crop Photo stage — swapped to a picker of
 * the seven fake images instead of a squad player, and editing FakeFaceStyle
 * (fakeFaceStyle.ts) instead of FaceStyle. Deliberately does NOT duplicate
 * the backing-circle/outline/names controls: those are photo-composition-
 * INDEPENDENT style choices that stay on the one shared FaceStyle, edited
 * only from the real Face Editor, and apply identically to a fake face here
 * too (read-only in this screen, just so the preview looks right).
 *
 * The preview canvas calls the exact same drawPlayerHead() a real match
 * calls — no second, approximate drawing routine that could quietly
 * disagree with what actually shows up on a generated player.
 */

const SIZE = 260;
const FIGURE_R = 72;
const HEAD_BASE_R = FIGURE_R * 0.26;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export default function FakeFaceEditorScreen({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedUrl = FAKE_FACES[selectedIndex];
  // Read once — this screen only ever edits FakeFaceStyle below; it just
  // needs a representative real style so the preview's backing/outline
  // look right. See FaceEditorScreen.tsx for the tool that edits this one.
  const [realStyle] = useState(loadFaceStyle);

  const [style, setStyle] = useState<FakeFaceStyle>(loadFakeFaceStyle);
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

    // Same simple, representative body FaceEditorScreen's own preview uses
    // — not the configurable part, only recognisably a footballer.
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
    drawPlayerHead(ctx, 0, -r * 0.76, HEAD_BASE_R, r, imgRef.current ?? undefined, realStyle, style);

    ctx.restore();
  };

  // Load whichever fake face is selected. A fresh Image per selection
  // rather than a cache — only one is ever shown here at a time.
  useEffect(() => {
    imgRef.current = null;
    setCropImgSize({ w: 0, h: 0 });
    draw();
    const img = new Image();
    img.onload = () => { imgRef.current = img; draw(); };
    img.onerror = () => { imgRef.current = null; draw(); };
    img.src = selectedUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  useEffect(() => { saveFakeFaceStyle(style); draw(); }, [style]);

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

  // Same "only while still genuinely untouched" auto-centring FaceEditorScreen
  // uses — it should never fight a real edit already made.
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

  const set = <K extends keyof FakeFaceStyle>(key: K, value: FakeFaceStyle[K]) =>
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
        <h1 className="text-lg font-black">Fake Face Graphics</h1>
        <p className="mt-1 text-[11px] font-semibold text-white/70">
          Size, position and crop for the seven fake faces — every generated player, and any real player with no scraped photo yet, draws with one of these. Pick one below to check it, drag the face or use the sliders to get it right. Saves as you go; takes effect next match.
        </p>

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {FAKE_FACES.map((src, i) => (
            <button
              key={src}
              onClick={() => setSelectedIndex(i)}
              className={`relative aspect-square overflow-hidden rounded-md border-2 transition ${
                i === selectedIndex ? "border-emerald-400" : "border-white/15 hover:border-white/50"
              }`}
              style={{ backgroundColor: kitsOf(career.player.club).home.shirt }}
              aria-label={`Fake face ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
            </button>
          ))}
        </div>

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

        <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Crop Photo</div>
          <p className="mt-1 text-[11px] font-semibold text-white/90">
            Drag to move, slide to zoom in, so just the face is what lands inside the circle. One shared crop, used for all seven fake faces alike.
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
              key={selectedIndex}
              src={selectedUrl}
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

          <p className="text-[10px] font-semibold text-white/55">
            Backing circle, outline and names are shared with real photos — edit those from the main Player Graphics editor instead.
          </p>

          <button
            onClick={() => setStyle(DEFAULT_FAKE_FACE_STYLE)}
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
