"use client";

/**
 * THE CLOCK PILL, top middle in every 3D place (house, garden, shop, gym): "14:20" and a line under it
 * ("Tue 3 Nov · Match tomorrow"). Tap it: the Today and next list. At time to leave for a match the
 * clock stops and a "Go to the match" button shows (Harry's question 4).
 * docs/plans/PEOPLE_AND_MEMORY_PLAN.md section 2d, mockup people-plan/1-clock-and-phone.png.
 *
 * The clock ticks here (lib/star/life/liveClock.ts) and sends its minutes to the career through
 * `onTime` in lumps of 10 game minutes and when the place closes. Without `onTime` (a test page) it
 * ticks on the screen only.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { absOf, clockOf, clockSubline, hhmm, leaveAt, todayList, DAY_MINS } from "@/lib/star/life/clock";
import { LiveClock } from "@/lib/star/life/liveClock";

const INK = "#f7f1e8";
const GOLD = "#facc15";

/** Minutes sent to the career at a time while you stay in a place. */
const FLUSH_EVERY = 10;

/** The ticking clock for a 3D place: the LiveClock (read it each frame) and the minute shown. */
export function useLiveClock(career: CareerState | null | undefined, onTime?: (mins: number) => void, opts: { paused?: boolean; rate?: number; external?: boolean } = {}) {
  const abs0 = career ? absOf(clockOf(career)) : 15 * 60;
  const stop0 = career ? leaveAt(career) : Infinity;
  // test pages and filming: ?clock=60 runs it 60 times faster
  if (opts.rate === undefined && typeof window !== "undefined") { const r = Number(new URLSearchParams(window.location.search).get("clock")); if (r > 0) opts = { ...opts, rate: r }; }
  const clock = useMemo(() => new LiveClock(abs0, stop0, opts.rate ?? 1),
    // one clock per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);
  const [shown, setShown] = useState(() => Math.floor(clock.now()));
  const onTimeRef = useRef(onTime);
  const externalRef = useRef(!!opts.external);
  externalRef.current = !!opts.external;
  onTimeRef.current = onTime;
  clock.paused = !!opts.paused;
  if (opts.rate) clock.rate = opts.rate;
  // the career's clock moved (an action, sleep, our own minutes landing): it is the truth again
  useEffect(() => { clock.sync(abs0, stop0); setShown(Math.floor(clock.now())); }, [clock, abs0, stop0]);
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const t = performance.now();
      const dt = (t - last) / 1000;
      last = t;
      if (document.visibilityState === "hidden") return;
      // a 3D place that ticks it from its own frames (the house: people and the clock keep step, even on a slow phone)
      if (!externalRef.current) clock.tick(dt);
      const n = clock.flush(FLUSH_EVERY);
      if (n && onTimeRef.current) onTimeRef.current(n);
      setShown(Math.floor(clock.now()));
    }, 500);
    return () => {
      clearInterval(id);
      const n = clock.flush(1);
      if (n) onTimeRef.current?.(n);
    };
  }, [clock]);
  return { clock, abs: shown };
}

export interface ClockVisit { from: number; name: string; why: string }

export default function ClockPill({ career, abs, held, visits, onMatch, title, invite }: {
  /** "Text Kyle: come round?" (the house only): the label, and what sending it does (his answer, in words). */
  invite?: { label: string; send: () => string } | null;
  career: CareerState | null | undefined;
  /** The minute shown (since day 0), from useLiveClock. */
  abs: number;
  /** Time to leave: the clock is stopped. */
  held?: boolean;
  /** Who is coming round today (phase 2). */
  visits?: ClockVisit[];
  /** "Go to the match": the pre-match screen. */
  onMatch?: () => void;
  /** The place's name, at the top of the list ("Your flat"). */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  // the Today list open: the 3D phone's pill (a fixed button above the house) steps aside so nothing sits over the list
  useEffect(() => { if (!open) return; document.body.dataset.clockOpen = "1"; return () => { delete document.body.dataset.clockOpen; }; }, [open]);
  const m = abs - Math.floor(abs / DAY_MINS) * DAY_MINS;
  const sub = career ? clockSubline(career, abs) : "";
  const rows = open && career ? todayList(career, abs, visits) : [];
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} data-clock-pill={hhmm(m)} aria-label={`The time is ${hhmm(m)}. Today and next.`}
        style={{ position: "absolute", top: "max(10px, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", zIndex: 6, display: "grid", justifyItems: "center", padding: "4px 14px 5px", borderRadius: 16, minWidth: 112,
          background: "rgba(18,13,10,0.66)", border: `1px solid ${held ? GOLD : "rgba(255,230,200,0.16)"}`, color: INK, backdropFilter: "blur(6px)", cursor: "pointer", lineHeight: 1.1 }}>
        <span style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: 0.3 }}>{hhmm(m)}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: held ? GOLD : "#d8cbb8", whiteSpace: "nowrap", maxWidth: "46vw", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
      </button>
      {held && onMatch && !open && (
        <button type="button" onClick={onMatch} data-go-to-match
          style={{ position: "absolute", top: "calc(max(10px, env(safe-area-inset-top)) + 54px)", left: "50%", transform: "translateX(-50%)", zIndex: 6, height: 42, padding: "0 18px", borderRadius: 999, border: "none", background: GOLD, color: "#111", fontWeight: 900, fontSize: 15, cursor: "pointer", boxShadow: "0 8px 20px rgba(0,0,0,.45)" }}>
          Go to the match ›
        </button>
      )}
      {open && (
        <div data-clock-today onClick={() => setOpen(false)}
          style={{ position: "absolute", top: "calc(max(10px, env(safe-area-inset-top)) + 52px)", left: "50%", transform: "translateX(-50%)", zIndex: 7, width: "min(340px, calc(100vw - 32px))", padding: "10px 14px", borderRadius: 16,
            background: "rgba(20,15,11,0.95)", border: "1px solid rgba(250,204,21,0.25)", color: INK, boxShadow: "0 18px 40px -12px rgba(0,0,0,.8)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", color: GOLD, marginBottom: 4 }}>{title ? `${title.toUpperCase()} · ` : ""}TODAY AND NEXT</div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 8, padding: "7px 0", borderTop: i ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: r.now ? "#4ade80" : "#d8cbb8" }}>{r.when}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{r.what}</div>
                {r.sub && <div style={{ fontSize: 12, fontWeight: 600, color: "#c9bba8" }}>{r.sub}</div>}
              </div>
            </div>
          ))}
          {reply && <div data-invite-reply style={{ marginTop: 6, padding: "8px 10px", borderRadius: 12, background: "rgba(74,222,128,0.12)", fontSize: 13, fontWeight: 800 }}>{reply}</div>}
          {!reply && invite && !held && (
            <button type="button" data-invite onClick={(e) => { e.stopPropagation(); setReply(invite.send()); }}
              style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 12, border: "1px solid rgba(250,204,21,0.45)", background: "rgba(250,204,21,0.1)", color: INK, fontWeight: 900, fontSize: 14, cursor: "pointer" }}>
              💬 {invite.label}
            </button>
          )}
          {held && onMatch && (
            <button type="button" onClick={onMatch} style={{ marginTop: 8, width: "100%", height: 42, borderRadius: 12, border: "none", background: GOLD, color: "#111", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>Go to the match ›</button>
          )}
        </div>
      )}
    </>
  );
}
