/**
 * THE TITLE SCREEN (TitleScreen.tsx): Continue, New game, Load game, Hall of
 * Fame, Tutorial, Settings and, small, Credits. Load game is the website's
 * three saves (world/slots.ts); the Hall of Fame is every retired career
 * (world/hall.ts).
 */
import { useState } from "react";
import { View, Text, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { shortClub } from "@/lib/star/media/grammar";
import { useCareer } from "../../game/store";
import { listSlots, loadSlot, newInSlot, deleteSlot, activeSlot } from "../../world/slots";
import { usePhoneHall } from "../../world/hall";
import { Press } from "../../ui/Press";
import { Btn, ClubCrest, C, R } from "./kit";

function MenuButton({ icon, label, onPress, primary, gold, disabled }: { icon: string; label: string; onPress: () => void; primary?: boolean; gold?: boolean; disabled?: boolean }) {
  return (
    <Press disabled={disabled} onPress={onPress} style={{
      flexDirection: "row", alignItems: "center", gap: 14, borderRadius: R.card, paddingVertical: primary ? 18 : 14, paddingHorizontal: 18,
      backgroundColor: primary ? C.green : gold ? "rgba(245,197,66,0.14)" : C.panel2, borderWidth: 1, borderColor: gold ? C.gold : C.line,
    }}>
      <Text style={{ fontSize: primary ? 22 : 18, color: primary ? "#05261a" : gold ? C.gold : C.text, width: 26, textAlign: "center" }}>{icon}</Text>
      <Text style={{ color: primary ? "#05261a" : gold ? C.gold : C.text, fontSize: primary ? 22 : 18, fontWeight: "900" }}>{label.toUpperCase()}</Text>
    </Press>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Press onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <Press onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 34, gap: 10, borderWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", flex: 1 }}>{title}</Text>
            <Press onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.text }}>✕</Text></Press>
          </View>
          {children}
        </Press>
      </Press>
    </Modal>
  );
}

export function TitleMenu({ onContinue, onNew, onHall, onTutorial, onSettings }: {
  onContinue: () => void; onNew: () => void; onHall: () => void; onTutorial: () => void; onSettings: () => void;
}) {
  const career = useCareer();
  const hall = usePhoneHall();
  const [sheet, setSheet] = useState<"load" | "credits" | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const slots = sheet === "load" ? listSlots() : [];
  const full = slots.length > 0 && slots.every((s) => !s.empty);
  const active = activeSlot();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: "space-between" }}>
      <View style={{ marginTop: 50, alignItems: "center" }}>
        <Text style={{ color: C.text, fontSize: 46, fontWeight: "900", fontStyle: "italic", letterSpacing: -1 }}>KNOWITBALL</Text>
        <Text style={{ color: C.gold, fontSize: 14, fontWeight: "800", letterSpacing: 4, marginTop: 6 }}>ROAD TO THE GOLDEN BALL</Text>
      </View>
      <View style={{ gap: 10, marginBottom: 10 }}>
        {career && <MenuButton primary icon="▶" label="Continue" onPress={onContinue} />}
        <MenuButton primary={!career} icon="＋" label="New game" onPress={() => {
          // A save already here: a new game goes in the first empty slot (or asks to free one).
          if (!career) { onNew(); return; }
          const empty = listSlots().find((s) => s.empty);
          if (empty) { newInSlot(empty.slot); onNew(); } else setSheet("load");
        }} />
        <MenuButton icon="▤" label="Load game" onPress={() => setSheet("load")} />
        {hall.entries.length > 0 && <MenuButton gold icon="🏛" label="Hall of Fame" onPress={onHall} />}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><MenuButton icon="?" label="Tutorial" onPress={onTutorial} /></View>
          <View style={{ flex: 1 }}><MenuButton icon="⚙" label="Settings" onPress={onSettings} disabled={!career} /></View>
        </View>
        <Press onPress={() => setSheet("credits")} style={{ alignItems: "center", paddingVertical: 6 }}>
          <Text style={{ color: C.dim, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>CREDITS</Text>
        </Press>
      </View>

      {sheet === "load" && (
        <Sheet title="Load Game" onClose={() => setSheet(null)}>
          {full && <Text style={{ color: "#fde68a", fontWeight: "700", fontSize: 12 }}>All {slots.length} saves are in use. Delete one to start a new game.</Text>}
          {slots.map((s) => s.empty ? (
            <View key={s.slot} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: C.line, padding: 12 }}>
              <Text style={{ color: C.dim, fontSize: 20, width: 36, textAlign: "center" }}>＋</Text>
              <View style={{ flex: 1 }}><Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>SAVE {s.slot}</Text><Text style={{ color: C.dim, fontWeight: "700" }}>Empty</Text></View>
              <View style={{ width: 110 }}><Btn small kind="plain" label="New game" onPress={() => { setSheet(null); newInSlot(s.slot); onNew(); }} /></View>
            </View>
          ) : (
            <View key={s.slot} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, padding: 12 }}>
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
            <Text style={{ color: C.text, fontSize: 26, fontWeight: "900", fontStyle: "italic" }}>KNOWITBALL</Text>
            <Text style={{ color: C.gold, fontSize: 11, fontWeight: "900", letterSpacing: 3 }}>ROAD TO THE GOLDEN BALL</Text>
            <Text style={{ color: C.text, fontWeight: "700", marginTop: 6 }}>Made by Harry, Mikey and Leo</Text>
            <Text style={{ color: C.dim, fontWeight: "700" }}>knowitball.co.uk</Text>
          </View>
          <Btn kind="plain" label="Back" onPress={() => setSheet(null)} />
        </Sheet>
      )}
    </SafeAreaView>
  );
}
