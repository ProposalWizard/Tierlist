// The scoreboard and the stats plate above the pitch, in the packed app's look (CanvasMatch's
// career scoreboard: two team bars in their kits with the score in white boxes; the plate:
// competition, goals, assists, pass %, rating, 2D, ⚙, sound).
import { View, Text, Pressable, useWindowDimensions, type ViewStyle } from "react-native";
import { shortClub } from "@/lib/star/media/grammar";
import { competitionAbbrev } from "@/lib/star/competitions";
import { divisionOf } from "@/lib/star/calendar";
import type { MatchKits } from "@/lib/star/kits";
import type { MatchDriver } from "../match/driver";
import { usePrefs, setPref } from "../game/prefs";
import { FONT } from "../ui/look";
import { LineIcon } from "./MatchLook";

/** A crisp black outline round white club names, so they read on a light kit (NAME_OUTLINE). */
const OUTLINE = { textShadowColor: "#000", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 };

export function MatchHud({ d, kits, onGear }: { d: MatchDriver; kits: MatchKits; onGear?: () => void }) {
  const prefs = usePrefs();
  // CanvasMatch statCell: the labels drop to 9 px under 390 px wide (ASSISTS ran into PASS at 360).
  const narrow = useWindowDimensions().width < 390;
  const home = d.setup.fixture.home !== false;
  const us = shortClub(d.setup.career.player.club), them = shortClub(d.setup.fixture.opponent);
  const t = d.tally;
  const passPct = t.passes > 0 ? Math.round((t.passesCompleted / t.passes) * 100) : 0;
  const rating = d.ratingSoFar();
  const comp = d.setup.farewell ? "Farewell" : competitionAbbrev(d.setup.fixture, divisionOf(d.setup.career));
  const bar = (name: string, kit: { shirt: string; trim: string }, right: boolean) => (
    <View style={{ flex: 1, minWidth: 0, justifyContent: "center", paddingHorizontal: 8, paddingVertical: 6, backgroundColor: kit.shirt, borderWidth: 1, borderColor: kit.trim,
      borderTopLeftRadius: right ? 0 : 8, borderBottomLeftRadius: right ? 0 : 8, borderTopRightRadius: right ? 8 : 0, borderBottomRightRadius: right ? 8 : 0 }}>
      <Text numberOfLines={1} style={{ color: "#fff", fontWeight: "900", fontSize: 12, textAlign: right ? "right" : "left", ...OUTLINE }}>{name.toUpperCase()}</Text>
    </View>
  );
  const score = (n: number) => (
    <View style={{ backgroundColor: "#fff", borderRadius: 4, paddingHorizontal: 11, minWidth: 34, alignItems: "center", justifyContent: "center", boxShadow: "0px 1px 3px rgba(0,0,0,0.35)" } as ViewStyle}>
      <Text style={{ color: "#000", fontFamily: FONT.display, fontSize: 22, lineHeight: 30 }}>{n}</Text>
    </View>
  );
  const cell = (label: string, value: string, colour: string) => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4, borderLeftWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ alignSelf: "stretch", textAlign: "center", color: "#fff", fontSize: narrow ? 9 : 10.5, fontWeight: "700", letterSpacing: -0.2 }}>{label}</Text>
      <Text style={{ color: colour, fontSize: 12, fontWeight: "900" }}>{value}</Text>
    </View>
  );
  const chip = (child: React.ReactNode, onPress?: () => void, label?: string) => (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityLabel={label} accessibilityRole={onPress ? "button" : undefined} hitSlop={6} style={{ minWidth: 34, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
      {child}
    </Pressable>
  );
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "stretch", gap: 4, marginBottom: 8 }}>
        {bar(home ? us : them, kits.home, false)}
        {score(home ? d.shownUserScore : d.shownOppScore)}
        {score(home ? d.shownOppScore : d.shownUserScore)}
        {bar(home ? them : us, kits.away, true)}
      </View>
      {/* The plate: in the pitch look gray-950/900 are its deep greens; square corners (pitch scope). */}
      <View style={{ flexDirection: "row", alignItems: "stretch", marginBottom: 8, borderRadius: 2, borderWidth: 1, borderColor: "rgba(6,95,70,0.7)", overflow: "hidden",
        backgroundImage: "linear-gradient(90deg, rgb(12,71,38), rgb(16,82,47), rgb(12,71,38))", boxShadow: "0px 6px 12px rgba(0,0,0,0.25)" } as ViewStyle}>
        <View style={{ paddingHorizontal: 9, justifyContent: "center" }}>
          <Text numberOfLines={1} style={{ color: "rgba(110,231,183,0.9)", fontSize: 11, fontWeight: "900", letterSpacing: 0.9 }}>{comp.toUpperCase()}</Text>
        </View>
        {cell("GOALS", String(t.goals), "#fcd34d")}
        {cell("ASSISTS", String(t.assists), "#6ee7b7")}
        {cell("PASS", `${passPct}%`, "#c4b5fd")}
        {cell("RATING", rating.toFixed(1), "#7dd3fc")}
        {/* No 2D | 3D switch: the packed app's (Match3DLayer `can3d`) is only there when the phone can draw
            the 3D match view; KIB Next draws the match in the one look, so there is no choice to offer. */}
        {chip(<LineIcon kind="gear" />, onGear, "Settings")}
        {chip(<LineIcon kind={prefs.sound ? "sound" : "muted"} />,() => setPref("sound", !prefs.sound), prefs.sound ? "Mute sound" : "Unmute sound")}
      </View>
    </View>
  );
}
