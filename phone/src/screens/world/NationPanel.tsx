/**
 * YOUR NATION (the website's components/star/IntlWorldPanel.tsx + IntlKit.tsx):
 * the nation card (flag, FIFA ranking, caps, goals), the national manager's
 * card with its squad/starter bar, and five tabs: Tables · Matches · Scorers ·
 * Ranking · Who won. Every number comes from lib/star/intl, as on the website.
 */
import { useMemo, useState, type ReactNode } from "react";
import { ScrollView, Text, View, type ViewStyle } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { SQUAD_AT, START_AT, intlOf, managerLine, myGroups, myMatches, myRanking, topRanking, whoWon, type GroupView, type MatchView } from "@/lib/star/intl/career";
import { intlSeason, topIntlScorers, scorerLines, type IntlSeason } from "@/lib/star/intl/scorers";
import { nationKits } from "@/lib/star/international";
import { NationFlag } from "../../draw/NationFlag";
import { Press } from "../../ui/Press";
import { FONT, glassStyle } from "../../ui/look";
import { Seg, youRow, rgba } from "../../world/ui";
import { luminance, tint } from "@/lib/star/heroFigure";

const AMBER = "#fcd34d";
const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The colour a nation lights its rows with: IntlKit's nationGlow = glowOf(shirt, trim). A white shirt
 *  falls back to its trim; a very dark one is lifted 35% toward white (England: navy trim, lit grey-violet). */
export function nationGlow(nation: string): string {
  try {
    const k = nationKits(nation).home;
    const base = luminance(k.shirt) > 0.85 ? k.trim : k.shirt;
    return luminance(base) < 0.12 ? tint(base, 0.35) : base;
  } catch { return "#3b82f6"; }
}

const glass = (_glow: string): ViewStyle[] => [glassStyle("glass") as ViewStyle, { borderRadius: 16, overflow: "hidden" }];

function Card({ title, right, glow, children }: { title: string; right?: ReactNode; glow: string; children: ReactNode }) {
  return (
    <View style={glass(glow)}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.3)", borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: AMBER, fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }}>{title}</Text>
        {right}
      </View>
      <View style={{ padding: 6 }}>{children}</View>
    </View>
  );
}
const Line = ({ children }: { children: ReactNode }) => <Text style={{ padding: 6, color: "rgba(255,255,255,0.85)", fontSize: 11.5, lineHeight: 16, fontWeight: "700" }}>{children}</Text>;

function ManagerCard({ value, nation, line }: { value: number; nation: string; line: string }) {
  const v = Math.round(value);
  const [c1, c2] = v >= START_AT ? ["#f59e0b", "#fde68a"] : v >= SQUAD_AT ? ["#38bdf8", "#a5f3fc"] : ["#94a3b8", "#e2e8f0"];
  const verdict = v >= START_AT ? "Starter" : v >= SQUAD_AT ? "In the squad" : "Not picked";
  return (
    <View style={{ borderRadius: 16, padding: 12, overflow: "hidden",
      // IntlKit ManagerCard: the colour glows from the top-left corner over the see-through card glass; an inset rim, no border (108 px tall)
      backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${rgba(c1, 0.3)} 0%, ${rgba(c1, 0)} 55%), linear-gradient(180deg, rgba(14,30,52,0.6), rgba(14,30,52,0.6))`,
      boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.10), inset 0px 0px 0px 1px ${rgba(c1, 0.32)}, 0px 10px 24px -12px rgba(0,0,0,0.8)` } as ViewStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: rgba(c1, 0.3), borderWidth: 1, borderColor: rgba(c1, 0.5) }}>
          <NationFlag nation={nation} width={30} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 15, lineHeight: 19, fontWeight: "900" }}>{nation} manager</Text>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10.5, lineHeight: 14.5, fontWeight: "700" }}>{line}</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: c2, fontSize: 24, lineHeight: 26, fontWeight: "900", fontVariant: ["tabular-nums"], textShadowColor: rgba(c1, 0.7), textShadowRadius: 12 }}>{v}</Text>
          <Text style={{ color: c2, fontSize: 10, lineHeight: 13, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase", marginTop: 2 }}>{verdict}</Text>
        </View>
      </View>
      <View style={{ marginTop: 10, height: 12 }}>
        <View style={{ height: 12, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
          <View style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: "100%", borderRadius: 6, backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})` } as ViewStyle} />
        </View>
        <View pointerEvents="none" style={{ position: "absolute", top: -2, left: `${SQUAD_AT}%`, width: 2, height: 16, backgroundColor: "#fff" }} />
        <View pointerEvents="none" style={{ position: "absolute", top: -2, left: `${START_AT}%`, width: 2, height: 16, backgroundColor: AMBER }} />
      </View>
      <View style={{ marginTop: 4, height: 14 }}>
        <Text numberOfLines={1} style={{ position: "absolute", left: `${SQUAD_AT}%`, width: 80, marginLeft: -40, textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 9.5, lineHeight: 14, fontWeight: "900", letterSpacing: 0.3 }}>SQUAD {SQUAD_AT}</Text>
        <Text numberOfLines={1} style={{ position: "absolute", left: `${START_AT}%`, width: 80, marginLeft: -40, textAlign: "center", color: AMBER, fontSize: 9.5, lineHeight: 14, fontWeight: "900", letterSpacing: 0.3 }}>STARTER {START_AT}</Text>
      </View>
    </View>
  );
}

const COLW = [24, 0, 26, 26, 26, 30, 32];
function TCells({ cells, head, you, lead }: { cells: ReactNode[]; head?: boolean; you?: boolean; lead?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, gap: 4 }}>
      {cells.map((c, i) => (
        <View key={i} style={{ width: COLW[i] || undefined, flex: COLW[i] ? undefined : 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: i === 1 ? "flex-start" : "center", gap: 6 }}>
          {i === 1 && lead}
          <Text numberOfLines={1} style={{ flexShrink: 1, color: head ? (i === 6 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.55)") : i === 6 && you ? "#fef08a" : i >= 2 && i <= 5 ? "rgba(255,255,255,0.85)" : "#fff", fontSize: head ? 9 : 11, lineHeight: head ? 13.5 : 16.5, letterSpacing: head ? 0.9 : 0, fontWeight: head || i === 0 || i === 6 || (you && i === 1) ? "900" : "700", includeFontPadding: false }}>{c}</Text>
        </View>
      ))}
    </View>
  );
}
export function NationTable({ group, nation, glow, through = 2 }: { group: GroupView; nation: string; glow: string; through?: number }) {
  return (
    <View style={glass(glow)}>
      <View style={{ backgroundColor: "rgba(0,0,0,0.3)", borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: AMBER, fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }}>{group.title}</Text>
      </View>
      <View style={{ backgroundColor: "rgba(0,0,0,0.3)", borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
        <TCells head cells={["#", "NATION", "P", "W", "D", "GD", "PTS"]} />
      </View>
      {group.rows.map((r, i) => {
        const you = r.name === nation;
        const band = i < through ? (i === 0 ? "#fbbf24" : "#22c55e") : null;
        return (
          <View key={r.name} style={[i % 2 === 0 && !you ? { backgroundColor: "rgba(255,255,255,0.035)" } : null, you && [youRow(glow), { borderWidth: 0, borderRadius: 6 }]]}>
            {band ? <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: band }} /> : null}
            <TCells you={you} lead={<NationFlag nation={r.name} width={18} />} cells={[String(i + 1), r.name, r.p, r.w, r.d, r.gd > 0 ? `+${r.gd}` : r.gd, r.pts]} />
          </View>
        );
      })}
    </View>
  );
}

type Goals = { home: string[]; away: string[] } | null;
export function NationMatchRow({ m, glow, nation, goals }: { m: MatchView; glow: string; nation?: string; goals?: Goals }) {
  const mine = m.mine || (nation ? m.home === nation || m.away === nation : false);
  const done = m.hs !== undefined && m.as !== undefined;
  const [ph, pa] = m.pens ? m.pens.split(" ")[0].split("-").map(Number) : [0, 0];
  const homeWon = done && (m.hs! > m.as! || (m.hs === m.as && ph > pa));
  const awayWon = done && (m.as! > m.hs! || (m.hs === m.as && pa > ph));
  const t = (won: boolean) => ({ flexShrink: 1, color: won ? "#fff" : "rgba(255,255,255,0.85)", fontSize: 11, lineHeight: 16.5, fontWeight: won ? "900" : "700" } as const);
  return (
    <View style={[{ borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.04)" }, mine && [youRow(glow), { borderWidth: 0 }]]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
          <Text numberOfLines={1} style={[t(homeWon), { textAlign: "right" }]}>{m.home}</Text>
          <NationFlag nation={m.home} width={18} />
        </View>
        <Text style={{ backgroundColor: "rgba(0,0,0,0.45)", color: "#fff", fontWeight: "900", fontSize: 11, lineHeight: 16.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden", fontVariant: ["tabular-nums"] }}>{done ? `${m.hs}-${m.as}` : "v"}</Text>
        <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <NationFlag nation={m.away} width={18} />
          <Text numberOfLines={1} style={t(awayWon)}>{m.away}</Text>
        </View>
      </View>
      {m.pens ? <Text style={{ color: AMBER, fontSize: 9.5, lineHeight: 14, fontWeight: "700", textAlign: "center" }}>{m.pens}</Text> : null}
      {goals && (goals.home.length || goals.away.length) ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Text style={{ flex: 1, textAlign: "right", color: "rgba(255,255,255,0.85)", fontSize: 9.5, lineHeight: 13.5, fontWeight: "700" }}>{goals.home.join(", ")}</Text>
          <Text style={{ width: 34, textAlign: "center", fontSize: 9.5, lineHeight: 13.5 }}>⚽</Text>
          <Text style={{ flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 9.5, lineHeight: 13.5, fontWeight: "700" }}>{goals.away.join(", ")}</Text>
        </View>
      ) : null}
    </View>
  );
}

type Tab = "overview" | "matches" | "scorers" | "ranking" | "winners";

export function NationPanel({ top, career }: { top: ReactNode; career: CareerState }) {
  const data = useMemo(() => {
    try {
      const s = intlOf(career);
      let season: IntlSeason | null = null;
      try { season = intlSeason(career); } catch { season = null; }
      let scorers: { name: string; nation: string; goals: number; assists: number }[] = [];
      if (season) {
        const you = { name: `${career.player.firstName} ${career.player.lastName} (you)`, nation: s.nation, goals: season.you.goals, assists: season.you.assists };
        const list = topIntlScorers(season, 15);
        scorers = (you.goals || you.assists ? [...list, you] : list).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 15);
      }
      return { s, line: managerLine(career), groups: myGroups(career, 2), matches: myMatches(career), rank: myRanking(career), top: topRanking(career, 10), won: whoWon(career), scorers, season };
    } catch { return null; }
  }, [career]);
  const [tab, setTab] = useState<Tab>("overview");
  const [allWinners, setAllWinners] = useState(false);
  const wrap = (body: ReactNode) => (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 110, gap: 8 }}>{top}{body}</ScrollView>
  );
  if (!data) return wrap(<View style={[...glass("#3b82f6"), { padding: 12 }]}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>No national team yet.</Text></View>);
  const { s, line, groups, matches, rank, won, scorers, season } = data;
  const nation = s.nation;
  const glow = nationGlow(nation);
  const goalsOf = (m: MatchView): Goals => { try { return season && m.id ? scorerLines(career, season, m.id, m.home) : null; } catch { return null; } };
  const rowBg = (i: number, mine: boolean) => [{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 6 } as ViewStyle, !mine && i % 2 === 0 ? { backgroundColor: "rgba(255,255,255,0.035)" } : null, mine && [youRow(glow), { borderWidth: 0 }]];
  const cell = { color: "#fff", fontSize: 11.5, lineHeight: 16.5, fontWeight: "700" } as const;
  return wrap(<>
    <View style={[...glass(glow), { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }]}>
      <NationFlag nation={nation} width={52} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 24, lineHeight: 28, textTransform: "uppercase" }}>{nation}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 16, fontWeight: "700" }}>FIFA ranking <Text style={{ color: AMBER, fontWeight: "900" }}>#{rank.rank}</Text> · {rank.points.toLocaleString("en-GB")} pts</Text>
      </View>
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: "#fff", fontSize: 22, lineHeight: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{career.caps ?? 0}</Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 9.5, lineHeight: 13, fontWeight: "900", letterSpacing: 0.3 }}>CAPS</Text>
        <Text style={{ marginTop: 3, color: "#6ee7b7", fontSize: 13, lineHeight: 15, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{career.internationalGoals ?? 0}</Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 9.5, lineHeight: 13, fontWeight: "900", letterSpacing: 0.3 }}>GOALS</Text>
      </View>
    </View>
    <ManagerCard value={s.manager} nation={nation} line={line} />
    <Seg value={tab} onChange={setTab} tabs={[["overview", "Tables"], ["matches", "Matches"], ["scorers", "Scorers"], ["ranking", "Ranking"], ["winners", "Who won"]] as const} />

    {tab === "overview" && (groups.length ? groups.map(g => <NationTable key={g.title} group={g} nation={nation} glow={glow} through={1} />) : (
      <View style={[...glass(glow), { padding: 12 }]}><Text style={{ color: "#fff", fontSize: 12, lineHeight: 17, fontWeight: "700" }}>No group games yet. {nation}'s first is in the September–October break.</Text></View>
    ))}

    {tab === "matches" && (<>
      <Card title="Next" glow={glow}>
        {matches.next.length ? matches.next.map((m, i) => (
          <View key={i}>
            <Text style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 2, color: "rgba(255,255,255,0.75)", fontSize: 9.5, lineHeight: 14, fontWeight: "700" }}>{day(m.date)} · {m.comp} · {m.stage}</Text>
            <NationMatchRow m={m} glow={glow} nation={nation} />
          </View>
        )) : <Line>Not drawn yet.</Line>}
      </Card>
      <Card title="Last results" glow={glow}>
        {matches.last.length ? matches.last.map((m, i) => (
          <View key={i}>
            <Text style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 2, color: "rgba(255,255,255,0.75)", fontSize: 9.5, lineHeight: 14, fontWeight: "700" }}>{day(m.date)} · {m.comp} · {m.stage}</Text>
            <NationMatchRow m={m} glow={glow} nation={nation} goals={goalsOf(m)} />
          </View>
        )) : <Line>None played yet.</Line>}
      </Card>
    </>)}

    {tab === "scorers" && (
      <Card title="International scorers · this season" glow={glow}>
        {scorers.length === 0 ? <Line>No international goals yet this season.</Line> : scorers.map((p, i) => {
          const mine = p.nation === nation;
          return (
            <View key={`${p.nation}|${p.name}`} style={rowBg(i, mine)}>
              <Text style={[cell, { width: 22, textAlign: "center", fontWeight: "900" }]}>{i + 1}</Text>
              <NationFlag nation={p.nation} width={18} />
              <Text numberOfLines={1} style={[cell, { flex: 1 }]}>{p.name}</Text>
              <Text style={[cell, { color: "#6ee7b7", fontWeight: "900" }]}>{p.goals}<Text style={{ fontSize: 9, color: "rgba(255,255,255,0.75)" }}> g</Text></Text>
              <Text style={[cell, { width: 32, textAlign: "right", color: "rgba(255,255,255,0.85)", fontWeight: "900" }]}>{p.assists}<Text style={{ fontSize: 9, color: "rgba(255,255,255,0.75)" }}> a</Text></Text>
            </View>
          );
        })}
        <Text style={{ paddingHorizontal: 6, paddingTop: 6, color: "rgba(255,255,255,0.8)", fontSize: 10, lineHeight: 14, fontWeight: "700" }}>Every match in the world since last season's Golden Ball night. These count towards this year's.</Text>
      </Card>
    )}

    {tab === "ranking" && (
      <Card title="FIFA ranking · top 10" glow={glow} right={<Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "900" }}>{nation} #{rank.rank}</Text>}>
        {data.top.map((t, i) => {
          const you = t.name === nation;
          return (
            <View key={t.name} style={rowBg(i, you)}>
              <Text style={[cell, { width: 24, textAlign: "center", fontWeight: "900" }]}>{i + 1}</Text>
              <NationFlag nation={t.name} width={18} />
              <Text numberOfLines={1} style={[cell, { flex: 1 }]}>{t.name}</Text>
              <Text style={[cell, { color: "rgba(255,255,255,0.85)", fontWeight: "900", fontVariant: ["tabular-nums"] }]}>{t.points.toLocaleString("en-GB")}</Text>
            </View>
          );
        })}
      </Card>
    )}

    {tab === "winners" && (
      <Card title={`Who won · ${won.length} finals`} glow={glow}>
        {won.length === 0 ? <Line>No finals yet. The first are the Asian Cup (5 Feb 2027) and the CONCACAF and UEFA Nations Leagues.</Line> : (<>
          {(allWinners ? won : won.slice(0, 10)).map((f, i) => {
            const mine = f.winner === nation || f.runnerUp === nation;
            return (
              <View key={i} style={[{ borderRadius: 6, paddingHorizontal: 6, paddingVertical: 6 }, !mine && i % 2 === 0 ? { backgroundColor: "rgba(255,255,255,0.035)" } : null, mine && [youRow(glow), { borderWidth: 0 }]]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: AMBER, fontSize: 9.5, lineHeight: 14, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{f.comp}</Text>
                  <Text style={{ color: AMBER, fontSize: 9.5, lineHeight: 14, fontWeight: "900" }}>{f.year}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 11 }}>🏆</Text><NationFlag nation={f.winner} width={18} />
                  <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 11, lineHeight: 16, fontWeight: "900" }}>{f.winner}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, lineHeight: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{f.score}</Text>
                  <Text numberOfLines={1} style={{ maxWidth: 96, color: "rgba(255,255,255,0.75)", fontSize: 11, lineHeight: 16, fontWeight: "700" }}>{f.runnerUp}</Text>
                </View>
              </View>
            );
          })}
          {won.length > 10 ? (
            <Press onPress={() => setAllWinners(!allWinners)} style={{ marginTop: 4, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", paddingVertical: 5, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "900", textTransform: "uppercase" }}>{allWinners ? "Show fewer" : `Show all ${won.length}`}</Text>
            </Press>
          ) : null}
        </>)}
      </Card>
    )}
  </>);
}
