/**
 * TRAINING, as the website's (components/star/SkillsScreen.tsx,
 * TrainingLevelSelect.tsx): this week's two sessions, one card per skill,
 * then 30 levels a skill with up to three stars each. The drill itself is
 * played on the match engine on the website (TrainingMinigame): on the phone
 * it is a STAND-IN until the match area has the drills.
 */
import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { DrillStrike, DrillPace, DrillVision } from "../MatchStages";
import { DrillShell } from "./DrillShell";
import { View, Text } from "react-native";
import type { CareerState, Skills } from "@/lib/star/types";
import { starsOf, totalStars, highestUnlocked, TRAINING_LEVELS } from "@/lib/star/trainingLevels";
import { trainingLeft, TRAINING_SESSIONS_PER_WEEK, canAct, actionsLeft } from "@/lib/star/week";
import { mechanicOpen, mechanicDef } from "@/lib/star/mechanics";
import { trainingDayOn, trainingDayLeft } from "@/lib/star/story";
import * as flow from "../../game/flow";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, Fill, StandInNote, C } from "./kit";
import { Bar, LOOK, rgba } from "../../ui/look";
import type { ViewStyle } from "react-native";

export const SKILL_LABELS: [keyof Skills, string, string, string][] = [
  ["pace", "Pace", "⚡", "Faster dribbles, more runs into space, quicker Touch Mode chase"],
  ["power", "Power", "💪", "Long shots and stronger crosses"],
  ["technique", "Technique", "🎯", "Ball control, curl, precise strikes"],
  ["vision", "Vision", "👁️", "More team-mates to pass to in every chance"],
  ["freeKick", "Free Kick", "🎪", "Free kicks, corners and penalties — and how many are yours"],
  ["aerial", "Aerial & Acrobatics", "🤸", "Headers and volleys"],
];
const SKILL_COLOR: Record<keyof Skills, string> = { pace: "#facc15", power: "#f97316", technique: "#38bdf8", vision: "#a78bfa", freeKick: "#f472b6", aerial: "#2dd4bf" };

export function TrainingScreen({ career, onBack, go }: { career: CareerState; onBack: () => void; go: (s: flow.Step, push?: boolean) => void }) {
  const left = trainingLeft(career);
  const [noMore, setNoMore] = useState(false);
  void onBack; // as the website: Training is a bottom-bar page, Home is one tap away
  return (
    <Frame title="Training" top bar="training" bare backdrop="pitch">
      {/* The week's sessions as charge cells (SkillsScreen.tsx). */}
      <Card style={{ alignItems: "center", paddingVertical: 12, borderRadius: 4 }}>
        <Text style={{ color: LOOK.emerald300, fontSize: 11, fontWeight: "900", letterSpacing: 2.2 }}>TRAINING</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {Array.from({ length: TRAINING_SESSIONS_PER_WEEK }, (_, i) => <SessionCell key={i} full={i < left} />)}
        </View>
        {left <= 0 && <Text style={{ color: C.text, fontWeight: "800", fontSize: 12, marginTop: 8 }}>No more sessions this week</Text>}
        {noMore && <Text style={{ color: "#fde68a", fontSize: 12, fontWeight: "700", marginTop: 6, textAlign: "center" }}>You get 2 more after Saturday's match.</Text>}
      </Card>
      {SKILL_LABELS.map(([key, label, icon]) => {
        const shut = key === "aerial" && !mechanicOpen(career, "aerial");
        const value = career.skills[key];
        const canTrain = !shut && career.energy >= flow.TRAINING_ENERGY_COST && value < 100 && left > 0;
        const [c1, c2] = SKILL_COLORS[key];
        return (
          <Press key={key} disabled={shut} onPress={() => {
            if (left <= 0) { setNoMore(true); return; }
            if (!canTrain) return;
            const s = flow.pickTraining(key);
            if (s) go(s, true);
          }} style={[{ borderRadius: 4, padding: 12, opacity: canTrain || left <= 0 ? 1 : 0.6,
            backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${rgba(c1, canTrain ? 0.3 : 0.14)} 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, ${LOOK.glassTop}, ${LOOK.glassBottom})`,
            boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.10), inset 0px 0px 0px 1px ${rgba(c1, canTrain ? 0.32 : 0.14)}, 0px 10px 24px -12px rgba(0,0,0,0.8)` } as ViewStyle]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundImage: `linear-gradient(180deg, ${rgba(c1, 0.35)}, ${rgba(c1, 0.15)})`, boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.25), inset 0px 0px 0px 1px ${rgba(c1, 0.5)}, 0px 0px 12px ${rgba(c1, canTrain ? 0.35 : 0.15)}` } as ViewStyle}>
                <Text style={{ fontSize: 22 }}>{icon}</Text>
              </View>
              {/* The name only; what it does is on the skill's own page (Mikey's playtest, 24 Oct 2026). */}
              <Text style={{ flex: 1, color: "#fff", fontWeight: "900", fontSize: 15 }}>{label}</Text>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: c2, fontSize: 24, lineHeight: 26, fontWeight: "900", textShadowColor: rgba(c1, 0.7), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>{value}</Text>
                <Text style={{ color: "#fcd34d", fontSize: 10, fontWeight: "900", marginTop: 2 }}>★ {totalStars(starsOf(career, key))}/90</Text>
              </View>
            </View>
            <View style={{ marginTop: 10, flexDirection: "row" }}><Bar value={value} colors={[c1, c2]} height={12} /></View>
            {/* SkillsScreen: a shut drill says when it opens ("Opens after your third game"). */}
            {shut && <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "800", marginTop: 6 }}>{`Opens ${mechanicDef("aerial").when.toLowerCase()}`}</Text>}
            {!shut && !canTrain && left > 0 && career.energy < flow.TRAINING_ENERGY_COST && <Text style={{ color: "#fca5a5", fontSize: 12, fontWeight: "700", marginTop: 6 }}>Not enough energy</Text>}
          </Press>
        );
      })}
      {/* Rest lives on the website's Life page (RelationsPage onRest); kept here on the phone. */}
      <Card>
        <Label color={LOOK.emerald300}>Rest</Label>
        <Text style={{ color: C.dim, marginBottom: 8, fontSize: 13 }}>Put your feet up: a day of the week for some energy back. {actionsLeft(career)} left this week.</Text>
        <Btn kind="plain" small label="Rest" disabled={!canAct(career) || career.energy >= 100} onPress={flow.restDay} />
      </Card>
    </Frame>
  );
}

/** One of the week's sessions: a charged cell with a bolt, or a spent one (SkillsScreen SessionCell). */
function SessionCell({ full }: { full: boolean }) {
  return (
    <View style={[{ width: 56, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
      (full ? { backgroundImage: "linear-gradient(180deg, #6ee7b7, #10b981)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.55), 0px 0px 12px rgba(52,211,153,0.6)" }
        : { backgroundColor: "rgba(0,0,0,0.45)", boxShadow: "inset 0px 1px 3px rgba(0,0,0,0.6), inset 0px 0px 0px 1px rgba(255,255,255,0.08)" }) as ViewStyle]}>
      <Text style={{ fontSize: 15, opacity: full ? 1 : 0.3 }}>⚡</Text>
    </View>
  );
}

/** Each skill's two colours (SkillsScreen.tsx SKILL_COLOR). */
const SKILL_COLORS: Record<keyof Skills, [string, string]> = {
  pace: ["#facc15", "#fef08a"], power: ["#f97316", "#fdba74"], technique: ["#38bdf8", "#a5f3fc"],
  vision: ["#a78bfa", "#ddd6fe"], freeKick: ["#f472b6", "#fbcfe8"], aerial: ["#2dd4bf", "#99f6e4"],
};

/** Pick a level (TrainingLevelSelect): 30 levels, stars on each, the next one open. */
export function LevelSelectScreen({ career, skill, onBack, go }: { career: CareerState; skill: keyof Skills; onBack?: () => void; go: (s: flow.Step) => void }) {
  const levels = starsOf(career, skill);
  const open = highestUnlocked(levels);
  const label = SKILL_LABELS.find((s) => s[0] === skill)?.[1] ?? skill;
  const forced = trainingDayOn(career) && trainingDayLeft(career).includes(skill);
  return (
    <Frame kicker="Training" title={label} onBack={forced ? undefined : onBack}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {Array.from({ length: TRAINING_LEVELS }, (_, i) => {
          const n = i + 1, s = levels[i], locked = n > open;
          return (
            <Press key={n} disabled={locked} onPress={() => go({ screen: "career-drill", params: { skill, level: n } })}
              style={{ width: 62, height: 62, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: locked ? "rgba(0,0,0,0.4)" : n === open ? C.green : C.panel, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ color: n === open ? "#05261a" : C.text, fontWeight: "900", fontSize: 18 }}>{locked ? "🔒" : n}</Text>
              {!locked && <Text style={{ color: n === open ? "#05261a" : C.gold, fontSize: 10 }}>{"★".repeat(s)}{"☆".repeat(3 - s)}</Text>}
            </Press>
          );
        })}
      </View>
    </Frame>
  );
}

/**
 * The drill (TrainingMinigame). Power, Technique, Free Kick and Aerial strike
 * on the match (screens/MatchStages.tsx DrillStrike, the phone's
 * EngineFeature); Pace is the Gauntlet's first-person run (DrillPace) and
 * Vision picks the pass on the match (DrillVision).
 */
export function DrillScreen({ career, skill, level, go }: { career: CareerState; skill: keyof Skills; level: number; go: (s: flow.Step) => void }) {
  const [stars, setStars] = useState<number | null>(null);
  const label = SKILL_LABELS.find((s) => s[0] === skill)?.[1] ?? skill;
  const onFinish = useCallback((n: number) => go(flow.completeTraining(skill, level, n).step), [go, skill, level]);
  if (skill === "pace" || skill === "vision" || skill === "power" || skill === "technique" || skill === "freeKick" || skill === "aerial") {
    // The website's tutorial on the drill, its "?" and the 3 s result card (DrillShell.tsx).
    return (
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: C.bg, paddingTop: 8 }}>
        <DrillShell career={career} skill={skill} level={level} onDone={onFinish}>
          {(finish, run) => skill === "pace" ? <DrillPace trainingLevel={level} onFinish={finish} />
            : skill === "vision" ? <DrillVision key={run} trainingLevel={level} skills={career.skills} onFinish={finish} />
            : <DrillStrike kind={skill} trainingLevel={level} skills={career.skills} onFinish={finish} />}
        </DrillShell>
      </SafeAreaView>
    );
  }
  return (
    <Frame kicker={`${label} · level ${level}`} title="The drill"
      footer={stars === null
        ? <Btn label="Play the drill" onPress={() => setStars(flow.simulateDrill(skill, level))} />
        : <Btn label="Done" onPress={() => go(flow.completeTraining(skill, level, stars).step)} />}>
      <StandInNote>Stand-in: this drill is its own picture on the website (not the match), still to come on the phone. Three tries are scored from your {label.toLowerCase()} against the level for now.</StandInNote>
      <Card style={{ alignItems: "center" }}>
        <Text style={{ color: C.dim }}>Your {label.toLowerCase()}: {career.skills[skill]}</Text>
        <Text style={{ color: C.gold, fontSize: 48, marginTop: 10 }}>{stars === null ? "☆☆☆" : "★".repeat(stars) + "☆".repeat(3 - stars)}</Text>
        <Text style={{ color: C.dim, marginTop: 6 }}>Costs {flow.TRAINING_ENERGY_COST} energy and one session.</Text>
      </Card>
    </Frame>
  );
}
