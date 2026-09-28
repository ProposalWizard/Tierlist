"use client";
import { useEffect, useState } from "react";
import type { CareerState, GoalReplay } from "@/lib/star/types";
import { SAVED_REPLAYS_MAX, firstEmptySlot } from "@/lib/star/goalReplays";
import { PressButton } from "./ui";
import { SetCard, SetNote } from "./settingsKit";

/**
 * GOAL REPLAYS — admin-only, for testing.
 *
 * The physics are a real, seeded simulation, so a goal you scored can be
 * watched again exactly as it happened — see GoalReplay's own doc. Recent
 * goals are captured automatically as you play; keeping one of them is a
 * deliberate choice, capped at three, same as the feature this is testing
 * ahead of a real release.
 *
 * Reskinned 28 Sep 2026 (the home screen's look): an amber-lit card, glass
 * rows and kit buttons. Every handler is unchanged.
 */

interface Props {
  career: CareerState;
  onWatchReplay: (replay: GoalReplay) => void;
  onSaveReplay: (index: number, replay: GoalReplay) => void;
  onDeleteSavedReplay: (id: string) => void;
}

export default function GoalReplaysPanel({ career, onWatchReplay, onSaveReplay, onDeleteSavedReplay }: Props) {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  // Picking which saved slot to overwrite, once all three are already full.
  const [overwriting, setOverwriting] = useState<GoalReplay | null>(null);

  useEffect(() => {
    fetch("/api/profile/admin-check")
      .then(res => (res.ok ? res.json() : { isAdmin: false }))
      .then(d => setState(d.isAdmin ? "ok" : "denied"))
      .catch(() => setState("denied"));
  }, []);

  if (state !== "ok") return null;

  const recent = career.recentGoals ?? [];
  const saved = career.savedReplays ?? [];
  const alreadySaved = (id: string) => saved.some(r => r.id === id);

  const handleSaveClick = (replay: GoalReplay) => {
    const empty = firstEmptySlot(career);
    if (empty >= 0) onSaveReplay(empty, replay);
    else setOverwriting(replay);
  };

  return (
    <SetCard tone="#f59e0b" strength={0.22} className="mt-2.5 p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">Goal Replays</span>
        <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-200">Admin · Test</span>
      </div>
      <SetNote>
        Watch a goal happen again, exactly as it did. Save up to {SAVED_REPLAYS_MAX} from the ones you've scored recently.
      </SetNote>

      <div className="mt-2.5">
        <div className="text-[9px] font-black uppercase tracking-widest text-white">Saved ({saved.length}/{SAVED_REPLAYS_MAX})</div>
        {saved.length === 0 ? (
          <div className="mt-1 text-[10px] text-white">Nothing kept yet.</div>
        ) : (
          <div className="mt-1 space-y-1">
            {saved.map(r => (
              <div key={r.id} className="flex items-center gap-2 kit-row rounded-lg px-2 py-1.5">
                <span className="flex-1 truncate text-[11px] font-bold text-white">{r.label}</span>
                <PressButton variant="primary" size="none" onClick={() => onWatchReplay(r)} className="rounded-md px-2 py-1 text-[10px] font-black">
                  Watch
                </PressButton>
                <PressButton variant="danger" size="none" onClick={() => onDeleteSavedReplay(r.id)} className="rounded-md px-2 py-1 text-[10px] font-black">
                  Remove
                </PressButton>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <div className="text-[9px] font-black uppercase tracking-widest text-white">Recent goals</div>
        {recent.length === 0 ? (
          <div className="mt-1 text-[10px] text-white">Score one in a real match to see it here.</div>
        ) : (
          <div className="mt-1 space-y-1">
            {recent.map(r => (
              <div key={r.id} className="flex items-center gap-2 kit-row rounded-lg px-2 py-1.5">
                <span className="flex-1 truncate text-[11px] text-white/90">{r.label}</span>
                <PressButton variant="secondary" size="none" onClick={() => onWatchReplay(r)} className="rounded-md px-2 py-1 text-[10px] font-black">
                  Watch
                </PressButton>
                <PressButton variant="gold" size="none" onClick={() => handleSaveClick(r)} disabled={alreadySaved(r.id)} className="rounded-md px-2 py-1 text-[10px] font-black">
                  {alreadySaved(r.id) ? "Saved" : "Save"}
                </PressButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {overwriting && (
        <div className="mt-2.5 kit-row rounded-xl p-2">
          <div className="text-[10px] font-bold text-amber-200">All {SAVED_REPLAYS_MAX} slots are full — replace one:</div>
          <div className="mt-1.5 space-y-1">
            {saved.map((r, i) => (
              <button
                key={r.id}
                onClick={() => { onSaveReplay(i, overwriting); setOverwriting(null); }}
                className="kib-press kit-row block w-full rounded-lg px-2 py-1.5 text-left text-[10px] font-bold text-white"
              >
                Replace: {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOverwriting(null)}
            className="mt-1.5 text-[10px] font-bold text-white hover:text-white/85"
          >
            Cancel
          </button>
        </div>
      )}
    </SetCard>
  );
}
