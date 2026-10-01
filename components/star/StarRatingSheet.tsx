"use client";

/**
 * YOUR STAR RATING, EXPLAINED — opened from the rating on Home (Mikey,
 * 30 Sep 2026; 1-100 since 1 Oct 2026). What it is for, in one line (Harry:
 * "what is star ratings for?"), where you are, what the next level takes, the gate holding
 * you (if one is), where your Star Points came from, and the ten Legend
 * tasks that make the last ten levels. All of it read from lib/star/starPoints.ts.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CareerState } from "@/lib/star/types";
import { starStatus, STAR_GATES, LEGEND_TASKS, ledgerOf, starTitle, MAX_LEVEL, POINTS_CAP_LEVEL } from "@/lib/star/starPoints";

const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

export default function StarRatingSheet({ career, onClose }: { career: CareerState; onClose: () => void }) {
  const st = starStatus(career);
  const led = ledgerOf(career);
  const rows: [string, number][] = [
    ["Matches", st.points.match], ["Trophies and promotions", st.points.trophies], ["Awards", st.points.awards],
    ["Milestones and achievements", st.points.milestones], ["Fame and what you own", st.points.status],
    ...(st.carry > 0 ? [["Carried from your old rating", st.carry] as [string, number]] : []),
  ];
  const nextGate = STAR_GATES.find(g => !g.open(career, led));
  // Drawn on the page itself: Home sits inside a sliding, clipped strip, and
  // a sheet placed in there was cut off at the hero card's edge.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/85 p-3" onClick={onClose}>
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-amber-300/60 bg-gray-950 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Star rating</div>
          <div className="mt-1 text-[44px] font-black leading-none text-amber-300" style={{ textShadow: "0 0 18px rgba(251,191,36,.6)" }}>★ {st.stars}<span className="text-[18px] text-white"> / {MAX_LEVEL}</span></div>
          <div className="mt-1 text-[15px] font-black text-white">{starTitle(st.stars)}</div>
          <div className="mt-1 rounded-lg bg-amber-400/15 px-2 py-1.5 text-[11.5px] font-bold text-white">
            <b className="text-amber-300">What it&apos;s for:</b> a mix of your skills, your experience and your fame. Everything you do on and off the pitch adds Star Points; a run of poor matches takes some away. The Star Pass, coming next, will be built on it.
          </div>
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/60" style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,.7)" }}>
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200" style={{ width: `${Math.max(2, st.toNext * 100)}%`, boxShadow: "0 0 10px rgba(251,191,36,.7)" }} />
        </div>
        <div className="mt-1 text-center text-[11.5px] font-black text-white">
          {st.stars >= MAX_LEVEL ? `${MAX_LEVEL} — you have done everything.`
            : st.stars >= POINTS_CAP_LEVEL ? `${st.legendDone.length} of ${LEGEND_TASKS.length} Legend tasks done · one level each`
              : st.held > 0 ? `★${st.stars + 1} is paid for — it comes with your next match`
              : st.gate ? "Held at a star gate"
                : `${fmt(st.spToNext)} Star Points to ★${st.stars + 1}`}
        </div>

        {st.held > 0 && (
          <div className="mt-2 rounded-lg bg-white/10 px-2 py-1.5 text-center text-[11.5px] font-bold text-white">
            One level a match at most.{st.carried > 0 ? <> <b className="text-amber-300">+{fmt(st.carried)}</b> Star Points carried to the levels after.</> : null}
          </div>
        )}
        {st.gate && (
          <div className="mt-3 rounded-xl border border-dashed border-red-400 bg-red-500/10 p-2.5">
            <div className="text-[12px] font-black text-white">🔒 ★{st.gate.cap} gate</div>
            <div className="text-[11.5px] font-bold text-white">{st.gate.need}.</div>
            {st.ungated > st.stars && <div className="mt-0.5 text-[11.5px] font-black text-amber-300">{st.ungated - st.stars} level{st.ungated - st.stars === 1 ? "" : "s"} banked — yours the moment it opens.</div>}
          </div>
        )}
        {!st.gate && nextGate && st.stars < POINTS_CAP_LEVEL && (
          <div className="mt-3 rounded-xl bg-white/10 p-2.5 text-[11.5px] font-bold text-white">
            <b>Next gate, at ★{nextGate.cap}:</b> {nextGate.need}.
          </div>
        )}

        <div className="mt-3 rounded-xl bg-white/5 p-2.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-amber-300">
            <span>Star Points</span><span>{fmt(st.total)}</span>
          </div>
          {rows.map(([label, n]) => (
            <div key={label} className="mt-1 flex items-center justify-between text-[12px] font-bold text-white">
              <span>{label}</span><span className="tabular-nums">{fmt(n)}</span>
            </div>
          ))}
          <div className="mt-1.5 text-[10.5px] font-bold text-white">Match points count ×1 in the National League, up to ×4 in the Premier League and ×5 in Europe.</div>
        </div>

        {st.stars >= 80 && (
          <div className="mt-3 rounded-xl bg-white/5 p-2.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">The last ten · Legend tasks</div>
            {LEGEND_TASKS.map(t => {
              const done = st.legendDone.includes(t.id);
              return (
                <div key={t.id} className="mt-1.5 flex items-start gap-2 text-[12px] font-bold text-white">
                  <span className={`mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-black ${done ? "bg-amber-400 text-gray-950" : "border border-white/50"}`}>{done ? "✓" : ""}</span>
                  <span className="min-w-0 flex-1">{t.label}{!done && <span className="block text-[10.5px] font-bold text-white">{t.progress(career, led)}</span>}</span>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={onClose} className="kib-press mt-3 w-full rounded-xl bg-white/15 py-2.5 text-sm font-black text-white">Close</button>
      </div>
    </div>,
    document.body,
  );
}
