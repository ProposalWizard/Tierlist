"use client";
import { useMemo, useState } from "react";
import type { CareerState, LeagueTeam, LeagueResult } from "@/lib/star/types";
import { ALL_DIVISIONS, divisionOf, leagueNameFor, type CareerDivision } from "@/lib/star/calendar";
import { sortLeague } from "@/lib/star/season";
import { sortEuro } from "@/lib/star/euro";
import type { CupState } from "@/lib/star/cups";
import { koAggregate, type EuroBracket } from "@/lib/star/euroBracket";
import { worldOf, finishWorld, WORLD_LIVE } from "@/lib/star/world";
import { topOf, ownLeagueTop, type ScorerRow } from "@/lib/star/world/summary";
import type { WorldState, WorldSummary } from "@/lib/star/world/types";
import { shortClub } from "@/lib/star/media/grammar";
import ClubBadge from "./ClubBadge";
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
 */

type Comp =
  | { key: string; kind: "league"; label: string; division: CareerDivision }
  | { key: string; kind: "euro"; label: string; competition: "Champions League" | "Europa League" }
  | { key: string; kind: "cup"; label: string; competition: "FA Cup" | "League Cup" }
  | { key: string; kind: "shield"; label: string; competition: "Community Shield" | "Super Cup" };

const COMPS: Comp[] = [
  ...ALL_DIVISIONS.map(d => ({ key: d, kind: "league" as const, label: leagueNameFor(d), division: d })),
  { key: "fa", kind: "cup", label: "FA Cup", competition: "FA Cup" },
  { key: "lc", kind: "cup", label: "League Cup", competition: "League Cup" },
  { key: "ucl", kind: "euro", label: "Champions League", competition: "Champions League" },
  { key: "uel", kind: "euro", label: "Europa League", competition: "Europa League" },
  { key: "cs", kind: "shield", label: "Community Shield", competition: "Community Shield" },
  { key: "sc", kind: "shield", label: "Super Cup", competition: "Super Cup" },
];
const GROUPS: { title: string; keys: string[] }[] = [
  { title: "England", keys: ALL_DIVISIONS },
  { title: "Cups", keys: ["fa", "lc", "cs", "sc"] },
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

export default function WorldPane({ career, final = false, last = false }: {
  career: CareerState; final?: boolean;
  /** Open on last season (the season review, after the rollover). */
  last?: boolean;
}) {
  const [showLast, setShowLast] = useState(last && !!career.lastWorld);
  if (showLast && career.lastWorld) {
    return <LastSeason career={career} summary={career.lastWorld} onNow={last ? undefined : () => setShowLast(false)} />;
  }
  return <NowPane career={career} final={final} onLast={career.lastWorld ? () => setShowLast(true) : undefined} />;
}

function NowPane({ career, final, onLast }: { career: CareerState; final: boolean; onLast?: () => void }) {
  const { glow } = useClubTheme(career);
  const world = useMemo<WorldState>(() => (final ? finishWorld(career) : worldOf(career)), [career, final]);
  const yours = divisionOf(career);
  const [key, setKey] = useState<string>(yours);
  const [choosing, setChoosing] = useState(false);
  const comp = COMPS.find(c => c.key === key) ?? COMPS[0];
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
          <span className="text-[17px]">{comp.kind === "league" ? "🏆" : comp.kind === "euro" ? "⭐" : "🥇"}</span>
          <span className="text-[15px] font-black text-white">{comp.label}</span>
          {comp.kind === "league" && comp.division === yours && <span className="rounded-full bg-amber-300 px-1.5 text-[9px] font-black uppercase text-gray-950">Yours</span>}
        </span>
        <span className="text-[12px] font-bold text-white/85">Change ▾</span>
      </button>

      {!WORLD_LIVE && !final && <div className="rounded-lg bg-black/30 px-3 py-2 text-[11px] font-bold text-white">Other leagues are played at the end of the season.</div>}

      {comp.kind === "league" && <LeagueView career={career} world={world} division={comp.division} glow={glow} you={you} />}
      {comp.kind === "euro" && <EuroView career={career} world={world} competition={comp.competition} glow={glow} you={you} />}
      {comp.kind === "cup" && <CupView cup={comp.competition === "FA Cup"
        ? (career.cupState ?? []).find(c => c.competition === "FA Cup")
        : (career.cupState ?? []).find(c => c.competition === "League Cup") ?? world.leagueCup} glow={glow} you={you} />}
      {comp.kind === "shield" && <ShieldView career={career} world={world} competition={comp.competition} glow={glow} />}

      {choosing && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-gray-950/95 px-4 pb-8 pt-4" data-world-chooser>
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
            {GROUPS.map(g => (
              <div key={g.title} className="mb-3">
                <CardTitle className="mb-1 px-1" tone="text-amber-300">{g.title}</CardTitle>
                <div className="space-y-1">
                  {g.keys.map(k => {
                    const c = COMPS.find(x => x.key === k)!;
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

function Results({ results, glow, you, title }: { results: LeagueResult[]; glow: string; you: string; title: string }) {
  if (!results.length) return <Empty text="No games played yet." />;
  return (
    <ClubCard glow={glow} className="p-1.5">
      <CardTitle className="px-1 pb-1" tone="text-amber-300">{title}</CardTitle>
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
                  <div className="text-right">{(r.hg ?? []).map(g => `${g.s} ${g.m}'`).join(", ")}</div>
                  <div>{(r.ag ?? []).map(g => `${g.s} ${g.m}'`).join(", ")}</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </ClubCard>
  );
}

function Scorers({ rows, glow, label }: { rows: ScorerRow[]; glow: string; label: string }) {
  if (!rows.length) return <Empty text="No named players here yet." />;
  return (
    <ClubCard glow={glow} className="p-1.5">
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[22px_1fr_auto] items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 text-[12px] font-bold text-white">
            <span className="text-center font-black">{i + 1}</span>
            <span className="flex min-w-0 items-center gap-1.5">{r.club && <ClubBadge club={r.club} size={15} />}<span className="truncate">{r.player}</span></span>
            <span className="font-black tabular-nums">{r.n} <span className="text-[9px] text-white/70">{label}</span></span>
          </div>
        ))}
      </div>
    </ClubCard>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl bg-black/30 px-3 py-4 text-center text-[12px] font-bold text-white">{text}</div>;
}

// ── A league ────────────────────────────────────────────────────────────────

function LeagueView({ career, world, division, glow, you }: { career: CareerState; world: WorldState; division: CareerDivision; glow: string; you: string }) {
  const [tab, setTab] = useState<"table" | "results" | "goals" | "assists">("table");
  const own = division === divisionOf(career);
  const lg = own ? null : world.leagues.find(l => l.division === division);
  const rows = own ? sortLeague(career.league) : lg ? sortLeague(lg.teams) : [];
  const ownResults = (() => {
    const all = career.results ?? [];
    const last = Math.max(0, ...all.map(r => r.week));
    return all.filter(r => r.week === last);
  })();
  const results = own ? ownResults : lg?.last ?? [];
  const round = own ? (ownResults[0]?.week ?? 0) : lg?.played ?? 0;
  const goals = own ? ownLeagueTop(career, 0) : lg ? topOf(career, lg.scorers, 0) : [];
  const assists = own ? ownLeagueTop(career, 1) : lg ? topOf(career, lg.scorers, 1) : [];
  return (
    <div className="space-y-2">
      <SegTabs value={tab} onChange={setTab} tabs={[["table", "Table"], ["results", "Results"], ["goals", "Goals"], ["assists", "Assists"]] as const} />
      {tab === "table" && (rows.length ? <Table rows={rows} glow={glow} you={you} zone={(p, n) => zoneColour(division, p, n)} /> : <Empty text="No table for this league." />)}
      {tab === "results" && <Results results={results} glow={glow} you={you} title={round ? `Round ${round}` : "Latest round"} />}
      {tab === "goals" && <Scorers rows={goals} glow={glow} label="goals" />}
      {tab === "assists" && <Scorers rows={assists} glow={glow} label="assists" />}
    </div>
  );
}

// ── Europe ──────────────────────────────────────────────────────────────────

function EuroView({ career, world, competition, glow, you }: { career: CareerState; world: WorldState; competition: "Champions League" | "Europa League"; glow: string; you: string }) {
  const [tab, setTab] = useState<"table" | "knockout" | "goals">("table");
  const mine = career.euroState?.competition === competition ? career.euroState : null;
  const w = world.europe.find(e => e.competition === competition);
  const table = mine ? sortEuro(mine.table ?? mine.liveTable) : w ? sortEuro(w.table) : [];
  const rows: LeagueTeam[] = table.map(r => ({ name: r.name, strength: 0, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points }));
  const bracket = mine?.bracket ?? w?.bracket;
  const winner = mine?.winner ?? w?.winner;
  const goals = w ? topOf(career, w.scorers, 0) : [];
  return (
    <div className="space-y-2">
      {winner && <WinnerBar club={winner} glow={glow} />}
      <SegTabs value={tab} onChange={setTab} tabs={[["table", "League phase"], ["knockout", "Knockout"], ["goals", "Goals"]] as const} />
      {tab === "table" && (rows.length ? <Table rows={rows} glow={glow} you={you} zone={(p) => (p <= 8 ? "#10b981" : p <= 24 ? "#3b82f6" : "#ef4444")} /> : <Empty text="Not started yet." />)}
      {tab === "knockout" && (bracket ? <Bracket bracket={bracket} glow={glow} you={you} /> : <Empty text="The knockout starts after the league phase." />)}
      {tab === "goals" && (mine ? <Empty text="Scorers are kept for the competitions you're not in." /> : <Scorers rows={goals} glow={glow} label="goals" />)}
    </div>
  );
}

function Bracket({ bracket, glow, you }: { bracket: EuroBracket; glow: string; you: string }) {
  const rounds = bracket.rounds.filter(r => r.ties.some(t => t.a && t.b));
  return (
    <div className="space-y-2">
      {[...rounds].reverse().map(r => (
        <ClubCard key={r.name} glow={glow} className="p-1.5">
          <CardTitle className="px-1 pb-1" tone="text-amber-300">{r.name}</CardTitle>
          <div className="space-y-1">
            {r.ties.filter(t => t.a && t.b).map((t, i) => {
              const agg = koAggregate(t);
              const yours = t.a === you || t.b === you;
              return (
                <div key={i} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-white ${yours ? "" : "bg-white/[0.04]"}`} style={yours ? youRowStyle(glow) : undefined}>
                  <span className={`truncate text-right ${t.winner === t.a ? "font-black" : "text-white/80"}`}>{shortClub(t.a!)}</span>
                  <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums">{agg ? `${agg.a}-${agg.b}` : "v"}</span>
                  <span className={`truncate ${t.winner === t.b ? "font-black" : "text-white/80"}`}>{shortClub(t.b!)}</span>
                  {t.pens && <span className="col-span-3 text-center text-[9.5px] font-bold text-amber-300">{t.pens.a}-{t.pens.b} on penalties</span>}
                </div>
              );
            })}
          </div>
        </ClubCard>
      ))}
    </div>
  );
}

// ── Cups and shields ────────────────────────────────────────────────────────

function CupView({ cup, glow, you }: { cup?: CupState; glow: string; you: string }) {
  if (!cup) return <Empty text="This cup isn't being played this season." />;
  return (
    <div className="space-y-2">
      {cup.winner && <WinnerBar club={cup.winner} glow={glow} />}
      {[...cup.rounds].reverse().map(r => (
        <ClubCard key={r.name} glow={glow} className="p-1.5">
          <CardTitle className="px-1 pb-1" tone="text-amber-300">{r.name}</CardTitle>
          <div className="space-y-1">
            {r.ties.map(t => {
              const yours = t.home === you || t.away === you;
              const done = t.hs !== undefined;
              return (
                <div key={`${t.home}-${t.away}`} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-white ${yours ? "" : "bg-white/[0.04]"}`} style={yours ? youRowStyle(glow) : undefined}>
                  <span className="truncate text-right">{shortClub(t.home)}</span>
                  <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums">{done ? `${t.hs}-${t.as}` : "v"}</span>
                  <span className="truncate">{shortClub(t.away)}</span>
                  {t.pens && <span className="col-span-3 text-center text-[9.5px] font-bold text-amber-300">{t.pens.home}-{t.pens.away} on penalties</span>}
                </div>
              );
            })}
          </div>
        </ClubCard>
      ))}
    </div>
  );
}

function ShieldView({ career, world, competition, glow }: { career: CareerState; world: WorldState; competition: "Community Shield" | "Super Cup"; glow: string }) {
  const yours = career.fixtures.find(f => f.competition === competition);
  const s = world.shields.find(x => x.competition === competition);
  if (yours) {
    const home = yours.home ? career.player.club : yours.opponent;
    const away = yours.home ? yours.opponent : career.player.club;
    return <ShieldCard glow={glow} home={home} away={away} hs={yours.played ? yours.homeScore : undefined} as={yours.played ? yours.awayScore : undefined} />;
  }
  if (!s) return <Empty text={`No ${competition} this season.`} />;
  return <ShieldCard glow={glow} home={s.home} away={s.away} hs={s.hs} as={s.as} pens={s.pens} winner={s.winner} />;
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

// ── Last season (career.lastWorld) ──────────────────────────────────────────

function LastSeason({ career, summary, onNow }: { career: CareerState; summary: WorldSummary; onNow?: () => void }) {
  const { glow } = useClubTheme(career);
  const names = ["Winners", ...summary.tables.map(t => t.name)];
  const [pick, setPick] = useState("Winners");
  const [choosing, setChoosing] = useState(false);
  const [tab, setTab] = useState<"table" | "goals" | "assists">("table");
  const table = summary.tables.find(t => t.name === pick);
  const sc = summary.scorers.find(x => x.name === pick);
  const you = career.thisSeasonClub ?? career.player.club;
  const asRows = (r: { player: string; club: string; n: number }[]): ScorerRow[] => r.map((x, i) => ({ id: `${i}`, ...x }));
  return (
    <div className="space-y-2" data-world-last-season>
      <button type="button" onClick={() => setChoosing(true)} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left" style={{ background: rgba(glow, 0.28), boxShadow: `inset 0 0 0 1px ${rgba(glow, 0.7)}` }}>
        <span className="text-[15px] font-black text-white">📜 {pick}</span>
        <span className="text-[12px] font-bold text-white/85">Change ▾</span>
      </button>
      {pick === "Winners" ? (
        <div className="space-y-2">
          <ClubCard glow={glow} className="p-1.5">
            <CardTitle className="px-1 pb-1" tone="text-amber-300">Every trophy</CardTitle>
            <div className="space-y-1">
              {summary.winners.map(w => (
                <div key={w.competition} className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2 py-1.5 text-[12px] font-bold text-white">
                  <span className="min-w-0 flex-1 truncate text-white/85">{w.competition}</span>
                  <ClubBadge club={w.club} size={16} /><span className="font-black">{shortClub(w.club)}</span>
                </div>
              ))}
            </div>
          </ClubCard>
          {(summary.finals ?? []).length > 0 && (
            <ClubCard glow={glow} className="p-1.5">
              <CardTitle className="px-1 pb-1" tone="text-amber-300">Finals</CardTitle>
              <div className="space-y-1">
                {(summary.finals ?? []).map(f => (
                  <div key={f.competition} className="rounded-lg bg-white/[0.05] px-2 py-1.5 text-[11px] font-bold text-white">
                    <div className="text-[9px] font-black uppercase tracking-wider text-white/70">{f.competition}</div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                      <span className={`truncate text-right ${f.winner === f.home ? "font-black" : "text-white/80"}`}>{shortClub(f.home)}</span>
                      <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums">{f.hs !== undefined ? `${f.hs}-${f.as}` : "v"}</span>
                      <span className={`truncate ${f.winner === f.away ? "font-black" : "text-white/80"}`}>{shortClub(f.away)}</span>
                    </div>
                    {f.pens && <div className="text-center text-[9.5px] text-amber-300">{f.pens.home}-{f.pens.away} on penalties</div>}
                  </div>
                ))}
              </div>
            </ClubCard>
          )}
          {summary.playOffs.length > 0 && (
            <ClubCard glow={glow} className="p-1.5">
              <CardTitle className="px-1 pb-1" tone="text-amber-300">Play-off finals</CardTitle>
              <div className="space-y-1">
                {summary.playOffs.map(p => (
                  <div key={p.division} className="rounded-lg bg-white/[0.05] px-2 py-1.5 text-[11px] font-bold text-white">
                    <div className="text-[9px] font-black uppercase tracking-wider text-white/70">{leagueNameFor(p.division)}</div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                      <span className={`truncate text-right ${p.result.final.winner === p.result.final.home ? "font-black" : "text-white/80"}`}>{shortClub(p.result.final.home)}</span>
                      <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums">{p.result.final.hs}-{p.result.final.as}</span>
                      <span className={`truncate ${p.result.final.winner === p.result.final.away ? "font-black" : "text-white/80"}`}>{shortClub(p.result.final.away)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ClubCard>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <SegTabs value={tab} onChange={setTab} tabs={[["table", "Table"], ["goals", "Goals"], ["assists", "Assists"]] as const} />
          {tab === "table" && table && <Table rows={table.rows} glow={glow} you={you} zone={table.division ? (p, n) => zoneColour(table.division!, p, n) : undefined} />}
          {tab === "goals" && <Scorers rows={asRows(sc?.goals ?? [])} glow={glow} label="goals" />}
          {tab === "assists" && <Scorers rows={asRows(sc?.assists ?? [])} glow={glow} label="assists" />}
        </div>
      )}
      {choosing && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-gray-950/95 px-4 pb-8 pt-4">
          <div className="mx-auto max-w-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[18px] font-black text-white">Last season</span>
              <button type="button" onClick={() => setChoosing(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-lg font-black text-white" aria-label="Close">✕</button>
            </div>
            {onNow && (
              <button type="button" onClick={() => { setChoosing(false); onNow(); }} className="mb-3 w-full rounded-lg px-3 py-3 text-left text-[14px] font-black text-white" style={{ background: rgba(glow, 0.3) }}>← This season</button>
            )}
            <div className="space-y-1">
              {names.map(n => (
                <button key={n} type="button" onClick={() => { setPick(n); setChoosing(false); }} className="flex w-full items-center rounded-lg px-3 py-3 text-left text-[14px] font-bold text-white" style={n === pick ? youRowStyle(glow) : { background: "rgba(255,255,255,.06)" }}>{n}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
