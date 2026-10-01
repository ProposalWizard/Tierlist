"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { matchweeksFor, divisionOf } from "@/lib/star/calendar";
import { weekClosestToDate, weeksBeforeSeasonEnd, seasonEndWeek, deadlineDayWeek, type SkipTarget } from "@/lib/star/devSkip";
import { PressButton, RiseIn } from "@/components/star/legacy/ui";
import { SetCard, SetHead, SetNote } from "@/components/star/legacy/settingsKit";

/**
 * Reachable from the dashboard's "Start over" corner, for the same reason
 * that panel is there: it is not something most sessions touch, but it needs
 * to be somewhere obvious for the one that does. Every button here hands a
 * {season, week} target up to the page, which runs it through skipTo — this
 * component only works out WHICH week a date or a "N before the end" ask
 * actually means on this save's own calendar.
 *
 * Reskinned 28 Sep 2026 (the home screen's look): a sky-lit card and kit
 * buttons. Every target and handler is unchanged.
 */
const TONE = "#38bdf8";

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
      <PressButton
        size="none"
        onClick={() => { setSeason(career.season); setWeek(career.week); setOpen(true); }}
        className="mt-2.5 w-full rounded-xl py-2.5 text-[11px] font-black uppercase tracking-widest text-sky-100"
        style={{ background: "linear-gradient(180deg, rgba(56,189,248,.26), rgba(56,189,248,.08))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(56,189,248,.5), 0 8px 18px -10px rgba(56,189,248,.6)" }}
      >
        🛠 Dev: Skip Ahead
      </PressButton>
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
    <RiseIn>
      <SetCard tone={TONE} strength={0.3} className="mt-2.5 p-3">
        <SetHead tone={TONE} right={<span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-black tabular-nums text-sky-100">S{career.season} · W{career.week}</span>}>
          Dev: Skip Ahead
        </SetHead>
        <SetNote>
          Fast-forwards the world around you to a chosen week — the rest of the division plays on,
          windows open on schedule. Nothing you would play yourself is simulated: you land with that
          week&apos;s match still waiting.
        </SetNote>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {quick.map((q) => (
            <PressButton
              key={q.label}
              variant="secondary"
              size="none"
              onClick={() => { onSkip(q.target); setOpen(false); }}
              className="rounded-lg px-1 py-1.5 text-[10px] font-bold text-sky-50"
            >
              {q.label}
            </PressButton>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <label className="text-[10px] font-bold text-sky-100/80">Season</label>
          <input
            type="number" min={career.season} value={season}
            onChange={(e) => setSeason(Math.max(career.season, Number(e.target.value) || career.season))}
            className="kit-input w-14 rounded-lg px-1.5 py-1 text-xs tabular-nums text-white"
          />
          <label className="text-[10px] font-bold text-sky-100/80">Week</label>
          <input
            type="number" min={1} max={weeks + 10} value={week}
            onChange={(e) => setWeek(Math.max(1, Number(e.target.value) || 1))}
            className="kit-input w-14 rounded-lg px-1.5 py-1 text-xs tabular-nums text-white"
          />
          <PressButton
            variant="accent"
            accent="#38bdf8"
            size="none"
            onClick={() => { onSkip({ season, week }); setOpen(false); }}
            className="ml-auto rounded-lg px-3 py-1.5 text-[11px] font-black"
          >
            Go
          </PressButton>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="kib-press mt-2 w-full text-[10px] font-bold text-sky-200/60 transition hover:text-sky-200"
        >
          Cancel
        </button>
      </SetCard>
    </RiseIn>
  );
}
