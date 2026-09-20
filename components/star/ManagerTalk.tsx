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
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col px-4 py-6 text-white">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
        After the trial
      </div>
      <div className="mt-1 text-2xl font-black leading-tight">{managerName}</div>
      <div className="text-[11px] font-black uppercase tracking-widest text-white/50">
        {talk.club} · {leagueNameFor(talk.division)}
      </div>

      {/* His office. Tapping moves him on to the next thing he has to say. */}
      <button
        onClick={() => setShown(s => Math.min(talk.lines.length, s + 1))}
        disabled={done}
        className="mt-5 flex-1 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
      >
        {talk.lines.slice(0, shown).map((line, i) => (
          <p key={i} className="text-[13px] font-bold leading-relaxed text-white">
            “{line}”
          </p>
        ))}
        {!done && (
          <div className="pt-1 text-[10px] font-black uppercase tracking-widest text-white/40">
            Tap to hear him out
          </div>
        )}
      </button>

      {done && (
        <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
            What he is offering
          </div>
          <div className="mt-1 text-3xl font-black tabular-nums">
            ★{formatMoney(talk.openingWeekly)}
            <span className="ml-1 text-sm font-black text-white/50">a week</span>
          </div>
          <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/70">
            He is opening below what the deal is worth, the way anybody does.
            You can take it, or sit down and argue about it.
          </p>
          <button
            onClick={onNegotiate}
            className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-400"
          >
            Talk about the money →
          </button>
          <button
            onClick={onAccept}
            className="mt-2 w-full rounded-xl bg-white/10 py-2.5 text-[12px] font-black uppercase tracking-widest text-white/80 hover:bg-white/20"
          >
            Take what is on the table
          </button>
        </div>
      )}
    </div>
  );
}
