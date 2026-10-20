"use client";

/**
 * THE LEVEL'S PICTURE, DRAGGABLE (Harry, 20 Oct 2026: "the training editor
 * should be drag and drop like the gallery").
 *
 * The level drawn top-down with the drill's own figures (trainingRender.ts),
 * from the level's numbers. Press on the ball, a cone or a man and drag:
 * what moves and which numbers it changes is listed per drill in
 * lib/star/trainingLayout.ts. Like the gallery's picture: the point you
 * grabbed stays under your finger, the numbers beside it change as you go,
 * and one drag is one step for Undo. Works with a finger (pointer events,
 * no page scroll while a drag is on the picture).
 */

import { useEffect, useRef, useState } from "react";
import { renderTrainingScene, type TrainingViewport } from "@/lib/star/trainingRender";
import { levelLayout, moveHandle, type LayoutHandle } from "@/lib/star/trainingLayout";
import type { AnyLevel, Spot, TrainingSkill } from "@/lib/star/trainingLevelData";

/** How near (CSS px) a press must land to grab something — a fingertip. */
const GRAB_PX = 30;

export default function LevelPicture({
  skill, level, row, onStart, onMove,
}: {
  skill: TrainingSkill;
  level: number;
  row: AnyLevel;
  /** A drag is starting: the page keeps the row as it is now, for Undo. */
  onStart: () => void;
  /** The row with the dragged thing moved (called as the finger moves). */
  onMove: (next: AnyLevel) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  // The drag in progress: what, the grab offset (metres), and the window held
  // still while it lasts (a moving frame under a moving finger is unusable).
  const dragRef = useRef<{ id: string; dx: number; dy: number; vp: TrainingViewport; axis?: "x"; base: AnyLevel } | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [, setLoaded] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.webp";
    img.onload = () => setLoaded(n => n + 1);
    ballImgRef.current = img;
  }, []);

  const layout = levelLayout(skill, row, level);

  // Size the canvas to its box at devicePixelRatio and paint.
  useEffect(() => {
    const c = canvasRef.current, wrap = wrapRef.current;
    if (!c || !wrap || !layout) return;
    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
      const h = Math.max(1, Math.round(wrap.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const vp = dragRef.current?.vp ?? layout.viewport;
      renderTrainingScene(c, { viewport: vp, ...layout.scene, ballImage: ballImgRef.current });
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const sx = c.width / (vp.x2 - vp.x1), sy = c.height / (vp.y2 - vp.y1);
      const px = (p: Spot) => ({ x: (p.x - vp.x1) * sx, y: (p.y - vp.y1) * sy });
      for (const ln of layout.lines ?? []) {
        const a = px(ln.from), b = px(ln.to);
        ctx.save();
        ctx.strokeStyle = ln.tone === "finish" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)";
        ctx.lineWidth = (ln.tone === "finish" ? 3 : 1.5) * dpr;
        if (ln.tone === "edge") ctx.setLineDash([6 * dpr, 6 * dpr]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
      }
      // A ring on everything you can grab; bright on the one under the finger.
      for (const h of layout.handles) {
        const p = px(h.at);
        const on = h.id === held || h.id === hover;
        const r = (h.kind === "ball" ? 15 : h.kind === "gate" ? 9 : 18) * dpr;
        const cy = h.kind === "man" ? p.y - 10 * dpr : p.y;
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = (on ? 3 : 1.5) * dpr;
        ctx.strokeStyle = on ? "#ffd84a" : "rgba(255,255,255,0.55)";
        if (!on) ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.stroke();
        if (h.kind === "gate") { ctx.fillStyle = on ? "#ffd84a" : "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(p.x, cy, 3 * dpr, 0, Math.PI * 2); ctx.fill(); }
        if (h.axis === "x" && on) {
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(p.x - r - 10 * dpr, cy); ctx.lineTo(p.x + r + 10 * dpr, cy); ctx.stroke();
        }
        ctx.restore();
      }
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  });

  if (!layout) return null;

  /** Pointer → pitch metres, through the window on screen. */
  const toWorld = (e: React.PointerEvent, vp: TrainingViewport): Spot => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: vp.x1 + ((e.clientX - r.left) / Math.max(1, r.width)) * (vp.x2 - vp.x1),
      y: vp.y1 + ((e.clientY - r.top) / Math.max(1, r.height)) * (vp.y2 - vp.y1),
    };
  };
  /** The handle nearest the pointer, within a fingertip. */
  const handleAt = (e: React.PointerEvent): LayoutHandle | null => {
    const r = canvasRef.current!.getBoundingClientRect();
    const vp = layout.viewport;
    const sx = r.width / (vp.x2 - vp.x1), sy = r.height / (vp.y2 - vp.y1);
    let best: LayoutHandle | null = null, bestD = GRAB_PX;
    for (const h of layout.handles) {
      const hx = r.left + (h.at.x - vp.x1) * sx;
      // A man is grabbed by his body, drawn above his feet.
      const hy = r.top + (h.at.y - vp.y1) * sy - (h.kind === "man" ? 10 : 0);
      const d = Math.hypot(e.clientX - hx, e.clientY - hy);
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  };

  const onDown = (e: React.PointerEvent) => {
    const h = handleAt(e);
    if (!h) return;
    e.preventDefault();
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const vp = layout.viewport;
    const w = toWorld(e, vp);
    dragRef.current = { id: h.id, dx: h.at.x - w.x, dy: h.at.y - w.y, vp, axis: h.axis, base: row };
    setHeld(h.id);
    onStart();
  };
  const onMoveP = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) {
      if (e.pointerType === "mouse") setHover(handleAt(e)?.id ?? null);
      return;
    }
    const w = toWorld(e, d.vp);
    const at = { x: w.x + d.dx, y: d.axis === "x" ? (layout.handles.find(h => h.id === d.id)?.at.y ?? w.y) : w.y + d.dy };
    onMove(moveHandle(skill, d.base, level, d.id, at));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setHeld(null);
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const grabbed = layout.handles.find(h => h.id === (held ?? hover));
  // Where each handle sits, as a share of the picture's width and height —
  // for a test driver to find the ball or a man without reading pixels.
  const vpNow = dragRef.current?.vp ?? layout.viewport;
  const handleSpots = JSON.stringify(layout.handles.map(h => ({
    id: h.id,
    fx: +((h.at.x - vpNow.x1) / (vpNow.x2 - vpNow.x1)).toFixed(4),
    fy: +((h.at.y - vpNow.y1) / (vpNow.y2 - vpNow.y1)).toFixed(4),
  })));
  return (
    <div className="tr-lp">
      <div ref={wrapRef} className="tr-lp-box" data-testid="level-picture" data-handles={handleSpots}>
        <canvas
          ref={canvasRef}
          className="tr-lp-canvas"
          style={{ touchAction: "none", cursor: held ? "grabbing" : hover ? "grab" : "default" }}
          onPointerDown={onDown}
          onPointerMove={onMoveP}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => { if (!dragRef.current) setHover(null); }}
          aria-label="The level's picture: drag the ball, the cones or the men"
        />
      </div>
      <div className="tr-lp-cap">{grabbed ? `Moving ${grabbed.label}` : skill === "pace" ? "Drag a man across his line" : "Drag the ball, the cones or the men"}</div>
    </div>
  );
}
