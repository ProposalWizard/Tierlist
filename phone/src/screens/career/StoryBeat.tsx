/**
 * THE FIRST HOUR AS A STORY, on Home (lib/star/story.ts; the website's
 * StoryBeatPop in components/star/UnlockChain.tsx and page.tsx's goBeat).
 * A person brings the next thing in, in their own words, with one button:
 * the team-mate's old boots, the gaffer's "Time to train", the club shop's
 * half-price can, the physio's free can, the team-mate's old phone, the
 * chairman's "Wages are in", the first goal, the Star Pass level, the agent's
 * sponsor offer. No Close: the story moves on only by its button.
 *
 * Also here: the welcome tour on the first Home (energy, then "Your first game
 * is next… Tap Play") and the finger that points where the beat's button sent
 * you (Training, the Phone, your star, the can's USE), as the website does.
 */
import { Image, Modal, Text, View, type ViewStyle } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { ackBeat, beatText, type Beat, type BeatText } from "@/lib/star/story";
import { markSeen } from "@/lib/star/unlocks";
import type { TourStep } from "@/lib/star/tours";
import { getCareer, setCareer } from "../../game/store";
import * as flow from "../../game/flow";
import { LookButton } from "../../ui/look";
import { SHOP_PIC } from "../../ui/look/worldPics";

export function StoryBeatPop({ text, onGo, onTry, tryLabel = "Try it now" }: { text: BeatText; onGo: () => void;
  /** A second button that lets you try the new thing at once ("Try a header now"). */
  onTry?: () => void; tryLabel?: string }) {
  const pic = text.boot ? SHOP_PIC[(text.boot.pic.match(/items\/(.+)\.webp$/)?.[1]) ?? ""] : undefined;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <View style={{ width: "100%", maxWidth: 340, borderRadius: 24, padding: 16, backgroundImage: "linear-gradient(180deg, #1f2937, #0b1220)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.12), 0px 20px 50px -10px rgba(0,0,0,0.9)" } as ViewStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
              <Text style={{ fontSize: 26 }}>{text.icon}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>{text.who.toUpperCase()}</Text>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 24 }}>{text.title}</Text>
            </View>
          </View>
          {!!text.line && (
            <View style={{ marginTop: 12, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 19 }}>{text.line}</Text>
            </View>
          )}
          {text.boot && (
            <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: "rgba(252,211,77,0.4)", backgroundImage: "linear-gradient(180deg, rgba(251,191,36,0.2), rgba(245,158,11,0.05))" } as ViewStyle}>
              {pic ? <Image source={pic} resizeMode="contain" style={{ width: 96, height: 80 }} /> : <Text style={{ fontSize: 48, width: 96, textAlign: "center" }}>👟</Text>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{text.boot.name}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {text.boot.stats.map((st) => (
                    <View key={st} style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(16,185,129,0.25)", borderWidth: 1, borderColor: "rgba(52,211,153,0.5)" }}>
                      <Text style={{ color: "#d1fae5", fontSize: 12, fontWeight: "900" }}>{st}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: "#fde68a", fontSize: 12, fontWeight: "900", marginTop: 4 }}>{text.boot.games} games left</Text>
              </View>
            </View>
          )}
          {onTry && <LookButton label={tryLabel} onPress={onTry} style={{ marginTop: 12, borderRadius: 16, paddingVertical: 11 }} />}
          <LookButton kind={onTry ? "navy" : "primary"} label={text.button} onPress={onGo} style={{ marginTop: onTry ? 8 : 12, borderRadius: 16, paddingVertical: 11 }} />
        </View>
      </View>
    </Modal>
  );
}

/** The beat's button was pressed (page.tsx goBeat): mark it, hand over what it gives,
 *  and say where to go next. Returns a tour target to point at, a screen to open, or nothing. */
export function goBeat(b: Beat): { point?: string; screen?: string; params?: Record<string, unknown> } {
  const c = getCareer();
  if (!c) return {};
  const next = ackBeat(c, b);
  setCareer(next);
  flow.settle();
  // The gaffer wants a word: his talk opens (page.tsx: handleOpenRelationshipGame("boss")).
  if (b === "boss") return { screen: "career-relationship-game", params: { kind: "boss" } };
  if (b === "training") return { point: "nav-training" };
  if (b === "starpass") return { point: "rating" };
  // A can you can drink now: the finger shows where; at full energy there is nothing to drink it for.
  if ((b === "can" || b === "candeal") && (next.energy ?? 100) < 100) return { point: "can-use-basic" };
  if (b === "phone") return { point: "nav-phone" };
  if (b === "shop") return { screen: "shop" };
  // "Got it", then the finger on the words that lead to your card (page.tsx: target "tab-0").
  if (b === "stats") return { point: "tab-0" };
  // The offer is in your messages: the phone, then the finger on Messages, then on the offer.
  if (b === "sponsor") return { screen: "phone", params: { tour: "sponsor" } };
  void markSeen;
  return {};
}

export function beatTextFor(c: CareerState, b: Beat): BeatText { return beatText(c, b); }

/** A tour's last step was done: mark these keys seen (page.tsx `seen(...)`). */
export function markTourSeen(...keys: string[]) {
  const c = getCareer();
  if (c) setCareer(keys.reduce((acc, k) => markSeen(acc, k), c));
}

/** A single wordless pointer step: the finger and the glow say it (Mikey, 24 Oct 2026). */
export const pointStep = (target: string): TourStep[] => [{ target, text: "", press: true }];
