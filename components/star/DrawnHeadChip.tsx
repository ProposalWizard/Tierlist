"use client";
import { useEffect, useRef } from "react";
import { drawFigureAt, FIGURE_HEIGHT_R } from "@/lib/star/fiveASide/render";
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";

/**
 * A man's drawn head and shoulders, in his kit, for a round chip (the team
 * sheets). Photo faces are off (PHOTO_FACES, faceStyle.ts; Harry, 12 Oct
 * 2026), so the chip shows the same drawn head the match draws on him: his
 * own skin and hair from his id, no photo. Drawn once (no animation loop).
 */
export default function DrawnHeadChip({ id, shirt, shorts, trim, size }: {
  id: string; shirt: string; shorts: string; trim: string; size: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    // Big enough that the head and the collar fill the chip; the crown just
    // under the top edge, the rest of him off the bottom.
    const r = size * 1.25;
    const crown = size * 0.1;
    const groundY = crown + r * FIGURE_HEIGHT_R;
    drawFigureAt(g, size / 2, groundY, r, { shirt, shorts, trim, id }, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { shadowR: 0 });
  }, [id, shirt, shorts, trim, size]);
  return <canvas ref={ref} aria-hidden style={{ width: size, height: size, display: "block" }} />;
}
