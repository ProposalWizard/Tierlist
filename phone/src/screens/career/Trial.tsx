/**
 * THE TRIAL and the signing that follows it (page.tsx: trial-stages,
 * manager-talk, scout-offers, trial-reward).
 *
 * The trial's stages, as the website's TrialSequence walks them: free
 * kicks, through the gate and the shootout are played on the match
 * (screens/MatchStages.tsx, the phone's EngineFeature); no score between
 * stages, a 3-2-1 into the next one, "A scout has spotted you" at the end.
 * Take him on (dribbling) and Find the pass (vision) have their own pictures
 * on the website too (FirstPersonDribble, TrialVision): on the phone
 * screens/MatchFirstPerson.tsx and screens/MatchVision.tsx, the same drawers.
 * Everything after it (the manager's verdict, the offers, the contract) is
 * the website's own logic.
 */
import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import { STAGE_LABEL, trialComplete, nextStage, adversityOn, type TrialStage } from "@/lib/star/trial";
import { leagueNameFor } from "@/lib/star/calendar";
import { POSITION_NAMES } from "@/lib/star/teamsheet";
import { careerPenaltyRunup, careerFreeKickRunup } from "@/lib/star/runupStyles";
import * as flow from "../../game/flow";
import { TrialFreeKicksStage, TrialTechniqueStage, TrialShootoutStage, TrialDribbleStage } from "../MatchStages";
import { TrialVisionStage } from "../MatchVision";
import { Dimensions } from "react-native";
/** The vision box's cap (TrialVision: 64% of the screen's height). */
const usePitchHeightOnce = () => Dimensions.get("window").height * 0.64;
import { Frame, Card, Label, Row, Btn, StandInNote, ClubCrest, money, C } from "./kit";

const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 550;

export function TrialScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const trial = career.trial;
  const [showingResult, setShowingResult] = useState<TrialStage | null>(null);
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const stage = trial ? nextStage(trial) : null;
  const open = showingResult ? null : stage;
  const marked = useRef<TrialStage | null>(null);
  useEffect(() => {
    if (!open || marked.current === open) return;
    marked.current = open;
    flow.beginTrialStage(open);
  }, [open]);
  const finishedAll = trial ? trialComplete(trial) : false;
  useEffect(() => {
    if (!showingResult || finishedAll) return;
    if (count <= 0) { setShowingResult(null); return; }
    const t = setTimeout(() => setCount((c) => c - 1), COUNTDOWN_STEP_MS);
    return () => clearTimeout(t);
  }, [showingResult, count, finishedAll]);
  if (!trial) return null;
  const stages = flow.trialStages(career);
  const finish = (which: TrialStage, q: number, finalPen?: boolean) => {
    flow.finishTrialStage(which, q, finalPen);
    setCount(COUNTDOWN_FROM);
    setShowingResult(which);
  };
  const skills = { power: career.skills.power, technique: career.skills.technique };
  const done = stages.filter((s) => trial.results[s]);
  const progress = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
      <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
        {stages.map((s) => <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: trial.results[s] ? "#10b981" : s === stage ? "#fff" : "rgba(255,255,255,0.2)" }} />)}
      </View>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{stage ? `${done.length + 1}/${stages.length}` : "DONE"}</Text>
    </View>
  );
  const event = stage ? adversityOn(trial, stage) : null;
  const shell = (body: React.ReactNode) => (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {progress}
      {event && (
        <View style={{ marginHorizontal: 12, marginBottom: 6, borderRadius: 12, borderWidth: 1, borderColor: event.flavour ? "rgba(255,255,255,0.15)" : "rgba(251,191,36,0.5)", backgroundColor: event.flavour ? "rgba(0,0,0,0.3)" : "rgba(245,158,11,0.15)", padding: 8 }}>
          <Text style={{ color: event.flavour ? "rgba(255,255,255,0.6)" : "#fcd34d", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{(event.flavour ? "TRIAL DAY" : "HEADS UP")} · {event.label.toUpperCase()}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", marginTop: 2 }}>{event.blurb}</Text>
        </View>
      )}
      <ScrollView scrollEnabled={false} contentContainerStyle={{ flexGrow: 1 }}>{body}</ScrollView>
    </SafeAreaView>
  );
  if (showingResult && trial.results[showingResult]) {
    if (finishedAll) {
      return (
        <Pressable onPress={() => go(flow.afterTrial())} style={{ flex: 1, backgroundColor: "#05070d", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 64 }}>🕵️</Text>
          <Text style={{ marginTop: 16, color: "#fff", fontSize: 34, fontWeight: "900", textAlign: "center" }}>A SCOUT HAS{"\n"}SPOTTED YOU</Text>
          <Text style={{ marginTop: 10, color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" }}>Somebody was watching. He wants a word.</Text>
          <View style={{ marginTop: 30, backgroundColor: "#10b981", borderRadius: 99, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>TAP TO CARRY ON</Text>
          </View>
        </Pressable>
      );
    }
    return shell(
      <View style={{ margin: 12, marginTop: 16, alignItems: "center", borderRadius: 12, paddingVertical: 32, backgroundColor: "rgba(8,14,28,0.85)" }}>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>NEXT UP</Text>
        <Text style={{ marginTop: 4, color: "#fff", fontSize: 20, fontWeight: "900" }}>{stage ? STAGE_LABEL[stage].toUpperCase() : ""}</Text>
        <Text style={{ marginTop: 16, color: "#6ee7b7", fontSize: 72, fontWeight: "900" }}>{Math.max(1, count)}</Text>
      </View>,
    );
  }
  if (!stage) {
    return <Frame kicker="Your trial" title="Done" footer={<Btn label="See what the clubs think" onPress={() => go(flow.afterTrial())} />}><Card><Text style={{ color: C.text }}>The scouts have seen enough.</Text></Card></Frame>;
  }
  if (stage === "freeKicks") return shell(<TrialFreeKicksStage key={stage} trial={trial} skills={skills} freeKickRunup={careerFreeKickRunup(career)} onDone={(q) => finish("freeKicks", q)} />);
  if (stage === "technique") return shell(<TrialTechniqueStage key={stage} trial={trial} skills={skills} onDone={(q) => finish("technique", q)} />);
  if (stage === "shootout") return shell(<TrialShootoutStage key={stage} trial={trial} skills={skills} penaltyRunup={careerPenaltyRunup(career)} onDone={(q, fp) => finish("shootout", q, fp)} />);
  if (stage === "dribbling") return shell(<TrialDribbleStage key={stage} trial={trial} pace={career.skills.pace} onDone={(q) => finish("dribbling", q)} />);
  if (stage === "vision") return shell(<TrialVisionStage key={stage} trial={trial} maxHeight={Math.round(usePitchHeightOnce())} onDone={(q) => finish("vision", q)} />);
  // A stage the website no longer plays (fiveASide): scored from your skills.
  return shell(
    <View style={{ padding: 12, gap: 12 }}>
      <StandInNote>Stand-in: "{STAGE_LABEL[stage]}" is its own picture on the website (not the match), still to come on the phone. It is scored from your skills for now.</StandInNote>
      <Btn label={`Play: ${STAGE_LABEL[stage]}`} onPress={() => { flow.simulateTrialStage(stage); setCount(COUNTDOWN_FROM); setShowingResult(stage); }} />
    </View>,
  );
}

/** The manager's verdict, then three choices (ManagerTalk). The story's first contract is fixed: sign it. */
export function ManagerTalkScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const m = flow.managerTalk(career);
  if (!m) { go({ screen: "career-offers" }); return null; }
  const { talk, offer, firstContract } = m;
  return (
    <Frame kicker="The manager's office" title={offer.club}
      footer={<View style={{ gap: 10 }}>
        <Btn label={`Accept & sign · ${money(talk.openingWeekly)} a week`} onPress={() => go(flow.acceptManagerOffer())} />
        {!firstContract && <Btn kind="gold" label="Negotiate" onPress={() => go({ screen: "career-wage-talk" })} />}
        {!firstContract && <Btn kind="plain" label="See the other clubs" onPress={() => go({ screen: "career-offers" })} />}
      </View>}>
      <Card style={{ alignItems: "center" }}>
        <ClubCrest club={offer.club} size={72} />
        <Text style={{ color: C.dim, marginTop: 8 }}>{leagueNameFor(offer.division)}</Text>
      </Card>
      <Card>
        {talk.lines.map((l, i) => <Text key={i} style={{ color: C.text, fontSize: 16, lineHeight: 23, marginBottom: 10 }}>{l}</Text>)}
      </Card>
    </Frame>
  );
}

/** The clubs that came in (ScoutOffers). Nobody: a youth team or the free-agent life. */
export function OffersScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const offers = flow.offersWithAgreedTerms(career, flow.offersForTrial(career));
  return (
    <Frame kicker="The back page" title={offers.length ? "The clubs that came in" : "Nobody came in"}
      footer={offers.length ? undefined : <Btn label="Carry on" onPress={() => go(flow.youthOrFreeAgent())} />}>
      {offers.map((o) => (
        <Card key={o.club}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <ClubCrest club={o.club} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>{o.club}</Text>
              <Text style={{ color: C.dim }}>{leagueNameFor(o.division)}</Text>
            </View>
          </View>
          <Text style={{ color: C.text, fontStyle: "italic", marginBottom: 8 }}>“{o.pitch}”</Text>
          <Row k="Wage" v={`${money(o.wage)} a week`} />
          <Row k="Goal bonus" v={money(o.goalBonus)} />
          <Row k="Assist bonus" v={money(o.assistBonus)} />
          <Row k="Contract" v={`${o.seasons} seasons`} />
          <View style={{ marginTop: 8 }}><Btn label={`Sign for ${o.club}`} onPress={() => go(flow.signTrialOffer(o))} /></View>
        </Card>
      ))}
    </Frame>
  );
}

/** Your first contract, signed (TrialReward). */
export function SignedScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const c = career.contract;
  const onLoan = career.placement?.kind === "loan";
  return (
    <Frame kicker="Signed" title={c.club} footer={<Btn label="Let's go" onPress={() => go(flow.finishSigning())} />}>
      <Card style={{ alignItems: "center" }}>
        <ClubCrest club={c.club} size={84} />
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "900", marginTop: 10 }}>{career.player.firstName} {career.player.lastName}</Text>
        <Text style={{ color: C.dim, marginTop: 2 }}>{(POSITION_NAMES as Record<string, string>)[career.player.position] ?? career.player.position}{career.squadNumber ? ` · No. ${career.squadNumber}` : ""}</Text>
      </Card>
      <Card>
        <Label>Your contract</Label>
        <Row k="Wage" v={`${money(c.wage)} a week`} />
        <Row k="Goal bonus" v={money(c.goalBonus)} />
        <Row k="Assist bonus" v={money(c.assistBonus)} />
        {c.appearanceFee ? <Row k="Appearance fee" v={money(c.appearanceFee)} /> : null}
        {c.loyaltyBonus ? <Row k="Loyalty bonus" v={money(c.loyaltyBonus)} /> : null}
        <Row k="Length" v={`${c.seasonsRemaining} seasons`} />
      </Card>
      {onLoan && <Card><Text style={{ color: C.text }}>{c.club} have signed you and sent you on loan to {career.player.club} for a season.</Text></Card>}
    </Frame>
  );
}
