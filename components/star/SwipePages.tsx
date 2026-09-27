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

export default function SwipePages({ index, onIndex, labels, children }: {
  index: number;
  onIndex: (i: number) => void;
  labels: [string, string, string];
  children: [React.ReactNode, React.ReactNode, React.ReactNode];
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragged = useRef(false);
  const [dx, setDx] = useState(0);
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
    // Resist at the two ends rather than sliding off into nothing.
    const atEdge = (index === 0 && mx > 0) || (index === 2 && mx < 0);
    setDx(atEdge ? mx * 0.25 : mx);
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || !dragged.current) { setDx(0); return; }
    const mx = e.clientX - s.x;
    const turn = Math.abs(mx) > Math.min(80, width * 0.18);
    if (turn && mx < 0 && index < 2) onIndex(index + 1);
    if (turn && mx > 0 && index > 0) onIndex(index - 1);
    setDx(0);
  };
  // A drag is not a tap.
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative mb-2 grid shrink-0 grid-cols-3 rounded-xl bg-black/25 p-1">
        <div
          className="absolute bottom-1 top-1 rounded-lg bg-white/15 shadow transition-transform duration-300 ease-out"
          style={{ width: "calc((100% - 0.5rem) / 3)", left: "0.25rem", transform: `translateX(${index * 100}%)` }}
        />
        {labels.map((l, i) => (
          <button
            key={l}
            onClick={() => onIndex(i)}
            className={`relative z-10 py-1.5 text-[11px] font-black uppercase tracking-widest transition ${i === index ? "text-white" : "text-white/55"}`}
          >
            {l}
          </button>
        ))}
      </div>
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
            transition: dx === 0 ? "transform 320ms cubic-bezier(.2,.8,.2,1)" : "none",
          }}
        >
          {children.map((c, i) => (
            <div key={i} data-scroll-root className="kib-shell-noscroll h-full overflow-y-auto" style={{ width: "33.3333%" }}>
              {c}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
