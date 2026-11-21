/**
 * TWO MOMENTS THAT STOP THE GAME ON HOME, full screen as on the website:
 *
 * BreakingNewsPage: components/star/BreakingNews.tsx, a TV news moment. Red
 *   "BREAKING NEWS" band, LIVE · KNOWITBALL NEWS 24, your face in a ring with
 *   the club badge, the white headline strip, the one line, TAP TO CONTINUE and
 *   the ticker with the club's name. A tap in the first 0.6 s is ignored, so a
 *   stray tap from the screen before cannot skip it.
 * PotmWinPage: components/star/PotmWinModal.tsx. "PLAYER OF THE MONTH · YOU
 *   WON IT", the month's card with your face, club and numbers, a gold OK.
 *
 * Nothing moves at rest (ui/look README): the ticker is still, the rays are a
 * drawn glow.
 */
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Animated, Easing, Modal, Pressable, Text, View, type ViewStyle } from "react-native";
import { Headshot3D } from "../../three/Headshot3D";
import type { CareerState } from "@/lib/star/types";
import type { BreakingNews } from "@/lib/star/breakingNews";
import type { MonthAward } from "@/lib/star/potm";
import { kitsOf } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { PlayerHead } from "../../draw/PlayerHead";
import { ClubBadge } from "../../draw/ClubBadge";
import { FONT, LookButton, rgba } from "../../ui/look";
import { Rays, Scanlines } from "../../ui/look/Patterns";

function YourHead({ career, size }: { career: CareerState; size: number }) {
  const kit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  const drawn = <PlayerHead id="you" shirt={kit.shirt} shorts={kit.trim} trim={kit.trim} size={size} skin={skinToneHex(career.player.skinTone)} />;
  // Your 3D face, as the awards show it (three/Headshot3D); the drawn head until it lands, or with 3D off.
  return <Headshot3D id="you" you position={career.player.position} skin={skinToneHex(career.player.skinTone)} kit={{ shirt: kit.shirt, trim: kit.trim }} size={size} zoom={1.1} fallback={drawn} />;
}

/** The ticker's words running right to left for ever (BreakingNews.tsx bn-tick-run, 14 s a lap). */
function Ticker({ text }: { text: string }) {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (w <= 0) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: -w, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [w, x]);
  const words = { color: "#fff", fontFamily: FONT.display, fontSize: 20, letterSpacing: 1 } as const;
  return (
    <View style={{ flex: 1, overflow: "hidden", paddingVertical: 12 }}>
      <Animated.View style={{ flexDirection: "row", width: 100000, transform: [{ translateX: x }] }}>
        <Text numberOfLines={1} onLayout={(e) => { const n = Math.round(e.nativeEvent.layout.width); if (n > 0 && n !== w) setW(n); }} style={words}>{text.repeat(3)}</Text>
        <Text numberOfLines={1} style={words}>{text.repeat(3)}</Text>
      </Animated.View>
    </View>
  );
}

export function BreakingNewsPage({ career, news, onClose }: { career: CareerState; news: BreakingNews; onClose: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), 600); return () => clearTimeout(t); }, []);
  const kit = news.club ? kitsOf(news.club).home : undefined;
  const tint = kit?.shirt ?? "#1d4ed8";
  const ticker = `BREAKING NEWS  •  ${news.headline}  •  ${news.line}  •  `;
  const hasFace = !!news.face;
  const inset = useSafeAreaInsets();
  return (
    <Modal transparent={false} visible animationType="fade" statusBarTranslucent onRequestClose={() => { if (armed) onClose(); }}>
      <Pressable onPress={() => { if (armed) onClose(); }} style={{ flex: 1, backgroundColor: "#05070d", overflow: "hidden" }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(120% 70% at 50% 42%, ${rgba(tint, 0.4)} 0%, #0a0f1c 55%, #04060b 100%)` } as ViewStyle} />
        {/* the TV's faint lines: drawn (a phone has no repeating-linear-gradient) */}
        <Scanlines />

        {/* top band, a little crooked */}
        <View style={{ paddingTop: Math.max(12, inset.top + 4) }}>
          <View style={{ marginLeft: -14, marginRight: 24, backgroundColor: "#dc2626", transform: [{ skewX: "-8deg" }], boxShadow: "0px 6px 0px #ffffff, 0px 10px 24px rgba(0,0,0,0.6)" } as ViewStyle}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 32, paddingRight: 24, transform: [{ skewX: "8deg" }] }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" }} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ flexShrink: 1, color: "#fff", fontFamily: FONT.display, fontSize: 34, lineHeight: 40, letterSpacing: 2 }}>BREAKING NEWS</Text>
            </View>
          </View>
          <View style={{ marginTop: 12, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ backgroundColor: "#fff", color: "#000", fontFamily: FONT.display, fontSize: 13, letterSpacing: 2.6, paddingHorizontal: 8, paddingVertical: 1 }}>LIVE</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: FONT.display, fontSize: 13, letterSpacing: 2.6 }}>KNOWITBALL NEWS 24</Text>
          </View>
        </View>

        {/* the picture, the headline strip, the one line */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 20 }}>
          {(hasFace || news.club) && (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              {hasFace && (
                <View style={{ width: 136, height: 136, borderRadius: 68, overflow: "hidden", borderWidth: 4, borderColor: "#fff", backgroundColor: "#111827", boxShadow: `0px 0px 0px 4px ${tint}, 0px 14px 30px rgba(0,0,0,0.7)` } as ViewStyle}>
                  <YourHead career={career} size={128} />
                </View>
              )}
              {news.club && (
                <View style={[{ borderRadius: 999, backgroundColor: "#05070d", padding: 4, borderWidth: 3, borderColor: "#fff" }, hasFace ? { position: "absolute", bottom: -12, right: -32 } : null]}>
                  <ClubBadge club={news.club} kit={kit} size={hasFace ? 52 : 96} />
                </View>
              )}
            </View>
          )}
          <View style={{ width: "100%", maxWidth: 380, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18, transform: [{ rotate: "-1.6deg" }] }}>
            <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.55} style={{ color: "#000", fontFamily: FONT.display, fontSize: 40, lineHeight: 42, textTransform: "uppercase" }}>{news.headline}</Text>
            <View style={{ marginTop: 8, height: 5, width: 96, backgroundColor: "#dc2626" }} />
          </View>
          <Text numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.75} style={{ maxWidth: 340, textAlign: "center", color: "#fff", fontSize: 16, fontWeight: "700", lineHeight: 21, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } }}>{news.line}</Text>
        </View>

        {/* tap hint above the ticker */}
        <View>
          <Text style={{ paddingBottom: 8, textAlign: "center", color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 3.6, opacity: armed ? 0.85 : 0 }}>TAP TO CONTINUE</Text>
          <View style={{ marginBottom: inset.bottom, flexDirection: "row", alignItems: "stretch", overflow: "hidden", backgroundColor: "#000", borderTopWidth: 4, borderColor: "#fff", boxShadow: "0px -8px 0px #dc2626" } as ViewStyle}>
            <View style={{ backgroundColor: "#dc2626", paddingHorizontal: 16, justifyContent: "center" }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 20, lineHeight: 26, letterSpacing: 1.6 }}>{shortClub(news.club ?? "NEWS").toUpperCase().slice(0, 14)}</Text>
            </View>
            <Ticker text={ticker} />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

export function PotmWinPage({ career, award, onClose }: { career: CareerState; award: MonthAward; onClose: () => void }) {
  const kit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  const glow = kit.shirt;
  const n = (v: number, w: string) => `${v} ${w}${v === 1 ? "" : "s"}`;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(2,4,10,0.86)" }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(70% 50% at 50% 40%, ${rgba(glow, 0.35)}, transparent 70%)` } as ViewStyle} />
        {/* the gold rays: drawn (a phone has no repeating-conic-gradient) */}
        <View pointerEvents="none" style={{ position: "absolute", top: "18%", left: 0, right: 0, alignItems: "center" }}><Rays size={520} /></View>
        <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 384 }}>
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900", letterSpacing: 3.3, textShadowColor: "rgba(251,191,36,0.5)", textShadowRadius: 10 }}>PLAYER OF THE MONTH</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fde68a", fontSize: 30, fontWeight: "900", fontStyle: "italic", marginTop: 4, textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 }}>YOU WON IT</Text>
            <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", marginTop: 6, textAlign: "center" }}>{award.monthName} — {n(award.goals, "goal")} and {n(award.assists, "assist")}</Text>
          </View>
          {/* the month's card (the feed's potmWinner graphic) */}
          {/* The feed's potmWinner card (media/Graphics.tsx): your face on the club's
              colour on the left, the words on the right, the month along the foot. */}
          <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: "#0b1220", boxShadow: `0px 0px 0px 1px rgba(253,230,138,0.35), 0px 0px 40px rgba(251,191,36,0.35), 0px 18px 36px -12px rgba(0,0,0,0.9)` } as ViewStyle}>
            <View style={{ flexDirection: "row", height: 132 }}>
              <View style={{ width: "40%", alignItems: "center", justifyContent: "flex-end", overflow: "hidden", backgroundImage: `linear-gradient(180deg, ${glow}, ${rgba(glow, 0.7)})` } as ViewStyle}>
                <YourHead career={career} size={124} />
                <Text style={{ position: "absolute", left: 0, top: 0, backgroundColor: "#fde047", color: "#030712", fontSize: 9, fontWeight: "900", paddingHorizontal: 5, paddingVertical: 2 }}>YOU</Text>
              </View>
              <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12 }}>
                <Text style={{ color: "#fcd34d", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 }}>PLAYER OF THE MONTH</Text>
                <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 6 }}>{career.player.firstName}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 26, lineHeight: 30, textTransform: "uppercase" }}>{career.player.lastName}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <ClubBadge club={career.player.club} kit={kit} size={18} />
                  <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>{career.player.club.toUpperCase()}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "stretch", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Text style={{ backgroundColor: "#fde047", color: "#030712", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, paddingHorizontal: 10, paddingVertical: 6 }}>{award.monthName.toUpperCase()}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flex: 1, color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, paddingHorizontal: 10, paddingVertical: 6 }}>{`${n(award.goals, "goal")} · ${n(award.assists, "assist")}`.toUpperCase()}</Text>
            </View>
          </View>
          <LookButton label="OK" kind="gold" onPress={onClose} style={{ marginTop: 16, paddingVertical: 14 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
