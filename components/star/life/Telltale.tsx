"use client";
/**
 * TELLTALE — the moment the other person or the world forces on you (Harry,
 * 20 Nov 2026, 15:35: "telltale for actual conversing … random events where
 * the other person forces the interaction with you or something happens").
 *
 * The world slows and greys behind (the speaker keeps his colour), a clock
 * shrinks to the middle (white, amber under 40%, red under 20%), 2-4 short
 * lines each tagged with its tone, and "… Say nothing", which is also what the
 * clock picks when it runs out. Then colour and speed come back, "X will
 * remember that." slides in ONLY when a memory was written, the result chips,
 * what happened, and how many of your own team-mates would have done the same.
 *
 * Keys on a computer: 1-4 say a line, Space says nothing, Enter goes on.
 *
 * FOR THE 3D WORLD (later): pass `world` (your canvas) instead of `backdrop`,
 * and `onSlowMo(scale)`: it gets 0.1 while the clock runs and 1 after. The grey
 * is a CSS filter on the world layer (no blur on a live canvas: costs frames);
 * keeping the speaker in colour is the kit's job (a second pass or a mask).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import type { LiveEvent } from "@/lib/star/life/director";
import type { ChoiceResult } from "@/lib/star/life/resolve";
import { clockSecondsFor, silentChoice, speakerId, splitLines, spokenChoices, squadVerdict, TONE_LOOK, type ClockSetting } from "@/lib/star/life/decision";
import { moodOf } from "@/lib/star/life/roundMenu";
import { personInfo } from "@/lib/star/life/people";
import LifeFace from "./LifeFace";
import { ChangeList, PLACE } from "./EventCard";
import { placeStill, pointOn, RememberToast, useReducedMotion, useStageSize, type DecisionBackdrop } from "./DecisionParts";
import "./life.css";
import "./decision.css";

export interface TelltalePicked { choiceId: string; result: ChoiceResult; timedOut: boolean }

interface Props {
  career: CareerState;
  live: LiveEvent;
  clock: ClockSetting;
  onChoose: (choiceId: string, timedOut: boolean) => void;
  /** Set once the answer is played: the screen turns into its result. */
  picked?: TelltalePicked | null;
  onContinue: () => void;
  backdrop?: DecisionBackdrop;
  world?: ReactNode;
  onSlowMo?: (scale: number) => void;
  /** Events v2: the story strip over a talk ("A hundred balls in the dark · Beat 1 of 7 · Round 2"),
   *  the no-clock words ("He's in no hurry") and how the talk is going. */
  story?: StoryStrip;
  /** Events v2: cards under the result (the promise made, what happens next). */
  afterExtra?: ReactNode;
}

export interface StoryStrip { title: string; beat: string; round?: number | string; when?: string; noClock?: string; note?: string }

/** The strip over a story's screens (Telltale, the dial, the card). */
export function StoryBar({ story }: { story: StoryStrip }) {
  return (
    <>
      <div className="dd-story" data-story>
        <span className="t">◆ {story.title}</span>
        <span className="b">{story.beat}{story.round !== undefined && story.round !== "" ? ` · ${typeof story.round === "number" ? `Round ${story.round}` : story.round}` : ""}</span>
      </div>
      {story.when && <div className="dd-when" data-when>{story.when}</div>}
    </>
  );
}

export default function Telltale({ career, live, clock, onChoose, picked, onContinue, backdrop, world, onSlowMo, story, afterExtra }: Props) {
  const reduced = useReducedMotion();
  const [stageRef, size] = useStageSize<HTMLDivElement>();
  const [grey, setGrey] = useState(false);
  const [asking, setAsking] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);

  const sp = speakerId(live);
  const info = sp && !sp.startsWith("oneoff:") ? personInfo(career, sp) : null;
  const rec = sp ? career.life?.people[sp] : undefined;
  const spoken = spokenChoices(live);
  const silent = silentChoice(live);
  const { said, narration } = splitLines(live);
  const secs = clockSecondsFor(live.event, clock);
  const name = info?.short ?? (live.event.template === "text-thread" ? "Unknown number" : live.event.template === "phone-call" ? "Withheld number" : "Stranger");
  const bigWord = live.event.size === "big" ? "● Big moment" : "● Your call";

  // The world: in, grey, slow. After the answer: colour and speed come back.
  useEffect(() => {
    const el = worldRef.current;
    if (el && !reduced && typeof el.animate === "function") {
      anim.current = el.animate([{ transform: "scale(1)" }, { transform: "scale(1.06) translateY(-1%)" }], { duration: 9000, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
    }
    const t1 = window.setTimeout(() => setGrey(true), reduced ? 0 : 60);
    const t2 = window.setTimeout(() => { anim.current?.updatePlaybackRate(0.1); onSlowMo?.(0.1); }, reduced ? 0 : 450);
    const t3 = window.setTimeout(() => setAsking(true), reduced ? 0 : 600);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); anim.current?.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.id]);

  useEffect(() => {
    if (!picked) return;
    setGrey(false);
    anim.current?.updatePlaybackRate(1);
    onSlowMo?.(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const pick = useCallback((id: string, timedOut: boolean) => {
    if (chosen || picked) return;
    setChosen(id);
    window.setTimeout(() => onChoose(id, timedOut), reduced ? 120 : 380);
  }, [chosen, picked, onChoose, reduced]);

  // The clock: shrinks to the middle; at zero you said nothing.
  useEffect(() => {
    if (!asking || chosen || picked || secs === null) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const left = Math.max(0, 1 - (now - t0) / (secs * 1000));
      const el = barRef.current;
      if (el) {
        const col = left > 0.4 ? "#ffffff" : left > 0.2 ? "#f5b942" : "#ff5a4d";
        el.style.width = `${left * 100}%`; el.style.background = col; el.style.boxShadow = `0 0 12px ${col}`;
      }
      if (left <= 0) { if (silent) pick(silent.id, true); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [asking, chosen, picked, secs, silent, pick]);

  // Keys.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (picked) { if (e.key === "Enter") { e.preventDefault(); onContinue(); } return; }
      if (!asking) return;
      const n = Number(e.key);
      if (n >= 1 && n <= spoken.length && !spoken[n - 1].locked) { e.preventDefault(); pick(spoken[n - 1].id, false); }
      if ((e.key === " " || e.key === "0") && silent) { e.preventDefault(); pick(silent.id, false); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [asking, picked, spoken, silent, pick, onContinue]);

  const placed = backdrop ? placeStill(size.w, size.h, backdrop, 0.3, 1.18) : null;
  const head = placed && backdrop ? pointOn(placed, backdrop.focus.x, backdrop.focus.y) : null;
  const focusVars = head ? ({ "--fpx": `${head.x}px`, "--fpy": `${head.y + placed!.height * 0.045}px`, "--fr-x": `${placed!.width * 0.125}px`, "--fr-y": `${placed!.height * 0.11}px`, "--fx": `${head.x}px`, "--fy": `${head.y}px` } as React.CSSProperties) : undefined;
  const [placeName, dark, light] = PLACE[live.event.place] ?? [live.event.place.replace(/-/g, " "), "#1e293b", "#94a3b8"];
  const verdict = useMemo(() => (picked ? squadVerdict(career, live, picked.choiceId) : null), [picked, career, live]);
  const pickedChoice = picked ? live.choices.find((c) => c.id === picked.choiceId) : null;
  const pips = rec ? Math.max(0, Math.min(5, Math.round(rec.b / 20))) : 0;
  const mood = rec ? moodOf(rec.b, rec.g) : null;

  const stillLayer = (colour: boolean) => placed && backdrop && (
    <>
      {placed.wide && !colour && <div className="dd-still" style={{ inset: -30, backgroundImage: `url(${backdrop.src})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(18px) brightness(.6)" }} />}
      <div className="dd-still" style={{ left: placed.left, top: placed.top, width: placed.width, height: placed.height, backgroundImage: `url(${backdrop.src})`, backgroundSize: "100% 100%" }} />
    </>
  );

  return (
    <div ref={stageRef} className="dd dd-tt" data-grey={grey ? 1 : 0} data-telltale={live.id} data-phase={picked ? "after" : asking ? "ask" : "in"} style={focusVars}>
      {/* The world */}
      <div ref={worldRef} className="dd-world" style={{ transformOrigin: head ? `${head.x}px ${head.y}px` : "50% 40%" }}>
        {world ?? (backdrop ? stillLayer(false) : (
          <div className="absolute inset-0" style={{ background: `radial-gradient(120% 70% at 50% 18%, ${light}66, transparent 60%), linear-gradient(180deg, ${dark}, #070d18 78%)` }} />
        ))}
      </div>
      {backdrop && !world && <div className="dd-world-focus" aria-hidden>{stillLayer(true)}</div>}
      <div className="dd-vig" />
      {/* No picture: the speaker's face stands in, in colour. */}
      {!backdrop && !world && (
        <div className="dd-portrait" aria-hidden>
          <div style={{ boxShadow: grey && !picked ? `0 0 0 3px rgba(255,255,255,.85), 0 0 40px ${light}` : undefined, borderRadius: 999 }}>
            <LifeFace career={career} id={sp || "oneoff:stranger"} size={size.w >= 900 ? 168 : 124} />
          </div>
          <div className="nm">{name}</div>
          <div className="rl">{live.event.template === "phone-call" ? "📞 On the phone" : live.event.template === "text-thread" ? "💬 Messages" : placeName}</div>
        </div>
      )}
      <div className="dd-lb top" /><div className="dd-lb bot" />

      {!picked && (
        <>
          {story ? <StoryBar story={story} /> : <div className="dd-tt-kick dd-kick" style={{ opacity: grey ? 1 : 0, transition: "opacity .3s" }}>{bigWord}</div>}
          {story && (story.noClock || story.note) && (
            <div className="dd-story-sub" style={{ top: story.when ? 74 : 40 }} data-talk-mood>
              {story.noClock && secs === null && <div>{story.noClock}</div>}
              {story.note && <div className="n">{story.note}</div>}
            </div>
          )}
          {head && info && (
            <div className="dd-tag" style={{ left: head.x, top: head.y - placed!.height * 0.075, opacity: asking ? 1 : 0, transition: "opacity .3s" }}>
              {mood?.face} {info.short}
              <span className="dd-pips">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < pips ? ((rec?.g ?? 0) >= 40 ? "bad" : "on") : ""} />)}</span>
            </div>
          )}
          <div className="dd-shade" style={{ opacity: asking ? 1 : 0 }} />
          <div className="dd-tt-bottom">
            {asking && (
              <div className="dd-tt-col">
                {narration[0] && <div className="dd-narr dd-fade-in">{narration.join(" ")}</div>}
                <div className="dd-sub dd-fade-in"><b>{info ? info.short : name}</b>{said || live.lines[live.lines.length - 1]}</div>
                {secs !== null ? <div className="dd-timer" data-clock={secs}><i ref={barRef} style={{ width: "100%", background: "#fff" }} /></div> : story?.noClock ? null : <div className="dd-noclock">No clock · take your time</div>}
                {spoken.map((c, i) => {
                  const look = TONE_LOOK[c.choice.tone ?? "calm"];
                  const state = chosen ? (chosen === c.id ? "picked" : "other") : undefined;
                  const chips = [...c.costText, ...(c.choice.minigame ? [c.choice.minigame.kind === "horse-race" ? "Your horse runs" : `A test of your ${c.choice.minigame.stat === "freeKick" ? "free kicks" : c.choice.minigame.stat}`] : []), ...(c.locked ? [c.locked] : [])];
                  return (
                    <button key={c.id} type="button" className={`dd-line ${reduced ? "" : "dd-rise"}`} style={{ "--tone": look.color, animationDelay: `${i * 90}ms` } as React.CSSProperties}
                      data-state={state} data-choice={c.id} disabled={!!c.locked} onClick={() => pick(c.id, false)}>
                      <span className="dd-kbd dd-pc-only">{i + 1}</span>
                      <span>{c.label}{chips.length > 0 && <span className="c">{chips.join(" · ")}</span>}</span>
                      <span className="t">{look.word}</span>
                    </button>
                  );
                })}
                {silent && (
                  <button type="button" className={`dd-silence ${reduced ? "" : "dd-rise"}`} style={{ animationDelay: `${spoken.length * 90}ms` }} data-choice={silent.id} data-silent
                    data-state={chosen ? (chosen === silent.id ? "picked" : "other") : undefined} onClick={() => pick(silent.id, false)}>
                    <span className="dots">…</span><small>Say nothing</small><span className="dd-kbd dd-pc-only">Space</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {picked && story && <StoryBar story={{ ...story, round: "Done", when: undefined }} />}
      {picked && (
        <div className="dd-after">
          <RememberToast remembered={picked.result.remembered} top={(size.w >= 900 ? 40 : 22) + (story ? 26 : 0)} />
          <div className="dd-fade-in" style={{ position: "absolute", left: 16, right: 16, top: (picked.result.remembered.length ? (size.w >= 900 ? 120 : 98) : 22) + (story ? 26 : 0), display: "flex", gap: 6, flexWrap: "wrap", zIndex: 7 }}>
            <ChangeList changes={picked.result.changes.filter((c) => c.kind !== "memory")} />
          </div>
          <div className="dd-shade" />
          <div className="dd-tt-bottom" style={{ paddingBottom: 22 }}>
            <div className="dd-tt-col dd-fade-in">
              <div className="dd-said">{picked.timedOut ? "Time ran out. You said nothing." : pickedChoice?.choice.silent ? "You said nothing." : `You · ${TONE_LOOK[pickedChoice?.choice.tone ?? "calm"].word}`}</div>
              {pickedChoice && !pickedChoice.choice.silent && <div className="dd-sub" style={{ fontSize: size.w >= 900 ? 20 : 16, opacity: 0.9 }}>{pickedChoice.label}</div>}
              <div className="dd-result" data-result>{picked.result.text}</div>
              {verdict && !story && (
                <div style={{ margin: "4px 0 6px" }} data-verdict>
                  <div className="dd-verdict">{verdict.same} of your {verdict.of} team-mates would have {verdict.phrase}</div>
                  <div className="dd-verdict-bar"><i style={{ width: `${(verdict.same / verdict.of) * 100}%`, background: TONE_LOOK[verdict.tone].color }} /></div>
                </div>
              )}
              {afterExtra}
              <button type="button" className="dd-main" onClick={onContinue} data-continue>Continue <span className="dd-kbd dd-pc-only" style={{ background: "rgba(5,46,22,.2)" }}>Enter</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
