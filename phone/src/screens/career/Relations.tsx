/**
 * RELATIONSHIPS (RelationsPage.tsx, and page.tsx's relationship-game).
 *
 * The page: your manager, the dressing room and the fans, each with its bar
 * and its game (once a week, one day and a training session's energy); the
 * national manager; sponsors; reputation and fame.
 *
 * The games (relgames/RelationshipGame.tsx), ported where they are not played
 * on the match engine:
 *   boss      → pick 1 of 3: Office talk (lib/star/bossTalk.ts) is here;
 *               Penalties and Extra session are played on the match
 *               (screens/MatchRelGames.tsx, the phone's EngineFeature).
 *   team      → Woodwork challenge: on the match (screens/MatchRelGames.tsx).
 *   fans      → Signing session: a timed drawing game, still to come.
 *   happiness → Day off: here.
 * Every result goes through flow.relationshipGameDone (handleRelationshipGameComplete).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { actionsLeft } from "@/lib/star/week";
import { getTuning } from "@/lib/star/tuningStore";
import { gamePlayedThisWeek } from "@/lib/star/relationships";
import { fameOf } from "@/lib/star/fame";
import { brandsOf, type BrandDeal } from "@/lib/star/sponsorDeals";
import { intlOf, managerLine, SQUAD_AT, START_AT } from "@/lib/star/intl/career";
import { talkFor, talkGain, talkHits, TALK_ROUNDS, type TalkReply, type Grade } from "@/lib/star/bossTalk";
import * as flow from "../../game/flow";
import { Press } from "../../ui/Press";
import { TourTarget } from "../../ui/tour";
import { Frame, Card, Btn, Fill, StandInNote, C } from "./kit";
import { BossPenalties, BossExtraSession, WoodworkChallenge } from "../MatchRelGames";

type Kind = flow.RelKind;
const GAME_LABEL: Record<Kind, string> = { boss: "The manager's penalties", team: "Woodwork challenge", fans: "Signing session", happiness: "Day off" };
const TONE: Record<Kind, string> = { boss: "#60a5fa", team: "#34d399", fans: "#f472b6", happiness: "#c084fc" };
const HELP: Record<string, string> = {
  boss: "A good relationship with your boss means you get picked more often. His game: three penalties, each where he tells you.",
  team: "A good relationship with the team means you'll get more chances during a match.",
  fans: "Happy fans lift you in home matches, open up some sponsor deals and set the tone online.",
  sponsors: "Each brand has its own happiness, on the Sponsors screen. It decides whether they renew.",
  reputation: "How the people who run football see you.",
  fame: "Goals, trophies and what you own make you famous.",
};
const toneOf = (v: number) => (v >= 70 ? "#10b981" : v >= 40 ? "#eab308" : "#ef4444");

function Bar({ value }: { value: number }) {
  return (
    <View style={{ height: 18, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", justifyContent: "center" }}>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: toneOf(value) }} />
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11, paddingLeft: 6 }}>{Math.round(value)}</Text>
    </View>
  );
}

export function RelationsScreen({ career, go, onBack }: { career: CareerState; go: (s: flow.Step, push?: boolean) => void; onBack: () => void }) {
  const [help, setHelp] = useState<string | null>(null);
  const left = actionsLeft(career);
  const cost = getTuning("energy.trainingCost");
  const tired = career.energy < cost;
  const canPlay = left > 0 && !tired;
  const r = career.relationships;
  const brands = brandsOf(career);
  const intl = intlOf(career);
  const row = (k: Kind, name: string, value: number, icon: string) => {
    const done = gamePlayedThisWeek(career.relGamesPlayed, career.season, career.week, k);
    return (
      <Card key={k}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 26 }}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Press onPress={() => setHelp(help === k ? null : k)}><Text style={{ color: C.text, fontWeight: "900", marginBottom: 4 }}>{name} <Text style={{ color: C.dim }}>?</Text></Text></Press>
            <Bar value={value} />
          </View>
          <TourTarget name={`rel-${k}`} onPress={() => { if (canPlay && !done) go({ screen: "career-relationship-game", params: { kind: k } }, true); }}>
          <Press disabled={!canPlay || done} onPress={() => go({ screen: "career-relationship-game", params: { kind: k } }, true)}
            style={{ width: 48, height: 48, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: !canPlay || done ? "rgba(255,255,255,0.06)" : TONE[k] }}>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{done ? "✓" : "▶"}</Text>
          </Press>
          </TourTarget>
        </View>
        <Text style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>{done ? `${GAME_LABEL[k]} · done this week` : tired ? `${GAME_LABEL[k]} · not enough energy` : `${GAME_LABEL[k]} · 1 day, ${cost} energy`}</Text>
        {help === k && <Text style={{ color: C.text, fontSize: 12, marginTop: 6 }}>{HELP[k]}</Text>}
      </Card>
    );
  };
  const plain = (key: string, icon: string, name: string, value?: number, onPress?: () => void, line?: string, dot?: boolean) => (
    <Press key={key} disabled={!onPress && !line && !HELP[key]} onPress={onPress ?? (() => setHelp(help === key ? null : key))}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 22 }}>{icon}</Text>
          <Text style={{ color: C.text, fontWeight: "900", flex: 1 }}>{name}{dot ? " •" : ""}</Text>
          {value !== undefined && <Text style={{ color: C.text, fontWeight: "900" }}>{Math.round(value)}</Text>}
          {onPress && <Text style={{ color: C.dim, fontSize: 18 }}>›</Text>}
        </View>
        {value !== undefined && <View style={{ marginTop: 6 }}><Fill value={Math.min(100, value)} color="#38bdf8" height={6} /></View>}
        {help === key && <Text style={{ color: C.text, fontSize: 12, marginTop: 6 }}>{line ?? HELP[key]}</Text>}
      </Card>
    </Press>
  );
  return (
    <Frame kicker={`${left} day${left === 1 ? "" : "s"} left this week · ⚡ ${Math.round(career.energy)}`} title="Relationships" onBack={onBack}>
      {row("boss", career.manager?.name ? `Boss · ${career.manager.name}` : "Boss", r.boss, "🗣️")}
      {row("team", "Team", r.team, "🤝")}
      {row("fans", "Fans", r.fans, "📣")}
      {plain("intl", "🌍", `${intl.nation} manager`, intl.manager, undefined,
        `${managerLine(career)} He picks his squad from ${SQUAD_AT} and starts you from ${START_AT}. Good club games move him — more in a higher division, and a big nation is harder to impress.`)}
      {plain("sponsors", "🤝", brands.deals.length ? `Sponsors · ${brands.deals.length} deal${brands.deals.length === 1 ? "" : "s"}` : "Sponsors", undefined, () => go({ screen: "sponsors" }, true), undefined, brands.offers.length > 0)}
      {career.girlfriend ? plain("partner", "❤️", `${career.girlfriend.name}`, career.relationships.girlfriend ?? undefined) : plain("partner", "🖤", "Single")}
      {plain("reputation", "🌐", "Reputation", career.reputation)}
      {plain("fame", "✨", "Fame", Math.min(100, fameOf(career)))}
    </Frame>
  );
}

// ── The games ──
function Shell({ title, who, current, tone, onBack, children }: { title: string; who: string; current: number; tone: string; onBack?: () => void; children: React.ReactNode }) {
  return (
    <Frame title={title} kicker={who} onBack={onBack}>
      <Card><Text style={{ color: C.text, fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 4 }}>{who.toUpperCase()}</Text><Bar value={current} /></Card>
      <View style={{ height: 2, backgroundColor: tone, borderRadius: 1 }} />
      {children}
    </Frame>
  );
}
function Result({ res, who, current, onContinue }: { res: flow.RelGameResult; who: string; current: number; onContinue: () => void }) {
  const after = Math.max(0, Math.min(100, current + res.gain));
  const sign = res.gain > 0 ? `+${res.gain}` : `${res.gain}`;
  return (
    <Card tone={res.won ? "#34d399" : "#ef4444"} style={{ alignItems: "center", backgroundColor: res.won ? "rgba(6,78,59,0.8)" : "rgba(69,10,10,0.8)" }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: "900" }}>{res.won ? "NICE ONE" : "NOT THIS TIME"}</Text>
      {res.line ? <Text style={{ color: C.text, fontWeight: "700", marginTop: 4 }}>{res.line}</Text> : null}
      <Text style={{ color: C.text, fontWeight: "900", marginTop: 8, textAlign: "center" }}>
        {res.gain === 0 ? `${who} stays at ${Math.round(current)}.${res.won ? " The higher it is, the harder it moves." : ""}` : `${who} ${sign}: ${Math.round(current)} → ${Math.round(after)}`}
      </Text>
      {res.cost ? <Text style={{ color: "#fde68a", fontWeight: "700", marginTop: 4 }}>Cost ★{res.cost.toLocaleString("en-GB")}</Text> : null}
      <View style={{ alignSelf: "stretch", marginTop: 10 }}><Btn label="Continue →" onPress={onContinue} /></View>
    </Card>
  );
}

const BOSS_GAMES = [
  { id: "penalties", icon: "🎯", name: "Penalties", line: "He names a spot. Hit it. Three kicks.", engine: true },
  { id: "talk", icon: "💬", name: "Office talk", line: "Three questions. Say what he wants to hear.", engine: false },
  { id: "session", icon: "⚽", name: "Extra session", line: "Four shots while he watches. Each one harder.", engine: true },
] as const;

export function RelGameScreen({ career, kind, go, onBack }: { career: CareerState; kind: Kind; go: (s: flow.Step) => void; onBack: () => void }) {
  const [boss, setBoss] = useState<"talk" | "penalties" | "session" | null>(null);
  const finish = (res: flow.RelGameResult) => go(flow.relationshipGameDone(kind, res));
  if (kind === "boss" && boss === "talk") return <OfficeTalk career={career} onFinish={finish} onCancel={() => setBoss(null)} />;
  if (kind === "boss" && boss === "penalties") return <BossPenalties career={career} onFinish={finish} onCancel={() => setBoss(null)} />;
  if (kind === "boss" && boss === "session") return <BossExtraSession career={career} onFinish={finish} onCancel={() => setBoss(null)} />;
  if (kind === "team") return <WoodworkChallenge career={career} onFinish={finish} onCancel={onBack} />;
  if (kind === "boss") {
    return (
      <Shell title="Your manager" who="Boss" current={career.relationships.boss} tone={TONE.boss} onBack={onBack}>
        <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{career.manager?.name ?? "The manager"} has a few minutes. How do you spend them?</Text>
        {BOSS_GAMES.map((g) => (
          <Press key={g.id} onPress={() => setBoss(g.id)}>
            <Card tone="#93c5fd" style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(59,130,246,0.2)" }}>
              <Text style={{ fontSize: 28 }}>{g.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{g.name.toUpperCase()}</Text>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{g.line}</Text>
              </View>
              <Text style={{ color: "#bfdbfe", fontSize: 18, fontWeight: "900" }}>›</Text>
            </Card>
          </Press>
        ))}
        <Text style={{ color: C.dim, fontSize: 12 }}>All three move the Boss bar the same amount: up to +6, or −2 if it goes badly.</Text>
      </Shell>
    );
  }
  if (kind === "happiness") return <DayOff career={career} onFinish={finish} onCancel={onBack} />;
  return (
    <Shell title={GAME_LABEL[kind]} who="Fans" current={career.relationships[kind]} tone={TONE[kind]} onBack={onBack}>
      <StandInNote>The signing session is still to come on the phone.</StandInNote>
      <Btn kind="plain" label="Back" onPress={onBack} />
    </Shell>
  );
}

function OfficeTalk({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: flow.RelGameResult) => void; onCancel: () => void }) {
  const talk = useMemo(() => talkFor(career, Date.now() % 100000), [career]);
  const current = career.relationships.boss;
  const boss = career.manager?.name ?? "The manager";
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<TalkReply | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const [result, setResult] = useState<flow.RelGameResult | null>(null);
  const r = talk.rounds[Math.min(round, TALK_ROUNDS - 1)];
  const pick = (rep: TalkReply) => {
    if (picked || result) return;
    setPicked(rep);
    const g = [...grades, rep.grade];
    setGrades(g);
    setTimeout(() => {
      const next = round + 1;
      if (next >= TALK_ROUNDS) {
        const hits = talkHits(g);
        setResult({ won: hits > 0, gain: talkGain(g), line: hits === TALK_ROUNDS ? "He liked every answer." : hits > 0 ? "That went well enough." : "You didn't get through to him." });
      } else { setLast(rep.answer); setRound(next); setPicked(null); }
    }, 1300);
  };
  const bubble = (who: string, text: string, mine?: boolean, faded?: boolean) => (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", opacity: faded ? 0.6 : 1 }}>
      <View style={{ maxWidth: "85%", backgroundColor: mine ? "#059669" : "#334155", borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Text style={{ color: C.text, fontSize: 11, fontWeight: "900" }}>{who.toUpperCase()}</Text>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: "700" }}>{text}</Text>
      </View>
    </View>
  );
  return (
    <Shell title="Office talk" who="Boss" current={current} tone={TONE.boss} onBack={round === 0 && !picked ? onCancel : undefined}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: C.text, fontWeight: "900" }}>QUESTION {Math.min(round + 1, TALK_ROUNDS)} / {TALK_ROUNDS}</Text>
        <Text>{grades.map((g, i) => <Text key={i} style={{ color: g === "best" ? "#6ee7b7" : g === "clash" ? "#f87171" : C.dim }}>● </Text>)}</Text>
      </View>
      {last && bubble(boss, last, false, true)}
      {bubble(boss, r.line)}
      {!picked && !result && r.replies.map((rep) => (
        <Press key={rep.text} onPress={() => pick(rep)} style={{ backgroundColor: "rgba(59,130,246,0.2)", borderWidth: 1, borderColor: "#93c5fd", borderRadius: 4, padding: 12 }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>{rep.text}</Text>
        </Press>
      ))}
      {picked && bubble("You", picked.text, true)}
      {picked && bubble(boss, picked.answer)}
      {result && <Result res={result} who="Boss" current={current} onContinue={() => onFinish(result)} />}
    </Shell>
  );
}

/** relgames/DayOff.tsx dayOffOptions. */
function dayOffOptions(career: Pick<CareerState, "contract" | "ownedItems">) {
  const wage = Math.max(1, career.contract?.wage ?? 0);
  const hasGarden = (career.ownedItems ?? []).some((i) => i.category === "property");
  return [
    { id: "home", icon: hasGarden ? "🏡" : "🛋️", name: hasGarden ? "Chill in the garden" : "Put your feet up", gain: hasGarden ? 7 : 5, cost: 0 },
    { id: "golf", icon: "⛳", name: "A round of golf", gain: 9, cost: Math.round(wage * 0.2) },
    { id: "trip", icon: "✈️", name: "A weekend away", gain: 14, cost: Math.round(wage * 0.6) },
  ];
}
function DayOff({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: flow.RelGameResult) => void; onCancel: () => void }) {
  const current = career.happiness;
  const [result, setResult] = useState<flow.RelGameResult | null>(null);
  return (
    <Shell title="Day off" who="You" current={current} tone={TONE.happiness} onBack={result ? undefined : onCancel}>
      {!result && <Text style={{ color: C.text, fontWeight: "700" }}>How do you want to spend it? Happier players get more energy back when they rest.</Text>}
      {!result && dayOffOptions(career).map((o) => {
        const short = o.cost > career.money;
        return (
          <Press key={o.id} disabled={short} onPress={() => setResult({ won: true, gain: Math.min(o.gain, 100 - current), cost: o.cost, line: `${o.name}. Just what you needed.` })}>
            <Card tone="#d8b4fe" style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: short ? 0.4 : 1, backgroundColor: "rgba(168,85,247,0.2)" }}>
              <Text style={{ fontSize: 28 }}>{o.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>{o.name}</Text>
                <Text style={{ color: C.text, fontSize: 12, fontWeight: "700" }}>{o.cost ? `★${o.cost.toLocaleString("en-GB")}` : "Free"}{short ? " · not enough money" : ""}</Text>
              </View>
              <Text style={{ color: "#e9d5ff", fontWeight: "900" }}>+{o.gain}</Text>
            </Card>
          </Press>
        );
      })}
      {result && <Result res={result} who="Happiness" current={current} onContinue={() => onFinish(result)} />}
    </Shell>
  );
}

// ── A sponsor's game: Shoot an advert (relgames/AdvertShoot.tsx) ──
const TAKES = 5;
const NEED = 3;
export const ADVERT_WIN = 10;
export const ADVERT_LOSS = -3;
export function AdvertShootScreen({ deal, go, onCancel }: { deal: BrandDeal; go: (s: flow.Step) => void; onCancel: () => void }) {
  const current = deal.happiness;
  const [take, setTake] = useState(0);
  const [good, setGood] = useState(0);
  const [pos, setPos] = useState(0);
  const [mark, setMark] = useState(() => 0.25 + Math.random() * 0.5);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [result, setResult] = useState<flow.RelGameResult | null>(null);
  const t0 = useRef(Date.now());
  const speed = 0.55 + take * 0.12;
  const posRef = useRef(0);
  useEffect(() => {
    if (result) return;
    let raf = 0;
    const tick = () => {
      const t = (Date.now() - t0.current) / 1000;
      const phase = (t * speed) % 2;
      posRef.current = phase < 1 ? phase : 2 - phase;
      setPos(posRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed, result]);
  const width = 0.16 - take * 0.015;
  const action = () => {
    if (result) return;
    const hit = Math.abs(posRef.current - mark) < width / 2;
    const g = good + (hit ? 1 : 0);
    setGood(g);
    setFlash(hit ? "ok" : "bad");
    setTimeout(() => setFlash(null), 300);
    const next = take + 1;
    if (next >= TAKES) {
      const won = g >= NEED;
      setResult({ won, gain: won ? ADVERT_WIN : ADVERT_LOSS, line: `${g} good takes out of ${TAKES}.` });
    } else { setTake(next); setMark(0.2 + Math.random() * 0.6); t0.current = Date.now(); }
  };
  return (
    <Shell title="Shoot an advert" who={`${deal.brand} happiness`} current={current} tone={deal.color} onBack={take === 0 && !result ? onCancel : undefined}>
      <Text style={{ color: C.text, fontWeight: "700" }}>Hit your mark when the director calls. {NEED} good takes out of {TAKES}.</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: C.text, fontWeight: "900" }}>TAKE {Math.min(take + 1, TAKES)} / {TAKES}</Text>
        <Text style={{ color: C.text, fontWeight: "900" }}>GOOD {good}</Text>
      </View>
      <View style={{ height: 70, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 2, borderColor: flash === "ok" ? "#34d399" : flash === "bad" ? "#ef4444" : "rgba(255,255,255,0.15)" }}>
        <View style={{ position: "absolute", top: 0, bottom: 0, left: `${(mark - width / 2) * 100}%`, width: `${width * 100}%`, backgroundColor: "rgba(16,185,129,0.5)" }} />
        <View style={{ position: "absolute", top: -6, bottom: -6, width: 6, marginLeft: -3, left: `${pos * 100}%`, backgroundColor: "#fff" }} />
        <Text style={{ position: "absolute", left: 0, right: 0, bottom: 4, textAlign: "center", color: C.text, fontSize: 11, fontWeight: "900" }}>🎬 {deal.brand.toUpperCase()}</Text>
      </View>
      {!result && <Press onPress={action} style={{ borderRadius: 4, paddingVertical: 16, alignItems: "center", backgroundColor: deal.color }}><Text style={{ color: "#111", fontSize: 18, fontWeight: "900" }}>ACTION!</Text></Press>}
      {result && <Result res={result} who={`${deal.brand} happiness`} current={current} onContinue={() => go(flow.advertShot(deal.id, result.gain))} />}
    </Shell>
  );
}
