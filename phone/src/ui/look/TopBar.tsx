/**
 * THE WEBSITE'S TOP BAR (ui/GameBar.tsx + ui/TopHud.tsx, glass skin):
 *   row 1: your name (Anton), AGE pill, ★ money pill, "?" and ⚙;
 *   row 2: the star badge (fills with your way through the level, the level on
 *   it) standing on a gold bar, and the lightning bolt on the energy bar.
 *
 *   <TopBar career={career} onHelp={…} onSettings={…} onStarPass={…} />
 *   <TopBar career={career} left="happiness" | "reputation" />   (Relations / Style, TopHud HUD_SPEC)
 *
 * Under the phone's status bar (it pads itself by the safe area). A frosted
 * blue band with rounded bottom corners; no blur, no animation.
 */
import { Image, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import { starStatus } from "@/lib/star/starPoints";
import { formatWallet } from "@/lib/star/money";
import { happinessOf } from "@/lib/star/relationships";
import { claimableLevels } from "@/lib/star/starPassClaim";
import { DEFAULT_PASS_LEVELS } from "@/lib/star/rewardCatalogue";
import { hasSeen } from "@/lib/star/unlocks";
import { Press } from "../Press";
import { useTourTarget } from "../tour";
import { FONT } from "./fonts";
import { ICON } from "./pictures";
import { Pill } from "./Text";
import { LOOK } from "./tokens";

/** Green / amber / red by level (ui/StatBar.tsx levelColors). */
export function levelColors(v: number): [string, string] {
  return v >= 60 ? ["#34d399", "#a3e635"] : v >= 35 ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"];
}
const GOLD: [string, string] = ["#f59e0b", "#fde047"];

export function TopBar({ career, onHelp, onSettings, onStarPass, left = "star" }: {
  career: CareerState; onHelp?: () => void; onSettings?: () => void; onStarPass?: () => void; left?: "star" | "happiness" | "reputation";
}) {
  const inset = useSafeAreaInsets();
  const p = career.player;
  // Named for the coach tour (ui/tour.tsx), as the website's data-tour names.
  const moneyT = useTourTarget("money"), ratingT = useTourTarget("rating"), energyT = useTourTarget("energy");
  return (
    <View style={{
      paddingTop: inset.top + 6, paddingHorizontal: 10, paddingBottom: 10,
      backgroundImage: `linear-gradient(180deg, ${LOOK.barTop}, ${LOOK.barBottom})`,
      borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
      borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.26)",
      boxShadow: "0px 4px 10px -4px rgba(0,0,0,0.4)",
    } as ViewStyle}>
      {/* row 1 */}
      <View style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flex: 1, color: "#fff", fontFamily: FONT.display, fontSize: 17, letterSpacing: 0.4, textTransform: "uppercase" }}>{`${p.firstName} ${p.lastName}`}</Text>
        <Pill label="Age" value={p.age} />
        <View {...moneyT}><Pill icon={<Text style={{ color: LOOK.amber, fontSize: 12 }}>★</Text>} value={formatWallet(Math.round(career.money))} /></View>
        {onHelp ? <SquareBtn onPress={onHelp}><Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>?</Text></SquareBtn> : <View style={{ width: 32 }} />}
        <SquareBtn onPress={onSettings}><Text style={{ color: "#fff", fontSize: 17 }}>⚙</Text></SquareBtn>
      </View>
      {/* row 2: rating | energy */}
      <View style={{ flexDirection: "row", marginTop: 10, height: 36 }}>
        {left === "star" ? <View {...ratingT} style={{ flex: 1 }}><StarCell career={career} onPress={onStarPass} /></View>
          : left === "happiness" ? <Meter value={happinessOf(career)} colors={levelColors(happinessOf(career))} icon={<Text style={{ fontSize: 26 }}>😊</Text>} />
          : <Meter value={career.reputation} colors={["#0ea5e9", "#38bdf8"]} icon={<Image source={ICON.world} style={{ width: 40, height: 40 }} />} />}
        <View {...energyT} style={{ flex: 1 }}><Meter value={career.energy} colors={levelColors(career.energy)} icon={<Image source={ICON.energy} style={{ width: 44, height: 44 }} />} /></View>
      </View>
    </View>
  );
}

function SquareBtn({ onPress, children }: { onPress?: () => void; children: React.ReactNode }) {
  return (
    <Press onPress={onPress} style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
      {children}
    </Press>
  );
}

/** One cell: a round-ended bar, its 3D icon standing on the bar's left end (ui/TopMeter.tsx). */
function Meter({ value, colors, icon, after }: { value: number; colors: [string, string]; icon: React.ReactNode; after?: React.ReactNode }) {
  const v = Math.max(3, Math.min(100, value));
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: 30, paddingRight: 8, gap: 4 }}>
      <Bar value={v} colors={colors} />
      {after}
      <View pointerEvents="none" style={{ position: "absolute", left: 1, bottom: 1, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>{icon}</View>
    </View>
  );
}

/** A glossy round-ended bar: track, gradient fill, a light on its top half. */
export function Bar({ value, colors, height = 16 }: { value: number; colors: [string, string]; height?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.26)", overflow: "hidden" }}>
      <View style={{ width: `${v}%`, height: "100%", borderRadius: height / 2, backgroundImage: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})` } as ViewStyle}>
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: "50%", backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.08))" } as ViewStyle} />
      </View>
    </View>
  );
}

/** The star rating: the star fills with your way through the level, the level number on it. */
function StarCell({ career, onPress }: { career: CareerState; onPress?: () => void }) {
  const st = starStatus(career);
  const pct = Math.max(0, Math.min(100, st.toNext * 100));
  const cell = (
    <Meter value={pct} colors={GOLD} icon={<FillStar fraction={pct / 100} level={st.stars} />}
      after={st.gate ? <Text style={{ fontSize: 10 }}>🔒</Text> : undefined} />
  );
  // A round "!" on the star while a Star Pass reward waits to be claimed (TopHud.tsx RatingCell).
  let waiting = false;
  try { waiting = !!onPress && hasSeen(career, "tutorial") && claimableLevels(career, DEFAULT_PASS_LEVELS, st.stars).length > 0; } catch { waiting = false; }
  const dot = waiting ? (
    <View pointerEvents="none" style={{ position: "absolute", left: 34, top: -6, width: 15, height: 15, borderRadius: 8, alignItems: "center", justifyContent: "center",
      backgroundImage: "radial-gradient(circle at 35% 30%, #fca5a5 0%, #ef4444 45%, #b91c1c 100%)", boxShadow: "0px 0px 0px 1.5px #fff, 0px 0px 8px rgba(239,68,68,0.9)" } as ViewStyle}>
      <Text style={{ color: "#fff", fontSize: 10, lineHeight: 12, fontWeight: "900" }}>!</Text>
    </View>
  ) : null;
  return onPress ? <Press onPress={onPress} style={{ flex: 1 }}>{cell}{dot}</Press> : <View style={{ flex: 1 }}>{cell}</View>;
}

/**
 * The gold star that fills from the bottom (ui/TopMeter.tsx FillStar): the
 * grey star, and the gold one cut at your way through the level (its body
 * runs from 6.6% to 93.4% of the picture's height).
 */
export function FillStar({ fraction, level, size = 44 }: { fraction: number; level?: number; size?: number }) {
  const f = Math.max(0, Math.min(1, fraction));
  const cut = Math.round(size * (0.066 + 0.868 * (1 - f)));
  return (
    <View style={{ width: size, height: size }}>
      <Image source={ICON.starEmpty} style={{ position: "absolute", width: size, height: size }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: cut, bottom: 0, overflow: "hidden" }}>
        <Image source={ICON.starFull} style={{ position: "absolute", top: -cut, width: size, height: size }} />
      </View>
      {level !== undefined && (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingTop: 4 }}>
          <Text style={{ color: "#fff", fontSize: Math.round(size * 0.32), fontWeight: "900", textShadowColor: "#5b3a00", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{level}</Text>
        </View>
      )}
    </View>
  );
}
