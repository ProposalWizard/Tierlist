"use client";

/**
 * THE MATCH WEEK PAGE'S OWN VIEWS: Fixtures (with the live-score bells) and
 * Scout. Both were pages of the match-day screen that the line-up animation
 * replaced (v0.23, W4); Harry wanted them back, with the league on the same
 * page (P90: "we could do this fixture page with the league, and you have a
 * bell"). Flat and square (the v0.23 look), no sentences: a bell is a bell.
 */
import { useMemo, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import { kitsOf } from "@/lib/star/kits";
import { competitionAbbrev } from "@/lib/star/competitions";
import { fixtureDateLabel, divisionOf, fixtureTimestamp } from "@/lib/star/calendar";
import { liveWeekFor } from "@/lib/star/liveScores";
import { followedClubs, isFixtureFollowed, toggleFollowedFixture } from "@/lib/star/matchDayPrefs";
import { scoutReportFor, type ScoutReport } from "@/lib/star/scoutReport";
import { faceOrFake } from "@/lib/star/fakeFaces";
import { shortNameOf } from "@/lib/star/realSquad";
import ClubBadge from "./ClubBadge";
import ImageWithFallback from "@/components/ImageWithFallback";
import ScoutReportCard from "./ScoutReport";
import { short } from "./HomeHub";
import { EmptySlots } from "./ui";

const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");

/** A section label with a chalk line under it. */
function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1 mt-3 flex items-end justify-between border-b border-white/25 pb-0.5 first:mt-0">
      <span className="text-[13px] font-black uppercase tracking-[0.14em] text-amber-300">{children}</span>
      {right}
    </div>
  );
}

// ── Fixtures ────────────────────────────────────────────────────────────────

export function FixturesPane({ career, next }: { career: CareerState; next: Fixture | null }) {
  const div = divisionOf(career);
  const ts = (f: Fixture) => fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, div);
  const upcoming = career.fixtures.filter((f) => !f.played).sort((a, b) => ts(a) - ts(b)).slice(0, 6);
  const recent = career.fixtures.filter((f) => f.played && f.homeScore !== undefined).sort((a, b) => ts(b) - ts(a)).slice(0, 4);
  const leagueWeeks = career.fixtures.filter((f) => !f.played && (f.kind ?? "league") === "league").sort((a, b) => ts(a) - ts(b)).slice(0, 5);
  const [weekIdx, setWeekIdx] = useState(0);
  const pick = leagueWeeks[Math.min(weekIdx, Math.max(0, leagueWeeks.length - 1))];
  const [, bump] = useState(0);
  const others = useMemo(() => {
    if (!pick) return [];
    try { return liveWeekFor(career, pick).fixtures; } catch { return []; }
    // The pairings only depend on the week and the division.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick?.week, career.season, career.player.club]);
  const clubTicks = followedClubs();

  if (upcoming.length === 0 && recent.length === 0) return <EmptySlots rows={4} icon="📅" />;

  return (
    <div data-fixtures-pane>
      <Label>Next</Label>
      <div className="space-y-px">
        {upcoming.map((f) => <Row key={`${f.kind ?? "l"}-${f.week}-${f.opponent}`} career={career} f={f} next={f === next} />)}
      </div>

      {recent.length > 0 && (
        <>
          <Label>Results</Label>
          <div className="space-y-px">{recent.map((f) => <Row key={`r-${f.kind ?? "l"}-${f.week}-${f.opponent}`} career={career} f={f} next={false} />)}</div>
        </>
      )}

      {pick && (
        <>
          <Label right={<span className="text-[16px] leading-none">🔔</span>}>Other games</Label>
          <div className="mb-1 flex gap-px">
            {leagueWeeks.map((f, i) => (
              <button
                key={f.week}
                onClick={() => setWeekIdx(i)}
                aria-pressed={f === pick}
                className={`kib-press min-w-0 flex-1 px-1 py-1.5 text-[13px] font-black uppercase leading-none ${f === pick ? "bg-amber-400 text-gray-950" : "bg-black/35 text-white"}`}
                style={{ boxShadow: "inset 0 0 0 1px var(--sk-edge, rgba(255,255,255,.22))" }}
              >
                W{f.week}
              </button>
            ))}
          </div>
          {others.length === 0 ? (
            <EmptySlots rows={2} icon="🔔" />
          ) : (
            <div className="space-y-px">
              {others.map((g) => {
                const key = { season: career.season, week: pick.week, home: g.home, away: g.away };
                const on = isFixtureFollowed(key);
                const ticked = clubTicks.includes(g.home) || clubTicks.includes(g.away);
                return (
                  <div key={`${g.home}-${g.away}`} className="flex items-center gap-2 bg-black/30 px-2 py-1.5">
                    <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                      <div className="flex min-w-0 items-center justify-end gap-1.5">
                        <span className="truncate text-[14px] font-black uppercase text-white">{short(g.home)}</span>
                        <ClubBadge club={g.home} kit={kitsOf(g.home, career.clubKits?.[g.home]).home} size={22} />
                      </div>
                      <span className="text-[11px] font-black text-white/60">v</span>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <ClubBadge club={g.away} kit={kitsOf(g.away, career.clubKits?.[g.away]).home} size={22} />
                        <span className="truncate text-[14px] font-black uppercase text-white">{short(g.away)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { toggleFollowedFixture(key); bump((n) => n + 1); }}
                      aria-pressed={on}
                      aria-label={`${on ? "Stop" : "Get"} live scores for ${g.home} v ${g.away}`}
                      className={`kib-press grid h-8 w-8 shrink-0 place-items-center text-[16px] ${on ? "bg-amber-400 text-gray-950" : ticked ? "bg-white/10 text-amber-200" : "bg-white/[0.07] text-white"}`}
                      style={{ boxShadow: on ? "0 0 12px rgba(251,191,36,.6)" : "inset 0 0 0 1px var(--sk-edge, rgba(255,255,255,.22))" }}
                    >
                      <span className={on || ticked ? "" : "opacity-45 grayscale"}>🔔</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ career, f, next }: { career: CareerState; f: Fixture; next: boolean }) {
  const div = divisionOf(career);
  const league = (f.kind ?? "league") === "league";
  const badge = competitionAbbrev(f, div);
  const badgeCls = league ? "bg-yellow-400/20 text-yellow-200" : f.kind === "international" ? "bg-sky-400/20 text-sky-200" : "bg-violet-400/25 text-violet-200";
  const date = fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, div);
  const played = f.played && f.homeScore !== undefined && f.awayScore !== undefined;
  const us = played ? (f.home ? f.homeScore! : f.awayScore!) : 0, them = played ? (f.home ? f.awayScore! : f.homeScore!) : 0;
  const res = us > them ? "W" : us === them ? "D" : "L";
  const resCls = { W: "bg-emerald-500", D: "bg-gray-500", L: "bg-red-600" }[res];
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 ${next ? "bg-emerald-400/20" : "bg-black/30"}`} style={next ? { boxShadow: "inset 3px 0 0 #34d399" } : undefined}>
      <span className={`w-[44px] shrink-0 truncate px-1 py-0.5 text-center text-[11px] font-black uppercase leading-none ${badgeCls}`}>{badge}</span>
      <span className="w-[62px] shrink-0 whitespace-nowrap text-[12px] font-black uppercase leading-none text-white/80">{date}</span>
      <ClubBadge club={f.opponent} kit={kitsOf(f.opponent, career.clubKits?.[f.opponent]).home} size={22} />
      <span className="min-w-0 flex-1 truncate text-[14px] font-black uppercase text-white">
        {short(f.opponent)} <span className="text-[11px] text-white/55">{f.home ? "H" : "A"}</span>
      </span>
      {played ? (
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-[15px] font-black tabular-nums text-white">{us}-{them}</span>
          <span className={`grid h-[18px] w-[18px] place-items-center text-[12px] font-black text-white ${resCls}`}>{res}</span>
        </span>
      ) : next ? (
        <span className="shrink-0 bg-amber-400 px-1.5 py-[2px] text-[11px] font-black uppercase leading-none text-gray-950">Next</span>
      ) : f.round ? (
        <span className="max-w-[70px] shrink-0 truncate text-[11px] font-black uppercase text-white/55">{f.round}</span>
      ) : null}
    </div>
  );
}

// ── Scout ───────────────────────────────────────────────────────────────────

export function ScoutPane({ career, fixture }: { career: CareerState; fixture: Fixture | null }) {
  const report: ScoutReport | null = useMemo(
    () => { try { return fixture ? scoutReportFor(career, fixture.opponent, fixture.week, fixture) : null; } catch { return null; } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fixture?.opponent, fixture?.week, career.season, career.week],
  );
  if (!fixture || !report) return <EmptySlots rows={3} icon="🔍" />;
  const kit = kitsOf(fixture.opponent, career.clubKits?.[fixture.opponent]).home;
  const five = report.recentResults.slice(-5);
  const key = report.topScorer && report.topScorer.goals > 0 ? { p: report.topScorer, role: "Top scorer" } : report.bestPlayer ? { p: report.bestPlayer, role: "Best player" } : null;
  const where = report.cupRun !== null
    ? (report.table ? `${report.table.position}${ordinal(report.table.position)}` : null)
    : report.table ? `${report.table.position}${ordinal(report.table.position)} of ${report.table.of}` : null;
  const tone = { W: "bg-emerald-500", D: "bg-gray-500", L: "bg-red-600" } as const;
  return (
    <div data-scout-pane>
      <div className="flex items-center gap-3 bg-black/30 px-3 py-2" style={{ boxShadow: "inset 3px 0 0 #f87171" }}>
        <ClubBadge club={fixture.opponent} kit={kit} size={46} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[22px] font-black uppercase leading-none text-white">{short(fixture.opponent)}</div>
          <div className="mt-1 truncate text-[12px] font-black uppercase tracking-wide text-white/70">{report.tactics.formationName} · {report.tactics.playstyleName}</div>
        </div>
        {where && <span className="shrink-0 bg-white/10 px-2 py-1 text-[15px] font-black uppercase leading-none text-amber-300">{where}</span>}
      </div>

      <Label right={report.headToHead ? (
        <span className="text-[13px] font-black tabular-nums"><span className="text-emerald-300">{report.headToHead.wins}W</span> <span className="text-white/80">{report.headToHead.draws}D</span> <span className="text-red-300">{report.headToHead.losses}L</span></span>
      ) : undefined}>Their last 5</Label>
      <div className="grid grid-cols-5 gap-px">
        {Array.from({ length: 5 }, (_, i) => five[i - (5 - five.length)]).map((f, i) => f ? (
          <div key={i} className="flex flex-col items-center gap-1 bg-black/30 py-1.5">
            <span className={`grid h-[20px] w-[20px] place-items-center text-[13px] font-black text-white ${tone[f.result]}`}>{f.result}</span>
            <span className="text-[14px] font-black tabular-nums leading-none text-white">{f.scoreFor}-{f.scoreAgainst}</span>
            <ClubBadge club={f.opponent} kit={kitsOf(f.opponent).home} size={16} />
          </div>
        ) : <div key={i} className="bg-black/20" />)}
      </div>

      {key && (
        <>
          <Label>Key man</Label>
          <div className="flex items-center gap-2.5 bg-black/30 px-3 py-2">
            <ImageWithFallback
              src={faceOrFake(key.p.image, key.p.name)}
              fallbackSrc={faceOrFake(null, key.p.name)}
              alt=""
              className="h-10 w-10 shrink-0 bg-white/10 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[17px] font-black uppercase leading-none text-white">{shortNameOf(key.p.name)}</div>
              <div className="mt-0.5 text-[12px] font-black uppercase text-white/65">{key.p.position} · {key.p.goals}G {key.p.assists}A</div>
            </div>
            <span className="shrink-0 text-[24px] font-black leading-none text-amber-300">{key.p.overall}</span>
          </div>
        </>
      )}

      <div className="mt-3"><ScoutReportCard report={report} /></div>
    </div>
  );
}
