"use client";
import { useMemo, useState } from "react";
import type { CareerState, LeagueTeam, LeagueResult } from "@/lib/star/types";
import { ALL_DIVISIONS, divisionOf, leagueNameFor, type CareerDivision } from "@/lib/star/calendar";
import { sortLeague, buildSeasonFixtures } from "@/lib/star/season";
import { sortEuro } from "@/lib/star/euro";
import type { CupState } from "@/lib/star/cups";
import { worldOf, finishWorld, WORLD_LIVE } from "@/lib/star/world";
import { worldRoundResults } from "@/lib/star/world/leagues";
import { compHistoryFor } from "@/lib/star/world/history";
import { intlCompetitions, intlCompView, intlCompScorers, fullRanking } from "@/lib/star/intl/compView";
import { cupScorers } from "@/lib/star/world/cupScorers";
import { ownEuroScorers } from "@/lib/star/world/ownEuroScorers";
import { intlOf, worldOf as intlWorldOf } from "@/lib/star/intl/career";
import { seasonQualifiers } from "@/lib/star/qualification";
import type { CompKind } from "@/lib/star/intl/world";
import { topOf, ownLeagueTop, type ScorerRow } from "@/lib/star/world/summary";
import type { WorldState, WorldSummary } from "@/lib/star/world/types";
import { shortClub, groupedGoalLines } from "@/lib/star/media/grammar";
import NationFlag from "./NationFlag";
import IntlWorldPanel from "./IntlWorldPanel";
import { NationTable, MatchRow, nationGlow } from "./IntlKit";
import ClubBadge from "./ClubBadge";
import { EuroKnockout, CupKnockout } from "./KnockoutTree";
import { ClubCard, rgba, useClubTheme } from "./ui";
import { SegTabs, CardTitle, youRowStyle } from "./screenKit";

/**
 * EVERY LEAGUE AND CUP (Mikey, 19 Oct 2026): the tables, latest results, top
 * scorers and assists of every English league, both domestic cups, both
 * shields, and the Champions and Europa League — yours and the ones the rest
 * of the world is playing without you (lib/star/world). `final` shows the
 * season played to its end (the season review).
 *
 * One chooser (a full-screen list, house style) and one tab row — never two
 * tab rows stacked.
 *
 * Since 22 Oct 2026 this IS the League page (master plan step 3, Mikey): it
 * opens on your league's table; every competition has a History tab (winner
 * and runner-up of each season); Results walks ‹ Round › back through played
 * rounds and on to future fixtures, scorers written once ("Smith 5', 15'");
 * and the picker has an International group: your nation, the FIFA ranking,
 * and every international competition (lib/star/intl/compView.ts).
 */

type Comp =
  | { key: string; kind: "league"; label: string; division: CareerDivision }
  | { key: string; kind: "euro"; label: string; competition: "Champions League" | "Europa League" }
  | { key: string; kind: "cup"; label: string; competition: "FA Cup" | "League Cup" | "Lower League Trophy" }
  | { key: string; kind: "shield"; label: string; competition: "Community Shield" | "Super Cup" }
  | { key: string; kind: "intl"; label: string; comp: CompKind }
  | { key: string; kind: "nation"; label: string }
  | { key: string; kind: "ranking"; label: string };

const COMPS: Comp[] = [
  ...ALL_DIVISIONS.map(d => ({ key: d, kind: "league" as const, label: leagueNameFor(d), division: d })),
  { key: "fa", kind: "cup", label: "FA Cup", competition: "FA Cup" },
  { key: "lc", kind: "cup", label: "League Cup", competition: "League Cup" },
  { key: "llt", kind: "cup", label: "Lower League Trophy", competition: "Lower League Trophy" },
  { key: "ucl", kind: "euro", label: "Champions League", competition: "Champions League" },
  { key: "uel", kind: "euro", label: "Europa League", competition: "Europa League" },
  { key: "cs", kind: "shield", label: "Community Shield", competition: "Community Shield" },
  { key: "sc", kind: "shield", label: "Super Cup", competition: "Super Cup" },
];
const GROUPS: { title: string; keys: string[] }[] = [
  { title: "England", keys: ALL_DIVISIONS },
  { title: "Cups", keys: ["fa", "lc", "llt", "cs", "sc"] },
  { title: "Europe", keys: ["ucl", "uel"] },
];

// Promotion/relegation lines, as in the League table (LeagueScreen LADDER).
const LINES: Record<CareerDivision, { up: number; po?: [number, number]; down: number; europe?: boolean }> = {
  premier: { up: 0, down: 3, europe: true },
  championship: { up: 2, po: [3, 6], down: 3 },
  league_one: { up: 2, po: [3, 6], down: 4 },
  league_two: { up: 3, po: [4, 7], down: 2 },
  national_league: { up: 1, po: [2, 5], down: 4 },
  national_league_north: { up: 1, po: [2, 7], down: 4 },
  national_league_south: { up: 1, po: [2, 7], down: 4 },
};
const ZONE = { up: "#22c55e", po: "#14b8a6", down: "#ef4444", ucl: "#3b82f6", uel: "#f97316", champ: "#fbbf24" };

function zoneColour(d: CareerDivision, pos: number, n: number): string | null {
  const l = LINES[d];
  if (l.europe) return pos === 1 ? ZONE.champ : pos <= 5 ? ZONE.ucl : pos <= 7 ? ZONE.uel : pos > n - l.down ? ZONE.down : null;
  if (pos <= l.up) return ZONE.up;
  if (l.po && pos >= l.po[0] && pos <= l.po[1]) return ZONE.po;
  return pos > n - l.down ? ZONE.down : null;
}

export default function WorldPane({ career, final = false, last = false, onClose }: {
  career: CareerState; final?: boolean;
  /** Open on last season (the season review, after the rollover). */
  last?: boolean;
  /** The season review's own close button (it draws its own header). */
  onClose?: () => void;
}) {
  const [showLast, setShowLast] = useState(last && !!career.lastWorld);
  if (showLast && career.lastWorld) {
    return <LastSeason career={career} summary={career.lastWorld} onNow={last ? undefined : () => setShowLast(false)} onClose={onClose} />;
  }
  return <NowPane career={career} final={final} onLast={career.lastWorld ? () => setShowLast(true) : undefined} />;
}

function NowPane({ career, final, onLast }: { career: CareerState; final: boolean; onLast?: () => void }) {
  const { glow } = useClubTheme(career);
  const world = useMemo<WorldState>(() => (final ? finishWorld(career) : worldOf(career)), [career, final]);
  const yours = divisionOf(career);
  const [key, setKey] = useState<string>(yours);
  const [choosing, setChoosing] = useState(false);
  const nation = useMemo(() => { try { return intlOf(career).nation; } catch { return null; } }, [career]);
  const intl = useMemo<Comp[]>(() => {
    if (!nation) return [];
    let comps: CompKind[] = [];
    try { comps = intlCompetitions(career); } catch { comps = []; }
    return [
      { key: "nation", kind: "nation", label: nation },
      { key: "ranking", kind: "ranking", label: "FIFA ranking" },
      ...comps.map(c => ({ key: `intl:${c}`, kind: "intl" as const, label: c, comp: c })),
    ];
  }, [career, nation]);
  // The Lower League Trophy only for a season your club is in it.
  const inTrophy = (career.cupState ?? []).some(c => c.competition === "Lower League Trophy");
  const all = [...COMPS.filter(c => c.key !== "llt" || inTrophy), ...intl];
  const groups = [...GROUPS.map(g => ({ ...g, keys: g.keys.filter(k => all.some(c => c.key === k)) })), ...(intl.length ? [{ title: "International", keys: intl.map(c => c.key) }] : [])];
  const comp = all.find(c => c.key === key) ?? all[0];
  const you = career.player.club;

  return (
    <div className="space-y-2" data-world-pane={comp.key}>
      <button
        type="button"
        onClick={() => setChoosing(true)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left"
        style={{ background: rgba(glow, 0.28), boxShadow: `inset 0 0 0 1px ${rgba(glow, 0.7)}` }}
        data-world-choose
      >
        <span className="flex items-center gap-2">
          <span className="text-[17px]">{comp.kind === "league" ? "🏆" : comp.kind === "euro" ? "⭐" : comp.kind === "nation" || comp.kind === "intl" || comp.kind === "ranking" ? "🌍" : "🥇"}</span>
          <span className="text-[15px] font-black text-white">{comp.label}</span>
          {comp.kind === "league" && comp.division === yours && <span className="rounded-full bg-amber-300 px-1.5 text-[9px] font-black uppercase text-gray-950">Yours</span>}
        </span>
        <span className="text-[12px] font-bold text-white/85">Change ▾</span>
      </button>

      {!WORLD_LIVE && !final && <div className="rounded-lg bg-black/30 px-3 py-2 text-[11px] font-bold text-white">Other leagues are played at the end of the season.</div>}

      {comp.kind === "league" && <LeagueView career={career} world={world} division={comp.division} glow={glow} you={you} />}
      {comp.kind === "euro" && <EuroView career={career} world={world} competition={comp.competition} glow={glow} you={you} />}
      {comp.kind === "cup" && <CupView career={career} name={comp.competition} cup={comp.competition === "League Cup"
        ? (career.cupState ?? []).find(c => c.competition === "League Cup") ?? world.leagueCup
        : (career.cupState ?? []).find(c => c.competition === comp.competition)} glow={glow} you={you} />}
      {comp.kind === "shield" && <ShieldView career={career} world={world} competition={comp.competition} glow={glow} />}
      {comp.kind === "nation" && <IntlWorldPanel career={career} />}
      {comp.kind === "ranking" && <RankingView career={career} nation={nation} />}
      {comp.kind === "intl" && <IntlCompPane key={comp.comp} career={career} comp={comp.comp} nation={nation} />}

      {choosing && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#07110c] px-4 pb-8 pt-4" data-world-chooser>
          <div className="mx-auto max-w-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[18px] font-black text-white">Every league and cup</span>
              <button type="button" onClick={() => setChoosing(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-lg font-black text-white" aria-label="Close">✕</button>
            </div>
            {onLast && (
              <button type="button" onClick={() => { setChoosing(false); onLast(); }} className="mb-3 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[14px] font-black text-white" style={{ background: rgba("#fbbf24", 0.2), boxShadow: `inset 0 0 0 1px ${rgba("#fbbf24", 0.6)}` }} data-world-last>
                <span>📜 Last season</span><span className="text-[11px] text-amber-200">Tables, scorers, winners</span>
              </button>
            )}
            {groups.map(g => (
              <div key={g.title} className="mb-3">
                <CardTitle className="mb-1 px-1" tone="text-amber-300">{g.title}</CardTitle>
                <div className="space-y-1">
                  {g.keys.map(k => {
                    const c = all.find(x => x.key === k)!;
                    const on = c.key === comp.key;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => { setKey(k); setChoosing(false); }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[14px] font-bold text-white"
                        style={on ? youRowStyle(glow) : { background: "rgba(255,255,255,.06)" }}
                      >
                        <span>{c.label}</span>
                        {c.kind === "league" && c.division === yours && <span className="text-[10px] font-black uppercase text-amber-300">Yours</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

const COLS = "grid-cols-[22px_1fr_24px_24px_24px_24px_28px_30px] px-2 gap-1";

function Table({ rows, glow, you, zone }: { rows: LeagueTeam[]; glow: string; you: string; zone?: (pos: number, n: number) => string | null }) {
  return (
    <ClubCard glow={glow} className="overflow-hidden">
      <div className={`grid ${COLS} border-b border-white/10 bg-black/30 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/60`}>
        <div className="text-center">#</div><div>Club</div>
        <div className="text-center">P</div><div className="text-center">W</div><div className="text-center">D</div><div className="text-center">L</div>
        <div className="text-center">GD</div><div className="text-center text-white/85">Pts</div>
      </div>
      {rows.map((t, i) => {
        const z = zone?.(i + 1, rows.length) ?? null;
        const isYou = t.name === you;
        return (
          <div key={t.name} className={`relative grid ${COLS} items-center py-1.5 text-[11px] font-bold text-white ${isYou ? "rounded-md" : i % 2 === 0 ? "bg-white/[0.035]" : ""}`} style={isYou ? youRowStyle(glow) : undefined}>
            {z && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: z }} />}
            <div className="text-center font-black">{i + 1}</div>
            <div className="flex min-w-0 items-center gap-1.5"><ClubBadge club={t.name} size={15} /><span className="truncate">{shortClub(t.name)}</span></div>
            <div className="text-center text-white/85">{t.played}</div>
            <div className="text-center text-white/85">{t.won}</div>
            <div className="text-center text-white/85">{t.drawn}</div>
            <div className="text-center text-white/85">{t.lost}</div>
            <div className="text-center text-white/85">{t.goalsFor - t.goalsAgainst}</div>
            <div className="text-center font-black">{t.points}</div>
          </div>
        );
      })}
    </ClubCard>
  );
}

/** "Smith 5', 15'": each scorer once, every minute after the name (Mikey 33:10). */
const goalLines = (gs: NonNullable<LeagueResult["hg"]>) =>
  groupedGoalLines(gs, g => g.s, g => g.m).map(({ scorer, minutes }) => `${scorer} ${minutes.map(m => (m > 90 ? `90+${m - 90}'` : `${m}'`)).join(", ")}`);

function Results({ results, glow, you, title }: { results: LeagueResult[]; glow: string; you: string; title?: string }) {
  if (!results.length) return <Empty text="No games played yet." />;
  return (
    <ClubCard glow={glow} className="p-1.5">
      {title && <CardTitle className="px-1 pb-1" tone="text-amber-300">{title}</CardTitle>}
      <div className="space-y-1">
        {results.map(r => {
          const yours = r.home === you || r.away === you;
          return (
            <div key={`${r.home}-${r.away}`} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-white ${yours ? "" : "bg-white/[0.04]"}`} style={yours ? youRowStyle(glow) : undefined}>
              <span className={`truncate text-right ${r.hs > r.as ? "font-black" : "text-white/85"}`}>{shortClub(r.home)}</span>
              <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums">{r.hs}-{r.as}</span>
              <span className={`truncate ${r.as > r.hs ? "font-black" : "text-white/85"}`}>{shortClub(r.away)}</span>
              {(r.hg?.length || r.ag?.length) ? (
                <div className="col-span-3 grid grid-cols-2 gap-2 text-[9.5px] font-bold text-white/80">
                  <div className="space-y-0.5 text-right">{goalLines(r.hg ?? []).map(l => <div key={l}>{l}</div>)}</div>
                  <div className="space-y-0.5">{goalLines(r.ag ?? []).map(l => <div key={l}>{l}</div>)}</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </ClubCard>
  );
}

function Scorers({ rows, glow, label, you }: {
  rows: ScorerRow[]; glow: string; label: string;
  /** You, when you are outside the list: shown under it with your place. */
  you?: { row: ScorerRow; rank: number } | null;
}) {
  if (!rows.length && !you) return <Empty text="No named players here yet." />;
  const line = (r: ScorerRow, rank: number, mine: boolean) => (
    <div key={r.id} className={`grid grid-cols-[26px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-bold text-white ${mine ? "" : "bg-white/[0.04]"}`} style={mine ? youRowStyle(glow) : undefined}>
      <span className="text-center font-black">{rank}</span>
      <span className="flex min-w-0 items-center gap-1.5">{r.club && <ClubBadge club={r.club} size={15} />}<span className="truncate">{r.player}</span></span>
      <span className="font-black tabular-nums">{r.n} <span className="text-[9px] text-white/70">{label}</span></span>
    </div>
  );
  return (
    <ClubCard glow={glow} className="p-1.5">
      <div className="space-y-1">
        {rows.map((r, i) => line(r, i + 1, false))}
        {you && (
          <>
            <div className="text-center text-[11px] font-black leading-none text-white/60">⋯</div>
            {line(you.row, you.rank, true)}
          </>
        )}
      </div>
    </ClubCard>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl bg-black/30 px-3 py-4 text-center text-[12px] font-bold text-white">{text}</div>;
}

// ── A league ────────────────────────────────────────────────────────────────

function LeagueView({ career, world, division, glow, you }: { career: CareerState; world: WorldState; division: CareerDivision; glow: string; you: string }) {
  const [tab, setTab] = useState<"table" | "results" | "goals" | "assists" | "history">("table");
  const own = division === divisionOf(career);
  const lg = own ? null : world.leagues.find(l => l.division === division);
  const rows = own ? sortLeague(career.league) : lg ? sortLeague(lg.teams) : [];
  const goals = own ? ownLeagueTop(career, 0) : lg ? topOf(career, lg.scorers, 0) : [];
  const assists = own ? ownLeagueTop(career, 1) : lg ? topOf(career, lg.scorers, 1) : [];
  return (
    <div className="space-y-2">
      <SegTabs value={tab} onChange={setTab} tabs={[["table", "Table"], ["results", "Results"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} />
      {tab === "table" && (rows.length ? <Table rows={rows} glow={glow} you={you} zone={(p, n) => zoneColour(division, p, n)} /> : <Empty text="No table for this league." />)}
      {tab === "results" && <LeagueRounds career={career} own={own} lg={lg ?? null} glow={glow} you={you} />}
      {tab === "goals" && <Scorers rows={goals} glow={glow} label="goals" />}
      {tab === "assists" && <Scorers rows={assists} glow={glow} label="assists" />}
      {tab === "history" && <History career={career} comp={leagueNameFor(division)} glow={glow} you={you} />}
    </div>
  );
}

/** ‹ Round 8 ›: back through played rounds, on to future fixtures (Mikey 33:42). Opens on the latest. */
function RoundNav({ label, sub, onPrev, onNext }: { label: string; sub?: string; onPrev?: () => void; onNext?: () => void }) {
  const btn = "kib-press grid h-9 w-9 shrink-0 place-items-center rounded-md bg-black/35 text-[18px] font-black text-white disabled:opacity-25";
  return (
    <div className="flex items-center gap-2" data-round-nav>
      <button type="button" className={btn} onClick={onPrev} disabled={!onPrev} aria-label="Earlier round">‹</button>
      <div className="min-w-0 flex-1 text-center">
        <div className="truncate text-[14px] font-black text-white">{label}</div>
        {sub && <div className="truncate text-[10px] font-bold text-white/70">{sub}</div>}
      </div>
      <button type="button" className={btn} onClick={onNext} disabled={!onNext} aria-label="Later round">›</button>
    </div>
  );
}

function LeagueRounds({ career, own, lg, glow, you }: { career: CareerState; own: boolean; lg: WorldState["leagues"][number] | null; glow: string; you: string }) {
  const clubs = own ? career.league.map(t => t.name) : lg?.clubs ?? [];
  const schedule = useMemo(() => buildSeasonFixtures(clubs), [clubs.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = Math.max(0, ...schedule.map(f => f.week));
  const playedUpTo = own ? Math.max(0, ...(career.results ?? []).map(r => r.week)) : lg?.played ?? 0;
  const [round, setRound] = useState(Math.max(1, playedUpTo));
  const results = useMemo<LeagueResult[]>(() => {
    if (round > playedUpTo) return [];
    if (own) return (career.results ?? []).filter(r => r.week === round);
    return lg ? worldRoundResults(career, lg, round) : [];
  }, [career, own, lg, round, playedUpTo]);
  if (!total) return <Empty text="No fixtures for this league." />;
  const ahead = round > playedUpTo;
  const pairs = schedule.filter(f => f.week === round);
  return (
    <div className="space-y-2">
      <RoundNav
        label={`Round ${round}`}
        sub={ahead ? "Still to play" : `of ${total}`}
        onPrev={round > 1 ? () => setRound(round - 1) : undefined}
        onNext={round < total ? () => setRound(round + 1) : undefined}
      />
      {ahead || !results.length ? (
        <ClubCard glow={glow} className="p-1.5">
          <div className="space-y-1">
            {pairs.map(f => {
              const yours = f.home === you || f.away === you;
              return (
                <div key={`${f.home}-${f.away}`} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-white ${yours ? "" : "bg-white/[0.04]"}`} style={yours ? youRowStyle(glow) : undefined}>
                  <span className="truncate text-right">{shortClub(f.home)}</span>
                  <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black">v</span>
                  <span className="truncate">{shortClub(f.away)}</span>
                </div>
              );
            })}
          </div>
        </ClubCard>
      ) : <Results results={results} glow={glow} you={you} />}
    </div>
  );
}

/** Every season's winner and runner-up (Mikey 24:44). */
function History({ career, comp, glow, you }: { career: CareerState; comp: string; glow: string; you: string }) {
  const rows = useMemo(() => compHistoryFor(career, comp), [career, comp]);
  if (!rows.length) return <Empty text="No seasons finished yet. The winner and runner-up go here at the end of each season." />;
  return (
    <ClubCard glow={glow} className="p-1.5" data-history={comp}>
      <div className="space-y-1">
        {rows.map(r => {
          const y = career.player.startYear + r.season - 1;
          const mine = r.winner === you || r.runnerUp === you;
          return (
            <div key={r.season} className={`rounded-lg px-2 py-1.5 text-[11.5px] font-bold text-white ${mine ? "" : "bg-white/[0.04]"}`} style={mine ? youRowStyle(glow) : undefined}>
              <div className="text-[9.5px] font-black uppercase tracking-wider text-amber-300">{String(y).slice(2)}/{String(y + 1).slice(2)}{r.score ? ` · final ${r.score}` : ""}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span>🏆</span><ClubBadge club={r.winner} size={16} />
                <span className="min-w-0 flex-1 truncate font-black">{shortClub(r.winner)}</span>
                {r.runnerUp && <span className="flex min-w-0 items-center gap-1 text-white/75"><span className="text-[9px] uppercase">2nd</span><ClubBadge club={r.runnerUp} size={14} /><span className="max-w-[7rem] truncate">{shortClub(r.runnerUp)}</span></span>}
              </div>
            </div>
          );
        })}
      </div>
    </ClubCard>
  );
}

// ── Europe ──────────────────────────────────────────────────────────────────

function EuroView({ career, world, competition, glow, you }: { career: CareerState; world: WorldState; competition: "Champions League" | "Europa League"; glow: string; you: string }) {
  const [tab, setTab] = useState<"table" | "knockout" | "goals" | "assists" | "history">("table");
  const mine = career.euroState?.competition === competition ? career.euroState : null;
  const w = world.europe.find(e => e.competition === competition);
  const table = mine ? sortEuro(mine.table ?? mine.liveTable) : w ? sortEuro(w.table) : [];
  const rows: LeagueTeam[] = table.map(r => ({ name: r.name, strength: 0, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points }));
  // Your own competition is only ever read from your campaign, never the world's.
  const bracket = mine ? mine.bracket : w?.bracket;
  const winner = mine ? mine.winner : w?.winner;
  const own = useMemo(() => (mine ? ownEuroScorers(career, mine, 10000) : null), [career, mine]);
  const goals = own ? own.goals.slice(0, 10) : w ? topOf(career, w.scorers, 0) : [];
  const assists = own ? own.assists.slice(0, 10) : w ? topOf(career, w.scorers, 1) : [];
  // You, if you scored (or assisted) but are outside the top ten.
  const youBelow = (all: ScorerRow[] | undefined) => {
    const i = (all ?? []).findIndex(r => r.club === you && r.player === career.player.lastName);
    return i >= 10 ? { row: all![i], rank: i + 1 } : null;
  };
  return (
    <div className="space-y-2">
      {winner && <WinnerBar club={winner} glow={glow} />}
      <SegTabs value={tab} onChange={setTab} tabs={[["table", "League"], ["knockout", "KO"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} />
      {tab === "table" && (rows.length ? <Table rows={rows} glow={glow} you={you} zone={(p) => (p <= 8 ? "#10b981" : p <= 24 ? "#3b82f6" : "#ef4444")} /> : <Empty text="Not started yet." />)}
      {tab === "knockout" && (bracket ? <EuroKnockout bracket={bracket} glow={glow} you={you} /> : <Empty text="The knockout starts after the league phase." />)}
      {tab === "goals" && <Scorers rows={goals} glow={glow} label="goals" you={youBelow(own?.goals)} />}
      {tab === "assists" && <Scorers rows={assists} glow={glow} label="assists" you={youBelow(own?.assists)} />}
      {tab === "history" && <History career={career} comp={competition} glow={glow} you={you} />}
    </div>
  );
}

// ── Cups and shields ────────────────────────────────────────────────────────

function CupView({ career, name, cup, glow, you }: { career: CareerState; name: string; cup?: CupState; glow: string; you: string }) {
  const [tab, setTab] = useState<"rounds" | "goals" | "assists" | "history">("rounds");
  const sc = useMemo(() => cup ? cupScorers(career, name, cup.rounds.flatMap(r => r.ties.map(t => ({ round: r.name, home: t.home, away: t.away, hs: t.hs, as: t.as })))) : { goals: [], assists: [] }, [career, name, cup]);
  return (
    <div className="space-y-2">
      {cup?.winner && <WinnerBar club={cup.winner} glow={glow} />}
      <SegTabs value={tab} onChange={setTab} tabs={[["rounds", "Rounds"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} />
      {tab === "history" ? <History career={career} comp={name} glow={glow} you={you} />
        : !cup ? <Empty text="This cup isn't being played this season." />
        : tab === "goals" ? <Scorers rows={sc.goals} glow={glow} label="goals" />
        : tab === "assists" ? <Scorers rows={sc.assists} glow={glow} label="assists" />
        : <CupKnockout cup={cup} glow={glow} you={you} extra={<StillToJoin cup={cup} glow={glow} you={you} />} />}
    </div>
  );
}

function StillToJoin({ cup, glow, you }: { cup: CupState; glow: string; you: string }) {
  if (!Object.keys(cup.entries ?? {}).length) return null;
  return (
    <ClubCard glow={glow} className="p-2">
      <CardTitle className="px-1 pb-1" tone="text-amber-300">Still to join</CardTitle>
      {Object.entries(cup.entries ?? {}).map(([round, clubs]) => (
        <div key={round} className="flex justify-between px-1 py-0.5 text-[11px] font-bold text-white">
          <span>{round}</span>
          <span className="tabular-nums">{clubs.includes(you) ? `${clubs.length} clubs · you join here` : `${clubs.length} clubs`}</span>
        </div>
      ))}
    </ClubCard>
  );
}

function ShieldView({ career, world, competition, glow }: { career: CareerState; world: WorldState; competition: "Community Shield" | "Super Cup"; glow: string }) {
  const yours = career.fixtures.find(f => f.competition === competition);
  const s = world.shields.find(x => x.competition === competition);
  const home = yours ? (yours.home ? career.player.club : yours.opponent) : null;
  const away = yours ? (yours.home ? yours.opponent : career.player.club) : null;
  const [tab, setTab] = useState<"final" | "goals" | "assists" | "history">("final");
  const game = yours ? { round: "Final", home: home!, away: away!, hs: yours.played ? yours.homeScore : undefined, as: yours.played ? yours.awayScore : undefined }
    : s ? { round: "Final", home: s.home, away: s.away, hs: s.hs, as: s.as } : null;
  const sc = useMemo(() => cupScorers(career, competition, game ? [game] : []), [career, competition, game?.home, game?.hs, game?.as]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-2">
      <SegTabs value={tab} onChange={setTab} tabs={[["final", "Final"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} />
      {tab === "final" && (yours ? <ShieldCard glow={glow} home={home!} away={away!} hs={yours.played ? yours.homeScore : undefined} as={yours.played ? yours.awayScore : undefined} />
        : s ? <ShieldCard glow={glow} home={s.home} away={s.away} hs={s.hs} as={s.as} pens={s.pens} winner={s.winner} />
        : <Empty text={`No ${competition} this season.`} />)}
      {tab === "goals" && <Scorers rows={sc.goals} glow={glow} label="goals" />}
      {tab === "assists" && <Scorers rows={sc.assists} glow={glow} label="assists" />}
      {tab === "history" && <History career={career} comp={competition} glow={glow} you={career.player.club} />}
    </div>
  );
}

function ShieldCard({ glow, home, away, hs, as, pens, winner }: { glow: string; home: string; away: string; hs?: number; as?: number; pens?: { home: number; away: number }; winner?: string }) {
  return (
    <ClubCard glow={glow} className="p-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-white">
        <div className="flex flex-col items-center gap-1 text-center text-[12px] font-bold"><ClubBadge club={home} size={40} /><span>{home}</span></div>
        <div className="rounded-lg bg-black/45 px-3 py-1 text-[20px] font-black tabular-nums">{hs !== undefined ? `${hs}-${as}` : "v"}</div>
        <div className="flex flex-col items-center gap-1 text-center text-[12px] font-bold"><ClubBadge club={away} size={40} /><span>{away}</span></div>
      </div>
      {pens && <div className="mt-2 text-center text-[11px] font-bold text-amber-300">{pens.home}-{pens.away} on penalties</div>}
      {winner && <div className="mt-1 text-center text-[12px] font-black text-white">🏆 {winner}</div>}
    </ClubCard>
  );
}

function WinnerBar({ club, glow }: { club: string; glow: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: rgba("#fbbf24", 0.22), boxShadow: `inset 0 0 0 1px ${rgba("#fbbf24", 0.7)}, 0 0 14px -4px ${rgba(glow, 0.8)}` }}>
      <span className="text-lg">🏆</span>
      <ClubBadge club={club} size={22} />
      <span className="text-[13px] font-black text-white">{club}</span>
      <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-amber-200">Winners</span>
    </div>
  );
}

// ── International ───────────────────────────────────────────────────────────

/** One international competition: its groups, ‹ Round › results, and every final. */
function IntlCompPane({ career, comp, nation }: { career: CareerState; comp: CompKind; nation: string | null }) {
  const v = useMemo(() => { try { return intlCompView(career, comp); } catch { return null; } }, [career, comp]);
  const glow = nationGlow(nation ?? "England");
  const drawn = !!v && v.rounds.length > 0;
  const [tab, setTab] = useState<"tables" | "results" | "goals" | "assists" | "history">(!drawn ? "history" : v && v.groups.length ? "tables" : "results");
  const [round, setRound] = useState(v?.openAt ?? 0);
  const sc = useMemo(() => { try { return intlCompScorers(career, comp); } catch { return { goals: [], assists: [] }; } }, [career, comp]);
  if (!v) return <Empty text="Not drawn yet." />;
  const r = v.rounds[round];
  const asRows = (xs: { name: string; nation: string; n: number }[]) => xs.map((x, i) => ({ id: `${i}`, player: x.name, club: "", nation: x.nation, n: x.n }));
  return (
    <div className="space-y-2" data-intl-comp={comp}>
      <div className="px-1 text-[11px] font-black uppercase tracking-wider text-amber-300">{v.title}{v.yours && nation ? ` · ${nation} in it` : ""}</div>
      <SegTabs value={tab} onChange={setTab} tabs={[["tables", "Tables"], ["results", "Results"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} />
      {!drawn && (tab === "tables" || tab === "results") && <Empty text="The next one isn't drawn yet. Its history is under History." />}
      {(tab === "goals" || tab === "assists") && <NationScorers rows={asRows(tab === "goals" ? sc.goals : sc.assists)} glow={glow} label={tab} mine={nation} />}
      {drawn && tab === "tables" && (v.groups.length
        ? v.groups.map(g => <NationTable key={g.title} group={g} nation={nation ?? ""} glow={glow} through={1} />)
        : <Empty text="No groups in this one: it is all knockout." />)}
      {tab === "results" && r && (
        <div className="space-y-2">
          <RoundNav label={r.name} sub={r.played ? `${round + 1} of ${v.rounds.length}` : "Still to play"}
            onPrev={round > 0 ? () => setRound(round - 1) : undefined}
            onNext={round < v.rounds.length - 1 ? () => setRound(round + 1) : undefined} />
          <ClubCard glow={glow} className="p-1.5">
            {r.matches.map((m, i) => <MatchRow key={m.id ?? i} m={m} glow={glow} nation={nation ?? ""} />)}
          </ClubCard>
        </div>
      )}
      {tab === "history" && (v.history.length ? (
        <ClubCard glow={glow} className="p-1.5">
          <div className="space-y-1">
            {v.history.map((f, i) => (
              <div key={i} className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-[11.5px] font-bold text-white" style={f.winner === nation || f.runnerUp === nation ? youRowStyle(glow) : undefined}>
                <div className="text-[9.5px] font-black uppercase tracking-wider text-amber-300">{f.year} · final {f.score}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span>🏆</span><NationFlag nation={f.winner} width={18} rounded={2} />
                  <span className="min-w-0 flex-1 truncate font-black">{f.winner}</span>
                  <span className="text-[9px] uppercase text-white/75">2nd</span><NationFlag nation={f.runnerUp} width={16} rounded={2} />
                  <span className="max-w-[7rem] truncate text-white/75">{f.runnerUp}</span>
                </div>
              </div>
            ))}
          </div>
        </ClubCard>
      ) : <Empty text="No final played yet. Each one is added here once it is played." />)}
    </div>
  );
}

/** International scorers: a flag instead of a club badge; your nation lit. */
function NationScorers({ rows, glow, label, mine }: { rows: { id: string; player: string; nation: string; n: number }[]; glow: string; label: string; mine: string | null }) {
  if (!rows.length) return <Empty text="No goals named in this one yet this season." />;
  return (
    <ClubCard glow={glow} className="p-1.5">
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[22px_1fr_auto] items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 text-[12px] font-bold text-white" style={r.nation === mine ? youRowStyle(glow) : undefined}>
            <span className="text-center font-black">{i + 1}</span>
            <span className="flex min-w-0 items-center gap-1.5"><NationFlag nation={r.nation} width={18} rounded={2} /><span className="truncate">{r.player}</span></span>
            <span className="font-black tabular-nums">{r.n} <span className="text-[9px] text-white/70">{label}</span></span>
          </div>
        ))}
      </div>
    </ClubCard>
  );
}

/** The whole FIFA ranking, your nation lit. */
function RankingView({ career, nation }: { career: CareerState; nation: string | null }) {
  const rows = useMemo(() => { try { return fullRanking(career); } catch { return []; } }, [career]);
  const glow = nationGlow(nation ?? "England");
  if (!rows.length) return <Empty text="No ranking yet." />;
  return (
    <ClubCard glow={glow} className="p-1.5" data-fifa-ranking>
      {rows.map((t, i) => {
        const you = t.name === nation;
        return (
          <div key={t.name} className={`grid grid-cols-[30px_1fr_auto] items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11.5px] font-bold text-white ${you ? "" : i % 2 === 0 ? "bg-white/[0.035]" : ""}`} style={you ? youRowStyle(glow) : undefined}>
            <span className="text-center font-black">{i + 1}</span>
            <span className="flex min-w-0 items-center gap-1.5"><NationFlag nation={t.name} width={18} rounded={2} /><span className="truncate">{t.name}</span></span>
            <span className="font-black tabular-nums text-white/85">{t.points.toLocaleString("en-GB")}</span>
          </div>
        );
      })}
    </ClubCard>
  );
}

// ── Last season (career.lastWorld) ──────────────────────────────────────────
//
// THE SEASON REVIEW (Mikey, 2 Nov 2026): no chooser at the top. One list of
// every trophy, always in the same order (the leagues top to bottom, the
// cups, Europe, then any international final played that season), no
// play-off finals and no "Finals" box. Tap a trophy to see that
// competition: its final table (green = went up, red = went down, dark blue
// = Champions League, orange = Europa League), its scorers and assists.

/** The fixed order of the trophy list. Anything not named sorts after these. */
const TROPHY_ORDER = [
  "Premier League", "Championship", "League One", "League Two", "National League",
  "National League North", "National League South",
  "FA Cup", "League Cup", "Lower League Trophy", "Community Shield",
  "Champions League", "Europa League", "Super Cup",
];

type Trophy =
  | { kind: "league"; competition: string; club: string; division: CareerDivision }
  | { kind: "euro" | "cup" | "shield"; competition: string; club: string }
  | { kind: "intl"; competition: CompKind; club: string; runnerUp: string; score: string };

const TROPHY_TONE: Record<Trophy["kind"], string> = { league: "#22c55e", cup: "#f59e0b", shield: "#f59e0b", euro: "#3b82f6", intl: "#a855f7" };
const TROPHY_GROUP: Record<Trophy["kind"], string> = { league: "Leagues", cup: "Cups", shield: "Cups", euro: "Europe", intl: "International" };

/** The red round close / back button (centred cross, drawn, not a font glyph). */
export function CloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} data-close-button
      className="kib-press grid h-10 w-10 shrink-0 place-items-center rounded-full"
      style={{ background: "linear-gradient(180deg,#ef4444,#b91c1c)", boxShadow: "0 0 0 2px rgba(255,255,255,.18), 0 4px 12px -2px rgba(185,28,28,.7)" }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3L13 13M13 3L3 13" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></svg>
    </button>
  );
}

/** Final-table lines, after the season: who went up, who went down, who is in Europe. */
function finalZone(division: CareerDivision, rows: LeagueTeam[], summary: WorldSummary): (pos: number, n: number) => string | null {
  const l = LINES[division];
  if (l.europe) {
    const fa = summary.winners.find(w => w.competition === "FA Cup")?.club ?? null;
    const lc = summary.winners.find(w => w.competition === "League Cup")?.club ?? null;
    let q: { champions: string[]; europa: string[] } = { champions: [], europa: [] };
    try { q = seasonQualifiers(rows, fa, lc); } catch { /* lines are extra */ }
    return (pos, n) => {
      const club = rows[pos - 1]?.name;
      if (club && q.champions.includes(club)) return ZONE.ucl;
      if (club && q.europa.includes(club)) return ZONE.uel;
      return pos > n - l.down ? ZONE.down : null;
    };
  }
  const playOffWinner = summary.playOffWinners?.[division] ?? summary.playOffs.find(p => p.division === division)?.result.promoted;
  return (pos, n) => {
    const club = rows[pos - 1]?.name;
    if (pos <= l.up || (club && club === playOffWinner)) return ZONE.up;
    return pos > n - l.down ? ZONE.down : null;
  };
}

const euroZone = (p: number) => (p <= 8 ? "#10b981" : p <= 24 ? "#3b82f6" : "#ef4444");
const isEuro = (name: string) => name === "Champions League" || name === "Europa League";

function trophiesOf(career: CareerState, summary: WorldSummary): Trophy[] {
  const out: Trophy[] = [];
  for (const w of summary.winners) {
    if (/play-off/i.test(w.competition)) continue;
    if (out.some(t => t.competition === w.competition)) continue;
    const division = ALL_DIVISIONS.find(d => leagueNameFor(d) === w.competition);
    if (division) out.push({ kind: "league", competition: w.competition, club: w.club, division });
    else if (isEuro(w.competition)) out.push({ kind: "euro", competition: w.competition, club: w.club });
    else if ((summary.cups ?? []).some(c => c.competition === w.competition) || w.competition === "FA Cup" || w.competition === "League Cup") out.push({ kind: "cup", competition: w.competition, club: w.club });
    else out.push({ kind: "shield", competition: w.competition, club: w.club });
  }
  // A cup the winners list leaves out (the Lower League Trophy) still shows.
  for (const c of summary.cups ?? []) {
    if (c.winner && !out.some(t => t.competition === c.competition)) out.push({ kind: "cup", competition: c.competition, club: c.winner });
  }
  const rank = (c: string) => { const i = TROPHY_ORDER.indexOf(c); return i < 0 ? 99 : i; };
  out.sort((a, b) => rank(a.competition) - rank(b.competition));
  // Any international final played in the calendar year the season ended in.
  try {
    const endYear = career.player.startYear + summary.season;
    const finals = intlWorldOf(career).finals.filter(f => f.year === endYear);
    const order = intlCompetitions(career);
    finals.sort((a, b) => order.indexOf(a.comp) - order.indexOf(b.comp));
    for (const f of finals) {
      const winHome = f.home === f.winner;
      const score = `${winHome ? f.hs : f.as}-${winHome ? f.as : f.hs}${f.pens ? " (pens)" : ""}`;
      out.push({ kind: "intl", competition: f.comp, club: f.winner, runnerUp: f.runnerUp, score });
    }
  } catch { /* no international world on this save */ }
  return out;
}

function LastSeason({ career, summary, onNow, onClose }: { career: CareerState; summary: WorldSummary; onNow?: () => void; onClose?: () => void }) {
  const { glow } = useClubTheme(career);
  const [open, setOpen] = useState<Trophy | null>(null);
  const trophies = useMemo(() => trophiesOf(career, summary), [career, summary]);
  const you = career.thisSeasonClub ?? career.player.club;
  const groups: string[] = [];
  const groupOf = (t: Trophy) => (t.competition === "Super Cup" ? "Europe" : TROPHY_GROUP[t.kind]);
  for (const t of trophies) if (!groups.includes(groupOf(t))) groups.push(groupOf(t));

  if (open) {
    return (
      <div className="space-y-2" data-world-last-season={open.competition}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-[20px]">🏆</span>
            <span className="truncate text-[19px] font-black text-white">{open.competition}</span>
          </span>
          <CloseButton onClick={() => setOpen(null)} label="Back to every trophy" />
        </div>
        <TrophyDetail career={career} summary={summary} trophy={open} glow={glow} you={you} />
      </div>
    );
  }

  return (
    <div className="space-y-2" data-world-last-season>
      {(onClose || onNow) && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[22px] font-black text-white" style={{ fontFamily: "var(--font-display, inherit)" }}>Season {summary.season}</span>
          {onClose && <CloseButton onClick={onClose} />}
          {!onClose && onNow && <button type="button" onClick={onNow} className="rounded-lg px-3 py-2 text-[12px] font-black text-white" style={{ background: rgba(glow, 0.3) }}>← This season</button>}
        </div>
      )}
      <div className="px-1 text-[11.5px] font-bold text-white/85">Tap a trophy to see its table, scorers and assists.</div>
      {groups.map(g => (
        <div key={g} className="space-y-1.5">
          <CardTitle className="px-1 pt-1" tone="text-amber-300">{g}</CardTitle>
          {trophies.filter(t => groupOf(t) === g).map(t => {
            const tone = TROPHY_TONE[t.kind];
            const mine = t.club === you;
            return (
              <button key={t.competition} type="button" onClick={() => setOpen(t)} data-trophy={t.competition}
                className="kib-press flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left"
                style={{
                  background: `linear-gradient(90deg, ${rgba(tone, 0.32)}, ${rgba(tone, 0.12)} 60%, rgba(255,255,255,.04))`,
                  boxShadow: `inset 0 0 0 1px ${rgba(tone, mine ? 0.95 : 0.5)}${mine ? `, 0 0 16px -4px ${rgba(tone, 0.9)}` : ""}`,
                }}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[18px]" style={{ background: rgba(tone, 0.28) }}>🏆</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-black uppercase tracking-wider" style={{ color: tint(tone) }}>{t.competition}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    {t.kind === "intl" ? <NationFlag nation={t.club} width={20} rounded={2} /> : <ClubBadge club={t.club} size={20} />}
                    <span className="truncate text-[15px] font-black text-white">{t.kind === "intl" ? t.club : shortClub(t.club)}</span>
                    {mine && <span className="rounded-full bg-amber-300 px-1.5 text-[9px] font-black uppercase text-gray-950">You</span>}
                  </span>
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[20px] font-black text-white" style={{ background: rgba(tone, 0.4) }} aria-hidden>›</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** A lighter shade of a colour for small text on a dark row. */
function tint(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

function TrophyDetail({ career, summary, trophy, glow, you }: { career: CareerState; summary: WorldSummary; trophy: Trophy; glow: string; you: string }) {
  const name = trophy.competition;
  const table = summary.tables.find(t => t.name === name);
  const sc = summary.scorers.find(x => x.name === name);
  const asRows = (r: { player: string; club: string; n: number }[]): ScorerRow[] => r.map((x, i) => ({ id: `${i}`, ...x }));
  const final = (summary.finals ?? []).find(f => f.competition === name);
  const cup = (summary.cups ?? []).find(c => c.competition === name);
  const bracket = (summary.brackets ?? []).find(b => b.competition === name)?.bracket;
  type Tab = "table" | "knockout" | "rounds" | "final" | "goals" | "assists";
  const tabs: [Tab, string][] =
    trophy.kind === "league" ? [["table", "Table"], ["goals", "Goals"], ["assists", "Assists"]]
    : trophy.kind === "euro" ? [["table", "League"], ["knockout", "Knockout"], ["goals", "Goals"], ["assists", "Assists"]]
    : trophy.kind === "cup" ? [["rounds", "Rounds"], ["goals", "Goals"], ["assists", "Assists"]]
    : [["final", "Final"]];
  const [tab, setTab] = useState<Tab>(tabs[0][0]);

  if (trophy.kind === "intl") return <IntlCompPane career={career} comp={trophy.competition} nation={(() => { try { return intlOf(career).nation; } catch { return null; } })()} />;

  return (
    <div className="space-y-2">
      <WinnerBar club={trophy.club} glow={glow} />
      {tabs.length > 1 && <SegTabs value={tab} onChange={setTab} tabs={tabs} />}
      {tab === "table" && (table ? (
        <>
          <Table rows={table.rows} glow={glow} you={you}
            zone={trophy.kind === "league" ? finalZone(trophy.division, table.rows, summary) : euroZone} />
          <ZoneKey items={trophy.kind === "euro"
            ? [["#10b981", "Top 8: straight to the last 16"], ["#3b82f6", "9th to 24th: knockout play-off"], ["#ef4444", "Out"]]
            : LINES[(trophy as { division: CareerDivision }).division].europe
              ? [[ZONE.ucl, "Champions League"], [ZONE.uel, "Europa League"], [ZONE.down, "Relegated"]]
              : [[ZONE.up, "Promoted"], [ZONE.down, "Relegated"]]} />
        </>
      ) : <Empty text="No table kept for this one." />)}
      {tab === "knockout" && (bracket ? <EuroKnockout bracket={bracket} glow={glow} you={you} />
        : final ? <FinalCard final={final} glow={glow} /> : <Empty text="No knockout kept for this season." />)}
      {tab === "rounds" && (cup ? <CupKnockout cup={{ competition: name, rounds: cup.rounds } as unknown as CupState} glow={glow} you={you} review />
        : final ? <FinalCard final={final} glow={glow} /> : <Empty text="No rounds kept for this season." />)}
      {tab === "final" && (final ? <FinalCard final={final} glow={glow} /> : <Empty text="No final kept for this one." />)}
      {tab === "goals" && <Scorers rows={asRows(sc?.goals ?? [])} glow={glow} label="goals" />}
      {tab === "assists" && <Scorers rows={asRows(sc?.assists ?? [])} glow={glow} label="assists" />}
    </div>
  );
}

function FinalCard({ final, glow }: { final: NonNullable<WorldSummary["finals"]>[number]; glow: string }) {
  return <ShieldCard glow={glow} home={final.home} away={final.away} hs={final.hs} as={final.as} pens={final.pens} winner={final.winner} />;
}

function ZoneKey({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10.5px] font-bold text-white/85">
      {items.map(([c, l]) => <span key={l} className="flex items-center gap-1"><span className="h-3 w-[4px] rounded-sm" style={{ background: c }} />{l}</span>)}
    </div>
  );
}
