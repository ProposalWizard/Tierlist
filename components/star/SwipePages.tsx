"use client";

/**
 * THREE SCREENS SIDE BY SIDE — swipe between them, or tap the tab.
 *
 * The same idea as the Garden (GardenScreen.tsx: stable · garden · bench),
 * built on pointer events rather than touch events so a mouse on a PC can drag
 * it too. `touch-action: pan-y` hands vertical movement to the browser, so
 * each screen still scrolls normally with a finger; only a sideways drag
 * turns the page. A drag that turned the page never also counts as a tap on
 * whatever button it started on.
 */
import { useRef, useState } from "react";
import type { EdgeArrow } from "./ui/Nav";

/** A TAP on a tab or an arrow turns the page on the same frame: no slide
 *  (Harry, 14 Oct 2026: "If I click on something, it should just go
 *  straight in"). Only a finger that dragged the page part-way gets a short
 *  settle for the rest of the way, so the page does not jump out from under
 *  it. It was a 420 ms spring for both. */
const DRAG_SETTLE = "140ms ease-out";

export type PageTone = "calm" | "pitch";

export default function SwipePages({ index, onIndex, labels, children, inset = false, arrows, tones }: {
  index: number;
  onIndex: (i: number) => void;
  labels: [string, string, string];
  children: [React.ReactNode, React.ReactNode, React.ReactNode];
  /** The pages and the tab row carry their own 12px side padding (the shell
   *  adds none), so a page can bleed to both edges. Home uses it. */
  inset?: boolean;
  /** NSS style (Harry, 1 Oct 2026: "the stats/home shop area was meant to
   *  become arrows at the bottom … an arrow on either side"): no tab row at
   *  the top. A small arrow with a tiny label sits at the bottom-left and
   *  bottom-right edge, naming the page on that side; a swipe still turns the
   *  page. One icon per page. `leftEnd` fills the left arrow on the FIRST page
   *  (Stats → League). Pages in `bleed` draw under the arrows (Home's pitch);
   *  the rest get room at the bottom so nothing scrolls behind them. */
  arrows?: { icons: [string, string, string]; leftEnd?: EdgeArrow; bleed?: number[] };
  /** A page's colours in the Pitch look (pitchLook.css): "calm" paints that
   *  page in the neutral shop tone instead of the grass (v0.25, P44). */
  tones?: [PageTone?, PageTone?, PageTone?];
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragged = useRef(false);
  const [dx, setDx] = useState(0);
  /** The page is settling after a drag (cleared when that settle ends, so a
   *  later tap — here or from the parent — still jumps). */
  const [fromDrag, setFromDrag] = useState(false);
  const settle = fromDrag ? `transform ${DRAG_SETTLE}` : "none";
  const [width, setWidth] = useState(1);
  const vp = useRef<HTMLDivElement>(null);

  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragged.current = false;
    setWidth(vp.current?.clientWidth ?? 1);
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!dragged.current) {
      if (Math.abs(mx) < 10 || Math.abs(mx) < Math.abs(my) * 1.2) return;
      dragged.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    // No dragging past the two ends: there is nothing there (Mikey, 29 Sep
    // 2026: "I don't think I should let you drag to the left like that").
    const atEdge = (index === 0 && mx > 0) || (index === 2 && mx < 0);
    setDx(atEdge ? 0 : mx);
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || !dragged.current) { setDx(0); return; }
    const mx = e.clientX - s.x;
    const turn = Math.abs(mx) > Math.min(80, width * 0.18);
    setFromDrag(true);
    if (turn && mx < 0 && index < 2) onIndex(index + 1);
    if (turn && mx > 0 && index > 0) onIndex(index - 1);
    setDx(0);
  };
  // A drag is not a tap.
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {!arrows ? (
      <div className={`relative mb-2 grid shrink-0 grid-cols-3 rounded-[3px] bg-black/30 p-1 ${inset ? "mx-3" : ""}`}>
        {/* The highlight and its underline follow the finger while you
            drag; a tap moves them at once. */}
        <div
          className="absolute bottom-1 top-1 rounded-[2px] bg-white/15"
          style={{
            width: "calc((100% - 0.5rem) / 3)", left: "0.25rem",
            transform: `translateX(${(index - dx / width) * 100}%)`,
            transition: dx === 0 ? settle : "none",
          }}
        >
          <div className="absolute inset-x-5 -bottom-[3px] h-[3px] rounded-full bg-emerald-400" style={{ boxShadow: "0 0 8px rgba(52,211,153,.8)" }} />
        </div>
        {labels.map((l, i) => (
          <button
            key={l}
            data-tour={`tab-${i}`}
            onClick={() => { setFromDrag(false); onIndex(i); }}
            className={`relative z-10 py-1.5 text-[11px] font-black uppercase tracking-widest ${i === index ? "text-white" : "text-white/55"}`}
          >
            {l}
          </button>
        ))}
      </div>
      ) : null}
      <div
        ref={vp}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { start.current = null; setDx(0); }}
        onClickCapture={onClickCapture}
      >
        <div
          className="absolute inset-y-0 left-0 flex"
          style={{
            width: "300%",
            transform: `translateX(calc(${-index * (100 / 3)}% + ${dx}px))`,
            transition: dx === 0 ? settle : "none",
          }}
          onTransitionEnd={(e) => { if (e.target === e.currentTarget) setFromDrag(false); }}
        >
          {children.map((c, i) => (
            // Each page scrolls on its own, and a scroll box starts a fresh
            // touch-action: without pan-y here too, a finger's sideways drag
            // was taken by the phone as a scroll (pointercancel) and the page
            // never turned. Mouse drags were unaffected, which hid it.
            // data-page-active: the page on screen (its cards used to play a
            // rise-in on it; since 14 Oct 2026 they just show).
            <div key={i} data-scroll-root data-page-active={i === index} data-sk-tone={tones?.[i]} className={`kib-shell-noscroll h-full overflow-y-auto ${inset ? "px-3" : ""} ${arrows && !arrows.bleed?.includes(i) ? "pb-[38px]" : ""}`} style={{ width: "33.3333%", touchAction: "pan-y" }}>
              {c}
            </div>
          ))}
        </div>
      </div>
      {arrows && (
        // The two edge hints, along the bottom of the pages (above the bottom
        // bar). Words, not buttons (Mikey, 23 Oct 2026: "they should just be
        // indicators … text that tells you to swipe that way"): a tap does
        // nothing, a swipe turns the page. Under the bar, so the round Play
        // button sits in front of the Shop hint.
        <div data-edge-arrows className="pointer-events-none absolute inset-x-0 bottom-1 z-10 flex items-end justify-between px-2">
          <div>
            {index > 0 ? <SwipeHint side="left" tour={`tab-${index - 1}`} icon={arrows.icons[index - 1]} label={labels[index - 1]} /> : null}
          </div>
          <div>
            {index < 2 ? <SwipeHint side="right" tour={`tab-${index + 1}`} icon={arrows.icons[index + 1]} label={labels[index + 1]} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** "‹ 📊 STATS": which page is that way. Plain text you swipe towards, never tapped. */
function SwipeHint({ side, tour, icon, label }: { side: "left" | "right"; tour: string; icon: string; label: string }) {
  return (
    <div data-tour={tour} data-swipe-hint={side} aria-hidden
      className={`flex h-[22px] items-center gap-1 px-1 text-white/70 ${side === "right" ? "flex-row-reverse" : ""}`}
      style={{ textShadow: "0 1px 3px rgba(0,0,0,.85)" }}>
      <span className="text-[12px] leading-none">{side === "left" ? "‹" : "›"}</span>
      <span className="text-[11px] leading-none">{icon}</span>
      <span className="text-[9.5px] font-semibold uppercase leading-none tracking-wide">{label}</span>
    </div>
  );
}
