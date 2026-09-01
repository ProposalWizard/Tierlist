"use client";
import { useEffect, useState } from "react";
import type { CareerState, GoalReplay } from "@/lib/star/types";
import { SAVED_REPLAYS_MAX, firstEmptySlot } from "@/lib/star/goalReplays";

/**
 * GOAL REPLAYS — admin-only, for testing.
 *
 * The physics are a real, seeded simulation, so a goal you scored can be
 * watched again exactly as it happened — see GoalReplay's own doc. Recent
 * goals are captured automatically as you play; keeping one of them is a
 * deliberate choice, capped at three, same as the feature this is testing
 * ahead of a real release.
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
    <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">Goal Replays</span>
        <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-200">Admin · Test</span>
      </div>
      <p className="mt-1 text-[11px] text-gray-300">
        Watch a goal happen again, exactly as it did. Save up to {SAVED_REPLAYS_MAX} from the ones you've scored recently.
      </p>

      <div className="mt-2.5">
        <div className="text-[9px] font-black uppercase tracking-widest text-white/60">Saved ({saved.length}/{SAVED_REPLAYS_MAX})</div>
        {saved.length === 0 ? (
          <div className="mt-1 text-[10px] text-white/50">Nothing kept yet.</div>
        ) : (
          <div className="mt-1 space-y-1">
            {saved.map(r => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg bg-gray-800/70 px-2 py-1.5">
                <span className="flex-1 truncate text-[11px] font-bold text-white">{r.label}</span>
                <button
                  onClick={() => onWatchReplay(r)}
                  className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-black text-white hover:bg-emerald-500"
                >
                  Watch
                </button>
                <button
                  onClick={() => onDeleteSavedReplay(r.id)}
                  className="rounded bg-red-600/70 px-2 py-1 text-[10px] font-black text-white hover:bg-red-500/70"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <div className="text-[9px] font-black uppercase tracking-widest text-white/60">Recent goals</div>
        {recent.length === 0 ? (
          <div className="mt-1 text-[10px] text-white/50">Score one in a real match to see it here.</div>
        ) : (
          <div className="mt-1 space-y-1">
            {recent.map(r => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg bg-gray-800/40 px-2 py-1.5">
                <span className="flex-1 truncate text-[11px] text-white/90">{r.label}</span>
                <button
                  onClick={() => onWatchReplay(r)}
                  className="rounded bg-gray-700 px-2 py-1 text-[10px] font-black text-white hover:bg-gray-600"
                >
                  Watch
                </button>
                <button
                  onClick={() => handleSaveClick(r)}
                  disabled={alreadySaved(r.id)}
                  className="rounded bg-amber-500 px-2 py-1 text-[10px] font-black text-gray-950 hover:bg-amber-400 disabled:opacity-40"
                >
                  {alreadySaved(r.id) ? "Saved" : "Save"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {overwriting && (
        <div className="mt-2.5 rounded-lg border border-amber-400/50 bg-gray-900 p-2">
          <div className="text-[10px] font-bold text-amber-200">All {SAVED_REPLAYS_MAX} slots are full — replace one:</div>
          <div className="mt-1.5 space-y-1">
            {saved.map((r, i) => (
              <button
                key={r.id}
                onClick={() => { onSaveReplay(i, overwriting); setOverwriting(null); }}
                className="block w-full rounded bg-gray-800 px-2 py-1.5 text-left text-[10px] font-bold text-white hover:bg-gray-700"
              >
                Replace: {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOverwriting(null)}
            className="mt-1.5 text-[10px] font-bold text-white/60 hover:text-white/85"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
