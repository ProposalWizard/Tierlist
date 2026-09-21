"use client";
import type { CareerState } from "@/lib/star/types";
import { leagueNameFor } from "@/lib/star/calendar";
import { loanProgress } from "@/lib/star/youth";

/**
 * WHAT YOU ARE HERE TO DO.
 *
 * A loan with a number on it is set dressing unless the number is in front
 * of you. This is the one screen that says it: who owns you, who you are
 * playing for, how many goals they asked for, how many you have, and how
 * much of the season is left to get the rest.
 *
 * Shown once a week, on the way to the match, rather than before every
 * single fixture — it is a reminder, not a toll gate. `Continue` goes
 * straight through to the ordinary pre-match screen, and everything after
 * it is a completely normal first-team week, because that is the entire
 * point of being loaned out: you play.
 */
export default function LoanBrief({ career, onContinue, intro = false }: {
  career: CareerState;
  onContinue: () => void;
  /**
   * ── THE FIRST TIME, WHICH USED NEVER TO HAPPEN ──
   *
   * Reported from a real playthrough: *"you got loaned out. You got loaned
   * out. It just didn't tell you anything."* Exactly right, and the reason
   * was that this screen only ever rendered at `phase === "pre-match"`.
   * A loan wildcard signs you, sets `placement`, and jumps straight to
   * `trial-reward` — so the newspaper and the contract both named the club
   * you were being SENT TO, nobody said the word loan, and the first
   * explanation arrived several taps later on the way to a match.
   *
   * `intro` is that missing first showing: the same numbers, worded as news
   * rather than as a reminder. Everything after it is the ordinary weekly
   * version, unchanged.
   */
  intro?: boolean;
}) {
  const p = career.placement;
  const progress = loanProgress(career);
  if (!p || !progress) return null;
  const pct = Math.max(0, Math.min(100, (progress.scored / Math.max(1, progress.target)) * 100));

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-6 text-white">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-300">
        {intro ? `${p.parentClub} are loaning you out` : "On loan"}
      </div>
      <div className="mt-1 text-2xl font-black leading-tight">{p.club}</div>
      <div className="text-[11px] font-black uppercase tracking-widest text-white/50">
        {leagueNameFor(p.division)} · from {p.parentClub}
      </div>

      {intro && (
        <p className="mt-3 text-[12px] font-bold leading-relaxed text-white/80">
          You are a {p.parentClub} player — that is who pays you and who holds your
          contract. You are not getting into that first team yet, so they are sending
          you to {p.club} for the season to play every week.
        </p>
      )}

      <div className="mt-5 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-sky-300">
          What {p.parentClub} asked for
        </div>
        <div className="mt-1 text-3xl font-black tabular-nums">
          {progress.scored}
          <span className="text-white/40"> / {progress.target}</span>
          <span className="ml-2 text-sm font-black text-white/50">goals</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40">
          <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-[12px] font-bold leading-relaxed text-white/70">
          {progress.met
            ? `Done. ${p.parentClub} will come for you at the end of the season — if you still want them to.`
            : `${progress.target - progress.scored} to go, with about ${progress.weeksLeft} game${progress.weeksLeft === 1 ? "" : "s"} left. Miss it and this is your club now.`}
        </p>
      </div>

      <button
        onClick={onContinue}
        className="mt-5 w-full rounded-xl bg-emerald-500 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-400"
      >
        {intro ? `Report to ${p.club} →` : "Get on with it →"}
      </button>
    </div>
  );
}
