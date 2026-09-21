"use client";
import { useState } from "react";
import { formatMoney } from "@/lib/star/money";
import { leagueNameFor } from "@/lib/star/calendar";
import type { ManagerTalk as Talk } from "@/lib/star/signingTalk";

/**
 * THE MANAGER'S VERDICT.
 *
 * The trial used to end and cut straight to a newspaper. This is the beat
 * that was missing: the man who stood and watched you for an afternoon
 * telling you what he made of it, and what he is prepared to pay.
 *
 * Deliberately short. He says three or four things, all of them driven by
 * what actually happened in the trial (see `managerTalkFor`), and then puts
 * a number on the table. The lines arrive one tap at a time rather than as a
 * wall of text — it is a conversation, and a conversation has pauses in it.
 *
 * Two ways out, and they are a real decision rather than a formality:
 * take the number he opened with, or go and haggle. Haggling can end with a
 * better deal and it can end with him walking away from it altogether.
 *
 * ── WHICH CLUB IS COMING FOR YOU IS THE HEADLINE, NOT THE CAPTION ──
 *
 * Reported from two people playing side by side: *"there should have been a
 * section saying 'this club's coming' — that's exactly what I got for mine"*,
 * where the other player's screen was just a big green negotiate button.
 * Driven in a real browser at iPhone 13 size (390 x 664) and two things came
 * out of it, both real:
 *
 *  1. **The offer card fell off the bottom of the screen.** With all four of
 *     his lines shown, the green button measured at **y = 664.75 px on a
 *     664 px viewport** — 0.75 px below the fold, so a player who had tapped
 *     through saw no button at all and had to scroll. Scrolling down to find
 *     it pushes the entire conversation off the top, which leaves a screen
 *     whose only content is the offer and a big green button. That is the
 *     report, exactly. The cause was `flex-1` on the conversation box inside
 *     a `min-h-[70vh]` column: the box grew to fill, and everything under it
 *     went over the edge. It does not grow any more, and the card is
 *     measured back on screen.
 *  2. **The club was an 11 px grey caption under a manager's name**, and the
 *     manager's name means nothing to most players. Who has come in for you
 *     is the single most important fact on this screen, so it is the
 *     headline; the man saying it is the line underneath.
 *
 * Also checked, and NOT the cause, so it is written down rather than guessed
 * at again: the routing is reliable. `afterTrialPhase`/`clublessPhaseFor`
 * (page.tsx) both send a finished trial here whenever anybody came in and the
 * money is not already settled, `talkingClubFor` only ever returns null when
 * the offer list is empty, and an empty offer list goes to the "No contract"
 * page, which explains itself. Driven at three trial scores in a real
 * browser: a 100 reaches this screen, and a 58 and a 25 both correctly reach
 * "No contract" with a youth team named. There is no state that silently
 * skips the conversation and lands on the negotiation.
 */
export default function ManagerTalk({
  talk, managerName, onNegotiate, onAccept,
}: {
  talk: Talk;
  /** The real manager's name when the club has one; a plain "The manager"
   *  when it does not, rather than an invented person. */
  managerName: string;
  onNegotiate: () => void;
  onAccept: () => void;
}) {
  const [shown, setShown] = useState(1);
  const done = shown >= talk.lines.length;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-3 text-white">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
        A club has come in for you
      </div>
      <div className="text-xl font-black leading-tight">{talk.club}</div>
      <div className="text-[11px] font-black uppercase tracking-widest text-white/50">
        {leagueNameFor(talk.division)} · {managerName} watched you play
      </div>

      {/* His office. Tapping moves him on to the next thing he has to say.
          No `flex-1`: it is what used to push the offer card off the bottom
          of a phone — see the note at the top of this file. */}
      <button
        onClick={() => setShown(s => Math.min(talk.lines.length, s + 1))}
        disabled={done}
        className="mt-3 space-y-1.5 rounded-2xl border border-white/10 bg-white/5 p-3 text-left"
      >
        {talk.lines.slice(0, shown).map((line, i) => (
          <p key={i} className="text-[12px] font-bold leading-snug text-white">
            “{line}”
          </p>
        ))}
        {!done && (
          <div className="pt-0.5 text-[10px] font-black uppercase tracking-widest text-amber-300/80">
            Tap to hear him out →
          </div>
        )}
      </button>

      {done && (
        <div className="mt-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
            What he is offering
          </div>
          <div className="text-2xl font-black tabular-nums">
            ★{formatMoney(talk.openingWeekly)}
            <span className="ml-1 text-sm font-black text-white/50">a week</span>
          </div>
          <p className="mt-1.5 text-[11.5px] font-bold leading-snug text-white/70">
            {talk.club} are opening below what the deal is worth, the way anybody
            does. Take it, or sit down and argue about it.
          </p>
          {/* Side by side rather than stacked, and both measured back onto a
              664 px phone — see the note at the top of this file. Stacked,
              the second one sat 52 px past the bottom edge. */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              onClick={onNegotiate}
              className="rounded-xl bg-emerald-500 py-2.5 text-[12px] font-black uppercase tracking-widest text-white hover:bg-emerald-400"
            >
              Talk money →
            </button>
            <button
              onClick={onAccept}
              className="rounded-xl bg-white/10 py-2.5 text-[12px] font-black uppercase tracking-widest text-white/80 hover:bg-white/20"
            >
              Take the offer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
