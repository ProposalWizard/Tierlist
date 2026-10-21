"use client";
/**
 * Settings → More → "Data credits" (Harry, 20 Oct 2026: "Settings is fine …
 * short settings are fine"). Every credit line the game's outside sources ask
 * for, read from the one list in lib/star/dataCredits.ts (so a new source is
 * one line there). The same list is the public page /credits (Harry, D8,
 * 21 Oct 2026). Nothing to switch: it only shows the lines.
 */
import { DATA_CREDITS, CREDIT_GROUPS } from "@/lib/star/dataCredits";
import { SetNote } from "./settingsKit";

/** How many sources there are (Wyscout, DFL, SkillCorner, …), for the group's count. */
export const DATA_CREDIT_SOURCES = new Set(DATA_CREDITS.map((c) => c.source)).size;

export default function DataCredits() {
  return (
    <div className="py-2.5" data-data-credits>
      <SetNote className="mt-0 text-[12px]">The game&apos;s real football data, models, voices and fonts are free to use with credit. Thank you to:</SetNote>
      {CREDIT_GROUPS.map((g) => {
        const lines = DATA_CREDITS.filter((c) => c.use === g.use);
        if (lines.length === 0) return null;
        return (
          <div key={g.use} className="mt-3">
            <div className="text-[13px] font-black text-white">{g.title}</div>
            {g.note && <SetNote dim className="mt-0.5 text-[10px]">{g.note}</SetNote>}
            <ul className="mt-1.5 space-y-1.5">
              {lines.map((c) => (
                <li key={c.id} data-credit-line={c.id} className="rounded-lg bg-white/5 px-2 py-1.5 text-[11px] font-semibold leading-snug text-white">
                  {c.line}
                  {c.note && <div className="mt-0.5 text-[10px] font-medium text-white/60">{c.note}</div>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <SetNote dim className="mt-3 text-[10px]">Also on the web at knowitball.co.uk/credits.</SetNote>
    </div>
  );
}
