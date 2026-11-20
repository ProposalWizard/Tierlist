/**
 * KICKABOUT — components/star/PhoneHome.tsx Kickabout: Infinite Highlights on
 * your phone. The real match, one random chance after another
 * (lib/star/gallerySim.ts nextHighlight → buildSimScenario, the switched-off
 * kinds left out), with a running score of goals over chances.
 *
 * The website mounts EnginePlay (a test career at the Play Area's dials, with
 * the real squads); the phone plays it on its EngineFeature (the one match
 * driver) at the same dials (lib/star/playArea.ts: power, technique, the
 * keeper's strength, the run-ups), in the role colours. Not here: the test
 * career's real squads (names and faces on the men).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SCENARIO_KINDS, type Scenario } from "@/lib/star/canvasEngine";
import { withoutSwitchedOff } from "@/lib/star/switchedOffKinds";
import { nextHighlight, newSimMemory, buildSimScenario, pictureKey } from "@/lib/star/gallerySim";
import { mulberry32 } from "@/lib/star/season";
import { loadPlaySettings, sanitizePlaySettings } from "@/lib/star/playArea";
import type { ChanceResolved } from "../match/setup";
import { EngineFeature } from "./MatchFeature";
import { usePitchHeight } from "./MatchStages";
import { C } from "../ui/theme";

/** CanvasMatch's sandbox session: six chances, then the summary (its PostMatch "Training Session"). */
const SESSION = 6;

export function Kickabout({ height: given, onReplays }: { height?: number; onReplays?: () => void }) {
  const fit = usePitchHeight();
  const height = given ?? Math.round(fit * 0.92);
  const stream = useRef<{ rng: () => number; mem: ReturnType<typeof newSimMemory>; last?: string } | null>(null);
  if (!stream.current) stream.current = { rng: mulberry32((Date.now() & 0xffff) + 7), mem: newSimMemory() };
  const kinds = useMemo(() => withoutSwitchedOff(SCENARIO_KINDS), []);
  const s = useMemo(() => sanitizePlaySettings(loadPlaySettings()), []);
  const openOn = useCallback((): Scenario => {
    const st = stream.current!;
    const spec = nextHighlight(kinds, st.rng, st.mem, st.last);
    const sc = buildSimScenario(spec ?? ({ kind: "one_on_one", seed: 1 } as never));
    st.last = pictureKey(sc);
    return sc;
  }, [kinds]);
  const [score, setScore] = useState({ goals: 0, chances: 0 });
  // CanvasMatch with no fixture (sandbox mode): after SESSION chances the session's summary, then Continue starts the next one.
  const [session, setSession] = useState(0);
  const [summary, setSummary] = useState<{ goals: number } | null>(null);
  const inSession = useRef({ goals: 0, chances: 0 });
  const onResolved = useCallback((r: ChanceResolved) => {
    setScore((x) => ({ goals: x.goals + (r.outcome === "goal" ? 1 : 0), chances: x.chances + 1 }));
    const s = inSession.current;
    s.goals += r.outcome === "goal" ? 1 : 0; s.chances += 1;
    if (s.chances >= SESSION) setTimeout(() => setSummary({ goals: s.goals }), 1800);
  }, []);
  const next = () => { inSession.current = { goals: 0, chances: 0 }; setSummary(null); setSession((n) => n + 1); };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6 }}>
        {onReplays ? (
          <Pressable onPress={onReplays} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: C.text, fontSize: 11, fontWeight: "900" }}>▶ Goal replays</Text>
          </Pressable>
        ) : <View />}
        <Text style={{ color: "#d1fae5", fontSize: 11, fontWeight: "900", backgroundColor: "rgba(16,185,129,0.25)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, overflow: "hidden" }}>⚽ {score.goals} / {score.chances}</Text>
      </View>
      <View style={{ height }}>
        <EngineFeature key={session} coachFirst={session === 0} height={height} openOn={openOn} onChanceResolved={onResolved}
          skills={{ power: s.power, technique: s.technique }} keeperStrength={s.keeperStrength}
          penaltyRunup={s.penaltyRunup} freeKickRunup={s.freeKickRunup} seed={(Date.now() & 0xffff) + 1 + session} />
        {summary && (
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(3,7,18,0.92)", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Text style={{ color: C.gold, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>TRAINING SESSION</Text>
            <Text style={{ color: C.text, fontSize: 40, fontWeight: "900" }}>{summary.goals} / {SESSION}</Text>
            <Text style={{ color: C.dim, fontWeight: "700" }}>goals from {SESSION} chances</Text>
            <Pressable onPress={next} style={{ marginTop: 8, backgroundColor: C.green, borderRadius: 99, paddingHorizontal: 26, paddingVertical: 12 }}>
              <Text style={{ color: "#05261a", fontWeight: "900" }}>Continue</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
