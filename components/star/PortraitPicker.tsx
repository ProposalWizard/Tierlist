"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampOffset, encodePortrait, initialView, portraitBytes, sourceRect, type CropView,
} from "@/lib/star/portrait";
import { kitsOf, labelInk } from "@/lib/star/kits";
import { paletteFor } from "@/lib/star/media/graphics/palette";
import { FAKE_FACES } from "@/lib/star/fakeFaces";
import OwnPortraitImg from "./OwnPortraitImg";
import { loadFaceScan, scanFace, type Pt, type ScanFail } from "@/lib/star/faceScan";
import { ScanningPhoto, ScanReveal, usePrefersReducedMotion } from "./FaceScanAnim";
import PressButton from "./ui/PressButton";

/**
 * TAKE A PICTURE, OR DON'T.
 *
 * Optional by design and it says so: the shirt is a real answer, not a
 * placeholder waiting to be filled, and most people will never open this. So the
 * control opens showing what the cards will use if you walk away from it.
 *
 * ── THE FACE SCAN (28 Sep 2026) ──
 *
 * Harry uploaded his own photo and the home avatar showed his room behind
 * him as an oval: "maybe we need to do some sort of face scan technique".
 * Now a picked or taken photo goes straight into a scan (lib/star/faceScan.ts):
 * the face is found, straightened and sized, the head and hair are cut out
 * from whatever is behind them, missing hair is drawn back on, and the
 * result — a small transparent head — is what gets stored. The screen shows
 * it happening (a sweep, the face points lighting up) and then the head on
 * your player (FaceScanAnim.tsx). No face found → it says so, and offers the
 * old drag-and-zoom crop instead.
 *
 * ── TAKE A PHOTO ──
 *
 * A live camera view with an oval to put your face in (getUserMedia, the
 * front camera), on phones and computers alike, so the photo comes in lined
 * up. If the browser refuses the camera, a phone falls back to its own
 * camera app (a second input carrying `capture="user"` — kept off "Add a
 * photo" on purpose: `capture` REPLACES the phone's chooser rather than
 * adding to it, which once locked people out of their photo library), and a
 * computer says to use Add a photo. Both need the site's Permissions-Policy
 * to allow the camera — see next.config.mjs.
 *
 * Nothing here uploads. See lib/star/portrait.ts.
 *
 * Reskinned 28 Sep 2026 to the home screen's look (dark glass, kit buttons
 * that press in, the chosen face lit green). Same stages, same handlers —
 * and it still sits happily inside the new-career screen's green card.
 */

/** The kit's green button, for the one control that has to be a <label>. */
const GREEN_STYLE: React.CSSProperties = { background: "linear-gradient(180deg, #4ade80, #10b981 55%, #047857)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.18), 0 8px 18px -6px rgba(16,185,129,.75)" };

const VIEWPORT = 224;

type Stage = "idle" | "camera" | "scanning" | "result" | "failed" | "crop";

interface Props {
  value?: string;
  onChange: (portrait: string | undefined) => void;
  /** For the preview, so you see the face in the colours it will be drawn in. */
  club: string;
  number?: number;
}

export default function PortraitPicker({ value, onChange, club, number }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [raw, setRaw] = useState<string | null>(null);
  const [view, setView] = useState<CropView>({ zoom: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<Pt[] | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [hairNote, setHairNote] = useState<string | null>(null);
  const [fail, setFail] = useState<ScanFail | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const runId = useRef(0);
  const reduced = usePrefersReducedMotion();

  const kit = kitsOf(club).home;

  // ── The scan ──
  const runScan = useCallback(async (img: HTMLImageElement) => {
    const id = ++runId.current;
    setPoints(null); setScanned(null); setFail(null); setHairNote(null);
    setStage("scanning");
    const started = performance.now();
    let pointsAt = 0;
    const r = await scanFace(img, { onPoints: (p) => { if (runId.current === id) { pointsAt = performance.now(); setPoints(p); } } });
    // Let the sweep be seen (it is the feedback that something is happening),
    // and the face points for at least a second once found (the first scan
    // spends most of its time loading the models, so they arrive late) —
    // but never hold a reduced-motion user.
    const now = performance.now();
    const wait = reduced ? 0 : Math.max(0, 1900 - (now - started), pointsAt ? 1100 - (now - pointsAt) : 0);
    if (wait) await new Promise((res) => setTimeout(res, wait));
    if (runId.current !== id) return;
    if (r.ok) {
      setScanned(r.dataUrl);
      setHairNote(r.hair.style ? `Your photo cut off the top of your head, so we drew the rest of your hair in (${HAIR_WORDS[r.hair.style]}).` : null);
      setStage("result");
    } else {
      setFail(r);
      setStage("failed");
    }
  }, [reduced]);

  // Open a loaded picture — shared by every way of getting one in (a chosen
  // file, the phone's camera app, the live camera).
  const takeSrc = useCallback((src: string) => {
    setError(null);
    const img = new Image();
    img.onerror = () => setError("That does not look like a picture.");
    img.onload = () => {
      imgRef.current = img;
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
      setView(initialView(img.naturalWidth, img.naturalHeight, VIEWPORT));
      setRaw(src);
      void runScan(img);
    };
    img.src = src;
  }, [runScan]);

  const take = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError("That file could not be read. Try another one.");
    reader.onload = () => takeSrc(String(reader.result));
    reader.readAsDataURL(file);
  }, [takeSrc]);

  // ── Take a photo: a live camera with an oval guide ──
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startTakePhoto = async () => {
    setError(null);
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (!navigator.mediaDevices?.getUserMedia) {
      if (coarse) { cameraInputRef.current?.click(); return; }
      setError("This browser can't open a camera here. Use Add a photo instead.");
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      setStage("camera");
      void loadFaceScan().catch(() => { /* the scan will say so */ });
    } catch {
      // Refused or no camera: a phone still has its own camera app.
      if (coarse) { cameraInputRef.current?.click(); return; }
      setError("Couldn't open the camera — check the browser's camera permission, or use Add a photo instead.");
    }
  };

  // Attach the stream once the <video> actually exists in the DOM.
  useEffect(() => {
    const v = videoRef.current;
    if (stage === "camera" && v && streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => { /* autoplay refusal — the user can still hit Capture */ });
    }
  }, [stage]);

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

  const reset = () => { runId.current++; stopCamera(); setStage("idle"); setRaw(null); setScanned(null); setFail(null); setPoints(null); };

  // ── The hand crop (only when the scan can't find a face) ──
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

  const useCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = encodePortrait(img, sourceRect(view, size.w, size.h, VIEWPORT));
    if (!out) { setError("This browser could not process that picture."); return; }
    onChange(out);
    reset();
  };

  const useScan = () => {
    if (!scanned) return;
    onChange(scanned);
    reset();
  };

  // Release the object the crop stage is holding when it closes.
  useEffect(() => () => { imgRef.current = null; }, []);

  const scale = raw ? Math.max(VIEWPORT / (size.w || 1), VIEWPORT / (size.h || 1)) * view.zoom : 1;
  const btn = "rounded-xl py-2 text-[12px] font-black";

  return (
    <div className="rounded-xl p-3" style={{ background: "linear-gradient(180deg, rgba(3,7,18,.55), rgba(3,7,18,.35))", boxShadow: "inset 0 1px 3px rgba(0,0,0,.55), inset 0 0 0 1px rgba(110,231,183,.22)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Your photo</span>
        <span className="text-[10px] font-bold text-white">Optional</span>
      </div>

      {stage === "camera" ? (
        <>
          <div className="relative mx-auto mt-3 overflow-hidden rounded-lg border border-white/20 bg-black" style={{ width: VIEWPORT, height: VIEWPORT }}>
            <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            {/* The oval: your face goes in here. Outside it is dimmed. */}
            <svg className="pointer-events-none absolute inset-0" width={VIEWPORT} height={VIEWPORT}>
              <defs>
                <mask id="kib-oval-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <ellipse cx={VIEWPORT / 2} cy={VIEWPORT * 0.46} rx={VIEWPORT * 0.27} ry={VIEWPORT * 0.35} fill="black" />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,.55)" mask="url(#kib-oval-mask)" />
              <ellipse cx={VIEWPORT / 2} cy={VIEWPORT * 0.46} rx={VIEWPORT * 0.27} ry={VIEWPORT * 0.35} fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeDasharray="7 5" />
            </svg>
          </div>
          <p className="mt-2 text-center text-[11px] font-bold text-white">Face in the oval · look straight on · good light</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PressButton variant="secondary" size="none" onClick={reset} className={btn}>Cancel</PressButton>
            <PressButton variant="primary" size="none" onClick={snap} className={btn}>Capture</PressButton>
          </div>
        </>
      ) : stage === "scanning" && raw ? (
        <div className="mt-3">
          <ScanningPhoto src={raw} size={size} box={VIEWPORT} points={points} reduced={reduced} />
          <p className="mt-2 text-center text-[11px] font-bold text-white">Scanning your face…</p>
        </div>
      ) : stage === "result" && scanned ? (
        <>
          <div className="mt-3">
            <ScanReveal portrait={scanned} club={club} number={number} reduced={reduced} />
          </div>
          <p className="mt-2 text-center text-[11px] font-bold text-white">That&apos;s you.</p>
          {hairNote && <p className="mt-1 text-center text-[10px] font-bold text-emerald-200">{hairNote}</p>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PressButton variant="secondary" size="none" onClick={reset} className={btn}>Try another</PressButton>
            <PressButton variant="primary" size="none" onClick={useScan} className={btn}>Use this</PressButton>
          </div>
        </>
      ) : stage === "failed" && raw ? (
        <>
          <div className="mt-3">
            <ScanningPhoto src={raw} size={size} box={VIEWPORT} points={null} reduced />
          </div>
          <p className="mt-2 text-center text-[12px] font-black text-amber-200">{fail?.message}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PressButton variant="primary" size="none" onClick={reset} className={btn}>Try another</PressButton>
            <PressButton variant="secondary" size="none" onClick={() => setStage("crop")} className={btn}>Crop it by hand</PressButton>
          </div>
        </>
      ) : stage === "crop" && raw ? (
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
          <p className="text-center text-[10px] font-bold text-white">Drag to move, slide to zoom</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PressButton variant="secondary" size="none" onClick={reset} className={btn}>Cancel</PressButton>
            <PressButton variant="primary" size="none" onClick={useCrop} className={btn}>Use this</PressButton>
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
            {/* Start fetching the scan's models the moment this is tapped:
                the phone's photo chooser takes a few seconds anyway, and the
                first scan otherwise spends most of its time loading them. */}
            <label
              onClick={() => { void loadFaceScan().catch(() => { /* the scan will say so */ }); }}
              className="kib-press cursor-pointer rounded-xl py-2 text-center text-[12px] font-black text-white"
              style={GREEN_STYLE}
            >
              {value ? "Change photo" : "Add a photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ""; }}
              />
            </label>
            <PressButton
              variant="secondary"
              size="none"
              onClick={startTakePhoto}
              className="rounded-xl py-2 text-center text-[12px] font-black text-white"
            >
              Take a photo
            </PressButton>
            {/* Fallback for Take a photo when the live camera is refused: the
                phone's own camera app, FRONT camera ("user"). A separate input
                from Add a photo's on purpose (see the header note). */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ""; }}
            />
          </div>

          {/* ── THE SHIRT IS AN ANSWER, NOT A GREYED-OUT ACTION ──
              With no photo set the shirt is already what you will be shown
              as, so this reads as the SELECTED state (ringed, ticked, "Using
              your shirt") rather than as a button somebody has switched off;
              with a photo set it is a live button that clears it. */}
          <button
            onClick={() => onChange(undefined)}
            disabled={!value}
            className={`mt-2 w-full rounded-xl py-2 text-[12px] font-black transition ${
              value ? "kib-press text-white" : "text-emerald-200"}`}
            style={value
              ? { background: "linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.2), inset 0 0 0 1px rgba(255,255,255,.12)" }
              : { background: "linear-gradient(180deg, rgba(16,185,129,.22), rgba(16,185,129,.08))", boxShadow: "inset 0 0 0 1px rgba(52,211,153,.7), 0 0 14px -4px rgba(16,185,129,.7)" }}
          >
            {value ? "Use my shirt" : "✓ Using your shirt"}
          </button>
          {value && !FAKE_FACES.includes(value) && (
            <p className="mt-1.5 text-center text-[10px] font-bold text-white">
              Stored on this device only — about {Math.round(portraitBytes(value) / 1024)} KB.
            </p>
          )}

          <div className="mt-3 border-t border-white/10 pt-3">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
              Or pick a face
            </span>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {FAKE_FACES.map((src, i) => (
                <button
                  key={src}
                  onClick={() => onChange(src)}
                  className={`kib-press relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                    value === src ? "border-emerald-400" : "border-white/15 hover:border-white/50"
                  }`}
                  style={{ backgroundColor: kit.shirt, ...(value === src ? { boxShadow: "0 0 12px -2px rgba(52,211,153,.9)" } : {}) }}
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

const HAIR_WORDS: Record<string, string> = {
  buzz: "a close crop", crop: "a short cut", curly: "curls", swept: "swept over", long: "long",
};

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
          <OwnPortraitImg src={portrait} duotone="grayscale(0.85) contrast(1.2) brightness(1.05)">
            <div className="absolute inset-0" style={{ background: c.duoDark, mixBlendMode: "screen", opacity: 0.85 }} />
            <div className="absolute inset-0" style={{ background: c.duoLight, mixBlendMode: "multiply", opacity: 0.85 }} />
          </OwnPortraitImg>
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
