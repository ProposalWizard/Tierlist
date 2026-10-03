"use client";
import { useState } from "react";
import { formatMoney } from "@/lib/star/money";
import { leagueNameFor } from "@/lib/star/calendar";
import type { ManagerTalk as Talk } from "@/lib/star/signingTalk";
import ClubBadge from "./ClubBadge";
import { clubTheme } from "./ui";
import { Title } from "./ui/Screen";
import { ScoutBackdrop, ScoutFigure } from "./ScoutArt";

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
  talk, managerName, onNegotiate, onAccept, onSeeOthers,
}: {
  talk: Talk;
  /** The real manager's name when the club has one; a plain "The manager"
   *  when it does not, rather than an invented person. */
  managerName: string;
  onNegotiate: () => void;
  onAccept: () => void;
  /** Go to the list of every club that came in for you. */
  onSeeOthers?: () => void;
}) {
  const [shown, setShown] = useState(1);
  const done = shown >= talk.lines.length;

  const glow = clubTheme(talk.club).glow;

  // ── FULL SCREEN (Harry, 2 Oct 2026, v0.25 point 9: "a tiny box in the
  // middle, the rest blank"). The floodlit stand behind everything, the club
  // badge big at the top, the scout with his notebook saying his lines, and
  // the offer pinned to the bottom of the phone. Same buttons, same handlers.
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#05070d] text-white">
      <ScoutBackdrop glow={glow} />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4 pt-5">
        <div className="text-center">
          <div className="scout-kick inline-block rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-amber-300 ring-1 ring-amber-300/40">
            A scout has spotted you
          </div>
        </div>

        {/* The club: the headline, not a caption (see the note above). */}
        <div className="scout-rise mt-4 flex flex-col items-center text-center" style={{ animationDelay: "120ms" }}>
          <div className="relative grid h-[104px] w-[104px] place-items-center">
            <div aria-hidden className="scout-halo absolute inset-[-18px] rounded-full" style={{ background: `radial-gradient(closest-side, ${glow}aa, transparent)` }} />
            <div className="relative"><ClubBadge club={talk.club} size={92} /></div>
          </div>
          <Title className="mt-2 text-[28px]">{talk.club}</Title>
          <div className="text-[11px] font-black uppercase tracking-widest text-white/80">
            {leagueNameFor(talk.division)}
          </div>
        </div>

        {/* The scout, and what he says. Tapping moves him on. No `flex-1`
            on the lines: it is what used to push the offer off a phone. */}
        <button
          onClick={() => setShown(s => Math.min(talk.lines.length, s + 1))}
          disabled={done}
          className="scout-rise mt-4 flex w-full items-start gap-3 rounded-2xl p-3 text-left"
          style={{ animationDelay: "240ms", background: "linear-gradient(180deg, rgba(15,23,42,.82), rgba(5,7,13,.88))", boxShadow: `inset 0 0 0 1px ${glow}66, 0 12px 30px -12px rgba(0,0,0,.9)` }}
        >
          <div className="shrink-0 overflow-hidden rounded-xl" style={{ background: `linear-gradient(180deg, ${glow}55, rgba(0,0,0,.4))`, boxShadow: `inset 0 0 0 1px ${glow}88` }}>
            <ScoutFigure className="h-[84px] w-[72px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#fcd34d" }}>
              {managerName}&apos;s scout
            </div>
            <div className="mt-1 space-y-1.5">
              {talk.lines.slice(0, shown).map((line, i) => (
                <p key={i} className="text-[13px] font-bold leading-snug text-white">“{line}”</p>
              ))}
            </div>
            {!done && (
              <div className="pt-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                Tap to hear him out →
              </div>
            )}
          </div>
        </button>

        <div className="min-h-3 flex-1" />

        {done && (
          <div className="scout-rise rounded-2xl p-3.5" style={{ background: "linear-gradient(180deg, rgba(6,78,59,.92), rgba(2,44,34,.95))", boxShadow: "inset 0 0 0 1px rgba(52,211,153,.45), 0 -10px 30px -10px rgba(0,0,0,.8)" }}>
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">The offer</div>
                <div className="text-[30px] font-black leading-none tabular-nums">
                  ★{formatMoney(talk.openingWeekly)}
                  <span className="ml-1 text-sm font-black text-white">a week</span>
                </div>
              </div>
              <ClubBadge club={talk.club} size={34} />
            </div>
            <p className="mt-1.5 text-[11.5px] font-bold leading-snug text-white">
              Take it, or argue for more. Push too hard and he comes back with a worse, final offer.
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                onClick={onAccept}
                className="kib-press rounded-xl bg-emerald-500 py-3 text-[12px] font-black uppercase tracking-widest text-white hover:bg-emerald-400"
              >
                Accept &amp; sign
              </button>
              <button
                onClick={onNegotiate}
                className="kib-press rounded-xl bg-amber-400 py-3 text-[12px] font-black uppercase tracking-widest text-gray-950 hover:bg-amber-300"
              >
                Negotiate
              </button>
            </div>
            {onSeeOthers && (
              <button
                onClick={onSeeOthers}
                className="kib-press mt-2 w-full rounded-xl bg-white/10 py-2 text-[12px] font-black uppercase tracking-widest text-white hover:bg-white/20"
              >
                See other clubs
              </button>
            )}
          </div>
        )}
      </div>
      <style>{SCOUT_CSS}</style>
    </div>
  );
}

const SCOUT_CSS = `
@keyframes scoutRise{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:none}}
@keyframes scoutHalo{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}
@keyframes scoutKick{0%{opacity:0;transform:scale(.8)}60%{opacity:1;transform:scale(1.06)}100%{transform:scale(1)}}
.scout-rise{animation:scoutRise .5s cubic-bezier(.2,.9,.25,1) both}
.scout-halo{animation:scoutHalo 2.6s ease-in-out infinite}
.scout-kick{animation:scoutKick .5s cubic-bezier(.2,.9,.25,1) both}
@media (prefers-reduced-motion: reduce){.scout-rise,.scout-halo,.scout-kick{animation:none}}
`;
