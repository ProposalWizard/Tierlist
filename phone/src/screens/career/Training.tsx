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
import { View, Text, Pressable } from "react-native";
import { kitsFor } from "@/lib/star/kits";
import type { CareerState, Skills } from "@/lib/star/types";
import { starsOf, totalStars, highestUnlocked, skillFromStars, TRAINING_LEVELS } from "@/lib/star/trainingLevels";
import { trainingLeft, TRAINING_SESSIONS_PER_WEEK, canAct, actionsLeft } from "@/lib/star/week";
import { mechanicOpen, mechanicDef } from "@/lib/star/mechanics";
import { trainingDayOn, trainingDayLeft } from "@/lib/star/story";
import * as flow from "../../game/flow";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, Fill, StandInNote, C } from "./kit";
import { Bar, FillStar, LOOK, rgba } from "../../ui/look";
import { TourTarget } from "../../ui/tour";
import { LockIcon } from "./HomeMoments";
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
        <TourTarget name="sessions" style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {Array.from({ length: TRAINING_SESSIONS_PER_WEEK }, (_, i) => <SessionCell key={i} full={i < left} />)}
        </TourTarget>
        {left <= 0 && <Text style={{ color: C.text, fontWeight: "800", fontSize: 12, marginTop: 8 }}>No more sessions this week</Text>}
        {noMore && <Text style={{ color: "#fde68a", fontSize: 12, fontWeight: "700", marginTop: 6, textAlign: "center" }}>You get 2 more after Saturday's match.</Text>}
      </Card>
      {SKILL_LABELS.map(([key, label, icon]) => {
        const shut = key === "aerial" && !mechanicOpen(career, "aerial");
        const value = career.skills[key];
        const canTrain = !shut && career.energy >= flow.TRAINING_ENERGY_COST && value < 100 && left > 0;
        const [c1, c2] = SKILL_COLORS[key];
        const pick = () => {
          if (shut) return;
          if (left <= 0) { setNoMore(true); return; }
          if (!canTrain) return;
          const s = flow.pickTraining(key);
          if (s) go(s, true);
        };
        return (
          <TourTarget key={key} name={`skill-${key}`} onPress={pick}>
          <Press disabled={shut} onPress={pick} style={[{ borderRadius: 4, padding: 12, opacity: canTrain || left <= 0 ? 1 : 0.6,
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
          </TourTarget>
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

/** TrainingLevelSelect.tsx LOOK: each skill's icon, colour and one line. */
const LEVEL_LOOK: Record<keyof Skills, { title: string; icon: string; accent: string; line: string }> = {
  pace: { title: "Pace", icon: "⚡", accent: "#facc15", line: "Faster dribbles, more runs into space" },
  power: { title: "Power", icon: "💪", accent: "#fb923c", line: "Long shots and stronger crosses" },
  technique: { title: "Technique", icon: "🎯", accent: "#22d3ee", line: "Ball control, curl, precise strikes" },
  vision: { title: "Vision", icon: "👁️", accent: "#a78bfa", line: "More team-mates to pass to" },
  freeKick: { title: "Free Kick", icon: "🎪", accent: "#f472b6", line: "Free kicks, corners and penalties" },
  aerial: { title: "Aerial & Acrobatics", icon: "🤸", accent: "#2dd4bf", line: "Headers and volleys" },
};

/**
 * Pick a level (TrainingLevelSelect.tsx): the pitch-green page, BACK and
 * "TRAINING" on one line, the skill as a big lit card (icon, name, what it
 * does, RATING, ★ n / 90, "Level n is next", the star bar), then 30 tiles,
 * five a row, each with its number small in the corner and three stars.
 */
export function LevelSelectScreen({ career, skill, onBack, go }: { career: CareerState; skill: keyof Skills; onBack?: () => void; go: (s: flow.Step) => void }) {
  const levels = starsOf(career, skill);
  const open = highestUnlocked(levels);
  const stars = totalStars(levels);
  const value = career.skills[skill];
  const ceiling = skillFromStars(stars);
  const max = TRAINING_LEVELS * 3;
  const look = LEVEL_LOOK[skill] ?? LEVEL_LOOK.power;
  const a = look.accent;
  const forced = trainingDayOn(career) && trainingDayLeft(career).includes(skill);
  const [w, setW] = useState(0);
  const tile = w > 0 ? Math.floor((w - 4 * 8) / 5) : 0;
  const star = Math.max(13, Math.min(19, Math.floor((tile - 8) / 3)));
  const play = (n: number) => go({ screen: "career-drill", params: { skill, level: n } });
  return (
    <Frame title={look.title} bare backdrop="pitch">
      <View style={{ width: "100%", maxWidth: 384, alignSelf: "center", paddingHorizontal: 4 }} onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width) - 8)}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}>
          {forced || !onBack ? <View /> : (
            <Press onPress={onBack} style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", marginTop: -2 }}>‹</Text>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.4 }}>BACK</Text>
            </Press>
          )}
          <Text style={{ color: a, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>TRAINING</Text>
        </View>

        <View style={{ marginTop: 12, borderRadius: 16, padding: 16, overflow: "hidden",
          backgroundImage: `radial-gradient(110% 120% at 0% 0%, ${rgba(a, 0.35)} 0%, rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(31,41,55,0.94), rgba(10,14,24,0.97))`,
          boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.12), inset 0px 0px 0px 1px ${rgba(a, 0.45)}, 0px 0px 26px -6px ${rgba(a, 0.55)}` } as ViewStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center",
              backgroundImage: `linear-gradient(160deg, ${rgba(a, 0.55)}, ${rgba(a, 0.15)})`, boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.35), 0px 0px 16px ${rgba(a, 0.55)}` } as ViewStyle}>
              <Text style={{ fontSize: 30 }}>{look.icon}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#fff", fontSize: 22, lineHeight: 24, fontWeight: "900" }}>{look.title}</Text>
              <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "700", marginTop: 4 }}>{look.line}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: a, fontSize: 34, lineHeight: 36, fontWeight: "900", textShadowColor: rgba(a, 0.6), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 }}>{value}</Text>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }}>RATING</Text>
            </View>
          </View>
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "#fcd34d", fontSize: 13, fontWeight: "900", textShadowColor: "rgba(251,191,36,0.5)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}>★ {stars} / {max}</Text>
            <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: a, boxShadow: `0px 0px 12px ${rgba(a, 0.6)}` } as ViewStyle}>
              <Text style={{ color: "#030712", fontSize: 11, fontWeight: "900" }}>Level {open} is next</Text>
            </View>
          </View>
          <View style={{ marginTop: 8, height: 12, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
            <View style={{ width: `${Math.max(2, (stars / max) * 100)}%`, height: "100%", backgroundImage: `linear-gradient(90deg, ${a}, #fde68a)` } as ViewStyle} />
          </View>
          {value < ceiling && <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "700", marginTop: 8 }}>{`You've lost ${ceiling - value} since your best — pass any level to win them back.`}</Text>}
        </View>

        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {tile > 0 && levels.map((s, i) => {
            const n = i + 1, locked = n > open, next = n === open && s === 0, full = s === 3;
            const look2: ViewStyle = (locked ? { backgroundColor: "rgba(15,23,42,0.7)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.05)" }
              : next ? { backgroundImage: `linear-gradient(180deg, ${rgba(a, 0.35)}, rgba(15,23,42,0.95))`, boxShadow: `inset 0px 0px 0px 2px ${a}, 0px 0px 16px ${rgba(a, 0.6)}` }
              : full ? { backgroundImage: "linear-gradient(180deg, rgba(251,191,36,0.35), rgba(15,23,42,0.95))", boxShadow: "inset 0px 0px 0px 1px rgba(251,191,36,0.7), 0px 0px 12px rgba(251,191,36,0.35)" }
              : { backgroundImage: `linear-gradient(180deg, ${rgba(a, 0.18)}, rgba(15,23,42,0.95))`, boxShadow: `inset 0px 0px 0px 1px ${rgba(a, 0.4)}` }) as ViewStyle;
            const body = (
              <Press disabled={locked} onPress={() => play(n)} style={[{ width: tile, height: tile, borderRadius: 12, overflow: "hidden" }, look2]}>
                <View style={{ position: "absolute", left: 6, top: 4 }}>
                  {locked ? <LockIcon size={10} color="rgba(255,255,255,0.45)" /> : <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, lineHeight: 11, fontWeight: "900" }}>{n}</Text>}
                </View>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1, paddingTop: 10, opacity: locked ? 0.55 : 1 }}>
                  <FillStar fraction={s >= 1 ? 1 : 0} size={star} />
                  <FillStar fraction={s >= 2 ? 1 : 0} size={star} />
                  <FillStar fraction={s >= 3 ? 1 : 0} size={star} />
                </View>
              </Press>
            );
            return n === 1 ? <TourTarget key={n} name="level-1" onPress={() => play(1)}>{body}</TourTarget> : <View key={n}>{body}</View>;
          })}
        </View>
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
/** TrainingMinigame SKILL_LOOK's icons. */
const DRILL_ICON: Record<string, string> = { pace: "⚡", power: "💥", technique: "🎯", vision: "👁️", freeKick: "🌀", aerial: "🤸" };
export function DrillScreen({ career, skill, level, go }: { career: CareerState; skill: keyof Skills; level: number; go: (s: flow.Step) => void }) {
  const [stars, setStars] = useState<number | null>(null);
  const label = SKILL_LABELS.find((s) => s[0] === skill)?.[1] ?? skill;
  const onFinish = useCallback((n: number) => go(flow.completeTraining(skill, level, n).step), [go, skill, level]);
  if (skill === "pace" || skill === "vision" || skill === "power" || skill === "technique" || skill === "freeKick" || skill === "aerial") {
    // The website's tutorial on the drill, its "?" and the 3 s result card (DrillShell.tsx).
    return (
      // Under the pitch the website is green (the pitch look), not navy.
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "rgb(12,71,38)", paddingTop: 6 }}>
        {/* TrainingMinigame's top: ✕ EXIT on the left (the only way out besides the phone's back button),
            the skill over a band in the club's colour. Leaving costs nothing: no session, no energy. */}
        <View style={{ flexDirection: "row", alignItems: "center", height: 34, marginHorizontal: 12, marginBottom: 6, borderRadius: 2, overflow: "hidden",
          backgroundImage: `linear-gradient(90deg, ${kitsFor(career.player.club, career.player.club, career.clubKits?.[career.player.club]).home.shirt}66, rgba(16,82,47,0.9) 70%)`, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" } as never}>
          <Pressable onPress={() => go({ screen: "career-training" })} accessibilityRole="button" accessibilityLabel="Exit the drill" hitSlop={8}
            style={{ height: 34, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" }}>
            <Text numberOfLines={1} style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }}>✕ EXIT</Text>
          </Pressable>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flex: 1, textAlign: "center", paddingHorizontal: 8, color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1.4 }}>
            {DRILL_ICON[skill]} {String(label).toUpperCase()} · LEVEL {level}
          </Text>
          <View style={{ width: 62 }} />
        </View>
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
