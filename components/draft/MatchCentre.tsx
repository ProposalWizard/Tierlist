"use client";
/**
 * components/draft/MatchCentre.tsx — watch a big Draft match (Leo, 27 Nov 2026).
 * A scoreboard, a running clock and commentary, from the result the season
 * already made (lib/draft/matchTimeline.ts). About 45 seconds a match; Skip
 * jumps to the end. Used for cup finals (New look preview); the friend matches
 * and the manager mode will use the same piece.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { matchTimeline, type TimelineMatch } from "@/lib/draft/matchTimeline";

const SECONDS = 45;

export default function MatchCentre({ match, onClose }: { match: TimelineMatch; onClose: () => void }) {
  const events = useMemo(() => matchTimeline(match), [match]);
  const len = match.extraTime ? 120 : 90;
  const [minute, setMinute] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (minute >= len) return;
    const t = setTimeout(() => setMinute((m) => Math.min(len, m + 1)), (SECONDS * 1000) / len);
    return () => clearTimeout(t);
  }, [minute, len]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [minute]);

  const seen = events.filter((e) => e.minute <= minute && (e.kind !== "end" && e.kind !== "pens" ? true : minute >= len));
  const last = seen[seen.length - 1] ?? events[0];
  const home = match.youHome ? match.you : match.them;
  const away = match.youHome ? match.them : match.you;
  const hs = match.youHome ? last.you : last.them;
  const as = match.youHome ? last.them : last.you;
  const flash = last.kind === "goal-you" || last.kind === "goal-them";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-3 sm:items-center" data-match-centre role="dialog" aria-label="Match centre">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-700 bg-gray-950 text-white shadow-2xl" data-keep-dark>
        <div className="bg-emerald-800 px-4 py-3">
          {match.title && <p className="text-center text-[11px] font-black uppercase tracking-widest text-white/90">{match.title}</p>}
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-black">{home}</span>
            <span className={`shrink-0 whitespace-nowrap rounded-lg bg-black/40 px-3 py-1 text-2xl font-black tabular-nums ${flash ? "animate-pulse" : ""}`}>{hs}–{as}</span>
            <span className="min-w-0 flex-1 truncate text-right text-sm font-black">{away}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30"><div className="h-full bg-white/90" style={{ width: `${(minute / len) * 100}%` }} /></div>
          <p className="mt-1 text-center text-xs font-bold tabular-nums">{minute >= len ? "FT" : `${minute}'`}</p>
        </div>
        <div ref={logRef} className="h-64 space-y-2 overflow-y-auto px-4 py-3">
          {seen.map((e, i) => (
            <p key={i} className={`text-sm ${e.kind === "goal-you" ? "font-black text-emerald-300" : e.kind === "goal-them" ? "font-black text-red-300" : e.kind === "end" || e.kind === "pens" ? "font-black text-white" : "text-gray-200"}`}>
              <span className="mr-2 inline-block w-9 text-right text-xs tabular-nums text-gray-400">{e.minute}&rsquo;</span>{e.text}
            </p>
          ))}
        </div>
        <div className="flex gap-2 border-t border-gray-800 p-3">
          {minute < len && <button onClick={() => setMinute(len)} className="flex-1 rounded-xl bg-gray-800 py-2.5 text-sm font-bold text-white">Skip to the end</button>}
          <button data-match-close onClick={onClose} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white">{minute < len ? "Close" : "Done"}</button>
        </div>
      </div>
    </div>
  );
}
