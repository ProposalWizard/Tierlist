// MATCH AREA: everything played on the pitch.
import type { ScreenMap } from "./types";
import { Match } from "../screens/Match";
import { useCareer } from "../game/store";
import { useNav } from "../nav";

function MatchScreen() {
  const career = useCareer();
  const nav = useNav();
  if (!career) return null;
  const s = career.skills;
  return <Match skills={{ power: s.power, technique: s.technique, vision: s.vision }} onDone={() => nav.back()} />;
}
export const matchScreens: ScreenMap = { match: MatchScreen };
