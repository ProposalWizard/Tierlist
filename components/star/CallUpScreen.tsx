"use client";

/**
 * THE SQUAD ANNOUNCEMENT — the national manager names his squad for an
 * international window or a tournament (lib/star/intl/career.ts). Called up:
 * every match of the window (or the tournament's group games) goes on your
 * calendar on its real date, played in the real match. Left out: one line
 * why, the national manager's bar (0-100; in the squad from 34, starting
 * from 55) and back to the club.
 *
 * Flags are drawn (NationFlag), so the page never shows a blank or a globe
 * when the flag CDN is blocked.
 */
import type { IntlDecision } from "@/lib/star/intl/career";
import { SQUAD_AT, START_AT } from "@/lib/star/intl/career";
import { PressButton, RiseIn } from "./ui";
import NationFlag from "./NationFlag";

const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default function CallUpScreen({ decision, onContinue }: {
  decision: IntlDecision;
  onContinue: () => void;
}) {
  const { called, nation, period, reason, manager, line, starter } = decision;
  const tournament = period.kind === "tournament";
  const matches = period.matches.slice(0, tournament ? 3 : 6);
  return (
    <div data-callup={called ? "called" : "left-out"} className="min-h-screen bg-gray-950 text-white px-4 py-6"
      style={{ backgroundImage: called
        ? "radial-gradient(80% 50% at 50% 0%, rgba(56,189,248,0.28), transparent 70%)"
        : "radial-gradient(80% 50% at 50% 0%, rgba(148,163,184,0.18), transparent 70%)" }}>
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-200">
          {tournament ? period.label : `International break · ${period.label}`}
        </div>
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
              {called
                ? `You're in the ${nation} squad${tournament ? ` for the ${period.comp}` : ""}${starter ? " — as a starter" : ""}.`
                : `Left out of the ${nation} squad.`}
            </div>
            <div className="mt-1 text-[13px] font-bold text-white">{reason}</div>
          </div>
        </RiseIn>

        <div className="mt-6 w-full border-y border-white/10 py-3 text-left">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-white/70">
            {tournament ? "Group games" : `${nation}'s matches`}
          </div>
          {matches.map((m) => (
            <div key={m.id} className="mt-1.5 grid grid-cols-[3.6rem_1fr_auto_1fr] items-center gap-2 text-[13px] font-black">
              <span className="text-[10.5px] font-bold text-white/70">{day(m.date)}</span>
              <span className="flex min-w-0 items-center justify-end gap-1.5"><span className="truncate">{m.home}</span><NationFlag nation={m.home} width={20} /></span>
              <span className="text-white/60">v</span>
              <span className="flex min-w-0 items-center gap-1.5"><NationFlag nation={m.away} width={20} /><span className="truncate">{m.away}</span></span>
              <span className="col-span-4 -mt-0.5 text-[10px] font-bold text-white/60">{m.comp} · {m.stage}</span>
            </div>
          ))}
          {!called && <div className="mt-2 text-[11px] font-bold text-white/70">Played without you.</div>}
          {called && !tournament && <div className="mt-2 text-[11px] font-bold text-white/70">Any club games in between are played without you.</div>}
          {called && tournament && <div className="mt-2 text-[11px] font-bold text-white/70">You stay with the squad until {nation} are knocked out.</div>}
        </div>

        <div className="mt-5 w-full text-left" data-callup-manager>
          <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-wider text-white/70">
            <span>{nation} manager</span><span>{Math.round(manager)} / 100</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-200" style={{ width: `${Math.round(manager)}%` }} />
            <span className="absolute top-0 h-3 w-0.5 bg-white/80" style={{ left: `${SQUAD_AT}%` }} />
            <span className="absolute top-0 h-3 w-0.5 bg-amber-300" style={{ left: `${START_AT}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-bold text-white/70">
            <span>Squad from {SQUAD_AT}</span><span>Starter from {START_AT}</span>
          </div>
          <div className="mt-1.5 text-[12px] font-bold text-white">{line}</div>
        </div>

        <div className="mt-8 w-full" data-callup-continue>
          <PressButton variant="gold" size="none" onClick={onContinue} className="w-full rounded-xl py-3 text-[14px] font-black uppercase">
            {called ? "Report for duty →" : "Back to the club →"}
          </PressButton>
        </div>
      </div>
    </div>
  );
}
