/**
 * THE MANAGER'S OFFICE, IN 3D (the website's components/star/Office3D.tsx and ManagerMoments.tsx `OfficeMoment` on the phone).
 *
 * A stage for the talks with your manager: the signing's room (the website's lib/star/signing3dScene.ts, `stage: "office"`,
 * not touched) with no contract on the desk. He sits behind his desk, you sit across it, and whoever is speaking is the
 * shot: over your shoulder at him when he talks, over his at you when you do. It is only a stage: the words and the choices
 * stay with the screen that mounts it, and when the phone cannot run 3D (the crash guard has it off, the GL is refused) the
 * stage calls `onFail` and the screen carries on with the plain card it had before.
 *
 * It draws only while it is on screen and the app is in front (../../three/Walk3D.tsx), takes no touches (the screen's own
 * buttons and scrolling are not in its way) and is a small picture, so it is light.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { usePrefs } from "../../game/prefs";
import { Walk3D } from "../../three/Walk3D";
import { loadSigningStart, type SigningCallbacks, type SigningData, type SigningWalk } from "../../three/signingScene";
import { officeData } from "../../three/signingData";
import { LookButton } from "../../ui/look";

export type OfficeSpeaker = "boss" | "you" | null;

/** The office with your career's look: your skin, hair, kit, accessories and aviators; the camera follows whoever speaks. */
export function OfficeStage(p: {
  career: CareerState; speaker: OfficeSpeaker; onFail: () => void; style?: StyleProp<ViewStyle>;
}) {
  // Settings → Live 3D scenes is OFF by default: then no stage is made (nothing touches Walk3D or the GL) and the screen is told, as for any failed start.
  const live = usePrefs().live3dScenes;
  const failRef0 = useRef(p.onFail);
  failRef0.current = p.onFail;
  useEffect(() => { if (!live) failRef0.current(); }, [live]);
  return live ? <OfficeStageLive {...p} /> : null;
}

function OfficeStageLive({ career, speaker, onFail, style }: {
  career: CareerState; speaker: OfficeSpeaker; onFail: () => void; style?: StyleProp<ViewStyle>;
}) {
  const prefs = usePrefs();
  // built once: the look does not change under a talk
  const data = useMemo(() => officeData(career), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [ready, setReady] = useState(false);
  const ctrl = useRef<SigningWalk | null>(null);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const apply = (c: SigningWalk, who: OfficeSpeaker) => { c.setShot(who === "you" ? "reply" : "talk"); c.setTalking(who); };
  // The camera follows whoever is talking.
  useEffect(() => { if (ctrl.current && ready) apply(ctrl.current, speaker); }, [speaker, ready]);
  return (
    <View style={[{ overflow: "hidden", backgroundColor: "#1a120c" }, style]}>
      <Walk3D<SigningData, SigningCallbacks, SigningWalk>
        name="The manager's office" cover="#1a120c" load={loadSigningStart} data={data} callbacks={() => ({})}
        onBack={() => failRef.current()} onFail={() => failRef.current()} inert showSpeed={prefs.show3dSpeed}
        onController={(c) => { ctrl.current = c; if (Platform.OS === "web") (globalThis as unknown as { __office3d?: SigningWalk | null }).__office3d = c; if (c) { apply(c, speaker); setReady(true); } else setReady(false); }} />
      {!ready && (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "800" }}>Knocking on his door…</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The office, his words in a box, and one Continue (ManagerMoments.tsx OfficeMoment). `plain` = the same words and button with
 * no 3D (a phone that cannot run it); the 3D stage that fails turns itself into the plain card.
 */
export function OfficeMoment({ career, title, text, onContinue, continueLabel = "CONTINUE →", plain = false, onFail }: {
  career: CareerState; title: string; text: string; onContinue: () => void; continueLabel?: string; plain?: boolean;
  /** The 3D could not start: told to the screen, which may show something else (the dugout banner) instead of the plain card. */
  onFail?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const live = usePrefs().live3dScenes;
  const boss = career.manager?.name ?? "The manager";
  const flat = plain || failed || !live;
  // off: the old plain card, and the screen is told as for a failed start (the dugout goes back to its banner)
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;
  useEffect(() => { if (!live && !plain) onFailRef.current?.(); }, [live, plain]);
  const stageH = Math.round(useWindowDimensions().height * 0.46); // the website's 46vh
  return (
    <View style={{ flex: 1, backgroundColor: "#0b1220", justifyContent: flat ? "center" : "flex-start", paddingHorizontal: 12, paddingBottom: 24, paddingTop: 12 }}>
      <View style={{ width: "100%", maxWidth: 384, alignSelf: "center" }}>
        <Text style={{ color: "#93c5fd", fontSize: 18, fontWeight: "900", letterSpacing: 0.5, textAlign: "right", marginBottom: 8 }}>{title.toUpperCase()}</Text>
        {!flat && <OfficeStage career={career} speaker="boss" onFail={() => { setFailed(true); onFail?.(); }} style={{ width: "100%", height: stageH, borderRadius: 4, marginBottom: 12 }} />}
        <View style={{ backgroundColor: "#334155", borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 }}>{boss.toUpperCase()}</Text>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", lineHeight: 21 }}>{text}</Text>
        </View>
        <LookButton onPress={onContinue} style={{ marginTop: 12, borderRadius: 4, paddingVertical: 12 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{continueLabel}</Text>
        </LookButton>
      </View>
    </View>
  );
}
