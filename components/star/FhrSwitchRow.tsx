"use client";
/**
 * "Full highlights rebuild: Off | On", with a "?" (Harry, 20 Oct 2026):
 * "It's just literally full highlights rebuild as a toggle … In game, inside
 * of a game, I can press settings, or before a game, I can press settings and
 * turn on full highlights rebuild. When I turn it on, maybe add a little
 * question mark next to it that just has a really plain rundown of every
 * single thing that I've added and what they're actually trying."
 *
 * One row, shown to everyone, in three places: Settings (QuickSwitches,
 * DeviceSettings.tsx), the in-match ⚙ (Match3DLayer.tsx) and the ⚙ on the
 * line-up before a match (LineupIntro.tsx). "Real moment highlights" sits
 * under it while it is On (RealMomentsRow). The value: lib/star/fhr/toggle.ts.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFhrMode } from "@/lib/star/fhr/toggle";
import { setLookRow } from "@/lib/star/lookRows";
import { REAL_MOMENT_SHARE_IN, REAL_MOMENT_OF_ALL_IN } from "@/lib/star/fhr/realMomentHighlights";
import { FOUL_SHARE } from "@/lib/star/fhr/foulBuildUp";
import { FHR_MIN_S, FHR_MAX_S, FHR_BIG_MAX_S } from "@/lib/star/fhr/buildUp";
import { SegTabs } from "./screenKit";
import { SetNote } from "./settingsKit";
import RealMomentsRow from "./RealMomentsRow";

/** Every part the switch turns on, and what it is trying. Plain words; one line each. */
export const FHR_PARTS: { name: string; tries: string }[] = [
  { name: "The still is the match camera", tries: "On Infinite Highlights, the picture before Play uses the match's own camera, so nothing jumps when you press Play." },
  { name: "Build-ups before your chances", tries: `Every open-play chance starts with the moves before it: ${FHR_MIN_S}–${FHR_MAX_S} seconds of passes and runs, made from real match data. A different one every time. Tap to skip it.` },
  { name: "Longer at big moments", tries: `Late in a close game the build-up runs longer, and longest in a final: up to about ${Math.round(FHR_BIG_MAX_S)} seconds in the 90th minute.` },
  { name: "Players already moving", tries: "When the chance becomes yours, the other players are still running. They stop on their places while you aim, instead of everyone starting still." },
  { name: "An extra defender", tries: "When the defence is thin, a defender sprints back from off the screen and joins the chance, behind the ball." },
  { name: "Fouls before set pieces", tries: `About ${Math.round(FOUL_SHARE * 100)}% of free kicks and penalties first show the foul that won them, then everyone walks to his place.` },
  { name: "Real moment highlights (its own switch)", tries: `About 1 in ${REAL_MOMENT_SHARE_IN} one-on-ones, tight angles, long shots, headers and volleys (about 1 in ${REAL_MOMENT_OF_ALL_IN} of all open-play chances) is a real moment from a real match, every player where he really stood, with the real build-up first.` },
  { name: "Chances: New", tries: "On also turns Chances to New: chances follow the match (the right wing, the right kind)." },
];

export default function FhrSwitchRow() {
  const m = useFhrMode();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <div data-fhr-row>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-[14px] font-bold leading-tight text-white">Full highlights rebuild</span>
          <button
            type="button"
            data-fhr-help
            aria-label="What Full highlights rebuild does"
            onClick={() => setOpen(true)}
            className="kib-press grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 text-[14px] font-black text-white"
            style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)" }}
          >?</button>
        </span>
        <SegTabs className="w-[120px] shrink-0" value={m} onChange={(v) => setLookRow("fhr", v)} tabs={[["off", "Off"], ["on", "On"]] as const} />
      </div>
      <SetNote dim className="mt-1 text-[10px]">
        {m === "on" ? "On: build-ups before your chances, players already moving. Tap ? for every part." : "A test of new highlights. Off is the game as it is now."}
      </SetNote>
      <RealMomentsRow />
      {open && mounted && createPortal(
        <div data-fhr-help-sheet className="fixed inset-0 z-[96] flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Full highlights rebuild"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t border-white/10 bg-gray-950 px-4 pb-6 pt-3 sm:max-w-[440px] sm:rounded-2xl sm:border sm:pb-4"
          >
            <div className="sticky -top-3 z-10 -mx-4 mb-1 flex items-center justify-between bg-gray-950 px-4 pb-2 pt-3">
              <div className="text-[17px] font-black text-white">Full highlights rebuild</div>
              <button type="button" onClick={() => setOpen(false)} className="kib-press rounded-lg bg-white/10 px-3 py-1 text-[13px] font-bold text-white">Done</button>
            </div>
            <p className="mb-3 text-[13px] font-bold leading-snug text-white">A test of a new way to play your chances. Off is the game as it is now. On turns on all of this:</p>
            <ol className="space-y-2.5">
              {FHR_PARTS.map((p, i) => (
                <li key={p.name} className="flex gap-2.5">
                  <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-[12px] font-black text-gray-950">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-black leading-tight text-white">{p.name}</span>
                    <span className="mt-0.5 block text-[12.5px] font-semibold leading-snug text-white">{p.tries}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11.5px] font-semibold leading-snug text-white">Stored on this phone only. Never in your save.</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
