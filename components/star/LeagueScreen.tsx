"use client";
import { useState } from "react";
import { fixtureDateLabel, fixtureTimestamp, isPostSeason, divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { displayOverall } from "@/lib/star/rating";
import type { CareerState } from "@/lib/star/types";
import { sortLeague } from "@/lib/star/season";
import { roundsFor, nationOf, internationalCallUp, nextFixtureFor } from "@/lib/star/competitions";
import { exitRound } from "@/lib/star/cups";
import { goldenBootRace, assistRace } from "@/lib/star/recognition";
import { groupedGoalLines } from "@/lib/star/media/grammar";
import { SILHOUETTE_SRC } from "@/lib/silhouette";
import ImageWithFallback from "@/components/ImageWithFallback";

interface Props {
  career: CareerState;
}

export default function LeagueScreen({ career }: Props) {
  /** Whose fixture this is — your club, or your country. */
  const sideFor = (f: { kind?: string }) =>
    f.kind === "international" ? nationOf(career) : career.player.club;

  // "transfers" moved to the Media screen — see TransfersPanel.tsx, and
  // "cups" folded into "table" — see the competition switcher below. Five
  // tabs now, not seven.
  const [view, setView] = useState<"table" | "results" | "fixtures" | "awards" | "squad">("table");
  const [compIndex, setCompIndex] = useState(0);
  const sorted = sortLeague(career.league);
  const squad = career.squad ?? [];

  // ── European qualification colours ──
  const cl = Math.round(sorted.length * 0.25);
  const elBottom = cl + 2;
  const n = sorted.length;
  const thisSeason = (career.trophies ?? []).filter(t => t.season === career.season);
  const playerWonCup = thisSeason.some(t => t.competition === "FA Cup" || t.competition === "League Cup");
  const playerPos = sorted.findIndex(x => x.name === career.player.club) + 1;

  // Always a 2px left border, on every row AND the header — only the
  // COLOUR is conditional now, never the border's own presence. Reported
  // directly: a row with a colour (over half the table, early season —
  // champion, both European zones, the bottom three) sat its name and
  // numbers 2px further right than an uncoloured row or the header itself,
  // since a border a row alone gets pushes that row's own padding inward
  // (border sits inside the box in border-box sizing). Giving everything
  // the same 2px transparent border by default is what makes the columns
  // actually line up regardless of which rows happen to be coloured.
  const euroClass = (pos: number, isPlayer: boolean): string => {
    if (isPlayer && playerWonCup && pos > elBottom) return "border-l-2 border-l-orange-500";
    if (pos === 1) return "border-l-2 border-l-amber-400";
    if (pos <= cl) return "border-l-2 border-l-blue-500";
    if (pos <= elBottom) return "border-l-2 border-l-orange-500";
    if (pos > n - 3) return "border-l-2 border-l-red-500";
    return "border-l-2 border-l-transparent";
  };

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
        {(["table", "results", "fixtures", "awards", "squad"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`py-1.5 rounded-t-lg font-black text-[9px] uppercase transition ${view === v ? "bg-yellow-500 text-white" : "bg-gray-700 text-white"}`}
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
            <div className="flex-1 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                {round.length > 0 ? `Matchweek ${shownWeek}` : "No results yet"}
              </div>
              {round.length > 0 && (
                <div className="text-[9px] font-bold text-white">
                  {fixtureDateLabel(career.player.startYear, career.season, shownWeek, "league", divisionOf(career))}
                </div>
              )}
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
            <div className="p-3 text-xs font-bold text-white">
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
                    <div className="col-span-3 mt-0.5 grid grid-cols-2 gap-2 text-[9px] font-bold leading-tight text-white">
                      <div className="space-y-0.5 text-right">
                        {groupedGoalLines(r.hg ?? [], g => g.s, g => g.m).map(({ scorer, minutes }) => (
                          <div key={scorer}>{scorer} {minutes.map(m => `${m}'`).join(", ")}</div>
                        ))}
                      </div>
                      <div className="space-y-0.5 text-left">
                        {groupedGoalLines(r.ag ?? [], g => g.s, g => g.m).map(({ scorer, minutes }) => (
                          <div key={scorer}>{scorer} {minutes.map(m => `${m}'`).join(", ")}</div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {view === "table" && (() => {
        /**
         * ONE tab for whichever competition you're actually looking at,
         * switched between rather than split across a separate "Cups" tab
         * — requested directly. A league table and a cup bracket are
         * genuinely different shapes (a knockout has no table at all), so
         * this switches the whole CONTENT per competition rather than
         * pretending they all fit one layout; what doesn't change is the
         * data each one reads — this is the exact same league table, the
         * exact same domestic-cup bracket (cupState) and the exact same
         * European/international summaries the old separate tabs read,
         * just reachable from one place now.
         */
        const you = career.player.club;
        const competitions: { key: string; label: string; content: React.ReactNode }[] = [
          {
            key: "league",
            label: leagueNameFor(divisionOf(career)),
            content: (
              <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
                <div className="grid grid-cols-[24px_1fr_28px_28px_28px_28px_32px] border-l-2 border-l-transparent text-[10px] font-black text-white bg-gray-800 py-1.5 px-2 border-b border-black/50 gap-1">
                  <div className="text-center">#</div>
                  <div>Name</div>
                  <div className="text-center">P</div>
                  <div className="text-center">W</div>
                  <div className="text-center">D</div>
                  <div className="text-center">L</div>
                  <div className="text-center">Pts</div>
                </div>
                {/* No inner scroll here — DashboardShell's own content area
                    is already the one scrollable region on this whole
                    page. A second, nested scrollbar here doesn't just
                    double up on scrolling; on a platform whose scrollbar
                    reserves real width (most desktop browsers — not the
                    overlay kind phones and Macs use), it shrinks this
                    list's own rows without touching the header above them,
                    which is what actually caused "the columns don't line
                    up" — confirmed directly: it lined up correctly on a
                    phone, which never had this scrollbar to begin with. */}
                <div>
                  {sorted.map((t, i) => {
                    const pos = i + 1;
                    const isPlayer = t.name === you;
                    return (
                    <div
                      key={t.name}
                      className={`grid grid-cols-[24px_1fr_28px_28px_28px_28px_32px] text-[10px] font-bold py-1.5 px-2 gap-1 items-center border-b border-black/20 ${euroClass(pos, isPlayer)} ${
                        isPlayer ? "bg-emerald-600 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
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
                    );
                  })}
                </div>
              </div>
            ),
          },
          // ── The two domestic cups: a hat, a draw, and every tie in the
          // country, exactly as the old Cups tab showed them. ──
          ...(career.cupState ?? []).map((cup) => {
            const round = cup.rounds[cup.rounds.length - 1];
            const out = exitRound(cup, you);
            return {
              key: `domestic-${cup.competition}`,
              label: cup.competition,
              content: (
                <div className={`rounded-lg border p-2 ${
                  cup.winner === you ? "border-amber-400 bg-amber-500/15"
                    : out ? "border-gray-600 bg-gray-800" : "border-emerald-600 bg-emerald-600/15"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-black text-white">{cup.competition}</span>
                    <span className="text-[10px] font-bold text-white">
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
              ),
            };
          }),
          // ── Europe (and anything else career.cups tracks) — a progress
          // bar rather than a full bracket, exactly as the old Cups tab
          // showed it; there is no live tie-by-tie European view yet. ──
          ...(career.cups ?? []).map((run) => {
            const rounds = roundsFor(run.competition);
            return {
              key: `run-${run.competition}`,
              label: run.competition,
              content: (
                <div className={`rounded-lg border p-3 ${
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
                  <div className="mt-1 text-[10px] text-white">{rounds.join(" · ")}</div>
                </div>
              ),
            };
          }),
          {
            key: "international",
            label: nationOf(career),
            content: (
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
            ),
          },
        ];

        const active = competitions[Math.min(compIndex, competitions.length - 1)];
        return (
          <div>
            {/* The switcher — a small gap above the table itself, enough
                room for one button naming whichever competition is
                showing. Tapping it cycles to the next; requested directly,
                in place of a separate Cups tab. */}
            <div className="mb-1.5 flex justify-end">
              <button
                onClick={() => setCompIndex(i => (i + 1) % competitions.length)}
                className="rounded-full border border-gray-600 bg-gray-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-gray-700"
              >
                {active.label} ›
              </button>
            </div>
            {active.content}
          </div>
        );
      })()}

      {view === "fixtures" && (
        // Same reasoning as the Table tab above — no inner scroll cap; the
        // page's own scroll region already handles a full season's list.
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          {/* A cup round is always APPENDED to career.fixtures the moment its
              draw lands (see careerFlow.ts) — never re-inserted among the
              league weeks it's actually sandwiched between — so the raw
              array reads "every league week, then every cup tie," even
              though a cup tie's own week number already says exactly where
              it belongs. Sorted here, not stored sorted: nextFixtureFor
              (competitions.ts) already had to solve this same problem by
              scanning rather than trusting array order, for the same
              reason — the array itself is genuinely out of order after a
              mid-season cup draw. Ordered by the real date each fixture is
              played on (fixtureTimestamp), not by week number with a
              competition-priority tiebreak — that used to show a European
              tie played on the Tuesday BELOW a domestic cup tie played on
              the Wednesday after it, backwards from the order they're
              actually played in. */}
          {(() => {
            // The one row that should read as "next", not every row that
            // happens to share a week number with `career.week` — which is
            // a count of matches PLAYED (see calendar.ts's own note on it),
            // not a fixture's real week, and matches several fixtures at
            // once whenever more than one game shares a week (a cup tie
            // alongside its league match, say). Reported directly, with a
            // screenshot: a cup tie still unplayed sat ABOVE the row
            // actually highlighted, and every fixture in week 5 was about
            // to light up together once the career reached week 5. The
            // SAME fixture object nextFixtureFor already resolves this
            // correctly for (used to decide what "Next:" reads elsewhere)
            // is compared by reference below instead — sort doesn't clone
            // the fixture objects, so `f === upNext` matches exactly one row.
            const upNext = nextFixtureFor(career);
            return [...career.fixtures]
              .sort((a, b) => fixtureTimestamp(career.player.startYear, career.season, a.week, a.kind, divisionOf(career))
                - fixtureTimestamp(career.player.startYear, career.season, b.week, b.kind, divisionOf(career)))
              .map((f, i) => {
              const yourScore = f.played ? (f.home ? f.homeScore : f.awayScore) : undefined;
              const theirScore = f.played ? (f.home ? f.awayScore : f.homeScore) : undefined;
              const resultColor = yourScore === undefined || theirScore === undefined ? ""
                : yourScore > theirScore ? "text-emerald-400"
                  : yourScore === theirScore ? "text-yellow-400" : "text-red-400";
              return (
              <div
                key={i}
                className={`grid grid-cols-[58px_1fr_60px_1fr] items-center py-2 px-2 gap-1 text-xs font-bold ${
                  f === upNext ? "bg-emerald-500 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
                }`}
              >
                {/* The week, not the date, on top now — reported directly:
                    every other screen and message in the game counts in
                    weeks, so that's the number that should read first and
                    boldest here too. The actual date stays underneath it. */}
                <div className="text-center leading-none">
                  <div className="whitespace-nowrap text-[11px] font-black text-white">
                    {isPostSeason(f.week, divisionOf(career)) ? "FINAL" : f.week === 0 ? "PRE" : `W${f.week}`}
                  </div>
                  <div className="mt-0.5 whitespace-nowrap text-[8px] font-bold text-white/60">
                    {fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, divisionOf(career))}
                  </div>
                  {f.kind && f.kind !== "league" && (
                    <div className={`text-[8px] font-black uppercase leading-none mt-0.5 ${
                      f.kind === "international" ? "text-sky-300" : "text-violet-300"}`}
                    >
                      {f.kind === "cup" ? "CUP" : f.kind === "europe" ? "EUR" : "INT"}
                    </div>
                  )}
                </div>
                <div className={`text-right ${f.home ? "font-black" : ""}`}>{f.home ? sideFor(f) : f.opponent}</div>
                {/* A dash between the two scores, and the whole result in
                    YOUR result's colour — green a win, yellow a draw, red a
                    loss — rather than a neutral white that read the same
                    whichever way the match actually went. */}
                <div className={`text-center font-black tabular-nums ${resultColor}`}>
                  {f.played ? `${f.homeScore} - ${f.awayScore}` : "-"}
                </div>
                <div className={`text-left ${!f.home ? "font-black" : ""}`}>
                  {f.home ? f.opponent : sideFor(f)}
                  {f.round && (
                    <div className="truncate text-[8px] font-bold uppercase leading-none text-white/60">
                      {f.round}
                    </div>
                  )}
                </div>
              </div>
              );
            });
          })()}
        </div>
      )}

      {view === "awards" && (
        <div className="grid gap-2">
          {/* Golden Boot and Assist King first, Player of the Month last —
              requested directly. Both charts are a COUNT — every league
              goal belongs to a named player. Cup goals stay out of them.
              See recognition.goldenBootRace. Top five now, not six. */}
          {([["Golden Boot", goldenBootRace(career)], ["Assist King", assistRace(career)]] as const).map(([title, race]) => (
            <div key={title} className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
              <div className="bg-gray-800 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 border-b border-black/50">
                {title}
              </div>
              {race.slice(0, 5).map((sc, i) => (
                <div
                  key={sc.name + sc.club}
                  className={`flex items-center gap-2 px-2 py-1.5 text-xs font-bold ${
                    sc.isYou ? "bg-emerald-600 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"}`}
                >
                  <span className="w-4 text-center text-[10px] font-black">{i + 1}</span>
                  <span className="flex-1 truncate">{sc.name}</span>
                  <span className="truncate text-[10px] text-white max-w-[38%]">{sc.club}</span>
                  <span className="w-6 text-right font-black tabular-nums">{sc.goals}</span>
                </div>
              ))}
              {race.every(r => r.goals === 0) && (
                <div className="px-2 py-2 text-[11px] font-bold text-white">Nobody has scored yet.</div>
              )}
            </div>
          ))}

          {/* ── Player of the Month ──
              Newest first, because the one you want is the one just given. */}
          <div className="rounded-lg border border-gray-600 bg-gray-700 overflow-hidden">
            <div className="bg-gray-800 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
              Player of the Month
            </div>
            {(career.potm ?? []).filter(a => a.season === career.season).length === 0 && (
              <div className="px-2 py-2 text-[11px] font-bold text-white">
                {/* This used to say "the first one is given at the end of
                    August" whatever month it actually was, which read as a bug
                    to anybody seeing it in February — and usually WAS one. */}
                Nothing awarded yet. The first goes to whoever has the best
                August, once that month&apos;s last league game is played.
              </div>
            )}
            {[...(career.potm ?? [])]
              .filter(a => a.season === career.season)
              .sort((a, b) => b.month - a.month)
              .map((a) => (
                <div key={`${a.season}-${a.month}`} className="border-b border-black/25 px-2 py-1.5 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white">{a.monthName}</span>
                    {a.isYou
                      ? <span className="text-[10px] font-black text-amber-300">YOU WON IT</span>
                      : a.yourPlace
                        ? <span className="text-[10px] font-bold text-white">You were {a.yourPlace}{["st","nd","rd"][a.yourPlace-1] ?? "th"}</span>
                        : <span className="text-[10px] font-bold text-white">Not shortlisted</span>}
                  </div>
                  <div className={`text-xs font-black ${a.isYou ? "text-amber-300" : "text-white"}`}>
                    {a.winner} <span className="font-bold text-white">· {a.club}</span>
                  </div>
                  <div className="text-[10px] font-bold text-white">
                    {a.goals}G {a.assists}A
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* "transfers" moved to the Media screen — see TransfersPanel.tsx, and
          "cups" folded into the Table tab's own competition switcher above. */}

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
          {/* No inner scroll cap here on purpose — see the note on the Table
              tab above. You are one row in this same ranking now too, not
              pinned above it regardless of form: requested directly, sorted
              by goals+assists like everyone else, ties broken by overall
              rating the same way a real squad list would read. */}
          {(() => {
            const you = {
              id: "__you__", isYou: true,
              name: `${career.player.firstName} ${career.player.lastName}`,
              position: career.player.position,
              // The one shared overall formula every screen reads now
              // (rating.ts), not a formula of this screen's own.
              overall: displayOverall(career.starRating),
              seasonGoals: career.seasonStats.goals,
              seasonAssists: career.seasonStats.assists,
              imageUrl: undefined as string | undefined,
            };
            const rows = [you, ...squad.map(p => ({ ...p, isYou: false }))]
              .sort((a, b) => {
                const byGA = (b.seasonGoals + b.seasonAssists) - (a.seasonGoals + a.seasonAssists);
                if (byGA !== 0) return byGA;
                return (b.overall ?? 0) - (a.overall ?? 0);
              });
            return rows.map((p, i) => (
              <div
                key={p.id}
                className={`grid grid-cols-[26px_1fr_30px_36px_26px_26px] text-[10px] font-bold py-1.5 px-2 gap-1 items-center border-b border-black/20 ${
                  p.isYou ? "bg-emerald-700 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
                }`}
              >
                {p.isYou ? (
                  <div className="grid h-[22px] w-[22px] place-items-center rounded-full bg-white/20 text-[9px] font-black">
                    {career.squadNumber ?? "★"}
                  </div>
                ) : (
                  // A real team-mate has a face. Nobody gets a stock photo of
                  // somebody else — the one without an image gets the same
                  // silhouette the Draft uses, not different placeholders
                  // per screen.
                  <ImageWithFallback
                    src={p.imageUrl || SILHOUETTE_SRC}
                    fallbackSrc={SILHOUETTE_SRC}
                    alt=""
                    className="h-[22px] w-[22px] rounded-full bg-white/10 object-cover"
                  />
                )}
                <div className="truncate font-black">{p.name}{p.isYou ? " ★" : ""}</div>
                <div className="text-center font-black text-white">{p.overall ?? "—"}</div>
                <div className="text-center text-white">{p.position}</div>
                <div className="text-center">
                  {p.seasonGoals > 0
                    ? <span className="text-yellow-300 font-black">{p.seasonGoals}</span>
                    : <span className="text-white">0</span>}
                </div>
                <div className="text-center">
                  {p.seasonAssists > 0
                    ? <span className="text-blue-300 font-black">{p.seasonAssists}</span>
                    : <span className="text-white">0</span>}
                </div>
              </div>
            ));
          })()}
          {/* Career totals footer for top scorers */}
          {squad.some(p => p.careerGoals > 0 || p.careerAssists > 0) && (
            <div className="bg-gray-800 border-t border-black/30 px-2 py-1.5">
              <div className="text-[9px] font-black text-white uppercase tracking-widest mb-1">Career Top Scorers</div>
              {[...squad]
                .sort((a, b) => (b.careerGoals + b.careerAssists) - (a.careerGoals + a.careerAssists))
                .slice(0, 3)
                .filter(p => p.careerGoals > 0 || p.careerAssists > 0)
                .map(p => (
                  <div key={p.id} className="flex items-center gap-1 text-[9px] text-white mb-0.5">
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
