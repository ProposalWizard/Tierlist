/**
 * YOUR PLAYER CARD, FIFA style (the website's components/star/PlayerCard.tsx):
 * overall, position, flag and badge down the left, your drawn head and
 * shoulders in your club's home kit, your name, the six skills. Its colour by
 * tier (lib/star/playerCard.ts: bronze, silver, gold, special).
 *
 * The shield is one Skia path with its gradient and shine, drawn once (no
 * animation; the website's "+2" flash is left out: nothing moves at rest).
 * If the drawing part is switched off (src/safety.ts), a plain rounded card.
 * The website's "Save image" button is off on its Stats page too.
 */
import { useMemo } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { Canvas, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import type { CareerState } from "@/lib/star/types";
import { CARD_STATS, cardData, type CardTier } from "@/lib/star/playerCard";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex, shortDisplayName } from "@/lib/star/playerIdentity";
import { PlayerHead } from "../../draw/PlayerHead";
import { ClubBadge } from "../../draw/ClubBadge";
import { useRiskyPart } from "../../safety";
import { FONT } from "../../ui/look";

/** Each tier's paint (PlayerCard.tsx LOOK). */
const TIER: Record<CardTier, { stops: [string, string, string]; edge: string; ink: string; soft: string; line: string }> = {
  bronze: { stops: ["#e0a878", "#b5794a", "#7c4a26"], edge: "#5a3417", ink: "#2e1a0b", soft: "rgba(46,26,11,0.7)", line: "rgba(46,26,11,0.28)" },
  silver: { stops: ["#f4f7fa", "#c3cbd3", "#8b959f"], edge: "#5f6973", ink: "#1b232b", soft: "rgba(27,35,43,0.68)", line: "rgba(27,35,43,0.24)" },
  gold: { stops: ["#fff1b0", "#f2c94c", "#b7861a"], edge: "#7a5608", ink: "#2f2200", soft: "rgba(47,34,0,0.7)", line: "rgba(47,34,0,0.26)" },
  special: { stops: ["#3b1d8f", "#1a0f45", "#0b4e6b"], edge: "#f5c84c", ink: "#fde68a", soft: "rgba(253,230,138,0.78)", line: "rgba(253,230,138,0.35)" },
};

const W = 216;
const H = 306;
/** The FUT shield: notched top corners, a point at the bottom (the website's path). */
const SHIELD = `M 26 4 L ${W - 26} 4 Q ${W - 20} 18 ${W - 4} 22 L ${W - 4} ${H - 58} Q ${W - 6} ${H - 40} ${W - 34} ${H - 30} L ${W / 2 + 8} ${H - 6} Q ${W / 2} ${H - 2} ${W / 2 - 8} ${H - 6} L 34 ${H - 30} Q 6 ${H - 40} 4 ${H - 58} L 4 22 Q 20 18 26 4 Z`;

export function PlayerCardView({ career, scale = 0.93 }: { career: CareerState; scale?: number }) {
  const data = useMemo(() => cardData(career), [career]);
  const look = TIER[data.tier];
  const kit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  const nation = career.player.nationality || "England";
  const name = shortDisplayName(career.player).toUpperCase();
  const half = (keys: typeof CARD_STATS) => (
    <View style={{ gap: 3 }}>
      {keys.map((s) => (
        <View key={s.key} style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
          <Text style={{ width: 26, textAlign: "right", fontFamily: FONT.display, fontSize: 19, lineHeight: 19, color: look.ink }}>{data.stats[s.key]}</Text>
          <Text style={{ fontSize: 13, lineHeight: 13, fontWeight: "700", letterSpacing: 0.4, color: look.soft, marginBottom: 2 }}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ width: W * scale, height: H * scale }}>
      <View style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: [{ translateX: -(W * (1 - scale)) / 2 }, { translateY: -(H * (1 - scale)) / 2 }, { scale }] }}>
        <Shield tier={data.tier} />
        {/* The portrait: head to waist, in your home kit (the website's fallback, DrawnHeadChip). */}
        <View style={{ position: "absolute", right: 12, top: 24, width: 132, height: 128, overflow: "hidden", alignItems: "center", justifyContent: "flex-end" }}>
          <PlayerHead id="you" shirt={kit.shirt} shorts={kit.trim} trim={kit.trim} size={112} skin={skinToneHex(career.player.skinTone)} round={false} />
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 26, backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0), ${look.stops[1]})` } as ViewStyle} />
        </View>
        {/* Left column: overall, position, flag, badge. */}
        <View style={{ position: "absolute", left: 22, top: 30, width: 50, alignItems: "center" }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 44, lineHeight: 39.6, color: look.ink }}>{data.overall}</Text>
          <Text style={{ fontFamily: FONT.display, fontSize: 15, lineHeight: 15, marginTop: 2, color: look.ink }}>{data.position}</Text>
          <View style={{ width: 32, height: 1, marginVertical: 6, backgroundColor: look.line }} />
          <ClubBadge club={nation} size={28} />
          <View style={{ height: 6 }} />
          <ClubBadge club={career.player.club} size={28} />
        </View>
        {/* Name. */}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ position: "absolute", left: 24, right: 24, top: 156, textAlign: "center", fontFamily: FONT.display, fontSize: 19, lineHeight: 19, letterSpacing: 0.6, color: look.ink }}>{name}</Text>
        {/* The six. */}
        <View style={{ position: "absolute", left: 0, right: 0, top: 190, flexDirection: "row", justifyContent: "center", gap: 20 }}>
          {half(CARD_STATS.slice(0, 3))}
          <View style={{ width: 1, backgroundColor: look.line }} />
          {half(CARD_STATS.slice(3))}
        </View>
      </View>
    </View>
  );
}

function Shield({ tier }: { tier: CardTier }) {
  const ok = useRiskyPart("badges", { settleMs: 3000 });
  const look = TIER[tier];
  const path = useMemo(() => Skia.Path.MakeFromSVGString(SHIELD), []);
  const line = useMemo(() => Skia.Path.MakeFromSVGString(`M 26 ${H * 0.36 + 70} L ${W - 26} ${H * 0.36 + 70}`), []);
  if (!ok || !path) {
    return <View style={{ position: "absolute", left: 4, top: 4, right: 4, bottom: 30, borderRadius: 18, borderWidth: 3, borderColor: look.edge, backgroundImage: `linear-gradient(135deg, ${look.stops.join(", ")})` } as ViewStyle} />;
  }
  return (
    <Canvas style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>
      <Path path={path}>
        <LinearGradient start={vec(0, 0)} end={vec(W, H)} colors={look.stops} positions={[0, 0.5, 1]} />
      </Path>
      <Path path={path}>
        <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={[`rgba(255,255,255,${tier === "special" ? 0.18 : 0.5})`, "rgba(255,255,255,0)"]} positions={[0, 0.45]} />
      </Path>
      <Path path={path} style="stroke" strokeWidth={3} color={look.edge} />
      {line && <Path path={line} style="stroke" strokeWidth={1} color={look.line} />}
    </Canvas>
  );
}
