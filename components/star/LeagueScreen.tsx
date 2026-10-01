"use client";
import { useEffect, useState } from "react";
import type React from "react";
import { fixtureDateLabel, fixtureTimestamp, isPostSeason, divisionOf, leagueNameFor, type CareerDivision } from "@/lib/star/calendar";
import { displayOverall } from "@/lib/star/rating";
import { starLevel } from "@/lib/star/starPoints";
import type { CareerState } from "@/lib/star/types";
import { sortLeague } from "@/lib/star/season";
import { nationOf, nextFixtureFor } from "@/lib/star/competitions";
import { exitRound } from "@/lib/star/cups";
import { sortEuro, knockoutSlots } from "@/lib/star/euro";
import { goldenBootRace, assistRace } from "@/lib/star/recognition";
import { groupedGoalLines, shortClub } from "@/lib/star/media/grammar";
import { playerMarketValue } from "@/lib/star/marketValue";
import { formatMoney } from "@/lib/star/money";
import { faceOrFake } from "@/lib/star/fakeFaces";
import { kitsOf } from "@/lib/star/kits";
import ImageWithFallback from "@/components/ImageWithFallback";
import ClubBadge from "./ClubBadge";
import { ClubCard, RiseIn, Shine, PressButton, prefersReducedMotion, rgba, useClubTheme } from "./ui";
import { SegTabs, ChipTabs, CardTitle, seenScope, youRowStyle } from "./screenKit";

/**
 * THE LEAGUE — table, results, fixtures, awards, squad, cups and Europe.
 *
 * Reskinned 28 Sep 2026 to the home screen's look (Harry: "all the pages
 * should just be reskinned to fit the new home screen vibe"). Nothing it
 * shows or does changed; how it looks did:
 *   - club-colour glass cards and the home tab strip;
 *   - your club's row glows in your club's colours;
 *   - every zone (title, Europe, promotion, play-offs, relegation) is a
 *     coloured band down the left of its rows, with a key under the table,
 *     and the bands follow your division (the Championship shows promotion
 *     and play-offs, not the Champions League);
 *   - when positions have changed since you last looked, the rows slide
 *     from their old places to their new ones and keep a ▲/▼ for the visit.
 */

interface Props {
  career: CareerState;
  /**
   * The phone's League app (PhoneHome): a ~230 px wide screen, where the full
   * table's columns left the name ~20 px ("Ars…"). Short club names
   * (CLUB_SHORT_NAMES via shortClub) and tighter number columns. The dashboard
   * leaves it off and looks exactly as before.
   */
  compact?: boolean;
  /** The match-week page drives the view itself (its edge arrows) and hides this screen's own tab row. */
  view?: "table" | "results" | "fixtures" | "awards" | "squad";
  hideTabs?: boolean;
}

/** A cup round's name as a heading over its ties: "Quarter-Final" → "Quarter-Finals". */
export function roundListLabel(name: string): string {
  return /-Final$/.test(name) ? `${name}s` : name;
}

// ── Zones ───────────────────────────────────────────────────────────────────

interface Zone { key: string; color: string; label: string }
const Z = {
  champ: { key: "champ", color: "#fbbf24", label: "Champions" },
  ucl: { key: "ucl", color: "#3b82f6", label: "Champions League" },
  uel: { key: "uel", color: "#f97316", label: "Europa League" },
  up: { key: "up", color: "#22c55e", label: "Promotion" },
  po: { key: "po", color: "#14b8a6", label: "Play-offs" },
  down: { key: "down", color: "#ef4444", label: "Relegation" },
} satisfies Record<string, Zone>;

/**
 * The lines each division is judged by, read off the season-end rules
 * (promotion.ts BOUNDARIES; playoffs.ts seeds 3rd-6th): below the Premier
 * League the top (count − 1) go up automatically and the play-offs decide
 * one more.
 */
const LADDER: Record<Exclude<CareerDivision, "premier">, { auto: number; down: number }> = {
  championship: { auto: 2, down: 3 },
  league_one: { auto: 2, down: 4 },
  league_two: { auto: 3, down: 2 },
  national_league: { auto: 1, down: 4 },
};

// ── Positions that moved since you last looked ─────────────────────────────

/**
 * Remembers the order a table was in the last time you saw it (this tab's
 * session). When it comes back different, each row starts where it used to
 * be and slides to its new place, and keeps a ▲/▼ for the visit. Marked as
 * seen only when the slide plays (React's dev double-mount can't use it up).
 */
function useTableMoves(key: string, names: string[]) {
  const [moves, setMoves] = useState<Record<string, number>>({});
  const [settled, setSettled] = useState(true);
  const sig = names.join("|");
  useEffect(() => {
    const store = `kib-seen:${key}`;
    let prev: string[] | null = null;
    try { const raw = sessionStorage.getItem(store); prev = raw ? JSON.parse(raw) : null; } catch { prev = null; }
    const save = () => { try { sessionStorage.setItem(store, JSON.stringify(names)); } catch { /* ignore */ } };
    if (!prev || prev.join("|") === sig) { save(); return; }
    const m: Record<string, number> = {};
    names.forEach((n, i) => { const was = prev!.indexOf(n); if (was >= 0 && was !== i) m[n] = was - i; });
    if (!Object.keys(m).length) { save(); return; }
    setMoves(m);
    if (prefersReducedMotion()) { save(); setSettled(true); return; }
    setSettled(false);
    const t = setTimeout(() => { save(); setSettled(true); }, 380);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sig]);
  const rowStyle = (name: string): React.CSSProperties => {
    const d = moves[name] ?? 0;
    return settled
      ? { transform: "none", transition: d ? "transform 900ms cubic-bezier(.2,.8,.2,1)" : undefined }
      : { transform: d ? `translateY(${d * 100}%)` : "none", transition: "none" };
  };
  return { moves, rowStyle };
}

function MoveMark({ d }: { d?: number }) {
  if (!d) return null;
  return (
    <span className={`shrink-0 text-[8px] font-black tabular-nums ${d > 0 ? "text-emerald-300" : "text-red-300"}`}>
      {d > 0 ? "▲" : "▼"}{Math.abs(d)}
    </span>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** Your club's row: lit in your colours (screenKit.youRowStyle). */
const youRow = youRowStyle;

/** A zone's colour band down the left of a row, with a faint wash. */
function Band({ zone }: { zone: Zone | null }) {
  if (!zone) return null;
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[3px]" style={{ background: zone.color, boxShadow: `0 0 8px ${rgba(zone.color, 0.9)}` }} />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3" style={{ background: `linear-gradient(90deg, ${rgba(zone.color, 0.13)}, transparent)` }} />
    </>
  );
}

function Legend({ zones }: { zones: Zone[] }) {
  if (!zones.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 bg-black/25 px-2 py-1.5 text-[9px] font-bold text-white/75">
      {zones.map((z) => (
        <span key={z.key} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: z.color, boxShadow: `0 0 6px ${rgba(z.color, 0.8)}` }} />
          {z.label}
        </span>
      ))}
    </div>
  );
}

const W_D_L = (us?: number, them?: number) =>
  us === undefined || them === undefined ? null : us > them ? "W" : us === them ? "D" : "L";
const RESULT_PILL = {
  W: { bg: "linear-gradient(180deg, #34d399, #059669)", ink: "text-white" },
  D: { bg: "linear-gradient(180deg, #fde047, #ca8a04)", ink: "text-gray-950" },
  L: { bg: "linear-gradient(180deg, #f87171, #b91c1c)", ink: "text-white" },
} as const;

function ovrStyle(o?: number): string {
  if (o === undefined) return "bg-white/10 text-white/70";
  return o >= 85 ? "bg-gradient-to-b from-yellow-300 to-amber-500 text-gray-950"
    : o >= 75 ? "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white"
    : o >= 65 ? "bg-gradient-to-b from-sky-400 to-sky-600 text-white"
    : "bg-gradient-to-b from-gray-500 to-gray-700 text-white";
}

export default function LeagueScreen({ career, compact = false, view: forcedView, hideTabs = false }: Props) {
  const { glow } = useClubTheme(career);
  // The league tables' columns and club names (see `compact`).
  const tableCols = compact
    ? "grid-cols-[14px_1fr_16px_16px_16px_16px_22px] px-1 gap-0.5"
    : "grid-cols-[24px_1fr_28px_28px_28px_28px_32px] px-2 gap-1";
  const tableName = (club: string) => (compact ? shortClub(club) : club);
  const tableBadge = compact ? 14 : 16;
  const tableNameGap = compact ? "gap-1" : "gap-1.5";
  /** Whose fixture this is — your club, or your country. */
  const sideFor = (f: { kind?: string }) =>
    f.kind === "international" ? nationOf(career) : career.player.club;

  // "transfers" moved to the Media screen — see TransfersPanel.tsx, and
  // "cups" folded into "table" — see the competition switcher below. Five
  // tabs now, not seven.
  const [ownView, setView] = useState<"table" | "results" | "fixtures" | "awards" | "squad">("table");
  const view = forcedView ?? ownView;
  const [compIndex, setCompIndex] = useState(0);
  const sorted = sortLeague(career.league);
  const squad = career.squad ?? [];
  const division = divisionOf(career);
  const scope = seenScope(career);
  const leagueMoves = useTableMoves(`${scope}:table:${career.season}:${division}`, sorted.map((t) => t.name));

  // ── Zones ──
  const cl = Math.round(sorted.length * 0.25);
  const elBottom = cl + 2;
  const n = sorted.length;
  const thisSeason = (career.trophies ?? []).filter(t => t.season === career.season);
  const playerWonCup = thisSeason.some(t => t.competition === "FA Cup" || t.competition === "League Cup");

  const zoneFor = (pos: number, isPlayer: boolean): Zone | null => {
    if (division === "premier") {
      if (isPlayer && playerWonCup && pos > elBottom) return Z.uel;
      if (pos === 1) return Z.champ;
      if (pos <= cl) return Z.ucl;
      if (pos <= elBottom) return Z.uel;
      if (pos > n - 3) return Z.down;
      return null;
    }
    const l = LADDER[division];
    if (pos <= l.auto) return Z.up;
    if (pos >= Math.max(l.auto + 1, 3) && pos <= 6) return Z.po;
    if (pos > n - l.down) return Z.down;
    return null;
  };
  const leagueLegend: Zone[] = division === "premier" ? [Z.champ, Z.ucl, Z.uel, Z.down] : [Z.up, Z.po, Z.down];

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

  const header = (
    <div className={`grid ${tableCols} border-b border-white/10 bg-black/30 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/55`}>
      <div className="text-center">#</div>
      <div>{compact ? "Club" : "Name"}</div>
      <div className="text-center">P</div>
      <div className="text-center">W</div>
      <div className="text-center">D</div>
      <div className="text-center">L</div>
      <div className="text-center text-white/80">Pts</div>
    </div>
  );

  return (
    <div className="mt-2">
      {!hideTabs && (
        <SegTabs
          className="mb-2"
          small={compact}
          value={view}
          onChange={setView}
          tabs={[["table", "Table"], ["results", "Results"], ["fixtures", "Fixtures"], ["awards", "Awards"], ["squad", "Squad"]] as const}
        />
      )}

      {view === "results" && (
        <RiseIn key="results">
          <ClubCard glow={glow} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/10 bg-black/30 px-2 py-1.5">
              <PressButton
                onClick={() => setWeekIdx(shownWeek - 1)}
                disabled={!canGo(-1)}
                aria-label="Previous gameweek"
                variant="secondary"
                size="none"
                className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black"
              >
                ←
              </PressButton>
              <div className="flex-1 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                  {round.length > 0 ? `Matchweek ${shownWeek}` : "No results yet"}
                </div>
                {round.length > 0 && (
                  <div className="text-[9.5px] font-bold text-white/75">
                    {fixtureDateLabel(career.player.startYear, career.season, shownWeek, "league", divisionOf(career))}
                  </div>
                )}
              </div>
              <PressButton
                onClick={() => setWeekIdx(shownWeek + 1)}
                disabled={!canGo(1)}
                aria-label="Next gameweek"
                variant="secondary"
                size="none"
                className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black"
              >
                →
              </PressButton>
            </div>

            {round.length === 0 && (
              <div className="p-3 text-xs font-bold text-white">
                Play a league match and this week&apos;s ten results will appear here.
              </div>
            )}

            <div className="space-y-1 p-1.5">
              {round.map((r) => {
                const yours = r.home === career.player.club || r.away === career.player.club;
                return (
                  <div
                    key={`${r.home}-${r.away}`}
                    className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-white ${yours ? "" : "bg-white/[0.04]"}`}
                    style={yours ? youRow(glow) : undefined}
                  >
                    <span className={`flex min-w-0 items-center justify-end gap-1 ${r.hs > r.as ? "font-black" : "text-white/85"}`}>
                      <span className="truncate text-right">{r.home}</span>
                      {!compact && <ClubBadge club={r.home} size={16} />}
                    </span>
                    <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums ring-1 ring-white/10">
                      {r.hs}-{r.as}
                    </span>
                    <span className={`flex min-w-0 items-center gap-1 ${r.as > r.hs ? "font-black" : "text-white/85"}`}>
                      {!compact && <ClubBadge club={r.away} size={16} />}
                      <span className="truncate">{r.away}</span>
                    </span>
                    {(r.hg?.length || r.ag?.length) ? (
                      <div className="col-span-3 mt-0.5 grid grid-cols-2 gap-2 text-[9px] font-bold leading-tight text-white/80">
                        <div className="space-y-0.5 text-right">
                          {groupedGoalLines(r.hg ?? [], g => g.s, g => g.m).map(({ scorer, minutes }) => (
                            <div key={scorer}>⚽ {scorer} {minutes.map(m => (m > 90 ? `90+${m - 90}'` : `${m}'`)).join(", ")}</div>
                          ))}
                        </div>
                        <div className="space-y-0.5 text-left">
                          {groupedGoalLines(r.ag ?? [], g => g.s, g => g.m).map(({ scorer, minutes }) => (
                            <div key={scorer}>⚽ {scorer} {minutes.map(m => (m > 90 ? `90+${m - 90}'` : `${m}'`)).join(", ")}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ClubCard>
        </RiseIn>
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
              <ClubCard glow={glow} className="overflow-hidden">
                {header}
                {/* No inner scroll here — DashboardShell's own content area
                    is already the one scrollable region on this whole
                    page. A second, nested scrollbar here doesn't just
                    double up on scrolling; on a platform whose scrollbar
                    reserves real width (most desktop browsers — not the
                    overlay kind phones and Macs use), it shrinks this
                    list's own rows without touching the header above them,
                    which is what actually caused "the columns don't line
                    up" — confirmed directly: it lined up correctly on a
                    phone, which never had this scrollbar to begin with.
                    Zone bands are absolutely placed, so a coloured row's
                    columns sit exactly where an uncoloured row's do. */}
                <div>
                  {sorted.map((t, i) => {
                    const pos = i + 1;
                    const isPlayer = t.name === you;
                    const zone = zoneFor(pos, isPlayer);
                    const zoneBreak = i > 0 && zoneFor(pos - 1, sorted[i - 1].name === you)?.key !== zone?.key;
                    return (
                      <div
                        key={t.name}
                        className={`relative grid ${tableCols} items-center py-1.5 text-[10px] font-bold text-white ${isPlayer ? "z-10 rounded-md" : i % 2 === 0 ? "bg-white/[0.035]" : ""} ${zoneBreak ? "border-t border-white/15" : ""}`}
                        style={{ ...leagueMoves.rowStyle(t.name), ...(isPlayer ? youRow(glow) : {}) }}
                      >
                        <Band zone={zone} />
                        <div className="relative text-center font-black">{pos}</div>
                        <div className={`relative flex min-w-0 items-center ${tableNameGap}`}>
                          <ClubBadge club={t.name} size={tableBadge} />
                          <span className={`truncate ${isPlayer ? "font-black" : ""}`}>{tableName(t.name)}</span>
                          <MoveMark d={leagueMoves.moves[t.name]} />
                        </div>
                        <div className="relative text-center text-white/85">{t.played}</div>
                        <div className="relative text-center text-white/85">{t.won}</div>
                        <div className="relative text-center text-white/85">{t.drawn}</div>
                        <div className="relative text-center text-white/85">{t.lost}</div>
                        <div className={`relative text-center font-black ${isPlayer ? "text-yellow-200" : "text-white"}`}>{t.points}</div>
                      </div>
                    );
                  })}
                </div>
                <Legend zones={leagueLegend} />
              </ClubCard>
            ),
          },
          // ── The two domestic cups: a hat, a draw, and every tie in the
          // country, exactly as the old Cups tab showed them. ──
          ...(career.cupState ?? []).map((cup) => {
            const round = cup.rounds[cup.rounds.length - 1];
            const out = exitRound(cup, you);
            const tone = cup.winner === you ? "#fbbf24" : out ? "#6b7280" : "#10b981";
            return {
              key: `domestic-${cup.competition}`,
              label: cup.competition,
              content: (
                <ClubCard glow={tone} strength={0.34} className="relative overflow-hidden p-2">
                  {cup.winner === you && <Shine loop every={3.5} />}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-black text-white">🏆 {cup.competition}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide"
                      style={{ background: rgba(tone, 0.25), color: cup.winner === you ? "#fde68a" : out ? "#e5e7eb" : "#6ee7b7", boxShadow: `inset 0 0 0 1px ${rgba(tone, 0.6)}` }}
                    >
                      {cup.winner === you ? "WON IT"
                        : cup.winner ? `${cup.winner} won it`
                        : out ? `Out in the ${out}`
                        : round?.name}
                    </span>
                  </div>
                  {round && (
                    <div className="mt-2 space-y-1">
                      {/* v0.15 item 31: the list is always the LATEST round,
                          which once you're out is not the one in the heading
                          ("Out in the Round of 16" above the four
                          quarter-final ties) — so it carries its own name. */}
                      <CardTitle className="px-1 pb-0.5" tone="text-white/60">{roundListLabel(round.name)}</CardTitle>
                      {round.ties.map((t) => {
                        const yours = t.home === you || t.away === you;
                        const done = t.hs !== undefined;
                        return (
                          <div
                            key={`${t.home}-${t.away}`}
                            className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1 text-[10px] font-bold ${yours ? "text-white" : "bg-white/[0.04] text-white/85"}`}
                            style={yours ? youRow(glow) : undefined}
                          >
                            <span className="flex min-w-0 items-center justify-end gap-1">
                              <span className="truncate text-right">{t.home}</span>
                              {!compact && <ClubBadge club={t.home} size={14} />}
                            </span>
                            <span className="rounded-md bg-black/45 px-1.5 font-black tabular-nums ring-1 ring-white/10">
                              {done ? `${t.hs}-${t.as}` : "v"}
                            </span>
                            <span className="flex min-w-0 items-center gap-1">
                              {!compact && <ClubBadge club={t.away} size={14} />}
                              <span className="truncate">{t.away}</span>
                            </span>
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
                </ClubCard>
              ),
            };
          }),
          // ── Europe: read straight off career.euroState ──
          //
          // Reported directly: the Champions League never showed up as a
          // tab at all. Root cause — this used to build the entry by
          // filtering `career.cups` for `kind === "europe"`, but
          // `seedSeasonKnockouts` (competitions.ts) never actually creates
          // one: it only ever opens the domestic cup and the international
          // tournament that way. Europe's own progress has always lived
          // entirely in `career.euroState` (lib/star/euro.ts) instead, so
          // that filter could never produce a match — the tab was silently
          // dead code, not something that only worked on some saves.
          //
          // The table itself was requested separately: no table anywhere
          // for a live Champions/Europa League campaign, despite the league
          // phase genuinely being one — eight real games apiece against
          // thirty-five other real clubs, the same shape the domestic table
          // already is. Read straight off `euroState.table` once the phase
          // is complete, or `liveTable` while it's still in progress — both
          // are real, incrementally-built state (see simulateEuroMatchday,
          // euro.ts), never recomputed/fabricated here.
          ...(career.euroState ? [(() => {
            const euro = career.euroState!;
            const euroTable = sortEuro(euro.table ?? euro.liveTable);
            const EZ: Zone[] = [
              { key: "through", color: "#10b981", label: "Straight through" },
              { key: "playoff", color: "#3b82f6", label: "Play-off round" },
              { key: "out", color: "#ef4444", label: "Eliminated" },
            ];
            const euroZone = (pos: number): Zone => (pos <= 8 ? EZ[0] : pos <= 24 ? EZ[1] : EZ[2]);
            // Which knockout rounds this run actually has is specific to
            // where you finished the league phase — a top-8 finish skips
            // the Round of 32 entirely (knockoutSlots, euro.ts) — so it's
            // read off the real slots for THIS campaign, not one fixed list
            // shared by every run regardless of seeding.
            const rounds = euro.position !== undefined
              ? Array.from(new Set(knockoutSlots(euro.position).map((s) => s.round)))
              : [];
            const lastTie = euro.ties[euro.ties.length - 1] ?? null;
            const roundIdx = lastTie ? rounds.indexOf(lastTie.round) : -1;
            const statusLabel = euro.won ? "Winners 🏆"
              : euro.eliminated ? "Eliminated"
              : lastTie ? lastTie.round
              : "League Phase";
            const tone = euro.won ? "#fbbf24" : euro.eliminated ? "#6b7280" : "#3b82f6";
            return {
              key: `run-${euro.competition}`,
              label: euro.competition,
              content: (
                <div className="space-y-2">
                  <ClubCard glow={tone} strength={0.34} className="relative overflow-hidden p-2.5">
                    {euro.won && <Shine loop every={3.5} />}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">⭐ {euro.competition}</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        euro.won ? "text-amber-300" : euro.eliminated ? "text-white/85" : "text-emerald-300"}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    {rounds.length > 0 && (
                      <>
                        <div className="mt-2 flex gap-1">
                          {rounds.map((r, i) => (
                            <div
                              key={r}
                              title={r}
                              className={`h-2 flex-1 rounded-full ${
                                euro.won || i < roundIdx ? "bg-gradient-to-r from-emerald-400 to-lime-300 shadow-[0_0_8px_rgba(52,211,153,.7)]"
                                  : i === roundIdx && !euro.eliminated ? "bg-white/70" : "bg-white/15"}`}
                            />
                          ))}
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-white/85">{rounds.join(" · ")}</div>
                      </>
                    )}
                  </ClubCard>
                  <ClubCard glow={glow} className="overflow-hidden">
                    {header}
                    <div>
                      {euroTable.map((t, i) => {
                        const pos = i + 1;
                        const zone = euroZone(pos);
                        const zoneBreak = i > 0 && euroZone(pos - 1).key !== zone.key;
                        return (
                          <div
                            key={t.name}
                            className={`relative grid ${tableCols} items-center py-1.5 text-[10px] font-bold text-white ${t.isYou ? "z-10 rounded-md" : i % 2 === 0 ? "bg-white/[0.035]" : ""} ${zoneBreak ? "border-t border-white/15" : ""}`}
                            style={t.isYou ? youRow(glow) : undefined}
                          >
                            <Band zone={zone} />
                            <div className="relative text-center font-black">{pos}</div>
                            <div className={`relative flex min-w-0 items-center ${tableNameGap}`}>
                              <ClubBadge club={t.name} size={tableBadge} />
                              <span className={`truncate ${t.isYou ? "font-black" : ""}`}>{tableName(t.name)}</span>
                            </div>
                            <div className="relative text-center text-white/85">{t.played}</div>
                            <div className="relative text-center text-white/85">{t.won}</div>
                            <div className="relative text-center text-white/85">{t.drawn}</div>
                            <div className="relative text-center text-white/85">{t.lost}</div>
                            <div className={`relative text-center font-black ${t.isYou ? "text-yellow-200" : ""}`}>{t.points}</div>
                          </div>
                        );
                      })}
                    </div>
                    <Legend zones={EZ} />
                  </ClubCard>
                </div>
              ),
            };
          })()] : []),
          // The "your country" tab was removed on request — nothing in the
          // game lets you actually play a national-team match yet, so a tab
          // reporting 0 caps forever was premature. `sideFor`/`nationOf`
          // above still resolve an international fixture's opponent
          // correctly if one is ever generated; only this dedicated tab is
          // gone.
        ];

        const active = competitions[Math.min(compIndex, competitions.length - 1)];
        return (
          <RiseIn key="table">
            {/* A tab per competition instead of one button cycling through
                them — requested directly. Wraps onto a second line rather
                than scrolling sideways when there are more competitions than
                fit one row — no scroll wheels anywhere in the league areas,
                per standing instruction. */}
            {competitions.length > 1 && (
              <div className="mb-2">
                <ChipTabs glow={glow} items={competitions} index={Math.min(compIndex, competitions.length - 1)} onChange={setCompIndex} />
              </div>
            )}
            {active.content}
          </RiseIn>
        );
      })()}

      {view === "fixtures" && (
        // Same reasoning as the Table tab above — no inner scroll cap; the
        // page's own scroll region already handles a full season's list.
        <RiseIn key="fixtures">
          <ClubCard glow={glow} className="overflow-hidden p-1.5">
            <div className="space-y-1">
              {/* A cup round is always APPENDED to career.fixtures the moment
                  its draw lands (see careerFlow.ts) — never re-inserted among
                  the league weeks it's actually sandwiched between — so the
                  raw array reads "every league week, then every cup tie,"
                  even though a cup tie's own week number already says exactly
                  where it belongs. Sorted here by the real date each fixture
                  is played on (fixtureTimestamp), not stored sorted:
                  nextFixtureFor (competitions.ts) solves the same problem by
                  scanning rather than trusting array order. */}
              {(() => {
                // The one row that should read as "next" — the SAME fixture
                // object nextFixtureFor resolves (sort doesn't clone the
                // fixture objects, so `f === upNext` matches exactly one
                // row), not every row that shares a week number with
                // `career.week`, which is a count of matches PLAYED.
                const upNext = nextFixtureFor(career);
                return [...career.fixtures]
                  .sort((a, b) => fixtureTimestamp(career.player.startYear, career.season, a.week, a.kind, divisionOf(career))
                    - fixtureTimestamp(career.player.startYear, career.season, b.week, b.kind, divisionOf(career)))
                  .map((f, i) => {
                  const yourScore = f.played ? (f.home ? f.homeScore : f.awayScore) : undefined;
                  const theirScore = f.played ? (f.home ? f.awayScore : f.homeScore) : undefined;
                  const res = W_D_L(yourScore, theirScore);
                  const next = f === upNext;
                  const homeName = f.home ? sideFor(f) : f.opponent;
                  const awayName = f.home ? f.opponent : sideFor(f);
                  return (
                  <div
                    key={i}
                    className={`relative grid items-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-bold text-white ${compact ? "grid-cols-[46px_1fr_48px_1fr]" : "grid-cols-[52px_1fr_62px_1fr]"} ${next ? "" : f.played ? "bg-white/[0.035]" : "bg-black/20"}`}
                    style={next ? { background: "linear-gradient(90deg, rgba(16,185,129,.45), rgba(16,185,129,.18))", boxShadow: "inset 0 0 0 1px rgba(110,231,183,.8), 0 0 16px -4px rgba(16,185,129,.9)" } : undefined}
                  >
                    {/* The week, not the date, on top — every other screen
                        and message in the game counts in weeks. The actual
                        date stays underneath it. */}
                    <div className="text-center leading-none">
                      <div className="whitespace-nowrap text-[11px] font-black text-white">
                        {isPostSeason(f.week, divisionOf(career)) ? "FINAL" : f.week === 0 ? "PRE" : `W${f.week}`}
                      </div>
                      <div className="mt-0.5 whitespace-nowrap text-[8px] font-bold text-white/60">
                        {fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, divisionOf(career))}
                      </div>
                      {f.kind && f.kind !== "league" && (
                        <div className={`mt-0.5 text-[8px] font-black uppercase leading-none ${
                          f.kind === "international" ? "text-sky-300" : "text-violet-300"}`}
                        >
                          {f.kind === "cup" ? "CUP" : f.kind === "europe" ? "EUR" : "INT"}
                        </div>
                      )}
                    </div>
                    <div className={`flex min-w-0 items-center justify-end gap-1 text-right ${f.home ? "font-black" : "text-white/85"}`}>
                      <span className="min-w-0 break-words">{homeName}</span>
                      {!compact && <ClubBadge club={homeName} kit={kitsOf(homeName, career.clubKits?.[homeName]).home} size={16} />}
                    </div>
                    {/* A dash between the two scores, the pill in YOUR
                        result's colour — green a win, yellow a draw, red a
                        loss. */}
                    <div className="flex flex-col items-center">
                      {f.played ? (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-black tabular-nums ${res ? RESULT_PILL[res].ink : "text-white"}`}
                          style={{ background: res ? RESULT_PILL[res].bg : "rgba(0,0,0,.4)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3), 0 2px 6px rgba(0,0,0,.4)" }}
                        >
                          {`${f.homeScore} - ${f.awayScore}`}
                        </span>
                      ) : next ? (
                        <span className="rounded-full bg-emerald-300 px-1.5 py-[1px] text-[8.5px] font-black uppercase tracking-wider text-gray-950">Next</span>
                      ) : (
                        <span className="font-black text-white/60">-</span>
                      )}
                    </div>
                    <div className={`min-w-0 text-left ${!f.home ? "font-black" : "text-white/85"}`}>
                      <div className="flex min-w-0 items-center gap-1">
                        {!compact && <ClubBadge club={awayName} kit={kitsOf(awayName, career.clubKits?.[awayName]).home} size={16} />}
                        <span className="min-w-0 break-words">{awayName}</span>
                      </div>
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
          </ClubCard>
        </RiseIn>
      )}

      {view === "awards" && (
        <RiseIn key="awards" className="grid gap-2">
          {/* Golden Boot and Assist King first, Player of the Month last —
              requested directly. Both charts are a COUNT — every league
              goal belongs to a named player. Cup goals stay out of them.
              See recognition.goldenBootRace. Top five. */}
          {([["Golden Boot", "👟", "#fbbf24", goldenBootRace(career)], ["Assist King", "🅰️", "#60a5fa", assistRace(career)]] as const).map(([title, icon, tone, race]) => (
            <ClubCard key={title} glow={tone} strength={0.3} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 bg-black/25 px-2.5 py-1.5">
                <CardTitle tone="text-amber-200">{icon} {title}</CardTitle>
              </div>
              <div className="space-y-1 p-1.5">
                {race.slice(0, 5).map((sc, i) => (
                  <div
                    key={sc.name + sc.club}
                    className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs font-bold text-white ${sc.isYou ? "" : "bg-white/[0.04]"}`}
                    style={sc.isYou ? youRow(glow) : undefined}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${
                      i === 0 ? "bg-gradient-to-b from-yellow-200 to-amber-500 text-gray-950"
                        : i === 1 ? "bg-gradient-to-b from-gray-100 to-gray-400 text-gray-900"
                        : i === 2 ? "bg-gradient-to-b from-orange-300 to-orange-700 text-white"
                        : "bg-white/10 text-white/80"}`}
                    >
                      {i + 1}
                    </span>
                    {!compact && <ClubBadge club={sc.club} size={16} />}
                    <span className="flex-1 truncate font-black">{sc.name}</span>
                    <span className="max-w-[38%] truncate text-[10px] text-white/75">{sc.club}</span>
                    <span className="w-6 text-right text-[14px] font-black tabular-nums">{sc.goals}</span>
                  </div>
                ))}
                {race.every(r => r.goals === 0) && (
                  <div className="px-2 py-2 text-[11px] font-bold text-white">Nobody has scored yet.</div>
                )}
              </div>
            </ClubCard>
          ))}

          {/* ── Player of the Month ──
              Newest first, because the one you want is the one just given. */}
          <ClubCard glow="#a78bfa" strength={0.3} className="overflow-hidden">
            <div className="border-b border-white/10 bg-black/25 px-2.5 py-1.5">
              <CardTitle tone="text-amber-200">📅 Player of the Month</CardTitle>
            </div>
            {(career.potm ?? []).filter(a => a.season === career.season).length === 0 && (
              <div className="px-2.5 py-2 text-[11px] font-bold text-white">
                {/* This used to say "the first one is given at the end of
                    August" whatever month it actually was, which read as a bug
                    to anybody seeing it in February — and usually WAS one. */}
                Nothing awarded yet. The first goes to whoever has the best
                August, once that month&apos;s last league game is played.
              </div>
            )}
            <div className="space-y-1 p-1.5">
              {[...(career.potm ?? [])]
                .filter(a => a.season === career.season)
                .sort((a, b) => b.month - a.month)
                .map((a) => (
                  <div
                    key={`${a.season}-${a.month}`}
                    className={`relative overflow-hidden rounded-lg px-2 py-1.5 ${a.isYou ? "" : "bg-white/[0.04]"}`}
                    style={a.isYou ? { background: "linear-gradient(90deg, rgba(251,191,36,.35), rgba(251,191,36,.10))", boxShadow: "inset 0 0 0 1px rgba(253,230,138,.7)" } : undefined}
                  >
                    {a.isYou && <Shine loop every={4} />}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-white">{a.monthName}</span>
                      {a.isYou
                        ? <span className="text-[10px] font-black text-amber-300">YOU WON IT</span>
                        : a.yourPlace
                          ? <span className="text-[10px] font-bold text-white">You were {a.yourPlace}{["st","nd","rd"][a.yourPlace-1] ?? "th"}</span>
                          : <span className="text-[10px] font-bold text-white/70">Not shortlisted</span>}
                    </div>
                    <div className={`text-xs font-black ${a.isYou ? "text-amber-300" : "text-white"}`}>
                      {a.winner} <span className="font-bold text-white">· {a.club}</span>
                    </div>
                    <div className="text-[10px] font-bold text-white/85">
                      {a.goals}G {a.assists}A
                    </div>
                  </div>
                ))}
            </div>
          </ClubCard>
        </RiseIn>
      )}

      {/* "transfers" moved to the Media screen — see TransfersPanel.tsx, and
          "cups" folded into the Table tab's own competition switcher above. */}

      {view === "squad" && (
        <RiseIn key="squad">
          <ClubCard glow={glow} className="overflow-hidden">
            <div className="grid grid-cols-[26px_1fr_30px_36px_26px_26px] items-center gap-1 border-b border-white/10 bg-black/30 px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/55">
              <div />
              <div>Name</div>
              <div className="text-center">OVR</div>
              <div className="text-center">Pos</div>
              <div className="text-center text-yellow-300">G</div>
              <div className="text-center text-blue-300">A</div>
            </div>
            {/* No inner scroll cap here on purpose — see the note on the Table
                tab above. You are one row in this same ranking, not pinned
                above it regardless of form: sorted by goals+assists like
                everyone else, ties broken by overall rating. */}
            <div className="space-y-[3px] p-1">
              {(() => {
                const yourOverall = displayOverall(career.starRating);
                const you = {
                  id: "__you__", isYou: true,
                  name: `${career.player.firstName} ${career.player.lastName}`,
                  position: career.player.position,
                  // The one shared overall formula every screen reads now
                  // (rating.ts), not a formula of this screen's own.
                  overall: yourOverall,
                  seasonGoals: career.seasonStats.goals,
                  seasonAssists: career.seasonStats.assists,
                  imageUrl: undefined as string | undefined,
                  age: career.player.age,
                  marketValue: playerMarketValue({ overall: yourOverall, age: career.player.age }, career.player.club, career),
                };
                const rows = [you, ...squad.map(p => ({
                  ...p, isYou: false,
                  marketValue: playerMarketValue({ ...p, overall: p.overall ?? 65 }, career.player.club, career),
                }))]
                  .sort((a, b) => {
                    const byGA = (b.seasonGoals + b.seasonAssists) - (a.seasonGoals + a.seasonAssists);
                    if (byGA !== 0) return byGA;
                    return (b.overall ?? 0) - (a.overall ?? 0);
                  });
                return rows.map((p, i) => (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[26px_1fr_30px_36px_26px_26px] items-center gap-1 rounded-lg px-1 py-1 text-[10px] font-bold text-white ${p.isYou ? "" : i % 2 === 0 ? "bg-white/[0.045]" : ""}`}
                    style={p.isYou ? youRow(glow) : undefined}
                  >
                    {p.isYou ? (
                      <div className="grid h-[24px] w-[24px] place-items-center rounded-full text-[9px] font-black" style={{ background: rgba(glow, 0.6), boxShadow: `0 0 8px ${rgba(glow, 0.9)}` }}>
                        {career.squadNumber ?? "★"}
                      </div>
                    ) : (
                      // A real team-mate has a face; one without a photo gets his
                      // own fake face (the one the match draws), never a
                      // silhouette — Harry, v0.15 item 37.
                      <ImageWithFallback
                        src={faceOrFake(p.imageUrl, p.id)}
                        fallbackSrc={faceOrFake(null, p.id)}
                        alt=""
                        className="h-[24px] w-[24px] rounded-full bg-white/10 object-cover ring-1 ring-white/20"
                      />
                    )}
                    <div className="truncate">
                      <div className="truncate font-black">{p.name}{p.isYou ? " ★" : ""}</div>
                      <div className="truncate text-[8px] font-bold text-white/70">
                        {p.age !== undefined ? `Age ${p.age}` : ""}{p.age !== undefined ? " · " : ""}★{formatMoney(p.marketValue)}
                      </div>
                    </div>
                    <div className="flex justify-center">
                      {/* Your row shows your star rating, the one rating you
                          see (Harry, 1 Oct 2026); team-mates keep their OVR. */}
                      {p.isYou
                        ? <span className="min-w-[24px] rounded-md bg-amber-400 px-1 py-[1px] text-center text-[10px] font-black tabular-nums text-gray-950 shadow">★{starLevel(career)}</span>
                        : <span className={`min-w-[24px] rounded-md px-1 py-[1px] text-center text-[10px] font-black tabular-nums shadow ${ovrStyle(p.overall)}`}>{p.overall ?? "—"}</span>}
                    </div>
                    <div className="text-center text-white/90">{p.position}</div>
                    <div className="text-center">
                      {p.seasonGoals > 0
                        ? <span className="font-black text-yellow-300">{p.seasonGoals}</span>
                        : <span className="text-white/60">0</span>}
                    </div>
                    <div className="text-center">
                      {p.seasonAssists > 0
                        ? <span className="font-black text-blue-300">{p.seasonAssists}</span>
                        : <span className="text-white/60">0</span>}
                    </div>
                  </div>
                ));
              })()}
            </div>
            {/* Career totals footer for top scorers */}
            {squad.some(p => p.careerGoals > 0 || p.careerAssists > 0) && (
              <div className="border-t border-white/10 bg-black/25 px-2 py-1.5">
                <CardTitle className="mb-1" tone="text-white/75">Career Top Scorers</CardTitle>
                {[...squad]
                  .sort((a, b) => (b.careerGoals + b.careerAssists) - (a.careerGoals + a.careerAssists))
                  .slice(0, 3)
                  .filter(p => p.careerGoals > 0 || p.careerAssists > 0)
                  .map(p => (
                    <div key={p.id} className="mb-0.5 flex items-center gap-1 text-[9px] text-white">
                      <span className="flex-1 truncate font-black text-white">{p.shortName}</span>
                      <span className="font-black text-yellow-400">{p.careerGoals}G</span>
                      <span className="font-black text-blue-400">{p.careerAssists}A</span>
                    </div>
                  ))}
              </div>
            )}
          </ClubCard>
        </RiseIn>
      )}
    </div>
  );
}

