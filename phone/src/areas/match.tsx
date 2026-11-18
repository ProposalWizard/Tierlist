// MATCH AREA: everything played on the pitch.
import { useCallback, useMemo } from "react";
import { View, Text } from "react-native";
import type { ScreenMap } from "./types";
import { Match } from "../screens/Match";
import { GoalReplays } from "../screens/MatchReplays";
import { useCareer } from "../game/store";
import { nextFixture, completeMatch } from "../game/flow";
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
function GoalReplaysScreen() {
  const nav = useNav();
  return <GoalReplays onBack={() => nav.back()} />;
}
export const matchScreens: ScreenMap = { match: MatchScreen, "goal-replays": GoalReplaysScreen };
