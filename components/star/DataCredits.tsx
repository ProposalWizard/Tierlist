"use client";
/**
 * Settings → More → "Data credits" (Harry, 20 Oct 2026: "Settings is fine …
 * short settings are fine"). Every credit line the free football data asks
 * for, read from the one list in lib/star/dataCredits.ts (so a new source is
 * one line there). Nothing to switch: it only shows the lines.
 */
import { DATA_CREDITS } from "@/lib/star/dataCredits";
import { SetNote } from "./settingsKit";

const GROUPS = [
  { use: "patterns", title: "How real football plays", note: "Averages and counts only: no real match is replayed." },
  { use: "moments", title: "Real moments", note: "Single real shots and corners, with where everyone stood." },
] as const;

/** How many sources there are (Wyscout, DFL, SkillCorner, …), for the group's count. */
export const DATA_CREDIT_SOURCES = new Set(DATA_CREDITS.map((c) => c.source)).size;

export default function DataCredits() {
  return (
    <div className="py-2.5" data-data-credits>
      <SetNote className="mt-0 text-[12px]">The game&apos;s real football data is free to use with credit. Thank you to:</SetNote>
      {GROUPS.map((g) => (
        <div key={g.use} className="mt-3">
          <div className="text-[13px] font-black text-white">{g.title}</div>
          <SetNote dim className="mt-0.5 text-[10px]">{g.note}</SetNote>
          <ul className="mt-1.5 space-y-1.5">
            {DATA_CREDITS.filter((c) => c.use === g.use).map((c) => (
              <li key={c.id} data-credit-line={c.id} className="rounded-lg bg-white/5 px-2 py-1.5 text-[11px] font-semibold leading-snug text-white">
                {c.line}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
