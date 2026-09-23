"use client";

/**
 * PICK THE CAMERA ON THE WHOLE PITCH — for the Scenario Gallery.
 *
 * Asked for directly (23 Sep 2026): the gallery needed the Scenario Builder's
 * "Pick on the whole pitch" — zoom out to the whole pitch, drag the dashed
 * frame to where the camera should be, let go, "Done — back to editing" — so
 * a one-on-one can be framed further left, say, and play from there in the
 * game.
 *
 * Drawn by the Scenario Builder's own `renderScenario`, with its dashed-frame
 * overlay, so the two tools look and behave the same. The camera only
 * slides — its size never changes, exactly like the Builder — and it is
 * handed back on release as a real `Viewport`, which the gallery's edit
 * store, its save and the game already carry (scenarioEdit.ts's
 * `PosOverride.camera` → `frameToMatchScenario` → authoredChance.ts).
 */

import { useEffect, useRef, useState } from "react";
import type { Viewport } from "@/lib/star/canvasEngine";
import { PITCH_W, HALF_LEN } from "@/lib/star/pitch";
import { renderScenario } from "@/lib/star/scenarioRender";
import { frameCssSize, type Frame, type FrameSizing } from "@/lib/star/scenarioFrame";

/** How much pitch the overview shows top to bottom — the Builder's own
 *  figure, tall enough for the whole pitch with a little room around it. */
const FULL_PITCH_VIEW_HEIGHT = 125;

export default function CameraPicker({ frame, size, onChange }: {
  frame: Frame;
  size?: FrameSizing;
  /** The camera, moved — called when the drag is released. */
  onChange: (camera: Viewport) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ballImg = useRef<HTMLImageElement | null>(null);
  const [camera, setCamera] = useState<Viewport>(frame.camera);
  const dragging = useRef(false);

  // A different picture, or the same one moved elsewhere, starts from its own camera.
  useEffect(() => { setCamera(frame.camera); }, [frame.camera]);

  // The same box the picture itself sits in, so nothing jumps when you switch.
  const { cssW, cssH } = frameCssSize(frame, size);
  // The overview: the whole pitch, at the box's own shape.
  let viewH = FULL_PITCH_VIEW_HEIGHT;
  if (viewH * (cssW / cssH) < PITCH_W + 10) viewH = (PITCH_W + 10) * (cssH / cssW);
  const viewW = viewH * (cssW / cssH);
  const overview: Viewport = {
    x1: PITCH_W / 2 - viewW / 2, x2: PITCH_W / 2 + viewW / 2,
    y1: HALF_LEN - viewH / 2, y2: HALF_LEN + viewH / 2,
  };

  const paint = () => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    renderScenario(canvas, {
      viewport: overview,
      facing: "up",
      players: frame.items.map((it) => ({ x: it.at.x, y: it.at.y, side: it.side })),
      ball: frame.ball,
      ballImage: ballImg.current,
      frameOverlay: camera,
    });
  };
  useEffect(paint);
  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.png";
    img.onload = paint;
    ballImg.current = img;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Centre the camera wherever the pointer is on the overview. */
  const moveTo = (e: React.PointerEvent<HTMLCanvasElement>): Viewport => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = overview.x1 + ((e.clientX - rect.left) / rect.width) * (overview.x2 - overview.x1);
    const y = overview.y1 + ((e.clientY - rect.top) / rect.height) * (overview.y2 - overview.y1);
    const halfW = (camera.x2 - camera.x1) / 2, halfH = (camera.y2 - camera.y1) / 2;
    const next = { x1: x - halfW, x2: x + halfW, y1: y - halfH, y2: y + halfH };
    setCamera(next);
    return next;
  };

  return (
    <div style={{ position: "relative", width: cssW, margin: "0 auto" }}>
      <canvas
        ref={ref}
        style={{ display: "block", width: cssW, height: cssH, borderRadius: 20, cursor: "move", touchAction: "none" }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; moveTo(e); }}
        onPointerMove={(e) => { if (dragging.current) moveTo(e); }}
        onPointerUp={(e) => { if (!dragging.current) return; dragging.current = false; onChange(moveTo(e)); }}
        onPointerCancel={() => { dragging.current = false; }}
      />
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 10, textAlign: "center", pointerEvents: "none",
          fontSize: 12, fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        }}
      >
        Drag anywhere — release to set the camera there
      </div>
    </div>
  );
}
