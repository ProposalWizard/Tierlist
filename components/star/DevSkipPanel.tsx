"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { matchweeksFor, divisionOf } from "@/lib/star/calendar";
import { weekClosestToDate, weeksBeforeSeasonEnd, seasonEndWeek, deadlineDayWeek, type SkipTarget } from "@/lib/star/devSkip";

/**
 * Reachable from the dashboard's "Start over" corner, for the same reason
 * that panel is there: it is not something most sessions touch, but it needs
 * to be somewhere obvious for the one that does. Every button here hands a
 * {season, week} target up to the page, which runs it through skipTo — this
 * component only works out WHICH week a date or a "N before the end" ask
 * actually means on this save's own calendar.
 */
export default function DevSkipPanel({ career, onSkip }: {
  career: CareerState;
  onSkip: (target: SkipTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const weeks = matchweeksFor(divisionOf(career));
  const [season, setSeason] = useState(career.season);
  const [week, setWeek] = useState(career.week);

  if (!open) {
    return (
      <button
        onClick={() => { setSeason(career.season); setWeek(career.week); setOpen(true); }}
        className="mt-3 w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-[11px] font-black uppercase tracking-widest text-sky-200 transition hover:bg-sky-500/20"
      >
        🛠 Dev: Skip Ahead
      </button>
    );
  }

  const quick: { label: string; target: SkipTarget }[] = [
    { label: "Christmas", target: { season: career.season, week: weekClosestToDate(career, 11, 25) } },
    { label: "2 weeks before season end", target: { season: career.season, week: weeksBeforeSeasonEnd(career, 2) } },
    { label: "Summer deadline day", target: { season: career.season, week: deadlineDayWeek(career, "summer") } },
    { label: "January deadline day", target: { season: career.season, week: deadlineDayWeek(career, "january") } },
    { label: "End of this season", target: { season: career.season, week: seasonEndWeek(career) } },
    { label: "Start of next season", target: { season: career.season + 1, week: 1 } },
  ];

  return (
    <div className="mt-3 rounded-xl border border-sky-500/50 bg-sky-500/10 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-sky-200">Dev: Skip Ahead</div>
      <p className="mt-1 text-[11px] leading-snug text-sky-100/80">
        Fast-forwards the world around you to a chosen week — the rest of the division plays on,
        windows open on schedule. Nothing you would play yourself is simulated: you land with that
        week&apos;s match still waiting.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {quick.map((q) => (
          <button
            key={q.label}
            onClick={() => { onSkip(q.target); setOpen(false); }}
            className="rounded-lg bg-sky-500/20 py-1.5 text-[10px] font-bold text-sky-100 transition hover:bg-sky-500/30"
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <label className="text-[10px] font-bold text-sky-100/80">Season</label>
        <input
          type="number" min={career.season} value={season}
          onChange={(e) => setSeason(Math.max(career.season, Number(e.target.value) || career.season))}
          className="w-14 rounded bg-gray-900 px-1.5 py-1 text-xs text-white"
        />
        <label className="text-[10px] font-bold text-sky-100/80">Week</label>
        <input
          type="number" min={1} max={weeks + 10} value={week}
          onChange={(e) => setWeek(Math.max(1, Number(e.target.value) || 1))}
          className="w-14 rounded bg-gray-900 px-1.5 py-1 text-xs text-white"
        />
        <button
          onClick={() => { onSkip({ season, week }); setOpen(false); }}
          className="ml-auto rounded-lg bg-sky-400 px-3 py-1.5 text-[11px] font-black text-gray-950 transition hover:bg-sky-300"
        >
          Go
        </button>
      </div>
      <button
        onClick={() => setOpen(false)}
        className="mt-2 w-full text-[10px] font-bold text-sky-200/60 transition hover:text-sky-200"
      >
        Cancel
      </button>
    </div>
  );
}
