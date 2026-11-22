/**
 * THE RULE BOOK — the phone port of components/star/RuleBookScreen.tsx.
 * Pick a governing body (FA, UEFA, FIFA, CONMEBOL), invest money for
 * influence, stand for its presidency, add an optional bribe (with or
 * without lawyers), and put rule changes to a vote (points, draws, match
 * length, banned boots, offside, squad size; UEFA also: England's European
 * slots, the Champions League format, Saudi clubs in Europe). Also: force a
 * club into the Premier League, create a new competition.
 *
 * Not on the phone: voting a custom club into Europe. Custom clubs live in
 * the website's database (lib/star/customClubs.ts), which the phone app does
 * not reach; the website shows "No custom clubs on file yet" the same way.
 */
import { useMemo, useState } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { GOVERNING_BODIES, GOVERNING_BODY_COMPETITIONS, influenceIn, canProposeRuleChange, type GoverningBody } from "@/lib/star/governingBodies";
import { ruleBookFor, RULE_OVERRULE_INFLUENCE_THRESHOLD, type RuleBook } from "@/lib/star/ruleBook";
import { BOOTS_CATALOGUE } from "@/lib/star/shopData";
import { allInvestableClubs } from "@/lib/star/investments";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { LAWYER_FEE } from "@/lib/star/corruption";
import { isBodyPresident, canStandForBodyPresidency } from "@/lib/star/leadership";
import { formatMoney } from "@/lib/star/money";
import { useCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { Frame, Card, C } from "../../world/lookKit";

import { NumBox, TextBox, Choose, Problem, SmallBtn, Line, Small, Head, KitTabs } from "./politicsKit";
import * as P from "../../world/politics";

/** A rule's own line: 11 px semibold on a 16.5 px line, 8 px to its buttons. */
const BODY = { color: C.text, fontSize: 11, lineHeight: 16.5, fontWeight: "600", marginBottom: 8 } as const;
/** The rule cards sit 8 px apart (the page's gap is 10). */
const RULE = { marginBottom: -2 } as const;

export function RuleBookScreen() {
  const career = useCareer();
  const nav = useNav();
  const [body, setBody] = useState<GoverningBody>("FA");
  const [investAmount, setInvestAmount] = useState<number | null>(10000);
  const [message, setMessage] = useState<string | null>(null);
  const [bribeAmount, setBribeAmount] = useState<number | null>(0);
  const [useLawyers, setUseLawyers] = useState(false);
  const [banBoot, setBanBoot] = useState(BOOTS_CATALOGUE[0]?.id ?? "");
  const outside = useMemo(() => allInvestableClubs().filter((c) => !PREMIER_LEAGUE_CLUBS.includes(c)).slice(0, 100), []);
  const [incomingClub, setIncomingClub] = useState(outside[0] ?? "");
  const [newCompName, setNewCompName] = useState("Super League");
  const [invested, setInvested] = useState(false);
  if (!career) return null;
  const rules = ruleBookFor(career, body);
  const influence = influenceIn(career, body);
  const canPropose = canProposeRuleChange(career, body);
  const canForce = influenceIn(career, "FA") >= RULE_OVERRULE_INFLUENCE_THRESHOLD;
  const latest = (career.newCompetitions ?? [])[(career.newCompetitions ?? []).length - 1];
  const bribe = (bribeAmount ?? 0) > 0 ? { amount: bribeAmount ?? 0, useLawyers } : undefined;

  const run = (r: P.ActionResult) => { setMessage(r.ok ? null : (r.reason ?? "That didn't go through.")); return r; };
  /** A proposal goes straight to the vote (page.tsx: phase "vote-ceremony"). */
  const propose = (change: Partial<RuleBook>) => {
    const r = P.proposeRule(body, change, bribe);
    if (!r.ok) { run(r); return; }
    nav.replace("vote-ceremony", { vote: r.vote });
  };
  const ProposeBtn = ({ label, change }: { label: string; change: Partial<RuleBook> }) => <SmallBtn tone="blue" disabled={!canPropose} label={label} onPress={() => propose(change)} />;

  return (
    <Frame kicker="Governing bodies" title="Rule Book" onBack={() => nav.back()}>
      <View style={{ marginBottom: 2 }}><KitTabs value={body} onChange={(b) => { setBody(b); setMessage(null); }} tabs={GOVERNING_BODIES.map((b) => [b, b] as const)} /></View>

      <Card style={{ marginBottom: 2 }}>
        <Head color={C.text}>Controls</Head>
        <Text style={{ color: C.text, fontSize: 11, lineHeight: 16.5, fontWeight: "600", marginTop: -2 }}>{GOVERNING_BODY_COMPETITIONS[body].join(", ")}</Text>
      </Card>

      <Card style={{ marginBottom: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: C.text, fontSize: 14, lineHeight: 20, fontWeight: "900" }}>Your influence</Text>
          <Text style={{ color: "#6ee7b7", fontSize: 14, lineHeight: 20, fontWeight: "900" }}>{influence.toFixed(1)} / 100</Text>
        </View>
        <View style={{ height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 8, backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.55))", boxShadow: "inset 0px 1px 3px rgba(0,0,0,0.8), inset 0px 0px 0px 1px rgba(255,255,255,0.22)" } as ViewStyle}>
          <View style={{ width: `${Math.min(100, influence)}%`, height: "100%", borderRadius: 6, backgroundImage: "linear-gradient(90deg, #10b981, #6ee7b7)" } as ViewStyle} />
        </View>
        {invested ? <Small color="#6ee7b7">Influence up</Small> : null}
        <Line>
          <NumBox value={investAmount} onChange={(n) => { setInvestAmount(n); setInvested(false); }} />
          <SmallBtn flex={false} tone="green" label="Invest" disabled={!investAmount || investAmount > career.money}
            onPress={() => { if (run(P.investIn(body, investAmount ?? 0)).ok) setInvested(true); }} />
        </Line>
        {!canPropose && <View style={{ marginTop: 6 }}><Small color={C.text}>Needs real influence before you can propose a rule change.</Small></View>}
      </Card>

      <Card style={{ marginBottom: 2 }}>
        <Head color="#fcd34d">President / King (§5)</Head>
        {isBodyPresident(career, body) ? (
          <Text style={{ color: "#fde68a", fontSize: 11, lineHeight: 16.5, fontWeight: "700" }}>You are president of {body} — you can propose any rule change here regardless of influence, and overrule any vote in it outright.</Text>
        ) : (
          <>
            <Text style={BODY}>Needs 90+ world reputation and 90+ influence in this body — the "president or king" end-game the brief itself named, built as president of a governing body rather than an invented country.</Text>
            <SmallBtn tone="amber" disabled={!canStandForBodyPresidency(career, body)} label={`Stand for president of ${body}`}
              onPress={() => { const r = P.standForBody(body); if (!r.ok) run(r); else nav.replace("vote-ceremony", { vote: r.vote }); }} />
          </>
        )}
      </Card>

      <Problem text={message} />

      <Card style={{ marginBottom: 2 }}>
        <Head color="#d8b4fe">Corruption (optional, Phase 5)</Head>
        <Line><NumBox value={bribeAmount} onChange={setBribeAmount} placeholder="Bribe amount" /></Line>
        <Press onPress={() => setUseLawyers(!useLawyers)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <View style={{ width: 13, height: 13, borderRadius: 2.5, borderWidth: 1, borderColor: useLawyers ? "#3b82f6" : "#767676", backgroundColor: useLawyers ? "#3b82f6" : "#fff", alignItems: "center", justifyContent: "center" }}>
            {useLawyers ? <Text style={{ color: "#fff", fontWeight: "900", fontSize: 9, lineHeight: 11 }}>✓</Text> : null}
          </View>
          {/* the fee is the real one (LAWYER_FEE); the website's label still says a fixed ★5000 */}
          <Text style={{ flex: 1, color: C.text, fontSize: 10, lineHeight: 15, fontWeight: "400" }}>Hire lawyers first (★{formatMoney(LAWYER_FEE)} — cuts the risk of getting caught, doesn't remove it)</Text>
        </Press>
        <View style={{ marginTop: 6 }}><Small color={C.text}>{(bribeAmount ?? 0) > 0 ? "Any proposal below will try to sway real votes toward yes, at a real risk." : "Leave at 0 to just propose honestly."}</Small></View>
      </Card>

      <Card style={RULE}>
        <Head color={C.text}>Points per result</Head>
        <Text style={BODY}>Win {rules.points.win} · Draw {rules.points.draw} · Loss {rules.points.loss}</Text>
        <ProposeBtn label="Propose: 2 points for a win" change={{ points: { win: 2, draw: 1, loss: 0 } }} />
      </Card>
      <Card style={RULE}>
        <Head color={C.text}>Draws</Head>
        <Text style={BODY}>{rules.noDraws ? "Every draw goes to penalties" : "Draws stand, as normal"}</Text>
        <ProposeBtn label={`Propose: ${rules.noDraws ? "Bring back draws" : "Abolish draws — penalties every time"}`} change={{ noDraws: !rules.noDraws }} />
      </Card>
      <Card style={RULE}>
        <Head color={C.text}>Match length</Head>
        <Text style={BODY}>{rules.matchLengthMinutes} minutes</Text>
        <Line><ProposeBtn label="Propose: 60 minutes" change={{ matchLengthMinutes: 60 }} /><ProposeBtn label="Propose: 120 minutes" change={{ matchLengthMinutes: 120 }} /></Line>
      </Card>
      <Card style={RULE}>
        <Head color={C.text}>Banned equipment</Head>
        <Text style={BODY}>{rules.bannedItems.length > 0 ? `Banned: ${rules.bannedItems.join(", ")}` : "Nothing currently banned"}</Text>
        <Line>
          <Choose value={banBoot} onChange={setBanBoot} options={BOOTS_CATALOGUE.map((b) => [b.id, b.name] as const)} />
          <SmallBtn flex={false} tone="blue" disabled={!canPropose} label={rules.bannedItems.includes(banBoot) ? "Unban" : "Ban"}
            onPress={() => propose({ bannedItems: rules.bannedItems.includes(banBoot) ? rules.bannedItems.filter((id) => id !== banBoot) : [...rules.bannedItems, banBoot] })} />
        </Line>
      </Card>
      <Card style={RULE}>
        <Head color={C.text}>Offside</Head>
        <Text style={BODY}>{rules.offsideAbolished ? "Abolished — nobody is ever offside" : "The law applies, as normal"}</Text>
        <ProposeBtn label={`Propose: ${rules.offsideAbolished ? "Bring back offside" : "Abolish offside entirely"}`} change={{ offsideAbolished: !rules.offsideAbolished }} />
      </Card>
      <Card style={RULE}>
        <Head color={C.text}>Squad size per side</Head>
        <Text style={BODY}>{rules.squadSize} a side</Text>
        <Line><ProposeBtn label="Propose: 9 a side" change={{ squadSize: 9 }} /><ProposeBtn label="Propose: 20 a side" change={{ squadSize: 20 }} /></Line>
        <View style={{ marginTop: 6 }}><Small color={C.text}>Real, votable data — the match/team-sheet engine still assumes 11 a side, so this doesn't change anything on the pitch yet.</Small></View>
      </Card>

      {body === "UEFA" && (
        <Card>
          <Head color={C.text}>European slots for England</Head>
          <Text style={BODY}>+{rules.extraChampionsLeagueSlots} Champions League · +{rules.extraEuropaLeagueSlots} Europa League</Text>
          <Line>
            <ProposeBtn label="+1 Champions League" change={{ extraChampionsLeagueSlots: rules.extraChampionsLeagueSlots + 1 }} />
            <ProposeBtn label="+1 Europa League" change={{ extraEuropaLeagueSlots: rules.extraEuropaLeagueSlots + 1 }} />
          </Line>
          <View style={{ height: 12 }} />
          <Head color={C.text}>Champions League format</Head>
          <Text style={BODY}>{rules.championsLeagueFormat === "groups" ? "Groups of 4, then knockout" : "Single league-table phase"}</Text>
          <ProposeBtn label={`Propose: ${rules.championsLeagueFormat === "groups" ? "Revert to the league phase" : "Groups of 4, then knockout"}`} change={{ championsLeagueFormat: rules.championsLeagueFormat === "groups" ? "league" : "groups" }} />
          <View style={{ marginTop: 6 }}><Small color={C.text}>Real, votable data — the actual Champions League simulation still runs the current format regardless.</Small></View>
          <View style={{ height: 12 }} />
          <Head color={C.text}>Saudi clubs in Europe</Head>
          <Text style={BODY}>{rules.saudiClubsInEurope ? "Active — two Saudi Pro League clubs join the Champions League and two join the Europa League each season." : "Not active — the Saudi Pro League has no entrants in either competition."}</Text>
          <ProposeBtn label={`Propose: ${rules.saudiClubsInEurope ? "Remove Saudi clubs from Europe" : "Let Saudi clubs into Europe"}`} change={{ saudiClubsInEurope: !rules.saudiClubsInEurope }} />
          <View style={{ marginTop: 6 }}><Small color={C.text}>Real: two of the four Saudi clubs join each competition, randomly replacing eligible clubs — England/Spain/Italy/Germany/France's clubs are always exempt, and the two Champions League clubs bumped out drop into the Europa League that season rather than disappearing.</Small></View>
          <View style={{ height: 12 }} />
          <Head color={C.text}>Custom clubs in Europe</Head>
          {rules.customClubEntries.length > 0 && (
            <Text style={[BODY, { marginBottom: 6 }]}>{rules.customClubEntries.map((e) => `${e.customClub} in the ${e.competition === "champions" ? "Champions" : "Europa"} League (replacing ${e.replaces})`).join(" · ")}</Text>
          )}
          <Small color={C.text}>No custom clubs on file on the phone — they are made on the website.</Small>
        </Card>
      )}

      <Card>
        <Head color="#fca5a5">Force a club into the Premier League</Head>
        <Text style={BODY}>Needs {RULE_OVERRULE_INFLUENCE_THRESHOLD}+ FA influence — the same bar as overruling a vote outright.</Text>
        <Line>
          <Choose value={incomingClub} onChange={setIncomingClub} options={outside.map((c) => [c, c] as const)} />
          <SmallBtn flex={false} tone="red" disabled={!canForce || !incomingClub} label="Force it in" onPress={() => run(P.forceIntoPremierLeague(incomingClub))} />
        </Line>
      </Card>

      <Card>
        <Head color={C.text}>Create a new competition</Head>
        <Line>
          <TextBox value={newCompName} onChange={setNewCompName} />
          <SmallBtn flex={false} tone="blue" disabled={!canPropose || !newCompName} label="Create" onPress={() => run(P.newCompetition(newCompName, [...PREMIER_LEAGUE_CLUBS]))} />
        </Line>
        {latest?.winner ? <View style={{ marginTop: 6 }}><Small color="#6ee7b7">{latest.name}: {latest.winner} won it, seeing off the whole bracket.</Small></View> : null}
      </Card>

      <Text style={{ color: C.text, fontSize: 9, lineHeight: 13.5, fontWeight: "600", textAlign: "center" }}>Only the FA's rule book actually reaches your own league and matches right now — the other bodies are real, but nothing they govern is simulated deeply enough yet to feel it.</Text>
    </Frame>
  );
}
