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
  const onResolved = useCallback((r: ChanceResolved) => {
    setScore((x) => ({ goals: x.goals + (r.outcome === "goal" ? 1 : 0), chances: x.chances + 1 }));
  }, []);
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
      <EngineFeature height={height} openOn={openOn} onChanceResolved={onResolved}
        skills={{ power: s.power, technique: s.technique }} keeperStrength={s.keeperStrength}
        penaltyRunup={s.penaltyRunup} freeKickRunup={s.freeKickRunup} seed={(Date.now() & 0xffff) + 1} />
    </View>
  );
}
