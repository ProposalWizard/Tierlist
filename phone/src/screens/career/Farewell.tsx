/**
 * THE END OF A CAREER (page.tsx: farewell-invite, farewell-sheets,
 * farewell-walkout, farewell-match, farewell-result, legacy) and the Hall of
 * Fame (the title screen's door; HallOfFame.tsx).
 *
 * The farewell sides are the game's own (lib/star/farewell.ts farewellSides).
 * The match itself is played on the phone's match (the match area's
 * "farewell-match" screen: CanvasMatch with farewell.offAt), every chance
 * yours, no energy, off at the ovation minute.
 * KICK OFF walks you out through the guard of honour first (page.tsx
 * farewell-walkout; three/Farewell3D.tsx GuardOfHonour), and the standing
 * ovation plays over the match the minute you come off (the match area's
 * farewell-match screen).
 */
import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { FAREWELL_OFF_AT, RIVALS_KITS, type FarewellSides } from "@/lib/star/farewell";
import { testimonialFor, CAREER_SEASONS } from "@/lib/star/retirement";
import { careerOverview } from "@/lib/star/careerOverview";
import { shortNameOf } from "@/lib/star/realSquad";
import { shortClub } from "@/lib/star/media/grammar";
import { formatMoney } from "@/lib/star/money";
import { leoUpdateOn } from "@/lib/star/leoUpdate";
import type { HallEntry } from "@/lib/star/hallOfFame";
import * as flow from "../../game/flow";
import { usePhoneHall, removeFromPhoneHall } from "../../world/hall";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Row, Btn, ClubCrest, Tile, C } from "./kit";
import { GuardOfHonour } from "../../three/Farewell3D";
import { CareerOverviewView } from "./EndScreens";

/** The walk-out (page.tsx farewell-walkout): the guard of honour, then the match. */
export function FarewellWalkoutScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const f = flow.currentFarewell();
  if (!f) return <Frame title="Retired"><Btn label="Continue" onPress={() => go(flow.retireWith())} /></Frame>;
  return <GuardOfHonour career={career} sides={f.sides} onDone={() => go(flow.playFarewell())} />;
}

// ── The Hall of Fame ──
export function HallOfFameScreen({ onBack }: { onBack: () => void }) {
  const book = usePhoneHall();
  const [open, setOpen] = useState<HallEntry | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  if (open) {
    return (
      <CareerOverviewView career={open.career} bar={<View style={{ padding: 10, backgroundColor: "#0b0f17" }}><Btn kind="plain" small label="‹ Back to the Hall of Fame" onPress={() => setOpen(null)} /></View>} />
    );
  }
  return (
    <Frame kicker="Your careers" title="Hall of Fame" onBack={onBack}>
      {book.entries.map((e) => (
        <Press key={e.id} onPress={() => setOpen(e)}>
          <Card tone={e.card.ballonDors ? C.gold : undefined}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ClubCrest club={e.card.mainClub} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{e.card.name}</Text>
                <Text style={{ color: C.gold, fontSize: 12, fontWeight: "800" }}>{e.card.title}</Text>
                <Text style={{ color: C.dim, fontSize: 12 }}>{e.card.position} · {e.card.nation} · {e.card.seasons} seasons from {e.card.firstYear}</Text>
                <Text style={{ color: C.text, fontSize: 12, marginTop: 2 }}>{e.card.apps} apps · {e.card.goals} goals · {e.card.assists} assists · {e.card.trophies} trophies{e.card.ballonDors ? ` · ${e.card.ballonDors} Golden Ball${e.card.ballonDors === 1 ? "" : "s"}` : ""}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6 }}>
              {armed === e.id ? (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Press onPress={() => { setArmed(null); removeFromPhoneHall(e.id); }}><Text style={{ color: C.red, fontWeight: "900", fontSize: 12 }}>SURE?</Text></Press>
                  <Press onPress={() => setArmed(null)}><Text style={{ color: C.dim, fontWeight: "900", fontSize: 12 }}>NO</Text></Press>
                </View>
              ) : <Press onPress={() => setArmed(e.id)}><Text style={{ color: C.red, fontWeight: "900", fontSize: 11 }}>REMOVE</Text></Press>}
            </View>
          </Card>
        </Press>
      ))}
      {book.entries.length < 3 && Array.from({ length: 3 - book.entries.length }, (_, k) => (
        <View key={`empty-${k}`} style={{ height: 78, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
          {k === 0 ? <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "900", fontSize: 12, letterSpacing: 1 }}>RETIRE A CAREER TO FILL THIS</Text> : null}
        </View>
      ))}
    </Frame>
  );
}
