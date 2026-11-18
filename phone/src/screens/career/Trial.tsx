/**
 * THE TRIAL and the signing that follows it (page.tsx: trial-stages,
 * manager-talk, scout-offers, trial-reward).
 *
 * The trial's five stages are played on the match engine on the website
 * (TrialSequence). Until the match area has them on the phone, each stage is
 * a STAND-IN: one tap scores it from your skills (flow.simulateTrialStage).
 * Everything after it (the manager's verdict, the offers, the contract) is
 * the website's own logic.
 */
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { STAGE_LABEL, trialComplete, trialScore } from "@/lib/star/trial";
import { leagueNameFor } from "@/lib/star/calendar";
import { POSITION_NAMES } from "@/lib/star/teamsheet";
import * as flow from "../../game/flow";
import { Frame, Card, Label, Row, Btn, StandInNote, ClubCrest, money, C } from "./kit";

export function TrialScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const trial = career.trial;
  if (!trial) return null;
  const stages = flow.trialStages(career);
  const next = stages.find((s) => !trial.results[s]);
  const done = trialComplete(trial);
  return (
    <Frame kicker="Your trial" title={`${career.player.firstName}'s big afternoon`}
      footer={done ? <Btn label="See what the clubs think" onPress={() => go(flow.afterTrial())} />
        : <Btn label={`Play: ${STAGE_LABEL[next!]}`} onPress={() => flow.simulateTrialStage(next!)} />}>
      <StandInNote>Stand-in: the trial's drills need the match on the phone (coming with the match area). Each stage is scored from your skills for now.</StandInNote>
      <Card>
        <Label>Stages</Label>
        {stages.map((s) => {
          const r = trial.results[s];
          return <Row key={s} k={STAGE_LABEL[s]} v={r ? `${r.score}` : s === next ? "Next" : "—"} color={r ? (r.score >= 60 ? C.green : r.score >= 40 ? C.gold : C.red) : C.dim} />;
        })}
        {done && <Row k="Trial score" v={`${Math.round(trialScore(trial))}`} color={C.gold} />}
      </Card>
    </Frame>
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
        {!firstContract && <Btn kind="plain" label="See the other clubs" onPress={() => go({ screen: "career-offers" })} />}
      </View>}>
      <Card style={{ alignItems: "center" }}>
        <ClubCrest club={offer.club} size={72} />
        <Text style={{ color: C.dim, marginTop: 8 }}>{leagueNameFor(offer.division)}</Text>
      </Card>
      <Card>
        {talk.lines.map((l, i) => <Text key={i} style={{ color: C.text, fontSize: 16, lineHeight: 23, marginBottom: 10 }}>{l}</Text>)}
      </Card>
      {!firstContract && <StandInNote>Haggling over the wage (the negotiation table) is still to come on the phone.</StandInNote>}
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
