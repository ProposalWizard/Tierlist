"use client";

/**
 * THE INTERNATIONAL PIECES, in the League screen's own look (Mikey, 12 Oct
 * 2026: "more the same design style ... the league table, all that"): the
 * same glass cards (ClubCard), tab strip (SegTabs), table rows with zone
 * bands and your row lit, the results board with ← → between matchdays, and
 * the Training screen's stat card for the national manager.
 *
 * Used by: the squad announcement (CallUpScreen), Stats → Country
 * (IntlWorldPanel), national-duty mode (League tab and Home while you're
 * away with your country), and the watched-match screen (not picked).
 */
import { useMemo, useState } from "react";
import { intlSeason, scorerLines, type IntlSeason } from "@/lib/star/intl/scorers";
import type React from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import {
  SQUAD_AT, START_AT, intlOf, managerLine, roundsOf, groupOf, squadFor, worldOf,
  type DutyView, type GroupView, type MatchView, type RoundView,
} from "@/lib/star/intl/career";
import { nationKits } from "@/lib/star/international";
import { fixtureTimestamp, divisionOf } from "@/lib/star/calendar";
import NationFlag from "./NationFlag";
import { ClubCard, Glow, PressButton, RiseIn, SquareBar, KitStyles, glowOf, rgba, tint } from "./ui";
import { SegTabs, CardTitle, youRowStyle } from "./screenKit";

export const nationGlow = (nation: string) => {
  const k = nationKits(nation).home;
  return glowOf(k.shirt, k.trim);
};

const dayLabel = (t: number) => new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// ── The national manager, as a Training stat card ─────────────────────────

export function ManagerCard({ value, nation, line }: { value: number; nation: string; line: string }) {
  const v = Math.round(value);
  const [c1, c2] = v >= START_AT ? ["#f59e0b", "#fde68a"] : v >= SQUAD_AT ? ["#38bdf8", "#a5f3fc"] : ["#94a3b8", "#e2e8f0"];
  const verdict = v >= START_AT ? "Starter" : v >= SQUAD_AT ? "In the squad" : "Not picked";
  return (
    <div
      data-intl-manager
      className="relative overflow-hidden rounded-2xl p-3"
      style={{
        background: `radial-gradient(120% 140% at 0% 0%, ${rgba(c1, 0.3)} 0%, transparent 55%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96)))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px ${rgba(c1, 0.32)}, 0 10px 24px -12px rgba(0,0,0,.8)`,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center">
          <Glow color={c1} alpha={0.45} className="inset-0.5 blur-md" />
          <span
            className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl"
            style={{ background: `linear-gradient(180deg, ${rgba(c1, 0.35)}, ${rgba(tint(c1, -0.4), 0.35)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.25), inset 0 0 0 1px ${rgba(c1, 0.5)}` }}
          >
            <NationFlag nation={nation} width={30} rounded={2} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-black leading-tight text-white">{nation} manager</div>
          <div className="text-[10.5px] font-bold leading-snug text-white/75">{line}</div>
        </div>
        <div className="shrink-0 text-center">
          <div className="text-[24px] font-black leading-none tabular-nums" style={{ color: c2, textShadow: `0 0 12px ${rgba(c1, 0.7)}` }}>{v}</div>
          <div className="mt-0.5 text-[10px] font-black uppercase tracking-wide" style={{ color: c2 }}>{verdict}</div>
        </div>
      </div>
      <div className="relative mt-2.5">
        <SquareBar value={v} colors={[c1, c2]} className="h-3" animate />
        <span className="pointer-events-none absolute -top-0.5 h-4 w-[2px] bg-white" style={{ left: `${SQUAD_AT}%` }} />
        <span className="pointer-events-none absolute -top-0.5 h-4 w-[2px] bg-amber-300" style={{ left: `${START_AT}%` }} />
      </div>
      <div className="relative mt-1 h-3.5 text-[9.5px] font-black uppercase tracking-wide">
        <span className="absolute -translate-x-1/2 text-white/85" style={{ left: `${SQUAD_AT}%` }}>Squad {SQUAD_AT}</span>
        <span className="absolute -translate-x-1/2 text-amber-300" style={{ left: `${START_AT}%` }}>Starter {START_AT}</span>
      </div>
    </div>
  );
}

// ── A group table, League-table style ──────────────────────────────────────

const COLS = "grid-cols-[24px_1fr_26px_26px_26px_30px_32px] px-2 gap-1";

export function NationTable({ group, nation, glow, through = 2 }: { group: GroupView; nation: string; glow: string; through?: number }) {
  return (
    <ClubCard glow={glow} className="overflow-hidden" data-intl-table>
      <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-2.5 py-1.5">
        <CardTitle tone="text-amber-300">{group.title}</CardTitle>
      </div>
      <div className={`grid ${COLS} border-b border-white/10 bg-black/30 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/55`}>
        <div className="text-center">#</div><div>Nation</div>
        <div className="text-center">P</div><div className="text-center">W</div><div className="text-center">D</div>
        <div className="text-center">GD</div><div className="text-center text-white/80">Pts</div>
      </div>
      {group.rows.map((r, i) => {
        const you = r.name === nation;
        const band = i < through ? (i === 0 ? "#fbbf24" : "#22c55e") : null;
        return (
          <div
            key={r.name}
            className={`relative grid ${COLS} items-center py-1.5 text-[11px] font-bold text-white ${you ? "z-10 rounded-md" : i % 2 === 0 ? "bg-white/[0.035]" : ""}`}
            style={you ? youRowStyle(glow) : undefined}
          >
            {band && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[3px]" style={{ background: band, boxShadow: `0 0 8px ${rgba(band, 0.9)}` }} />}
            <div className="relative text-center font-black">{i + 1}</div>
            <div className="relative flex min-w-0 items-center gap-1.5">
              <NationFlag nation={r.name} width={18} rounded={2} />
              <span className={`truncate ${you ? "font-black" : ""}`}>{r.name}</span>
            </div>
            <div className="relative text-center text-white/85">{r.p}</div>
            <div className="relative text-center text-white/85">{r.w}</div>
            <div className="relative text-center text-white/85">{r.d}</div>
            <div className="relative text-center text-white/85">{r.gd > 0 ? `+${r.gd}` : r.gd}</div>
            <div className={`relative text-center font-black ${you ? "text-yellow-200" : ""}`}>{r.pts}</div>
          </div>
        );
      })}
    </ClubCard>
  );
}

// ── Match rows and the results board ───────────────────────────────────────

/** Scorer lines for a results row, from the season's named goals. */
export type ScorerLookup = (m: MatchView) => { home: string[]; away: string[] } | null;

/** Every named international goal this Ballon d'Or year, as a row lookup. */
export function useScorers(career: CareerState): ScorerLookup {
  const season = useMemo<IntlSeason | null>(() => { try { return intlSeason(career); } catch { return null; } }, [career]);
  return (m) => (season && m.id ? scorerLines(career, season, m.id, m.home) : null);
}

function ScorerLine({ goals }: { goals: { home: string[]; away: string[] } }) {
  if (!goals.home.length && !goals.away.length) return null;
  return (
    <div className="col-span-3 grid grid-cols-[1fr_auto_1fr] gap-1.5 text-[9.5px] font-bold leading-snug text-white/85" data-intl-scorers>
      <span className="text-right">{goals.home.join(", ")}</span>
      <span className="w-[34px]" aria-hidden>{goals.home.length || goals.away.length ? "⚽" : ""}</span>
      <span>{goals.away.join(", ")}</span>
    </div>
  );
}

export function MatchRow({ m, glow, nation, scorers }: { m: MatchView; glow: string; nation?: string; scorers?: ScorerLookup }) {
  const goals = scorers ? scorers(m) : null;
  const mine = m.mine || (nation ? m.home === nation || m.away === nation : false);
  const done = m.hs !== undefined && m.as !== undefined;
  const [ph, pa] = m.pens ? m.pens.split(" ")[0].split("-").map(Number) : [0, 0];
  const homeWon = done && (m.hs! > m.as! || (m.hs === m.as && ph > pa));
  const awayWon = done && (m.as! > m.hs! || (m.hs === m.as && pa > ph));
  return (
    <div
      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-white ${mine ? "" : "bg-white/[0.04]"}`}
      style={mine ? youRowStyle(glow) : undefined}
    >
      <span className={`flex min-w-0 items-center justify-end gap-1.5 ${homeWon ? "font-black" : "text-white/85"}`}>
        <span className="truncate text-right">{m.home}</span>
        <NationFlag nation={m.home} width={18} rounded={2} />
      </span>
      <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums ring-1 ring-white/10">
        {done ? `${m.hs}-${m.as}` : "v"}
      </span>
      <span className={`flex min-w-0 items-center gap-1.5 ${awayWon ? "font-black" : "text-white/85"}`}>
        <NationFlag nation={m.away} width={18} rounded={2} />
        <span className="truncate">{m.away}</span>
      </span>
      {m.pens && <span className="col-span-3 text-center text-[9.5px] font-bold text-amber-300">{m.pens}</span>}
      {goals && <ScorerLine goals={goals} />}
    </div>
  );
}

export function ResultsBoard({ rounds, glow, start, nation, scorers }: { rounds: RoundView[]; glow: string; start?: number; nation?: string; scorers?: ScorerLookup }) {
  const [i, setI] = useState(() => start ?? Math.max(0, rounds.length - 1));
  const r = rounds[Math.min(i, rounds.length - 1)];
  return (
    <ClubCard glow={glow} className="overflow-hidden" data-intl-results>
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/30 px-2 py-1.5">
        <PressButton onClick={() => setI(i - 1)} disabled={i <= 0} aria-label="Previous matchday" variant="secondary" size="none" className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black">←</PressButton>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">{r ? r.title : "No matches yet"}</div>
          {r && <div className="text-[9.5px] font-bold text-white/75">{dayLabel(r.date)}</div>}
        </div>
        <PressButton onClick={() => setI(i + 1)} disabled={i >= rounds.length - 1} aria-label="Next matchday" variant="secondary" size="none" className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black">→</PressButton>
      </div>
      <div className="space-y-1 p-1.5">
        {r?.matches.map((m, k) => <MatchRow key={k} m={m} glow={glow} nation={nation} scorers={scorers} />)}
      </div>
    </ClubCard>
  );
}

// ── The national squad ─────────────────────────────────────────────────────

const OVR = (o: number) => o >= 85 ? "bg-gradient-to-b from-yellow-300 to-amber-500 text-gray-950"
  : o >= 75 ? "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white"
  : o >= 65 ? "bg-gradient-to-b from-sky-400 to-sky-600 text-white"
  : "bg-gradient-to-b from-gray-500 to-gray-700 text-white";

export function NationSquad({ career, nation, glow, size = 23 }: { career: CareerState; nation: string; glow: string; size?: 23 | 26 }) {
  const squad = squadFor(career, nation, size);
  const you = `${career.player.firstName} ${career.player.lastName}`;
  return (
    <ClubCard glow={glow} className="overflow-hidden" data-intl-squad>
      <div className="border-b border-white/10 bg-black/30 px-2.5 py-1.5"><CardTitle tone="text-amber-300">{nation} squad · {size + 1}</CardTitle></div>
      <div className="space-y-0.5 p-1.5">
        <div className="grid grid-cols-[34px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] font-black text-white" style={youRowStyle(glow)}>
          <span className="text-center text-[10px] text-white/85">{career.playAs ?? career.player.position}</span>
          <span className="truncate">{you} (you)</span>
          <span className="text-[10px] text-yellow-200">★</span>
        </div>
        {squad.map((p, i) => (
          <div key={p.id} className={`grid grid-cols-[34px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1 text-[11px] font-bold text-white ${i % 2 === 0 ? "bg-white/[0.04]" : ""}`}>
            <span className="text-center text-[10px] font-black text-white/70">{p.position}</span>
            <span className="truncate">{p.name}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums ${OVR(p.overall ?? 60)}`}>{p.overall}</span>
          </div>
        ))}
      </div>
    </ClubCard>
  );
}

// ── National duty: the League tab while you're away ────────────────────────

export function DutyBanner({ duty, onClub }: { duty: DutyView; onClub?: () => void }) {
  const glow = nationGlow(duty.nation);
  return (
    <ClubCard glow={glow} strength={0.45} className="relative overflow-hidden p-2.5" data-intl-duty>
      <div className="flex items-center gap-2.5">
        <NationFlag nation={duty.nation} width={34} rounded={3} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">On international duty</div>
          <div className="truncate text-[13.5px] font-black text-white">{duty.nation} · {duty.period.label}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[18px] font-black leading-none tabular-nums text-white">{duty.played}<span className="text-[11px] text-white/60">/{duty.total}</span></div>
          <div className="text-[9px] font-black uppercase tracking-wide text-white/75">played</div>
        </div>
      </div>
      {onClub && (
        <button onClick={onClub} className="kib-press mt-2 w-full rounded-lg bg-white/10 py-1 text-[10.5px] font-black uppercase tracking-wide text-white">
          Your club&apos;s tables ›
        </button>
      )}
    </ClubCard>
  );
}

export function NationalLeague({ career, duty, onClub }: { career: CareerState; duty: DutyView; onClub?: () => void }) {
  const [view, setView] = useState<"table" | "results" | "fixtures" | "squad">("table");
  const scorers = useScorers(career);
  const nation = duty.nation;
  const glow = nationGlow(nation);
  const rounds = roundsOf(career, duty.period);
  const playedRounds = rounds.filter((r) => r.matches[0].hs !== undefined);
  const w = worldOf(career);
  const groups: GroupView[] = [];
  const seen = new Set<string>();
  for (const m of duty.period.matches) {
    if (!m.group || seen.has(`${m.edition}|${m.group}`)) continue;
    seen.add(`${m.edition}|${m.group}`);
    const g = groupOf(career, m);
    if (g) groups.push(g);
  }
  void w;
  const tournament = duty.period.kind === "tournament";
  return (
    <div className="mt-2 space-y-2" data-national-league>
      <RiseIn><DutyBanner duty={duty} onClub={onClub} /></RiseIn>
      <SegTabs value={view} onChange={setView} tabs={[["table", "Table"], ["results", "Results"], ["fixtures", "Fixtures"], ["squad", "Squad"]] as const} />
      {view === "table" && (
        <RiseIn key="t" className="space-y-2">
          {groups.length ? groups.map((g) => <NationTable key={g.title} group={g} nation={nation} glow={glow} through={tournament ? 2 : 1} />)
            : <ClubCard glow={glow} className="p-3 text-[12px] font-bold text-white">{duty.period.matches.every((m) => m.comp === "International Friendly") ? "Friendlies: no table this break." : "Knockout games: see Results and Fixtures."}</ClubCard>}
        </RiseIn>
      )}
      {view === "results" && (
        <RiseIn key="r">
          {playedRounds.length ? <ResultsBoard rounds={playedRounds} glow={glow} nation={nation} scorers={scorers} />
            : <ClubCard glow={glow} className="p-3 text-[12px] font-bold text-white">No games played yet this {tournament ? "tournament" : "break"}.</ClubCard>}
        </RiseIn>
      )}
      {view === "fixtures" && (
        <RiseIn key="f">
          <ClubCard glow={glow} className="overflow-hidden">
            <div className="border-b border-white/10 bg-black/30 px-2.5 py-1.5"><CardTitle tone="text-amber-300">{nation}&apos;s matches · {duty.period.label}</CardTitle></div>
            <div className="space-y-1 p-1.5">
              {rounds.map((r, k) => (
                <div key={k}>
                  <div className="px-1 pb-0.5 pt-1 text-[9.5px] font-bold text-white/75">{dayLabel(r.date)} · {r.title}</div>
                  <MatchRow m={r.matches[0]} glow={glow} nation={nation} />
                </div>
              ))}
            </div>
          </ClubCard>
        </RiseIn>
      )}
      {view === "squad" && <RiseIn key="s"><NationSquad career={career} nation={nation} glow={glow} size={tournament ? 26 : 23} /></RiseIn>}
    </div>
  );
}

// ── Home while on duty: the group, as the league dropdown ─────────────────

export function NationDropdown({ career, duty, onOpen }: { career: CareerState; duty: DutyView; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const m = duty.period.matches.find((x) => x.group);
  const g = m ? groupOf(career, m) : null;
  const pos = g ? g.rows.findIndex((r) => r.name === duty.nation) + 1 : 0;
  const glow = nationGlow(duty.nation);
  return (
    <div className="relative z-20" data-home-duty>
      <button
        type="button"
        onClick={() => (g ? setOpen((o) => !o) : onOpen?.())}
        className="kib-press flex w-full items-center justify-between gap-2 px-3 text-left"
        style={{ height: 24, background: `linear-gradient(90deg, ${rgba(glow, 0.45)}, rgba(0,0,0,.2))`, textShadow: "0 1px 3px rgba(0,0,0,.85)" }}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-black uppercase leading-none tracking-[0.12em] text-white">
          <NationFlag nation={duty.nation} width={16} rounded={2} />
          <span className="truncate">On duty · {g ? g.title : duty.period.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 leading-none">
          {pos > 0 && <span className="text-[13px] font-black tabular-nums text-yellow-200">{pos}<span className="text-[9px]">{pos === 1 ? "st" : pos === 2 ? "nd" : pos === 3 ? "rd" : "th"}</span></span>}
          <span className="text-[12px] font-black text-white">{g ? (open ? "▴" : "▾") : "›"}</span>
        </span>
      </button>
      {open && g && (
        <div className="absolute inset-x-0 top-full px-2 pt-1" style={{ background: "rgb(4,10,16)", boxShadow: "0 8px 18px rgba(0,0,0,.5)" }}>
          <NationTable group={g} nation={duty.nation} glow={glow} />
          {onOpen && <button onClick={onOpen} className="kib-press my-1 w-full rounded-lg bg-white/10 py-1 text-[10.5px] font-black uppercase text-white">Full {duty.nation} page ›</button>}
        </div>
      )}
    </div>
  );
}

// ── Not picked: the match you watched (Plan B) ─────────────────────────────

export function WatchedScreen({ career, fixture, onContinue }: { career: CareerState; fixture: Fixture; onContinue: () => void }) {
  const s = intlOf(career);
  const nation = s.nation;
  const glow = nationGlow(nation);
  const scorers = useScorers(career);
  const w = worldOf(career);
  const m = fixture.intlId ? w.byId.get(fixture.intlId) : undefined;
  const goals = m ? scorers({ id: m.id, date: m.date, comp: m.comp, stage: m.stage, home: m.home, away: m.away }) : null;
  // The card is drawn in your terms (you on the side the fixture says).
  const flip = m ? (m.home === nation) !== !!fixture.home : false;
  const cardGoals = goals ? (flip ? { home: goals.away, away: goals.home } : goals) : null;
  const rounds = m ? roundsOf(career, { key: "x", kind: "window", label: "", matches: [m], start: m.date, end: m.date }) : [];
  const g = m ? groupOf(career, m) : null;
  const t = fixtureTimestamp(career.player.startYear, career.season, fixture.week, fixture.kind, divisionOf(career));
  const us = fixture.home ? fixture.homeScore : fixture.awayScore;
  const them = fixture.home ? fixture.awayScore : fixture.homeScore;
  const verdict = us === undefined || them === undefined ? "" : us > them ? "WIN" : us < them ? "DEFEAT" : "DRAW";
  return (
    <div className="relative min-h-[100dvh] bg-[#05080f] px-3 pb-8 pt-5 text-white" data-intl-watched>
      <KitStyles />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72" style={{ background: `radial-gradient(70% 80% at 50% 0%, ${rgba(glow, 0.4)}, transparent 70%)` }} />
      <div className="relative mx-auto max-w-md space-y-2.5">
        <RiseIn index={0}>
          <div className="text-center text-[10.5px] font-black uppercase tracking-[0.22em] text-amber-300">📺 Watched on TV · {dayLabel(t)}</div>
          <div className="mt-1 text-center text-[12px] font-bold text-white/85">{fixture.competition} · {fixture.round}</div>
        </RiseIn>
        <RiseIn index={1}>
          <ClubCard duel={[nationGlow(fixture.home ? nation : fixture.opponent), nationGlow(fixture.home ? fixture.opponent : nation)]} className="p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <NationFlag nation={fixture.home ? nation : fixture.opponent} width={56} rounded={4} />
                <span className="text-center text-[13px] font-black leading-tight">{fixture.home ? nation : fixture.opponent}</span>
              </div>
              <div className="text-center">
                <div className="text-[40px] font-black leading-none tabular-nums">{fixture.homeScore ?? "-"}–{fixture.awayScore ?? "-"}</div>
                {verdict && <div className={`mt-1 text-[11px] font-black tracking-[0.2em] ${verdict === "WIN" ? "text-emerald-300" : verdict === "DEFEAT" ? "text-red-300" : "text-white/80"}`}>{nation.toUpperCase()} {verdict}</div>}
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <NationFlag nation={fixture.home ? fixture.opponent : nation} width={56} rounded={4} />
                <span className="text-center text-[13px] font-black leading-tight">{fixture.home ? fixture.opponent : nation}</span>
              </div>
            </div>
            {cardGoals && (cardGoals.home.length > 0 || cardGoals.away.length > 0) && (
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-2 text-[11px] font-bold text-white" data-intl-watched-scorers>
                <div className="text-right">{cardGoals.home.map((x) => <div key={x}>{x}</div>)}</div>
                <div>{cardGoals.away.map((x) => <div key={x}>{x}</div>)}</div>
              </div>
            )}
          </ClubCard>
        </RiseIn>
        {g && <RiseIn index={2}><NationTable group={g} nation={nation} glow={glow} /></RiseIn>}
        {rounds[0] && rounds[0].matches.length > 1 && <RiseIn index={3}><ResultsBoard rounds={rounds} glow={glow} nation={nation} scorers={scorers} /></RiseIn>}
        <RiseIn index={4}><ManagerCard value={s.manager} nation={nation} line={managerLine(career)} /></RiseIn>
        <RiseIn index={5}>
          <PressButton variant="gold" size="none" onClick={onContinue} className="w-full rounded-2xl py-3.5 text-[15px] font-black uppercase">Continue →</PressButton>
        </RiseIn>
      </div>
    </div>
  );
}
