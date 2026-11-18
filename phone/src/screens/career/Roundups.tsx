/**
 * THE ROUND-UPS BETWEEN MATCHES (page.tsx: deadline-day, knockout-roundup,
 * playoff-roundup, intl-tournament-table). The same data the website draws:
 *  - Deadline Day: DeadlineDayRoundup.tsx's buildBusiness, club by club.
 *  - Knockouts: lib/star/knockoutView.ts knockoutRoundupFor's stages (table,
 *    results board, bracket), shown as lists (no animation).
 *  - Play-offs: lib/star/playOffBracket.ts buildBracket.
 *  - The summer tournament: TournamentScreen's "progress" (groupTable, the
 *    knockout road, the winner).
 */
import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import type { BoardTie, BracketView, Roundup, RoundupStage } from "@/lib/star/knockoutView";
import { competitionLook } from "@/lib/star/competitionLook";
import { buildBracket, type BracketTie } from "@/lib/star/playOffBracket";
import { groupTable, yourGroup, type TournamentState } from "@/lib/star/tournament";
import { tieWinner } from "@/lib/star/cups";
import { kitsOf } from "@/lib/star/kits";
import { seasonStartYear, divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { FREE_AGENTS_CLUB } from "@/lib/star/leagueSquads";
import { shortClub } from "@/lib/star/media/grammar";
import { formatMoneyPrecise } from "@/lib/star/money";
import { sortLeague } from "@/lib/star/season";
import { nextFixtureFor } from "@/lib/star/competitions";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, ClubCrest, C } from "./kit";

// ═════════════ Deadline Day ═════════════
interface Deal { player: string; counterpart: string; overall: number; detail: string; loan: boolean; unhappy: boolean }
interface ClubBusiness { club: string; in: Deal[]; out: Deal[] }
function loanReturnLabel(career: CareerState, returnSeason: number): string {
  const y = seasonStartYear(career.player.startYear, returnSeason + 1);
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}
/** DeadlineDayRoundup.tsx buildBusiness, unchanged. */
function buildBusiness(career: CareerState): ClubBusiness[] {
  const inDivision = new Set(career.league.map((t) => t.name));
  const byClub = new Map<string, ClubBusiness>();
  const get = (club: string): ClubBusiness | null => {
    if (!inDivision.has(club)) return null;
    let b = byClub.get(club);
    if (!b) { b = { club, in: [], out: [] }; byClub.set(club, b); }
    return b;
  };
  for (const t of career.league) get(t.name);
  for (const m of career.leagueTransferNews ?? []) {
    const detail = m.fee > 0 ? `★${formatMoneyPrecise(m.fee)}` : "Free Transfer";
    if (m.to !== FREE_AGENTS_CLUB) get(m.to)?.in.push({ player: m.player, counterpart: m.from, overall: m.overall, detail, loan: false, unhappy: m.unhappy });
    if (m.from !== FREE_AGENTS_CLUB) get(m.from)?.out.push({ player: m.player, counterpart: m.to, overall: m.overall, detail, loan: false, unhappy: m.unhappy });
  }
  for (const l of career.leagueLoanNews ?? []) {
    const detail = `Loan · back ${loanReturnLabel(career, l.returnSeason)}`;
    get(l.loanClub)?.in.push({ player: l.player, counterpart: l.parentClub, overall: l.overall, detail, loan: true, unhappy: false });
    get(l.parentClub)?.out.push({ player: l.player, counterpart: l.loanClub, overall: l.overall, detail, loan: true, unhappy: false });
  }
  const list = Array.from(byClub.values());
  list.sort((a, b) => {
    if (a.club === career.player.club) return -1;
    if (b.club === career.player.club) return 1;
    const byBusiness = (b.in.length + b.out.length) - (a.in.length + a.out.length);
    return byBusiness !== 0 ? byBusiness : a.club.localeCompare(b.club);
  });
  return list;
}
const WINDOW_LABEL: Record<string, string> = { summer: "Summer Window", january: "January Window" };

export function DeadlineDayScreen({ career, onContinue }: { career: CareerState; onContinue: () => void }) {
  const business = useMemo(() => buildBusiness(career), [career]);
  const [selected, setSelected] = useState(() => business[0]?.club ?? career.player.club);
  const active = business.find((b) => b.club === selected) ?? business[0];
  const totalDeals = (career.leagueTransferNews?.length ?? 0) + (career.leagueLoanNews?.length ?? 0);
  const totalSpend = Math.round((career.leagueTransferNews ?? []).reduce((sum, m) => sum + m.fee, 0));
  const windowLabel = WINDOW_LABEL[(career.lastTransferWindowKey ?? "").split("-")[1]] ?? "Transfer Window";
  const dealRow = (d: Deal, dir: "in" | "out", i: number) => (
    <View key={`${dir}${i}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
      <Text style={{ color: dir === "in" ? C.green : C.red, fontWeight: "900", width: 22 }}>{dir === "in" ? "▲" : "▼"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: "900" }}>{d.player}{d.unhappy ? " 😠" : ""} <Text style={{ color: C.gold }}>{d.overall}</Text></Text>
        <Text style={{ color: C.dim, fontSize: 12 }}>{dir === "in" ? "from" : "to"} {shortClub(d.counterpart)}</Text>
      </View>
      <Text style={{ color: d.loan ? "#7dd3fc" : C.text, fontWeight: "800", fontSize: 12 }}>{d.detail}</Text>
    </View>
  );
  return (
    <Frame kicker={`Season ${career.season} · ${windowLabel} closed`} title="DEADLINE DAY" footer={<Btn kind="gold" label="Continue →" onPress={onContinue} />}>
      <Text style={{ color: C.text, textAlign: "center", fontWeight: "700" }}>
        <Text style={{ color: C.gold, fontWeight: "900" }}>{totalDeals}</Text> deal{totalDeals === 1 ? "" : "s"} done across the division{totalSpend > 0 ? ` · ★${formatMoneyPrecise(totalSpend)} changed hands` : ""}.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {business.map((b) => {
          const on = b.club === selected;
          const count = b.in.length + b.out.length;
          return (
            <Press key={b.club} onPress={() => setSelected(b.club)} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: on ? C.gold : C.line, backgroundColor: on ? "#000" : "rgba(255,255,255,0.04)" }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kitsOf(b.club).home.shirt }} />
              <Text style={{ color: on ? C.gold : count ? C.text : C.dim, fontSize: 11, fontWeight: "900" }}>{shortClub(b.club)}</Text>
              <Text style={{ color: on ? C.gold : C.dim, fontSize: 10, fontWeight: "900" }}>{count}</Text>
            </Press>
          );
        })}
      </View>
      {active && (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <ClubCrest club={active.club} size={34} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", flex: 1 }}>{active.club}</Text>
          </View>
          <Label color={C.green}>{`In · ${active.in.length}`}</Label>
          {active.in.length ? active.in.map((d, i) => dealRow(d, "in", i)) : <Text style={{ color: C.dim }}>No incomings.</Text>}
          <View style={{ height: 10 }} />
          <Label color={C.red}>{`Out · ${active.out.length}`}</Label>
          {active.out.length ? active.out.map((d, i) => dealRow(d, "out", i)) : <Text style={{ color: C.dim }}>No outgoings.</Text>}
        </Card>
      )}
    </Frame>
  );
}

// ═════════════ Knockout round-up ═════════════
function legsLine(t: BoardTie): string | null {
  const bits: string[] = [];
  if (t.legs && t.legs.length > 1) bits.push(`${t.legs[0].hs}–${t.legs[0].as}, ${t.legs[1].hs}–${t.legs[1].as}`);
  if (t.aet) bits.push("aet");
  if (t.pens) bits.push(`pens ${t.pens.hs}–${t.pens.as}`);
  return bits.length ? bits.join(" · ") : null;
}
function Board({ ties }: { ties: BoardTie[] }) {
  return (
    <View style={{ gap: 4 }}>
      {ties.map((t) => {
        const played = t.hs !== undefined;
        const homeWon = t.winner === t.home, awayWon = t.winner === t.away;
        const line = legsLine(t);
        return (
          <View key={`${t.home}-${t.away}`} style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: t.yours ? "rgba(250,204,21,.16)" : "rgba(0,0,0,.25)", borderWidth: t.yours ? 1.5 : 0, borderColor: "#facc15" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text numberOfLines={1} style={{ flex: 1, textAlign: "right", color: C.text, opacity: awayWon ? 0.45 : 1, fontWeight: homeWon ? "900" : "600" }}>{shortClub(t.home)}</Text>
              <Text style={{ color: C.text, fontWeight: "900", width: 52, textAlign: "center" }}>{played ? `${t.hs}–${t.as}` : "v"}</Text>
              <Text numberOfLines={1} style={{ flex: 1, color: C.text, opacity: homeWon ? 0.45 : 1, fontWeight: awayWon ? "900" : "600" }}>{shortClub(t.away)}</Text>
            </View>
            {(line || t.upset) && <Text style={{ color: t.upset ? C.gold : C.dim, fontSize: 10, textAlign: "center", marginTop: 2 }}>{[line, t.upset ? "UPSET" : null].filter(Boolean).join(" · ")}</Text>}
          </View>
        );
      })}
    </View>
  );
}
const BRACKET_NAMES = ["Round of 16", "Quarter-finals", "Semi-finals", "Final"];
function BracketList({ view }: { view: BracketView }) {
  const offset = 4 - view.rounds.length;
  return (
    <View style={{ gap: 10 }}>
      {view.rounds.map((round, ri) => (
        <View key={ri}>
          <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 4 }}>{(BRACKET_NAMES[ri + offset] ?? `Round ${ri + 1}`).toUpperCase()}</Text>
          {round.map((t, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6, backgroundColor: t.yours ? "rgba(250,204,21,.16)" : "transparent" }}>
              <Text numberOfLines={1} style={{ flex: 1, color: t.winner && t.winner === t.top ? C.text : C.dim, fontWeight: "800" }}>{t.top ? shortClub(t.top) : "—"}</Text>
              <Text style={{ color: C.text, fontWeight: "900", width: 50, textAlign: "center" }}>{t.topScore !== undefined ? `${t.topScore}–${t.bottomScore}` : "v"}</Text>
              <Text numberOfLines={1} style={{ flex: 1, textAlign: "right", color: t.winner && t.winner === t.bottom ? C.text : C.dim, fontWeight: "800" }}>{t.bottom ? shortClub(t.bottom) : "—"}</Text>
              {t.note ? <Text style={{ color: C.dim, fontSize: 9, width: 50, textAlign: "right" }}>{t.note}</Text> : null}
            </View>
          ))}
        </View>
      ))}
      {view.champion && <Text style={{ color: C.gold, fontSize: 16, fontWeight: "900", textAlign: "center" }}>🏆 {view.champion}</Text>}
    </View>
  );
}
function StageCard({ stage }: { stage: RoundupStage }) {
  return (
    <Card>
      <Label>{stage.title}</Label>
      {stage.kind === "board" && <Board ties={stage.ties} />}
      {stage.kind === "bracket" && <BracketList view={stage.view} />}
      {stage.kind === "table" && stage.rows.map((r, i) => (
        <View key={r.name} style={{ flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6, backgroundColor: r.yours ? "rgba(250,204,21,.16)" : "transparent" }}>
          <Text style={{ color: C.dim, width: 26, fontWeight: "800" }}>{i + 1}</Text>
          <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: r.yours ? "900" : "600" }}>{shortClub(r.name)}</Text>
          <Text style={{ color: C.dim, width: 36, textAlign: "right" }}>{r.gd > 0 ? `+${r.gd}` : r.gd}</Text>
          <Text style={{ color: C.text, width: 34, textAlign: "right", fontWeight: "900" }}>{r.pts}</Text>
        </View>
      ))}
    </Card>
  );
}
export function KnockoutRoundupScreen({ ko, onContinue }: { ko: Roundup; onContinue: () => void }) {
  const look = competitionLook(ko.competition);
  return (
    <Frame kicker="Round-up" title={ko.competition} footer={<Btn label="Continue →" onPress={onContinue} />}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: look.glow }} />
      {ko.stages.map((s, i) => <StageCard key={i} stage={s} />)}
      {ko.nextLine ? <Card tone={look.glow}><Text style={{ color: C.text, fontWeight: "900", textAlign: "center" }}>{ko.nextLine}</Text></Card> : null}
    </Frame>
  );
}

// ═════════════ Play-offs ═════════════
const STAGE_NAME = ["Qualifiers", "Semi-finals", "Final"];
export function PlayOffRoundupScreen({ career, onContinue }: { career: CareerState; onContinue: () => void }) {
  const po = career.playOffState;
  if (!po) return <Frame title="Play-offs"><Btn label="Continue" onPress={onContinue} /></Frame>;
  const table = sortLeague(career.league).map((t) => t.name);
  const upcoming = nextFixtureFor(career);
  const nextPo = upcoming?.kind === "playoff" ? upcoming : undefined;
  const you = career.player.club;
  const nextLine = nextPo
    ? `${nextPo.round} · ${nextPo.round === "Play-Off Final" && po.format !== "six" ? "at Wembley v" : nextPo.home ? "home to" : "away at"} ${shortClub(nextPo.opponent)}`
    : po.promoted === you ? "Promoted!" : po.promoted ? `${shortClub(po.promoted)} go up` : "Out of the play-offs";
  const bracket = buildBracket(po, you, (c) => table.indexOf(c) + 1, nextPo?.round);
  const stages = [0, 1, 2].map((s) => bracket.ties.filter((t) => t.stage === s)).filter((x) => x.length);
  const team = (t: BracketTie, side: "top" | "bottom") => {
    const tm = t[side];
    if (!tm) return t.bye === side ? "Bye" : "—";
    return `${tm.pos}. ${shortClub(tm.club)}`;
  };
  return (
    <Frame kicker="Play-offs" title={leagueNameFor(divisionOf(career))} footer={<Btn label="Continue →" onPress={onContinue} />}>
      {stages.map((ties, si) => (
        <Card key={si}>
          <Label>{STAGE_NAME[ties[0].stage] ?? ""}</Label>
          {ties.map((t) => (
            <View key={t.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 6, borderRadius: 6, backgroundColor: t.yours ? "rgba(250,204,21,.16)" : "transparent", borderWidth: t.next ? 1 : 0, borderColor: C.gold }}>
              <Text numberOfLines={1} style={{ flex: 1, color: t.winner && t.winner === t.top?.club ? C.text : C.dim, fontWeight: "800" }}>{team(t, "top")}</Text>
              <Text style={{ color: C.text, fontWeight: "900", width: 50, textAlign: "center" }}>{t.topScore !== undefined ? `${t.topScore}–${t.bottomScore}` : "v"}</Text>
              <Text numberOfLines={1} style={{ flex: 1, textAlign: "right", color: t.winner && t.winner === t.bottom?.club ? C.text : C.dim, fontWeight: "800" }}>{team(t, "bottom")}</Text>
            </View>
          ))}
          {ties.some((t) => t.note) && <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{ties.map((t) => t.note).filter(Boolean).join(" · ")}</Text>}
        </Card>
      ))}
      {bracket.promoted && <Text style={{ color: C.gold, fontSize: 18, fontWeight: "900", textAlign: "center" }}>⬆ {bracket.promoted} go up</Text>}
      <Card tone={C.gold}><Text style={{ color: C.text, fontWeight: "900", textAlign: "center" }}>{nextLine}</Text></Card>
    </Frame>
  );
}

// ═════════════ The summer tournament ═════════════
const TNAME: Record<string, string> = { "World Cup": "World Cup", "European Championship": "Euros" };
export function TournamentTableScreen({ career, onContinue }: { career: CareerState; onContinue: () => void }) {
  const state: TournamentState | undefined = career.tournament;
  if (!state || state.season !== career.season) return <Frame title="Tournament"><Btn label="Continue →" onPress={onContinue} /></Frame>;
  const { nation, competition, winner } = state;
  const year = seasonStartYear(career.player.startYear, career.season) + 1;
  const g = yourGroup(state);
  const table = g ? groupTable(g) : [];
  const inKo = state.ko.length > 0 && state.ko[0].ties.some((t) => t.home === nation || t.away === nation);
  const out = !!state.yourExit && state.yourExit !== "Winners";
  const headline = state.yourExit === "Winners" ? "Champions!" : out ? "Going home" : inKo ? "Knockouts" : `Group ${g?.name ?? ""}`;
  return (
    <Frame kicker={`${TNAME[competition] ?? competition} · Summer ${year}`} title={headline} footer={<Btn kind="gold" label="Continue →" onPress={onContinue} />}>
      <Card style={{ alignItems: "center" }}>
        <ClubCrest club={nation} size={64} />
        {career.knockoutMessage ? <Text style={{ color: C.text, fontWeight: "800", marginTop: 8, textAlign: "center" }}>{career.knockoutMessage}</Text> : null}
      </Card>
      {g && !inKo && (
        <Card>
          <Label>{`Group ${g.name}`}</Label>
          <View style={{ flexDirection: "row", paddingBottom: 4 }}>
            <Text style={{ flex: 1, color: C.dim, fontSize: 10, fontWeight: "900" }}>TEAM</Text>
            {["P", "W", "D", "L", "GD", "Pts"].map((h) => <Text key={h} style={{ width: 30, textAlign: "center", color: C.dim, fontSize: 10, fontWeight: "900" }}>{h}</Text>)}
          </View>
          {table.map((r, i) => (
            <View key={r.name} style={{ flexDirection: "row", paddingVertical: 4, borderTopWidth: 1, borderColor: C.line, backgroundColor: r.name === nation ? "rgba(252,211,77,.15)" : "transparent" }}>
              <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: "700" }}><Text style={{ color: i < 2 ? C.green : C.dim }}>{i + 1} </Text>{r.name}</Text>
              {[r.p, r.w, r.d, r.l, r.gf - r.ga, r.pts].map((v, k) => <Text key={k} style={{ width: 30, textAlign: "center", color: C.text, fontWeight: k === 5 ? "900" : "600" }}>{k === 4 && v > 0 ? `+${v}` : v}</Text>)}
            </View>
          ))}
          <Text style={{ color: C.dim, fontSize: 10, marginTop: 4 }}>Top two go through{state.groups.length === 6 ? ", and the four best third-placed sides" : ""}.</Text>
          {g.matches.filter((m) => m.home === nation || m.away === nation).map((m) => (
            <View key={m.md} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900" }}>MATCH {m.md}</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 12 }}>{m.home} {m.hs !== undefined ? `${m.hs}–${m.as}` : "v"} {m.away}</Text>
            </View>
          ))}
        </Card>
      )}
      {inKo && (
        <Card>
          {state.ko.map((round) => {
            const tie = round.ties.find((t) => t.home === nation || t.away === nation);
            const w = tie ? tieWinner(tie) : null;
            return (
              <View key={round.name} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderColor: C.line }}>
                <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900" }}>{round.name.toUpperCase()}</Text>
                {tie ? <Text style={{ color: w === nation ? C.green : w ? C.red : C.text, fontWeight: "800", fontSize: 13 }}>
                  {tie.home} {tie.hs !== undefined ? `${tie.hs}–${tie.as}` : "v"} {tie.away}{tie.pens ? ` (${tie.pens.home}–${tie.pens.away} pens)` : ""}
                </Text> : <Text style={{ color: C.dim }}>—</Text>}
              </View>
            );
          })}
        </Card>
      )}
      {winner && <Card tone={C.gold}><Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", textAlign: "center" }}>{competition.toUpperCase()} WINNERS</Text><Text style={{ color: "#fde68a", fontSize: 18, fontWeight: "900", textAlign: "center", marginTop: 4 }}>🏆 {winner}</Text></Card>}
    </Frame>
  );
}

