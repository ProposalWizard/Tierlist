"use client";
import { useState } from "react";
import { loadFaceScale, saveFaceScale, FACE_SCALE_MIN, FACE_SCALE_MAX } from "@/lib/star/faceScale";

/**
 * "make a way i can edit it somehow to perfection... then save it like
 * that" — requested directly, after the default (see faceScale.ts) still
 * read as too small on a real phone. There's no visually-verified "right"
 * size without a live look, so this hands the dial over rather than
 * guessing again: drag it, the next match you play draws at that size.
 */
export default function FaceScalePanel() {
  const [scale, setScale] = useState(loadFaceScale);

  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Player Face Size</div>
      <p className="mt-1 text-[11px] font-semibold text-white/90">
        How big real player photos (and everyone&apos;s head, photo or not) draw on the pitch. Takes effect the next match you play.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="range"
          min={FACE_SCALE_MIN}
          max={FACE_SCALE_MAX}
          step={0.1}
          value={scale}
          onChange={(e) => {
            const v = Number(e.target.value);
            setScale(v);
            saveFaceScale(v);
          }}
          className="flex-1 accent-emerald-500"
        />
        <span className="w-10 text-right text-[11px] font-black tabular-nums text-white">{scale.toFixed(1)}x</span>
      </div>
    </div>
  );
}
