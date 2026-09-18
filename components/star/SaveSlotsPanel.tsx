"use client";
import type { SaveSlotSummary } from "@/lib/star/storage";

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
 */

interface Props {
  saves: SaveSlotSummary[];
  activeSlot: number;
  onSwitch: (slot: number) => void;
  onStartNew: (slot: number) => void;
  onDelete: (slot: number) => void;
}

export default function SaveSlotsPanel({ saves, activeSlot, onSwitch, onStartNew, onDelete }: Props) {
  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Saves</div>
      <p className="mt-1 text-[11px] text-gray-300">
        Keep up to {saves.length} careers going and switch between them, or start a brand new one without losing the others.
      </p>

      <div className="mt-2 space-y-1.5">
        {saves.map((save) => {
          const isActive = save.slot === activeSlot;
          return (
            <div
              key={save.slot}
              className={`rounded-lg border p-2 ${isActive ? "border-emerald-500/60 bg-emerald-500/10" : "border-gray-700 bg-gray-900/40"}`}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Save {save.slot}</span>
                    {isActive && (
                      <span className="rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-200">
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
                    <div className="mt-0.5 text-[11px] text-white/50">Empty</div>
                  ) : (
                    <div className="mt-0.5 truncate text-[12px] font-bold text-white">
                      {save.playerName}{" "}
                      <span className="font-normal text-white/60">
                        {/* A save with no club is a trial in progress — a real
                            career nobody has signed yet (see hasClub,
                            calendar.ts). Naming it rather than printing an
                            empty club keeps it from reading as a broken or
                            spare slot to start over on. */}
                        {save.signed
                          ? <>· {save.club} · Season {save.season} · {save.starRating?.toFixed(1)}★</>
                          : <>· No club yet · {save.starRating?.toFixed(1)}★</>}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {save.empty ? (
                    <button
                      onClick={() => onStartNew(save.slot)}
                      className="rounded bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-emerald-500"
                    >
                      Start career
                    </button>
                  ) : (
                    <>
                      {!isActive && (
                        <button
                          onClick={() => onSwitch(save.slot)}
                          className="rounded bg-gray-700 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-gray-600"
                        >
                          Switch
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(save.slot)}
                        className="rounded border border-red-500/60 bg-red-500/15 px-2.5 py-1.5 text-[10px] font-black text-red-200 hover:bg-red-500/25"
                      >
                        {isActive ? "Delete & start over" : "Delete"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
