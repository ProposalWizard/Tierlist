"use client";
/**
 * THE STORY PLAYER — plays Events v2's arcs on the test page (/star-life-dev):
 * the round menu with the story's bubbles, the talk node by node on the
 * Telltale screen or the tone dial, the game a reply opens (ActivityHost on
 * the real engine), the cards (the note in your boot, the letter), the
 * invitation, the notices, and the phone (Promises and Stories).
 *
 * The page owns the career; this hook owns which story screen is up and the
 * queue behind it. Pure state moves come from lib/star/life/{arcs,talk,promises}.ts.
 * Nothing here reaches a real career (LIFE_IN_CAREER is false).
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import type { ArcNotice, LifeActivity, LifeMoment } from "@/lib/star/life/types";
import type { FactOverride } from "@/lib/star/life/facts";
import type { LiveEvent } from "@/lib/star/life/director";
import type { ChoiceResult } from "@/lib/star/life/resolve";
import { arcById, beatOf } from "@/lib/star/life/arcBook";
import { arcMoment, bubblesFor, endOfDay, openBeat, playEnding, storyStrip, arcsOf, type ActivityResult, type ArcExtras, type BeatLive } from "@/lib/star/life/arcs";
import { activityDone, autoBeat, cardLive, diceActivity, inviteAnswer, nodeLive, playCard, reply, talkNode } from "@/lib/star/life/talk";
import { roundMenuFor, playRoundLine, type RoundOffer } from "@/lib/star/life/roundMenu";
import { screenFor } from "@/lib/star/life/decision";
import { turnWeek, SEASON_WEEKS } from "@/lib/star/life/sim";
import { personInfo } from "@/lib/star/life/people";
import Telltale from "./Telltale";
import ToneDial from "./ToneDial";
import RoundMenu, { type RoundReply } from "./RoundMenu";
import ActivityHost from "./ActivityHost";
import { AfterCards, InviteScreen, NoticeScreen, PhoneLog, StoryCardScreen, StoryFace } from "./StoryCards";
import { placeStill, pointOn, useStageSize, type DecisionBackdrop } from "./DecisionParts";
import { speak, stopVoice, voiceCast } from "@/lib/star/life/voice";

const K = "/star/life/kitman/";
/** The stills behind the story's talks (the 3D compound goes here later): him and you drawn in one
 *  frame by the game's toon renderer (/star-life-dev/portrait?scene=…), the same scale and ground. */
export const STORY_STILLS: Record<string, DecisionBackdrop> = {
  "pitch2-den": { src: `${K}pitch2-den.webp`, w: 780, h: 1688, focus: { x: 0.639, y: 0.313 } },
  "pitch2-kid": { src: `${K}pitch2-kid.webp`, w: 780, h: 1688, focus: { x: 0.665, y: 0.291 } },
  "van-den": { src: `${K}van-den.webp`, w: 780, h: 1688, focus: { x: 0.639, y: 0.313 } },
  "stadium-den": { src: `${K}stadium-den.webp`, w: 780, h: 1688, focus: { x: 0.639, y: 0.313 } },
};

function stillFor(b: BeatLive, career: CareerState): DecisionBackdrop | undefined {
  if (b.event.template === "phone-call") return undefined;
  // The kit man's stills are drawn only for the man they show (pool.ts): another kit man gets the
  // empty place, and his drawn head on the line.
  const st = b.cast.kitman ? personInfo(career, b.cast.kitman)?.pool?.stills : undefined;
  const at = (src: string | undefined, empty: string, h = 530): DecisionBackdrop => (src ? { src, w: 780, h: 1688, focus: { x: 0.639, y: 0.313 } } : { src: `${K}${empty}`, w: 780, h, focus: { x: 0.5, y: 0.5 } });
  if (b.node === "van" || b.node === "soup" || b.node === "t-soup") return at(st?.van, "bg-garden-van.webp");
  if (b.event.place.startsWith("stadium")) return at(st?.stadium, "bg-stadium-night.webp", 592);
  if (b.beat === "b7-your-turn") return STORY_STILLS["pitch2-kid"];
  if (b.beat === "b4-the-door") return undefined;
  return at(st?.pitch, "bg-garden-dusk.webp");
}

/** The back of the kit room door: forty years of chalk, and your best. */
function ChalkDoor({ career, best, nights, cut }: { career: CareerState; best: number; nights: number; cut?: string }) {
  const rows: [string, string, string][] = [["94", "No. 9", "2009"], ["88", "No. 7", "1996"], ["86", "No. 10", "2014"], ["85", "No. 9", "1987"]];
  return (
    <div className="absolute inset-0" style={{ background: "radial-gradient(90% 60% at 50% 30%, #2c3a2a, #0c120c)" }} data-door>
      <div style={{ position: "absolute", left: "7%", right: "12%", top: 70, bottom: "30%", background: "linear-gradient(180deg,#2f3d2d,#1f2a1e)", borderRadius: 6, boxShadow: "inset 0 0 40px rgba(0,0,0,.6), 0 0 0 6px #3a2a1c", padding: "18px 20px", fontFamily: "Georgia, serif", color: "rgba(240,236,220,.86)" }}>
        <div style={{ fontFamily: "system-ui", fontSize: 9, fontWeight: 900, letterSpacing: ".16em", color: "rgba(240,236,220,.55)" }}>{nights} THURSDAYS · BEST {best}</div>
        {rows.map(([s, n, y], i) => (
          <div key={i} style={{ display: "flex", gap: 18, alignItems: "baseline", marginTop: i ? 10 : 14, opacity: i ? 0.62 : 1, fontSize: i ? 17 : 26 }}><b style={{ fontWeight: 400, minWidth: 40 }}>{s}</b><span>{n}</span><span style={{ fontSize: 13 }}>{y}</span></div>
        ))}
        <div style={{ display: "flex", gap: 18, alignItems: "baseline", marginTop: 26, fontSize: 24, color: "#f5d06f" }}><b style={{ fontWeight: 400, minWidth: 40 }}>{best}</b><span>No. {career.squadNumber ?? 9} (you)</span></div>
        <div style={{ fontSize: 11, opacity: 0.4, marginTop: 10 }}>a lot of other numbers, rubbed out</div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {cut && <img src={cut} alt="" style={{ position: "absolute", right: "2%", bottom: "28%", height: "30%", filter: "brightness(.85) drop-shadow(0 12px 12px rgba(0,0,0,.6))" }} />}
    </div>
  );
}

export type StoryView =
  | { k: "menu"; id: string; reply?: RoundReply | null }
  | { k: "talk"; b: BeatLive; live: LiveEvent; before: CareerState; picked?: { choiceId: string; result: ChoiceResult; timedOut: boolean }; extras?: ArcExtras }
  | { k: "activity"; b: BeatLive; activity: LifeActivity; before: CareerState }
  | { k: "card"; b: BeatLive; live: LiveEvent; picked?: { choiceId: string; result: ChoiceResult }; extras?: ArcExtras; post?: "empty-chair" }
  | { k: "invite"; b: BeatLive }
  | { k: "notices"; list: ArcNotice[] }
  | { k: "phone"; tab: "promises" | "stories" };

export interface StoryOpts {
  career: CareerState | null;
  setCareer: (c: CareerState) => void;
  rng: () => number;
  facts: FactOverride;
  /** A short message on the page ("Nothing happened"). */
  toast: (t: string) => void;
  /** Test page: offer "Roll it instead" on the drill. */
  allowDice?: boolean;
}

/** The caller's lines for a game: its own, or the ones it borrows (Thursdays use the first night's). */
function callerLines(arcId: string, a: LifeActivity): string[] | undefined {
  if (a.caller?.lines) return a.caller.lines;
  const from = a.caller?.useLinesOf;
  if (!from) return undefined;
  for (const b of arcById(arcId)?.beats ?? []) if (b.event.id === from) for (const n of Object.values(b.event.talk?.nodes ?? {})) if (n.activity?.caller?.lines) return n.activity.caller.lines;
  return undefined;
}

export function useStory({ career, setCareer, rng, facts, toast }: StoryOpts) {
  const [view, setView] = useState<StoryView | null>(null);
  const [queue, setQueue] = useState<StoryView[]>([]);

  const viewForBeat = useCallback((c: CareerState, b: BeatLive): StoryView => {
    if (b.stage === "invite") return { k: "invite", b };
    if (b.stage === "card") return { k: "card", b, live: cardLive(c, b, facts) };
    return { k: "talk", b, live: nodeLive(c, b, facts), before: c };
  }, [facts]);

  const open = useCallback((c: CareerState, arc: string, beat: string): StoryView | null => {
    const o = openBeat(c, arc, beat);
    if (!o) return null;
    setCareer(o.career);
    return viewForBeat(o.career, o.live);
  }, [setCareer, viewForBeat]);

  /** Show a list of screens: the first now, the rest on Continue. */
  const show = useCallback((list: StoryView[]) => {
    if (!list.length) { setView(null); setQueue([]); return; }
    setView(list[0]);
    setQueue(list.slice(1));
  }, []);

  const next = useCallback(() => {
    if (queue.length) { setView(queue[0]); setQueue(queue.slice(1)); return; }
    setView(null);
  }, [queue]);

  /** A moment: notices first, then the beat that wants a screen, else the offer (his round menu). */
  const moment = useCallback((c0: CareerState, m: LifeMoment, f: FactOverride = facts, pre: ArcNotice[] = [], force?: string): boolean => {
    const r = arcMoment(c0, m, { rng, facts: f, force });
    let c = r.career;
    const list: StoryView[] = [];
    const notes = [...pre, ...r.notices];
    if (notes.length) list.push({ k: "notices", list: notes });
    const s = r.screens[0];
    if (s) {
      const o = openBeat(c, s.arc, s.beat);
      if (o) { c = o.career; list.push(viewForBeat(c, o.live)); }
    } else if (r.offers[0]) list.push({ k: "menu", id: r.offers[0].person });
    setCareer(c);
    show(list);
    return list.length > 0;
  }, [facts, rng, setCareer, show, viewForBeat]);

  const act = {
    arrive: () => { if (career && !moment(career, "arrive:training")) toast("Training: nothing for you today."); },
    /** Arrive at training on a career that is not on screen yet (the Start button). */
    arriveWith: (c: CareerState) => { if (!moment(c, "arrive:training")) toast("Training: nothing for you today."); },
    nextMorning: () => {
      if (!career) return;
      const e = endOfDay(career, rng);
      if (!moment(e.career, "arrive:training", facts, e.notices)) toast("Next morning: a normal day.");
    },
    saturday: (scored: boolean) => {
      if (!career) return;
      const f = { ...facts, lastGoals: scored ? 1 : 0, lastRating: scored ? 7.6 : 6.4, lastWon: scored, lastLost: !scored };
      const e = endOfDay(career, rng);
      const c = { ...e.career, week: e.career.week + 1 };
      if (!moment(c, "after-match", f, e.notices)) toast(scored ? "Saturday: you scored. Nothing waiting on it." : "Saturday: no goal.");
    },
    thursday: () => {
      if (!career) return;
      const e = endOfDay(career, rng);
      let c = turnWeek(e.career, rng);
      const r = arcMoment(c, "arrive:training", { rng, facts });
      c = r.career;
      setCareer(c);
      const den = Object.values(arcsOf(c)).map((x) => x.cast.kitman).find(Boolean) ?? "staff:kitman";
      const list: StoryView[] = [];
      if (e.notices.length || r.notices.length) list.push({ k: "notices", list: [...e.notices, ...r.notices] });
      if (r.screens[0]) { const v = open(c, r.screens[0].arc, r.screens[0].beat); if (v) list.push(v); }
      else list.push({ k: "menu", id: r.offers[0]?.person ?? den });
      show(list);
    },
    seasonEnd: () => { if (career && !moment({ ...career, week: Math.max(career.week, SEASON_WEEKS) }, "season-end")) toast("Season end: nothing for the story."); },
    /** Skip seasons. Thursdays are played for you by the dice; it stops when the story has something for you. */
    skip: (seasons: number) => {
      if (!career) return;
      let c = endOfDay(career, rng).career;
      const target = c.season + seasons;
      const notes: ArcNotice[] = [];
      let nights = 0;
      const neutral = { lastRating: 6.9, lastGoals: 0, lastWon: false, lastLost: false };
      for (let guard = 0; guard < 60 * seasons + 60; guard++) {
        if (c.week >= SEASON_WEEKS) {
          const r = arcMoment(c, "season-end", { rng, facts: neutral });
          c = r.career; notes.push(...r.notices);
          if (r.screens[0]) {
            const v = open(c, r.screens[0].arc, r.screens[0].beat);
            show([...(notes.length || nights ? [{ k: "notices" as const, list: summary(notes, nights) }] : []), ...(v ? [v] : [])]);
            return;
          }
        }
        c = turnWeek(c, rng);
        let r = arcMoment(c, "after-match", { rng, facts: neutral });
        c = r.career; notes.push(...r.notices.filter((n) => n.kind !== "objective" || n.title !== "Objective missed" || true));
        r = arcMoment(c, "arrive:training", { rng, facts: neutral });
        c = r.career; notes.push(...r.notices);
        if (r.screens[0] || r.offers[0]) {
          setCareer(c);
          const v = r.screens[0] ? openBeatView(c, r.screens[0].arc, r.screens[0].beat) : { k: "menu" as const, id: r.offers[0].person };
          show([...(notes.length || nights ? [{ k: "notices" as const, list: summary(notes, nights) }] : []), ...(v ? [v] : [])]);
          return;
        }
        // Thursdays on pitch two, played for you.
        for (const [arcId, run] of Object.entries(arcsOf(c))) {
          const den = run.cast.kitman;
          if (!den) continue;
          for (const bb of bubblesFor(c, den, neutral)) {
            if (bb.gold) continue;
            const a = autoBeat(c, arcId, bb.beat, { rng, facts: neutral, pick: () => 0 });
            if (a) { c = a.career; nights++; }
          }
        }
        if (c.season >= target && c.week >= 2) break;
      }
      setCareer(c);
      show(notes.length || nights ? [{ k: "notices", list: summary(notes, nights) }] : []);
      toast(`Season ${c.season}, week ${c.week}.`);
      function summary(list: ArcNotice[], n: number): ArcNotice[] {
        const run = arcsOf(c)["arc-hundred-balls"];
        return [...(n ? [{ kind: "remind" as const, arc: "arc-hundred-balls", title: "Thursdays on pitch two", text: `${n} Thursday${n === 1 ? "" : "s"} played for you by the dice while you skipped. Your best is ${run?.v.best ?? 0}.`, w: 0, who: (career && personInfo(career, "staff:kitman")?.short) || "the kit man" }] : []), ...list.slice(-6)];
      }
      function openBeatView(cc: CareerState, arc: string, beat: string): StoryView | null {
        const o = openBeat(cc, arc, beat);
        if (!o) return null;
        setCareer(o.career);
        return viewForBeat(o.career, o.live);
      }
    },
    /** Test page: start this story now at training (its first beat), whatever its start rules say;
     *  with `beat`, jump straight to that beat once it has started (the games' screens). */
    story: (arcId: string, beat?: string, c0: CareerState | null = career) => {
      if (!c0) return;
      if (!beat) { if (!moment(c0, "arrive:training", facts, [], arcId)) toast("That story could not start here."); return; }
      const r = arcMoment(c0, "arrive:training", { rng, facts, force: arcId });
      const v = open(r.career, arcId, beat);
      if (v) show([v]); else toast("That beat could not open.");
    },
    menu: (id: string) => setView({ k: "menu", id }),
    phone: (tab: "promises" | "stories" = "promises") => setView({ k: "phone", tab }),
    close: () => { setView(null); setQueue([]); },
  };

  // ── Playing a screen ──

  const onOffer = (o: RoundOffer) => {
    if (!career) return;
    const v = open(career, o.arc, o.beat);
    if (v) setView(v);
  };

  const talkChoose = (id: string, timedOut = false) => {
    if (!career || view?.k !== "talk") return;
    const s = reply(career, view.b, id);
    let c = s.career;
    if (s.step.kind === "node") { setCareer(c); setView({ k: "talk", b: s.step.live, live: nodeLive(c, s.step.live, facts), before: c }); return; }
    if (s.step.kind === "activity") { setCareer(c); setView({ k: "activity", b: s.step.live, activity: s.step.activity, before: c }); return; }
    const r = playEnding(c, s.step.live, s.step.end, { rng, facts });
    c = r.career;
    setCareer(c);
    setView({ ...view, b: s.step.live, picked: { choiceId: id, result: r.result, timedOut }, extras: r.extras });
  };

  const activityResult = (res: ActivityResult) => {
    if (!career || view?.k !== "activity") return;
    const s = activityDone(career, view.b, res);
    const c = s.career;
    setCareer(c);
    if (s.step.kind === "node") setView({ k: "talk", b: s.step.live, live: nodeLive(c, s.step.live, facts), before: c });
    else if (s.step.kind === "end") {
      const r = playEnding(c, s.step.live, s.step.end, { rng, facts });
      setCareer(r.career);
      setView({ k: "notices", list: [{ kind: "ignored", arc: view.b.arc, title: "Done", text: r.result.text, w: 0 }] });
    }
  };

  const cardChoose = (id: string) => {
    if (!career || view?.k !== "card") return;
    const r = playCard(career, view.b, id, { rng, facts });
    if (!r) return;
    setCareer(r.career);
    setView({ ...view, picked: { choiceId: id, result: r.result }, extras: r.extras });
  };

  const inviteChoose = (a: string) => {
    if (!career || view?.k !== "invite") return;
    const r = inviteAnswer(career, view.b, a, { rng, facts });
    if (r.live) { setCareer(r.career); setView({ k: "talk", b: r.live, live: nodeLive(r.career, r.live, facts), before: r.career }); return; }
    if (r.ended) {
      setCareer(r.ended.career);
      const b = view.b;
      setView({ k: "card", b: { ...b, stage: "card" }, live: { ...cardLive(r.ended.career, b, facts), lines: [], choices: [] }, picked: { choiceId: a, result: r.ended.result }, extras: r.ended.extras, post: "empty-chair" });
    }
  };

  return { view, setView, queue, act, onOffer, talkChoose, activityResult, cardChoose, inviteChoose, next };
}

export type Story = ReturnType<typeof useStory>;

/** The round menu over pitch two, with the story's bubbles. */
function MenuStage({ career, id, reply: rep, onOffer, onLine, onClose, facts }: { career: CareerState; id: string; reply?: RoundReply | null; onOffer: (o: RoundOffer) => void; onLine: (r: RoundReply) => void; onClose: () => void; facts: FactOverride }) {
  const [ref, size] = useStageSize<HTMLDivElement>();
  const bubbles = bubblesFor(career, id, facts);
  const offers: RoundOffer[] = bubbles.map((x) => ({ id: `${x.arc}:${x.beat}`, ...x }));
  const kid = !id.startsWith("staff:") && id !== "mgr";
  const still = kid ? STORY_STILLS["pitch2-kid"] : STORY_STILLS["pitch2-den"];
  const placed = placeStill(size.w, size.h, still, Math.max(0.3, (size.h - 424) / size.h), 1);
  const head = pointOn(placed, still.focus.x, still.focus.y);
  const menu = roundMenuFor(career, id, offers);
  const gold = bubbles.find((x) => x.gold) ?? bubbles[0];
  const run = gold ? arcsOf(career)[gold.arc] : undefined;
  const beat = gold ? beatOf(arcById(gold.arc)!, gold.beat) : undefined;
  const setup = beat?.event.setup[0] && run ? beat.event.setup.map((s) => s).join(" ") : "";
  const info = personInfo(career, id);
  const filled = setup ? setup.replace(/\{kitman\.short\}|\{kitman\.name\}/g, personInfo(career, run?.cast.kitman ?? "")?.short ?? "He").replace(/\{kid\.(name|short)\}/g, info?.short ?? "He").replace(/\{if [^}]+\}[\s\S]*?\{\/if\}/g, "").trim() : "";
  return (
    <div ref={ref} className="relative h-full min-h-[560px] overflow-hidden bg-[#070d18]" data-story-menu={id}>
      <div className="absolute" style={{ left: placed.left, top: placed.top, width: placed.width, height: placed.height, backgroundImage: `url(${still.src})`, backgroundSize: "100% 100%" }} />
      {gold && <div className="dd-story" style={{ position: "absolute" }}><span className="t">◆ {arcById(gold.arc)?.title}</span><span className="b">{beat?.n ? `Beat ${beat.n} of 7` : gold.chip}</span></div>}
      <RoundMenu menu={menu} anchor={{ x: head.x, y: head.y + placed.height * 0.02 }} size={size} onOffer={onOffer}
        onPick={(line) => { const r = playRoundLine(career, id, line, Math.random); onLine({ text: r.reply, delta: r.delta, key: Date.now() }); }}
        onClose={onClose} reply={rep}
        card={gold ? { kicker: kid ? "Pitch two · after training" : gold.gold ? "Pitch two · after training" : "Thursday · pitch two", text: gold.gold ? filled : gold.hint, hint: gold.gold ? "Tap a bubble. The gold one is him offering something, and it's gone tomorrow." : undefined } : undefined} />
    </div>
  );
}

/** What the phone shows while a story screen is up. */
/** Den and the gaffer speak the line on screen (lib/star/life/voice.ts): a node's words, an
 *  ending's words, a card's outcome. A new screen stops the last clip. */
function useStoryVoice(v: StoryView | null, career: CareerState | null) {
  const key = !v ? "" : v.k === "talk" ? `${v.b.beat}|${v.b.node}|${v.b.round}|${v.picked ? "end" : ""}` : v.k === "card" ? `${v.b.beat}|card|${v.picked?.choiceId ?? ""}` : v.k;
  useEffect(() => {
    if (!v) { stopVoice(); return; }
    // Only this story's own people speak in their recorded voices (pool.ts: Den's voice is Den's).
    if ("b" in v && career) voiceCast(Object.values(v.b.cast).map((id) => personInfo(career, id)?.pool?.id ?? "").filter(Boolean));
    if (v.k === "talk") {
      if (v.picked) { const end = v.b.lastReply?.end; if (end) speak(`${v.b.beat}.end.${end}.`, v.picked.result.text); else stopVoice(); }
      else speak([`${v.b.beat}.${v.b.node}.`, ...(v.b.round === 1 ? [`${v.b.beat}.setup`] : [])], v.live.lines.join(" "));
    } else if (v.k === "card" && v.picked) {
      const i = v.b.event.choices.findIndex((c) => c.id === v.picked!.choiceId);
      if (i >= 0) speak(`${v.b.beat}.choice${i}.out`, v.picked.result.text); else stopVoice();
    } else if (v.k !== "activity") stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => stopVoice(), []);
}

export function StoryScreen({ story, career, facts, setCareer, allowDice }: { story: Story; career: CareerState; facts: FactOverride; setCareer: (c: CareerState) => void; allowDice?: boolean }): ReactNode {
  const v = story.view;
  useStoryVoice(v, career);
  if (!v) return null;
  if (v.k === "menu") {
    return <MenuStage career={career} id={v.id} reply={v.reply} facts={facts} onOffer={story.onOffer}
      onLine={(r) => story.setView({ k: "menu", id: v.id, reply: r })} onClose={story.next} />;
  }
  if (v.k === "phone") return <PhoneLog career={career} tab={v.tab} onTab={(t) => story.setView({ k: "phone", tab: t })} onClose={story.act.close} />;
  if (v.k === "notices") return <NoticeScreen career={career} notices={v.list} onContinue={story.next} />;
  if (v.k === "invite") return <InviteScreen career={career} b={v.b} onAnswer={story.inviteChoose} />;
  if (v.k === "card") return <StoryCardScreen career={career} b={v.b} live={v.live} picked={v.picked} extras={v.extras} post={v.post} onChoose={story.cardChoose} onContinue={story.next} />;
  if (v.k === "activity") {
    return <ActivityHost key={`${v.b.beat}-${v.b.round}`} career={career} live={v.b} activity={v.activity} callerLines={callerLines(v.b.arc, v.activity)} onDone={story.activityResult}
      allowDice={allowDice} onDice={() => story.activityResult(diceActivity(career, v.b, v.activity, Math.random))} />;
  }
  // A talk.
  const strip = storyStrip(v.b);
  const node = talkNode(v.b);
  const storyProps = { title: strip.title, beat: strip.beat, round: v.b.round, when: v.b.round === 1 ? v.b.when : undefined, noClock: "No clock · he's in no hurry", note: v.b.note };
  const after = v.extras ? <AfterCards extras={v.extras} /> : undefined;
  if (screenFor(v.live.event) === "dial") {
    return <ToneDial key={v.live.id} career={v.picked ? career : v.before} live={v.live} story={storyProps} afterExtra={after}
      sceneImage={v.b.beat === "b2-the-gaffer" ? `${K}corridor-gaffer.webp` : undefined} face={<StoryFace career={career} id={v.b.cast[v.live.event.speaker ?? ""] ?? ""} size={64} />}
      onChoose={(id) => story.talkChoose(id)} picked={v.picked ? { choiceId: v.picked.choiceId, result: v.picked.result, before: v.before } : null} onContinue={story.next} />;
  }
  const door = v.b.beat === "b4-the-door" ? <ChalkDoor career={career} best={Number(arcsOf(career)[v.b.arc]?.v.best ?? 0)} nights={Number(arcsOf(career)[v.b.arc]?.v.nights ?? 0)} cut={personInfo(career, v.b.cast.kitman ?? "")?.pool?.stills?.cut} /> : undefined;
  void node; void setCareer;
  return <Telltale key={v.live.id} career={v.picked ? career : v.before} live={v.live} clock="off" backdropZoom={1} keepColour face={<StoryFace career={career} id={v.b.cast[v.live.event.speaker ?? ""] ?? ""} size={124} />} backdrop={door ? undefined : stillFor(v.b, career)} world={door}
    story={storyProps} afterExtra={after} onChoose={story.talkChoose} picked={v.picked} onContinue={story.next} />;
}
