"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { sortLeague } from "@/lib/star/season";
import { roundsFor, nationOf, internationalCallUp } from "@/lib/star/competitions";
import { goldenBootRace } from "@/lib/star/recognition";

interface Props {
  career: CareerState;
}

export default function LeagueScreen({ career }: Props) {
  /** Whose fixture this is — your club, or your country. */
  const sideFor = (f: { kind?: string }) =>
    f.kind === "international" ? nationOf(career) : career.player.club;

  const [view, setView] = useState<"table" | "results" | "fixtures" | "cups" | "squad">("table");
  const sorted = sortLeague(career.league);
  const squad = career.squad ?? [];

  // ── The round, not just the table it produced ──
  //
  // Every league week is ten games and the game only ever showed you one of
  // them. `career.results` is the whole division's week, yours included.
  const results = career.results ?? [];
  const weeksPlayed = Array.from(new Set(results.map(r => r.week))).sort((a, b) => a - b);
  const [weekIdx, setWeekIdx] = useState<number | null>(null);
  const shownWeek = weekIdx ?? weeksPlayed[weeksPlayed.length - 1] ?? 0;
  const round = results.filter(r => r.week === shownWeek)
    .sort((a, b) => Number(b.home === career.player.club || b.away === career.player.club)
      - Number(a.home === career.player.club || a.away === career.player.club));
  const canGo = (d: number) => weeksPlayed.includes(shownWeek + d);

  return (
    <div className="mt-2">
      <div className="grid grid-cols-5 gap-1 mb-2">
        {(["table", "results", "fixtures", "cups", "squad"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`py-1.5 rounded-t-lg font-black text-[10px] uppercase transition ${view === v ? "bg-yellow-500 text-white" : "bg-gray-700 text-white/85"}`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "results" && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          <div className="flex items-center gap-2 bg-gray-800 px-2 py-1.5 border-b border-black/50">
            <button
              onClick={() => setWeekIdx(shownWeek - 1)}
              disabled={!canGo(-1)}
              aria-label="Previous gameweek"
              className="grid h-6 w-6 place-items-center rounded bg-white/10 text-xs font-black text-white disabled:opacity-30"
            >
              ←
            </button>
            <div className="flex-1 text-center text-[10px] font-black uppercase tracking-widest text-amber-300">
              {round.length > 0 ? `Matchweek ${shownWeek}` : "No results yet"}
            </div>
            <button
              onClick={() => setWeekIdx(shownWeek + 1)}
              disabled={!canGo(1)}
              aria-label="Next gameweek"
              className="grid h-6 w-6 place-items-center rounded bg-white/10 text-xs font-black text-white disabled:opacity-30"
            >
              →
            </button>
          </div>

          {round.length === 0 && (
            <div className="p-3 text-xs font-bold text-gray-200">
              Play a league match and this week&apos;s ten results will appear here.
            </div>
          )}

          {round.map((r, i) => {
            const yours = r.home === career.player.club || r.away === career.player.club;
            return (
              <div
                key={`${r.home}-${r.away}`}
                className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 py-1.5 text-[11px] font-bold ${
                  yours ? "bg-emerald-600 text-white"
                    : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"}`}
              >
                <span className={`truncate text-right ${r.hs > r.as ? "font-black" : ""}`}>{r.home}</span>
                <span className="rounded bg-black/35 px-1.5 py-0.5 font-black tabular-nums">
                  {r.hs}-{r.as}
                </span>
                <span className={`truncate ${r.as > r.hs ? "font-black" : ""}`}>{r.away}</span>
              </div>
            );
          })}
        </div>
      )}

      {view === "table" && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          <div className="grid grid-cols-[24px_1fr_28px_28px_28px_28px_32px] text-[10px] font-black text-white bg-gray-800 py-1.5 px-2 border-b border-black/50 gap-1">
            <div className="text-center">#</div>
            <div>Name</div>
            <div className="text-center">P</div>
            <div className="text-center">W</div>
            <div className="text-center">D</div>
            <div className="text-center">L</div>
            <div className="text-center">Pts</div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {sorted.map((t, i) => (
              <div
                key={t.name}
                className={`grid grid-cols-[24px_1fr_28px_28px_28px_28px_32px] text-[10px] font-bold py-1.5 px-2 gap-1 items-center border-b border-black/20 ${
                  t.name === career.player.club ? "bg-emerald-600 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
                }`}
              >
                <div className="text-center font-black">{i + 1}</div>
                <div className="truncate">{t.name}</div>
                <div className="text-center">{t.played}</div>
                <div className="text-center">{t.won}</div>
                <div className="text-center">{t.drawn}</div>
                <div className="text-center">{t.lost}</div>
                <div className="text-center font-black">{t.points}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "fixtures" && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md max-h-[460px] overflow-y-auto">
          {career.fixtures.map((f, i) => (
            <div
              key={i}
              className={`grid grid-cols-[36px_1fr_32px_32px_1fr] items-center py-2 px-2 gap-1 text-xs font-bold ${
                f.week === career.week ? "bg-emerald-500 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
              }`}
            >
              <div className="text-center text-[10px] font-black">
                W{f.week}
                {f.kind && f.kind !== "league" && (
                  <div className={`text-[8px] font-black uppercase leading-none mt-0.5 ${
                    f.kind === "international" ? "text-sky-300" : "text-violet-300"}`}
                  >
                    {f.kind === "cup" ? "CUP" : f.kind === "europe" ? "EUR" : "INT"}
                  </div>
                )}
              </div>
              <div className={`text-right ${f.home ? "font-black" : ""}`}>{f.home ? sideFor(f) : f.opponent}</div>
              <div className="text-center font-black">
                {f.played ? f.homeScore : "-"}
              </div>
              <div className="text-center font-black">
                {f.played ? f.awayScore : "-"}
              </div>
              <div className={`text-left ${!f.home ? "font-black" : ""}`}>{f.home ? f.opponent : sideFor(f)}</div>
            </div>
          ))}
        </div>
      )}

      {view === "table" && (
        <div className="mt-2 bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          <div className="bg-gray-800 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 border-b border-black/50">
            Golden Boot
          </div>
          {goldenBootRace(career).slice(0, 6).map((sc, i) => (
            <div
              key={sc.name + sc.club}
              className={`flex items-center gap-2 px-2 py-1.5 text-xs font-bold ${
                sc.isYou ? "bg-emerald-600 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"}`}
            >
              <span className="w-4 text-center text-[10px] font-black">{i + 1}</span>
              <span className="flex-1 truncate">{sc.name}</span>
              <span className="truncate text-[10px] text-gray-200 max-w-[38%]">{sc.club}</span>
              <span className="w-6 text-right font-black tabular-nums">{sc.goals}</span>
            </div>
          ))}
        </div>
      )}

      {view === "cups" && (
        <div className="space-y-2">
          {(career.cups ?? []).length === 0 && (
            <div className="bg-gray-700 rounded-lg border border-gray-600 p-3 text-xs text-gray-200">
              No knockout football this season. The domestic cup runs every year;
              Europe is earned by where you finish, and the national side by how
              well known you are.
            </div>
          )}
          {(career.cups ?? []).map((run) => {
            const rounds = roundsFor(run.competition);
            return (
              <div key={run.competition} className={`rounded-lg border p-3 ${
                run.won ? "border-amber-400 bg-amber-500/15"
                  : run.eliminated ? "border-gray-600 bg-gray-800" : "border-emerald-600 bg-emerald-600/15"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">{run.competition}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    run.won ? "text-amber-300" : run.eliminated ? "text-white/85" : "text-emerald-300"}`}
                  >
                    {run.won ? "Winners 🏆" : run.eliminated ? "Eliminated" : rounds[run.roundIndex]}
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  {rounds.map((r, i) => (
                    <div
                      key={r}
                      title={r}
                      className={`h-1.5 flex-1 rounded-full ${
                        run.won || i < run.roundIndex ? "bg-emerald-400"
                          : i === run.roundIndex && !run.eliminated ? "bg-white/70" : "bg-white/15"}`}
                    />
                  ))}
                </div>
                <div className="mt-1 text-[10px] text-gray-200">{rounds.join(" · ")}</div>
              </div>
            );
          })}

          <div className="bg-gray-700 rounded-lg border border-gray-600 p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-sky-300">{nationOf(career)}</div>
            <div className="mt-1 text-xs text-white">
              {(career.caps ?? 0)} cap{(career.caps ?? 0) === 1 ? "" : "s"} · {(career.internationalGoals ?? 0)} goal{(career.internationalGoals ?? 0) === 1 ? "" : "s"}
            </div>
            {(career.caps ?? 0) === 0 && (
              <div className="mt-1 text-[10px] text-white/85">
                {internationalCallUp(career)
                  ? "You are in the squad — a tournament comes round every other season."
                  : "Not in the squad yet. Reputation is what gets you picked."}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "squad" && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          {/* Header */}
          <div className="grid grid-cols-[26px_1fr_30px_36px_26px_26px] text-[10px] font-black text-white bg-gray-800 py-1.5 px-2 border-b border-black/50 gap-1 items-center">
            <div />
            <div>Name</div>
            <div className="text-center">OVR</div>
            <div className="text-center">Pos</div>
            <div className="text-center text-yellow-300">G</div>
            <div className="text-center text-blue-300">A</div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {/* User row first — reads from seasonStats */}
            <div className="grid grid-cols-[26px_1fr_30px_36px_26px_26px] text-[10px] font-bold py-1.5 px-2 gap-1 items-center border-b border-black/20 bg-emerald-700 text-white">
              <div className="grid h-[22px] w-[22px] place-items-center rounded-full bg-white/20 text-[9px] font-black">
                {career.squadNumber ?? "★"}
              </div>
              <div className="truncate font-black">{career.player.firstName} {career.player.lastName} ★</div>
              <div className="text-center text-emerald-200">{Math.round(career.starRating * 18 + 10)}</div>
              <div className="text-center text-emerald-200">{career.player.position}</div>
              <div className="text-center font-black text-yellow-300">{career.seasonStats.goals}</div>
              <div className="text-center font-black text-blue-300">{career.seasonStats.assists}</div>
            </div>
            {/* Squad sorted by goals+assists descending */}
            {[...squad]
              .sort((a, b) => (b.seasonGoals + b.seasonAssists) - (a.seasonGoals + a.seasonAssists))
              .map((p, i) => (
                <div
                  key={p.id}
                  className={`grid grid-cols-[26px_1fr_30px_36px_26px_26px] text-[10px] font-bold py-1.5 px-2 gap-1 items-center border-b border-black/20 ${
                    i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
                  }`}
                >
                  {/* A real team-mate has a face. A generated one gets his
                      initials — the standing rule is a silhouette only when
                      there is no image, never a stock photo of somebody else. */}
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="h-[22px] w-[22px] rounded-full bg-white/10 object-cover"
                    />
                  ) : (
                    <div className="grid h-[22px] w-[22px] place-items-center rounded-full bg-white/10 text-[8px] font-black text-white/80">
                      {p.shortName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="truncate">{p.name}</div>
                  <div className="text-center font-black text-white/85">{p.overall ?? "—"}</div>
                  <div className="text-center text-white/75">{p.position}</div>
                  <div className="text-center">
                    {p.seasonGoals > 0
                      ? <span className="text-yellow-300 font-black">{p.seasonGoals}</span>
                      : <span className="text-white/60">0</span>}
                  </div>
                  <div className="text-center">
                    {p.seasonAssists > 0
                      ? <span className="text-blue-300 font-black">{p.seasonAssists}</span>
                      : <span className="text-white/60">0</span>}
                  </div>
                </div>
              ))}
          </div>
          {/* Career totals footer for top scorers */}
          {squad.some(p => p.careerGoals > 0 || p.careerAssists > 0) && (
            <div className="bg-gray-800 border-t border-black/30 px-2 py-1.5">
              <div className="text-[9px] font-black text-white/75 uppercase tracking-widest mb-1">Career Top Scorers</div>
              {[...squad]
                .sort((a, b) => (b.careerGoals + b.careerAssists) - (a.careerGoals + a.careerAssists))
                .slice(0, 3)
                .filter(p => p.careerGoals > 0 || p.careerAssists > 0)
                .map(p => (
                  <div key={p.id} className="flex items-center gap-1 text-[9px] text-white/85 mb-0.5">
                    <span className="font-black text-white truncate flex-1">{p.shortName}</span>
                    <span className="text-yellow-400 font-black">{p.careerGoals}G</span>
                    <span className="text-blue-400 font-black">{p.careerAssists}A</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
