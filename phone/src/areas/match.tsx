// MATCH AREA: everything played on the pitch.
import { useCallback, useMemo } from "react";
import { View, Text } from "react-native";
import type { ScreenMap } from "./types";
import { Match } from "../screens/Match";
import { GoalReplays } from "../screens/MatchReplays";
import { useCareer } from "../game/store";
import { nextFixture, completeMatch, currentFarewell, farewellMatchDone } from "../game/flow";
import type { MatchSetup } from "../match/setup";
import { conditionsFor } from "@/lib/star/weather";
import { careerPenaltyRunup, careerFreeKickRunup } from "@/lib/star/runupStyles";
import { FAREWELL_OFF_AT, farewellDuties, farewellSeed } from "@/lib/star/farewell";
import { useNav } from "../nav";
import type { MatchDriver } from "../match/driver";
import { C } from "../ui/theme";

function MatchScreen() {
  const career = useCareer();
  const nav = useNav();
  // The fixture is read once, when the match opens: the career changing under it must not restart it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fixture = useMemo(() => nextFixture(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startCareer = useMemo(() => career, []);
  // The contract with the career area: full time hands the match's stats over, then the post-match screen.
  const onFullTime = useCallback((d: MatchDriver) => {
    if (d.finalStats) completeMatch(d.finalStats);
    nav.replace("post-match");
  }, [nav]);
  if (!startCareer || !fixture) {
    return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}><Text style={{ color: C.text }}>No match to play.</Text></View>;
  }
  return <Match career={startCareer} fixture={fixture} onFullTime={onFullTime} />;
}
/**
 * THE FAREWELL MATCH (page.tsx farewell-match): CanvasMatch on the farewell's
 * stand-in career and fixture (lib/star/farewell.ts), your boots counting,
 * the rivals' strength, the farewell's duties, seed, weather and pressure,
 * and `farewell.offAt`: every chance yours, no energy, off at the ovation.
 * Full time hands the stats to the career area (flow.farewellMatchDone).
 */
function FarewellMatchScreen() {
  const career = useCareer();
  const nav = useNav();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const f = useMemo(() => currentFarewell(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const start = useMemo(() => career, []);
  const setupFor = useCallback((): MatchSetup => {
    const c = start!, fw = f!;
    const bootLeft = c.currentBoot.matches > 0;
    return {
      career: fw.career,
      fixture: fw.fixture,
      skills: {
        power: Math.min(100, c.skills.power + (bootLeft ? c.currentBoot.power : 0)),
        technique: Math.min(100, c.skills.technique + (bootLeft ? c.currentBoot.technique : 0)),
      },
      canCurve: (bootLeft && !!c.currentBoot.curve) || !!c.kibAbility?.curve,
      canExtraTouch: (bootLeft && !!c.currentBoot.extraTouch) || !!c.kibAbility?.extraTouch,
      keeperStrength: fw.sides.rivals.strength,
      oppStrength: fw.sides.rivals.strength,
      position: c.player.position,
      teamRelationship: 100,
      startMinute: 0,
      duties: farewellDuties(),
      conditions: conditionsFor(c.season, 40, c.homeCity),
      seed: farewellSeed(c),
      pressure: 0.3,
      penaltyRunup: careerPenaltyRunup(c),
      freeKickRunup: careerFreeKickRunup(c),
      farewell: { offAt: FAREWELL_OFF_AT },
    };
  }, [start, f]);
  const onFullTime = useCallback((d: MatchDriver) => {
    if (!d.finalStats) { nav.back(); return; }
    const s = farewellMatchDone(d.finalStats);
    if (s.screen === "tabs") nav.home(); else nav.replace(s.screen, s.params);
  }, [nav]);
  if (!start || !f) {
    return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}><Text style={{ color: C.text }}>No farewell to play.</Text></View>;
  }
  return <Match career={f.career} fixture={f.fixture} setupFor={setupFor} recordGoals={false} onFullTime={onFullTime} />;
}

function GoalReplaysScreen() {
  const nav = useNav();
  return <GoalReplays onBack={() => nav.back()} />;
}
export const matchScreens: ScreenMap = { match: MatchScreen, "goal-replays": GoalReplaysScreen, "farewell-match": FarewellMatchScreen };
