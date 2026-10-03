"use client";

/**
 * THE POINTER TUTORIAL — small pop-ups with a hand that point AT real things
 * on the real screen, one after another (Harry, 1 Oct 2026, P7, P9, P10, P42,
 * P67, P68: "instead of saying 'this is home' as a pop-up, just pop it up how
 * it does here … 'Home', 'your player' … and then we say 'go to training',
 * and then they have to press 'go to training'").
 *
 *   <PointerTour steps={WELCOME_TOUR} onDone={…} />
 *
 * Every step names a target: any element carrying `data-tour="<name>"`. The
 * rest of the screen is dimmed with a hole over the target; a small bubble
 * says one line and a hand points at it. A normal step moves on with a tap.
 * A `press` step is the one that makes you DO it: the hole is open, the real
 * button underneath takes your tap, and the tour moves on when you press it.
 *
 * If a target is not on screen for 1.2 seconds (a swipe page that is not
 * open, a button that is not there), the step is skipped rather than
 * leaving you stuck behind a dim screen.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KitStyles } from "./ui";
import type { TourStep } from "@/lib/star/tours";

export type { TourStep } from "@/lib/star/tours";

const PAD = 4;
const HAND_H = 46;

type Box = { x: number; y: number; w: number; h: number };

/** The first element with this tour name that is actually on screen.
 *  "css:<selector>" finds by selector instead (a thing with no tour name). */
function findTarget(name: string): HTMLElement | null {
  let all: NodeListOf<HTMLElement>;
  try {
    all = name.startsWith("css:")
      ? document.querySelectorAll<HTMLElement>(name.slice(4))
      : document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  } catch { return null; }
  const vw = window.innerWidth, vh = window.innerHeight;
  for (const el of Array.from(all)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right < 4 || r.left > vw - 4 || r.bottom < 4 || r.top > vh - 4) continue;
    return el;
  }
  return null;
}

function Hand({ down }: { down: boolean }) {
  return (
    <svg width="34" height={HAND_H} viewBox="0 0 34 46" style={{ transform: down ? "rotate(180deg)" : undefined, filter: "drop-shadow(0 3px 5px rgba(0,0,0,.6))" }} aria-hidden>
      <g fill="#fff" stroke="#111827" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <rect x="12" y="2" width="9" height="24" rx="4.5" />
        <rect x="4" y="19" width="26" height="24" rx="9" />
        <path d="M5 26 q-4 2 -2 8 q2 4 5 3" />
      </g>
      <g stroke="#111827" strokeWidth="1.8" strokeLinecap="round" opacity=".55"><path d="M13 30 v8 M17 30 v8 M21 30 v8" /></g>
    </svg>
  );
}

export default function PointerTour({ steps, onDone, skippable = false }: {
  steps: TourStep[];
  onDone: () => void;
  /** A small Skip in the corner (the welcome tour has one; a replayed help tour just ends). */
  skippable?: boolean;
}) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [vp, setVp] = useState({ w: 390, h: 844 });
  const [mounted, setMounted] = useState(false);
  // A press step whose button is disabled (no energy, no sessions) would
  // leave you stuck behind the dim: it becomes a tap-to-go-on step instead.
  const [dead, setDead] = useState(false);
  const doneRef = useRef(false);
  // The bubble's real height, so it can always be kept on screen (v0.25
  // point 14: the social-media tutorial sat off the screen).
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleH, setBubbleH] = useState(84);
  const step = steps[i];

  useEffect(() => setMounted(true), []);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };
  const next = () => {
    setBox(null);
    if (i + 1 >= steps.length) finish(); else setI(i + 1);
  };
  // Skip jumps to the next step you have to DO (the welcome tour's "Go to
  // training"), so skipping the words never skips the one thing you must
  // press (Harry, 2 Oct 2026, P2-55: no Skip on that one).
  const skip = () => {
    const mustDo = steps.findIndex((s, k) => k > i && s.press);
    setBox(null);
    if (mustDo < 0) finish(); else setI(mustDo);
  };

  // Find the target and keep its box up to date (pages slide, bars animate).
  useLayoutEffect(() => {
    if (!step) return;
    let gone = 0;
    let el: HTMLElement | null = null;
    let off: (() => void) | undefined;
    const read = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      if (step.target === "screen") {
        const s = findTarget("screen");
        if (s) { const r = s.getBoundingClientRect(); setBox({ x: r.left, y: r.top, w: r.width, h: r.height }); gone = 0; return; }
        // A full screen with no "screen" box (Achievements, Sponsors): the
        // bubble sits on the whole page.
        setBox({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
        return;
      }
      const found = findTarget(step.target);
      if (!found) {
        gone += 1;
        if (gone > 12) next(); // 1.2 s with no such thing on screen: move on
        return;
      }
      gone = 0;
      setDead(!!step.press && found.matches(":disabled"));
      if (found !== el) {
        off?.();
        el = found;
        if (step.press) {
          const onPress = () => setTimeout(next, 30);
          found.addEventListener("click", onPress, true);
          off = () => found.removeEventListener("click", onPress, true);
        }
      }
      const r = found.getBoundingClientRect();
      setBox((b) => (b && Math.abs(b.x - r.left) < 0.5 && Math.abs(b.y - r.top) < 0.5 && Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { x: r.left, y: r.top, w: r.width, h: r.height }));
    };
    read();
    const t = setInterval(read, 100);
    window.addEventListener("resize", read);
    return () => { clearInterval(t); window.removeEventListener("resize", read); off?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, step?.target]);

  useLayoutEffect(() => {
    const h = bubbleRef.current?.offsetHeight;
    if (h && Math.abs(h - bubbleH) > 1) setBubbleH(h);
  });

  if (!mounted || !step || !box) return null;
  const press = !!step.press && !dead;

  const wholeScreen = step.target === "screen";
  const hole: Box = wholeScreen ? { x: 0, y: 0, w: 0, h: 0 } : { x: box.x - PAD, y: box.y - PAD, w: box.w + PAD * 2, h: box.h + PAD * 2 };
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const bubbleW = Math.min(268, vp.w - 24);
  const left = Math.max(12, Math.min(vp.w - bubbleW - 12, cx - bubbleW / 2));
  const DIM = "rgba(0,0,0,.62)";
  const last = i === steps.length - 1;

  // Where the bubble goes: above or below the hole, with the hand between.
  // A target nearly as tall as the phone (a whole feed) leaves room on
  // neither side: then the bubble sits inside the hole, near its top, with
  // no hand. Whatever happens it stays fully on screen.
  const EDGE = 12;
  const need = bubbleH + HAND_H + 4;
  const roomAbove = hole.y - EDGE;
  const roomBelow = vp.h - (hole.y + hole.h) - EDGE;
  const wantAbove = cy > vp.h * 0.5;
  const place: "above" | "below" | "inside" = wholeScreen ? "inside"
    : wantAbove && roomAbove >= need ? "above"
    : !wantAbove && roomBelow >= need ? "below"
    : roomAbove >= need ? "above"
    : roomBelow >= need ? "below"
    : "inside";
  const above = place === "above";
  const clampTop = (t: number) => Math.max(EDGE, Math.min(vp.h - bubbleH - EDGE, t));
  const bubbleStyle: React.CSSProperties = wholeScreen
    ? { left, width: bubbleW, top: clampTop(Math.max(80, box.y + Math.min(80, box.h * 0.2))) }
    : place === "above"
      ? { left, width: bubbleW, top: clampTop(hole.y - HAND_H - 2 - bubbleH) }
      : place === "below"
        ? { left, width: bubbleW, top: clampTop(hole.y + hole.h + HAND_H + 2) }
        : { left, width: bubbleW, top: clampTop(Math.max(hole.y, 0) + 24) };
  const handLeft = Math.max(8, Math.min(vp.w - 42, cx - 17));
  const handStyle: React.CSSProperties = above
    ? { left: handLeft, top: hole.y - HAND_H - 2, ["--hy" as string]: "8px" }
    : { left: handLeft, top: hole.y + hole.h + 2, ["--hy" as string]: "-8px" };

  const panel = (key: string, s: React.CSSProperties) => (
    <div key={key} className="fixed" style={{ background: DIM, pointerEvents: "auto", ...s }} onClick={press ? undefined : next} />
  );

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[96]" role="dialog" aria-label={step.text} data-tour-overlay>
      <KitStyles />
      {wholeScreen ? (
        panel("all", { left: 0, top: 0, width: vp.w, height: vp.h, background: "rgba(0,0,0,.45)" })
      ) : (<>
        {panel("t", { left: 0, top: 0, width: vp.w, height: Math.max(0, hole.y) })}
        {panel("b", { left: 0, top: hole.y + hole.h, width: vp.w, height: Math.max(0, vp.h - hole.y - hole.h) })}
        {panel("l", { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h })}
        {panel("r", { left: hole.x + hole.w, top: hole.y, width: Math.max(0, vp.w - hole.x - hole.w), height: hole.h })}
        {/* The hole: a normal step takes the tap itself; a press step lets it through to the real button. */}
        <div
          className="kit-tour-ring fixed"
          style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 4, pointerEvents: press ? "none" : "auto" }}
          onClick={press ? undefined : next}
        />
        {place !== "inside" && <div className="kit-hand-bob fixed pointer-events-none" style={handStyle}><Hand down={above} /></div>}
      </>)}
      <div
        key={i}
        ref={bubbleRef}
        className="kit-rise fixed rounded-[6px] px-3 py-2.5 text-white"
        style={{ ...bubbleStyle, pointerEvents: "auto", background: "linear-gradient(180deg,#1f2937,#0b1220)", boxShadow: "inset 0 0 0 2px #fde047, 0 12px 30px -8px rgba(0,0,0,.9)" }}
        onClick={press ? undefined : next}
      >
        <div className="text-[16px] font-black leading-snug">{step.text}</div>
        {!press && (
          <div className="mt-1 flex items-center justify-between">
            {skippable
              ? <button onClick={(e) => { e.stopPropagation(); skip(); }} className="kib-press text-[11px] font-black uppercase tracking-widest text-white/55">Skip</button>
              : <span />}
            {!press && <span className="text-[12px] font-black uppercase tracking-widest text-amber-300">{last ? "Got it" : "Next ▸"}</span>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
