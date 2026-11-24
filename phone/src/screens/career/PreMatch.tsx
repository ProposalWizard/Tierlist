/**
 * PLAY → THE LINE-UP → THE MATCH, as the website (components/star/LineupIntro.tsx
 * + VersusScreen.tsx) in the packed app's glass look:
 *
 *   - Left out of the squad, injured or away with your country: one card,
 *     Watch from the stands (left out for energy alone: a can gets you back in).
 *   - Energy under the starting line: one prompt (use a can, play anyway, back).
 *   - Otherwise the team sheets: a glass header (Back, the competition, ⏩ sim
 *     and ⚙ in the corner, both crests with last five, formation and manager,
 *     VS and the date), both elevens as drawn head chips on one pitch (home at
 *     the top), Substitutes under it, KICK OFF under your thumb. It kicks off by
 *     itself after a few seconds (a thin timer along the top), or on a tap on
 *     the pitch; ⏩, ⚙ and Substitutes stop the timer.
 *   - Settings → "Skip the line-up": straight into the match.
 *
 * Also the phone's own pre-match redirects (youth week, loan brief).
 *   - Dropped to the bench after starting the last one: the manager's "Team news"
 *     card first, once a fixture (LineupIntro + ManagerMoments.tsx ManagerSays, the
 *     plain card: the phone has no 3D office).
 * Not here: the weather line (Leo's update, off by default on the website).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withDelay, withRepeat, Easing } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState, Fixture, LeagueResult } from "@/lib/star/types";
import type { Kit } from "@/lib/star/kits";
import { kitsFor, kitLabelOnDark } from "@/lib/star/kits";
import { nextFixtureFor } from "@/lib/star/competitions";
import { projectedEnergy } from "@/lib/star/week";
import { shortClub } from "@/lib/star/media/grammar";
import { matchdayFor, offeredPositions, formationForClub, playedAsShort, type SheetPlayer, type TeamSheet } from "@/lib/star/teamsheet";
import type { Role } from "@/lib/star/formations";
import { setCareer } from "../../game/store";
import { MatchSettingsSheet } from "../MatchLook";
import { internationalCareer } from "@/lib/star/international";
import { loadLineup, managerFor } from "@/lib/star/lineupStore";
import { formationOf } from "@/lib/star/formations";
import { fixtureDateLabel, divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { place, across } from "@/lib/star/pitchLayout";
import { benchMomentFor } from "@/lib/star/managerMoments";
import { MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB, selectionFor } from "@/lib/star/selection";
import { KIB_CANS, kibCanPrice } from "@/lib/star/shopData";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { nationalityFlag } from "@/lib/nationalities";
import * as flow from "../../game/flow";
import { usePrefs } from "../../game/prefs";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { PlayerHead } from "../../draw/PlayerHead";
import { Backdrop, Bar, FONT, LOOK, LookButton, CAN, glassStyle, levelColors, rgba } from "../../ui/look";
import { ClubCrest } from "./kit";
import { OfficeMoment, OfficeStage } from "./Office3D";
import { glowOf, clubGlow } from "./lookBits";

/** How long the line-up shows before it kicks off by itself (LineupIntro LINEUP_MS). */
const LINEUP_MS = 3800;
/** The Substitutes tab under the pitch. */
const SUBS_TAB = 30;

type Go = (s: flow.Step, push?: boolean) => void;

export function PreMatchScreen({ career, go, onBack }: { career: CareerState; go: Go; onBack: () => void }) {
  // page.tsx: a youth-team player's match day is his youth week; a loan's
  // target is shown once a week on the way to the match (LoanBrief).
  const redirect = career.placement?.kind === "youth" ? "career-youth" : flow.loanBriefDue(career) ? "career-loan-brief" : null;
  useEffect(() => { if (redirect) go({ screen: redirect }); }, [redirect]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = nextFixtureFor(career);
  if (redirect) return null;
  if (!f) {
    return (
      <PromptShell onBack={onBack}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center" }}>NO MATCH</Text>
      </PromptShell>
    );
  }
  return <MatchDay career={career} f={f} go={go} onBack={onBack} />;
}

function MatchDay({ career, f, go, onBack }: { career: CareerState; f: Fixture; go: Go; onBack: () => void }) {
  const prefs = usePrefs();
  const sel = flow.preMatchSelection(career);
  const status = sel.status;
  const watching = !!f.watch || status === "Squad" || status === "Injured";
  const e = Math.max(0, Math.min(100, Math.round(projectedEnergy(career))));
  const tired = !watching && e < MIN_ENERGY_TO_START;
  const [asked, setAsked] = useState(false);
  // LineupIntro: dropped to the bench after starting the last one = "Team news" first, once a fixture.
  const [benchHeard, setBenchHeard] = useState(false);
  // LineupIntro: "Not in the squad" is said in his office in 3D (34vh above the words); a phone that cannot run it shows the card as it was.
  const [room3dFailed, setRoom3dFailed] = useState(false);
  const roomH = Math.round(useWindowDimensions().height * 0.34);
  const benchMoment = useMemo(() => { try { return benchMomentFor(career, sel, f, e); } catch { return null; } },
    [career.season, f.week, f.kind, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const benchHold = !!benchMoment && !benchHeard;

  const saved = loadLineup(career.player.club);
  const intlCareer = useMemo(() => (f.kind === "international" ? internationalCareer(career, f) : null),
    [career.season, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const matchday = useMemo(() => {
    try {
      if (intlCareer) return matchdayFor(intlCareer, f, true);
      const savedXI = saved && saved.xi.some(Boolean) ? { formation: formationOf(saved.formation), xi: saved.xi } : undefined;
      return matchdayFor(career, f, status === "1st Team", career.playAs ?? undefined, saved?.bench, savedXI, status === "Substitute");
    } catch (err) { console.warn("line-up: no team sheet", err); return null; }
  }, [career.player.club, f, status, intlCareer, career.playAs]); // eslint-disable-line react-hooks/exhaustive-deps
  const teamsReady = !!matchday && (matchday.home.yours ? matchday.home : matchday.away).xi.length >= 9;

  const went = useRef(false);
  const kickOff = () => { if (went.current) return; went.current = true; flow.readyWeek(); go({ screen: "match" }); };
  const sim = () => { if (went.current) return; went.current = true; go(flow.simMatch()); };
  const showLineup = !benchHold && !watching && (!tired || asked) && teamsReady && !prefs.skipLineup;

  // Nothing to draw (a squad too thin), or "Skip the line-up": straight in.
  useEffect(() => {
    if (benchHold || watching || (tired && !asked) || showLineup) return;
    kickOff();
  }, [benchHold, watching, tired, asked, showLineup]); // eslint-disable-line react-hooks/exhaustive-deps

  if (benchHold && benchMoment) {
    return (
      <ManagerSaysCard career={career} title="Team news" text={benchMoment.text}
        onContinue={() => { setBenchHeard(true); setCareer((c) => ({ ...c, benchMomentSeen: benchMoment.key })); }} />
    );
  }

  if (showLineup && matchday) {
    const competition = !f.kind || f.kind === "league"
      ? `${leagueNameFor(divisionOf(career))} · Matchday ${f.week}`
      : `${f.competition ?? ""}${f.round ? ` · ${f.round}` : ""}`;
    return (
      <Lineup career={career} matchday={matchday} clubKits={(intlCareer ?? career).clubKits}
        competition={competition}
        date={fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, divisionOf(career))}
        results={career.results ?? []}
        canSim={status === "1st Team" || status === "Substitute"}
        canPlayAs={!intlCareer && (status === "1st Team" || status === "Substitute")}
        benchNote={status === "Substitute" ? sel.reason : null}
        onBack={onBack} onKickOff={kickOff} onSim={sim} />
    );
  }
  if (!watching && !(tired && !asked)) return <View style={{ flex: 1, backgroundColor: "#05080f" }} />;

  // The one prompt: low energy as you press Play, or left out of the squad.
  const can = KIB_CANS.find((c) => !c.effect) ?? KIB_CANS[0];
  const have = career.kibCans[can.id] ?? 0;
  const price = kibCanPrice(can, career.contract.wage);
  const tiredOut = status === "Squad" && e < MIN_ENERGY_TO_SUB && !sel.away
    && selectionFor({ ...career, energy: 100 }).status !== "Squad" && can.restore > 0;
  const cansNeeded = Math.max(1, Math.ceil((MIN_ENERGY_TO_SUB - e) / Math.max(1, can.restore)));
  const canIcon = <View style={{ width: 18, height: 28, alignItems: "center", justifyContent: "center" }}><Animated.Image source={CAN.basic} style={{ width: 12, height: 28 }} resizeMode="contain" /></View>;
  return (
    <PromptShell onBack={onBack} glow={clubGlow(career.player.club, career)}>
      {watching ? (
        <>
          {status === "Squad" && !room3dFailed && <OfficeStage career={career} speaker="boss" onFail={() => setRoom3dFailed(true)} style={{ width: "100%", height: roomH, borderRadius: 4, marginBottom: 12 }} />}
          <Text style={{ fontSize: 34, textAlign: "center" }}>{status === "Injured" ? "🩹" : sel.away ? "✈️" : f.watch ? "📺" : "📋"}</Text>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center", letterSpacing: 0.6, marginTop: 8 }}>
            {(status === "Injured" ? "You're injured" : sel.away ? "Away with your country" : f.watch ? "On TV" : "Not in the squad").toUpperCase()}
          </Text>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 6 }}>{sel.reason}</Text>
          <LookButton kind="navy" style={{ marginTop: 16, paddingVertical: 13 }} onPress={() => { const r = flow.watchFromStands(); go(r.step, false); }}>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.8 }}>{f.watch ? "📺 WATCH ON TV" : "🏟️ WATCH FROM THE STANDS"}</Text>
          </LookButton>
          {tiredOut && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>
                Energy {e}. You need {MIN_ENERGY_TO_SUB} to be involved: {cansNeeded} {cansNeeded === 1 ? "can" : "cans"} (+{can.restore} each).
              </Text>
              <LookButton kind="gold" style={{ marginTop: 8, paddingVertical: 12 }} disabled={have <= 0 && career.money < price}
                onPress={() => { if (have > 0) flow.useCan(can.id); else { flow.buyCan(can); flow.useCan(can.id); } }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{canIcon}
                  <Text style={{ color: "#111827", fontSize: 14, fontWeight: "900" }}>{have > 0 ? `DRINK A CAN ×${have}` : career.money < price ? `CAN ★${price}: NOT ENOUGH MONEY` : `BUY & DRINK A CAN ★${price}`}</Text>
                </View>
              </LookButton>
            </View>
          )}
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 26 }}>⚡</Text>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 0.6 }}>LOW ENERGY</Text>
          </View>
          {/* LineupIntro: SquareBar h-[26px], the number over the bar, centred */}
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.45)", overflow: "hidden", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.14)" } as ViewStyle}>
              <View style={{ width: `${Math.max(3, e)}%`, height: "100%", borderRadius: 13, backgroundImage: `linear-gradient(180deg, ${levelColors(e)[1]}, ${levelColors(e)[0]})` } as ViewStyle} />
            </View>
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } }}>{e}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            {have > 0 && (
              <LookButton kind="gold" style={{ flex: 1, paddingVertical: 12, borderRadius: 2 }} onPress={() => flow.useCan(can.id)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{canIcon}<Text style={{ color: "#111827", fontSize: 14, fontWeight: "900" }}>USE A CAN ×{have}</Text></View>
              </LookButton>
            )}
            <LookButton kind="primary" style={{ flex: 1, paddingVertical: 12, borderRadius: 2 }} onPress={() => setAsked(true)}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.6 }}>PLAY ANYWAY</Text>
            </LookButton>
          </View>
        </>
      )}
    </PromptShell>
  );
}

/** The manager's words in his office (ManagerMoments.tsx ManagerSays: the 3D office, the same words on a plain card if the phone cannot run it): title right, slate box, Continue. */
export function ManagerSaysCard({ career, title, text, onContinue }: { career: CareerState; title: string; text: string; onContinue: () => void }) {
  return <OfficeMoment career={career} title={title} text={text} onContinue={onContinue} />;
}

/** The prompt card over the night: a dark see-through panel, ‹ Back under it. */
function PromptShell({ children, onBack, glow }: { children: React.ReactNode; onBack: () => void; glow?: string }) {
  // LineupIntro's prompt page as the packed app shows it: the blurred ground behind (its pitch look
  // paints over the page's own navy), the card in the middle of the top 70% of the screen.
  void glow;
  return (
    <View style={{ flex: 1, backgroundColor: "#05080f" }}>
      <Backdrop kind="stadium" />
      <SafeAreaView style={{ height: "70%", justifyContent: "center", paddingHorizontal: 16 }}>
        <View style={{ padding: 16, backgroundColor: "rgba(0,0,0,0.55)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.2)" } as ViewStyle}>
          {children}
          <Press onPress={onBack} style={{ marginTop: 8, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.8 }}>‹ BACK</Text>
          </Press>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── The team sheets (VersusScreen.tsx) ──

type Result = "W" | "D" | "L";
const FORM_BG: Record<Result, string> = { W: "#16a34a", D: "#b98a1f", L: "#b91c1c" };
function recentForm(club: string, results: LeagueResult[]): Result[] {
  return results.filter((r) => r.home === club || r.away === club).sort((a, b) => a.week - b.week).slice(-5)
    .map((r): Result => { const home = r.home === club; const gf = home ? r.hs : r.as; const ga = home ? r.as : r.hs; return gf > ga ? "W" : gf === ga ? "D" : "L"; });
}
const scouted = (s: TeamSheet) => s.xi.length >= 9;
const OUTLINE = { textShadowColor: "#000", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2.5 } as const;

export function Lineup({ career, matchday, clubKits, competition, date, results, canSim, canPlayAs, benchNote, onBack, onKickOff, onSim, noTimer, bare }: {
  career: CareerState; matchday: NonNullable<ReturnType<typeof matchdayFor>>; clubKits?: CareerState["clubKits"];
  competition: string; date: string; results: LeagueResult[]; canSim: boolean; canPlayAs: boolean; benchNote: string | null;
  onBack: () => void; onKickOff: () => void; onSim: () => void;
  /** No countdown: it waits for KICK OFF (the farewell's team sheets). */
  noTimer?: boolean;
  /** The farewell's team sheets (page.tsx: VersusScreen on its own): no ⚙, no boots tag, no manager's name from the career. */
  bare?: boolean;
}) {
  const nav = useNav();
  const { home, away } = matchday;
  const kits = kitsFor(home.club, away.club, clubKits?.[home.club], clubKits?.[away.club]);
  const yours = home.yours ? home : away;
  const homeGlow = glowOf(kits.home.shirt, kits.home.trim);
  const awayGlow = glowOf(kits.away.shirt, kits.away.trim);
  const managers: Record<string, string> = career.manager && !bare ? { [career.player.club]: career.manager.name } : {};
  const [compHead, ...rest] = competition.split(" · ");
  const compTail = rest.join(" · ");
  // A long competition name on a narrow phone: smaller, tighter letters, so the round stays on the line.
  const winW = useWindowDimensions().width;
  const chipTight = competition.length > 20 && winW < 400;
  const [showSubs, setShowSubs] = useState(false);
  // "Play as" (LineupIntro's picker): your own position in this shape, and the others the shape offers.
  const [picking, setPicking] = useState(false);
  const [gear, setGear] = useState(false);
  const savedShape = loadLineup(career.player.club);
  const shape = savedShape && savedShape.xi.some(Boolean) ? formationOf(savedShape.formation) : formationForClub(career.player.club);
  const ownShort = playedAsShort(career.player.position as Role, shape);
  const alternates = useMemo(() => offeredPositions(career.player.position, shape).filter((a) => a.short !== ownShort),
    [career.player.club, career.player.position, savedShape?.formation]); // eslint-disable-line react-hooks/exhaustive-deps
  const playAs = (career.playAs ?? null) as Role | null;
  const here = playedAsShort(playAs ?? (career.player.position as Role), shape);
  const pickable = canPlayAs && alternates.length > 0;
  // VS slams in and KICK OFF breathes (VersusScreen kit-slam, the button's pulse).
  const slam = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    slam.value = withDelay(180, withTiming(1, { duration: 320, easing: Easing.out(Easing.back(2.2)) }));
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const slamStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, slam.value * 2), transform: [{ scale: 2.2 - 1.2 * slam.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.018 * pulse.value }] }));
  const [held, setHeld] = useState(!!noTimer);
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null);

  // The timer along the top; at the end it kicks off by itself (not once held).
  const fill = useSharedValue(0);
  useEffect(() => {
    if (held) return;
    fill.value = withTiming(1, { duration: LINEUP_MS, easing: Easing.linear });
    const t = setTimeout(onKickOff, LINEUP_MS);
    return () => clearTimeout(t);
  }, [held]); // eslint-disable-line react-hooks/exhaustive-deps
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const hold = () => setHeld(true);
  // PLAY on Home sits where KICK OFF is here: the tap that opened this screen must not also kick off.
  const shownAt = useRef(Date.now());
  const kick = () => { if (Date.now() - shownAt.current > 400) onKickOff(); };

  // The pitch keeps its 3 : 4.9 shape and narrows until it fits above KICK OFF.
  // (The Substitutes tab's strip is the KICK OFF bar's own top padding: taking it off here too left a 28 px
  // gap under the tab and a pitch 17 px narrower than the packed app's at 360 wide.)
  const pitchW = room ? Math.min(room.w, Math.floor(room.h * 3 / 4.9)) : 0;
  const pitchH = pitchW * 4.9 / 3;
  const ratio = room ? pitchW / room.w : 1;
  const chip = ratio >= 0.9 ? 34 : Math.round(34 * Math.max(0.78, ratio));
  const bootsLeft = career.currentBoot.matches;
  const skin = skinToneHex(career.player.skinTone);

  return (
    // LineupIntro: a tap anywhere that is not a button kicks off; with the position list open it closes it.
    <Pressable style={{ flex: 1, backgroundColor: "#0b1a2e" }} onPress={() => { if (picking) setPicking(false); else if (showSubs) setShowSubs(false); else if (!gear) kick(); }}>
      <Backdrop kind="stadium" />
      <SafeAreaView edges={["top"]} style={{ flex: 1, paddingHorizontal: 12, paddingTop: 10 }}>
        {/* ── The header: each side's colour washing in from its own edge ── */}
        <View style={[glassStyle("glass"), {
          borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10,
          backgroundImage: `linear-gradient(90deg, ${rgba(homeGlow, 0.32)}, rgba(0,0,0,0) 42%, rgba(0,0,0,0) 58%, ${rgba(awayGlow, 0.32)}), linear-gradient(180deg, ${LOOK.glassTop}, ${LOOK.glassBottom})`,
        } as ViewStyle]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <Press onPress={() => { hold(); onBack(); }} style={{ height: 30, paddingHorizontal: 10, borderRadius: 8, justifyContent: "center", backgroundImage: `linear-gradient(180deg, ${LOOK.navy}, ${LOOK.navyDeep})`, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1px rgba(255,255,255,0.18)" } as ViewStyle}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>← Back</Text>
            </Press>
            <View style={{ flex: 1, alignItems: "center" }}>
              {/* One line at every width (VersusScreen's chip): the words shrink before they wrap. */}
              <View style={{ maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: "rgba(255,255,255,0.8)", fontSize: chipTight ? 8 : 9.5, fontWeight: "900", letterSpacing: chipTight ? 0.3 : 1.2, textAlign: "center" }}>
                  ⚽ {compHead.toUpperCase()}
                  {compTail ? <Text style={{ color: "#fcd34d" }}><Text style={{ color: "rgba(255,255,255,0.3)" }}> · </Text>{compTail.toUpperCase()}</Text> : null}
                </Text>
              </View>
            </View>
            <View style={{ width: 58 }} />
          </View>
          {/* ⏩ and ⚙, mirroring Back */}
          <View style={{ position: "absolute", right: 8, top: 10, gap: 6, zIndex: 6 }}>
            {canSim && <Square onPress={() => { hold(); onSim(); }} edge="rgba(125,211,252,0.55)"><Text style={{ color: "#e0f2fe", fontSize: 14 }}>⏩</Text></Square>}
            {!bare && <Square onPress={() => { hold(); setGear(true); }} edge="rgba(255,255,255,0.45)"><Text style={{ color: "#fff", fontSize: 16 }}>⚙</Text></Square>}
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 10, paddingRight: 30 }}>
            <TeamHeader club={home.club} manager={managers[home.club]} kit={kits.home} formation={home.formation.name} form={recentForm(home.club, results)} scouted={scouted(home)} />
            <View style={{ alignItems: "center", paddingTop: 10, gap: 4, width: 84 }}>
              <Animated.Text style={[{ color: "#dfe3ea", fontSize: 28, fontWeight: "900", fontStyle: "italic", letterSpacing: -1, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 }, slamStyle]}>VS</Animated.Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                {/* VersusScreen CalendarIcon: a drawn calendar page, 10 px */}
                <View style={{ width: 10, height: 10, opacity: 0.8 }}>
                  <View style={{ position: "absolute", left: 1, right: 1, top: 2, bottom: 0.5, borderWidth: 0.8, borderColor: "#fff", borderRadius: 1 }} />
                  <View style={{ position: "absolute", left: 1, right: 1, top: 4, height: 0.8, backgroundColor: "#fff" }} />
                  <View style={{ position: "absolute", left: 2.8, top: 1, width: 0.8, height: 2, backgroundColor: "#fff" }} />
                  <View style={{ position: "absolute", right: 2.8, top: 1, width: 0.8, height: 2, backgroundColor: "#fff" }} />
                </View>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "700" }}>{date}</Text>
              </View>
            </View>
            <TeamHeader club={away.club} manager={managers[away.club]} kit={kits.away} formation={away.formation.name} form={recentForm(away.club, results)} scouted={scouted(away)} />
          </View>
        </View>

        {/* ── The pitch ── */}
        <View style={{ flex: 1 }} onLayout={(ev) => { const { width, height } = ev.nativeEvent.layout; if (!room || room.w !== width || room.h !== height) setRoom({ w: width, h: height }); }}>
          {room && pitchW > 0 && (
            <View style={{ width: pitchW, alignSelf: "center" }}>
              <Pressable onPress={() => { if (showSubs) setShowSubs(false); else kick(); }}>
                <View style={{ width: pitchW, height: pitchH, overflow: "hidden", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, borderTopWidth: 0, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(10,40,20,0.18)", boxShadow: "inset 0px 0px 50px rgba(0,0,0,0.35)" } as ViewStyle}>
                  {Array.from({ length: 8 }, (_, k) => <View key={k} style={{ position: "absolute", left: 0, right: 0, top: (k * pitchH) / 8, height: pitchH / 8, backgroundColor: k % 2 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)" }} />)}
                  <Markings w={pitchW} h={pitchH} />
                  {scouted(home)
                    ? home.xi.map((p) => <Man key={`h-${p.id}`} p={p} kit={kits.home} keeper={kits.keeper} bottom={false} chip={chip} w={pitchW} h={pitchH} skin={skin} />)
                    : <Unscouted bottom={false} />}
                  {scouted(away)
                    ? away.xi.map((p) => <Man key={`a-${p.id}`} p={p} kit={kits.away} keeper={kits.keeper} bottom chip={chip} w={pitchW} h={pitchH} skin={skin} />)
                    : <Unscouted bottom />}
                </View>
              </Pressable>
              {bootsLeft <= 1 && !bare && (
                <View pointerEvents="none" style={{ position: "absolute", left: 6, top: 6, height: 32, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, borderRadius: 2, backgroundColor: "rgba(3,32,15,0.9)", boxShadow: "inset 0px 0px 0px 1px rgba(251,191,36,0.7), 0px 3px 8px rgba(0,0,0,0.45)" } as ViewStyle}>
                  <Text style={{ fontSize: 14 }}>🥾</Text>
                  <Text numberOfLines={2} style={{ color: "#fef3c7", fontSize: 10, fontWeight: "900", lineHeight: 12 }}>{bootsLeft === 1 ? "LAST MATCH\nIN THESE BOOTS" : "NO BOOTS\nBUY IN THE SHOP"}</Text>
                </View>
              )}
              {/* Play as (LineupIntro): top-right of the pitch; the row of positions opens under it. It stops the timer. */}
              {pickable && (
                <View style={{ position: "absolute", right: 6, top: 6, alignItems: "flex-end", zIndex: 5 }}>
                  <Press onPress={() => { hold(); setPicking((o) => !o); }}
                    style={{ height: 32, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 2, backgroundColor: "rgba(3,32,15,0.9)", boxShadow: `inset 0px 0px 0px 1px ${playAs ? "#fbbf24" : "rgba(255,255,255,0.45)"}, 0px 3px 8px rgba(0,0,0,0.45)` } as ViewStyle}>
                    <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "900" }}>PLAY AS</Text>
                    <Text numberOfLines={1} style={{ color: playAs ? "#fcd34d" : "#fff", fontSize: 14, fontWeight: "900" }}>{here}</Text>
                    <Text style={{ color: "#fcd34d", fontSize: 10 }}>▾</Text>
                  </Press>
                  {picking && (
                    <View style={{ marginTop: 4, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: pitchW - 12, gap: 1, padding: 1, backgroundColor: "rgba(0,0,0,0.6)", boxShadow: "0px 8px 20px rgba(0,0,0,0.6)" } as ViewStyle}>
                      {[{ role: null as Role | null, label: ownShort }, ...alternates.map((a) => ({ role: a.role as Role | null, label: a.short }))].map(({ role, label }) => {
                        const on = playAs === role;
                        return (
                          <Press key={role ?? "own"} onPress={() => { setCareer((c) => ({ ...c, playAs: role })); setPicking(false); }}
                            style={{ minWidth: 46, height: 36, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#fbbf24" : "#0c2a18" }}>
                            <Text numberOfLines={1} style={{ color: on ? "#030712" : "#fff", fontSize: 15, fontWeight: "900" }}>{label}</Text>
                          </Press>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
              {/* Substitutes: a tab under the pitch; open, it grows up over the pitch. */}
              <View style={{ position: "absolute", left: 0, right: 0, bottom: -SUBS_TAB, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(3,7,18,0.95)", overflow: "hidden" }}>
                {/* The tab stays on top; open, both benches hang under it and the box grows up over the pitch (VersusScreen). */}
                <Press onPress={() => { hold(); setShowSubs((s) => !s); }} style={{ height: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "900", transform: [{ rotate: showSubs ? "90deg" : "0deg" }] }}>›</Text>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>SUBSTITUTES</Text>
                  <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900" }}>+{yours.bench.length}</Text>
                </Press>
                {showSubs && (
                  <View style={{ flexDirection: "row", gap: 1, backgroundColor: "rgba(255,255,255,0.1)", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)", maxHeight: pitchH * 0.6 }}>
                    <Bench sheet={home} kit={kits.home} />
                    <Bench sheet={away} kit={kits.away} />
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* KICK OFF, always under the thumb. */}
        <SafeAreaView edges={["bottom"]} style={{ paddingTop: SUBS_TAB + 4, paddingBottom: 6 }}>
          {benchNote ? <Text numberOfLines={1} style={{ color: "#fde68a", fontSize: 11, fontWeight: "800", textAlign: "center", marginBottom: 6 }}>🪑 {benchNote}</Text> : null}
          <Animated.View style={pulseStyle}>
            <LookButton kind="primary" onPress={kick} style={{ paddingVertical: 12, borderRadius: 12, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.35), 0px 0px 22px rgba(52,211,153,0.55)" } as ViewStyle}>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 3 }}>KICK OFF</Text>
            </LookButton>
          </Animated.View>
        </SafeAreaView>
      </SafeAreaView>
      {/* ⚙: the small sheet over the line-up (LineupIntro), not the whole Settings screen. */}
      {gear && <MatchSettingsSheet back="Back to the line-up" onClose={() => setGear(false)} />}
      {!held && (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 4, backgroundColor: "rgba(0,0,0,0.6)" }}>
          <Animated.View style={[{ height: 4, backgroundColor: "#34d399" }, fillStyle]} />
        </View>
      )}
    </Pressable>
  );
}

function Square({ children, onPress, edge }: { children: React.ReactNode; onPress: () => void; edge: string }) {
  return (
    <Press onPress={onPress} style={{ width: 32, height: 32, borderRadius: 2, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3,7,18,0.82)", boxShadow: `inset 0px 0px 0px 1px ${edge}` } as ViewStyle}>
      {children}
    </Press>
  );
}

/** One team's header column: crest, last five, formation, manager (VersusScreen TeamHeader). */
function TeamHeader({ club, manager: known, kit, formation, form, scouted: ok }: { club: string; manager?: string; kit: Kit; formation: string; form: Result[]; scouted: boolean }) {
  const manager = managerFor(club) || known || "";
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4, minWidth: 0 }}>
      <ClubCrest club={club} size={44} />
      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>{shortClub(club)}</Text>
      <View style={{ flexDirection: "row", gap: 3, height: 13 }}>
        {form.map((r, i) => <View key={i} style={{ width: 13, height: 13, borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundColor: FORM_BG[r] }}><Text style={{ color: "#fff", fontSize: 8, fontWeight: "900" }}>{r}</Text></View>)}
      </View>
      <Text numberOfLines={1} style={{ color: ok ? kitLabelOnDark(kit.shirt, kit.trim) : "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "900", letterSpacing: 0.9 }}>{ok ? formation.toUpperCase() : "UNSCOUTED"}</Text>
      {manager ? <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.6)", fontSize: 8, fontWeight: "700" }}>{manager}</Text> : null}
    </View>
  );
}

/** One man on the pitch: his drawn head in his kit, his name under it (the gold star over you). */
function Man({ p, kit, keeper, bottom, chip, w, h, skin }: { p: SheetPlayer; kit: Kit; keeper: Kit; bottom: boolean; chip: number; w: number; h: number; skin: string }) {
  const worn = p.role === "GK" ? keeper : kit;
  const boxW = w * 0.22;
  const x = across(p.x, bottom) * w, y = place(p.y, bottom) * h;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x - boxW / 2, top: y - chip / 2 - 1, width: boxW, alignItems: "center" }}>
      {p.isYou && <Text style={{ position: "absolute", top: -13, color: "#fbbf24", fontSize: 12, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }}>★</Text>}
      <View style={{ width: chip, height: chip, borderRadius: chip / 2, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)", backgroundColor: worn.shirt, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <PlayerHead id={p.id} shirt={worn.shirt} shorts={worn.trim} trim={worn.trim} size={chip - 4} skin={p.isYou ? skin : undefined} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 1 }}>
        <Text numberOfLines={1} style={[{ color: "#fff", fontSize: 9, fontWeight: "900", flexShrink: 1 }, OUTLINE]}>{p.short}</Text>
        {p.nation ? <Text style={{ fontSize: 8 }}>{nationalityFlag(p.nation)}</Text> : null}
      </View>
    </View>
  );
}

function Unscouted({ bottom }: { bottom: boolean }) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: bottom ? "50%" : 0, bottom: bottom ? 0 : "50%", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
      <View style={{ backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "900", textAlign: "center" }}>UNABLE TO SCOUT OPPONENT’S TEAM</Text>
      </View>
    </View>
  );
}

function Bench({ sheet, kit }: { sheet: TeamSheet; kit: Kit }) {
  const ok = scouted(sheet);
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(17,24,39,0.95)", paddingHorizontal: 8, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kit.shirt, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }} />
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>{shortClub(sheet.club).toUpperCase()}</Text>
      </View>
      {!ok ? <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700" }}>Unable to scout opponent’s team</Text>
        : sheet.bench.length === 0 ? <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700" }}>No bench listed</Text>
        : sheet.bench.map((p) => (
          <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 1 }}>
            {p.isYou && <Text style={{ color: "#fbbf24", fontSize: 9 }}>★</Text>}
            <Text numberOfLines={1} style={{ flexShrink: 1, color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: "700" }}>{p.short}</Text>
            {p.nation ? <Text style={{ fontSize: 7 }}>{nationalityFlag(p.nation)}</Text> : null}
            <Text style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)", fontSize: 8, fontWeight: "900" }}>{p.slot}</Text>
          </View>
        ))}
    </View>
  );
}

/**
 * The pitch markings (VersusScreen PitchMarkings), as plain lines and rings on
 * the 300 × 490 plan: boundary, halfway line, centre circle and spot, both
 * boxes, six-yard boxes and spots.
 */
function Markings({ w, h }: { w: number; h: number }) {
  const sx = w / 300, sy = h / 490;
  const ink = "rgba(255,255,255,0.34)";
  const r = (x: number, y: number, ww: number, hh: number, key: string, round?: boolean) => (
    <View key={key} style={{ position: "absolute", left: x * sx, top: y * sy, width: ww * sx, height: hh * sy, borderWidth: 1.4, borderColor: ink, borderRadius: round ? 999 : 0 }} />
  );
  const dot = (x: number, y: number, key: string) => <View key={key} style={{ position: "absolute", left: x * sx - 1.6, top: y * sy - 1.6, width: 3.2, height: 3.2, borderRadius: 2, backgroundColor: ink }} />;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      {r(2, 2, 296, 486, "edge")}
      <View style={{ position: "absolute", left: 2 * sx, right: 2 * sx, top: 245 * sy - 0.7, height: 1.4, backgroundColor: ink }} />
      {r(150 - 40.4, 245 - 42.7, 80.8, 85.4, "circle", true)}
      {dot(150, 245, "c")}
      {r(61, 2, 178, 75, "box1")}{r(109.6, 2, 80.8, 25.7, "six1")}{dot(150, 53.3, "p1")}
      {r(61, 413, 178, 75, "box2")}{r(109.6, 461.7, 80.8, 25.7, "six2")}{dot(150, 436.7, "p2")}
    </View>
  );
}
