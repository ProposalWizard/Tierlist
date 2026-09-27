"use client";
import { useState } from "react";
import { STAGE_LABEL, TRIAL_STAGES, type TrialProgress, type TrialStage } from "@/lib/star/trial";
import {
  TRIAL_SIM_LEVELS, TRIAL_SIM_LABEL, simScore, type TrialSimLevel,
} from "@/lib/star/trialDev";

/**
 * DEV: SKIP / SIM THE TRIAL — A TESTING TOOL, NOT A GAMEPLAY FEATURE.
 *
 * Requested directly: the trial is five stages on the live match engine and it
 * is the only road to the scout offers, the signing, the reward screen and the
 * free-agent life, so testing any of those cost a full playthrough each time.
 * "Right now it's stupidly long."
 *
 * ── Why it is unguarded, and why it looks like this ──
 *
 * Same "developers and admins" spirit as `DevSkipPanel` and `DevMoneyPanel` in
 * Settings, whose own notes record the same reasoning: no login role and no
 * feature flag gates either of those, they simply live on the screen for
 * whoever is using this dev build. The sky-blue border, the 🛠 prefix and the
 * collapsed-by-default button are all borrowed straight from `DevSkipPanel` so
 * that this reads as the same class of thing at a glance — a tool bolted to
 * the side of the game, not part of it.
 *
 * Collapsed by default matters more here than it does in Settings: this sits
 * directly above a live canvas stage on a phone, so its resting state is one
 * thin line.
 */
export default function DevTrialPanel({
  trial, stage, onSkipStage, onSimTrial,
}: {
  trial: TrialProgress;
  /** The stage a skip would fill — null once every stage has a result. */
  stage: TrialStage | null;
  onSkipStage: (level: TrialSimLevel) => void;
  onSimTrial: (level: TrialSimLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<TrialSimLevel>("average");

  const done = TRIAL_STAGES.filter(s => trial.results[s]).length;
  const left = TRIAL_STAGES.length - done;

  // ── Open, it floats over the stage instead of pushing it down ──
  //
  // It used to open in the page flow, and once opened it stayed open on every
  // stage, so the pitch sat at 501–913 px on a 664 px phone (phone audit,
  // 26 Sep 2026). Now the resting line is the only thing in the flow and the
  // panel drops down over the stage; tapping the line again closes it. Skip
  // and Sim close it too, so it never sits over the result card's Next.
  return (
    <div className="relative mb-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="min-h-[40px] w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-1 text-[11px] font-black uppercase tracking-widest text-sky-200 transition hover:bg-sky-500/20"
      >
        🛠 Dev: Skip / Sim Trial {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 rounded-xl border border-sky-500/50 bg-gray-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur">
          <div className="text-[11px] font-black uppercase tracking-widest text-sky-200">
            Dev: Skip / Sim Trial
          </div>
          <p className="mt-1 text-[11px] leading-snug text-sky-100/80">
            Records real stage results without playing them, so the offers, the signing and the
            free-agent branch can all be reached in a couple of taps. Every result goes through the
            normal scoring, so downstream behaves exactly as it would if you had played it.
          </p>

          {/* How well the sim "played". The whole reason the toggle exists: the
              interesting thing downstream is what a DIFFERENT score does, and
              re-playing five stages to find out is exactly the cost being
              removed. */}
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {TRIAL_SIM_LEVELS.map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`min-h-[40px] rounded-lg py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
                  level === l
                    ? "bg-sky-400 text-gray-950"
                    : "bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"}`}
              >
                {TRIAL_SIM_LABEL[l]}
              </button>
            ))}
          </div>

          {/* The real number, computed by running the real thing — see simScore. */}
          <div className="mt-1.5 text-center text-[11px] font-bold text-sky-100/70">
            Whole trial at {TRIAL_SIM_LABEL[level]} → <span className="tabular-nums text-sky-100">{simScore(trial, level)}</span>/100
            {left > 0 && <> · {left} stage{left === 1 ? "" : "s"} left</>}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              disabled={!stage}
              onClick={() => { if (!stage) return; setOpen(false); onSkipStage(level); }}
              className="min-h-[40px] rounded-lg bg-sky-500/25 py-2 text-[11px] font-black uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/40 disabled:opacity-40"
            >
              Skip {stage ? STAGE_LABEL[stage] : "stage"}
            </button>
            <button
              disabled={!stage}
              onClick={() => { if (!stage) return; setOpen(false); onSimTrial(level); }}
              className="min-h-[40px] rounded-lg bg-sky-400 py-2 text-[11px] font-black uppercase tracking-wide text-gray-950 transition hover:bg-sky-300 disabled:opacity-40"
            >
              Sim whole trial
            </button>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="mt-2 min-h-[40px] w-full text-[11px] font-bold text-sky-200/60 transition hover:text-sky-200"
          >
            Hide
          </button>
        </div>
      )}
    </div>
  );
}
