/**
 * THE END OF A CAREER, as the website draws it (components/star/CareerEnd.tsx,
 * Farewell.tsx, CareerOverview.tsx, in the "calm" ScreenShell: a dark page with
 * the club's colour glowing down from the top, a flat bar of buttons at the bottom).
 *
 *   FinalSeasonScreen     "FINAL / SEASON" (the season before the last)
 *   RetirementScreen      "THE FINAL / WHISTLE": the gold pill, rays, the season track,
 *                         "A CAREER IN THE GAME" with three numbers, HANG THEM UP
 *   FarewellInviteScreen  "ONE LAST GAME · YOUR FAREWELL / MATCH": both elevens as 22 face
 *                         circles with names, why the rivals are here, three rule tiles, SKIP / PLAY IT
 *   FarewellSheetsScreen  the match's own line-up screen: both XIs on the drawn pitch, KICK OFF
 *   FarewellResultScreen  full time: the score, the scorers, three numbers, the ovation, the testimonial
 *   LegacyScreen          the career overview: the tab strip (Career · Seasons · Who won · Clubs ·
 *                         Trophies · Records · Life), the LEGACY ring, the gold verdict, SHARE,
 *                         six numbers, the journey, goals and assists by season, the cabinet;
 *                         HALL OF FAME · NEW CAREER · MENU at the bottom
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { PanResponder, ScrollView, Share, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Canvas, Path, Skia, LinearGradient, vec } from "@shopify/react-native-skia";
import type { CareerState } from "@/lib/star/types";
import { FAREWELL_OFF_AT, RIVALS_KITS, type FarewellSides } from "@/lib/star/farewell";
import { testimonialFor, careerVerdict, CAREER_SEASONS } from "@/lib/star/retirement";
import { careerOverview, type CareerOverviewData } from "@/lib/star/careerOverview";
import { shortNameOf } from "@/lib/star/realSquad";
import { shortClub } from "@/lib/star/media/grammar";
import { formatMoney } from "@/lib/star/money";
import { leoUpdateOn } from "@/lib/star/leoUpdate";
import { kitsOf, type Kit } from "@/lib/star/kits";
import { matchdayFor } from "@/lib/star/teamsheet";
import { formationOf } from "@/lib/star/formations";
import { skinToneHex } from "@/lib/star/playerIdentity";
import * as flow from "../../game/flow";
import { Press } from "../../ui/Press";
import { FONT, rgba } from "../../ui/look";
import { Rays } from "../../ui/look/Patterns";
import { PlayerHead } from "../../draw/PlayerHead";
import { ClubCrest } from "./kit";
import { clubGlow } from "./lookBits";
import { TrophyImage } from "./Ceremonies";
import { Lineup } from "./PreMatch";

const GOLD = "#fbbf24";
const hex6 = (c: string, d = "#34d399") => (/^#[0-9a-f]{6}$/i.test(c) ? c : d);

// ── The shell, the bar, small parts ─────────────────────────────────────────

/** ScreenShell `bare`, tone "calm": the dark page, the club's glow from the top, a scrolling body, the flat bar. */
function EndShell({ glow, children, bar, scroll = true, header }: { glow: string; children: ReactNode; bar?: ReactNode; scroll?: boolean; header?: ReactNode }) {
  const g = hex6(glow);
  return (
    <View style={{ flex: 1, backgroundColor: "#0b0f17" }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 420, backgroundImage: `radial-gradient(90% 60% at 50% 0%, ${rgba(g, 0.5)} 0%, rgba(0,0,0,0) 72%)` } as ViewStyle} />
      {/* the faint grain of lines the website's page has */}
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {header}
        {scroll
          ? <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24, width: "100%", maxWidth: 448, alignSelf: "center", flexGrow: 1 }}>{children}</ScrollView>
          : <View style={{ flex: 1, paddingHorizontal: 12 }}>{children}</View>}
      </SafeAreaView>
      {bar}
    </View>
  );
}

/** The flat bar of buttons at the bottom (ui BottomBar + BarButton): the primary is yellow, the rest dark. */
function EndBar({ children }: { children: ReactNode }) {
  const inset = useSafeAreaInsets();
  return <View style={{ flexDirection: "row", backgroundColor: "#0b0f17", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", paddingBottom: inset.bottom }}>{children}</View>;
}
function BarButton({ icon, label, onPress, primary, flex = 1 }: { icon?: string; label: string; onPress: () => void; primary?: boolean; flex?: number }) {
  return (
    <Press onPress={onPress} style={[{ flex, height: 54, alignItems: "center", justifyContent: "center", gap: 1 },
      (primary ? { backgroundImage: "linear-gradient(180deg, #fcd34d, #fbbf24)" } : { backgroundColor: "#0e131c", borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.08)" }) as ViewStyle]}>
      {icon ? <Text style={{ color: primary ? "#111827" : "#fff", fontSize: 18, lineHeight: 21 }}>{icon}</Text> : null}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: primary ? "#111827" : "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.6 }}>{label.toUpperCase()}</Text>
    </Press>
  );
}

function GoldPill({ children }: { children: string }) {
  return (
    <View style={{ alignSelf: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2, backgroundColor: "rgba(251,191,36,0.14)", borderWidth: 1, borderColor: "rgba(251,191,36,0.4)" }}>
      <Text style={{ color: "#fde68a", fontSize: 10, fontWeight: "900", letterSpacing: 2.4 }}>{children.toUpperCase()}</Text>
    </View>
  );
}

/** Two lines in the heavy font over the rays: the first white, the second gold. */
function BigTitle({ a, b, size = 46, rays = 260 }: { a: string; b: string; size?: number; rays?: number }) {
  return (
    <View style={{ marginTop: 16, height: size * 2.6, alignItems: "center", justifyContent: "center" }}>
      <View pointerEvents="none" style={{ position: "absolute" }}><Rays size={rays} color="rgba(253,230,138,0.22)" /></View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: "#fff", fontFamily: FONT.display, fontSize: size, lineHeight: size * 1.02, textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 10 }}>{a}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: "#fcd34d", fontFamily: FONT.display, fontSize: size, lineHeight: size * 1.02, textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 10 }}>{b}</Text>
    </View>
  );
}

/** FlatPanel `bleed edge`: a full-width dark band with a hairline above and below. */
function Band({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ marginHorizontal: -12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: "rgba(10,13,20,0.82)", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.14)" }, style]}>{children}</View>;
}

function NumberTile({ value, label, gold }: { value: number | string; label: string; gold?: boolean }) {
  return (
    <View style={[{ flex: 1, paddingHorizontal: 4, paddingVertical: 8, alignItems: "center" },
      (gold ? { backgroundImage: "linear-gradient(180deg, rgba(251,191,36,0.22), rgba(251,191,36,0.05))", boxShadow: "inset 0px 0px 0px 1px rgba(251,191,36,0.45)" } : { backgroundColor: "rgba(255,255,255,0.05)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.08)" }) as ViewStyle]}>
      <Text style={{ color: gold ? "#fde68a" : "#fff", fontFamily: FONT.display, fontSize: 26, lineHeight: 30 }}>{value}</Text>
      <Text style={{ marginTop: 2, color: "rgba(255,255,255,0.7)", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.8 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** One square per season, in the colour of the club you played it for; the last one gold and taller (CareerEnd SeasonTrack). */
function SeasonTrack({ career, endLabel }: { career: CareerState; endLabel?: string }) {
  const played = career.season;
  const cap = CAREER_SEASONS ?? Math.max(played + 1, 1);
  const o = useMemo(() => careerOverview(career, { calendarYears: leoUpdateOn("bugFixes") }), [career]);
  const firstAge = o.seasons[0]?.age ?? career.player.age - (career.season - 1);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
        {Array.from({ length: cap }, (_, k) => {
          const season = k + 1, last = season === cap, done = season <= played;
          const club = o.seasons[k]?.club;
          return <View key={season} style={[{ flex: 1, height: last ? 30 : 22, opacity: done || last ? 1 : 0.6 },
            (last ? { backgroundImage: `linear-gradient(180deg, ${GOLD}, #b45309)`, boxShadow: `0px 0px 14px ${rgba(GOLD, 0.7)}, inset 0px 0px 0px 1px rgba(255,255,255,0.5)` }
              : { backgroundColor: done ? (club ? hex6(clubGlow(club)) : "rgba(255,255,255,0.35)") : "rgba(255,255,255,0.08)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.12)" }) as ViewStyle]} />;
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10.5, fontWeight: "900" }}>Age {firstAge}</Text>
        <Text style={{ color: "#fde68a", fontSize: 10.5, fontWeight: "900" }}>{endLabel ?? `Last season · age ${firstAge + cap - 1}`}</Text>
      </View>
    </View>
  );
}

function GoldLine({ left, text, right }: { left: ReactNode; text: string; right?: string }) {
  return (
    <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundImage: `linear-gradient(90deg, ${rgba(GOLD, 0.22)}, rgba(255,255,255,0.03))`, boxShadow: "inset 0px 0px 0px 1px rgba(251,191,36,0.4)" } as ViewStyle}>
      {left}
      <Text style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 12.5, fontWeight: "700" }}>{text}</Text>
      {right ? <Text style={{ color: "#fde68a", fontFamily: FONT.display, fontSize: 18 }}>{right}</Text> : null}
    </View>
  );
}

// ── The final season, the final whistle ─────────────────────────────────────

export function FinalSeasonScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const cap = CAREER_SEASONS ?? career.season + 1;
  return (
    <EndShell glow={clubGlow(career.player.club, career)} bar={<EndBar><BarButton icon="›" label="Continue" primary onPress={() => go(flow.playOn())} /></EndBar>}>
      <View style={{ flex: 1, justifyContent: "center", paddingVertical: 24 }}>
        <GoldPill>{`Season ${career.season} is over`}</GoldPill>
        <BigTitle a="Final" b="season" />
        <Text style={{ marginTop: 16, color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" }}>Season {cap} is your last before retirement.</Text>
        <Text style={{ marginTop: 4, color: "#fde68a", fontSize: 15, fontWeight: "700", textAlign: "center" }}>End your career the right way.</Text>
        <Band style={{ marginTop: 20 }}><SeasonTrack career={career} /></Band>
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <ClubCrest club={career.player.club} size={22} />
          <Text style={{ flexShrink: 1, color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: "700" }}>Stay at {shortClub(career.player.club)}, or choose a club for the last one.</Text>
        </View>
      </View>
    </EndShell>
  );
}

export function RetirementScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const v = careerVerdict(career);
  const t = testimonialFor(career);
  const s = career.careerStats;
  return (
    <EndShell glow={clubGlow(career.player.club, career)} bar={<EndBar><BarButton icon="🥾" label="Hang them up" primary onPress={() => go(flow.retireNow())} /></EndBar>}>
      <View style={{ flex: 1, justifyContent: "center", paddingVertical: 24 }}>
        <GoldPill>{`${CAREER_SEASONS ?? career.season} seasons`}</GoldPill>
        <BigTitle a="The final" b="whistle" />
        <Text style={{ marginTop: 16, alignSelf: "center", maxWidth: 310, color: "#fff", fontSize: 15, lineHeight: 20, fontWeight: "700", textAlign: "center" }}>That was your last season. Time to hang them up.</Text>
        <Band style={{ marginTop: 20 }}><SeasonTrack career={career} endLabel={`Age ${career.player.age} · the end`} /></Band>
        <Band style={{ marginTop: 8 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: "#fde68a", fontFamily: FONT.display, fontSize: 24, lineHeight: 28, textAlign: "center", textTransform: "uppercase" }}>{v.title}</Text>
          <View style={{ marginTop: 12, flexDirection: "row", gap: 6 }}>
            <NumberTile value={s.appearances} label="Apps" /><NumberTile value={s.goals} label="Goals" /><NumberTile value={career.trophies.length} label="Trophies" />
          </View>
        </Band>
        {t && <GoldLine left={<ClubCrest club={t.club} size={26} />} text={`${shortClub(t.club)} put on a testimonial for you`} right={`★${formatMoney(t.payout)}`} />}
      </View>
    </EndShell>
  );
}

// ── The farewell match ───────────────────────────────────────────────────────

interface Chip { id: string; name: string; you?: boolean; badge?: string }
function FaceChip({ chip, kit, size, skin }: { chip: Chip; kit: Kit; size: number; skin?: string }) {
  return (
    <View style={{ alignItems: "center", minWidth: 0 }}>
      <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: kit.shirt, alignItems: "center", justifyContent: "flex-end" },
        (chip.you ? { boxShadow: `0px 0px 0px 2px ${GOLD}, 0px 0px 12px ${rgba(GOLD, 0.7)}` } : { borderWidth: 2, borderColor: kit.trim }) as ViewStyle]}>
        <PlayerHead id={chip.id} shirt={kit.shirt} shorts={kit.trim} trim={kit.trim} size={size - 4} skin={chip.you ? skin : undefined} />
        {chip.badge ? <Text style={{ position: "absolute", right: 0, bottom: 0, fontSize: 13, lineHeight: 15 }}>{chip.badge}</Text> : null}
      </View>
      <Text numberOfLines={1} style={{ marginTop: 2, alignSelf: "stretch", textAlign: "center", color: chip.you ? "#fde68a" : "rgba(255,255,255,0.9)", fontSize: 9.5, fontWeight: "900" }}>{chip.name.toUpperCase()}</Text>
    </View>
  );
}
function SideRow({ title, kit, chips, club, skin }: { title: string; kit: Kit; chips: Chip[]; club?: string; skin?: string }) {
  return (
    <Band style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {club ? <ClubCrest club={club} size={22} />
          : <View style={{ width: 22, height: 22, borderRadius: 2, alignItems: "center", justifyContent: "center", backgroundColor: kit.shirt, borderWidth: 2, borderColor: kit.trim }}><Text style={{ color: kit.trim, fontSize: 9, fontWeight: "900" }}>XI</Text></View>}
        <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.4 }}>{title.toUpperCase()}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 6 }}>
        {chips.map((c) => <View key={c.id} style={{ width: "16.66%", paddingHorizontal: 2 }}><FaceChip chip={c} kit={kit} size={42} skin={skin} /></View>)}
      </View>
    </Band>
  );
}
function whyLines(sides: FarewellSides): string[] {
  const xi = new Set(sides.rivals.lineup.xi.filter((id): id is string => !!id));
  const starters = sides.rivals.who.filter((r) => xi.has(r.id));
  const golden = starters.filter((r) => r.ballonDor).slice(0, 2).map((r) => `🏅 ${shortNameOf(r.name)} · ${r.why}`);
  const clubs: string[] = [];
  const seen = new Set<string>();
  for (const r of starters) {
    if (r.ballonDor || seen.has(r.club) || r.why === "One of the best around" || r.why === "A rival") continue;
    seen.add(r.club);
    clubs.push(`🏆 ${shortClub(r.club)} · ${r.why}`);
  }
  return [...golden, ...clubs.slice(0, 2)];
}

function Retired({ go }: { go: (s: flow.Step) => void }) {
  return <EndShell glow="#fbbf24" bar={<EndBar><BarButton label="Continue" primary onPress={() => go(flow.retireWith())} /></EndBar>}><View /></EndShell>;
}

export function FarewellInviteScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const f = flow.currentFarewell();
  if (!f) return <Retired go={go} />;
  const sides = f.sides;
  const host = sides.host;
  const ours = kitsOf(host, career.clubKits?.[host]).home;
  const oursChips: Chip[] = sides.ours.lineup.xi.filter((id): id is string => !!id).map((id) => {
    if (id === "you") return { id, name: "You", you: true };
    const p = sides.ours.players.find((x) => x.id === id);
    return { id, name: p ? (p.shortName || shortNameOf(p.name)) : "—" };
  });
  const rivalChips: Chip[] = sides.rivals.lineup.xi.filter((id): id is string => !!id).map((id) => {
    const r = sides.rivals.who.find((x) => x.id === id);
    return { id, name: r ? shortNameOf(r.name) : "—", badge: r?.ballonDor ? "🏅" : undefined };
  });
  const why = whyLines(sides);
  return (
    <EndShell glow={clubGlow(host, career)}
      bar={<EndBar><BarButton icon="⏭" label="Skip" onPress={() => go(flow.skipFarewell())} /><BarButton icon="▶" label="Play it" primary flex={1.6} onPress={() => go({ screen: "career-farewell-sheets" })} /></EndBar>}>
      <View style={{ paddingTop: 16, paddingBottom: 8 }}>
        <GoldPill>One last game</GoldPill>
        <BigTitle a="Your farewell" b="match" size={40} rays={240} />
        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <ClubCrest club={host} size={24} />
          <Text style={{ flexShrink: 1, color: "#fff", fontSize: 15, fontWeight: "700" }}>{shortClub(host)} want to say goodbye.</Text>
        </View>
        <SideRow title={sides.ours.name} kit={ours} chips={oursChips} club={host} skin={skinToneHex(career.player.skinTone)} />
        <SideRow title={sides.rivals.name} kit={RIVALS_KITS.home} chips={rivalChips} />
        {why.length > 0 && <View style={{ marginTop: 6, gap: 4 }}>{why.map((w) => <Text key={w} numberOfLines={1} style={{ paddingHorizontal: 4, color: "rgba(255,255,255,0.9)", fontSize: 11.5, fontWeight: "700" }}>{w}</Text>)}</View>}
        <View style={{ marginTop: 12, flexDirection: "row", gap: 6 }}>
          {([["⚽", "Every chance is yours"], ["⚡", "No energy"], ["👏", `Off at ${FAREWELL_OFF_AT}'`]] as const).map(([icon, text]) => (
            <View key={text} style={{ flex: 1, paddingHorizontal: 4, paddingVertical: 8, alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.1)" } as ViewStyle}>
              <Text style={{ fontSize: 18, lineHeight: 21 }}>{icon}</Text>
              <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.9)", fontSize: 10, lineHeight: 12, fontWeight: "900", letterSpacing: 0.4, textAlign: "center" }}>{text.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>
    </EndShell>
  );
}

/** The team sheets: the match's own line-up screen (page.tsx: VersusScreen with the farewell sides), no countdown. */
export function FarewellSheetsScreen({ career, go, onBack }: { career: CareerState; go: (s: flow.Step) => void; onBack: () => void }) {
  const f = flow.currentFarewell();
  const md = useMemo(() => {
    if (!f) return null;
    try {
      return matchdayFor(f.career, f.fixture, true, undefined, f.sides.ours.lineup.bench, { formation: formationOf(f.sides.ours.lineup.formation), xi: f.sides.ours.lineup.xi });
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.fixture]);
  if (!f) return <Retired go={go} />;
  const kickOff = () => go({ screen: "career-farewell-walkout" });
  if (!md) {
    return <EndShell glow={clubGlow(f.sides.host, career)} bar={<EndBar><BarButton label="Back" onPress={onBack} /><BarButton label="Kick off" primary flex={1.6} onPress={kickOff} /></EndBar>}><View /></EndShell>;
  }
  return <Lineup career={f.career} matchday={md} clubKits={f.career.clubKits} competition="Farewell match" date="One last game" results={[]}
    canSim={false} canPlayAs={false} benchNote={null} noTimer onBack={onBack} onKickOff={kickOff} onSim={() => {}} />;
}

export function FarewellResultScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const f = flow.currentFarewell();
  const stats = f?.stats;
  const done = () => go(flow.finishFarewell());
  if (!f || !stats) return <EndShell glow="#fbbf24" bar={<EndBar><BarButton icon="🥾" label="Hang them up" primary onPress={done} /></EndBar>}><View /></EndShell>;
  const t = testimonialFor(career);
  const us = stats.homeScore, them = stats.awayScore;
  const verdict = us > them ? "A win to finish" : us === them ? "All square" : "The rivals spoil it";
  const ours = [...(stats.goalEvents ?? [])].sort((a, b) => a.minute - b.minute).map((g) => ({ you: g.isUserGoal, text: `${g.minute}' ${g.isUserGoal ? "You" : shortNameOf(g.scorer)}` }));
  const theirs = [...(stats.oppGoalEvents ?? [])].sort((a, b) => a.minute - b.minute).map((g) => `${g.minute}' ${shortNameOf(g.scorer)}`);
  const rk = RIVALS_KITS.home;
  return (
    <EndShell glow={clubGlow(f.sides.host, career)} bar={<EndBar><BarButton icon="🥾" label="Hang them up" primary onPress={done} /></EndBar>}>
      <View style={{ flex: 1, justifyContent: "center", paddingVertical: 24 }}>
        <GoldPill>Full time · Farewell</GoldPill>
        <Band style={{ marginTop: 16, paddingVertical: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, alignItems: "center", gap: 4, minWidth: 0 }}>
              <ClubCrest club={f.sides.host} size={40} />
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>{f.sides.ours.name.toUpperCase()}</Text>
            </View>
            <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 44, lineHeight: 50 }}>{us}<Text style={{ color: "rgba(255,255,255,0.5)" }}> – </Text>{them}</Text>
            <View style={{ flex: 1, alignItems: "center", gap: 4, minWidth: 0 }}>
              <View style={{ width: 40, height: 40, borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundColor: rk.shirt, borderWidth: 2, borderColor: rk.trim }}><Text style={{ color: rk.trim, fontSize: 13, fontWeight: "900" }}>XI</Text></View>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>{f.sides.rivals.name.toUpperCase()}</Text>
            </View>
          </View>
          {(ours.length > 0 || theirs.length > 0) && (
            <View style={{ marginTop: 12, flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1, gap: 2 }}>{ours.map((g, i) => <Text key={i} style={{ color: g.you ? "#fde68a" : "rgba(255,255,255,0.9)", fontSize: 11.5, fontWeight: "700", textAlign: "right" }}>{g.text} ⚽</Text>)}</View>
              <View style={{ flex: 1, gap: 2 }}>{theirs.map((g, i) => <Text key={i} style={{ color: "rgba(255,255,255,0.9)", fontSize: 11.5, fontWeight: "700" }}>⚽ {g}</Text>)}</View>
            </View>
          )}
          <Text style={{ marginTop: 12, color: "#fde68a", fontSize: 13, fontWeight: "900", letterSpacing: 0.4, textAlign: "center" }}>{verdict.toUpperCase()}</Text>
        </Band>
        <View style={{ marginTop: 8, flexDirection: "row", gap: 6 }}>
          <NumberTile value={stats.goals} label="Goals" /><NumberTile value={stats.assists} label="Assists" /><NumberTile value={(Math.round((stats.rating ?? 0) * 10) / 10).toFixed(1)} label="Rating" />
        </View>
        <GoldLine left={<Text style={{ fontSize: 22 }}>👏</Text>} text={`Off at ${FAREWELL_OFF_AT}' to a standing ovation`} />
        {t && (
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.05)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.12)" } as ViewStyle}>
            <ClubCrest club={t.club} size={26} />
            <Text style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 12.5, fontWeight: "700" }}>{shortClub(t.club)} pay your testimonial</Text>
            <Text style={{ color: "#fde68a", fontFamily: FONT.display, fontSize: 18 }}>★{formatMoney(t.payout)}</Text>
          </View>
        )}
      </View>
    </EndShell>
  );
}

// ── The career overview ──────────────────────────────────────────────────────

const PAGES = [
  { id: "career", label: "Career", icon: "🏟️" }, { id: "seasons", label: "Seasons", icon: "📅" }, { id: "winners", label: "Who won", icon: "🏆" },
  { id: "clubs", label: "Clubs", icon: "🛡️" }, { id: "trophies", label: "Trophies", icon: "🥇" }, { id: "records", label: "Records", icon: "📈" },
  { id: "life", label: "Life", icon: "💰" },
] as const;
type PageId = (typeof PAGES)[number]["id"];

const TILE_NAME: Record<string, string> = {
  "Champions League": "Champions Lg", "Premier League": "Premier Lg", "Europa League": "Europa Lg", "European Championship": "Euros",
  "Conference League": "Conference", "Community Shield": "Comm. Shield", "Player of the Season": "Player of Season", "Player of the Month": "Player of Month",
};

function Heading({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={{ marginTop: 16, marginBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ color: "#fcd34d", fontSize: 10.5, fontWeight: "900", letterSpacing: 2.3 }}>{children.toUpperCase()}</Text>
      {right}
    </View>
  );
}

/** The LEGACY ring (CareerOverview LegacyRing: 150 px, radius 58, 11 thick, gold arc from the top). */
function LegacyRing({ score }: { score: number }) {
  const S = 150, r = 58;
  const shown = Math.max(0, Math.min(100, score));
  const { track, arc } = useMemo(() => {
    const oval = Skia.XYWHRect(S / 2 - r, S / 2 - r, r * 2, r * 2);
    const t = Skia.PathBuilder.Make(); t.addArc(oval, 0, 359.99);
    const a = Skia.PathBuilder.Make();
    if (shown > 0) a.addArc(oval, -90, Math.min(359.9, 3.6 * shown));
    return { track: t.build(), arc: a.build() };
  }, [shown]);
  return (
    <View style={{ alignSelf: "center", width: S, height: S, alignItems: "center", justifyContent: "center" }}>
      <View pointerEvents="none" style={{ position: "absolute" }}><Rays size={230} color="rgba(253,230,138,0.22)" /></View>
      <View style={{ position: "absolute", width: r * 2, height: r * 2, borderRadius: r, backgroundColor: "rgba(5,8,15,0.82)" }} />
      <Canvas style={{ position: "absolute", left: 0, top: 0, width: S, height: S }}>
        <Path path={track} style="stroke" strokeWidth={11} color="rgba(255,255,255,0.1)" />
        <Path path={arc} style="stroke" strokeWidth={11} strokeCap="round">
          <LinearGradient start={vec(0, 0)} end={vec(S, S)} colors={["#fef3c7", GOLD, "#b45309"]} positions={[0, 0.55, 1]} />
        </Path>
      </Canvas>
      <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 44, lineHeight: 48 }}>{Math.round(shown)}</Text>
      <Text style={{ marginTop: 2, color: "#fde68a", fontSize: 9.5, fontWeight: "900", letterSpacing: 3 }}>LEGACY</Text>
    </View>
  );
}

/** The words that go with a shared career (ShareCard.tsx cardShareText). */
function shareText(o: CareerOverviewData): string {
  const t = o.totals;
  const bits = [`${o.seasonsPlayed} seasons`, `${t.goals} goals`, ...(t.trophies > 0 ? [t.trophies === 1 ? "1 trophy" : `${t.trophies} trophies`] : []), ...(t.ballonDors > 0 ? [`${t.ballonDors}× Golden Ball`] : [])];
  return `${o.name} — ${o.verdict.title}. ${bits.join(", ")}. Legacy ${Math.round(o.verdict.score)}. knowitball.co.uk`;
}

/** Goals and assists, season by season: two bars a season, the best season crowned (ArcChart.tsx, as bars). */
function SeasonChart({ o }: { o: CareerOverviewData }) {
  const pts = o.arc;
  const max = Math.max(5, ...pts.map((p) => Math.max(p.goals ?? 0, p.assists ?? 0)));
  const top = Math.ceil(max / 10) * 10 || 10;
  const H = 120;
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 8 }}>
        {([["#f59e0b", "Goals"], ["#38bdf8", "Assists"]] as const).map(([c, l]) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c }} />
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6 }}>{l.toUpperCase()}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 22, height: H, justifyContent: "space-between" }}>
          {[top, top / 2, 0].map((v) => <Text key={v} style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: "800" }}>{v}</Text>)}
        </View>
        <View style={{ flex: 1, height: H, flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.18)" }}>
          {[0, 0.5].map((f) => <View key={f} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: H * f, height: 1, backgroundColor: "rgba(255,255,255,0.07)" }} />)}
          {pts.map((p) => {
            const peak = o.peak?.season === p.season;
            return (
              <View key={p.season} style={{ flex: 1, height: H, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 1 }}>
                {peak && <Text style={{ position: "absolute", top: Math.max(0, H - (H * Math.max(p.goals ?? 0, p.assists ?? 0)) / top - 16), fontSize: 10 }}>👑</Text>}
                <View style={{ flex: 1, maxWidth: 7, height: Math.max(1, (H * (p.goals ?? 0)) / top), backgroundColor: "#f59e0b" }} />
                <View style={{ flex: 1, maxWidth: 7, height: Math.max(1, (H * (p.assists ?? 0)) / top), backgroundColor: "#38bdf8" }} />
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingLeft: 22 }}>
        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: "800" }}>{pts[0]?.label ?? ""}</Text>
        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: "800" }}>{pts[pts.length - 1]?.label ?? ""}</Text>
      </View>
    </View>
  );
}

function Cabinet({ items }: { items: { competition: string; count: number }[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map((h) => (
        <View key={h.competition} style={{ width: "23.4%", alignItems: "center", paddingHorizontal: 4, paddingBottom: 6, paddingTop: 8, backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.3))", boxShadow: "inset 0px -3px 0px rgba(120,72,24,0.85), inset 0px 0px 0px 1px rgba(255,255,255,0.07)" } as ViewStyle}>
          <TrophyImage name={h.competition} height={40} />
          <View style={{ position: "absolute", right: 4, top: 4, paddingHorizontal: 4, borderRadius: 2, backgroundColor: GOLD }}><Text style={{ color: "#030712", fontSize: 11, lineHeight: 15, fontWeight: "900" }}>×{h.count}</Text></View>
          <Text numberOfLines={1} style={{ marginTop: 4, alignSelf: "stretch", textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: 9, fontWeight: "900", letterSpacing: 0.3 }}>{(TILE_NAME[h.competition] ?? h.competition).toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

function ListRow({ left, title, sub, right, gold }: { left?: ReactNode; title: string; sub?: string; right?: string; gold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 4, backgroundColor: "rgba(255,255,255,0.05)", boxShadow: `inset 0px 0px 0px 1px ${gold ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.08)"}` } as ViewStyle}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>{title}</Text>
        {sub ? <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700" }}>{sub}</Text> : null}
      </View>
      {right ? <Text style={{ color: gold ? "#fde68a" : "#fff", fontFamily: FONT.display, fontSize: 18 }}>{right}</Text> : null}
    </View>
  );
}

function CareerPage({ o, onOpen }: { o: CareerOverviewData; onOpen: (p: PageId) => void }) {
  const t = o.totals;
  const fw = o.farewell;
  return (
    <>
      <View style={{ paddingTop: 8 }}>
        <GoldPill>{`${o.retired ? "Career over" : "If you retired now"} · ${o.seasonsPlayed} seasons`}</GoldPill>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ marginTop: 8, color: "#d1d5db", fontFamily: FONT.display, fontSize: 34, lineHeight: 38, textAlign: "center", textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }}>{o.name}</Text>
        <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>{o.position} · {o.nation} · {o.years} · {o.retired ? `retired at ${o.ageAtEnd}` : `age ${o.ageAtEnd}`}</Text>
      </View>
      <View style={{ marginTop: 12 }}>
        <LegacyRing score={o.verdict.score} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 8, color: "#fbbf24", fontFamily: FONT.display, fontSize: 28, lineHeight: 32, textAlign: "center", textTransform: "uppercase" }}>{o.verdict.title}</Text>
        <Text style={{ marginTop: 6, alignSelf: "center", maxWidth: 300, color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 16, fontWeight: "600", textAlign: "center" }}>{o.verdict.summary}</Text>
      </View>
      <Press onPress={() => { void Share.share({ message: shareText(o) }).catch(() => {}); }} style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 2, backgroundColor: GOLD }}>
        <Text style={{ fontSize: 13 }}>📸</Text>
        <Text style={{ color: "#030712", fontSize: 12.5, fontWeight: "900", letterSpacing: 0.4 }}>SHARE</Text>
      </Press>
      {fw && fw.yourScore !== undefined && fw.theirScore !== undefined && (
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundImage: "linear-gradient(90deg, rgba(251,191,36,0.2), rgba(255,255,255,0.03))", boxShadow: "inset 0px 0px 0px 1px rgba(251,191,36,0.4)" } as ViewStyle}>
          <Text style={{ fontSize: 22 }}>👏</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: "#fde68a", fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>FAREWELL MATCH</Text>
            <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{fw.team ?? shortClub(fw.club)} v {fw.opponent}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 22, lineHeight: 25 }}>{fw.yourScore}–{fw.theirScore}</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }}>{fw.goals ?? 0} GOAL{fw.goals === 1 ? "" : "S"}</Text>
          </View>
        </View>
      )}
      <View style={{ marginTop: 16, gap: 6 }}>
        <View style={{ flexDirection: "row", gap: 6 }}><NumberTile value={t.apps} label="Apps" /><NumberTile value={t.goals} label="Goals" /><NumberTile value={t.assists} label="Assists" /></View>
        <View style={{ flexDirection: "row", gap: 6 }}><NumberTile value={t.trophies} label="Trophies" gold={t.trophies > 0} /><NumberTile value={t.ballonDors} label="Golden Ball" gold={t.ballonDors > 0} /><NumberTile value={t.caps} label="Caps" /></View>
      </View>
      <Heading right={<Press onPress={() => onOpen("clubs")}><Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.8 }}>CLUBS ›</Text></Press>}>The journey</Heading>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12 }} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {o.spells.map((sp, k) => (
          <View key={`${sp.club}-${sp.from}`} style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ width: 68, alignItems: "center" }}>
              <View style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center", backgroundImage: `radial-gradient(closest-side, ${rgba(hex6(clubGlow(sp.club)), 0.55)}, rgba(0,0,0,0))` } as ViewStyle}><ClubCrest club={sp.club} size={42} /></View>
              <Text numberOfLines={1} style={{ marginTop: 2, color: "#fff", fontSize: 11, fontWeight: "900" }}>{shortClub(sp.club)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "700" }}>{sp.years}</Text>
            </View>
            {k < o.spells.length - 1 && (
              <View style={{ width: 28, alignItems: "center", paddingTop: 18 }}>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 14 }}>→</Text>
                {sp.feeOut !== undefined && sp.feeOut > 0 && <Text style={{ marginTop: 2, color: "#fde68a", fontSize: 9.5, fontWeight: "900" }}>★{formatMoney(sp.feeOut)}</Text>}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      <Heading right={<Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10.5, fontWeight: "700" }}>age {o.seasons[0]?.age}–{o.ageAtEnd}</Text>}>Goals & assists by season</Heading>
      <Band style={{ paddingVertical: 10 }}><SeasonChart o={o} /></Band>
      {o.peak && (
        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundImage: `linear-gradient(90deg, ${rgba(hex6(clubGlow(o.peak.club)), 0.35)}, rgba(255,255,255,0.03))`, boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.1)" } as ViewStyle}>
          <Text style={{ fontSize: 22 }}>👑</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: "#fde68a", fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>BEST SEASON · {o.peak.label}</Text>
            <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{shortClub(o.peak.club)}</Text>
          </View>
          <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 20 }}>{o.peak.goals}<Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}> G </Text>{o.peak.assists}<Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}> A</Text></Text>
        </View>
      )}
      <Heading right={<Press onPress={() => onOpen("trophies")}><Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.8 }}>TROPHIES ›</Text></Press>}>The cabinet</Heading>
      {o.honours.length === 0 ? <Text style={{ paddingVertical: 12, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>No trophies</Text> : <Cabinet items={o.honours.slice(0, 8)} />}
    </>
  );
}

function OtherPage({ o, page }: { o: CareerOverviewData; page: Exclude<PageId, "career"> }) {
  if (page === "seasons") {
    return <>
      <Heading>Season by season</Heading>
      {[...o.seasons].reverse().map((s) => (
        <ListRow key={s.season} left={<ClubCrest club={s.club} size={28} />} title={`${s.label} · ${shortClub(s.club)}`} gold={s.ballonDorRank === 1 || s.trophies.length > 0}
          sub={[`age ${s.age}`, s.world ? `${s.world.position}${["th", "st", "nd", "rd"][s.world.position % 10 > 3 || (s.world.position % 100 > 10 && s.world.position % 100 < 14) ? 0 : s.world.position % 10]} of ${s.world.teams}` : "", ...s.trophies, ...s.awards, s.ballonDorRank === 1 ? "Golden Ball" : ""].filter(Boolean).join(" · ")}
          right={s.stats ? `${s.stats.goals}G ${s.stats.assists}A` : "—"} />
      ))}
    </>;
  }
  if (page === "winners") {
    const rows = [...o.seasons].reverse().filter((s) => s.world);
    return <>
      <Heading>Who won what</Heading>
      {rows.length === 0 ? <Text style={{ paddingVertical: 12, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>Nothing recorded</Text> : rows.map((s) => {
        const w = s.world!.winners;
        const list = [w.league ? `League: ${shortClub(w.league)}` : "", w.faCup ? `FA Cup: ${shortClub(w.faCup)}` : "", w.leagueCup ? `League Cup: ${shortClub(w.leagueCup)}` : "", w.championsLeague ? `Champions League: ${shortClub(w.championsLeague)}` : "", w.europaLeague ? `Europa League: ${shortClub(w.europaLeague)}` : "", s.world!.ballonDor ? `Golden Ball: ${s.world!.ballonDor.winner}` : ""].filter(Boolean);
        return <ListRow key={s.season} title={s.label} sub={list.join(" · ")} />;
      })}
    </>;
  }
  if (page === "clubs") {
    return <>
      <Heading>Clubs</Heading>
      {o.clubs.map((c) => (
        <ListRow key={c.club + c.firstSeason} left={<ClubCrest club={c.club} size={34} />} title={c.club} gold={c.trophies.length > 0}
          sub={[`${c.years} · ${c.apps} apps · ${c.goals} goals · ${c.assists} assists`, c.trophies.map((t) => `${t.competition}${t.count > 1 ? ` ×${t.count}` : ""}`).join(" · ")].filter(Boolean).join("\n")} />
      ))}
    </>;
  }
  if (page === "trophies") {
    return <>
      <Heading>Team trophies</Heading>
      {o.honours.length === 0 ? <Text style={{ paddingVertical: 12, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>No trophies</Text>
        : o.honours.map((h) => <ListRow key={h.competition} left={<TrophyImage name={h.competition} height={30} />} title={h.competition} sub={h.seasons.join(", ")} right={`×${h.count}`} gold />)}
      <Heading>Your own awards</Heading>
      {o.individual.length === 0 ? <Text style={{ paddingVertical: 12, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>No awards</Text>
        : o.individual.map((h) => <ListRow key={h.competition} left={<TrophyImage name={h.competition} height={30} fallback="🏅" />} title={h.competition} sub={h.seasons.join(", ")} right={`×${h.count}`} />)}
    </>;
  }
  if (page === "records") {
    return <>
      <Heading>Your records</Heading>
      {o.records.map((r, i) => <ListRow key={i} left={<Text style={{ fontSize: 20, width: 28, textAlign: "center" }}>{r.icon}</Text>} title={r.label} sub={r.sub} right={String(r.value)} />)}
      <View style={{ marginTop: 6, flexDirection: "row", gap: 6 }}>
        <NumberTile value={o.totals.motm} label="Star man" /><NumberTile value={o.totals.hatTricks} label="Hat-tricks" /><NumberTile value={o.totals.avgRating ? o.totals.avgRating.toFixed(1) : "—"} label="Avg rating" />
      </View>
    </>;
  }
  const l = o.life;
  return <>
    <Heading>Life</Heading>
    <View style={{ flexDirection: "row", gap: 6 }}><NumberTile value={`★${formatMoney(l.money)}`} label="Money" gold /><NumberTile value={Math.round(l.fame)} label="Fame" /><NumberTile value={Math.round(l.reputation)} label="Reputation" /></View>
    <View style={{ marginTop: 6, flexDirection: "row", gap: 6 }}><NumberTile value={Math.round(l.relationships.boss)} label="Boss" /><NumberTile value={Math.round(l.relationships.team)} label="Team" /><NumberTile value={Math.round(l.relationships.fans)} label="Fans" /></View>
    <View style={{ height: 8 }} />
    {l.testimonial && <ListRow left={<ClubCrest club={l.testimonial.club} size={28} />} title="Testimonial" sub={shortClub(l.testimonial.club)} right={`★${formatMoney(l.testimonial.payout)}`} gold />}
    {l.girlfriend ? <ListRow left={<Text style={{ fontSize: 20, width: 28, textAlign: "center" }}>❤️</Text>} title={l.girlfriend} sub="Your partner" /> : null}
    {l.son ? <ListRow left={<Text style={{ fontSize: 20, width: 28, textAlign: "center" }}>👦</Text>} title={l.son.name} sub={`Your son · age ${l.son.age}${l.son.club ? ` · ${shortClub(l.son.club)}` : ""}`} right={String(l.son.overall)} /> : null}
    {l.sponsors.length > 0 && <ListRow left={<Text style={{ fontSize: 20, width: 28, textAlign: "center" }}>🤝</Text>} title="Sponsors" sub={l.sponsors.map((s) => s.brand).join(" · ")} />}
    {l.clubsOwned.length > 0 && <ListRow left={<Text style={{ fontSize: 20, width: 28, textAlign: "center" }}>🏟️</Text>} title="Clubs you own" sub={l.clubsOwned.map((c) => `${shortClub(c.club)} ${c.percent}%`).join(" · ")} />}
    {l.items.length > 0 && <ListRow left={<Text style={{ fontSize: 20, width: 28, textAlign: "center" }}>🛍️</Text>} title="What you bought" sub={l.items.map((i) => i.name).slice(0, 8).join(" · ")} />}
  </>;
}

export function CareerOverviewView({ career, bar }: { career: CareerState; bar?: ReactNode }) {
  const o = useMemo(() => careerOverview(career, { calendarYears: leoUpdateOn("bugFixes") }), [career]);
  const [page, setPage] = useState<PageId>("career");
  const i = PAGES.findIndex((p) => p.id === page);
  const open = (p: PageId) => setPage(p);
  const turn = useRef((_d: number) => {});
  turn.current = (d) => open(PAGES[(i + d + PAGES.length) % PAGES.length].id);
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 28 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderRelease: (_e, g) => { if (Math.abs(g.dx) > 70) turn.current(g.dx < 0 ? 1 : -1); },
  })).current;
  const prev = PAGES[(i - 1 + PAGES.length) % PAGES.length], next = PAGES[(i + 1) % PAGES.length];
  return (
    <View style={{ flex: 1, backgroundColor: "#0b0f17" }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 420, backgroundImage: `radial-gradient(90% 60% at 50% 0%, ${rgba(hex6(clubGlow(o.finalClub, career)), 0.4)} 0%, rgba(0,0,0,0) 72%)` } as ViewStyle} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 22 }}>
            <Press onPress={() => turn.current(-1)} style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: 0.8 }}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>◀</Text><Text style={{ fontSize: 11 }}>{prev.icon}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6 }}>{prev.label.toUpperCase()}</Text>
            </Press>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.6 }}>{PAGES[i].icon} {PAGES[i].label.toUpperCase()}</Text>
            <Press onPress={() => turn.current(1)} style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: 0.8 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6 }}>{next.label.toUpperCase()}</Text>
              <Text style={{ fontSize: 11 }}>{next.icon}</Text><Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>▶</Text>
            </Press>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }} contentContainerStyle={{ gap: 4 }}>
            {PAGES.map((p, k) => (
              <Press key={p.id} onPress={() => open(p.id)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: k === i ? GOLD : "rgba(255,255,255,0.07)" }}>
                <Text style={{ fontSize: 10.5 }}>{p.icon}</Text>
                <Text style={{ color: k === i ? "#160f02" : "rgba(255,255,255,0.85)", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.4 }}>{p.label.toUpperCase()}</Text>
              </Press>
            ))}
          </ScrollView>
        </View>
        <View style={{ flex: 1 }} {...swipe.panHandlers}>
          <ScrollView key={page} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 28, width: "100%", maxWidth: 448, alignSelf: "center" }}>
            {page === "career" ? <CareerPage o={o} onOpen={open} /> : <OtherPage o={o} page={page} />}
          </ScrollView>
        </View>
      </SafeAreaView>
      {bar}
    </View>
  );
}

export function LegacyScreen({ career, onHall, onNewCareer, onMenu }: { career: CareerState; onHall: () => void; onNewCareer: () => void; onMenu: () => void }) {
  return <CareerOverviewView career={career} bar={<EndBar><BarButton icon="🏛" label="Hall of Fame" onPress={onHall} /><BarButton icon="＋" label="New career" primary onPress={onNewCareer} /><BarButton icon="☰" label="Menu" onPress={onMenu} /></EndBar>} />;
}
