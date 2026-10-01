"use client";
import { useState } from "react";
import type { SaveSlotSummary } from "@/lib/star/storage";
import { PressButton, rgba } from "./ui";
import { SetCard, SetHead, SetNote } from "./settingsKit";

/**
 * SAVES — switch between careers, or start a fresh one, without losing any
 * of them.
 *
 * Every slot is always shown, empty or not — nothing to scroll, nothing
 * hidden. The active slot is the one actually on screen right now; picking
 * a different occupied slot switches to it (loadCareerIntoState,
 * app/star-dev/page.tsx, reconciles it against the cloud the same way the
 * very first load of the game always has); picking an empty slot starts a
 * brand new career there, exactly like the very first time this game was
 * ever played, and leaves every other slot untouched.
 *
 * Reskinned 28 Sep 2026 to the home screen's look: a club-lit card, the
 * save you are playing lit in your colour, kit buttons. The club, season
 * and star rating now wrap onto their own line instead of being cut off.
 */

interface Props {
  saves: SaveSlotSummary[];
  activeSlot: number;
  onSwitch: (slot: number) => void;
  onStartNew: (slot: number) => void;
  onDelete: (slot: number) => void;
  /** Your club's colour, to light the card and the save you're playing. */
  glow?: string;
}

export default function SaveSlotsPanel({ saves, activeSlot, onSwitch, onStartNew, onDelete, glow = "#10b981" }: Props) {
  // Two taps to delete, on the screen — no browser box, which exits full screen.
  const [armed, setArmed] = useState<number | null>(null);
  return (
    <SetCard tone={glow}>
      <SetHead>Saves</SetHead>
      <SetNote>
        Keep up to {saves.length} careers going and switch between them, or start a brand new one without losing the others.
      </SetNote>

      <div className="mt-2 space-y-1.5">
        {saves.map((save) => {
          const isActive = save.slot === activeSlot;
          return (
            <div
              key={save.slot}
              className="rounded-xl p-2"
              style={isActive
                ? { background: `linear-gradient(90deg, ${rgba(glow, 0.32)}, ${rgba(glow, 0.1)})`, boxShadow: `inset 0 0 0 1px ${rgba(glow, 0.7)}, inset 0 1px 0 rgba(255,255,255,.12), 0 0 16px -6px ${rgba(glow, 0.9)}` }
                : { background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 0 1px rgba(255,255,255,.06)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[14px] font-black tabular-nums"
                  style={isActive
                    ? { background: `linear-gradient(180deg, ${rgba(glow, 0.95)}, ${rgba(glow, 0.6)})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }
                    : { background: "rgba(3,7,18,.6)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.08)", color: "rgba(255,255,255,.6)" }}
                >
                  {save.slot}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Save {save.slot}</span>
                    {isActive && (
                      <span className="rounded-full bg-emerald-400/25 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-200" style={{ boxShadow: "inset 0 0 0 1px rgba(52,211,153,.45)" }}>
                        Playing
                      </span>
                    )}
                    {save.retired && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-200">
                        Retired
                      </span>
                    )}
                  </div>
                  {save.empty ? (
                    <div className="mt-0.5 text-[11px] text-white">Empty</div>
                  ) : (
                    <>
                      <div className="mt-0.5 truncate text-[12px] font-black text-white">{save.playerName}</div>
                      <div className="text-[10.5px] font-bold leading-snug text-white">
                        {/* A save with no club is a trial in progress — a real
                            career nobody has signed yet (see hasClub,
                            calendar.ts). Naming it rather than printing an
                            empty club keeps it from reading as a broken or
                            spare slot to start over on. */}
                        {save.signed
                          ? <>{save.club} · Season {save.season} · <span className="text-yellow-200">★{save.starRating}</span></>
                          : <>No club yet · <span className="text-yellow-200">★{save.starRating}</span></>}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-1 min-[380px]:flex-row min-[380px]:items-center">
                  {save.empty ? (
                    <PressButton variant="primary" size="none" onClick={() => onStartNew(save.slot)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-black">
                      Start career
                    </PressButton>
                  ) : (
                    <>
                      {!isActive && (
                        <PressButton variant="secondary" size="none" onClick={() => onSwitch(save.slot)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-black">
                          Switch
                        </PressButton>
                      )}
                      <PressButton
                        size="none"
                        onClick={() => { if (armed === save.slot) { setArmed(null); onDelete(save.slot); } else setArmed(save.slot); }}
                        className="rounded-lg px-2.5 py-1.5 text-[10px] font-black text-red-100"
                        style={{ background: "linear-gradient(180deg, rgba(248,113,113,.28), rgba(220,38,38,.14))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(248,113,113,.55)" }}
                      >
                        {armed === save.slot ? "Sure? Tap again" : isActive ? "Delete & start over" : "Delete"}
                      </PressButton>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SetCard>
  );
}
