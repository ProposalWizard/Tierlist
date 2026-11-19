/**
 * THE CUP DRAW — the phone port of components/star/CupDrawReveal.tsx.
 * "Run the Draw": a pot of balls that empties, each tie's home name drops,
 * then its away name ("drawing…" between), your tie lit gold with a buzz,
 * Skip ›, then Continue. Same timings as the website (away 700 ms, pop
 * 550 ms + 950 ms between ties). Animated on the phone's graphics thread
 * (react-native-reanimated); the website's trophy and confetti pictures are
 * left out (no pictures in the phone app yet).
 *
 * Opened with nav.go("cup-draw", { competition, round, onContinue }) — see
 * world/cupDraw.ts drawToShow for when.
 */
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { kitsFor } from "@/lib/star/kits";
import { useCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { C } from "../../world/lookKit";
import { ClubBadge, Btn } from "../../world/ui";
import { Backdrop, FONT, glassStyle } from "../../ui/look";
import type { DrawRound } from "../../world/cupDraw";

const AWAY_BALL_MS = 700;
const POP_MS = 550;
const TIE_GAP_MS = 950;

export function CupDrawScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  const nav = useNav();
  const competition = String(params?.competition ?? "Cup");
  const round = (params?.round as DrawRound | undefined) ?? { name: "", ties: [] };
  const onContinue = params?.onContinue as (() => void) | undefined;
  return <CupDrawReveal competition={competition} round={round} yourClub={career?.player.club ?? ""}
    onContinue={() => (onContinue ? onContinue() : nav.back())} />;
}

export function CupDrawReveal({ competition, round, yourClub, onContinue }: { competition: string; round: DrawRound; yourClub: string; onContinue: () => void }) {
  const inset = useSafeAreaInsets();
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [homeShown, setHomeShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = round.ties.length;
  const done = revealed >= total;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!started || done) return;
    timer.current = setTimeout(() => setHomeShown(true), AWAY_BALL_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [started, revealed, done]);
  useEffect(() => {
    if (!started || done || !homeShown) return;
    const tie = round.ties[revealed];
    if (tie && (tie.home === yourClub || tie.away === yourClub)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    timer.current = setTimeout(() => { setHomeShown(false); setRevealed((n) => n + 1); }, POP_MS + TIE_GAP_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [started, homeShown, done, revealed, round.ties, yourClub]);

  const skip = () => { if (timer.current) clearTimeout(timer.current); setStarted(true); setHomeShown(false); setRevealed(total); };
  const left = Math.max(0, total * 2 - revealed * 2 - (homeShown ? 2 : 1));

  return (
    <View style={{ flex: 1, backgroundColor: "#0b1a2e", paddingTop: inset.top }}>
      <Backdrop kind="stadium" />
      {/* the website's card: glass lit blue from the top (kit-card, --kit-glow #3b82f6) */}
      <View style={[glassStyle("glass", "#3b82f6"), { flex: 1, margin: 12, marginBottom: 0, borderRadius: 18, overflow: "hidden" }]}>
      <View style={{ alignItems: "center", paddingTop: 18, paddingBottom: 10 }}>
        <Text style={{ color: "rgba(125,211,252,0.75)", fontWeight: "900", fontSize: 10, letterSpacing: 3.5 }}>{competition.toUpperCase()} DRAW</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
          <View style={{ width: 40, height: 1, backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.25))" } as ViewStyle} />
          <Text style={{ color: C.text, fontFamily: FONT.display, fontSize: 24, lineHeight: 30, letterSpacing: 0.4, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }}>{round.name.toUpperCase()}</Text>
          <View style={{ width: 40, height: 1, backgroundImage: "linear-gradient(270deg, rgba(255,255,255,0), rgba(255,255,255,0.25))" } as ViewStyle} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 14, gap: 8, flexGrow: 1 }}>
        {!started ? (
          <View style={{ alignItems: "center", gap: 18, paddingTop: 12 }}>
            <View style={{ alignSelf: "stretch", alignItems: "center", paddingVertical: 26, borderRadius: 12, backgroundImage: "radial-gradient(65% 90% at 50% 15%, rgba(56,132,255,0.28), rgba(56,132,255,0) 70%)" } as ViewStyle}>
              <Text style={{ fontSize: 90, textShadowColor: "rgba(251,191,36,0.5)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 26 }}>🏆</Text>
              <Text style={{ fontSize: 28, marginTop: -6, transform: [{ rotate: "-8deg" }] }}>🎟️</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "800", textAlign: "center", fontSize: 14, paddingHorizontal: 12 }}>
              <Text style={{ color: "#fb7185" }}>{total}</Text> {total === 1 ? "tie" : "ties"} to be drawn for the <Text style={{ color: "#fb7185" }}>{round.name}</Text>.
            </Text>
            <Btn label="⚡ Run the Draw ⚡" tone="green" onPress={() => { setStarted(true); setRevealed(0); setHomeShown(false); }} style={{ paddingHorizontal: 30 }} />
          </View>
        ) : (
          <>
            {!done && (
              <View style={{ alignSelf: "center", width: 170, height: 60, borderBottomLeftRadius: 60, borderBottomRightRadius: 60, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundImage: "radial-gradient(120% 90% at 50% 10%, rgba(255,255,255,0.14), rgba(147,197,253,0.05) 60%, rgba(0,0,0,0.25))", borderWidth: 1.5, borderColor: "rgba(191,219,254,0.35)", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end", padding: 6, gap: 3, marginBottom: 6 }}>
                {Array.from({ length: Math.min(14, left) }, (_, i) => <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundImage: "radial-gradient(circle at 35% 30%, #ffffff, #cbd5e1 55%, #64748b)" } as ViewStyle} />)}
              </View>
            )}
            {round.ties.map((tie, i) => {
              if (!done && i > revealed) return <View key={`slot-${i}`} style={{ height: 44, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.3)" }} />;
              const isCurrent = !done && i === revealed;
              const mine = tie.home === yourClub || tie.away === yourClub;
              const showAway = !isCurrent || homeShown;
              const kits = kitsFor(tie.home, tie.away);
              return (
                <Animated.View key={`${tie.home}-${tie.away}-${i}`} entering={isCurrent ? FadeIn.duration(300) : undefined}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: mine ? "rgba(69,26,3,0.7)" : "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: mine ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.1)", boxShadow: mine ? "0px 0px 16px rgba(251,191,36,0.28)" : undefined } as ViewStyle}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Animated.View entering={isCurrent ? ZoomIn.duration(POP_MS) : undefined}><Dot shirt={kits.home.shirt} trim={kits.home.trim} club={tie.home} /></Animated.View>
                    <Text numberOfLines={1} style={{ flex: 1, color: mine ? C.gold : C.text, fontWeight: "800" }}>{tie.home}</Text>
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontWeight: "900", fontSize: 11 }}>v</Text>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    {showAway ? (
                      <>
                        <Text numberOfLines={1} style={{ flex: 1, textAlign: "right", color: mine ? C.gold : C.text, fontWeight: "800" }}>{tie.away}</Text>
                        <Animated.View entering={isCurrent ? ZoomIn.duration(POP_MS) : undefined}><Dot shirt={kits.away.shirt} trim={kits.away.trim} club={tie.away} /></Animated.View>
                      </>
                    ) : <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>drawing…</Text>}
                  </View>
                </Animated.View>
              );
            })}
            {!done && (
              <Press onPress={skip} style={{ alignSelf: "center", padding: 10 }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>SKIP ›</Text>
              </Press>
            )}
          </>
        )}
      </ScrollView>
      </View>
      <View style={{ padding: 14, paddingBottom: Math.max(inset.bottom, 14) }}>
        {done && <Text style={{ color: "#7dd3fc", fontWeight: "900", letterSpacing: 3, fontSize: 11, textAlign: "center", marginBottom: 8 }}>DRAW COMPLETE</Text>}
        <Btn label="Continue" tone="green" disabled={!done} onPress={onContinue} />
      </View>
    </View>
  );
}

/** A team in the draw: its badge (kit colours), drawn by the one ClubBadge. */
function Dot({ club }: { shirt: string; trim: string; club: string }) {
  return <ClubBadge club={club} size={26} />;
}
