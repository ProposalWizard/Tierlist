/**
 * NOT IN THE FIRST TEAM (page.tsx: youth, free-agent, loan-brief).
 *  - Youth: the youth team / reserves week (YouthTeam.tsx, lib/star/youth.ts).
 *  - FreeAgent: life with no club (FreeAgentShell.tsx, lib/star/freeAgent.ts).
 *  - LoanBrief: the loan explained, and once a week its target (LoanBrief.tsx).
 * Same words and the same lib calls as the website.
 */
import { useState } from "react";
import { View, Text } from "react-native";
import type { CareerState, Skills } from "@/lib/star/types";
import { actionsLeft } from "@/lib/star/week";
import { formatMoney, formatWallet } from "@/lib/star/money";
import { leagueNameFor } from "@/lib/star/calendar";
import { placementLabel, youthAbility, youthLevelFor, readyForPromotion, PROMOTION_AT, loanProgress } from "@/lib/star/youth";
import { happinessOf } from "@/lib/star/relationships";
import { spendOn, endFreeAgentWeek, grantTrial, trialDue, WEEKS_BETWEEN_TRIALS, GARDEN_GYM_CAP, FREE_AGENT_WEEKLY_PAY, type LeisureAction } from "@/lib/star/freeAgent";
import { nextStage, STAGE_LABEL, trialScore, trialComplete } from "@/lib/star/trial";
import { setCareer } from "../../game/store";
import * as flow from "../../game/flow";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, Fill, C } from "./kit";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 8, alignItems: "center" }}>
      <Text style={{ color: C.dim, fontSize: 9, fontWeight: "900", letterSpacing: 1 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: C.text, fontSize: 14, fontWeight: "900", marginTop: 2 }}>{value}</Text>
    </View>
  );
}
function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>{label.toUpperCase()}</Text>
        <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900" }}>{Math.round(value)}</Text>
      </View>
      <Fill value={value} color={color} height={8} />
    </View>
  );
}
const P = ({ children, color = C.text }: { children: React.ReactNode; color?: string }) => <Text style={{ color, fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 6 }}>{children}</Text>;

// ── The youth team ──
const TRAIN: [keyof Skills | "rest", string][] = [
  ["pace", "Train pace"], ["power", "Train power"], ["technique", "Train technique"], ["vision", "Train vision"], ["freeKick", "Free kicks"], ["rest", "Rest"],
];
export function YouthScreen({ career, go, onLeague, onSettings }: { career: CareerState; go: (s: flow.Step, push?: boolean) => void; onLeague: () => void; onSettings: () => void }) {
  const p = career.placement;
  if (!p || p.kind !== "youth") return <Frame title="First team"><Btn label="Home" onPress={() => go(flow.HOME)} /></Frame>;
  const left = actionsLeft(career);
  const ability = youthAbility(career.skills);
  const level = youthLevelFor(p.division);
  const ready = readyForPromotion(career);
  const last = p.last;
  const seasonOver = flow.seasonOver(career);
  return (
    <Frame kicker={`${placementLabel(career)} · ${p.club}`} title={`${career.player.firstName} ${career.player.lastName}`}>
      <Text style={{ color: C.dim, fontSize: 11, fontWeight: "900", letterSpacing: 1, textAlign: "center" }}>{leagueNameFor(p.division).toUpperCase()}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat label="In the bank" value={formatWallet(career.money)} />
        <Stat label="Wage" value={`${formatMoney(career.contract.wage)}/wk`} />
        <Stat label="This week" value={`${left} left`} />
      </View>
      {p.apps === 0 && (
        <Card tone={C.gold}>
          <Label>{p.reason === "form" ? "You have been dropped" : "Where you have ended up"}</Label>
          <P>{p.reason === "form"
            ? `The manager has stopped picking you altogether. You are training with ${p.club}'s kids until you give him a reason not to.`
            : `Nobody put a professional contract in front of you. ${p.club} took you into their youth team instead — which is a club, a coach and a way in.`}</P>
        </Card>
      )}
      <Card tone={C.green}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Label color={C.green}>Getting into the first team</Label>
          <Text style={{ color: C.text, fontWeight: "900" }}>{Math.round(p.progress)}/{PROMOTION_AT}</Text>
        </View>
        <Fill value={p.progress} color={C.green} height={12} />
        {ready ? (
          <>
            <P color="#a7f3d0">The manager has seen enough. He wants you training with the first team from Monday.</P>
            <View style={{ marginTop: 10 }}><Btn label="Go up →" onPress={() => go(flow.youthPromote())} /></View>
          </>
        ) : <P color={C.dim}>Play well and it moves. Play badly and it goes back. There is no other way out of here.</P>}
      </Card>
      <Card>
        <Label color={C.dim}>You against this level</Label>
        <Gauge label="You" value={ability} color="#38bdf8" />
        <Gauge label={`${p.club} youth football`} value={level} color="rgba(255,255,255,0.4)" />
        <P color={C.dim}>{ability >= level + 8 ? "You are too good for this. Go and prove it every week and they cannot keep you here."
          : ability >= level ? "You can hold your own here. Small margins now." : "You are behind this standard. Training is not optional."}</P>
      </Card>
      {last && (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Label color={C.dim}>Last youth match</Label>
            <Text style={{ color: C.text, fontWeight: "900" }}>{last.scored}–{last.conceded}</Text>
          </View>
          <Text style={{ color: C.text, fontWeight: "900" }}>
            {last.goals} goal{last.goals === 1 ? "" : "s"} · {last.assists} assist{last.assists === 1 ? "" : "s"} ·{" "}
            <Text style={{ color: last.rating >= 7 ? C.green : last.rating < 6 ? C.red : C.text }}>{last.rating.toFixed(1)}</Text> ·{" "}
            <Text style={{ color: last.progressDelta >= 0 ? C.green : C.red }}>{last.progressDelta >= 0 ? "+" : ""}{last.progressDelta}</Text>
          </Text>
          <P color={C.dim}>“{last.verdict}”</P>
        </Card>
      )}
      <Text style={{ color: C.dim, fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>
        THIS SPELL: {p.apps} APP{p.apps === 1 ? "" : "S"}, {p.goals} GOAL{p.goals === 1 ? "" : "S"}, {p.assists} ASSIST{p.assists === 1 ? "" : "S"}
      </Text>
      <Card>
        <Label color={C.dim}>The week</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TRAIN.map(([k, label]) => (
            <Press key={k} disabled={left <= 0} onPress={() => {
              if (k === "rest") { flow.restDay(); return; }
              const s = flow.pickTraining(k);
              if (s) go(s, true);
            }} style={{ width: "48%", backgroundColor: left <= 0 ? "rgba(255,255,255,0.04)" : C.panel2, borderRadius: 10, paddingVertical: 11, alignItems: "center" }}>
              <Text style={{ color: left <= 0 ? C.dim : C.text, fontWeight: "900", fontSize: 12 }}>{label.toUpperCase()}</Text>
            </Press>
          ))}
        </View>
        <View style={{ marginTop: 10 }}>
          <Btn kind="gold" label={seasonOver ? "The season is over →" : "Play the youth match →"} onPress={() => go(flow.youthWeek())} />
        </View>
        <P color={C.dim}>{seasonOver ? "Nothing left to play. The season ends for you the same week it ends for the first team."
          : "The first team play their fixture on Saturday whether you are in it or not. You play yours."}</P>
      </Card>
      <Btn kind="plain" small label="How the first team are doing →" onPress={onLeague} />
      <Btn kind="plain" small label="Settings" onPress={onSettings} />
    </Frame>
  );
}

// ── Life with no club ──
type FaTab = "home" | "gym" | "games" | "social";
export function FreeAgentScreen({ career, go, onSettings }: { career: CareerState; go: (s: flow.Step) => void; onSettings: () => void }) {
  const [tab, setTab] = useState<FaTab>("home");
  const [note, setNote] = useState("");
  const left = actionsLeft(career);
  const trial = career.trial;
  const stage = trial ? nextStage(trial) : null;
  const finished = trial ? trialComplete(trial) : false;
  const act = (what: LeisureAction) => { const res = spendOn(career, what); setCareer(res.career); flow.settle(); setNote(res.note); };
  return (
    <Frame kicker="Free agent" title={`${career.player.firstName} ${career.player.lastName}`}
      footer={
        <View style={{ flexDirection: "row", gap: 4, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12, padding: 4 }}>
          {([["home", "🏠", "Home"], ["gym", "🏋️", "Gym"], ["games", "🎮", "Games"], ["social", "🍻", "Social"]] as [FaTab, string, string][]).map(([id, icon, label]) => (
            <Press key={id} onPress={() => setTab(id)} style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8, backgroundColor: tab === id ? "rgba(255,255,255,0.15)" : "transparent" }}>
              <Text style={{ fontSize: 16 }}>{icon}</Text>
              <Text style={{ color: tab === id ? C.text : C.dim, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 }}>{label.toUpperCase()}</Text>
            </Press>
          ))}
          <Press onPress={() => setNote(left > 0 ? `Not yet — you have ${left} day${left === 1 ? "" : "s"} left in the week.` : "That is the week gone. End it from Home.")}
            style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ fontSize: 16 }}>📅</Text>
            <Text style={{ color: C.dim, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 }}>WEEK</Text>
          </Press>
        </View>
      }>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat label="In the bank" value={formatWallet(career.money)} />
        <Stat label="This week" value={`${left} left`} />
        <Stat label="Happiness" value={`${happinessOf(career)}`} />
      </View>
      {tab === "home" && (
        <>
          {trial && !finished && (
            <Card>
              <Label color={C.dim}>{stage ? `Trial — up next: ${STAGE_LABEL[stage]}` : "Trial"}</Label>
              <P color={C.dim}>Somebody is watching. Finish it.</P>
              <View style={{ marginTop: 10 }}><Btn label="Go to the trial →" onPress={() => go({ screen: "career-trial" })} /></View>
            </Card>
          )}
          {trial && finished && (
            <Card>
              <Label color={C.dim}>Your last trial</Label>
              <Text style={{ color: C.text, fontSize: 36, fontWeight: "900" }}>{trialScore(trial)}</Text>
              {trialDue(career) ? (
                <>
                  <P color={C.green}>A club down the leagues wants a look at you. Lower bar, same afternoon.</P>
                  <View style={{ marginTop: 10 }}><Btn label="Take the trial →" onPress={() => { setCareer(grantTrial(career)); setNote("They want you in on Tuesday."); }} /></View>
                </>
              ) : (
                <P color={C.dim}>out of 100. Nothing this week — keep yourself right. Somebody usually comes looking within a month.{"\n"}
                  {Math.max(0, WEEKS_BETWEEN_TRIALS - (career.weeksSinceTrial ?? 0))} week(s) to go</P>
              )}
            </Card>
          )}
          <Card>
            <Label color={C.dim}>Where you are</Label>
            <P color={C.dim}>No club, no contract. {formatMoney(FREE_AGENT_WEEKLY_PAY)} a week comes in and that is all of it. Train in the garden, keep yourself right, and wait for somebody to give you a look.</P>
          </Card>
        </>
      )}
      {tab === "gym" && (
        <Card>
          <Label color={C.dim}>The garden gym</Label>
          <P color={C.dim}>Weights and a wall. It will get you fit and it will get you sharp, but only so far — nobody is coaching you, and there is a ceiling at {GARDEN_GYM_CAP} on what you can reach on your own.</P>
          <Gauge label="Power" value={career.skills.power} color={C.green} />
          <Gauge label="Technique" value={career.skills.technique} color={C.green} />
          <View style={{ marginTop: 12 }}><Btn label="Train" disabled={left <= 0} onPress={() => act("gym")} /></View>
        </Card>
      )}
      {tab === "games" && (
        <Card>
          <Label color={C.dim}>Video games</Label>
          <P color={C.dim}>Costs you nothing but the afternoon.</P>
          <View style={{ marginTop: 12 }}><Btn label="Play" disabled={left <= 0} onPress={() => act("games")} /></View>
        </Card>
      )}
      {tab === "social" && (
        <Card>
          <Label color={C.dim}>Out with your mates</Label>
          <P color={C.dim}>Does you more good than the console. Costs a bit more too.</P>
          <View style={{ marginTop: 12 }}><Btn label="Go out" disabled={left <= 0} onPress={() => act("social")} /></View>
        </Card>
      )}
      {note ? <Card><Text style={{ color: C.dim, fontWeight: "700" }}>{note}</Text></Card> : null}
      {left <= 0 && (
        <Card tone={C.gold}>
          <Text style={{ color: "#fde68a", fontWeight: "800" }}>That is the week gone.</Text>
          <View style={{ marginTop: 8 }}><Btn kind="gold" small label="Next week →" onPress={() => { setCareer(endFreeAgentWeek(career)); setNote(`A new week. ${formatMoney(FREE_AGENT_WEEKLY_PAY)} in.`); }} /></View>
        </Card>
      )}
      <Btn kind="plain" small label="Settings" onPress={onSettings} />
    </Frame>
  );
}

// ── The loan ──
export function LoanBriefScreen({ career, intro, onContinue }: { career: CareerState; intro: boolean; onContinue: () => void }) {
  const p = career.placement;
  const progress = loanProgress(career);
  if (!p || !progress) return <Frame title="On loan"><Btn label="Continue" onPress={onContinue} /></Frame>;
  return (
    <Frame kicker={intro ? `${p.parentClub} are loaning you out` : "On loan"} title={p.club}
      footer={<Btn label={intro ? `Report to ${p.club} →` : "Get on with it →"} onPress={onContinue} />}>
      <Text style={{ color: C.dim, fontSize: 11, fontWeight: "900", letterSpacing: 1, textAlign: "center" }}>{`${leagueNameFor(p.division)} · from ${p.parentClub}`.toUpperCase()}</Text>
      {intro && <Card><P>You are a {p.parentClub} player — that is who pays you and who holds your contract. You are not getting into that first team yet, so they are sending you to {p.club} for the season to play every week.</P></Card>}
      <Card tone="#38bdf8">
        <Label color="#7dd3fc">{`What ${p.parentClub} asked for`}</Label>
        <Text style={{ color: C.text, fontSize: 30, fontWeight: "900" }}>{progress.scored}<Text style={{ color: C.dim }}> / {progress.target}</Text><Text style={{ color: C.dim, fontSize: 14 }}>  goals</Text></Text>
        <View style={{ marginTop: 8 }}><Fill value={(progress.scored / Math.max(1, progress.target)) * 100} color="#38bdf8" height={12} /></View>
        <P color={C.dim}>{progress.met
          ? `Done. ${p.parentClub} will come for you at the end of the season — if you still want them to.`
          : `${progress.target - progress.scored} to go, with about ${progress.weeksLeft} game${progress.weeksLeft === 1 ? "" : "s"} left. Miss it and this is your club now.`}</P>
      </Card>
    </Frame>
  );
}
