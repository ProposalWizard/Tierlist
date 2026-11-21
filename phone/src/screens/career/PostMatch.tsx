/**
 * POST-MATCH, as the website's (components/star/PostMatch.tsx) in the packed
 * app's glass look, in its order: the competition, the scoreboard (both
 * crests, name plates in the kits, the score on white plates, Win/Draw/Defeat),
 * the knockout line, worn-out boots, then
 *   simmed: one card (⏩ Simulated, the star bar, the big match rating, goals
 *           and assists);
 *   played: the star bar, the match rating (tap for every chance), chances /
 *           goals / assists / passes, boss / team / fans, the pay;
 * the achievements one at a time, then the glowing CONTINUE.
 * The phone keeps its own extra lines (the star's extra points, boss / team /
 * fans after a sim, energy back), placed where the website's nearest block is.
 * Reads the report flow.completeMatch saved (game/session.ts).
 *
 * THE FINAL WHISTLE AS A MOMENT, as the website: the same numbers revealed in
 * its beats (score 0.25 s, verdict 1 s, star bar 1.4 s, rating 2.5 s, boss /
 * team / fans 3.5 s, pay 4.4 s): the digits slam in and count up, a win bursts
 * and a defeat shakes, the star bar rises (a level-up fills, empties, fills
 * again), the rating and the pay count up, the bars slide, CONTINUE pulses with
 * a shine. A double tap anywhere lands every beat at once (its FastForward).
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable, Animated as RNAnimated, Easing as RNEasing, type ViewStyle } from "react-native";
import { shortClub } from "@/lib/star/media/grammar";
import { kitsFor, type Kit } from "@/lib/star/kits";
import { CHANCE_KIND_LABEL, CHANCE_OUTCOME_LABEL, chanceOutcomeGood, type ChanceOutcome } from "@/lib/star/chanceLog";
import type { CareerState } from "@/lib/star/types";
import * as flow from "../../game/flow";
import { useSession } from "../../game/session";
import { Press } from "../../ui/Press";
import { FillStar, FONT, LookButton, glassStyle, rgba } from "../../ui/look";
import { Frame, Btn, ClubCrest, money } from "./kit";
import { glowOf } from "./lookBits";
import { luminance } from "@/lib/star/heroFigure";

const RESULT = { win: { word: "WIN", color: "#34d399" }, draw: { word: "DRAW", color: "#fbbf24" }, loss: { word: "DEFEAT", color: "#f87171" } } as const;
const OUTLINE = { textShadowColor: "#000", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 } as const;

// ── The beats and their motion (components/star/ui: useLater, CountUp, kit-slam, Burst, Shine, FloatText) ──

/** Skip: every beat lands at once (the website's double tap; also its reduced-motion path). */
const SkipCtx = createContext(false);
/** True once `ms` has passed since the screen opened (useLater). */
function useLater(ms: number): boolean {
  const skip = useContext(SkipCtx);
  const [on, setOn] = useState(ms <= 0);
  useEffect(() => { if (ms <= 0) return; const t = setTimeout(() => setOn(true), ms); return () => clearTimeout(t); }, [ms]);
  return on || skip;
}
/** A number that runs to its value over `ms` with an ease-out (useCountUp). */
function useTween(value: number, ms: number, ease: (t: number) => number = (t) => 1 - (1 - t) * (1 - t) * (1 - t)): number {
  const skip = useContext(SkipCtx);
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (skip || ms <= 0 || from.current === value) { from.current = value; setShown(value); return; }
    const a = from.current, t0 = Date.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / ms);
      const v = a + (value - a) * ease(t);
      from.current = v; setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ms, skip]);
  return skip ? value : shown;
}
function CountUp({ value, ms = 700, format = (n: number) => String(Math.round(n)) }: { value: number; ms?: number; format?: (n: number) => string }) {
  return <>{format(useTween(value, ms))}</>;
}
/** kit-slam: lands big and settles (620 ms). Hidden until `on`. */
function Slam({ on, delay = 0, children, style }: { on: boolean; delay?: number; children: ReactNode; style?: ViewStyle }) {
  const skip = useContext(SkipCtx);
  const v = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    if (skip) { v.setValue(1); return; }
    const a = RNAnimated.timing(v, { toValue: 1, duration: 620, delay, easing: RNEasing.bezier(0.2, 0.9, 0.25, 1), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [on, skip, delay, v]);
  return (
    <RNAnimated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 0.55, 0.75, 1], outputRange: [1.9, 0.92, 1.06, 1] }) }] }]}>{children}</RNAnimated.View>
  );
}
/** kit-reveal (kib-rise): fades up into place (560 ms). */
function Reveal({ on, children }: { on: boolean; children: ReactNode }) {
  const skip = useContext(SkipCtx);
  const v = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    if (skip) { v.setValue(1); return; }
    const a = RNAnimated.timing(v, { toValue: 1, duration: 560, easing: RNEasing.bezier(0.2, 0.9, 0.25, 1), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [on, skip, v]);
  return <RNAnimated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>{children}</RNAnimated.View>;
}
/** Burst: paper confetti thrown from a point, once (juice.tsx Burst + kib-confetti, 1.6 s). */
function Burst({ colors, count = 28, round }: { colors: string[]; count?: number; round?: boolean }) {
  const v = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => { RNAnimated.timing(v, { toValue: 1, duration: 1800, easing: RNEasing.linear, useNativeDriver: true }).start(); }, [v]);
  const bits = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (i % 3) * 0.3;
    const d = 70 + ((i * 37) % 60);
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8 + 40, c: colors[i % colors.length], w: 4 + (i % 3) * 2, t0: ((i % 5) * 40) / 1800 };
  });
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: "50%", top: "45%", zIndex: 5 }}>
      {bits.map((b, i) => {
        const t1 = b.t0 + 1600 / 1800;
        // the website's ease (.15,.6,.35,1): most of the way in the first third
        const path = [b.t0, b.t0 + (t1 - b.t0) * 0.12, b.t0 + (t1 - b.t0) * 0.4, t1];
        return (
          <RNAnimated.View key={i} style={{ position: "absolute", width: b.w, height: round ? b.w : b.w * 0.5, borderRadius: round ? b.w : 1, backgroundColor: b.c,
            opacity: v.interpolate({ inputRange: [0, ...path], outputRange: [0, 0, 1, 1, 0], extrapolate: "clamp" }),
            transform: [
              { translateX: v.interpolate({ inputRange: path, outputRange: [0, b.dx * 0.3, b.dx * 0.8, b.dx], extrapolate: "clamp" }) },
              { translateY: v.interpolate({ inputRange: path, outputRange: [0, b.dy * 0.3, b.dy * 0.8, b.dy], extrapolate: "clamp" }) },
              { rotate: v.interpolate({ inputRange: [b.t0, t1], outputRange: ["0deg", "540deg"], extrapolate: "clamp" }) },
            ] }} />
        );
      })}
    </View>
  );
}
/** Shine: a light sweeps across its parent (overflow hidden), once on `on`, or every `every` s (kit-shine / kit-shine-loop). */
function Shine({ on = true, every }: { on?: boolean; every?: number }) {
  const v = useRef(new RNAnimated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!on) return;
    v.setValue(0);
    const once = RNAnimated.timing(v, { toValue: 1, duration: every ? every * 300 : 1100, easing: RNEasing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true });
    const a = every ? RNAnimated.loop(RNAnimated.sequence([once, RNAnimated.delay(every * 700)])) : once;
    a.start();
    return () => a.stop();
  }, [on, every, v]);
  if (!on) return null;
  return (
    <View pointerEvents="none" onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {w > 0 && <RNAnimated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: w / 3, backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))",
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-(w / 3) * 1.3, (w / 3) * 3.3] }) }, { skewX: "-18deg" }] } as never} />}
    </View>
  );
}
/** FloatText: "+★500" pops up off its row and drifts away (kit-float, 1.2 s). */
function FloatText({ on, text, color }: { on: boolean; text: string; color: string }) {
  const skip = useContext(SkipCtx);
  const v = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => { if (on && !skip) RNAnimated.timing(v, { toValue: 1, duration: 1200, easing: RNEasing.bezier(0.2, 0.8, 0.3, 1), useNativeDriver: true }).start(); }, [on, skip, v]);
  if (!on || skip) return null;
  return (
    <RNAnimated.View pointerEvents="none" style={{ position: "absolute", left: -40, right: -40, top: -12, alignItems: "center",
      opacity: v.interpolate({ inputRange: [0, 0.18, 0.3, 1], outputRange: [0, 1, 1, 0] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 0.18, 0.3, 1], outputRange: [6, 0, -4, -34] }) }, { scale: v.interpolate({ inputRange: [0, 0.18, 0.3, 1], outputRange: [0.9, 1.08, 1, 1] }) }] }}>
      <Text numberOfLines={1} style={{ color, fontSize: 13, fontWeight: "900", textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>{text}</Text>
    </RNAnimated.View>
  );
}
/** kit-shake-x: a defeat shakes the scoreboard (560 ms). */
function Shake({ on, children }: { on: boolean; children: ReactNode }) {
  const skip = useContext(SkipCtx);
  const v = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => { if (on && !skip) RNAnimated.timing(v, { toValue: 1, duration: 560, easing: RNEasing.linear, useNativeDriver: true }).start(); }, [on, skip, v]);
  return <RNAnimated.View style={{ transform: [{ translateX: v.interpolate({ inputRange: [0, 0.12, 0.26, 0.4, 0.54, 0.68, 0.82, 1], outputRange: [0, -10, 9, -7, 5, -3, 2, 0] }) }] }}>{children}</RNAnimated.View>;
}
/** kib-play-pulse: a soft ring breathes out of the button (2.6 s). */
function PulseRing({ on }: { on: boolean }) {
  const v = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    const a = RNAnimated.loop(RNAnimated.timing(v, { toValue: 1, duration: 2600, easing: RNEasing.inOut(RNEasing.ease), useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [on, v]);
  if (!on) return null;
  return <RNAnimated.View pointerEvents="none" style={{ position: "absolute", left: -9, right: -9, top: -9, bottom: -9, borderRadius: 23, borderWidth: 9, borderColor: "rgba(52,211,153,0.55)",
    opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.9, 0] }), transform: [{ scaleX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.955, 1, 1] }) }, { scaleY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.75, 1, 1] }) }] }} />;
}

/** A glass card lit in a colour (the website's ClubCard glow). */
function GlowCard({ glow, children, style }: { glow: string; children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[glassStyle("glass"), { borderRadius: 16, overflow: "hidden", backgroundImage: `radial-gradient(ellipse at 50% 0%, ${rgba(glow, 0.22)} 0%, ${rgba(glow, 0)} 70%), linear-gradient(180deg, rgba(14,30,52,0.66), rgba(10,22,40,0.74))`, boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.18), inset 0px 0px 0px 1px ${rgba(glow, 0.45)}, 0px 8px 22px -10px rgba(0,0,0,0.55)` } as ViewStyle, style]}>{children}</View>;
}

export function PostMatchScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const { report } = useSession();
  const [chancesOpen, setChancesOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  // A double tap anywhere: the end of this screen (the website's FastForward).
  const [skip, setSkip] = useState(false);
  const lastTap = useRef(0);
  if (!report) {
    return <Frame title="Full time"><Btn label="Home" onPress={() => go(flow.HOME)} /></Frame>;
  }
  const { stats, fixture } = report;
  const mine = flow.myTeam(career, fixture);
  const youHome = fixture.home !== false;
  const homeTeam = youHome ? mine : fixture.opponent;
  const awayTeam = youHome ? fixture.opponent : mine;
  const kits = kitsFor(homeTeam, awayTeam, career.clubKits?.[homeTeam], career.clubKits?.[awayTeam]);
  const myKit = youHome ? kits.home : kits.away;
  const theme = glowOf(myKit.shirt, myKit.trim);
  const us = stats.homeScore, them = stats.awayScore;
  const result = us > them ? "win" : us < them ? "loss" : "draw";
  const look = RESULT[result];
  const hs = youHome ? stats.homeScore : stats.awayScore;
  const as = youHome ? stats.awayScore : stats.homeScore;
  const ko = report.knockout;
  const through = !!ko && (ko.startsWith("🏆") || ko.startsWith("Into") || ko.startsWith("Through"));
  const achs = flow.achievementCards(report.achievements);
  const allSeen = seen >= achs.length;

  const celebrate = result === "win" || through;
  const sting = result === "loss" || (!!ko && !through);
  const starBar = <StarBar from={report.starFrom} to={report.starTo} toNext={report.star.toNext} fromNext={report.star.fromNext} held={report.star.held} gate={report.star.gate} extra={report.star.extra} />;
  // Only a played match with a chance log opens on a tap (a disabled Press would fade the rating).
  const canTap = !!stats.chanceLog && !stats.simmed;
  const hero = <RatingHero value={stats.rating} starMan={stats.starMan} tap={canTap} open={chancesOpen} />;
  const rating = canTap ? <Press onPress={() => setChancesOpen((o) => !o)}>{hero}</Press> : hero;
  const rel = (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <RelBar label="Boss" from={report.rel.before.boss} to={report.rel.after.boss} delay={0} />
      <RelBar label="Team" from={report.rel.before.team} to={report.rel.after.team} delay={350} />
      <RelBar label="Fans" from={report.rel.before.fans} to={report.rel.after.fans} delay={700} />
    </View>
  );

  return (
    <SkipCtx.Provider value={skip}>
    <Pressable style={{ flex: 1 }} onPress={() => { const t = Date.now(); if (t - lastTap.current < 320) setSkip(true); lastTap.current = t; }}>
    <Frame title="Full time" bare
      footer={
        <View>
          {/* The achievements as the packed app's toasts: one at a time over CONTINUE, each goes by itself
              (or on a tap). CONTINUE is never shut, and nothing sits under it (at 360 wide the old card's
              Next button was under the bar and could not be pressed). */}
          {!allSeen && <AchievementToast key={seen} n={seen + 1} of={achs.length} label={achs[seen].label} description={achs[seen].description} onDone={() => setSeen((k) => k + 1)} />}
          <View>
            <PulseRing on />
            <LookButton kind="primary" onPress={() => go(flow.postMatchContinue())}
              style={{ paddingVertical: 14, borderRadius: 14, overflow: "hidden", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.4), 0px 0px 24px rgba(52,211,153,0.55)" } as ViewStyle}>
              <Shine every={5} />
              <Text numberOfLines={1} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 20, lineHeight: 24, letterSpacing: 0.6 }}>CONTINUE  →</Text>
            </LookButton>
          </View>
        </View>
      }>
      {/* The competition */}
      <View style={{ alignSelf: "center", paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
        <Text style={{ color: report.competition ? "#bfdbfe" : "#fde68a", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>{(report.competition ?? "Full time").toUpperCase()}</Text>
      </View>

      {/* The scoreboard: the score slams in and counts up; a win bursts, a defeat shakes. */}
      <ScoreCard sting={sting} celebrate={celebrate} burst={[myKit.shirt, myKit.trim, "#fde047", "#ffffff"]}>
      <View style={[glassStyle("glass"), { borderRadius: 16, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 12,
        backgroundImage: `linear-gradient(90deg, ${rgba(glowOf(kits.home.shirt, kits.home.trim), 0.2)}, rgba(0,0,0,0) 45%, rgba(0,0,0,0) 55%, ${rgba(glowOf(kits.away.shirt, kits.away.trim), 0.2)}), linear-gradient(180deg, rgba(14,30,52,0.66), rgba(10,22,40,0.74))` } as ViewStyle]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Side club={homeTeam} kit={kits.home} you={youHome} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 }}>
            <Digit n={hs} /><Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 22, fontWeight: "900" }}>–</Text><Digit n={as} delay={120} />
          </View>
          <Side club={awayTeam} kit={kits.away} you={!youHome} />
        </View>
        {stats.shootout && <Text style={{ color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: 6, fontSize: 12, fontWeight: "800" }}>Penalties {stats.shootout.home}–{stats.shootout.away}</Text>}
        <Verdict>
          <View style={{ alignSelf: "center", marginTop: 10, paddingHorizontal: 14, paddingVertical: 3, borderRadius: 999, backgroundColor: rgba(look.color, 0.16), boxShadow: `inset 0px 0px 0px 1px ${rgba(look.color, 0.45)}, 0px 0px 18px ${rgba(look.color, 0.35)}` } as ViewStyle}>
            <Text style={{ color: look.color, fontSize: 11, fontWeight: "900", letterSpacing: 3.3 }}>{look.word}</Text>
          </View>
        </Verdict>
      </View>
      </ScoreCard>

      {ko && (
        <Verdict>
        <View style={{ borderRadius: 12, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 11,
          backgroundImage: ko.startsWith("🏆") ? "linear-gradient(180deg, #fde68a, #fbbf24 55%, #d97706)" : through ? "linear-gradient(180deg, #34d399, #059669 60%, #065f46)" : "linear-gradient(180deg, #f87171, #b91c1c 60%, #7f1d1d)",
          boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.4), 0px 8px 18px -8px rgba(0,0,0,0.8)" } as ViewStyle}>
          {through && <Shine />}
          <Text style={{ color: ko.startsWith("🏆") ? "#030712" : "#fff", textAlign: "center", fontWeight: "900", fontSize: 14 }}>{ko}</Text>
        </View>
        </Verdict>
      )}
      {report.bootsWornOut && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(251,191,36,0.15)", borderWidth: 1, borderColor: "rgba(252,211,77,0.5)" }}>
          <Text style={{ fontSize: 18 }}>🥾</Text>
          <Text style={{ flex: 1, color: "#fff", fontWeight: "900", fontSize: 12.5 }}>Your boots just wore out. Buy a new pair in the Shop before your next match.</Text>
        </View>
      )}

      {stats.simmed ? (
        <GlowCard glow={theme}>
          <View style={{ paddingVertical: 6, alignItems: "center", backgroundColor: "rgba(14,165,233,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: "#bae6fd", fontSize: 10.5, fontWeight: "900", letterSpacing: 2 }}>⏩ SIMULATED{stats.enteredAt ? ` · ON AT ${stats.enteredAt}'` : ""}</Text>
          </View>
          {starBar}
          {rating}
          <View style={{ flexDirection: "row", gap: 8, padding: 10, paddingTop: 0 }}>
            <StatTile label="Goals" value={stats.goals} lit={stats.goals > 0} />
            <StatTile label="Assists" value={stats.assists} lit={stats.assists > 0} />
          </View>
        </GlowCard>
      ) : (
        <>
          <GlowCard glow="#fbbf24">{starBar}</GlowCard>
          <GlowCard glow={theme}>
            {rating}
            {chancesOpen && stats.chanceLog && (
              <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 12, paddingVertical: 8 }}>
                {stats.chanceLog.length === 0 && <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 12 }}>No chances came to you.</Text>}
                {stats.chanceLog.map((ch, i) => (
                  <View key={i} style={{ flexDirection: "row", paddingVertical: 2 }}>
                    <Text style={{ color: "rgba(255,255,255,0.75)", width: 40, fontWeight: "900", fontSize: 12 }}>{ch.minute}'</Text>
                    <Text numberOfLines={1} style={{ color: "#fff", flex: 1, fontWeight: "900", fontSize: 12 }}>{CHANCE_KIND_LABEL[ch.kind] ?? ch.kind}</Text>
                    <Text style={{ color: chanceOutcomeGood(ch.outcome) ? "#6ee7b7" : "#fca5a5", fontWeight: "900", fontSize: 12 }}>{CHANCE_OUTCOME_LABEL[ch.outcome as ChanceOutcome] ?? ch.outcome}</Text>
                  </View>
                ))}
              </View>
            )}
          </GlowCard>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <StatTile label="Chances" value={stats.chances} />
            <StatTile label="Goals" value={stats.goals} lit={stats.goals > 0} />
            <StatTile label="Assists" value={stats.assists} lit={stats.assists > 0} />
            <StatTile label="Passes" value={stats.passes} />
          </View>
        </>
      )}

      {/* Boss, team and fans: where each was, and where it is now (green up, red down). */}
      {rel}

      {!stats.simmed && <Pay wage={stats.wage} goalBonus={stats.goalBonus} sponsorPay={stats.sponsorPay} totalCash={stats.totalCash} />}
      {report.energyBack ? <Text style={{ color: "#6ee7b7", textAlign: "center", fontWeight: "800", fontSize: 12 }}>⚡ +{report.energyBack} energy back from the rest days</Text> : null}

    </Frame>
    </Pressable>
    </SkipCtx.Provider>
  );
}

/** The scoreboard card on its beats: shakes on a defeat, bursts on a win (both at the verdict, 1 s). */
function ScoreCard({ sting, celebrate, burst, children }: { sting: boolean; celebrate: boolean; burst: string[]; children: ReactNode }) {
  const verdict = useLater(1000);
  const skip = useContext(SkipCtx);
  return (
    <Shake on={verdict && sting}>
      {children}
      {verdict && celebrate && !skip && <Burst colors={burst} count={28} />}
    </Shake>
  );
}
/** Slams in at the verdict (1 s): the Win / Draw / Defeat pill, the knockout line. */
function Verdict({ children }: { children: ReactNode }) {
  return <Slam on={useLater(1000)}>{children}</Slam>;
}
/** The pay card (4.4 s): rises in, each row counts up, the total shines and floats its "+★". */
function Pay({ wage, goalBonus, sponsorPay, totalCash }: { wage: number; goalBonus: number; sponsorPay: number; totalCash: number }) {
  const on = useLater(4400);
  return (
    <Reveal on={on}>
      <GlowCard glow="#fbbf24">
        <Text style={{ color: "#fde68a", fontSize: 10.5, fontWeight: "900", letterSpacing: 2, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>PAY</Text>
        {([["Wage", wage], ["Goal Bonus", goalBonus], ["Sponsors", sponsorPay]] as [string, number][]).map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ flex: 1, color: "#fff", fontSize: 12, fontWeight: "900" }}>{k}</Text>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] }}><CountUp value={on ? v : 0} ms={700} format={(n) => money(Math.round(n))} /></Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", alignItems: "center", margin: 8, marginTop: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundImage: "linear-gradient(180deg, #34d399, #059669 60%, #065f46)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.4)" } as ViewStyle}>
          <Shine on={on} />
          <Text style={{ flex: 1, color: "#fff", fontWeight: "900", fontSize: 14 }}>Total Cash</Text>
          <View>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 17, fontVariant: ["tabular-nums"] }}><CountUp value={on ? totalCash : 0} ms={900} format={(n) => money(Math.round(n))} /></Text>
            <FloatText on={on && totalCash > 0} text={`+${money(totalCash)}`} color="#fde047" />
          </View>
        </View>
      </GlowCard>
    </Reveal>
  );
}

/** How long one achievement toast stays (the packed app's toast timer). */
const TOAST_MS = 3400;
/** One achievement toast (page.tsx AchievementToasts): slides up, a timer bar runs down, then the next. */
function AchievementToast({ n, of, label, description, onDone }: { n: number; of: number; label: string; description: string; onDone: () => void }) {
  const inV = useRef(new RNAnimated.Value(0)).current;
  const bar = useRef(new RNAnimated.Value(1)).current;
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    RNAnimated.timing(inV, { toValue: 1, duration: 260, easing: RNEasing.out(RNEasing.back(1.4)), useNativeDriver: true }).start();
    RNAnimated.timing(bar, { toValue: 0, duration: TOAST_MS, easing: RNEasing.linear, useNativeDriver: true }).start();
    const t = setTimeout(() => done.current(), TOAST_MS);
    return () => clearTimeout(t);
  }, [inV, bar]);
  return (
    <RNAnimated.View style={{ marginBottom: 8, opacity: inV, transform: [{ translateY: inV.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }}>
      <Press onPress={() => done.current()}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 8,
          backgroundImage: "linear-gradient(180deg, rgba(56,38,8,0.97), rgba(30,20,6,0.97))", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.2), inset 0px 0px 0px 2px rgba(251,191,36,0.7), 0px 0px 24px rgba(251,191,36,0.3)" } as ViewStyle}>
          <Text style={{ fontSize: 30 }}>🏅</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: "#fcd34d", fontWeight: "900", fontSize: 10, letterSpacing: 2 }}>ACHIEVEMENT{of > 1 ? ` ${n} OF ${of}` : ""}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>{label}</Text>
            <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 11.5, lineHeight: 15 }}>{description}</Text>
          </View>
          <RNAnimated.View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "#fbbf24", transformOrigin: "left", transform: [{ scaleX: bar }] } as never} />
        </View>
      </Press>
    </RNAnimated.View>
  );
}

/** One side of the scoreboard: the crest and a short name plate in the kit (outlined so a white kit reads). */
function Side({ club, kit, you }: { club: string; kit: Kit; you: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
      <View style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center" }}><ClubCrest club={club} size={50} /></View>
      <View style={{ alignSelf: "stretch", marginTop: 4, borderRadius: 6, borderWidth: 1, borderColor: kit.trim, backgroundColor: kit.shirt, paddingHorizontal: 4, paddingVertical: 2 }}>
        {/* A light kit gets dark words (BOURNEMOUTH on white read white on white). */}
        <Text numberOfLines={1} style={[{ color: luminance(kit.shirt) > 0.6 ? (luminance(kit.trim) < 0.4 ? kit.trim : "#0b1220") : "#fff", fontSize: 11, fontWeight: "900", textAlign: "center" }, luminance(kit.shirt) > 0.6 ? null : OUTLINE]}>{shortClub(club).toUpperCase()}</Text>
      </View>
      <Text style={{ color: "#6ee7b7", fontSize: 8.5, fontWeight: "900", letterSpacing: 2, marginTop: 2, opacity: you ? 1 : 0 }}>YOU</Text>
    </View>
  );
}

/** A big score digit on a white plate: slams in at 0.25 s and counts up from nothing. */
function Digit({ n, delay = 0 }: { n: number; delay?: number }) {
  const on = useLater(250);
  return (
    <Slam on={on} delay={delay} style={{ minWidth: 44, height: 52, borderRadius: 12, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(180deg, #ffffff, #e2e8f0)", boxShadow: "inset 0px -3px 0px rgba(0,0,0,0.15), 0px 8px 18px -6px rgba(0,0,0,0.8)" } as ViewStyle}>
      <Text style={{ color: "#030712", fontFamily: FONT.display, fontSize: 36, lineHeight: 42 }}><CountUp value={on ? n : 0} ms={500} /></Text>
    </Slam>
  );
}

/** A number over a small caps label (lit green when it is a goal or an assist). */
function StatTile({ label, value, lit }: { label: string; value: number; lit?: boolean }) {
  const on = useLater(2500);
  return (
    <View style={[{ flex: 1, borderRadius: 12, paddingVertical: 7, alignItems: "center" },
      (lit ? { backgroundImage: "linear-gradient(180deg, rgba(52,211,153,0.28), rgba(16,185,129,0.1))", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.18), inset 0px 0px 0px 1px rgba(52,211,153,0.4)" }
        : { backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1px rgba(255,255,255,0.08)" }) as ViewStyle]}>
      <Text style={{ color: lit ? "#6ee7b7" : "#fff", fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] }}><CountUp value={on ? value : 0} ms={600} /></Text>
      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** The match rating, big; tap it for your chances. */
function RatingHero({ value, starMan, tap, open }: { value: number; starMan: boolean; tap: boolean; open: boolean }) {
  const color = value >= 8 ? "#6ee7b7" : value >= 7 ? "#fde047" : value >= 6 ? "#ffffff" : "#f87171";
  const on = useLater(2500);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>MATCH RATING</Text>
        {tap && <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700", marginTop: 2 }}>{open ? "Hide chances ▴" : "Your chances ▾"}</Text>}
        {starMan && (
          <Slam on={on} delay={500} style={{ alignSelf: "flex-start", marginTop: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)" } as ViewStyle}>
            <Text style={{ color: "#030712", fontSize: 10, fontWeight: "900" }}>★ STAR MAN!</Text>
          </Slam>
        )}
      </View>
      <Text style={{ color, fontFamily: FONT.display, fontSize: 52, lineHeight: 58, textShadowColor: rgba(color.length === 7 ? color : "#ffffff", 0.5), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14, fontVariant: ["tabular-nums"] }}><CountUp value={on ? value : 0} ms={1000} format={(n) => n.toFixed(1)} /></Text>
    </View>
  );
}

/** Your star rating as a bar, this level at its left end and the next at its right (PostMatch StarBar). */
const STAR_RISE_MS = 3000, STAR_REFILL_MS = 2550, STAR_HOLD_MS = 350;
function StarBar({ from, to, toNext, fromNext, held, gate, extra }: { from: number; to: number; toNext: number; fromNext?: number; held?: number; gate?: string | number; extra: { label: string; n?: number }[] }) {
  const lo = Math.floor(from), hi = Math.floor(to);
  const up = hi > lo;
  const endPct = Math.max(3, Math.min(100, toNext * 100));
  // Where the bar starts: your way through the level before the match (the fraction of the old
  // rating); without a level-up it never starts above where it ends, so it can only rise.
  const startRaw = Math.max(0, Math.min(100, (fromNext ?? (from - lo)) * 100));
  const begin = up ? startRaw : Math.min(startRaw, endPct);
  // PostMatch riseTiming: one ease-out run; a level-up fills to the top, empties in one jump, fills again.
  const total = STAR_RISE_MS + STAR_REFILL_MS;
  const d1 = Math.max(0, 100 - begin), D = d1 + endPct;
  const x = up && D > 0 ? Math.min(0.97, Math.max(0.03, 1 - Math.sqrt(Math.max(0, 1 - d1 / D)))) : 1;
  const first = up ? Math.round(total * x) : STAR_RISE_MS, second = up ? Math.round(total * (1 - x)) : 0;
  const on = useLater(1400);
  const skip = useContext(SkipCtx);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (skip) { setStage(up ? 3 : 1); return; }
    setStage(1);
    if (!up) return;
    const t1 = setTimeout(() => setStage(2), first + STAR_HOLD_MS);
    const t2 = setTimeout(() => setStage(3), first + STAR_HOLD_MS + 90);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, up, skip]);
  const target = stage === 0 ? begin : stage === 1 ? (up ? 100 : endPct) : stage === 2 ? 0 : endPct;
  const a = 2 / (2 - x);
  const pct = useTween(target, stage === 2 || stage === 0 ? 0 : stage === 3 ? second : first,
    stage === 1 && up ? (t) => a * t - (a - 1) * t * t : (t) => 1 - (1 - t) * (1 - t));
  // The level the bar is filling: the old one until it empties on a level-up.
  const left = Math.max(1, up && stage < 2 ? lo : hi);
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <FillStar fraction={pct / 100} size={20} />
        <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900", letterSpacing: 2.2 }}>STAR RATING</Text>
        {up && stage >= 2 && <Text style={{ color: "#6ee7b7", fontSize: 11, fontWeight: "900", marginLeft: "auto" }}>{lo} → {hi} ⬆</Text>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ width: 22, textAlign: "center", color: "#fde68a", fontSize: 15, fontWeight: "900" }}>{left}</Text>
        <View style={{ flex: 1, height: 18, backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.75)", overflow: "hidden" }}>
          <View style={{ width: `${pct}%`, height: "100%", backgroundImage: "linear-gradient(90deg, #f59e0b, #fde047)" } as ViewStyle}>
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: "45%", backgroundColor: "rgba(255,255,255,0.3)" }} />
          </View>
        </View>
        <Text style={{ width: 22, textAlign: "center", color: "#fde68a", fontSize: 15, fontWeight: "900" }}>{left + 1}</Text>
      </View>
      {(held ?? 0) > 0 && stage !== 0 && <Text style={{ color: "#fef3c7", fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 6 }}>Bar full: level {left + 1} lands after your next match (one level a match).</Text>}
      {gate ? <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", marginTop: 6 }}>To go up: {gate}</Text> : null}
      {extra.length > 0 && <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", marginTop: 4 }}>{extra.map((l) => `+ ${l.label}${l.n && l.n > 1 ? ` ×${l.n}` : ""}`).join("   ")}</Text>}
    </View>
  );
}

/** Boss, team or fans: the bar where it is now, green if it rose, red if it fell (PostMatch RelBar). */
function RelBar({ label, from, to, delay = 0 }: { label: string; from: number; to: number; delay?: number }) {
  // Each bar shows where it really was, then slides to its new place on its beat (3.5 s, then 0.35 s apart).
  const moved = useLater(3500 + delay);
  const up = moved && to > from, down = moved && to < from;
  const tint = up ? "#34d399" : down ? "#f87171" : "#e5e7eb";
  const pct = Math.max(0, Math.min(100, useTween(moved ? to : from, 1400)));
  return (
    <View style={{ flex: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, ...(up || down ? { backgroundImage: `linear-gradient(180deg, ${rgba(tint, 0.22)}, ${rgba(tint, 0.08)})` } : { backgroundColor: "rgba(255,255,255,0.06)" }), boxShadow: `inset 0px 0px 0px 1px ${up || down ? rgba(tint, 0.5) : "rgba(255,255,255,0.12)"}` } as ViewStyle}>
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", textAlign: "center", marginBottom: 4 }}>{label}</Text>
      <View style={{ height: 8, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.5)", overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", borderRadius: 2, backgroundColor: tint }} />
      </View>
    </View>
  );
}

