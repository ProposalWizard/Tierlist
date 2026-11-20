"use client";

/**
 * THE LIVING WORLD — the test page (phase 1, Harry 20 Nov 2026; design
 * docs/plans/living-world-design-2026-11-20.md). The memory, the director, the
 * 30-event book and the three social actions on a sample career, in the
 * game's Glass look inside a phone-sized box. Off in the real career
 * (lib/star/life/flag.ts) until Harry says (RUL-UI-002). Nothing is saved.
 *
 * URL: ?event=<id> opens that event · ?prep=lived|followup|fresh picks the
 * sample · ?person=<n> opens the n-th person you know · ?social=chat|drive|races
 * with that person · ?outcome=<n> plays outcome n · ?full=1 fills the screen ·
 * ?shot=1 hides the test button (for stills).
 * Decision screens (Harry 20 Nov 15:35): ?clock=normal|long|off · ?screens=card
 * shows every event on the plain card · ?round=1 opens the round menu on a
 * team-mate over the bench still.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, PanelGrid, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import { pitchFont } from "@/components/star/ui/pitchFont";
import "@/components/star/ui/pitchLook.css";
import "@/components/star/ui/flat.css";
import "@/components/star/ui/glassLook.css";
import PeoplePage from "@/components/star/life/PeoplePage";
import EventCard, { ChatCard, OutcomeCard } from "@/components/star/life/EventCard";
import Telltale, { type TelltalePicked } from "@/components/star/life/Telltale";
import ToneDial, { type DialPicked } from "@/components/star/life/ToneDial";
import RoundMenu, { type RoundReply } from "@/components/star/life/RoundMenu";
import { STILL_GROUP, STILL_GROUP_OTHER, STILL_TALK, placeStill, pointOn, useStageSize } from "@/components/star/life/DecisionParts";
import { readClock, screenFor, speakerId, writeClock, type ClockSetting } from "@/lib/star/life/decision";
import { playRoundLine, roundMenuFor } from "@/lib/star/life/roundMenu";
import { roleOf } from "@/lib/star/life/people";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { NATIONAL_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { mulberry32 } from "@/lib/star/season";
import { LIFESTYLE_ALL_LEVELS } from "@/lib/star/shopData";
import { freshItem } from "@/lib/star/fame";
import { formatMoney, MONEY_SIGN } from "@/lib/star/money";
import type { CareerState, StarPlayer } from "@/lib/star/types";
import type { LifeMoment } from "@/lib/star/life/types";
import { EVENTS } from "@/lib/star/life/book";
import { lifeOf, pickEvent, startEvent, MAX_PER_WEEK, type LiveEvent } from "@/lib/star/life/director";
import { chooseOption, type ChoiceResult } from "@/lib/star/life/resolve";
import { chat, startOuting, type ChatResult, type SocialKind } from "@/lib/star/life/social";
import { autoPlay, rollMatch, turnWeek, weekMoments } from "@/lib/star/life/sim";
import { freshLife, lifeWeek, meet, personInfo, teamForMatch } from "@/lib/star/life/people";
import type { FactOverride } from "@/lib/star/life/facts";
import { actionsLeft } from "@/lib/star/week";
import { LIFE_IN_CAREER } from "@/lib/star/life/flag";

type View =
  | { kind: "people" }
  | { kind: "event"; live: LiveEvent }
  | { kind: "outcome"; live: LiveEvent; choiceId: string; result: ChoiceResult }
  | { kind: "chat"; id: string; result: ChatResult }
  | { kind: "telltale"; live: LiveEvent; before: CareerState; picked?: TelltalePicked }
  | { kind: "dial"; live: LiveEvent; before: CareerState; picked?: DialPicked }
  | { kind: "round"; id: string; reply?: RoundReply | null };

/** The bench still in place of the 3D world, for a talk with a team-mate in it. */
function backdropFor(live: LiveEvent) {
  const sp = speakerId(live);
  return live.event.template === "talk-scene" && sp && !sp.startsWith("oneoff:") && roleOf(sp) === "teammate" ? STILL_TALK : undefined;
}

/** The round menu over the bench still (the world kit puts it over the 3D world). */
function RoundStage({ career, id, reply, onPick, onClose }: { career: CareerState; id: string; reply?: RoundReply | null; onPick: Parameters<typeof RoundMenu>[0]["onPick"]; onClose: () => void }) {
  const [ref, size] = useStageSize<HTMLDivElement>();
  // His head where the ring goes (the ring leaves room under it for the lines).
  const placed = placeStill(size.w, size.h, STILL_GROUP, Math.max(0.3, (size.h - 424) / size.h), 1.18);
  const head = pointOn(placed, STILL_GROUP.focus.x, STILL_GROUP.focus.y);
  const other = pointOn(placed, STILL_GROUP_OTHER.x, STILL_GROUP_OTHER.y);
  const menu = roundMenuFor(career, id);
  return (
    <div ref={ref} className="relative h-full min-h-[560px] overflow-hidden bg-[#070d18]" data-round-stage>
      {placed.wide && <div className="absolute" style={{ inset: -30, backgroundImage: `url(${STILL_GROUP.src})`, backgroundSize: "cover", filter: "blur(18px) brightness(.6)" }} />}
      <div className="absolute" style={{ left: placed.left, top: placed.top, width: placed.width, height: placed.height, backgroundImage: `url(${STILL_GROUP.src})`, backgroundSize: "100% 100%" }} />
      <span className="absolute left-3 top-3 z-[30] rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/80">A still: the 3D world goes here</span>
      <RoundMenu menu={menu} anchor={{ x: head.x, y: head.y + placed.height * 0.03 }} size={size} onPick={onPick} onClose={onClose} reply={reply}
        others={[{ x: other.x + placed.width * 0.04, y: other.y - placed.height * 0.17, icon: "🏇" }]} />
    </div>
  );
}

const MOMENTS: [LifeMoment, string][] = [
  ["after-match", "After a match"], ["arrive:training", "Arriving at training"], ["home:evening", "Evening at home"],
  ["driving", "Driving"], ["walkout", "The walk-out"], ["leave:casino", "Leaving the casino"], ["season-end", "Season end"],
];
const MOMENT_WORD = Object.fromEntries(MOMENTS) as Record<string, string>;

/** The sample: a 22-year-old striker in the National League, season 3, a car, a real money ladder. */
function sampleCareer(carLevel = 3, horse = false): CareerState {
  const player = { firstName: "Sam", lastName: "Carter", age: 22, skinTone: "light", club: NATIONAL_LEAGUE_CLUBS[2], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c = makeInitialCareer(player, [...NATIONAL_LEAGUE_CLUBS], "national_league");
  // A generated squad has no ages or ratings; a real one does. Give the sample some.
  const squad = c.squad.map((p, i) => ({ ...p, age: p.age ?? [17, 29, 24, 31, 21, 26, 18, 33, 23, 27, 20, 25, 19, 30, 22, 28, 32, 24, 26, 21][i % 20], overall: p.overall ?? 58 + ((i * 7) % 20) }));
  const car = LIFESTYLE_ALL_LEVELS.find((i) => i.category === "vehicle" && (i.level ?? 1) === carLevel) ?? LIFESTYLE_ALL_LEVELS.find((i) => i.category === "vehicle");
  return {
    ...c, squad, season: 3, week: 12, fame: 42, energy: 62, weekActions: 3, clubAppearances: 48,
    money: c.contract.wage * 40,
    relationships: { ...c.relationships, boss: 58, team: 61, fans: 55 },
    ownedItems: carLevel > 0 && car ? [freshItem(car)] : [],
    horse: horse ? { name: "Late Winner", breed: "Thoroughbred", speed: 72, stamina: 68, energy: 100, racesRun: 3, racesWon: 1, earnings: 0 } : null,
  };
}

/** The follow-up sample: a team-mate crashed your car two weeks ago and is waiting with an envelope. */
function followUpSample(): CareerState {
  const c = sampleCareer();
  const life = freshLife();
  const now = lifeWeek(c);
  const mate = c.squad[3];
  const p = meet(life, mate.id, now - 6, mate.name);
  p.b = 52; p.r = 48;
  p.m = [["drove-him-to-mums-60th", now - 30, 3], ["crashed-your-car", now - 2, 3]];
  life.pending = [{ event: "drv-mate-crash-payback", due: now, cast: { mate: mate.id } }];
  life.roster = Object.fromEntries(c.squad.map((s) => [s.id, 0]));
  return { ...c, life };
}

export default function LifeTestPage() {
  const [career, setCareer] = useState<CareerState | null>(null);
  const [view, setView] = useState<View>({ kind: "people" });
  const [queue, setQueue] = useState<LifeMoment[]>([]);
  const [say, setSay] = useState<string | null>(null);
  const [facts, setFacts] = useState<FactOverride>({ lastLost: true, lastWon: false, lastRating: 6.1 });
  const [forceOutcome, setForceOutcome] = useState<number | undefined>(undefined);
  const [forceMini, setForceMini] = useState<"won" | "lost" | undefined>(undefined);
  const [pickId, setPickId] = useState(EVENTS[0].id);
  const [full, setFull] = useState(false);
  const [shot, setShot] = useState(false);
  const [carLevel, setCarLevel] = useState(3);
  const [horse, setHorse] = useState(false);
  const [clock, setClock] = useState<ClockSetting>("normal");
  const [plainCards, setPlainCards] = useState(false);
  const plainRef = useRef(false);
  plainRef.current = plainCards;
  const rng = useRef(mulberry32(20261120));

  const fresh = useCallback((kind: "fresh" | "lived" | "followup", lv = carLevel, h = horse) => {
    rng.current = mulberry32(20261120);
    let c = kind === "followup" ? followUpSample() : sampleCareer(lv, h);
    if (kind === "lived") c = autoPlay(c, 30, rng.current);
    setCareer(c); setView({ kind: "people" }); setQueue([]); setSay(null);
    return c;
  }, [carLevel, horse]);

  // Read the URL after the first paint, so the server and the browser agree.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const prep = (q.get("prep") ?? "lived") as "fresh" | "lived" | "followup";
    let c = fresh(prep === "fresh" || prep === "followup" ? prep : "lived");
    setFull(q.get("full") === "1"); setShot(q.get("shot") === "1");
    const oc = q.get("outcome"); if (oc !== null) setForceOutcome(Number(oc));
    const ev = q.get("event");
    if (ev) {
      const live = pickEvent(c, momentOf(ev), { rng: rng.current, force: ev, facts });
      if (live) { c = startEvent(c, live); setCareer(c); setView(eventView(live, c)); }
    }
    const pn = q.get("person"), soc = q.get("social") as SocialKind | null;
    if (pn !== null && soc) {
      const known = c.squad.filter((s) => c.life?.people[s.id]);
      const id = (known[Number(pn)] ?? c.squad[Number(pn)])?.id;
      if (id) setTimeout(() => social(soc, id, c), 0);
    }
    if (prep === "followup" && !ev) setTimeout(() => runMoments(c, ["arrive:training"]), 0);
    const ck = q.get("clock"); if (ck === "normal" || ck === "long" || ck === "off") { writeClock(ck); setClock(ck); } else setClock(readClock());
    if (q.get("screens") === "card") setPlainCards(true);
    if (q.get("round") === "1") { const id = c.squad.find((s) => c.life?.people[s.id])?.id ?? c.squad[0]?.id; if (id) setView({ kind: "round", id }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Which screen asks it: what the event says (Telltale, the dial), or the plain card. */
  const eventView = (live: LiveEvent, before: CareerState): View => {
    const sc = plainRef.current ? "card" : screenFor(live.event);
    return sc === "telltale" ? { kind: "telltale", live, before } : sc === "dial" ? { kind: "dial", live, before } : { kind: "event", live };
  };
  const momentOf = (id: string): LifeMoment => { const w = EVENTS.find((e) => e.id === id)?.trigger.when[0]; return w && w !== "followUp" ? w : "home:evening"; };

  const toast = (t: string) => { setSay(t); window.setTimeout(() => setSay((s) => (s === t ? null : s)), 2600); };

  /** Look for an event at each moment in turn; the first that fires is shown,
   *  the rest wait for Continue. False = nothing happened at any of them. */
  const runMoments = (c: CareerState, list: LifeMoment[]): boolean => {
    for (let i = 0; i < list.length; i++) {
      const live = pickEvent(c, list[i], { rng: rng.current, facts });
      if (!live) continue;
      const started = startEvent(c, live);
      setCareer(started);
      setQueue(list.slice(i + 1));
      setView(eventView(live, started));
      return true;
    }
    setQueue([]);
    setView({ kind: "people" });
    return false;
  };
  const moment = (m: LifeMoment) => { if (career && !runMoments(career, [m])) toast(`${MOMENT_WORD[m] ?? m}: nothing happened.`); };

  const playWeek = () => {
    if (!career) return;
    const f = rollMatch(rng.current);
    setFacts(f);
    const c = turnWeek(career, rng.current);
    setCareer(c);
    if (!runMoments(c, weekMoments(c))) toast(`Week ${c.week}: a quiet week. ${f.lastWon ? "Won" : f.lastLost ? "Lost" : "Drew"}, rated ${f.lastRating}.`);
  };

  const choose = (id: string, timedOut = false) => {
    if (!career || (view.kind !== "event" && view.kind !== "telltale" && view.kind !== "dial")) return;
    const r = chooseOption(career, view.live, id, { rng: rng.current, facts, forceOutcome, forceMinigame: forceMini });
    if (!r) return;
    setCareer(r.career);
    if (view.kind === "telltale") setView({ ...view, picked: { choiceId: id, result: r, timedOut } });
    else if (view.kind === "dial") setView({ ...view, picked: { choiceId: id, result: r, before: career } });
    else setView({ kind: "outcome", live: view.live, choiceId: id, result: r });
  };

  const roundPick = (line: Parameters<typeof playRoundLine>[2]) => {
    if (!career || view.kind !== "round") return;
    const r = playRoundLine(career, view.id, line, rng.current);
    setCareer(r.career);
    setView({ kind: "round", id: view.id, reply: { text: r.reply, delta: r.delta, key: Date.now() } });
  };
  const openRound = () => {
    if (!career) return;
    const id = career.squad.find((s) => career.life?.people[s.id])?.id ?? career.squad[0]?.id;
    if (id) setView({ kind: "round", id });
  };
  const openNamed = (id: string) => {
    if (!career) return;
    const live = pickEvent(career, momentOf(id), { rng: rng.current, force: id, facts });
    if (!live) { toast("Its people cannot be cast in this career (see its trigger)."); return; }
    const started = startEvent(career, live);
    setCareer(started);
    setView(eventView(live, started));
  };

  const next = () => {
    if (queue.length && career) { runMoments(career, queue); return; }
    setView({ kind: "people" });
  };

  function social(kind: SocialKind, id: string, base?: CareerState) {
    const c = base ?? career;
    if (!c) return;
    if (kind === "chat") {
      const r = chat(c, id, rng.current, facts);
      if (!r) return;
      setCareer(r.career); setView({ kind: "chat", id, result: r });
      return;
    }
    const o = startOuting(c, id, kind, rng.current, facts);
    if (!o) { toast("Not this week."); return; }
    setCareer(o.career);
    if ("live" in o) setView(eventView(o.live, o.career));
    else setView({ kind: "chat", id, result: o.plain });
  }

  const openEvent = () => {
    if (!career) return;
    openNamed(pickId);
  };

  const life = career ? lifeOf(career) : null;
  const now = career ? lifeWeek(career) : 0;
  const thisWeek = life && life.wk[0] === now ? life.wk[1] : 0;
  const bytes = useMemo(() => (career?.life ? JSON.stringify(career.life).length : 0), [career]);

  const screen = !career ? null
    : view.kind === "event" ? <EventCard career={career} live={view.live} onChoose={choose} />
    : view.kind === "outcome" ? <OutcomeCard career={career} live={view.live} choiceId={view.choiceId} result={view.result} onContinue={next} />
    : view.kind === "telltale" ? <Telltale key={view.live.id} career={view.picked ? career : view.before} live={view.live} clock={clock} backdrop={backdropFor(view.live)} onChoose={choose} picked={view.picked} onContinue={next} />
    : view.kind === "dial" ? <ToneDial key={view.live.id} career={career} live={view.live} onChoose={(id) => choose(id)} picked={view.picked} onContinue={next} />
    : view.kind === "round" ? <RoundStage career={career} id={view.id} reply={view.reply} onPick={roundPick} onClose={() => setView({ kind: "people" })} />
    : view.kind === "chat" ? <ChatCard career={career} id={view.id} result={view.result} onContinue={() => setView({ kind: "people" })} />
    : <PeoplePage career={career} onAction={(k, id) => social(k, id)} />;

  const phone = (
    <div className={`select-none star-root ${pitchFont.variable} star-look-pitch star-skin-glass`} data-life-phone
      style={full
        ? { position: "fixed", inset: 0, zIndex: 80, transform: "translateZ(0)", overflow: "hidden" }
        : { position: "relative", transform: "translateZ(0)", overflow: "hidden", width: "100%", maxWidth: 390, height: "min(844px, calc(100dvh - 150px))", minHeight: 560, margin: "0 auto", borderRadius: 18 }}>
      <div className="relative h-full overflow-y-auto overscroll-contain bg-[#05070d] text-white" data-life-scroll>
        {screen}
      </div>
      {say && <button type="button" onClick={() => setSay(null)} className="absolute bottom-6 left-1/2 z-[60] w-[86%] -translate-x-1/2 rounded-xl bg-black/85 px-3 py-2 text-[12px] font-bold text-white ring-1 ring-white/20">{say}</button>}
      {full && !shot && <button type="button" onClick={() => setFull(false)} className="absolute bottom-3 left-3 z-[61] rounded-lg bg-black/70 px-2.5 py-1.5 text-[11px] font-black text-white ring-1 ring-white/25">Test tools</button>}
    </div>
  );

  return (
    <BroadcastPage title="Living world" sub="People who remember, events with weight, time with team-mates. A test: nothing here reaches a career." width={1240}>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", alignItems: "start" }}>
        <div>{phone}</div>
        {career && (
          <div style={{ display: "grid", gap: 12 }}>
            <PanelGrid min={300}>
              <Panel title="The week" note={`Season ${career.season} · week ${career.week}`}>
                <Btn main onClick={playWeek}>▶ Play a week</Btn>{" "}
                <Btn onClick={() => { let c = career; for (let i = 0; i < 10; i++) c = turnWeek(c, rng.current); setCareer(c); setView({ kind: "people" }); toast("10 weeks later."); }}>+10 weeks</Btn>
                <Note>Days left {actionsLeft(career)} · events this week {thisWeek} of {MAX_PER_WEEK} · money {MONEY_SIGN}{formatMoney(career.money)} · energy {career.energy}</Note>
                <Label>Last match</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill on={!!facts.lastWon} onClick={() => setFacts({ ...facts, lastWon: true, lastLost: false })}>Won</Pill>
                  <Pill on={!facts.lastWon && !facts.lastLost} onClick={() => setFacts({ ...facts, lastWon: false, lastLost: false })}>Drew</Pill>
                  <Pill on={!!facts.lastLost} onClick={() => setFacts({ ...facts, lastWon: false, lastLost: true })}>Lost</Pill>
                  {[5.5, 6.5, 7.5, 8.5].map((r) => <Pill key={r} on={facts.lastRating === r} onClick={() => setFacts({ ...facts, lastRating: r })}>{r}</Pill>)}
                </div>
              </Panel>
              <Panel title="A moment, now" note="The director decides">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {MOMENTS.map(([m, w]) => <Btn key={m} onClick={() => moment(m)}>{w}</Btn>)}
                </div>
                <Note>Most moments are quiet. At most {MAX_PER_WEEK} events a week; a follow-up that is due always comes first.</Note>
              </Panel>
              <Panel title="Open any event" note="Skips the rules">
                <select value={pickId} onChange={(e) => setPickId(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, color: "#111" }}>
                  {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.title.replace(/"/g, "")} ({e.category}, {e.size}){e.screen === "telltale" ? " · Telltale" : e.screen === "dial" ? " · Tone dial" : ""}</option>)}
                </select>
                <div style={{ marginTop: 8 }}><Btn main onClick={openEvent}>Open</Btn></div>
                <Label>Which outcome plays</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill on={forceOutcome === undefined} onClick={() => setForceOutcome(undefined)}>The dice</Pill>
                  {[0, 1, 2].map((i) => <Pill key={i} on={forceOutcome === i} onClick={() => setForceOutcome(i)}>{`Outcome ${i + 1}`}</Pill>)}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  <Pill on={forceMini === undefined} onClick={() => setForceMini(undefined)}>Games: the dice</Pill>
                  <Pill on={forceMini === "won"} onClick={() => setForceMini("won")}>Win</Pill>
                  <Pill on={forceMini === "lost"} onClick={() => setForceMini("lost")}>Lose</Pill>
                </div>
              </Panel>
              <Panel title="Decision screens" note="Harry 20 Nov 15:35">
                <Label>Telltale: the other person forces it</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Btn onClick={() => openNamed("scn-doping-offer")}>The pills</Btn>
                  <Btn onClick={() => openNamed("scn-match-fix-approach")}>The car park</Btn>
                  <Btn onClick={() => openNamed("scn-casino-photo")}>The photo</Btn>
                  <Btn onClick={() => openNamed("scn-match-fix-return")}>The late call</Btn>
                </div>
                <Label>Tone dial: press, training, dilemmas</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Btn onClick={() => openNamed("med-mixed-zone-snub")}>Mixed zone</Btn>
                  <Btn onClick={() => openNamed("inj-tight-hamstring")}>The hamstring</Btn>
                  <Btn onClick={() => openNamed("agt-quiet-call")}>The agent</Btn>
                </div>
                <Label>Round menu: tap a person</Label>
                <Btn main onClick={openRound}>Talk to a team-mate</Btn>
                <Label>Decision clock (this device)</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["normal", "long", "off"] as ClockSetting[]).map((k) => <Pill key={k} on={clock === k} onClick={() => { writeClock(k); setClock(k); }}>{k === "normal" ? "Normal" : k === "long" ? "Long (x2)" : "Off"}</Pill>)}
                </div>
                <Label>Which screen</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill on={!plainCards} onClick={() => setPlainCards(false)}>As the event says</Pill>
                  <Pill on={plainCards} onClick={() => setPlainCards(true)}>Plain card for all</Pill>
                </div>
                <Note>The still behind Telltale and the round menu stands in for the 3D world until the world kit wires them in.</Note>
              </Panel>
              <Panel title="Sample career" note="Resets everything">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Btn onClick={() => fresh("lived")}>Lived-in (30 weeks played)</Btn>
                  <Btn onClick={() => fresh("fresh")}>Brand new</Btn>
                  <Btn onClick={() => fresh("followup")}>A follow-up waiting</Btn>
                </div>
                <Label>Car</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[0, 2, 4].map((lv) => <Pill key={lv} on={carLevel === lv} onClick={() => { setCarLevel(lv); fresh("lived", lv, horse); }}>{lv ? `Level ${lv}` : "No car"}</Pill>)}
                  <Pill on={horse} onClick={() => { setHorse(!horse); fresh("lived", carLevel, !horse); }}>Owns a horse</Pill>
                </div>
                <div style={{ marginTop: 8 }}><Btn onClick={() => setFull(true)}>Full screen</Btn></div>
              </Panel>
              <Panel title="Waiting to come back" note={`${life?.pending.length ?? 0} follow-ups`}>
                {life?.pending.length ? life.pending.map((p) => {
                  const who = Object.values(p.cast).map((id) => (id && !id.startsWith("oneoff:") ? personInfo(career, id)?.short : null)).filter(Boolean).join(", ");
                  return <Note key={p.event}>{EVENTS.find((e) => e.id === p.event)?.title.replace(/"/g, "")}{who ? ` (${who})` : ""}: {p.due <= now ? "due now" : `in ${p.due - now} weeks`}</Note>;
                }) : <Note>Nothing yet. Some choices set one up.</Note>}
              </Panel>
              <Panel title="The numbers" note="This sample">
                <Note>Life block in the save: {(bytes / 1024).toFixed(1)} KB · people {Object.keys(life?.people ?? {}).length} · events fired {Object.values(life?.fired ?? {}).reduce((a, x) => a + x.length, 0)}</Note>
                <Note>Team bar {career.relationships.team}; the match would read {teamForMatch(career)} (not wired to the match yet).</Note>
                <Note>In the real game: {LIFE_IN_CAREER ? "ON" : "off"} (lib/star/life/flag.ts).</Note>
              </Panel>
            </PanelGrid>
          </div>
        )}
      </div>
      {/* The eye on every admin page; hidden only for stills (?shot=1). */}
      {!shot && <PageGuide page="/star-life-dev" corner="bottom-left" />}
    </BroadcastPage>
  );
}
