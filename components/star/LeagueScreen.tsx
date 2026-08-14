"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { sortLeague } from "@/lib/star/season";
import { roundsFor, nationOf, internationalCallUp } from "@/lib/star/competitions";
import { exitRound } from "@/lib/star/cups";
import { STAR_EDITION_LABEL } from "@/lib/star/edition";
import { goldenBootRace, assistRace } from "@/lib/star/recognition";

interface Props {
  career: CareerState;
  /** Pull the squads down from the database again. See page.tsx. */
  onRefreshSquads?: () => void;
  refreshing?: boolean;
}

export default function LeagueScreen({ career, onRefreshSquads, refreshing }: Props) {
  /** Whose fixture this is — your club, or your country. */
  const sideFor = (f: { kind?: string }) =>
    f.kind === "international" ? nationOf(career) : career.player.club;

  const [view, setView] = useState<"table" | "results" | "fixtures" | "cups" | "awards" | "squad">("table");
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
      <div className="grid grid-cols-6 gap-1 mb-2">
        {(["table", "results", "fixtures", "cups", "awards", "squad"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`py-1.5 rounded-t-lg font-black text-[9px] uppercase transition ${view === v ? "bg-yellow-500 text-white" : "bg-gray-700 text-white/85"}`}
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
                {(r.hg?.length || r.ag?.length) ? (
                  <>
                    <div className="col-span-3 mt-0.5 grid grid-cols-2 gap-2 text-[9px] font-bold leading-tight text-white/70">
                      <div className="space-y-0.5 text-right">
                        {(r.hg ?? []).map((g, k) => <div key={k}>{g.s} {g.m}&#39;</div>)}
                      </div>
                      <div className="space-y-0.5 text-left">
                        {(r.ag ?? []).map((g, k) => <div key={k}>{g.s} {g.m}&#39;</div>)}
                      </div>
                    </div>
                  </>
                ) : null}
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

      {view === "awards" && (
        <div className="grid gap-2">
          {/* ── Player of the Month ──
              Newest first, because the one you want is the one just given. */}
          <div className="rounded-lg border border-gray-600 bg-gray-700 overflow-hidden">
            <div className="bg-gray-800 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
              Player of the Month
            </div>
            {(career.potm ?? []).filter(a => a.season === career.season).length === 0 && (
              <div className="px-2 py-2 text-[11px] font-bold text-white/70">
                Nothing awarded yet — the first one is given at the end of August.
              </div>
            )}
            {[...(career.potm ?? [])]
              .filter(a => a.season === career.season)
              .sort((a, b) => b.month - a.month)
              .map((a) => (
                <div key={`${a.season}-${a.month}`} className="border-b border-black/25 px-2 py-1.5 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/70">{a.monthName}</span>
                    {a.isYou
                      ? <span className="text-[10px] font-black text-amber-300">YOU WON IT</span>
                      : a.yourPlace
                        ? <span className="text-[10px] font-bold text-white/70">You were {a.yourPlace}{["st","nd","rd"][a.yourPlace-1] ?? "th"}</span>
                        : <span className="text-[10px] font-bold text-white/50">Not shortlisted</span>}
                  </div>
                  <div className={`text-xs font-black ${a.isYou ? "text-amber-300" : "text-white"}`}>
                    {a.winner} <span className="font-bold text-white/70">· {a.club}</span>
                  </div>
                  <div className="text-[10px] font-bold text-white/60">
                    {a.goals}G {a.assists}A · shortlist: {a.nominees.map(n => n.name).join(", ")}
                  </div>
                </div>
              ))}
          </div>

          {/* Both charts are a COUNT — every league goal belongs to a named
              player. Cup goals stay out of them. See recognition.goldenBootRace. */}
          {([["Golden Boot", goldenBootRace(career)], ["Assist King", assistRace(career)]] as const).map(([title, race]) => (
            <div key={title} className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
              <div className="bg-gray-800 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 border-b border-black/50">
                {title}
              </div>
              {race.slice(0, 6).map((sc, i) => (
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
              {race.every(r => r.goals === 0) && (
                <div className="px-2 py-2 text-[11px] font-bold text-white/70">Nobody has scored yet.</div>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "cups" && (
        <div className="space-y-2">
          {/* ── The two real ones: a hat, a draw, and every tie in the country ── */}
          {(career.cupState ?? []).map((cup) => {
            const round = cup.rounds[cup.rounds.length - 1];
            const you = career.player.club;
            const out = exitRound(cup, you);
            return (
              <div key={cup.competition} className={`rounded-lg border p-2 ${
                cup.winner === you ? "border-amber-400 bg-amber-500/15"
                  : out ? "border-gray-600 bg-gray-800" : "border-emerald-600 bg-emerald-600/15"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-black text-white">{cup.competition}</span>
                  <span className="text-[10px] font-bold text-white/80">
                    {cup.winner === you ? "WON IT"
                      : cup.winner ? `${cup.winner} won it`
                      : out ? `Out — ${out}`
                      : round?.name}
                  </span>
                </div>
                {round && (
                  <div className="mt-1.5 space-y-0.5">
                    {round.ties.map((t) => {
                      const yours = t.home === you || t.away === you;
                      const done = t.hs !== undefined;
                      return (
                        <div
                          key={`${t.home}-${t.away}`}
                          className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            yours ? "bg-emerald-600 text-white" : "text-white/85"}`}
                        >
                          <span className="truncate text-right">{t.home}</span>
                          <span className="rounded bg-black/40 px-1 font-black tabular-nums">
                            {done ? `${t.hs}-${t.as}` : "v"}
                          </span>
                          <span className="truncate">{t.away}</span>
                          {t.pens && (
                            <span className="col-span-3 text-center text-[9px] font-bold text-amber-300">
                              {t.pens.home}-{t.pens.away} on penalties
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {(career.cups ?? []).length === 0 && (career.cupState ?? []).length === 0 && (
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

      {view === "squad" && onRefreshSquads && (
        <div className="mb-2 rounded-lg border border-gray-600 bg-gray-800 p-2">
          <button
            onClick={onRefreshSquads}
            disabled={refreshing}
            className="w-full rounded bg-emerald-600 py-1.5 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {refreshing ? "Fetching…" : "Update squads from the database"}
          </button>
          <p className="mt-1 text-[10px] font-bold leading-tight text-white/60">
            Your career holds the squads as they were when it started. Press this after editing
            {" "}{STAR_EDITION_LABEL} to bring in new ratings and transfers. Goals and assists are kept.
          </p>
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
