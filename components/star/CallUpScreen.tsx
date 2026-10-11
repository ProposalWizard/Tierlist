"use client";

/**
 * THE INTERNATIONAL BREAK — the national manager names his squad
 * (lib/star/international.ts). Called up: the match is next on your
 * calendar, played in the real match. Left out: one line why, a bar of how
 * close you are with what would move it, and back to the club.
 *
 * Flags are drawn (NationFlag), so the page never shows a blank or a globe
 * when the flag CDN is blocked.
 */
import type { CallUpDecision } from "@/lib/star/international";
import { PressButton, LiquidBar, RiseIn } from "./ui";
import NationFlag from "./NationFlag";

export default function CallUpScreen({ decision, dateLabel, onContinue }: {
  decision: CallUpDecision;
  /** "Wed 9 Oct". */
  dateLabel: string;
  onContinue: () => void;
}) {
  const { called, nation, fixture, monthName, reason, chance, closeLine } = decision;
  const home = fixture.home ? nation : fixture.opponent;
  const away = fixture.home ? fixture.opponent : nation;
  return (
    <div data-callup={called ? "called" : "left-out"} className="min-h-screen bg-gray-950 text-white px-4 py-6"
      style={{ backgroundImage: called
        ? "radial-gradient(80% 50% at 50% 0%, rgba(56,189,248,0.28), transparent 70%)"
        : "radial-gradient(80% 50% at 50% 0%, rgba(148,163,184,0.18), transparent 70%)" }}>
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-200/80">International break · {monthName}</div>
        <RiseIn>
          <div className="mt-6 flex flex-col items-center">
            <div className={`rounded-md shadow-lg ring-2 ring-white/25 ${called ? "" : "opacity-70"}`}>
              <NationFlag nation={nation} width={120} rounded={6} />
            </div>
            <div className="mt-4 text-[34px] font-black uppercase leading-none tracking-wide"
              style={{ color: called ? "#7dd3fc" : "#cbd5e1" }}>
              {called ? "Called up" : "Not selected"}
            </div>
            <div className="mt-2 text-[15px] font-bold text-white">
              {called ? `You're in the ${nation} squad.` : `Left out of the ${nation} squad.`}
            </div>
            <div className="mt-1 text-[13px] font-bold text-white/80">{reason}</div>
          </div>
        </RiseIn>

        <div className="mt-6 w-full border-y border-white/10 py-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-white/60">{fixture.competition} · {dateLabel}</div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[16px] font-black">
            <span className="flex min-w-0 items-center justify-end gap-2"><span className="truncate">{home}</span><NationFlag nation={home} width={28} /></span>
            <span className="text-white/50">v</span>
            <span className="flex min-w-0 items-center gap-2"><NationFlag nation={away} width={28} /><span className="truncate">{away}</span></span>
          </div>
          {!called && <div className="mt-2 text-[11px] font-bold text-white/60">Played without you.</div>}
        </div>

        {!called && (
          <div className="mt-5 w-full text-left" data-callup-close>
            <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-white/60">How close you are</div>
            <LiquidBar value={Math.round(chance * 100)} colors={["#38bdf8", "#a5f3fc"]} className="h-3" />
            <div className="mt-1.5 text-[12px] font-bold text-white/80">{closeLine}</div>
          </div>
        )}

        <div className="mt-8 w-full" data-callup-continue>
          <PressButton variant="gold" size="none" onClick={onContinue} className="w-full rounded-xl py-3 text-[14px] font-black uppercase">
            {called ? "Report for duty →" : "Back to the club →"}
          </PressButton>
        </div>
      </div>
    </div>
  );
}
