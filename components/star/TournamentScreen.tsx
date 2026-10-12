"use client";

/**
 * THE SUMMER TOURNAMENT (lib/star/tournament.ts).
 *
 *  - "squad": the club season is over and the manager names his squad. In
 *    it: your group and your first opponent. Left out (or your nation did not
 *    qualify): the tournament is played without you, and the winner shown.
 *  - "progress": after each of your tournament matches — your group table,
 *    or the knockout road so far, and the line about what just happened.
 */
import type { TournamentState } from "@/lib/star/tournament";
import { groupTable, yourGroup } from "@/lib/star/tournament";
import { tieWinner } from "@/lib/star/cups";
import NationFlag from "./NationFlag";
import { PressButton, LiquidBar, RiseIn } from "./ui";

const NAME: Record<string, string> = { "World Cup": "World Cup", "European Championship": "Euros" };

export default function TournamentScreen({ state, mode, year, message, onContinue }: {
  state: TournamentState;
  mode: "squad" | "progress";
  /** The summer it is played, e.g. 2029. */
  year: number;
  /** What just happened (progress mode). */
  message?: string | null;
  onContinue: () => void;
}) {
  const { nation, entered, selected, chance, competition, winner } = state;
  const g = yourGroup(state);
  const table = g ? groupTable(g) : [];
  const inKo = state.ko.length > 0 && state.ko[0].ties.some(t => t.home === nation || t.away === nation);
  const out = !!state.yourExit && state.yourExit !== "Winners";
  const headline = mode === "squad"
    ? (!entered ? "Didn't qualify" : selected ? "In the squad" : "Not selected")
    : state.yourExit === "Winners" ? "Champions!" : out ? "Going home" : inKo ? "Knockouts" : `Group ${g?.name ?? ""}`;
  const sub = mode === "squad"
    ? (!entered ? `${nation} aren't at the ${competition}.`
      : selected ? `You're going to the ${competition} with ${nation}.`
      : `Left out of ${nation}'s ${competition} squad.`)
    : message ?? "";
  const lit = mode === "squad" ? entered && selected : !out;

  return (
    <div data-tournament={mode} className="min-h-screen bg-gray-950 px-4 py-6 text-white"
      style={{ backgroundImage: lit
        ? "radial-gradient(80% 50% at 50% 0%, rgba(250,204,21,0.25), transparent 70%)"
        : "radial-gradient(80% 50% at 50% 0%, rgba(148,163,184,0.18), transparent 70%)" }}>
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/90">{NAME[competition] ?? competition} · Summer {year}</div>
        <RiseIn>
          <div className="mt-5 flex flex-col items-center">
            {/* Drawn, never a network image: the flag CDN was blocked or slow and
                left a globe here (tournament playtest, 11 Oct 2026). */}
            <div className="rounded-md shadow-lg ring-2 ring-white/20"><NationFlag nation={nation} width={96} rounded={6} /></div>
            <div data-tournament-headline className="mt-3 text-[30px] font-black uppercase leading-none tracking-wide"
              style={{ color: lit ? "#fde047" : "#cbd5e1" }}>{headline}</div>
            {sub && <div className="mt-2 text-[14px] font-bold text-white">{sub}</div>}
          </div>
        </RiseIn>

        {mode === "squad" && entered && (
          <div className="mt-5 w-full text-left">
            <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-white/70">Your chance of the squad</div>
            <LiquidBar value={Math.round(chance * 100)} colors={["#facc15", "#fef08a"]} className="h-3" />
            <div className="mt-1 text-[11px] font-bold text-white/70">{Math.round(chance * 100)}% — your rating, your form, and the internationals you played this season.</div>
          </div>
        )}

        {g && (!inKo || mode === "squad") && (
          <div data-tournament-group className="mt-6 w-full">
            <div className="mb-1 text-left text-[10px] font-black uppercase tracking-wider text-white/70">Group {g.name}</div>
            <table className="w-full text-[13px] font-bold">
              <thead>
                <tr className="text-[10px] uppercase text-white/60">
                  <th className="py-1 text-left font-black">Team</th>
                  {["P", "W", "D", "L", "GD", "Pts"].map(h => <th key={h} className="w-8 font-black">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => (
                  <tr key={r.name} className={`border-t border-white/10 ${r.name === nation ? "bg-amber-300/15 text-amber-100" : ""}`}>
                    <td className="py-1.5 text-left">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-3 text-[10px] ${i < 2 ? "text-emerald-300" : "text-white/50"}`}>{i + 1}</span>
                        <Flag name={r.name} />{r.name}
                      </span>
                    </td>
                    <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
                    <td>{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</td>
                    <td className="font-black">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 text-left text-[10px] font-bold text-white/60">
              Top two go through{state.groups.length === 6 ? ", and the four best third-placed sides" : ""}.
            </div>
            <div className="mt-3 space-y-1 text-left">
              {g.matches.filter(m => m.home === nation || m.away === nation).map(m => (
                <div key={`${m.md}`} className="flex items-center justify-between text-[12px] font-bold text-white/85">
                  <span className="text-[10px] uppercase text-white/55">Match {m.md}</span>
                  <span>{m.home} {m.hs !== undefined ? `${m.hs}–${m.as}` : "v"} {m.away}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {inKo && mode === "progress" && (
          <div data-tournament-ko className="mt-6 w-full space-y-2 text-left">
            {state.ko.map(round => {
              const tie = round.ties.find(t => t.home === nation || t.away === nation);
              const w = tie ? tieWinner(tie) : null;
              return (
                <div key={round.name} className="flex items-center justify-between border-b border-white/10 pb-1.5 text-[13px] font-bold">
                  <span className="text-[10px] font-black uppercase text-white/60">{round.name}</span>
                  {tie ? (
                    <span className={w === nation ? "text-emerald-300" : w ? "text-rose-300" : "text-white"}>
                      {tie.home} {tie.hs !== undefined ? `${tie.hs}–${tie.as}` : "v"} {tie.away}
                      {tie.pens ? ` (${tie.pens.home}–${tie.pens.away} pens)` : ""}
                    </span>
                  ) : <span className="text-white/50">—</span>}
                </div>
              );
            })}
          </div>
        )}

        {winner && (
          <div data-tournament-winner className="mt-5 w-full border-y border-white/10 py-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-white/70">{competition} winners</div>
            <div className="mt-1 flex items-center justify-center gap-2 text-[18px] font-black text-amber-200">🏆 <Flag name={winner} />{winner}</div>
          </div>
        )}

        <div className="mt-8 w-full" data-tournament-continue>
          <PressButton variant="gold" size="none" onClick={onContinue} className="w-full rounded-xl py-3 text-[14px] font-black uppercase">
            {mode === "squad" && entered && selected ? "Join up with the squad →" : "Continue →"}
          </PressButton>
        </div>
      </div>
    </div>
  );
}

function Flag({ name }: { name: string }) {
  return <NationFlag nation={name} width={18} rounded={2} />;
}
