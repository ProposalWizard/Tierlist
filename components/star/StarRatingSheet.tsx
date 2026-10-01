"use client";

/**
 * THE STAR PASS — a scrolling strip of levels (opened from the rating in the
 * top HUD). Harry, 1 Oct 2026 (P11): "when they click in it should be like a
 * scrolling kind of calendar looking thing where they can scroll left and it
 * will take them across level one, level two, level three … what that unlocks
 * for them." The red "★29 gate" box is gone.
 *
 * Each level is a square card: what it unlocks, as pictures (the shop items
 * that open at that star rating, lib/star/unlocks.ts `styleUnlockStar`). A
 * padlock card sits in the path wherever a gate holds you
 * (lib/star/starPoints.ts `STAR_GATES`). Your level is lit with its progress
 * bar; levels you have not reached are dimmed. Tap a card for its names — the
 * gate's one line, or the ten Legend tasks at the end. The strip opens
 * centred on you. Pictures and names only; no explaining sentences.
 *
 * Existing star-points numbers are unchanged: this reads starStatus() and
 * ledgerOf() exactly as before.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CareerState } from "@/lib/star/types";
import { starStatus, STAR_GATES, LEGEND_TASKS, ledgerOf, starTitle, MAX_LEVEL, POINTS_CAP_LEVEL } from "@/lib/star/starPoints";
import { LIFESTYLE_ALL_LEVELS, baseIdOf } from "@/lib/star/shopData";
import { styleUnlockStar } from "@/lib/star/unlocks";
import { familyName } from "@/lib/star/lifestyleLevels";
import StylePicture from "./StylePicture";
import { SquareBar, BottomBar, BarButton, Chev } from "./ui";

const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");
const CARD_W = 148;   // a level with something in it
const SLIM_W = 60;    // a level with nothing new
const GATE_W = 70;
const CARD_H = 196;

interface Unlock { base: string; name: string }

export default function StarRatingSheet({ career, onClose }: { career: CareerState; onClose: () => void }) {
  const st = starStatus(career);
  const led = ledgerOf(career);
  const rows: [string, number][] = [
    ["Matches", st.points.match], ["Trophies", st.points.trophies], ["Awards", st.points.awards],
    ["Milestones", st.points.milestones], ["Fame", st.points.status],
    ...(st.carry > 0 ? [["Carried", st.carry] as [string, number]] : []),
  ];

  // Level → the shop items that open at it.
  const byLevel = useMemo(() => {
    const m = new Map<number, Unlock[]>();
    const seen = new Set<string>();
    for (const it of LIFESTYLE_ALL_LEVELS) {
      const base = baseIdOf(it);
      if (seen.has(base)) continue;
      seen.add(base);
      const lv = styleUnlockStar(base);
      if (lv < 1) continue;
      m.set(lv, [...(m.get(lv) ?? []), { base, name: familyName(it) }]);
    }
    return m;
  }, []);
  const gateAfter = useMemo(() => new Map(STAR_GATES.map((g) => [g.cap, g])), []);

  // Opens on what is next: the gate holding you, else the next level with something in it.
  const [sel, setSel] = useState<{ kind: "level"; n: number } | { kind: "gate"; cap: number }>(() => {
    if (st.gate) return { kind: "gate", cap: st.gate.cap };
    const next = Array.from(byLevel.keys()).filter((n) => n > st.stars).sort((a, b) => a - b)[0];
    return { kind: "level", n: next ?? st.stars };
  });
  const stripRef = useRef<HTMLDivElement>(null);
  const hereRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Open centred on you.
  useEffect(() => {
    const strip = stripRef.current, el = hereRef.current;
    if (!mounted || !strip || !el) return;
    strip.scrollLeft = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
  }, [mounted]);
  if (!mounted) return null;

  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const selLevel = sel.kind === "level" ? sel.n : sel.cap;
  const selUnlocks = sel.kind === "level" ? byLevel.get(sel.n) ?? [] : [];
  const selGate = sel.kind === "gate" ? gateAfter.get(sel.cap) ?? null : null;

  return createPortal(
    <div data-star-pass className="fixed inset-0 z-[70] overflow-y-auto bg-[#05080f] text-white" style={{ paddingBottom: 84 }}>
      <div className="mx-auto w-full max-w-md">
        {/* Where you are. */}
        <div className="flex items-center gap-3 px-3 pb-2 pt-3">
          <div className="flex h-[54px] shrink-0 items-center gap-1 px-2.5 text-gray-950" style={{ background: "linear-gradient(180deg, #fde047, #f59e0b)", borderRadius: 2, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}>
            <span className="text-[22px] leading-none">★</span>
            <span className="text-[38px] font-black leading-none tabular-nums">{st.stars}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-black uppercase leading-none tracking-wide">{starTitle(st.stars)}</div>
            <SquareBar value={Math.max(3, st.toNext * 100)} colors={["#f59e0b", "#fde047"]} className="mt-1.5 h-[16px]" animate>
              {st.stars >= MAX_LEVEL ? "MAX" : st.gate ? "🔒" : st.held > 0 ? "★" + (st.stars + 1) : null}
            </SquareBar>
          </div>
        </div>

        {/* The levels: swipe along them. */}
        <div
          ref={stripRef}
          data-level-strip
          className="flex items-stretch gap-1.5 overflow-x-auto px-3 py-2"
          style={{ scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          {levels.map((n) => {
            const unlocks = byLevel.get(n) ?? [];
            const here = n === st.stars;
            const reached = n <= st.stars;
            const gate = gateAfter.get(n);
            return (
              <div key={n} className="flex shrink-0 items-stretch gap-1" style={{ scrollSnapAlign: "center" }}>
                <LevelCard
                  n={n} unlocks={unlocks} here={here} reached={reached}
                  selected={sel.kind === "level" && sel.n === n}
                  progress={here ? st.toNext * 100 : null}
                  legend={n > POINTS_CAP_LEVEL}
                  innerRef={here ? hereRef : undefined}
                  onTap={() => setSel({ kind: "level", n })}
                />
                {gate && (
                  <GateCard
                    open={gate.open(career, led)}
                    holding={st.gate?.cap === gate.cap}
                    selected={sel.kind === "gate" && sel.cap === gate.cap}
                    onTap={() => setSel({ kind: "gate", cap: gate.cap })}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Names for the card you tapped. */}
        <div className="mx-3 mt-1 min-h-[88px] bg-white/[0.06] p-2.5" style={{ borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}>
          <div className="flex items-center gap-2 text-[15px] font-black uppercase leading-none tracking-wide">
            <span className="text-amber-300">★{selLevel}</span>
            {sel.kind === "gate" && <span>🔒</span>}
          </div>
          {selGate && <div className="mt-2 text-[14px] font-black leading-tight text-white">{selGate.need}</div>}
          {sel.kind === "level" && selUnlocks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selUnlocks.map((u) => (
                <span key={u.base} className="bg-black/50 px-1.5 py-1 text-[12px] font-black uppercase leading-none" style={{ borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.22)" }}>{u.name}</span>
              ))}
            </div>
          )}
          {sel.kind === "level" && sel.n > POINTS_CAP_LEVEL && (
            <div className="mt-2 space-y-1">
              {LEGEND_TASKS.map((t) => {
                const done = st.legendDone.includes(t.id);
                return (
                  <div key={t.id} className={`flex items-center gap-2 text-[12.5px] font-black leading-tight ${done ? "text-white" : "text-white/70"}`}>
                    <span className={`grid h-4 w-4 shrink-0 place-items-center text-[10px] ${done ? "bg-amber-400 text-gray-950" : "bg-black/40"}`} style={{ borderRadius: 2, boxShadow: done ? undefined : "inset 0 0 0 1px rgba(255,255,255,.4)" }}>{done ? "✓" : ""}</span>
                    <span className="min-w-0 flex-1">{t.label}</span>
                    {!done && <span className="shrink-0 text-[11px] tabular-nums text-white/70">{t.progress(career, led).split(" · ")[0]}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Where your Star Points came from. */}
        <div className="mx-3 mt-2 grid grid-cols-2 gap-px bg-black/50" style={{ borderRadius: 2 }}>
          <div className="col-span-2 flex items-center justify-between bg-white/[0.06] px-2.5 py-1.5 text-[12px] font-black uppercase tracking-widest text-amber-300">
            <span>Star Points</span><span className="tabular-nums">{fmt(st.total)}</span>
          </div>
          {rows.map(([label, n]) => (
            <div key={label} className="flex items-center justify-between bg-white/[0.06] px-2.5 py-1.5 text-[12.5px] font-black">
              <span className="uppercase tracking-wide text-white/85">{label}</span><span className="tabular-nums">{fmt(n)}</span>
            </div>
          ))}
        </div>
      </div>
      <BottomBar cols="1fr">
        <BarButton icon={<Chev dir="left" size={16} className="text-amber-300" />} label="Back" onClick={onClose} />
      </BottomBar>
    </div>,
    document.body,
  );
}

function LevelCard({ n, unlocks, here, reached, selected, progress, legend, innerRef, onTap }: {
  n: number; unlocks: Unlock[]; here: boolean; reached: boolean; selected: boolean; progress: number | null; legend: boolean;
  innerRef?: React.Ref<HTMLButtonElement>; onTap: () => void;
}) {
  const full = unlocks.length > 0;
  const shown = unlocks.slice(0, 4);
  return (
    <button
      ref={innerRef}
      onClick={onTap}
      aria-label={`Level ${n}${full ? `: ${unlocks.map((u) => u.name).join(", ")}` : ""}`}
      className="kib-press relative flex shrink-0 flex-col overflow-hidden text-left"
      style={{
        width: full ? CARD_W : SLIM_W, height: CARD_H, borderRadius: 2,
        background: here ? "linear-gradient(180deg, rgba(251,191,36,.28), rgba(251,191,36,.08))" : "rgba(255,255,255,.07)",
        boxShadow: here ? "inset 0 0 0 2px #fbbf24, 0 0 14px rgba(251,191,36,.45)" : selected ? "inset 0 0 0 2px rgba(255,255,255,.85)" : "inset 0 0 0 1px rgba(255,255,255,.16)",
        filter: reached ? undefined : "brightness(.5)",
      }}
    >
      <div className={`flex items-center justify-between px-1.5 pt-1 leading-none ${here ? "text-amber-300" : "text-white"}`}>
        <span className="text-[20px] font-black tabular-nums">{n}</span>
        {legend && <span className="text-[10px] text-amber-300">★</span>}
      </div>
      {full && (
        <div className={`grid min-h-0 flex-1 content-center gap-1 px-1.5 ${shown.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {shown.map((u, i) => (
            <div key={u.base} className="relative">
              <StylePicture base={u.base} level={1} className="block aspect-[100/64] w-full" />
              {i === 3 && unlocks.length > 4 && (
                <span className="absolute inset-0 grid place-items-center bg-black/60 text-[13px] font-black">+{unlocks.length - 3}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {!full && <div className="flex-1" />}
      {progress != null && (
        <div className="px-1.5 pb-1.5">
          <SquareBar value={Math.max(4, progress)} colors={["#f59e0b", "#fde047"]} className="h-[14px]" ticks={false} />
        </div>
      )}
    </button>
  );
}

function GateCard({ open, holding, selected, onTap }: { open: boolean; holding: boolean; selected: boolean; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      aria-label={open ? "Gate: open" : "Gate: closed"}
      className="kib-press relative flex shrink-0 flex-col items-center justify-center gap-1"
      style={{
        width: GATE_W, height: CARD_H, borderRadius: 2,
        background: open ? "rgba(52,211,153,.16)" : "rgba(239,68,68,.16)",
        boxShadow: `inset 0 0 0 ${selected || holding ? 2 : 1}px ${open ? "#34d399" : "#f87171"}`,
        borderStyle: "dashed",
      }}
    >
      <span className="text-[30px] leading-none">{open ? "🔓" : "🔒"}</span>
      <span className="text-[10px] font-black uppercase leading-none tracking-widest text-white">Gate</span>
    </button>
  );
}
