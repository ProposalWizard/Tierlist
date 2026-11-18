/**
 * TRAINING, as the website's (components/star/SkillsScreen.tsx,
 * TrainingLevelSelect.tsx): this week's two sessions, one card per skill,
 * then 30 levels a skill with up to three stars each. The drill itself is
 * played on the match engine on the website (TrainingMinigame): on the phone
 * it is a STAND-IN until the match area has the drills.
 */
import { useState } from "react";
import { View, Text } from "react-native";
import type { CareerState, Skills } from "@/lib/star/types";
import { starsOf, totalStars, highestUnlocked, TRAINING_LEVELS } from "@/lib/star/trainingLevels";
import { trainingLeft, TRAINING_SESSIONS_PER_WEEK, canAct, actionsLeft } from "@/lib/star/week";
import { mechanicOpen, mechanicDef } from "@/lib/star/mechanics";
import { trainingDayOn, trainingDayLeft } from "@/lib/star/story";
import * as flow from "../../game/flow";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, Fill, StandInNote, C } from "./kit";

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
  return (
    <Frame title="Training" onBack={onBack}>
      <Card style={{ alignItems: "center" }}>
        <Label color={C.green}>This week</Label>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {Array.from({ length: TRAINING_SESSIONS_PER_WEEK }, (_, i) => (
            <View key={i} style={{ width: 56, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: i < left ? C.green : "rgba(0,0,0,0.45)" }}>
              <Text style={{ opacity: i < left ? 1 : 0.3 }}>⚡</Text>
            </View>
          ))}
        </View>
        {left <= 0 && <Text style={{ color: C.text, fontWeight: "800", marginTop: 8 }}>No more sessions this week</Text>}
        {noMore && <Text style={{ color: C.gold, marginTop: 6 }}>Two sessions a week. They come back after Saturday's game.</Text>}
      </Card>
      {SKILL_LABELS.map(([key, label, icon, desc]) => {
        const shut = key === "aerial" && !mechanicOpen(career, "aerial");
        const value = career.skills[key];
        const canTrain = !shut && career.energy >= flow.TRAINING_ENERGY_COST && value < 100 && left > 0;
        return (
          <Press key={key} disabled={shut} onPress={() => {
            if (left <= 0) { setNoMore(true); return; }
            if (!canTrain) return;
            const s = flow.pickTraining(key);
            if (s) go(s, true);
          }}>
            <Card tone={SKILL_COLOR[key]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 26 }}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{label}</Text>
                  <Text style={{ color: C.dim, fontSize: 12 }}>{shut ? `Opens ${mechanicDef("aerial").when.toLowerCase()}` : desc}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>{value}</Text>
                  <Text style={{ color: C.gold, fontSize: 11, fontWeight: "800" }}>★{totalStars(starsOf(career, key))}</Text>
                </View>
              </View>
              <View style={{ marginTop: 8 }}><Fill value={value} color={SKILL_COLOR[key]} height={8} /></View>
              {!shut && !canTrain && left > 0 && career.energy < flow.TRAINING_ENERGY_COST && <Text style={{ color: C.red, fontSize: 12, marginTop: 6 }}>Not enough energy</Text>}
            </Card>
          </Press>
        );
      })}
      {/* Rest lives on the website's Life page (RelationsPage onRest). */}
      <Card>
        <Label color={C.green}>Rest</Label>
        <Text style={{ color: C.dim, marginBottom: 8 }}>Put your feet up: a day of the week for some energy back. {actionsLeft(career)} left this week.</Text>
        <Btn kind="plain" small label="Rest" disabled={!canAct(career) || career.energy >= 100} onPress={flow.restDay} />
      </Card>
    </Frame>
  );
}

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

/** STAND-IN for the drill (TrainingMinigame on the match engine). */
export function DrillScreen({ career, skill, level, go }: { career: CareerState; skill: keyof Skills; level: number; go: (s: flow.Step) => void }) {
  const [stars, setStars] = useState<number | null>(null);
  const label = SKILL_LABELS.find((s) => s[0] === skill)?.[1] ?? skill;
  return (
    <Frame kicker={`${label} · level ${level}`} title="The drill"
      footer={stars === null
        ? <Btn label="Play the drill" onPress={() => setStars(flow.simulateDrill(skill, level))} />
        : <Btn label="Done" onPress={() => go(flow.completeTraining(skill, level, stars).step)} />}>
      <StandInNote>Stand-in: the drill itself needs the match on the phone (coming with the match area). Three tries are scored from your {label.toLowerCase()} against the level for now.</StandInNote>
      <Card style={{ alignItems: "center" }}>
        <Text style={{ color: C.dim }}>Your {label.toLowerCase()}: {career.skills[skill]}</Text>
        <Text style={{ color: C.gold, fontSize: 48, marginTop: 10 }}>{stars === null ? "☆☆☆" : "★".repeat(stars) + "☆".repeat(3 - stars)}</Text>
        <Text style={{ color: C.dim, marginTop: 6 }}>Costs {flow.TRAINING_ENERGY_COST} energy and one session.</Text>
      </Card>
    </Frame>
  );
}
