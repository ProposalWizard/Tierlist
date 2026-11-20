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
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View, type ViewStyle } from "react-native";
import type { CareerState } from "@/lib/star/types";
import type { BreakingNews } from "@/lib/star/breakingNews";
import type { MonthAward } from "@/lib/star/potm";
import { kitsOf } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { PlayerHead } from "../../draw/PlayerHead";
import { ClubBadge } from "../../draw/ClubBadge";
import { FONT, LookButton, rgba } from "../../ui/look";

function YourHead({ career, size }: { career: CareerState; size: number }) {
  const kit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  return <PlayerHead id="you" shirt={kit.shirt} shorts={kit.trim} trim={kit.trim} size={size} skin={skinToneHex(career.player.skinTone)} />;
}

export function BreakingNewsPage({ career, news, onClose }: { career: CareerState; news: BreakingNews; onClose: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), 600); return () => clearTimeout(t); }, []);
  const kit = news.club ? kitsOf(news.club).home : undefined;
  const tint = kit?.shirt ?? "#1d4ed8";
  const ticker = `BREAKING NEWS  •  ${news.headline}  •  ${news.line}  •  `;
  const hasFace = !!news.face;
  return (
    <Modal transparent={false} visible animationType="fade" statusBarTranslucent onRequestClose={() => { if (armed) onClose(); }}>
      <Pressable onPress={() => { if (armed) onClose(); }} style={{ flex: 1, backgroundColor: "#05070d", overflow: "hidden" }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(120% 70% at 50% 42%, ${rgba(tint, 0.4)} 0%, #0a0f1c 55%, #04060b 100%)` } as ViewStyle} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: 0.18, backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 4px)" } as ViewStyle} />

        {/* top band, a little crooked */}
        <View style={{ paddingTop: 34 }}>
          <View style={{ marginLeft: -14, marginRight: 24, backgroundColor: "#dc2626", transform: [{ skewX: "-8deg" }], boxShadow: "0px 6px 0px #ffffff, 0px 10px 24px rgba(0,0,0,0.6)" } as ViewStyle}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 32, paddingRight: 24, transform: [{ skewX: "8deg" }] }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" }} />
              <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 34, lineHeight: 40, letterSpacing: 2 }}>BREAKING NEWS</Text>
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
            <Text style={{ color: "#000", fontFamily: FONT.display, fontSize: 40, lineHeight: 42, textTransform: "uppercase" }}>{news.headline}</Text>
            <View style={{ marginTop: 8, height: 5, width: 96, backgroundColor: "#dc2626" }} />
          </View>
          <Text style={{ maxWidth: 340, textAlign: "center", color: "#fff", fontSize: 16, fontWeight: "700", lineHeight: 21, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } }}>{news.line}</Text>
        </View>

        {/* tap hint above the ticker */}
        <View>
          <Text style={{ paddingBottom: 8, textAlign: "center", color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 3.6, opacity: armed ? 0.85 : 0 }}>TAP TO CONTINUE</Text>
          <View style={{ flexDirection: "row", alignItems: "stretch", overflow: "hidden", backgroundColor: "#000", borderTopWidth: 4, borderColor: "#fff", boxShadow: "0px -8px 0px #dc2626" } as ViewStyle}>
            <View style={{ backgroundColor: "#dc2626", paddingHorizontal: 16, justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 20, letterSpacing: 1.6 }}>{shortClub(news.club ?? "NEWS").toUpperCase().slice(0, 14)}</Text>
            </View>
            <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontFamily: FONT.display, fontSize: 20, letterSpacing: 1, paddingVertical: 12, paddingHorizontal: 10 }}>{ticker.repeat(2)}</Text>
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
        <View pointerEvents="none" style={{ position: "absolute", width: 520, height: 520, top: "18%", borderRadius: 260, backgroundImage: "repeating-conic-gradient(from 0deg, rgba(253,230,138,0.16) 0deg 8deg, transparent 8deg 22deg)", opacity: 0.8 } as ViewStyle} />
        <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 384 }}>
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900", letterSpacing: 3.3, textShadowColor: "rgba(251,191,36,0.5)", textShadowRadius: 10 }}>PLAYER OF THE MONTH</Text>
            <Text style={{ color: "#fde68a", fontSize: 30, fontWeight: "900", fontStyle: "italic", marginTop: 4, textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 }}>YOU WON IT</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", marginTop: 6 }}>{award.monthName} — {n(award.goals, "goal")} and {n(award.assists, "assist")}</Text>
          </View>
          {/* the month's card (the feed's potmWinner graphic) */}
          <View style={{ borderRadius: 18, overflow: "hidden", backgroundImage: `linear-gradient(160deg, ${glow}, ${rgba(glow, 0.55)} 45%, #0b1220 100%)`, boxShadow: `0px 0px 0px 1px rgba(253,230,138,0.35), 0px 0px 40px rgba(251,191,36,0.35), 0px 18px 36px -12px rgba(0,0,0,0.9)` } as ViewStyle}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 12 }}>
              <Text style={{ color: "#fde68a", fontFamily: FONT.display, fontSize: 18, letterSpacing: 1 }}>PLAYER OF THE MONTH</Text>
              <ClubBadge club={career.player.club} kit={kit} size={38} />
            </View>
            <View style={{ alignItems: "center", paddingVertical: 10 }}>
              <View style={{ width: 150, height: 150, borderRadius: 75, overflow: "hidden", borderWidth: 4, borderColor: "#fde68a", backgroundColor: "#0b1220" }}>
                <YourHead career={career} size={142} />
              </View>
            </View>
            <View style={{ backgroundColor: "rgba(3,7,18,0.75)", paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text numberOfLines={1} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 28, lineHeight: 32, textTransform: "uppercase" }}>{career.player.firstName} {career.player.lastName}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "800" }}>{career.player.club}</Text>
              <Text style={{ color: "#fcd34d", fontFamily: FONT.display, fontSize: 18, letterSpacing: 1.2, marginTop: 4 }}>{`${award.monthName} · ${n(award.goals, "goal")} · ${n(award.assists, "assist")}`.toUpperCase()}</Text>
            </View>
          </View>
          <LookButton label="OK" kind="gold" onPress={onClose} style={{ marginTop: 16, paddingVertical: 14 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
