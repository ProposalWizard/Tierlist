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
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, View, Text, useWindowDimensions, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Canvas, Group, LinearGradient, Path, vec } from "@shopify/react-native-skia";
import { PopIn, Pulse } from "./lookBits";
import { FONT } from "../../ui/look";
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

/** A black outline round small words over the green / rose cards and the gold panel (DeadlineDayRoundup NAME_OUTLINE). */
const NAME_OUT = { textShadowColor: "#000", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 } as const;
/** The transfer centre's line along the foot: it runs, like the website's kit-marquee. */
function Marquee({ text }: { text: string }) {
  const a = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!w) return;
    a.setValue(0);
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: Math.max(8000, w * 28), easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a, w]);
  const one = <Text numberOfLines={1} onLayout={(e) => { const x = Math.round(e.nativeEvent.layout.width); if (x > 0 && x !== w) setW(x); }} style={{ paddingRight: 24, color: "rgba(252,211,77,0.8)", fontSize: 9, fontWeight: "900", letterSpacing: 1.6 }}>{text}</Text>;
  return (
    <View style={{ overflow: "hidden", marginBottom: 8 }}>
      <Animated.View style={{ flexDirection: "row", width: 4000, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, -w] }) }] }}>
        {one}
        <Text numberOfLines={1} style={{ paddingRight: 24, color: "rgba(252,211,77,0.8)", fontSize: 9, fontWeight: "900", letterSpacing: 1.6 }}>{text}</Text>
        <Text numberOfLines={1} style={{ paddingRight: 24, color: "rgba(252,211,77,0.8)", fontSize: 9, fontWeight: "900", letterSpacing: 1.6 }}>{text}</Text>
      </Animated.View>
    </View>
  );
}

/**
 * DEADLINE DAY (components/star/DeadlineDayRoundup.tsx): the night ground with a slab of gold
 * cut across the right at an angle, the TRANSFERS tab up the left edge, the season pill, the
 * outlined gold title, every club of the division as a chip, the chosen club's incomings
 * (green cards) and outgoings (rose cards), the running transfer-centre line and Continue.
 */
export function DeadlineDayScreen({ career, onContinue }: { career: CareerState; onContinue: () => void }) {
  const business = useMemo(() => buildBusiness(career), [career]);
  const [selected, setSelected] = useState(() => business[0]?.club ?? career.player.club);
  const active = business.find((b) => b.club === selected) ?? business[0];
  const totalDeals = (career.leagueTransferNews?.length ?? 0) + (career.leagueLoanNews?.length ?? 0);
  const totalSpend = Math.round((career.leagueTransferNews ?? []).reduce((sum, m) => sum + m.fee, 0));
  const windowLabel = WINDOW_LABEL[(career.lastTransferWindowKey ?? "").split("-")[1]] ?? "Transfer Window";
  const win = useWindowDimensions();
  const panelW = win.width * 0.52;
  const card = (d: Deal, dir: "in" | "out", i: number) => (
    <View key={`${dir}${i}`} style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
      backgroundImage: dir === "in" ? "linear-gradient(180deg, rgba(6,78,59,0.85), rgba(4,47,36,0.9))" : "linear-gradient(180deg, rgba(136,19,55,0.85), rgba(76,5,25,0.9))",
      boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.12), inset 0px 0px 0px 1px ${dir === "in" ? "rgba(52,211,153,0.45)" : "rgba(251,113,133,0.45)"}` } as ViewStyle}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <Text numberOfLines={1} style={[{ flex: 1, color: "#fff", fontSize: 14, fontWeight: "900" }, NAME_OUT]}>{d.player}{d.unhappy ? " 😠" : ""}</Text>
        <Text numberOfLines={1} style={{ borderRadius: 999, overflow: "hidden", paddingHorizontal: 6, fontSize: 10, fontWeight: "900", backgroundColor: dir === "in" ? "#6ee7b7" : "#fda4af", color: dir === "in" ? "#022c22" : "#4c0519" }}>{d.detail}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{dir === "in" ? "from" : "to"} <Text style={NAME_OUT}>{d.counterpart}</Text> · {d.overall} OVR</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: "#05070d" }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: "radial-gradient(90% 50% at 30% -5%, rgba(245,197,24,0.22), transparent 70%), linear-gradient(180deg, #070b16, #0a1020 60%, #05070d)" } as ViewStyle} />
      {/* the slab of gold: the right 52%, its left edge cut from 22% in at the top to the corner at the foot */}
      <Canvas pointerEvents="none" style={{ position: "absolute", right: 0, top: 0, width: panelW, height: win.height }}>
        <Path path={`M ${panelW * 0.22} 0 L ${panelW} 0 L ${panelW} ${win.height} L 0 ${win.height} Z`}>
          <LinearGradient start={vec(0, 0)} end={vec(panelW, win.height * 0.47)} colors={["#d99a00", "#f5c518", "#ffe066", "#f0b400"]} positions={[0, 0.38, 0.62, 1]} />
        </Path>
        <Path path={`M ${panelW * 0.22} 0 L ${panelW} 0 L ${panelW} ${win.height} L 0 ${win.height} Z`} opacity={0.4}>
          <LinearGradient start={vec(panelW * 0.5, 0)} end={vec(panelW, win.height * 0.3)} colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.35)"]} />
        </Path>
      </Canvas>
      {/* the tab up the left edge */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 28, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center" }}>
        <View style={{ marginTop: 52, width: 90, height: 12, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-90deg" }] }}>
          <Text numberOfLines={1} style={{ color: "#fcd34d", fontSize: 9, fontWeight: "900", letterSpacing: 2.7 }}>TRANSFERS</Text>
        </View>
      </View>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={{ paddingLeft: 36, paddingRight: 12, paddingTop: 36, paddingBottom: 8, alignItems: "flex-start" }}>
          <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "rgba(251,191,36,0.5)", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text numberOfLines={1} style={{ color: "#fcd34d", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 }}>{`SEASON ${career.season} · ${windowLabel} CLOSED`.toUpperCase()}</Text>
          </View>
          <PopIn delay={150}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 8, color: "#ffd23f", fontSize: 34.4, lineHeight: 34, fontWeight: "900", fontStyle: "italic", letterSpacing: -0.9, textShadowColor: "#000", textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 3 }}>DEADLINE DAY</Text>
          </PopIn>
          <Text style={[{ marginTop: 6, color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" }, NAME_OUT]}>
            <Text style={{ color: "#fcd34d", fontWeight: "900" }}>{totalDeals}</Text> deal{totalDeals === 1 ? "" : "s"} done across the division{totalSpend > 0 ? ` · ★${formatMoneyPrecise(totalSpend)} changed hands` : ""}.
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 36, paddingRight: 12, paddingBottom: 8, marginTop: 4 }}>
          {business.map((b) => {
            const on = b.club === selected;
            const count = b.in.length + b.out.length;
            return (
              <Press key={b.club} onPress={() => setSelected(b.club)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
                borderColor: on ? "rgba(252,211,77,0.6)" : count ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)", backgroundColor: on ? "#000" : count ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                ...(on ? { boxShadow: "0px 0px 12px rgba(251,191,36,0.45)" } : null) } as ViewStyle}>
                <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", backgroundColor: kitsOf(b.club).home.shirt }} />
                <Text numberOfLines={1} style={[{ maxWidth: 88, color: on ? "#fcd34d" : count ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "900", letterSpacing: 0.25 }, on ? null : NAME_OUT]}>{shortClub(b.club).toUpperCase()}</Text>
                <Text style={[{ borderRadius: 999, overflow: "hidden", paddingHorizontal: 6, fontSize: 9, fontWeight: "900", backgroundColor: on ? "#fbbf24" : count ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)", color: on ? "#000" : count ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)" }, on ? null : NAME_OUT]}>{count}</Text>
              </Press>
            );
          })}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 24, gap: 16 }} showsVerticalScrollIndicator={false}>
          {active && (
            <>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#34d399" }} />
                  <Text style={{ color: "#34d399", fontSize: 11, fontWeight: "900", letterSpacing: 1.6 }}>{`IN — ${active.in.length}`}</Text>
                </View>
                <View style={{ gap: 6 }}>
                  {active.in.length === 0 ? <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "700" }}>No incomings.</Text> : active.in.map((d, i) => card(d, "in", i))}
                </View>
              </View>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#fb7185" }} />
                  <Text style={{ color: "#fb7185", fontSize: 11, fontWeight: "900", letterSpacing: 1.6 }}>{`OUT — ${active.out.length}`}</Text>
                </View>
                <View style={{ gap: 6 }}>
                  {active.out.length === 0 ? <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "700" }}>No outgoings.</Text> : active.out.map((d, i) => card(d, "out", i))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
        <View style={{ borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.7)", paddingLeft: 36, paddingRight: 12, paddingVertical: 12 }}>
          <Marquee text={`TRANSFER CENTRE · ${totalDeals} DEALS THIS WINDOW · ${windowLabel.toUpperCase()} · TRANSFER CENTRE · ${totalDeals} DEALS THIS WINDOW ·`} />
          <View style={{ alignSelf: "flex-start" }}><Btn kind="gold" label="Continue →" onPress={onContinue} /></View>
        </View>
      </SafeAreaView>
    </View>
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
// components/star/PlayOffRoundup.tsx: the drawn bracket on a green ground. Crests in their places,
// white lines to where each winner goes; the round just played shows itself step by step (the
// scores pop, the winner's line turns gold and his crest moves on), the trophy and who went up at
// the top. A tap skips to the end.
const PO_W = 360, PO_H = 380, PO_C = 34, PO_R = PO_C / 2;
type PoSlot = "top" | "bottom";
const PO_SPOTS: Record<"four" | "six", Record<string, [number, number]>> = {
  four: { "sA.top": [62, 180], "sA.bottom": [62, 320], "sB.top": [298, 180], "sB.bottom": [298, 320], "f.top": [150, 250], "f.bottom": [210, 250] },
  six: { "qA.top": [30, 128], "qA.bottom": [30, 222], "qB.top": [330, 128], "qB.bottom": [330, 222], "sA.bottom": [100, 175], "sA.top": [100, 325], "sB.bottom": [260, 175], "sB.top": [260, 325], "f.top": [150, 250], "f.bottom": [210, 250] },
};
const PO_PROMOTED: [number, number] = [180, 66];
const PO_TROPHY_Y = 160, PO_SCORE_MS = 900, PO_ADVANCE_MS = 1150;
type PoStep = { kind: "score" | "advance"; stage: number };
type PoBracket = ReturnType<typeof buildBracket>;
function poSteps(b: PoBracket): PoStep[] {
  const out: PoStep[] = [];
  for (let st = b.revealFrom; st <= b.revealTo; st++) if (b.ties.some((t) => t.stage === st && t.winner)) out.push({ kind: "score", stage: st }, { kind: "advance", stage: st });
  return out;
}
function poConnector(b: PoBracket, t: BracketTie): { stubs: Record<PoSlot, string>; out: string } | null {
  const S = PO_SPOTS[b.format];
  const top = S[`${t.id}.top`], bot = S[`${t.id}.bottom`];
  if (!top || !bot) return null;
  if (t.id === "f") {
    const y = top[1] - PO_R - 18;
    return { stubs: { top: `M${top[0]},${top[1] - PO_R} V${y} H${PO_PROMOTED[0]}`, bottom: `M${bot[0]},${bot[1] - PO_R} V${y} H${PO_PROMOTED[0]}` }, out: `M${PO_PROMOTED[0]},${y} V${PO_PROMOTED[1] + PO_R + 6}` };
  }
  if (!t.feeds || t.feeds === "promoted") return null;
  const tgt = S[`${t.feeds.tie}.${t.feeds.slot}`];
  if (!tgt) return null;
  const dir = tgt[0] > top[0] ? 1 : -1;
  const ex = (top[0] + dir * PO_R + tgt[0] - dir * PO_R) / 2;
  const my = (top[1] + bot[1]) / 2;
  return { stubs: { top: `M${top[0] + dir * PO_R},${top[1]} H${ex} V${my}`, bottom: `M${bot[0] + dir * PO_R},${bot[1]} H${ex} V${my}` }, out: `M${ex},${my} V${tgt[1]} H${tgt[0] - dir * PO_R}` };
}
/** A crest that glides to where it now belongs (the website's left/top transition, 650 ms after 380). */
function PoMover({ x, y, k, opacity, children }: { x: number; y: number; k: number; opacity: number; children: React.ReactNode }) {
  const ax = useRef(new Animated.Value(x)).current, ay = useRef(new Animated.Value(y)).current, ao = useRef(new Animated.Value(opacity)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(ax, { toValue: x, duration: 650, delay: 380, easing: Easing.bezier(0.3, 0.7, 0.2, 1), useNativeDriver: true }),
      Animated.timing(ay, { toValue: y, duration: 650, delay: 380, easing: Easing.bezier(0.3, 0.7, 0.2, 1), useNativeDriver: true }),
      Animated.timing(ao, { toValue: opacity, duration: 300, delay: 380, useNativeDriver: true }),
    ]).start();
  }, [ax, ay, ao, x, y, opacity]);
  return <Animated.View style={{ position: "absolute", left: -PO_R * k, top: -PO_R * k, width: PO_C * k, height: PO_C * k, opacity: ao, transform: [{ translateX: Animated.multiply(ax, k) }, { translateY: Animated.multiply(ay, k) }] }}>{children}</Animated.View>;
}
export function PlayOffRoundupScreen({ career, onContinue }: { career: CareerState; onContinue: () => void }) {
  const po = career.playOffState;
  const win = useWindowDimensions();
  const table = useMemo(() => sortLeague(career.league).map((t) => t.name), [career.league]);
  const upcoming = nextFixtureFor(career);
  const nextPo = upcoming?.kind === "playoff" ? upcoming : undefined;
  const you = career.player.club;
  const bracket = useMemo(() => (po ? buildBracket(po, you, (c) => table.indexOf(c) + 1, nextPo?.round) : null), [po, you, table, nextPo?.round]);
  const steps = useMemo(() => (bracket ? poSteps(bracket) : []), [bracket]);
  const [done, setDone] = useState(0);
  const finished = done >= steps.length;
  useEffect(() => {
    if (finished) return;
    const wait = done === 0 ? 650 : steps[done - 1].kind === "score" ? PO_SCORE_MS : PO_ADVANCE_MS;
    const t = setTimeout(() => setDone((d) => d + 1), wait);
    return () => clearTimeout(t);
  }, [done, finished, steps]);
  if (!po || !bracket) return <Frame title="Play-offs"><Btn label="Continue" onPress={onContinue} /></Frame>;
  const nextLine = nextPo
    ? `${nextPo.round} · ${nextPo.round === "Play-Off Final" && po.format !== "six" ? "at Wembley v" : nextPo.home ? "home to" : "away at"} ${shortClub(nextPo.opponent)}`
    : po.promoted === you ? "Promoted!" : po.promoted ? `${shortClub(po.promoted)} go up` : "Out of the play-offs";
  const reached = (kind: PoStep["kind"], stage: number) => {
    if (stage < bracket.revealFrom) return true;
    const i = steps.findIndex((st) => st.kind === kind && st.stage === stage);
    return i < 0 ? stage < bracket.revealFrom : i < done;
  };
  const S = PO_SPOTS[bracket.format];
  const tieById = (id: string) => bracket.ties.find((t) => t.id === id);
  const promotedShown = !!bracket.promoted && reached("advance", 2);
  const boxW = Math.min(384, win.width) - 24;
  const k = boxW / PO_W;
  return (
    <View style={{ flex: 1, backgroundColor: "#05080f" }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: "radial-gradient(90% 45% at 50% -8%, rgba(22,163,74,0.33) 0%, transparent 70%), linear-gradient(180deg, #0a1120 0%, #05080f 60%)" } as ViewStyle} />
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 16 }}>
        <Press onPress={() => { if (!finished) setDone(steps.length); }} style={{ width: boxW, overflow: "hidden", backgroundImage: "radial-gradient(120% 80% at 50% 30%, #1f7a43 0%, #0f4a28 55%, #082a17 100%)" } as ViewStyle}>
          <View style={{ paddingTop: 16, alignItems: "center" }}>
            <Text numberOfLines={1} style={{ color: "rgba(167,243,208,0.8)", fontSize: 10, letterSpacing: 3 }}>{leagueNameFor(divisionOf(career)).toUpperCase()}</Text>
            <Text style={{ marginTop: 2, color: "#fff", fontFamily: FONT.display, fontSize: 30, lineHeight: 32, textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 }}>PLAY-OFFS</Text>
          </View>
          <View style={{ width: boxW, height: PO_H * k }}>
            <Canvas pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: boxW, height: PO_H * k }}>
              <Group transform={[{ scale: k }]}>
                {bracket.ties.map((t) => {
                  const c = poConnector(bracket, t);
                  if (!c) return null;
                  const lit = !!t.winner && reached("advance", t.stage);
                  const winSlot: PoSlot | null = t.winner ? (t.top?.club === t.winner ? "top" : "bottom") : null;
                  return (
                    <Group key={t.id}>
                      <Path path={c.stubs.top} color="rgba(255,255,255,0.28)" style="stroke" strokeWidth={2} />
                      <Path path={c.stubs.bottom} color="rgba(255,255,255,0.28)" style="stroke" strokeWidth={2} />
                      <Path path={c.out} color="rgba(255,255,255,0.28)" style="stroke" strokeWidth={2} />
                      {winSlot && lit && <Path path={c.stubs[winSlot]} color="#facc15" style="stroke" strokeWidth={3} strokeCap="round" />}
                      {winSlot && lit && <Path path={c.out} color="#facc15" style="stroke" strokeWidth={3} strokeCap="round" />}
                    </Group>
                  );
                })}
              </Group>
            </Canvas>
            {/* the trophy and who went up */}
            <Text style={{ position: "absolute", left: 180 * k - 30, width: 60, top: PO_TROPHY_Y * k - 26, textAlign: "center", fontSize: 44, lineHeight: 52 }}>🏆</Text>
            <View style={{ position: "absolute", left: PO_PROMOTED[0] * k - 40, width: 80, top: PO_PROMOTED[1] * k - (PO_C + 10) * k / 2, alignItems: "center" }}>
              <View style={{ width: (PO_C + 10) * k, height: (PO_C + 10) * k, borderRadius: 999, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center", transform: [{ scale: promotedShown ? 1.12 : 1 }] }}>
                {promotedShown && <PopIn><ClubCrest club={bracket.promoted!} size={Math.round((PO_C + 2) * k)} /></PopIn>}
              </View>
              <Text style={{ marginTop: 4, color: "rgba(254,240,138,0.9)", fontSize: 9, fontWeight: "700", letterSpacing: 1.6 }}>{promotedShown ? "PROMOTED" : "UP"}</Text>
            </View>
            {/* every slot */}
            {bracket.ties.flatMap((t) => (["top", "bottom"] as PoSlot[]).map((slot) => {
              const team = t[slot];
              const at = S[`${t.id}.${slot}`];
              if (!at) return null;
              const scoreShown = t.topScore !== undefined && reached("score", t.stage);
              const score = slot === "top" ? t.topScore : t.bottomScore;
              const lost = scoreShown && !!t.winner && !!team && team.club !== t.winner;
              const src = team?.from ? tieById(team.from) : undefined;
              const arrived = !team?.from || reached("advance", src?.stage ?? -1);
              const srcSlot = src && src.top?.club === team?.club ? "top" : "bottom";
              const from = (src ? S[`${src.id}.${srcSlot}`] : undefined) ?? at;
              const pos = arrived ? at : from;
              const mine = team?.club === you;
              const inward = at[0] < 180 ? 1 : at[0] > 180 ? -1 : 0;
              return (
                <PoMover key={`${t.id}.${slot}`} x={pos[0]} y={pos[1]} k={k} opacity={team ? (arrived ? (lost ? 0.38 : 1) : 0) : 1}>
                  {team ? (
                    <>
                      <View style={{ width: PO_C * k, height: PO_C * k, borderRadius: 999, boxShadow: mine ? "0px 0px 0px 2px #facc15, 0px 0px 12px rgba(250,204,21,0.7)" : "0px 2px 6px rgba(0,0,0,0.45)" } as ViewStyle}>
                        <ClubCrest club={team.club} size={Math.round(PO_C * k)} />
                        {t.next && finished && mine && <Pulse min={0.2} ms={700} scale={1.25} style={{ position: "absolute", left: -6, right: -6, top: -6, bottom: -6, borderRadius: 999, borderWidth: 2, borderColor: "rgba(253,224,71,0.8)" }} />}
                      </View>
                      <Text numberOfLines={1} style={{ position: "absolute", left: PO_C * k / 2 - 37, width: 74, top: PO_C * k + 2, textAlign: "center", color: "rgba(255,255,255,0.9)", fontSize: 9, fontWeight: "600", lineHeight: 11 }}>{shortClub(team.club)}</Text>
                      {score !== undefined && scoreShown && (
                        <PopIn style={{ position: "absolute", top: (PO_R - 4) * k, left: inward >= 0 ? (PO_C - 6) * k : -13, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{score}</Text>
                        </PopIn>
                      )}
                    </>
                  ) : (
                    <View style={{ flex: 1, borderRadius: 999, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(0,0,0,0.15)" }} />
                  )}
                </PoMover>
              );
            }))}
            {/* small notes: agg., pens, first-leg score */}
            {bracket.ties.map((t) => {
              if (!t.note) return null;
              const a2 = S[`${t.id}.top`], b2 = S[`${t.id}.bottom`];
              if (!a2 || !b2) return null;
              const show = t.note.startsWith("1st") || t.note === "end of season" || reached("score", t.stage);
              if (!show) return null;
              const x = t.id === "f" ? 180 : (a2[0] + b2[0]) / 2, y = t.id === "f" ? a2[1] + 34 : (a2[1] + b2[1]) / 2;
              return <Text key={`n${t.id}`} numberOfLines={1} style={{ position: "absolute", left: x * k - 50, width: 100, top: y * k - 6, textAlign: "center", color: "rgba(209,250,229,0.9)", fontSize: 9, fontWeight: "600" }}>{t.note}</Text>;
            })}
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, alignItems: "center" }}>
            <Text style={{ minHeight: 18, color: "#fff", fontSize: 13, fontWeight: "600", opacity: finished ? 1 : 0 }}>{nextLine}</Text>
            <View style={{ marginTop: 12, minHeight: 44, justifyContent: "center" }}>
              {finished ? <Btn label="Continue" onPress={onContinue} /> : <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>Tap to skip</Text>}
            </View>
          </View>
        </Press>
      </SafeAreaView>
    </View>
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

