/**
 * EVERY LEAGUE AND CUP — the phone port of components/star/WorldPane.tsx,
 * which since 22 Oct 2026 IS the League page. Same content, same order:
 *   - one chooser (a full-screen list) of every English league, the cups, both
 *     shields, the Champions and Europa League, and an International group;
 *   - a league: Table · Results (‹ Round ›) · Goals · Assists · History;
 *   - Europe: League · KO · Goals · Assists · History;
 *   - a cup: Rounds · Goals · Assists · History; a shield: Final · Goals · Assists · History;
 *   - Last season (career.lastWorld): every trophy, tap one for its table, scorers, knockout.
 * Every number is read from the same lib/star functions the website reads.
 *
 * Each view hands back a list of rows, and the page draws them with ONE
 * FlatList (only the rows on screen are drawn: 211 FIFA nations, 130 seasons
 * of history).
 */
import { useMemo, useState, type ReactNode } from "react";
import { FlatList, Modal, ScrollView, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState, LeagueTeam, LeagueResult } from "@/lib/star/types";
import { ALL_DIVISIONS, divisionOf, leagueNameFor, seasonStartYear, type CareerDivision } from "@/lib/star/calendar";
import { sortLeague, buildSeasonFixtures } from "@/lib/star/season";
import { sortEuro } from "@/lib/star/euro";
import { koAggregate, type EuroBracket } from "@/lib/star/euroBracket";
import type { CupState, CupTie } from "@/lib/star/cups";
import { worldOf, finishWorld, WORLD_LIVE } from "@/lib/star/world";
import { worldRoundResults } from "@/lib/star/world/leagues";
import { compHistoryFor } from "@/lib/star/world/history";
import { leadersFor } from "@/lib/star/intl/editionLeaders";
import { intlCompetitions, intlCompView, intlCompScorers, fullRanking } from "@/lib/star/intl/compView";
import { cupScorers } from "@/lib/star/world/cupScorers";
import { ownEuroScorers } from "@/lib/star/world/ownEuroScorers";
import { intlOf, myGroups, myMatches, worldOf as intlWorldOf, type GroupView, type MatchView } from "@/lib/star/intl/career";
import { seasonQualifiers } from "@/lib/star/qualification";
import type { CompKind } from "@/lib/star/intl/world";
import { topOf, ownLeagueTop, type ScorerRow } from "@/lib/star/world/summary";
import type { WorldState, WorldSummary } from "@/lib/star/world/types";
import { shortClub, groupedGoalLines } from "@/lib/star/media/grammar";
import { realHistory, joinHistory, careerFirstYear, type HistoryLine } from "../../world/history";
import { Press } from "../../ui/Press";
import { C } from "../../world/lookKit";
import { Backdrop, PageTitle, glassStyle } from "../../ui/look";
import { ClubBadge, Flag, Seg, Chips, RoundNav, Empty, Title, youRow, clubGlow, rgba } from "../../world/ui";

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

// Promotion/relegation lines, as the website's League table (WorldPane LINES).
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
const euroZone = (p: number) => (p <= 8 ? "#10b981" : p <= 24 ? "#3b82f6" : "#ef4444");

/** One row the page's list draws. */
export interface Row { key: string; node: ReactNode }
const row = (key: string, node: ReactNode): Row => ({ key, node });

// ── The page ────────────────────────────────────────────────────────────────

export function WorldPane({ career, final = false, last = false, onClose }: {
  career: CareerState; final?: boolean; last?: boolean; onClose?: () => void;
}) {
  const [showLast, setShowLast] = useState(last && !!career.lastWorld);
  if (showLast && career.lastWorld) {
    return <LastSeason career={career} summary={career.lastWorld} onNow={last ? undefined : () => setShowLast(false)} onClose={onClose} />;
  }
  return <NowPane career={career} final={final} onLast={career.lastWorld ? () => setShowLast(true) : undefined} />;
}

/** The list every view draws into: a header on top, its rows under it. */
function RowList({ header, rows }: { header: ReactNode; rows: Row[] }) {
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      renderItem={({ item }) => <View style={{ marginBottom: 2 }}>{item.node}</View>}
      ListHeaderComponent={<View style={{ gap: 8, marginBottom: 8 }}>{header}</View>}
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 110 }}
      initialNumToRender={14}
      windowSize={7}
    />
  );
}

function NowPane({ career, final, onLast }: { career: CareerState; final: boolean; onLast?: () => void }) {
  const glow = clubGlow(career.player.club, career);
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
  const inTrophy = (career.cupState ?? []).some(c => c.competition === "Lower League Trophy");
  const all = [...COMPS.filter(c => c.key !== "llt" || inTrophy), ...intl];
  const groups = [...GROUPS.map(g => ({ ...g, keys: g.keys.filter(k => all.some(c => c.key === k)) })), ...(intl.length ? [{ title: "International", keys: intl.map(c => c.key) }] : [])];
  const comp = all.find(c => c.key === key) ?? all[0];
  const you = career.player.club;

  const chooser = (
    <Press onPress={() => setChoosing(true)} style={[glassStyle("glass", glow.startsWith("#") ? glow : undefined), { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
        <Text style={{ fontSize: 18 }}>{comp.kind === "league" ? "🏆" : comp.kind === "euro" ? "⭐" : comp.kind === "nation" || comp.kind === "intl" || comp.kind === "ranking" ? "🌍" : "🥇"}</Text>
        <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 16, flexShrink: 1 }}>{comp.label}</Text>
        {comp.kind === "league" && comp.division === yours && <View style={{ backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)", paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6 } as ViewStyle}><Text style={{ color: "#111", fontWeight: "900", fontSize: 10 }}>YOURS</Text></View>}
      </View>
      <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 13 }}>Change ▾</Text>
    </Press>
  );
  const top = (
    <>
      {chooser}
      {!WORLD_LIVE && !final && <Empty text="Other leagues are played at the end of the season." />}
    </>
  );

  const view = (() => {
    if (comp.kind === "league") return <LeagueView key={comp.key} top={top} career={career} world={world} division={comp.division} glow={glow} you={you} />;
    if (comp.kind === "euro") return <EuroView key={comp.key} top={top} career={career} world={world} competition={comp.competition} glow={glow} you={you} />;
    if (comp.kind === "cup") {
      const cup = comp.competition === "League Cup"
        ? (career.cupState ?? []).find(c => c.competition === "League Cup") ?? world.leagueCup
        : (career.cupState ?? []).find(c => c.competition === comp.competition);
      return <CupView key={comp.key} top={top} career={career} name={comp.competition} cup={cup} glow={glow} you={you} />;
    }
    if (comp.kind === "shield") return <ShieldView key={comp.key} top={top} career={career} world={world} competition={comp.competition} glow={glow} />;
    if (comp.kind === "nation") return <NationView key={comp.key} top={top} career={career} nation={nation} />;
    if (comp.kind === "ranking") return <RowList key={comp.key} header={top} rows={rankingRows(career, nation)} />;
    return <IntlCompView key={comp.key} top={top} career={career} comp={comp.comp} nation={nation} />;
  })();

  return (
    <View style={{ flex: 1 }}>
      {view}
      <Chooser open={choosing} onClose={() => setChoosing(false)} glow={glow} groups={groups} all={all} current={comp.key} yours={yours}
        onPick={(k) => { setKey(k); setChoosing(false); }} onLast={onLast ? () => { setChoosing(false); onLast(); } : undefined} />
    </View>
  );
}

function Chooser({ open, onClose, glow, groups, all, current, yours, onPick, onLast }: {
  open: boolean; onClose: () => void; glow: string; groups: { title: string; keys: string[] }[]; all: Comp[]; current: string; yours: CareerDivision;
  onPick: (k: string) => void; onLast?: () => void;
}) {
  const inset = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#0b1a2e", paddingTop: inset.top + 8 }}>
        <Backdrop kind="stadium" />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 8 }}>
          <PageTitle size={22}>Every league and cup</PageTitle>
          <Press onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>✕</Text>
          </Press>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + inset.bottom }}>
          {onLast && (
            <Press onPress={onLast} style={{ flexDirection: "row", justifyContent: "space-between", borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: rgba("#fbbf24", 0.2), borderWidth: 1, borderColor: rgba("#fbbf24", 0.6) }}>
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>📜 Last season</Text>
              <Text style={{ color: "#fde68a", fontWeight: "800", fontSize: 12 }}>Tables, scorers, winners</Text>
            </Press>
          )}
          {groups.map(g => (
            <View key={g.title} style={{ marginBottom: 12 }}>
              <Title>{g.title}</Title>
              {g.keys.map(k => {
                const c = all.find(x => x.key === k)!;
                const on = c.key === current;
                return (
                  <Press key={k} onPress={() => onPick(k)} style={[glassStyle("glass"), { flexDirection: "row", justifyContent: "space-between", borderRadius: 12, padding: 14, marginBottom: 5 }, on && youRow(glow)]}>
                    <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{c.label}</Text>
                    {c.kind === "league" && c.division === yours && <Text style={{ color: C.gold, fontWeight: "900", fontSize: 11 }}>YOURS</Text>}
                  </Press>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

const W = [24, 0, 26, 26, 26, 26, 32, 34];
function TableHead() {
  return <View style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: "rgba(10,22,40,0.72)", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}><Cells head cells={["#", "CLUB", "P", "W", "D", "L", "GD", "PTS"]} /></View>;
}
function Cells({ cells, head, bold, lead }: { cells: ReactNode[]; head?: boolean; bold?: boolean; lead?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: head ? 6 : 6, paddingHorizontal: 6 }}>
      {cells.map((c, i) => (
        <View key={i} style={{ width: W[i] || undefined, flex: W[i] ? undefined : 1, alignItems: i === 1 ? "flex-start" : "center", flexDirection: "row", gap: 6 }}>
          {i === 1 && lead}
          <Text numberOfLines={1} style={{ color: head ? "rgba(255,255,255,0.7)" : C.text, fontWeight: head ? "900" : i === 7 || bold ? "900" : "800", fontSize: head ? 9.5 : 12.5, letterSpacing: head ? 0.8 : 0, flexShrink: 1 }}>{c}</Text>
        </View>
      ))}
    </View>
  );
}
function tableRows(prefix: string, rows: LeagueTeam[], glow: string, you: string, zone?: (pos: number, n: number) => string | null): Row[] {
  return rows.map((t, i) => {
    const z = zone?.(i + 1, rows.length) ?? null;
    const isYou = t.name === you;
    return row(`${prefix}-${t.name}`, (
      <View style={[{ borderRadius: 6, backgroundColor: i % 2 === 0 ? "rgba(10,22,40,0.46)" : "rgba(10,22,40,0.36)", borderLeftWidth: 3, borderLeftColor: z ?? "transparent" }, isYou && youRow(glow)]}>
        <Cells bold={isYou} lead={<ClubBadge club={t.name} size={16} />} cells={[String(i + 1), shortClub(t.name), t.played, t.won, t.drawn, t.lost, t.goalsFor - t.goalsAgainst, t.points]} />
      </View>
    ));
  });
}

function goalLines(gs: NonNullable<LeagueResult["hg"]>): string[] {
  return groupedGoalLines(gs, g => g.s, g => g.m).map(({ scorer, minutes }) => `${scorer} ${minutes.map(m => (m > 90 ? `90+${m - 90}'` : `${m}'`)).join(", ")}`);
}
function Score({ text }: { text: string }) {
  return <Text style={{ backgroundColor: "rgba(0,0,0,0.45)", color: C.text, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden", minWidth: 42, textAlign: "center" }}>{text}</Text>;
}
function MatchLine({ home, away, score, mine, glow, homeWin, awayWin, under }: { home: string; away: string; score: string; mine: boolean; glow: string; homeWin?: boolean; awayWin?: boolean; under?: ReactNode }) {
  return (
    <View style={[{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: "rgba(10,22,40,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }, mine && youRow(glow)]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, textAlign: "right", color: C.text, fontWeight: homeWin ? "900" : "700", opacity: awayWin ? 0.7 : 1 }}>{home}</Text>
        <Score text={score} />
        <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: awayWin ? "900" : "700", opacity: homeWin ? 0.7 : 1 }}>{away}</Text>
      </View>
      {under}
    </View>
  );
}
function resultRows(prefix: string, results: LeagueResult[], glow: string, you: string): Row[] {
  return results.map(r => row(`${prefix}-${r.home}-${r.away}`, (
    <MatchLine home={shortClub(r.home)} away={shortClub(r.away)} score={`${r.hs}-${r.as}`} mine={r.home === you || r.away === you} glow={glow} homeWin={r.hs > r.as} awayWin={r.as > r.hs}
      under={(r.hg?.length || r.ag?.length) ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          <View style={{ flex: 1 }}>{goalLines(r.hg ?? []).map(l => <Text key={l} style={{ color: C.dim, fontSize: 10.5, textAlign: "right", fontWeight: "700" }}>{l}</Text>)}</View>
          <View style={{ flex: 1 }}>{goalLines(r.ag ?? []).map(l => <Text key={l} style={{ color: C.dim, fontSize: 10.5, fontWeight: "700" }}>{l}</Text>)}</View>
        </View>
      ) : undefined} />
  )));
}
function scorerRows(prefix: string, rows: ScorerRow[], glow: string, label: string, youBelow?: { row: ScorerRow; rank: number } | null): Row[] {
  if (!rows.length && !youBelow) return [row(`${prefix}-empty`, <Empty text="No named players here yet." />)];
  const line = (r: ScorerRow, rank: number, mine: boolean) => (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(10,22,40,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }, mine && youRow(glow)]}>
      <Text style={{ width: 24, textAlign: "center", color: C.text, fontWeight: "900" }}>{rank}</Text>
      {r.club ? <ClubBadge club={r.club} size={16} /> : null}
      <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: "800" }}>{r.player}</Text>
      <Text style={{ color: C.text, fontWeight: "900" }}>{r.n} <Text style={{ color: C.dim, fontSize: 10 }}>{label}</Text></Text>
    </View>
  );
  const out = rows.map((r, i) => row(`${prefix}-${r.id}-${i}`, line(r, i + 1, false)));
  if (youBelow) {
    out.push(row(`${prefix}-dots`, <Text style={{ color: C.dim, textAlign: "center", fontWeight: "900" }}>⋯</Text>));
    out.push(row(`${prefix}-you`, line(youBelow.row, youBelow.rank, true)));
  }
  return out;
}

// ── History (every season's winner and runner-up, then the real ones) ──────

function leaderText(xs: { name: string; n: number }[]): string {
  return `${xs.map(x => x.name).join(", ")} ${xs[0].n}`;
}
function historyRows(prefix: string, lines: HistoryLine[], glow: string, mine: (c: string) => boolean, badge: (club: string, size: number) => ReactNode, name: (c: string) => string): Row[] {
  return lines.map(r => {
    const lit = !r.real && !!r.winner && (mine(r.winner) || (!!r.runnerUp && mine(r.runnerUp)));
    const extra = !r.notHeld && (r.scorers?.length || r.assisters?.length || r.best);
    return row(`${prefix}-${r.real ? "r" : "c"}${r.label}`, (
      <View style={[{ borderRadius: 10, padding: 9, backgroundColor: "rgba(10,22,40,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }, lit && youRow(glow)]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: C.gold, fontWeight: "900", fontSize: 10.5, letterSpacing: 1 }}>{r.label}{r.score ? ` · FINAL ${r.score}` : ""}</Text>
          {r.real && <Text style={{ color: C.dim, fontSize: 9, fontWeight: "900", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 4, borderRadius: 3, overflow: "hidden" }}>REAL</Text>}
        </View>
        {r.notHeld ? <Text style={{ color: C.dim, marginTop: 2 }}>Not played</Text> : r.winner ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
            <Text>🏆</Text>{badge(r.winner, 16)}
            <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: "900" }}>{name(r.winner)}</Text>
            {r.runnerUp ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "45%" }}>
                <Text style={{ color: C.dim, fontSize: 9, fontWeight: "800" }}>2ND</Text>{badge(r.runnerUp, 14)}
                <Text numberOfLines={1} style={{ color: C.dim, fontWeight: "700", flexShrink: 1 }}>{name(r.runnerUp)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {extra ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, marginTop: 4 }}>
            {!!r.scorers?.length && <Text style={{ color: C.dim, fontSize: 11, fontWeight: "700" }}>⚽ {leaderText(r.scorers)}</Text>}
            {!!r.assisters?.length && <Text style={{ color: C.dim, fontSize: 11, fontWeight: "700" }}>🅰️ {leaderText(r.assisters)}</Text>}
            {r.best && <Text style={{ color: C.dim, fontSize: 11, fontWeight: "700" }}>⭐ {r.best.name}</Text>}
          </View>
        ) : null}
      </View>
    ));
  });
}
function clubHistoryRows(career: CareerState, comp: string, glow: string, you: string): Row[] {
  const rows = compHistoryFor(career, comp);
  const mine: HistoryLine[] = rows.map(r => {
    const y = seasonStartYear(career.player.startYear, r.season);
    return {
      label: `${y}-${String((y + 1) % 100).padStart(2, "0")}`, year: y, real: false, season: r.season,
      winner: r.winner, runnerUp: r.runnerUp, score: r.score, scorers: r.scorers, assisters: r.assisters, best: r.best,
    };
  });
  const lines = joinHistory(mine, realHistory(comp), careerFirstYear(career.player.startYear));
  if (!lines.length) return [row("h-empty", <Empty text="No seasons finished yet. The winner and runner-up go here at the end of each season." />)];
  return historyRows(`h-${comp}`, lines, glow, (n) => n === you, (club, size) => <ClubBadge club={club} size={size} />, shortClub);
}

// ── A league ────────────────────────────────────────────────────────────────

function LeagueView({ top, career, world, division, glow, you }: { top: ReactNode; career: CareerState; world: WorldState; division: CareerDivision; glow: string; you: string }) {
  const [tab, setTab] = useState<"table" | "results" | "goals" | "assists" | "history">("table");
  const own = division === divisionOf(career);
  const lg = own ? null : world.leagues.find(l => l.division === division) ?? null;
  const rows = useMemo(() => (own ? sortLeague(career.league) : lg ? sortLeague(lg.teams) : []), [own, lg, career.league]);
  // Results: ‹ Round › back through played rounds and on to future fixtures.
  const clubs = own ? career.league.map(t => t.name) : lg?.clubs ?? [];
  const clubKey = clubs.join("|");
  const schedule = useMemo(() => buildSeasonFixtures(clubs), [clubKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = Math.max(0, ...schedule.map(f => f.week));
  const playedUpTo = own ? Math.max(0, ...(career.results ?? []).map(r => r.week)) : lg?.played ?? 0;
  const [round, setRound] = useState(Math.max(1, playedUpTo));

  let body: Row[] = [];
  let header: ReactNode = null;
  if (tab === "table") {
    body = rows.length ? [row("head", <TableHead />), ...tableRows("t", rows, glow, you, (p, n) => zoneColour(division, p, n)), row("key", <ZoneKey items={LINES[division].europe
      ? [[ZONE.champ, "Champions"], [ZONE.ucl, "Champions League"], [ZONE.uel, "Europa League"], [ZONE.down, "Relegation"]]
      : [[ZONE.up, "Promotion"], [ZONE.po, "Play-offs"], [ZONE.down, "Relegation"]]} />)] : [row("e", <Empty text="No table for this league." />)];
  } else if (tab === "results") {
    if (!total) body = [row("e", <Empty text="No fixtures for this league." />)];
    else {
      const ahead = round > playedUpTo;
      const results = ahead ? [] : own ? (career.results ?? []).filter(r => r.week === round) : lg ? worldRoundResults(career, lg, round) : [];
      header = <RoundNav label={`Round ${round}`} sub={ahead ? "Still to play" : `of ${total}`}
        onPrev={round > 1 ? () => setRound(round - 1) : undefined} onNext={round < total ? () => setRound(round + 1) : undefined} />;
      body = ahead || !results.length
        ? schedule.filter(f => f.week === round).map(f => row(`p-${f.home}-${f.away}`, <MatchLine home={shortClub(f.home)} away={shortClub(f.away)} score="v" mine={f.home === you || f.away === you} glow={glow} />))
        : resultRows(`r${round}`, results, glow, you);
    }
  } else if (tab === "goals") {
    body = scorerRows("g", own ? ownLeagueTop(career, 0) : lg ? topOf(career, lg.scorers, 0) : [], glow, "goals");
  } else if (tab === "assists") {
    body = scorerRows("a", own ? ownLeagueTop(career, 1) : lg ? topOf(career, lg.scorers, 1) : [], glow, "assists");
  } else {
    body = clubHistoryRows(career, leagueNameFor(division), glow, you);
  }
  return (
    <RowList rows={body} header={<>
      {top}
      <Seg value={tab} onChange={setTab} tabs={[["table", "Table"], ["results", "Results"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} />
      {header}
    </>} />
  );
}

function ZoneKey({ items }: { items: [string, string][] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4, paddingHorizontal: 4, paddingTop: 4 }}>
      {items.map(([c, l]) => (
        <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 4, height: 12, borderRadius: 2, backgroundColor: c }} />
          <Text style={{ color: C.dim, fontSize: 11, fontWeight: "700" }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Europe ──────────────────────────────────────────────────────────────────

function WinnerBar({ club }: { club: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, padding: 10, backgroundColor: rgba("#fbbf24", 0.22), borderWidth: 1, borderColor: rgba("#fbbf24", 0.7) }}>
      <Text style={{ fontSize: 18 }}>🏆</Text>
      <ClubBadge club={club} size={22} />
      <Text style={{ color: C.text, fontWeight: "900", flex: 1 }}>{shortClub(club)}</Text>
      <Text style={{ color: "#fde68a", fontWeight: "900", fontSize: 10, letterSpacing: 1 }}>WINNERS</Text>
    </View>
  );
}

/** A knockout tie, either a domestic cup tie or a UEFA two-legged tie. */
function cupTieRow(key: string, t: CupTie, glow: string, you: string): Row {
  const done = t.hs !== undefined && t.as !== undefined;
  const w = !done ? undefined : t.pens ? (t.pens.home > t.pens.away ? t.home : t.away) : t.hs! > t.as! ? t.home : t.as! > t.hs! ? t.away : undefined;
  return row(key, <MatchLine home={shortClub(t.home)} away={shortClub(t.away)} score={done ? `${t.hs}-${t.as}` : "v"} mine={t.home === you || t.away === you} glow={glow}
    homeWin={w === t.home} awayWin={w === t.away}
    under={t.pens ? <Text style={{ color: C.gold, fontSize: 10.5, fontWeight: "800", textAlign: "center", marginTop: 3 }}>{t.pens.home}-{t.pens.away} on penalties</Text>
      : t.legs && t.legs.length > 1 ? <Text style={{ color: C.dim, fontSize: 10.5, fontWeight: "700", textAlign: "center", marginTop: 3 }}>Legs {t.legs.map(l => `${l.hs}-${l.as}`).join(" · ")}</Text> : undefined} />);
}
function euroTieRow(key: string, t: EuroBracket["rounds"][number]["ties"][number], glow: string, you: string): Row {
  const agg = koAggregate(t);
  const legs = t.legs.length > 1 ? t.legs.map(l => `${l.a}-${l.b}`).join(" · ") : "";
  const pens = t.pens ? `${t.pens.a}-${t.pens.b} on penalties` : "";
  const note = [legs && `Legs ${legs}`, pens].filter(Boolean).join(" · ");
  return row(key, <MatchLine home={t.a ? shortClub(t.a) : "?"} away={t.b ? shortClub(t.b) : "?"} score={agg ? `${agg.a}-${agg.b}` : "v"} mine={t.a === you || t.b === you} glow={glow}
    homeWin={!!t.winner && t.winner === t.a} awayWin={!!t.winner && t.winner === t.b}
    under={note ? <Text style={{ color: C.dim, fontSize: 10.5, fontWeight: "700", textAlign: "center", marginTop: 3 }}>{note}</Text> : undefined} />);
}

function EuroKnockout({ bracket, glow, you }: { bracket: EuroBracket; glow: string; you: string }) {
  const played = bracket.rounds.filter(r => r.ties.some(t => t.a && t.b));
  const live = played.find(r => r.ties.some(t => t.a && t.b && !t.winner)) ?? played[played.length - 1] ?? bracket.rounds[0];
  const [pick, setPick] = useState(live?.name ?? "");
  const r = bracket.rounds.find(x => x.name === pick) ?? live;
  return (
    <View style={{ gap: 6 }}>
      <Chips value={pick} onChange={setPick} items={bracket.rounds.map(x => [x.name, x.name.replace("Round of ", "Last ")] as const)} />
      {r ? r.ties.map((t, i) => <View key={i}>{euroTieRow(`${r.name}-${i}`, t, glow, you).node}</View>) : null}
    </View>
  );
}

function EuroView({ top, career, world, competition, glow, you }: { top: ReactNode; career: CareerState; world: WorldState; competition: "Champions League" | "Europa League"; glow: string; you: string }) {
  const [tab, setTab] = useState<"table" | "knockout" | "goals" | "assists" | "history">("table");
  const mine = career.euroState?.competition === competition ? career.euroState : null;
  const w = world.europe.find(e => e.competition === competition);
  const table = mine ? sortEuro(mine.table ?? mine.liveTable) : w ? sortEuro(w.table) : [];
  const rows: LeagueTeam[] = table.map(r => ({ name: r.name, strength: 0, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points }));
  const bracket = mine ? mine.bracket : w?.bracket;
  const winner = mine ? mine.winner : w?.winner;
  const own = useMemo(() => (mine ? ownEuroScorers(career, mine, 10000) : null), [career, mine]);
  const youBelow = (list: ScorerRow[] | undefined) => {
    const i = (list ?? []).findIndex(r => r.club === you && r.player === career.player.lastName);
    return i >= 10 ? { row: list![i], rank: i + 1 } : null;
  };
  let body: Row[];
  if (tab === "table") body = rows.length ? [row("head", <TableHead />), ...tableRows("e", rows, glow, you, (p) => euroZone(p)),
    row("key", <ZoneKey items={[["#10b981", "Top 8: straight to the last 16"], ["#3b82f6", "9th to 24th: knockout play-off"], ["#ef4444", "Out"]]} />)] : [row("e", <Empty text="Not started yet." />)];
  else if (tab === "knockout") body = [row("ko", bracket ? <EuroKnockout bracket={bracket} glow={glow} you={you} /> : <Empty text="The knockout starts after the league phase." />)];
  else if (tab === "goals") body = scorerRows("g", own ? own.goals.slice(0, 10) : w ? topOf(career, w.scorers, 0) : [], glow, "goals", youBelow(own?.goals));
  else if (tab === "assists") body = scorerRows("a", own ? own.assists.slice(0, 10) : w ? topOf(career, w.scorers, 1) : [], glow, "assists", youBelow(own?.assists));
  else body = clubHistoryRows(career, competition, glow, you);
  return (
    <RowList rows={body} header={<>
      {top}
      {winner ? <WinnerBar club={winner} /> : null}
      <Seg value={tab} onChange={setTab} tabs={[["table", "League"], ["knockout", "KO"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} />
    </>} />
  );
}

// ── Cups and shields ────────────────────────────────────────────────────────

const roundChip = (name: string) => name
  .replace("Qualifying Round", "Qual").replace(" Round", "").replace("Round of ", "Last ").replace("Round ", "R");

function cupRoundsRows(cup: CupState, pick: string, glow: string, you: string): Row[] {
  const r = cup.rounds.find(x => x.name === pick) ?? cup.rounds[cup.rounds.length - 1];
  if (!r) return [row("e", <Empty text="Not drawn yet." />)];
  const out: Row[] = [row("title", <Title>{r.name} · {r.ties.length} ties</Title>)];
  r.ties.forEach((t, i) => out.push(cupTieRow(`${r.name}-${i}`, t, glow, you)));
  if (r.byes?.length) out.push(row("byes", <Text style={{ color: C.text, fontSize: 11.5, fontWeight: "700" }}><Text style={{ color: C.gold }}>Through on a bye ({r.byes.length}): </Text>{r.byes.map(shortClub).join(" · ")}</Text>));
  return out;
}

function CupView({ top, career, name, cup, glow, you }: { top: ReactNode; career: CareerState; name: string; cup?: CupState; glow: string; you: string }) {
  const [tab, setTab] = useState<"rounds" | "goals" | "assists" | "history">("rounds");
  const current = cup?.rounds.find(r => r.ties.some(t => t.hs === undefined)) ?? cup?.rounds[cup.rounds.length - 1];
  const [pick, setPick] = useState(current?.name ?? "");
  const sc = useMemo(() => cup ? cupScorers(career, name, cup.rounds.flatMap(r => r.ties.map(t => ({ round: r.name, home: t.home, away: t.away, hs: t.hs, as: t.as })))) : { goals: [], assists: [] }, [career, name, cup]);
  let body: Row[];
  if (tab === "history") body = clubHistoryRows(career, name, glow, you);
  else if (!cup) body = [row("e", <Empty text="This cup isn't being played this season." />)];
  else if (tab === "goals") body = scorerRows("g", sc.goals, glow, "goals");
  else if (tab === "assists") body = scorerRows("a", sc.assists, glow, "assists");
  else {
    const join = Object.entries(cup.entries ?? {});
    body = [
      ...(join.length ? [row("join", (
        <View style={{ backgroundColor: C.panel, borderRadius: 12, padding: 10 }}>
          <Title>Still to join</Title>
          {join.map(([rd, clubs]) => (
            <View key={rd} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 12 }}>{rd}</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 12 }}>{clubs.includes(you) ? `${clubs.length} clubs · you join here` : `${clubs.length} clubs`}</Text>
            </View>
          ))}
        </View>
      ))] : []),
      ...cupRoundsRows(cup, pick, glow, you),
    ];
  }
  return (
    <RowList rows={body} header={<>
      {top}
      {cup?.winner ? <WinnerBar club={cup.winner} /> : null}
      <Seg value={tab} onChange={setTab} tabs={[["rounds", "Rounds"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} />
      {tab === "rounds" && cup && cup.rounds.length > 0 ? <Chips value={pick || cup.rounds[cup.rounds.length - 1].name} onChange={setPick} items={cup.rounds.map(r => [r.name, roundChip(r.name)] as const)} /> : null}
    </>} />
  );
}

function ShieldCard({ home, away, hs, as, pens, winner }: { home: string; away: string; hs?: number; as?: number; pens?: { home: number; away: number }; winner?: string }) {
  return (
    <View style={{ backgroundColor: C.panel, borderRadius: 14, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, alignItems: "center", gap: 4 }}><ClubBadge club={home} size={40} /><Text style={{ color: C.text, fontWeight: "800" }}>{shortClub(home)}</Text></View>
        <Text style={{ color: C.text, fontWeight: "900", fontSize: 22, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: "hidden" }}>{hs !== undefined ? `${hs}-${as}` : "v"}</Text>
        <View style={{ flex: 1, alignItems: "center", gap: 4 }}><ClubBadge club={away} size={40} /><Text style={{ color: C.text, fontWeight: "800" }}>{shortClub(away)}</Text></View>
      </View>
      {pens ? <Text style={{ color: C.gold, textAlign: "center", marginTop: 8, fontWeight: "800" }}>{pens.home}-{pens.away} on penalties</Text> : null}
      {winner ? <Text style={{ color: C.text, textAlign: "center", marginTop: 4, fontWeight: "900" }}>🏆 {shortClub(winner)}</Text> : null}
    </View>
  );
}

function ShieldView({ top, career, world, competition, glow }: { top: ReactNode; career: CareerState; world: WorldState; competition: "Community Shield" | "Super Cup"; glow: string }) {
  const yours = career.fixtures.find(f => f.competition === competition);
  const s = world.shields.find(x => x.competition === competition);
  const home = yours ? (yours.home ? career.player.club : yours.opponent) : null;
  const away = yours ? (yours.home ? yours.opponent : career.player.club) : null;
  const [tab, setTab] = useState<"final" | "goals" | "assists" | "history">("final");
  const game = yours ? { round: "Final", home: home!, away: away!, hs: yours.played ? yours.homeScore : undefined, as: yours.played ? yours.awayScore : undefined }
    : s ? { round: "Final", home: s.home, away: s.away, hs: s.hs, as: s.as } : null;
  const sc = useMemo(() => cupScorers(career, competition, game ? [game] : []), [career, competition, game?.home, game?.hs, game?.as]); // eslint-disable-line react-hooks/exhaustive-deps
  let body: Row[];
  if (tab === "final") body = [row("f", yours ? <ShieldCard home={home!} away={away!} hs={yours.played ? yours.homeScore : undefined} as={yours.played ? yours.awayScore : undefined} />
    : s ? <ShieldCard home={s.home} away={s.away} hs={s.hs} as={s.as} pens={s.pens} winner={s.winner} /> : <Empty text={`No ${competition} this season.`} />)];
  else if (tab === "goals") body = scorerRows("g", sc.goals, glow, "goals");
  else if (tab === "assists") body = scorerRows("a", sc.assists, glow, "assists");
  else body = clubHistoryRows(career, competition, glow, career.player.club);
  return <RowList rows={body} header={<>{top}<Seg value={tab} onChange={setTab} tabs={[["final", "Final"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} /></>} />;
}

// ── International ───────────────────────────────────────────────────────────

const NATION_GLOW = "#3b82f6";

function groupRows(prefix: string, g: GroupView, nation: string): Row[] {
  return [
    row(`${prefix}-t`, <Title style={{ marginTop: 6 }}>{g.title}</Title>),
    row(`${prefix}-h`, <Cells head cells={["#", "NATION", "P", "W", "D", "GD", "PTS"]} />),
    ...g.rows.map((r, i) => row(`${prefix}-${r.name}`, (
      <View style={[{ borderRadius: 8, backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.04)" : "transparent", borderLeftWidth: 3, borderLeftColor: i === 0 ? "#fbbf24" : "transparent" }, r.name === nation && youRow(NATION_GLOW)]}>
        <Cells lead={<Flag nation={r.name} size={13} />} cells={[String(i + 1), r.name, r.p, r.w, r.d, r.gd > 0 ? `+${r.gd}` : r.gd, r.pts]} />
      </View>
    ))),
  ];
}
function matchRow(key: string, m: MatchView, nation: string): Row {
  const mine = m.mine || m.home === nation || m.away === nation;
  const done = m.hs !== undefined && m.as !== undefined;
  const [ph, pa] = m.pens ? m.pens.split(" ")[0].split("-").map(Number) : [0, 0];
  return row(key, <MatchLine home={m.home} away={m.away} score={done ? `${m.hs}-${m.as}` : "v"} mine={mine} glow={NATION_GLOW}
    homeWin={done && (m.hs! > m.as! || (m.hs === m.as && ph > pa))} awayWin={done && (m.as! > m.hs! || (m.hs === m.as && pa > ph))}
    under={m.pens ? <Text style={{ color: C.gold, fontSize: 10.5, textAlign: "center", fontWeight: "800" }}>{m.pens}</Text> : undefined} />);
}

/** Your nation: its group tables, last and next matches (the website's IntlWorldPanel, in short). */
function NationView({ top, career, nation }: { top: ReactNode; career: CareerState; nation: string | null }) {
  const rows = useMemo<Row[]>(() => {
    if (!nation) return [row("e", <Empty text="No national team yet." />)];
    let groups: GroupView[] = []; let ms: { last: MatchView[]; next: MatchView[] } = { last: [], next: [] };
    try { groups = myGroups(career); ms = myMatches(career); } catch { /* no international world on this save */ }
    const out: Row[] = [];
    groups.forEach((g, i) => out.push(...groupRows(`g${i}`, g, nation)));
    if (ms.next.length) { out.push(row("nt", <Title style={{ marginTop: 6 }}>Next</Title>)); ms.next.forEach((m, i) => out.push(matchRow(`n${i}`, m, nation))); }
    if (ms.last.length) { out.push(row("lt", <Title style={{ marginTop: 6 }}>Last</Title>)); ms.last.forEach((m, i) => out.push(matchRow(`l${i}`, m, nation))); }
    return out.length ? out : [row("e", <Empty text="No international matches yet." />)];
  }, [career, nation]);
  return <RowList rows={rows} header={top} />;
}

function rankingRows(career: CareerState, nation: string | null): Row[] {
  let rows: { name: string; points: number }[] = [];
  try { rows = fullRanking(career); } catch { rows = []; }
  if (!rows.length) return [row("e", <Empty text="No ranking yet." />)];
  return rows.map((t, i) => row(`fifa-${t.name}`, (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.04)" : "transparent" }, t.name === nation && youRow(NATION_GLOW)]}>
      <Text style={{ width: 30, textAlign: "center", color: C.text, fontWeight: "900" }}>{i + 1}</Text>
      <Flag nation={t.name} size={14} />
      <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: "700" }}>{t.name}</Text>
      <Text style={{ color: C.dim, fontWeight: "900" }}>{t.points.toLocaleString("en-GB")}</Text>
    </View>
  )));
}

function IntlCompView({ top, career, comp, nation }: { top: ReactNode; career: CareerState; comp: CompKind; nation: string | null }) {
  const v = useMemo(() => { try { return intlCompView(career, comp); } catch { return null; } }, [career, comp]);
  const drawn = !!v && v.rounds.length > 0;
  const [tab, setTab] = useState<"tables" | "results" | "goals" | "assists" | "history">(!drawn ? "history" : v && v.groups.length ? "tables" : "results");
  const [round, setRound] = useState(v?.openAt ?? 0);
  const sc = useMemo(() => { try { return intlCompScorers(career, comp); } catch { return { goals: [], assists: [] }; } }, [career, comp]);
  if (!v) return <RowList header={top} rows={[row("e", <Empty text="Not drawn yet." />)]} />;
  const n = nation ?? "";
  const r = v.rounds[round];
  let body: Row[] = [];
  let extra: ReactNode = null;
  if (!drawn && (tab === "tables" || tab === "results")) body = [row("e", <Empty text="The next one isn't drawn yet. Its history is under History." />)];
  else if (tab === "goals" || tab === "assists") {
    const list = tab === "goals" ? sc.goals : sc.assists;
    body = list.length ? list.map((x, i) => row(`s${i}`, (
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(10,22,40,0.6)" }, x.nation === nation && youRow(NATION_GLOW)]}>
        <Text style={{ width: 22, textAlign: "center", color: C.text, fontWeight: "900" }}>{i + 1}</Text>
        <Flag nation={x.nation} size={13} />
        <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: "800" }}>{x.name}</Text>
        <Text style={{ color: C.text, fontWeight: "900" }}>{x.n} <Text style={{ color: C.dim, fontSize: 10 }}>{tab}</Text></Text>
      </View>
    ))) : [row("e", <Empty text="No goals named in this one yet this season." />)];
  } else if (tab === "tables") {
    body = v.groups.length ? v.groups.flatMap((g, i) => groupRows(`g${i}`, g, n)) : [row("e", <Empty text="No groups in this one: it is all knockout." />)];
  } else if (tab === "results" && r) {
    extra = <RoundNav label={r.name} sub={r.played ? `${round + 1} of ${v.rounds.length}` : "Still to play"}
      onPrev={round > 0 ? () => setRound(round - 1) : undefined} onNext={round < v.rounds.length - 1 ? () => setRound(round + 1) : undefined} />;
    body = r.matches.map((m, i) => matchRow(`m${m.id ?? i}`, m, n));
  } else if (tab === "history") {
    const mine: HistoryLine[] = v.history.map(f => {
      let l: ReturnType<typeof leadersFor> = null;
      try { l = leadersFor(career, f.final); } catch { /* names unknown */ }
      return {
        label: String(f.year), year: f.year, real: false, winner: f.winner, runnerUp: f.runnerUp, score: f.score,
        ...(l?.scorers.length ? { scorers: l.scorers } : {}), ...(l?.assisters.length ? { assisters: l.assisters } : {}), ...(l?.best ? { best: l.best } : {}),
      };
    });
    const lines = joinHistory(mine, realHistory(comp), careerFirstYear(career.player.startYear) + 1);
    body = lines.length ? historyRows(`ih-${comp}`, lines, NATION_GLOW, (x) => x === nation, (c, size) => <Flag nation={c} size={size - 2} />, (c) => c)
      : [row("e", <Empty text="No final played yet. Each one is added here once it is played." />)];
  }
  return (
    <RowList rows={body} header={<>
      {top}
      <Text style={{ color: C.gold, fontWeight: "900", fontSize: 11, letterSpacing: 1 }}>{v.title.toUpperCase()}{v.yours && nation ? ` · ${nation.toUpperCase()} IN IT` : ""}</Text>
      <Seg value={tab} onChange={setTab} tabs={[["tables", "Tables"], ["results", "Results"], ["goals", "Goals"], ["assists", "Assists"], ["history", "History"]] as const} />
      {extra}
    </>} />
  );
}

// ── Last season (career.lastWorld) ──────────────────────────────────────────

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
const isEuro = (name: string) => name === "Champions League" || name === "Europa League";

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
  for (const c of summary.cups ?? []) {
    if (c.winner && !out.some(t => t.competition === c.competition)) out.push({ kind: "cup", competition: c.competition, club: c.winner });
  }
  const rank = (c: string) => { const i = TROPHY_ORDER.indexOf(c); return i < 0 ? 99 : i; };
  out.sort((a, b) => rank(a.competition) - rank(b.competition));
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

function CloseBtn({ onPress }: { onPress: () => void }) {
  return (
    <Press onPress={onPress} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#b91c1c", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>✕</Text>
    </Press>
  );
}

function LastSeason({ career, summary, onNow, onClose }: { career: CareerState; summary: WorldSummary; onNow?: () => void; onClose?: () => void }) {
  const glow = clubGlow(career.player.club, career);
  const [open, setOpen] = useState<Trophy | null>(null);
  const trophies = useMemo(() => trophiesOf(career, summary), [career, summary]);
  const you = career.thisSeasonClub ?? career.player.club;
  const groupOf = (t: Trophy) => (t.competition === "Super Cup" ? "Europe" : TROPHY_GROUP[t.kind]);
  if (open) {
    const head = (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 19, flex: 1 }}>🏆 {open.competition}</Text>
        <CloseBtn onPress={() => setOpen(null)} />
      </View>
    );
    if (open.kind === "intl") {
      let nation: string | null = null;
      try { nation = intlOf(career).nation; } catch { nation = null; }
      return <IntlCompView top={head} career={career} comp={open.competition} nation={nation} />;
    }
    return <TrophyDetail head={head} summary={summary} trophy={open} glow={glow} you={you} />;
  }
  const rows: Row[] = [];
  const groups: string[] = [];
  for (const t of trophies) if (!groups.includes(groupOf(t))) groups.push(groupOf(t));
  for (const g of groups) {
    rows.push(row(`g-${g}`, <Title style={{ marginTop: 6 }}>{g}</Title>));
    for (const t of trophies.filter(x => groupOf(x) === g)) {
      const tone = TROPHY_TONE[t.kind];
      const mine = t.club === you;
      rows.push(row(`t-${t.competition}`, (
        <Press onPress={() => setOpen(t)} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 10, backgroundColor: rgba(tone, 0.2), borderWidth: 1, borderColor: rgba(tone, mine ? 0.95 : 0.5) }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: rgba(tone, 0.3), alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 18 }}>🏆</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.dim, fontSize: 10.5, fontWeight: "900", letterSpacing: 1 }}>{t.competition.toUpperCase()}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              {t.kind === "intl" ? <Flag nation={t.club} size={14} /> : <ClubBadge club={t.club} size={20} />}
              <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 15, flexShrink: 1 }}>{t.kind === "intl" ? t.club : shortClub(t.club)}</Text>
              {mine && <Text style={{ backgroundColor: C.gold, color: "#111", fontSize: 9, fontWeight: "900", paddingHorizontal: 5, borderRadius: 6, overflow: "hidden" }}>YOU</Text>}
            </View>
          </View>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>›</Text>
        </Press>
      )));
    }
  }
  return (
    <RowList rows={rows} header={<>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: C.text, fontWeight: "900", fontSize: 22 }}>Season {summary.season}</Text>
        {onClose ? <CloseBtn onPress={onClose} /> : onNow ? (
          <Press onPress={onNow} style={{ borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: rgba(glow, 0.3) }}>
            <Text style={{ color: C.text, fontWeight: "900" }}>← This season</Text>
          </Press>
        ) : null}
      </View>
      <Text style={{ color: C.dim, fontWeight: "700" }}>Tap a trophy to see its table, scorers and assists.</Text>
    </>} />
  );
}

function TrophyDetail({ head, summary, trophy, glow, you }: { head: ReactNode; summary: WorldSummary; trophy: Exclude<Trophy, { kind: "intl" }>; glow: string; you: string }) {
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
  const [pick, setPick] = useState(cup?.rounds[cup.rounds.length - 1]?.name ?? "");
  const finalCard = final ? <ShieldCard home={final.home} away={final.away} hs={final.hs} as={final.as} pens={final.pens} winner={final.winner} /> : null;
  let body: Row[];
  if (tab === "table") {
    body = table ? [row("head", <TableHead />), ...tableRows("t", table.rows, glow, you, trophy.kind === "league" ? finalZone(trophy.division, table.rows, summary) : (p) => euroZone(p)),
      row("key", <ZoneKey items={trophy.kind === "euro"
        ? [["#10b981", "Top 8: straight to the last 16"], ["#3b82f6", "9th to 24th: knockout play-off"], ["#ef4444", "Out"]]
        : trophy.kind === "league" && LINES[trophy.division].europe
          ? [[ZONE.ucl, "Champions League"], [ZONE.uel, "Europa League"], [ZONE.down, "Relegated"]]
          : [[ZONE.up, "Promoted"], [ZONE.down, "Relegated"]]} />)] : [row("e", <Empty text="No table kept for this one." />)];
  } else if (tab === "knockout") body = [row("ko", bracket ? <EuroKnockout bracket={bracket} glow={glow} you={you} /> : finalCard ?? <Empty text="No knockout kept for this season." />)];
  else if (tab === "rounds") body = cup ? cupRoundsRows({ competition: name, rounds: cup.rounds } as unknown as CupState, pick, glow, you) : [row("f", finalCard ?? <Empty text="No rounds kept for this season." />)];
  else if (tab === "final") body = [row("f", finalCard ?? <Empty text="No final kept for this one." />)];
  else if (tab === "goals") body = scorerRows("g", asRows(sc?.goals ?? []), glow, "goals");
  else body = scorerRows("a", asRows(sc?.assists ?? []), glow, "assists");
  return (
    <RowList rows={body} header={<>
      {head}
      <WinnerBar club={trophy.club} />
      {tabs.length > 1 ? <Seg value={tab} onChange={setTab} tabs={tabs} /> : null}
      {tab === "rounds" && cup ? <Chips value={pick} onChange={setPick} items={cup.rounds.map(r => [r.name, roundChip(r.name)] as const)} /> : null}
    </>} />
  );
}

