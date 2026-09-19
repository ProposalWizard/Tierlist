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

  if (!open) {
    // ── As small as a real control can get ──
    //
    // This sits directly above the live canvas on every one of these screens
    // and is dev-only — no real player ever needs it — so its resting line is
    // trimmed to the smallest tap target that is still comfortably tappable
    // (py-1, not py-1.5) with a tighter margin under it, rather than the
    // fuller padding a screen without a canvas fighting it for room could
    // afford.
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-1.5 w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-1 text-[10px] font-black uppercase tracking-widest text-sky-200 transition hover:bg-sky-500/20"
      >
        🛠 Dev: Skip / Sim Trial
      </button>
    );
  }

  const done = TRIAL_STAGES.filter(s => trial.results[s]).length;
  const left = TRIAL_STAGES.length - done;

  return (
    <div className="mb-2 rounded-xl border border-sky-500/50 bg-sky-500/10 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-sky-200">
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
            className={`rounded-lg py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
              level === l
                ? "bg-sky-400 text-gray-950"
                : "bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"}`}
          >
            {TRIAL_SIM_LABEL[l]}
          </button>
        ))}
      </div>

      {/* The real number, computed by running the real thing — see simScore. */}
      <div className="mt-1.5 text-center text-[10px] font-bold text-sky-100/70">
        Whole trial at {TRIAL_SIM_LABEL[level]} → <span className="tabular-nums text-sky-100">{simScore(trial, level)}</span>/100
        {left > 0 && <> · {left} stage{left === 1 ? "" : "s"} left</>}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          disabled={!stage}
          onClick={() => stage && onSkipStage(level)}
          className="rounded-lg bg-sky-500/25 py-2 text-[10px] font-black uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/40 disabled:opacity-40"
        >
          Skip {stage ? STAGE_LABEL[stage] : "stage"}
        </button>
        <button
          disabled={!stage}
          onClick={() => stage && onSimTrial(level)}
          className="rounded-lg bg-sky-400 py-2 text-[10px] font-black uppercase tracking-wide text-gray-950 transition hover:bg-sky-300 disabled:opacity-40"
        >
          Sim whole trial
        </button>
      </div>

      <button
        onClick={() => setOpen(false)}
        className="mt-2 w-full text-[10px] font-bold text-sky-200/60 transition hover:text-sky-200"
      >
        Hide
      </button>
    </div>
  );
}
