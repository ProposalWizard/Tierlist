// ART AREA: the drawing test screen ("art-test") and the two face editors
// ("face-editor", "fake-face-editor": draw/FaceEditors.tsx; Settings opens
// them only while photo faces are on, as the website; art-test always). Shows the website's own
// drawings (lib/star) drawn on the phone through src/draw: player heads,
// your player, club badges, and the test pictures that tools/draw-check.ts
// compares with a real browser. Open it with nav.go("art-test").
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Skia } from "@shopify/react-native-skia";
import type { ScreenMap } from "./types";
import { useCareer } from "../game/store";
import { startCareer } from "../game/newCareer";
import { useNav } from "../nav";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";
import { kitsOf } from "@/lib/star/kits";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import type { FittedHead } from "@/lib/star/faceFit";
import { PlayerHead } from "../draw/PlayerHead";
import { PlayerFigure, fittedHead } from "../draw/PlayerFigure";
import { ClubBadge } from "../draw/ClubBadge";
import { Drawn, phoneFontFor } from "../draw/useDrawing";
import { OffscreenCanvas2D } from "../draw/offscreen";
import { SCENES } from "../draw/testScenes";
import { FaceEditor, FakeFaceEditor } from "../draw/FaceEditors";

const CLUBS = ["Arsenal", "Manchester United", "Liverpool", "Chelsea", "Tottenham Hotspur", "Newcastle United",
  "Hampton & Richmond Borough", "Barnet", "Wrexham", "Sunderland", "England", "Brazil"];
const PEOPLE: [string, string][] = [["p-101", "Arsenal"], ["p-202", "Manchester United"], ["Jordan Smith", "Hampton & Richmond Borough"],
  ["Ali Khan", "Liverpool"], ["Sam Ode", "Chelsea"], ["Leo Park", "Newcastle United"], ["Mo Diallo", "Barnet"], ["Kit Shaw", "Wrexham"]];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.panel, borderRadius: R.card, padding: 14, borderWidth: 1, borderColor: C.line }}>
      <Text style={{ color: C.gold, fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 10 }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>{children}</View>
    </View>
  );
}
const Label = ({ t }: { t: string }) => <Text style={{ color: C.dim, fontSize: 10, textAlign: "center", marginTop: 2 }}>{t}</Text>;

function ArtTest() {
  const nav = useNav();
  const saved = useCareer();
  const [career] = useState(() => saved ?? startCareer("Sam", "Carter"));
  const [fitted, setFitted] = useState<FittedHead | null>(null);
  useEffect(() => { let alive = true; fittedHead(DEFAULT_FAKE_FACE).then((f) => { if (alive) setFitted(f); }); return () => { alive = false; }; }, []);
  const env = { fitted, layer: (w: number, h: number) => new OffscreenCanvas2D(Skia, w, h, phoneFontFor) as unknown as HTMLCanvasElement };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "900" }}>DRAWING TEST</Text>
        <Press onPress={() => nav.back()} style={{ backgroundColor: C.panel2, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ color: C.text, fontWeight: "800" }}>Back</Text>
        </Press>
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }}>
        <Section title="FACE EDITORS">
          <Press onPress={() => nav.go("face-editor")} style={{ backgroundColor: C.panel2, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: C.text, fontWeight: "800" }}>Real Photos →</Text></Press>
          <Press onPress={() => nav.go("fake-face-editor")} style={{ backgroundColor: C.panel2, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: C.text, fontWeight: "800" }}>Fake Faces →</Text></Press>
        </Section>
        <Section title="PLAYER HEADS (TEAM SHEETS)">
          {PEOPLE.map(([id, club]) => {
            const k = kitsOf(club).home;
            return <View key={id}><PlayerHead id={id} shirt={k.shirt} shorts={k.trim} trim={k.trim} size={56} /><Label t={id} /></View>;
          })}
        </Section>
        <Section title={`YOUR PLAYER (${career.player.club})`}>
          <View><PlayerFigure career={career} width={110} height={170} /><Label t="A2" /></View>
          <View><PlayerFigure career={career} width={110} height={170} celebrate /><Label t="win" /></View>
          <View><PlayerFigure career={career} width={110} height={170} view="back" /><Label t="back" /></View>
          <View><PlayerFigure career={career} width={110} height={170} look="A1" /><Label t="A1" /></View>
        </Section>
        <Section title="CLUB BADGES">
          {CLUBS.map((c) => <View key={c} style={{ alignItems: "center", width: 60 }}><ClubBadge club={c} size={40} /><Label t={c.split(" ")[0]} /></View>)}
        </Section>
        <Section title={`TEST PICTURES (face fit: ${fitted ? "ready" : "loading"})`}>
          {SCENES.map((s) => {
            const k = s.dpr ?? 1;
            return (
              <View key={s.name + (fitted ? "f" : "")}>
                <Drawn width={s.w / k} height={s.h / k} draw={(ctx) => s.draw(ctx, env)} deps={[s.name, fitted]}
                  {...(k !== 1 ? { rawPixels: true, pixelRatio: k } : {})} />
                <Label t={s.name} />
              </View>
            );
          })}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function FaceEditorScreen() {
  const nav = useNav();
  const saved = useCareer();
  const [career] = useState(() => saved ?? startCareer("Sam", "Carter"));
  return <FaceEditor career={career} onBack={() => nav.back()} />;
}
function FakeFaceEditorScreen() {
  const nav = useNav();
  const saved = useCareer();
  const [career] = useState(() => saved ?? startCareer("Sam", "Carter"));
  return <FakeFaceEditor career={career} onBack={() => nav.back()} />;
}

export const artScreens: ScreenMap = { "art-test": ArtTest, "face-editor": FaceEditorScreen, "fake-face-editor": FakeFaceEditorScreen };
