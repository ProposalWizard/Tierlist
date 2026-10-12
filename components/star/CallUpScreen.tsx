"use client";

/**
 * THE SQUAD ANNOUNCEMENT — the national manager names his squad for an
 * international window or a tournament (lib/star/intl/career.ts). Called up:
 * every match of the window (or the tournament's group games) goes on your
 * calendar on its real date, played in the real match. Left out: one line
 * why, the national manager's bar (0-100; in the squad from 34, starting
 * from 55) and back to the club.
 *
 * Built from the Home screen's kit (Mikey, 12 Oct 2026: "it doesn't take any
 * inspiration from the design style of the homepage"): the night stadium lit
 * in your nation's colours, the heavy font for the verdict, flat panels that
 * fade into the page (no floating cards), the liquid bar for the manager.
 *
 * Flags are drawn (NationFlag), so the page never shows a blank or a globe
 * when the flag CDN is blocked.
 */
import type { IntlDecision } from "@/lib/star/intl/career";
import { SQUAD_AT, START_AT } from "@/lib/star/intl/career";
import { nationKits } from "@/lib/star/international";
import { KitStyles, Stadium, FlatPanel, SquareBar, PressButton, RiseIn, Glow, glowOf, rgba } from "./ui";
import NationFlag from "./NationFlag";

const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** The national manager's bar with the two marks on it (squad 34, starter 55). */
export function ManagerBar({ value, nation }: { value: number; nation: string }) {
  const v = Math.round(value);
  return (
    <div>
      <div className="mb-1 flex items-end justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">{nation} manager</span>
        <span className="text-[22px] font-black leading-none">{v}<span className="text-[13px] text-white/60"> / 100</span></span>
      </div>
      <div className="relative">
        <SquareBar value={v} colors={v >= START_AT ? ["#f59e0b", "#fde68a"] : v >= SQUAD_AT ? ["#38bdf8", "#a5f3fc"] : ["#64748b", "#cbd5e1"]} className="h-4" square animate />
        <span className="pointer-events-none absolute -top-1 bottom-[-4px] w-[2px] bg-white" style={{ left: `${SQUAD_AT}%` }} />
        <span className="pointer-events-none absolute -top-1 bottom-[-4px] w-[2px] bg-amber-300" style={{ left: `${START_AT}%` }} />
      </div>
      <div className="relative mt-1 h-4 text-[10.5px] font-bold text-white/80">
        <span className="absolute -translate-x-1/2" style={{ left: `${SQUAD_AT}%` }}>Squad {SQUAD_AT}</span>
        <span className="absolute -translate-x-1/2 text-amber-300" style={{ left: `${START_AT}%` }}>Starter {START_AT}</span>
      </div>
    </div>
  );
}

export default function CallUpScreen({ decision, onContinue }: {
  decision: IntlDecision;
  onContinue: () => void;
}) {
  const { called, nation, period, reason, manager, line, starter } = decision;
  const tournament = period.kind === "tournament";
  const matches = period.matches.slice(0, tournament ? 3 : 6);
  const kit = nationKits(nation).home;
  const glow = called ? glowOf(kit.shirt, kit.trim) : "#64748b";
  return (
    <div data-callup={called ? "called" : "left-out"} className="relative min-h-[100dvh] overflow-hidden bg-[#05080f] text-white">
      <KitStyles />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"><Stadium glow={glow} big intro={called} pitch={false} /></div>
      <div className="relative mx-auto flex max-w-md flex-col px-3 pb-8 pt-6">
        <RiseIn index={0}>
          <div className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
            {tournament ? period.label : `International break · ${period.label}`}
          </div>
        </RiseIn>

        <RiseIn index={1}>
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="relative">
              <Glow color={glow} className="-inset-4 blur-2xl" pulse={called} />
              <div className={`relative shadow-[0_8px_30px_rgba(0,0,0,.6)] ${called ? "" : "opacity-60 grayscale-[.4]"}`}>
                <NationFlag nation={nation} width={132} rounded={4} />
              </div>
            </div>
            <h1 className="mt-6 text-[56px] uppercase leading-none" style={{ color: called ? "#fff" : "#cbd5e1", textShadow: called ? `0 0 28px ${rgba(glow, 0.9)}` : "none" }}>
              {called ? "Called up" : "Not selected"}
            </h1>
            <div className="mt-3 text-[15px] font-bold text-white">
              {called
                ? `You're in the ${nation} squad${tournament ? ` for the ${period.comp}` : ""}${starter ? " — as a starter" : ""}.`
                : `Left out of the ${nation} squad.`}
            </div>
            <div className="mt-1 text-[13px] font-semibold text-white/85">{reason}</div>
          </div>
        </RiseIn>

        <RiseIn index={2}>
          <FlatPanel bleed edge glow={glow} className="mt-7 px-4 py-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
              {tournament ? "Group games" : `${nation}'s matches`}
            </div>
            {matches.map((m) => (
              <div key={m.id} className="border-t border-white/10 py-2 first:border-t-0">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[14px] font-bold">
                  <span className="flex min-w-0 items-center justify-end gap-1.5"><span className="truncate">{m.home}</span><NationFlag nation={m.home} width={22} /></span>
                  <span className="px-1 text-[12px] text-white/60">v</span>
                  <span className="flex min-w-0 items-center gap-1.5"><NationFlag nation={m.away} width={22} /><span className="truncate">{m.away}</span></span>
                </div>
                <div className="mt-0.5 text-center text-[11px] font-semibold text-white/75">{day(m.date)} · {m.comp} · {m.stage}</div>
              </div>
            ))}
            <div className="mt-1 text-[12px] font-semibold text-white/80">
              {!called ? "Played without you."
                : tournament ? `You stay with the squad until ${nation} are knocked out.`
                : "Any club games in between are played without you."}
            </div>
          </FlatPanel>
        </RiseIn>

        <RiseIn index={3}>
          <FlatPanel bleed fade="both" className="mt-3 px-4 py-4" data-callup-manager>
            <ManagerBar value={manager} nation={nation} />
            <div className="mt-2 text-[13px] font-semibold text-white">{line}</div>
          </FlatPanel>
        </RiseIn>

        <RiseIn index={4}>
          <div className="mt-6" data-callup-continue>
            <PressButton variant="gold" size="none" pulse={called} onClick={onContinue} className="w-full rounded-none py-3.5 text-[15px] font-black uppercase">
              {called ? "Report for duty →" : "Back to the club →"}
            </PressButton>
          </div>
        </RiseIn>
      </div>
    </div>
  );
}
