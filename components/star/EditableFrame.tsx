"use client";

/**
 * THE EDITABLE FRAME — one canvas you can drag people around on.
 *
 * Lifted out of `app/star-gallery-dev/page.tsx` UNCHANGED so Infinite
 * Highlights (`app/star-highlights-dev/page.tsx`) drags, selects and swipes
 * through exactly the same code the gallery does. One renderer
 * (`scenarioFrame.ts`), one set of edit rules (`scenarioEdit.ts`), one pointer
 * handler — this file.
 *
 * Drag any figure or the ball; the grabbed point stays under the pointer (a
 * rigid translate, not a snap), so the inverse of `projectionFor` has to be
 * exact. A live drag repaints THIS canvas directly, committing to the caller's
 * edit store on release.
 *
 * A press that grabs NOTHING is a swipe across the grass. A press that grabs
 * somebody is a drag and never a swipe — which is what stops a correction
 * being read as "next picture".
 */

import { useEffect, useRef } from "react";
import type { Vec2 } from "@/lib/star/canvasEngine";
import {
  frameCssSize,
  frameScreen,
  type FrameKits,
  type FrameSizing,
  paintMarked,
  HIT_FIGURE_R,
  HIT_BODY_UP,
  type Frame,
  type Mark,
} from "@/lib/star/scenarioFrame";
import { applyOverride, cloneOverride, type PosOverride } from "@/lib/star/scenarioEdit";

export default function EditableFrame({
  editKey, baseFrame, override, marks, onCommit, edited, selectedId, onSelect, onSwipe, fit, size, kits,
}: {
  /** Which picture this is, handed straight back on commit. */
  editKey: string;
  baseFrame: Frame;
  override: PosOverride | undefined;
  marks: Mark[];
  onCommit: (key: string, ov: PosOverride) => void;
  edited: boolean;
  /** Which figure is tapped, for the add/remove controls under the picture. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** A flick across empty grass — never across a figure, which is a drag. */
  onSwipe?: (dir: 1 | -1) => void;
  /** Bigger box on a desktop, where the phone-sized default wastes the screen. */
  size?: FrameSizing;
  /** Let the canvas shrink to a narrow phone rather than running off the
   *  side. The pointer maths already reads the real rect, so a scaled canvas
   *  still drags exactly. */
  fit?: boolean;
  /** The kits Play will wear (see `useTestKits`), so pressing Play changes
   *  no colours. Absent: the diagram's blue against red. */
  kits?: FrameKits | null;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const workingRef = useRef<PosOverride | null>(null);
  const dragRef = useRef<{ target: "ball" | string; offX: number; offY: number } | null>(null);
  /** Where a press that grabbed NOTHING started, so it can become a swipe. */
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const { cssW, cssH } = frameCssSize(baseFrame, size);

  const effectiveOverride = (): PosOverride | undefined => workingRef.current ?? override;
  const currentFrame = (): Frame => applyOverride(baseFrame, effectiveOverride());
  const repaint = (live: boolean): void => {
    if (!ref.current) return;
    const frame = currentFrame();
    const sel = frame.items.find((it) => it.id === selectedId);
    const ring: Mark[] = sel ? [{ at: { ...sel.at }, tone: "select" }] : [];
    // Mid-drag the fault rings would be stale (they are derived from a rebuilt
    // scenario, not the canvas), so the picture drops them and gets them back
    // the instant the drag commits. The selection ring stays — it is the thing
    // under your finger.
    paintMarked(ref.current, frame, live ? ring : [...marks, ...ring], size, kits ?? undefined);
    if (fit && ref.current) {
      ref.current.style.maxWidth = "100%";
      ref.current.style.height = "auto";
    }
  };

  useEffect(() => {
    repaint(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey, baseFrame, override, marks, selectedId, fit, kits]);

  // The exact inverse of the picture's own camera, quarter turn and all — a
  // corner is drawn turned like the match draws it, so a drag across the
  // screen there is a drag along pitch Y (scenarioFrame.ts's `frameScreen`).
  function pointerToWorld(e: React.PointerEvent<HTMLCanvasElement>): Vec2 {
    const rect = ref.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (cssW / (rect.width || cssW));
    const cy = (e.clientY - rect.top) * (cssH / (rect.height || cssH));
    // The camera actually DRAWN — the saved/base one with any unsaved camera
    // move on top. Reading `baseFrame.camera` here meant that after "Camera:
    // pick on the whole pitch" moved the view, a press was placed as if the
    // camera had never moved: on the reported one-on-one a press on a player
    // landed 32m away on empty grass, so nothing in the new view could be
    // grabbed until the card was saved (Harry and Mikey, scenario sprint).
    return frameScreen(currentFrame(), cssW, cssH).toWorld(cx, cy);
  }

  /** Nearest grabbable to a world point, or null. Figures are grabbed by their
   *  mid-body (drawn above the feet anchor); the ball by its centre. */
  function grabTargetAt(world: Vec2): "ball" | string | null {
    const frame = currentFrame();
    const scr = frameScreen(frame, cssW, cssH);
    const r = Math.max(7, scr.unit * HIT_FIGURE_R);
    const w = scr.toScreen(world);
    let best: "ball" | string | null = null;
    let bestD = Infinity;
    frame.items.forEach((it) => {
      const s = scr.toScreen(it.at);
      // Figures stand upright on screen even on a turned pitch, so the body
      // is always up the SCREEN from the feet.
      const d = Math.hypot(s.x - w.x, s.y - r * HIT_BODY_UP - w.y);
      if (d < r * 1.15 && d < bestD) { bestD = d; best = it.id; }
    });
    const b = scr.toScreen(frame.ball);
    const bd = Math.hypot(b.x - w.x, b.y - w.y);
    if (bd < Math.max(14, r * 0.6) && bd < bestD) { best = "ball"; }
    return best;
  }

  // Held inside the camera on screen, for the same reason — the old camera's
  // box would stop a drag at an edge you can no longer see.
  const clampToView = (v: Vec2): Vec2 => {
    const vp = currentFrame().camera;
    return {
      x: Math.max(vp.x1, Math.min(vp.x2, v.x)),
      y: Math.max(vp.y1, Math.min(vp.y2, v.y)),
    };
  };

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    const world = pointerToWorld(e);
    const target = grabTargetAt(world);
    if (target === null) {
      onSelect(null);
      swipeRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    swipeRef.current = null;
    e.preventDefault();
    onSelect(target === "ball" ? null : target);
    const frame = currentFrame();
    const at = target === "ball" ? frame.ball : frame.items.find((it) => it.id === target)!.at;
    dragRef.current = { target, offX: at.x - world.x, offY: at.y - world.y };
    workingRef.current = cloneOverride(effectiveOverride());
    ref.current?.setPointerCapture(e.pointerId);
    if (ref.current) ref.current.style.cursor = "grabbing";
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) {
      if (ref.current) {
        const t = grabTargetAt(pointerToWorld(e));
        ref.current.style.cursor = t === null ? "default" : "grab";
      }
      return;
    }
    const world = pointerToWorld(e);
    const next = clampToView({ x: world.x + drag.offX, y: world.y + drag.offY });
    const wk = workingRef.current ?? { items: {} };
    if (drag.target === "ball") wk.ball = next;
    else wk.items[drag.target] = next;
    workingRef.current = wk;
    repaint(true);
  }

  function endDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) {
      const sw = swipeRef.current;
      swipeRef.current = null;
      if (sw && onSwipe) {
        const dx = e.clientX - sw.x;
        const dy = e.clientY - sw.y;
        if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) onSwipe(dx < 0 ? 1 : -1);
      }
      return;
    }
    dragRef.current = null;
    const wk = workingRef.current;
    workingRef.current = null;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (ref.current) ref.current.style.cursor = "grab";
    if (wk) onCommit(editKey, wk);
  }

  return (
    <canvas
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        display: "block",
        margin: "0 auto",
        borderRadius: 20,
        background: "#14532d",
        cursor: "grab",
        touchAction: "none",
        border: edited ? "2px solid #38bdf8" : "2px solid rgba(255,255,255,0.06)",
      }}
    />
  );
}
