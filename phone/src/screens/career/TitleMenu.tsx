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
import { useMemo, useState } from "react";
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
import { Backdrop, FONT, SlantButton } from "../../ui/look";
import { Btn, ClubCrest, C } from "./kit";
import { HomePlayer } from "../../three/HomePlayer";

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Press onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <Press onPress={() => {}} style={{ backgroundImage: "linear-gradient(180deg, #0f172a, #070b14)", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 34, gap: 10, borderTopWidth: 1, borderColor: C.line } as ViewStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", flex: 1, textTransform: "uppercase" }}>{title}</Text>
            <Press onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.text }}>✕</Text></Press>
          </View>
          {children}
        </Press>
      </Press>
    </Modal>
  );
}

/** With no save yet: a trialist in the game's neutral green (TitleScreen NO_SAVE_PLAYER). */
function useNoSavePlayer(): CareerState {
  return useMemo(() => {
    const p = { firstName: "Your", lastName: "Player", age: 17, club: "", clubBadge: null, position: "ST", nationality: "England", startYear: 2026 } as unknown as StarPlayer;
    return { ...makeIdentity(p), squadNumber: 10 } as CareerState;
  }, []);
}

/** KNOWITBALL on one line, filling the width (TitleScreen Wordmark), the tagline under it. */
function Wordmark({ width, showTrial }: { width: number; showTrial: boolean }) {
  // As tall as the website's (about 0.16 of the width), spaced out to fill 94% of it.
  const size = Math.max(36, Math.min(120, Math.floor(width * 0.175)));
  const spacing = Math.max(0, (width * 0.94 - size * 4.6) / 10);
  const line = (dir: string) => <View style={{ height: 1, width: 32, backgroundImage: `linear-gradient(${dir}, rgba(252,211,77,0), rgba(252,211,77,0.8))` } as ViewStyle} />;
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{
        fontFamily: FONT.display, fontSize: size, lineHeight: Math.round(size * 1.15), color: "#8d949e", fontStyle: "italic", letterSpacing: spacing,
        textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 1,
      }}>KNOWITBALL</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {line("90deg")}
        <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900", letterSpacing: 3.3, textShadowColor: "rgba(251,191,36,0.5)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }}>ROAD TO THE GOLDEN BALL</Text>
        {line("270deg")}
      </View>
      {showTrial && <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 1.3, marginTop: 6, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 } }}>EVERY LEGEND STARTS WITH A TRIAL</Text>}
    </View>
  );
}

const hintTxt = { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "900" as const, textTransform: "uppercase" as const };

export function TitleMenu({ onContinue, onNew, onHall, onTutorial, onSettings }: {
  onContinue: () => void; onNew: () => void; onHall: () => void; onTutorial: () => void; onSettings: () => void;
}) {
  const career = useCareer();
  const standIn = useNoSavePlayer();
  const [sheet, setSheet] = useState<"load" | "credits" | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const { width: W, height: H } = useWindowDimensions();
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
    <View style={{ flex: 1, backgroundColor: "#04100a" }}>
      <Backdrop kind="title" sky={sky} />
      <View style={{ paddingTop: Math.max(44, inset.top + 26), paddingHorizontal: 6 }}>
        <Wordmark width={W - 12} showTrial={!career} />
      </View>
      {/* You, standing on the pitch (TitleScreen's HomePlayer, where="title"), the ball at your feet. */}
      <View pointerEvents="none" style={{ position: "absolute", bottom: H * 0.19, left: -W * 0.13, width: stageW, height: stageH, alignItems: "center", justifyContent: "flex-end" }}>
        <HomePlayer career={career ?? standIn} where="title" height={avH} width={avW} ball />
      </View>

      {/* The menu: slanted tabs, 16 px in from the right edge. */}
      <View style={{ position: "absolute", bottom: H * 0.04, right: 16, width: W * 0.5, gap: 8 }}>
        {career && (
          <SlantButton primary icon="▶" label="Continue" onPress={onContinue}
            hint={club ? (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><ClubCrest club={career.player.club} size={13} /><Text numberOfLines={1} style={hintTxt}>{club}</Text></View>
                <Text style={hintTxt}>{career.retired ? "Retired" : `Season ${career.season}`}</Text>
              </View>
            ) : (career.retired ? "Retired" : "No club yet")}
            badge={<View style={{ backgroundImage: "linear-gradient(180deg, #fef08a, #fbbf24)", paddingHorizontal: 6, paddingVertical: 2 } as ViewStyle}><Text style={{ color: "#030712", fontSize: 13, fontWeight: "900" }}>★{starLevel(career)}</Text></View>} />
        )}
        <SlantButton primary={!career} icon="＋" label="New game" onPress={newGame} />
        <SlantButton icon="▤" label="Load game" onPress={() => setSheet("load")} />
        <SlantButton gold icon="🏛" label="Hall of Fame" onPress={onHall} />
        <SlantButton icon="?" label="Tutorial" onPress={onTutorial} />
        {/* page.tsx always passes onSettings: Settings is there before any career too. */}
        <SlantButton icon="⚙" label="Settings" onPress={onSettings} />
        <Press onPress={() => setSheet("credits")} style={{ alignSelf: "flex-end", paddingRight: 12, paddingVertical: 4 }}>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "900", letterSpacing: 1.9, textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } }}>CREDITS</Text>
        </Press>
      </View>

      {sheet === "load" && (
        <Sheet title="Load Game" onClose={() => setSheet(null)}>
          {full && <Text style={{ color: "#fde68a", fontWeight: "700", fontSize: 12 }}>All {slots.length} saves are in use. Delete one to start a new game.</Text>}
          {slots.map((s) => s.empty ? (
            <View key={s.slot} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.15)", padding: 12 }}>
              <Text style={{ color: C.dim, fontSize: 20, width: 36, textAlign: "center" }}>＋</Text>
              <View style={{ flex: 1 }}><Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>SAVE {s.slot}</Text><Text style={{ color: C.dim, fontWeight: "700" }}>Empty</Text></View>
              <View style={{ width: 110 }}><Btn small kind="plain" label="New game" onPress={() => { setSheet(null); newInSlot(s.slot); onNew(); }} /></View>
            </View>
          ) : (
            <View key={s.slot} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(14,30,52,0.66)", padding: 12 }}>
              {s.signed && s.club ? <ClubCrest club={s.club} size={36} /> : <Text style={{ fontSize: 22, width: 36, textAlign: "center" }}>⚽</Text>}
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>SAVE {s.slot}{s.slot === active && career ? "  · LAST PLAYED" : ""}{s.retired ? "  · RETIRED" : ""}</Text>
                <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>{s.playerName}</Text>
                <Text numberOfLines={1} style={{ color: C.dim, fontSize: 12 }}>{s.signed ? `${shortClub(s.club ?? "")} · Season ${s.season}` : "No club yet"} · <Text style={{ color: C.gold }}>★{s.stars}</Text></Text>
              </View>
              <View style={{ gap: 6, alignItems: "flex-end" }}>
                <View style={{ width: 70 }}><Btn small label="Play" onPress={() => { setSheet(null); if (loadSlot(s.slot)) onContinue(); }} /></View>
                {armed === s.slot ? (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Press onPress={() => { setArmed(null); deleteSlot(s.slot); }}><Text style={{ color: C.red, fontWeight: "900", fontSize: 11 }}>SURE?</Text></Press>
                    <Press onPress={() => setArmed(null)}><Text style={{ color: C.dim, fontWeight: "900", fontSize: 11 }}>NO</Text></Press>
                  </View>
                ) : <Press onPress={() => setArmed(s.slot)}><Text style={{ color: C.red, fontWeight: "900", fontSize: 11 }}>DELETE</Text></Press>}
              </View>
            </View>
          ))}
        </Sheet>
      )}
      {sheet === "credits" && (
        <Sheet title="Credits" onClose={() => setSheet(null)}>
          <View style={{ alignItems: "center", gap: 6, paddingVertical: 8 }}>
            <Text style={{ color: C.text, fontSize: 30, fontFamily: FONT.display, fontStyle: "italic" }}>KNOWITBALL</Text>
            <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900", letterSpacing: 3 }}>ROAD TO THE GOLDEN BALL</Text>
            <Text style={{ color: C.text, fontWeight: "700", marginTop: 6 }}>Made by Harry, Mikey and Leo</Text>
            <Text style={{ color: C.dim, fontWeight: "700" }}>knowitball.co.uk</Text>
          </View>
          <Btn kind="plain" label="Back" onPress={() => setSheet(null)} />
        </Sheet>
      )}
    </View>
  );
}
