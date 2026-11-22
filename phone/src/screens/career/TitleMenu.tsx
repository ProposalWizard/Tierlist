/**
 * THE TITLE SCREEN (TitleScreen.tsx): Continue, New game, Load game, Hall of
 * Fame, Tutorial, Settings and, small, Credits. Load game is the website's
 * three saves (world/slots.ts); the Hall of Fame is every retired career
 * (world/hall.ts).
 *
 * The website's look (ui/look): the stadium seen from the pitch (day, sunset or
 * night by the next match's kick-off; sunset with no save), KNOWITBALL in big
 * grey Anton, you on the left with the ball (a trialist in the game's green
 * with no save yet), and the menu as slanted tabs stacked on the right.
 * Settings shows with or without a save (page.tsx always passes onSettings).
 */
import { Component, useMemo, useState, type ReactNode } from "react";
import { View, Text, Modal, useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState, StarPlayer } from "@/lib/star/types";
import { shortClub } from "@/lib/star/media/grammar";
import { nextFixtureFor } from "@/lib/star/competitions";
import { homeSkyFor, type HomeSky } from "@/lib/star/kickoff";
import { hasClub } from "@/lib/star/calendar";
import { starLevel } from "@/lib/star/starPoints";
import { makeIdentity } from "@/lib/star/careerFlow";
import { useCareer } from "../../game/store";
import { listSlots, loadSlot, newInSlot, deleteSlot, activeSlot } from "../../world/slots";
import { Press } from "../../ui/Press";
import { Backdrop, FONT, LookButton, SlantButton } from "../../ui/look";
import { ClubCrest } from "./kit";
import { HomePlayer } from "../../three/HomePlayer";

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const inset = useSafeAreaInsets();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Press onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <Press onPress={() => {}} style={{ backgroundImage: "linear-gradient(180deg, #0f172a, #070b14)", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: Math.max(16, inset.bottom), borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)" } as ViewStyle}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 }} />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 18, lineHeight: 24, letterSpacing: 0.45, flex: 1, textTransform: "uppercase" }}>{title}</Text>
            <Press onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>✕</Text></Press>
          </View>
          {children}
        </Press>
      </Press>
    </Modal>
  );
}

/** PressButton size "sm" (the sheet's Play / New game): 11 px capitals, 12 × 6 padding. */
function SheetBtn({ label, onPress, kind = "primary" }: { label: string; onPress: () => void; kind?: "primary" | "navy" }) {
  return (
    <LookButton kind={kind} onPress={onPress} style={{ borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 11, lineHeight: 16, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</Text>
    </LookButton>
  );
}
const pill = (bg: string, ink: string) => ({ backgroundColor: bg, color: ink, fontSize: 8.5, lineHeight: 12, fontWeight: "900" as const, letterSpacing: 0.85, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, overflow: "hidden" as const, textTransform: "uppercase" as const });

/** With no save yet: a trialist in the game's neutral green (TitleScreen NO_SAVE_PLAYER). */
/** If the title's player picture fails, the title stays up without him instead of closing the app. */
class Quiet extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch(e: unknown) { console.warn("title player", e); }
  render() { return this.state.bad ? null : this.props.children; }
}

function useNoSavePlayer(): CareerState {
  return useMemo(() => {
    const p = { firstName: "Your", lastName: "Player", age: 17, club: "", clubBadge: null, position: "ST", nationality: "England", startYear: 2026 } as unknown as StarPlayer;
    return { ...makeIdentity(p), squadNumber: 10 } as CareerState;
  }, []);
}

/**
 * KNOWITBALL on one line, filling the width (TitleScreen Wordmark), the tagline under it.
 * The website's word is the phone's own heavy italic sans (Roboto Black Italic on Android),
 * tracked in by 0.04 em and sized so it fills 94% of the width: "KNOWITBALL" is 5.644 em
 * wide in Roboto Black Italic with that tracking (measured from the font file: 68 px on a
 * 412-wide phone, what the website's own fit gives in an Android WebView). `adjustsFontSizeToFit` keeps it on one line on a phone
 * whose own font is wider.
 */
const WORD_EM = 5.644;
function Wordmark({ width, showTrial }: { width: number; showTrial: boolean }) {
  const size = Math.max(36, Math.min(120, Math.floor((width * 0.94) / WORD_EM)));
  const line = (dir: string) => <View style={{ height: 1, width: 32, backgroundImage: `linear-gradient(${dir}, rgba(252,211,77,0), rgba(252,211,77,0.8))` } as ViewStyle} />;
  return (
    <View style={{ alignItems: "center" }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{
        width, textAlign: "center", fontSize: size, lineHeight: Math.round(size * 0.9), fontWeight: "900", fontStyle: "italic", letterSpacing: -0.04 * size,
        color: "#8d949e", includeFontPadding: false,
        textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 1,
      }}>KNOWITBALL</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
        {line("90deg")}
        <Text numberOfLines={1} style={{ color: "#fde68a", fontSize: 11, lineHeight: 16.5, fontWeight: "900", letterSpacing: 3.3, textShadowColor: "rgba(251,191,36,0.5)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }}>ROAD TO THE GOLDEN BALL</Text>
        {line("270deg")}
      </View>
      {showTrial && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ maxWidth: width, color: "#fff", fontSize: 13, lineHeight: 19.5, fontWeight: "900", letterSpacing: 1.3, marginTop: 4, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 } }}>EVERY LEGEND STARTS WITH A TRIAL</Text>}
    </View>
  );
}

const hintTxt = { color: "rgba(255,255,255,0.8)", fontSize: 12, lineHeight: 13, fontWeight: "900" as const, letterSpacing: -0.3, textTransform: "uppercase" as const };

export function TitleMenu({ onContinue, onNew, onHall, onTutorial, onSettings }: {
  onContinue: () => void; onNew: () => void; onHall: () => void; onTutorial: () => void; onSettings: () => void;
}) {
  const career = useCareer();
  const standIn = useNoSavePlayer();
  const [sheet, setSheet] = useState<"load" | "credits" | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  // The screen's own measured size (the whole phone, bars hidden, under the camera): the
  // player and the menu are placed in percentages of it, as on the website. The window's
  // size stands in for the first frame.
  const win = useWindowDimensions();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const W = box?.w ?? win.width, H = box?.h ?? win.height;
  const inset = useSafeAreaInsets();
  const slots = sheet === "load" ? listSlots() : [];
  const full = slots.length > 0 && slots.every((s) => !s.empty);
  const active = activeSlot();
  const next = career ? nextFixtureFor(career) : null;
  const sky: HomeSky = career && next ? homeSkyFor(career, next) : "sunset";
  const club = career && hasClub(career) ? shortClub(career.player.club) : null;
  // He stands on the left, on the pitch (TitleScreen: bottom 19%, left -13%, 80% wide, 45% tall).
  const stageW = W * 0.8, stageH = H * 0.45;
  const avH = Math.round(Math.max(150, Math.min(stageH - 4, 560)));
  const avW = Math.round(Math.min(stageW, avH * 0.86));
  const newGame = () => {
    // A save already here: a new game goes in the first empty slot (or asks to free one).
    if (!career) { onNew(); return; }
    const empty = listSlots().find((s) => s.empty);
    if (empty) { newInSlot(empty.slot); onNew(); } else setSheet("load");
  };
  return (
    <View style={{ flex: 1, backgroundColor: "#04100a" }} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (width > 0 && height > 0 && (!box || box.w !== width || box.h !== height)) setBox({ w: width, h: height }); }}>
      <Backdrop kind="title" sky={sky} />
      <View style={{ paddingTop: Math.max(44, inset.top + 26) }}>
        <Wordmark width={W} showTrial={!career} />
      </View>
      {/* You, standing on the pitch (TitleScreen's HomePlayer, where="title"), the ball at your feet. */}
      <View pointerEvents="none" style={{ position: "absolute", bottom: H * 0.19, left: -W * 0.13, width: stageW, height: stageH, alignItems: "center", justifyContent: "flex-end" }}>
        <Quiet><HomePlayer career={career ?? standIn} where="title" height={avH} width={avW} ball /></Quiet>
      </View>

      {/* The menu: slanted tabs, 16 px in from the right edge. */}
      <View style={{ position: "absolute", bottom: H * 0.04, right: 16, width: W * 0.5, gap: 8 }}>
        {career && (
          <SlantButton primary icon="▶" label="Continue" onPress={onContinue}
            hint={club ? (
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><ClubCrest club={career.player.club} size={13} /><Text numberOfLines={1} style={[hintTxt, { flexShrink: 1 }]}>{club}</Text></View>
                <Text numberOfLines={1} style={hintTxt}>{career.retired ? "Retired" : `Season ${career.season}`}</Text>
              </View>
            ) : (career.retired ? "Retired" : "No club yet")}
            badge={<View style={{ backgroundImage: "linear-gradient(180deg, #fef08a, #fbbf24)", paddingHorizontal: 6, paddingVertical: 2 } as ViewStyle}><Text style={{ color: "#030712", fontSize: 13, lineHeight: 13, fontWeight: "900", includeFontPadding: false }}>★{starLevel(career)}</Text></View>} />
        )}
        <SlantButton primary={!career} icon="＋" label="New game" onPress={newGame} />
        <SlantButton icon="▤" label="Load game" onPress={() => setSheet("load")} />
        <SlantButton gold icon="🏛" label="Hall of Fame" onPress={onHall} />
        <SlantButton icon="?" label="Tutorial" onPress={onTutorial} />
        {/* page.tsx always passes onSettings: Settings is there before any career too. */}
        <SlantButton icon="⚙" label="Settings" onPress={onSettings} />
        <Press onPress={() => setSheet("credits")} style={{ alignSelf: "flex-end", paddingRight: 12, paddingTop: 2, paddingBottom: 4 }}>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 18, fontWeight: "900", letterSpacing: 1.9, textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } }}>CREDITS</Text>
        </Press>
      </View>

      {sheet === "load" && (
        <Sheet title="Load Game" onClose={() => setSheet(null)}>
          {full && <Text style={{ color: "#fef3c7", fontWeight: "700", fontSize: 12, lineHeight: 16, backgroundColor: "rgba(251,191,36,0.15)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: "rgba(252,211,77,0.3)", overflow: "hidden" }}>All {slots.length} saves are in use. Delete one to start a new game.</Text>}
          <View style={{ gap: 8 }}>
          {slots.map((s) => s.empty ? (
            <View key={s.slot} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 18 }}>＋</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 2 }}>SAVE {s.slot}</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 19, fontWeight: "700" }}>Empty</Text>
              </View>
              <SheetBtn kind="navy" label="New game" onPress={() => { setSheet(null); newInSlot(s.slot); onNew(); }} />
            </View>
          ) : (
            <View key={s.slot} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(14,30,52,0.66)", paddingHorizontal: 12, paddingVertical: 10 }}>
              <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                {s.signed && s.club ? <ClubCrest club={s.club} size={36} /> : <Text style={{ fontSize: 20 }}>⚽</Text>}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 2 }}>SAVE {s.slot}</Text>
                  {s.slot === active && career ? <Text numberOfLines={1} style={pill("rgba(52,211,153,0.2)", "#a7f3d0")}>Last played</Text> : null}
                  {s.retired ? <Text numberOfLines={1} style={pill("rgba(251,191,36,0.2)", "#fde68a")}>Retired</Text> : null}
                </View>
                <Text numberOfLines={1} style={{ color: "#fff", fontWeight: "900", fontSize: 14, lineHeight: 21 }}>{s.playerName}</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, lineHeight: 16.5, fontWeight: "700" }}>{s.signed ? `${shortClub(s.club ?? "")} · Season ${s.season}` : "No club yet"} · <Text style={{ color: "#fcd34d" }}>★{s.stars}</Text></Text>
              </View>
              <View style={{ gap: 4, alignItems: "stretch" }}>
                <SheetBtn label="Play" onPress={() => { setSheet(null); if (loadSlot(s.slot)) onContinue(); }} />
                {armed === s.slot ? (
                  <View style={{ flexDirection: "row", gap: 4, justifyContent: "center" }}>
                    <Press onPress={() => { setArmed(null); deleteSlot(s.slot); }} style={{ backgroundColor: "#dc2626", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: "#fff", fontWeight: "900", fontSize: 10, lineHeight: 15 }}>SURE?</Text></Press>
                    <Press onPress={() => setArmed(null)} style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: "#fff", fontWeight: "900", fontSize: 10, lineHeight: 15 }}>NO</Text></Press>
                  </View>
                ) : <Press onPress={() => setArmed(s.slot)} style={{ alignItems: "center" }}><Text style={{ color: "#fca5a5", fontWeight: "900", fontSize: 10, lineHeight: 15, letterSpacing: 0.5 }}>DELETE</Text></Press>}
              </View>
            </View>
          ))}
          </View>
        </Sheet>
      )}
      {sheet === "credits" && (
        <Sheet title="Credits" onClose={() => setSheet(null)}>
          <View style={{ alignItems: "center", gap: 12 }}>
            <Text numberOfLines={1} style={{ color: "#e8edf3", fontSize: 26, lineHeight: 39, fontWeight: "900", fontStyle: "italic", letterSpacing: -0.65 }}>KNOWITBALL</Text>
            <Text numberOfLines={1} style={{ color: "#fde68a", fontSize: 11, lineHeight: 16.5, fontWeight: "900", letterSpacing: 2.75 }}>ROAD TO THE GOLDEN BALL</Text>
            <View style={{ alignItems: "center", gap: 4 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 19.5, fontWeight: "700" }}>Made by Harry, Mikey and Leo</Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 19.5, fontWeight: "700" }}>knowitball.co.uk</Text>
            </View>
            <LookButton kind="navy" onPress={() => setSheet(null)} style={{ alignSelf: "stretch", borderRadius: 12, paddingVertical: 10 }}>
              <Text style={{ color: "#fff", fontSize: 13, lineHeight: 19.5, fontWeight: "900", letterSpacing: 0.3 }}>BACK</Text>
            </LookButton>
          </View>
        </Sheet>
      )}
    </View>
  );
}
