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
import { View, Text, ScrollView, Pressable, type ViewStyle, useWindowDimensions } from "react-native";
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
// (the pitch height is read with useWindowDimensions inside TrialScreen: it follows a rotation, a split screen, the bars going)
import { Frame, Card, Label, Row, Btn, StandInNote, ClubCrest, money, C } from "./kit";
import { RiseIn, PopIn, Pulse } from "./lookBits";
import { ScoutBackdrop, ScoutFigure, clubGlow } from "./ScoutArt";
import { SigningMoment } from "./Signing";
import { FONT, rgba } from "../../ui/look";
import { formatMoney } from "@/lib/star/money";
import { loadLineup } from "@/lib/star/lineupStore";
import { useNav } from "../../nav";

/** TrialFrame.tsx TRIAL_PAGE_BG. */
const TRIAL_PAGE_BG = "radial-gradient(90% 50% at 50% 30%, #14532d, #052e16 70%, #02140a)";
const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 550;

export function TrialScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const pitchH = useWindowDimensions().height * 0.64;
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
  // TrialSequence.tsx: ONE row: ✕ Exit, the stage pips, "2/5".
  const progress = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 }}>
      <Pressable onPress={() => go({ screen: "title" })} hitSlop={8} style={{ borderRadius: 99, backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 8, paddingVertical: 4 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "900", letterSpacing: 0.4 }}>✕ EXIT</Text>
      </Pressable>
      <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
        {stages.map((s) => <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: trial.results[s] ? "#10b981" : s === stage ? "#fff" : "rgba(255,255,255,0.2)" }} />)}
      </View>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{stage ? `${done.length + 1}/${stages.length}` : "DONE"}</Text>
    </View>
  );
  const event = stage ? adversityOn(trial, stage) : null;
  const shell = (body: React.ReactNode) => (
    // TrialFrame.tsx TrialPage: the dark-green page every stage sits on.
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#052e16", backgroundImage: TRIAL_PAGE_BG } as ViewStyle}>
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
        <Pressable onPress={() => go(flow.afterTrial())} style={{ flex: 1, backgroundColor: "#05070d", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, overflow: "hidden" }}>
          {/* TrialSequence: the floodlit stand at night and the drawn scout (ScoutArt.tsx). */}
          <ScoutBackdrop />
          <RiseIn style={{ alignItems: "center" }}>
            <ScoutFigure width={192} height={224} />
            <Text style={{ marginTop: 16, color: "#fff", fontFamily: FONT.display, fontSize: 34, lineHeight: 36, textAlign: "center" }}>A SCOUT HAS{"\n"}SPOTTED YOU</Text>
            <Text style={{ marginTop: 10, color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" }}>Somebody was watching. He wants a word.</Text>
          </RiseIn>
          <Pulse style={{ marginTop: 30, backgroundColor: "#10b981", borderRadius: 99, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>TAP TO CARRY ON</Text>
          </Pulse>
        </Pressable>
      );
    }
    return shell(
      <View style={{ margin: 12, marginTop: 16, alignItems: "center", borderRadius: 12, paddingVertical: 32, backgroundColor: "rgba(8,14,28,0.85)" }}>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>NEXT UP</Text>
        <Text style={{ marginTop: 4, color: "#fff", fontSize: 20, fontWeight: "900" }}>{stage ? STAGE_LABEL[stage].toUpperCase() : ""}</Text>
        <PopIn key={count}><Text style={{ marginTop: 16, color: "#6ee7b7", fontSize: 72, fontWeight: "900" }}>{Math.max(1, count)}</Text></PopIn>
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
  if (stage === "vision") return shell(<TrialVisionStage key={stage} trial={trial} maxHeight={Math.round(pitchH)} onDone={(q) => finish("vision", q)} />);
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
  return <ScoutTalk m={m} go={go} />;
}

/**
 * The scout's talk (components/star/ManagerTalk.tsx): "A SCOUT HAS SPOTTED YOU"
 * on the floodlit stand, the club's badge glowing, its name; the scout's card
 * whose lines come one tap at a time; then THE OFFER card with the wage.
 */
function ScoutTalk({ m, go }: { m: NonNullable<ReturnType<typeof flow.managerTalk>>; go: (s: flow.Step) => void }) {
  const { talk, offer, firstContract } = m;
  const [shown, setShown] = useState(1);
  const done = shown >= talk.lines.length;
  const glow = clubGlow(offer.club);
  const managerName = loadLineup(offer.club)?.manager || "The manager";
  // (the scout speaks for a club you have not joined yet: its manager comes from the club's saved line-up)
  const nav = useNav();
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#05070d" }}>
      <ScoutBackdrop glow={glow} />
      <Pressable onPress={() => nav.go("career-settings")} hitSlop={8} style={{ position: "absolute", right: 10, top: 16, zIndex: 2, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" }}>
        <Text style={{ color: "#fff", fontSize: 16 }}>⚙</Text>
      </Pressable>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 }}>
        <PopIn style={{ alignItems: "center" }}>
          <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "rgba(251,191,36,0.15)", borderWidth: 1, borderColor: "rgba(252,211,77,0.4)" }}>
            <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900", letterSpacing: 2.6 }}>A SCOUT HAS SPOTTED YOU</Text>
          </View>
        </PopIn>
        <View style={{ marginTop: 16, alignItems: "center" }}>
          <View style={{ width: 104, height: 104, alignItems: "center", justifyContent: "center" }}>
            <Pulse min={0.6} scale={1.12} style={{ position: "absolute", left: -18, right: -18, top: -18, bottom: -18 }}>
              <View pointerEvents="none" style={{ flex: 1, borderRadius: 999, backgroundImage: `radial-gradient(closest-side, ${rgba(glow, 0.67)}, transparent)` } as ViewStyle} />
            </Pulse>
            <ClubCrest club={offer.club} size={92} />
          </View>
          <Text style={{ marginTop: 8, color: "#b4b9c1", fontFamily: FONT.display, fontSize: 28, lineHeight: 32, textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{offer.club}</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "900", letterSpacing: 1.6 }}>{leagueNameFor(offer.division).toUpperCase()}</Text>
        </View>
        {/* the scout, and what he says: a tap moves him on */}
        <Pressable onPress={() => setShown((s) => Math.min(talk.lines.length, s + 1))} disabled={done}
          style={{ marginTop: 16, flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, padding: 12, backgroundImage: "linear-gradient(180deg, rgba(15,23,42,0.82), rgba(5,7,13,0.88))", boxShadow: `inset 0px 0px 0px 1px ${rgba(glow, 0.4)}, 0px 12px 30px -12px rgba(0,0,0,0.9)` } as ViewStyle}>
          <View style={{ borderRadius: 12, overflow: "hidden", backgroundImage: `linear-gradient(180deg, ${rgba(glow, 0.33)}, rgba(0,0,0,0.4))`, boxShadow: `inset 0px 0px 0px 1px ${rgba(glow, 0.53)}` } as ViewStyle}>
            <ScoutFigure width={72} height={84} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: "#fcd34d", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{`${managerName}'s scout`.toUpperCase()}</Text>
            <View style={{ marginTop: 4, gap: 6 }}>
              {talk.lines.slice(0, shown).map((line, i) => <Text key={i} style={{ color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 18 }}>“{line}”</Text>)}
            </View>
            {!done && <Text style={{ paddingTop: 6, color: "#fcd34d", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>TAP TO HEAR HIM OUT →</Text>}
          </View>
        </Pressable>
        <View style={{ flex: 1, minHeight: 12 }} />
        {done && (
          <View style={{ borderRadius: 16, padding: 14, backgroundImage: "linear-gradient(180deg, rgba(6,78,59,0.92), rgba(2,44,34,0.95))", boxShadow: "inset 0px 0px 0px 1px rgba(52,211,153,0.45), 0px -10px 30px -10px rgba(0,0,0,0.8)" } as ViewStyle}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
              <View>
                <Text style={{ color: "#6ee7b7", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>THE OFFER</Text>
                <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>★{formatMoney(talk.openingWeekly)}<Text style={{ fontSize: 14 }}> a week</Text></Text>
              </View>
              <ClubCrest club={offer.club} size={34} />
            </View>
            <Text style={{ marginTop: 6, color: "#fff", fontSize: 11.5, fontWeight: "700", lineHeight: 15 }}>
              {firstContract ? "Your first contract. Sign it and you're in the squad." : "Take it, or argue for more. Push too hard and he comes back with a worse, final offer."}
            </Text>
            <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => go(flow.acceptManagerOffer())} style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#10b981" }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>ACCEPT & SIGN</Text>
              </Pressable>
              {!firstContract && (
                <Pressable onPress={() => go({ screen: "career-wage-talk" })} style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#fbbf24" }}>
                  <Text style={{ color: "#030712", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>NEGOTIATE</Text>
                </Pressable>
              )}
            </View>
            {!firstContract && (
              <Pressable onPress={() => go({ screen: "career-offers" })} style={{ marginTop: 8, borderRadius: 12, paddingVertical: 8, alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)" }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>SEE OTHER CLUBS</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * The clubs that came in (components/star/ScoutOffers.tsx): the dark page with a pitch-green
 * glow, "A SCOUT HAS SPOTTED YOU", "N CLUBS CAME IN", one glass card a club (badge in its
 * glow, league, what they said, Wage / Per goal / Years tiles, Sign for …). No rise-in: the website's kit-rise and RiseIn no longer move anything (ui/motion.tsx, 14 Oct 2026).
 * Nobody: "Not this time" and the youth team that will take you (or the way home).
 */
const PITCH_GREEN = "#2F6F4E";
function OfferTerm({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.08)" } as ViewStyle}>
      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }}>{label.toUpperCase()}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}
const offerCard = (glow: string): ViewStyle => ({ borderRadius: 16, padding: 16,
  backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${rgba(glow, 0.28)} 0%, transparent 55%), linear-gradient(180deg, rgba(31,41,55,0.92), rgba(12,17,28,0.96))`,
  boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.10), inset 0px 0px 0px 1px ${rgba(glow, 0.22)}, 0px 10px 24px -12px rgba(0,0,0,0.8)` } as ViewStyle);
export function OffersScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const nav = useNav();
  const offers = flow.offersWithAgreedTerms(career, flow.offersForTrial(career));
  const youthClub = offers.length ? null : flow.youthTakerName(career);
  const name = career.player.firstName;
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#05080f" }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(90% 45% at 50% -8%, ${rgba(PITCH_GREEN, 0.33)} 0%, transparent 70%), linear-gradient(180deg, #0a1120 0%, #05080f 60%)` } as ViewStyle} />
      <Pressable onPress={() => nav.go("career-settings")} hitSlop={6} style={{ position: "absolute", right: 16, top: 16, zIndex: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.1)" }}>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.6 }}>SETTINGS</Text>
      </Pressable>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: offers.length ? 24 : 32 }} showsVerticalScrollIndicator={false}>
        {!offers.length ? (
          <>
            <View style={[offerCard(PITCH_GREEN), { marginTop: 24, padding: 20 }]}>
              <Text style={{ color: "#fcd34d", fontSize: 14, fontWeight: "900", letterSpacing: 1.6 }}>NOT THIS TIME</Text>
              <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700", lineHeight: 19 }}>
                {youthClub
                  ? `Nobody put professional terms in front of you, ${name}. But somebody watched: ${youthClub} will take you into their youth team. Scholarship money, and a coach who will look at you every week. Play well enough and you go up.`
                  : `They thanked you and said they'd be in touch. They won't be. No club, no contract, not even an academy — just you, a garden and whatever you can make of the next few months, ${name}.`}
              </Text>
            </View>
            <Pressable onPress={() => go(flow.youthOrFreeAgent())} style={{ marginTop: 20, borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.2)" } as ViewStyle}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1.6 }}>{youthClub ? `REPORT TO ${youthClub.toUpperCase()} →` : "GO HOME →"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900", letterSpacing: 2.6 }}>A SCOUT HAS SPOTTED YOU</Text>
            </View>
            <Text style={{ marginTop: 24, color: "#6ee7b7", fontSize: 11, fontWeight: "900", letterSpacing: 2.2 }}>{offers.length === 1 ? "ONE CLUB CAME IN" : `${offers.length} CLUBS CAME IN`}</Text>
            <View style={{ marginTop: 8, gap: 12 }}>
              {offers.map((o) => {
                const glow = clubGlow(o.club);
                return (
                  <View key={o.club} style={offerCard(glow)}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 40, height: 40 }}>
                        <View pointerEvents="none" style={{ position: "absolute", left: -8, right: -8, top: -8, bottom: -8, borderRadius: 999, backgroundImage: `radial-gradient(closest-side, ${rgba(glow, 0.5)}, transparent)` } as ViewStyle} />
                        <ClubCrest club={o.club} size={40} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{o.club}</Text>
                        <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 }}>{leagueNameFor(o.division).toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700", fontStyle: "italic", lineHeight: 17 }}>“{o.pitch}”</Text>
                    <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                      <OfferTerm label="Wage" value={`${formatMoney(o.wage)}/wk`} />
                      <OfferTerm label="Per goal" value={formatMoney(o.goalBonus)} />
                      <OfferTerm label="Years" value={`${o.seasons}`} />
                    </View>
                    <Pressable onPress={() => go(flow.signTrialOffer(o))} style={{ marginTop: 12, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundImage: "linear-gradient(180deg, #34d399, #059669)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.35), 0px 6px 14px -6px rgba(16,185,129,0.7)" } as ViewStyle}>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1.6 }}>{`SIGN FOR ${o.club.toUpperCase()}`}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Your first contract, signed (TrialReward). */
export function SignedScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const c = career.contract;
  const onLoan = career.placement?.kind === "loan";
  const [signed, setSigned] = useState(false);
  // The packed app signs in its 3D office; the phone's signing is the website's
  // drawn one (Signing.tsx), then straight on (a loan first says where you go).
  if (!signed) {
    const done = () => (onLoan ? setSigned(true) : go(flow.finishSigning()));
    return <SigningMoment career={career} club={c.club} managerName={career.manager?.name || loadLineup(c.club)?.manager || "The manager"} onDone={done} />;
  }
  return (
    <Frame kicker="Signed" title={c.club} footer={<Btn label="Let's go" onPress={() => go(flow.finishSigning())} />}>
      <Card style={{ alignItems: "center" }}>
        <ClubCrest club={c.club} size={84} />
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "900", marginTop: 10 }}>{career.player.firstName} {career.player.lastName}</Text>
        <Text style={{ color: C.gold, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginTop: 2 }}>PROFESSIONAL PLAYER</Text>
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
