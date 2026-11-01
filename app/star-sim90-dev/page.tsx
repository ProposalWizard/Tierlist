"use client";

/**
 * FULL MATCH (TEST) — a whole simulated ninety minutes you can watch.
 *
 * Harry, 13 Oct 2026: "I want to see a full simulated 90 mins in test area."
 *
 * The unseen match (hiddenMatch.ts, the same `tick` a career match runs
 * between your chances, through matchRadar.ts) decides every minute: who has
 * it, where, every shot, corner and goal. lib/star/sim90.ts stages that with
 * twenty-two men in their clubs' formations and the ball passed between them.
 * This page plays it with the goal-video renderer (the game's own figures).
 * It plays no football of its own and touches no career: test page only.
 *
 * Played LIVE (Harry, 14 Oct 2026: "the game is determined pre-game … if I
 * have a chance and I score, the opponent might be more aggressive"): the
 * unseen match runs only up to your next chance, and the picture is staged
 * only up to the moment it is struck. The real match (EnginePlay, the one
 * engine, inside Match3DLayer) takes over with no question; your result goes
 * back into the unseen match through resolveHighlight → resolveScenario (the
 * same call a career match makes), and the rest of the match plays from that
 * score, momentum and possession. "Watch only" (off by default) settles each
 * chance at the bench rate instead. Events appear as they happen. The view is
 * one area with a switch: 2D | 3D | Radar (only the chosen one is mounted,
 * remembered per device). Real squad names come from /api/star/league-squads
 * when it answers; made-up names otherwise.
 */
import { makeChance } from "@/lib/star/chanceMaker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BroadcastPage, Panel, PanelGrid, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./full-match.css";
import PageGuide from "@/components/admin/PageGuide";
import Sim90View from "@/components/star/Sim90View";
import Sim90View3D from "@/components/star/Sim90View3D";
import { LiveRadar } from "@/components/star/MatchRadar";
import { startSim90, resolveSim90Chance, clockOf, FULL_T, type Sim90Live, type Sim90Event } from "@/lib/star/sim90";
import { PREMIER_LEAGUE_CLUBS, CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsFor, kitLabelOnDark } from "@/lib/star/kits";
import { oldMatchFlow } from "@/lib/star/gameplayVersion";
import EnginePlay from "@/components/star/EnginePlay";
import Match3DLayer from "@/components/star/Match3DLayer";
import { SCENARIO_KINDS, type ScenarioKind, type Scenario } from "@/lib/star/canvasEngine";
import { withoutSwitchedOff } from "@/lib/star/switchedOffKinds";
import { mulberry32 } from "@/lib/star/season";
import { fetchLeagueSquads } from "@/lib/star/leagueSquads";
import { formationForClub } from "@/lib/star/clubFormation";
import { autoPick } from "@/lib/star/formations";
import type { LeagueSquad } from "@/lib/star/types";

/** The chance's kind: the first of the unseen match's kinds the game plays. */
function kindOf(kinds: string[]): ScenarioKind {
  const known = kinds.filter((k): k is ScenarioKind => (SCENARIO_KINDS as readonly string[]).includes(k));
  return withoutSwitchedOff(known)[0] ?? "one_on_one";
}

/** A real squad's eleven in the club's formation, slot order (GK first), surnames. */
function namesFrom(sq: LeagueSquad | undefined): string[] | undefined {
  if (!sq || !sq.players.length || sq.players.every((p) => p.id.startsWith("gen:"))) return undefined;
  const ids = autoPick(sq.players, formationForClub(sq.club));
  const out = ids.map((id) => {
    const p = sq.players.find((q) => q.id === id);
    return p ? p.name.trim().split(/\s+/).slice(-1)[0] : "";
  });
  return out.every(Boolean) ? out : undefined;
}

const SPEEDS = [1, 4, 16, 60] as const;
/** The clock ticks this often; the picture is redrawn on each tick. */
const TICK_MS = 50;
/** Seconds after your chance ends before the replay carries on by itself. */
const RESUME_S = 3;

type ViewMode = "2D" | "3D" | "Radar";
const VIEW_MODES: ViewMode[] = ["2D", "3D", "Radar"];
const VIEW_KEY = "star-sim90-view";
function loadView(): ViewMode {
  try { const v = window.localStorage.getItem(VIEW_KEY); return VIEW_MODES.includes(v as ViewMode) ? (v as ViewMode) : "2D"; } catch { return "2D"; }
}
function saveView(v: ViewMode) {
  try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* this device keeps no settings */ }
}

/** The page's two layouts (Harry, 19 Oct 2026: "full match opt 1 and 2 as toggles"). */
type Layout = "wide" | "tv";
const LAYOUT_KEY = "star-sim90-layout";
function loadLayout(): Layout {
  try { return window.localStorage.getItem(LAYOUT_KEY) === "tv" ? "tv" : "wide"; } catch { return "wide"; }
}

interface Setup { home: string; homeStrength: number; away: string; awayStrength: number }
const DEFAULT_SETUP: Setup = { home: "Chelsea", homeStrength: 83, away: "Brighton & Hove Albion", awayStrength: 72 };

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

const ICON: Record<Sim90Event["kind"], string> = {
  goal: "⚽", shot: "🎯", save: "🧤", miss: "↗", corner: "⚑", kickoff: "▶", half: "⏱", full: "⏱",
};

export default function FullMatchPage() {
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [seed, setSeed] = useState(20261013);
  const [sim, setSim] = useState<Sim90Live | null>(null);
  /** Bumped whenever the live match moves on (it changes in place). */
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(16);
  const [showSetup, setShowSetup] = useState(false);
  const [onlyBig, setOnlyBig] = useState(true);
  const [view, setViewState] = useState<ViewMode>("2D");
  useEffect(() => { setViewState(loadView()); }, []);
  const setView = (v: ViewMode) => { setViewState(v); saveView(v); };
  const [layout, setLayoutState] = useState<Layout>("wide");
  useEffect(() => { setLayoutState(loadLayout()); }, []);
  const setLayout = (l: Layout) => { setLayoutState(l); try { window.localStorage.setItem(LAYOUT_KEY, l); } catch { /* this device keeps no settings */ } };
  /** Off (default): the match hands over to the real match at each of your chances. */
  const [watchOnly, setWatchOnly] = useState(false);
  /** The chance being played in the real match. */
  const [stopped, setStopped] = useState<Sim90Live["waiting"]>(null);
  /** Seconds left before the match carries on by itself, once the chance is over. */
  const [resumeIn, setResumeIn] = useState<number | null>(null);
  /** Did the chance being played end in a goal (any of its served chances)? */
  const scoredRef = useRef(false);
  const chanceBox = useRef<HTMLDivElement | null>(null);
  const [squads, setSquads] = useState<Record<string, string[] | undefined>>({});
  const tRef = useRef(0);
  tRef.current = t;
  const watchRef = useRef(watchOnly);
  watchRef.current = watchOnly;

  // Real names for both clubs, when the data route answers.
  useEffect(() => {
    let live = true;
    const want = [setup.home, setup.away].filter((c) => !(c in squads));
    if (!want.length) return;
    // Never wait long: made-up names after 5 s (the real game's own fallback).
    const late = new Promise<LeagueSquad[]>((res) => window.setTimeout(() => res([]), 5000));
    Promise.race([fetchLeagueSquads(want), late]).then((list) => {
      if (!live) return;
      setSquads((cur) => {
        const next = { ...cur };
        for (const c of want) next[c] = namesFrom(list.find((q) => q.club === c));
        return next;
      });
    }).catch(() => {
      if (live) setSquads((cur) => ({ ...cur, ...Object.fromEntries(want.map((c) => [c, undefined])) }));
    });
    return () => { live = false; };
  }, [setup.home, setup.away, squads]);
  const namesReady = setup.home in squads && setup.away in squads;
  const realNames = !!(squads[setup.home] || squads[setup.away]);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // Start the match: the unseen match up to your first chance, staged up to it.
  const homeNames = squads[setup.home], awayNames = squads[setup.away];
  useEffect(() => {
    setSim(null);
    setRunning(false);
    setStopped(null);
    setResumeIn(null);
    if (!namesReady) return;
    const id = window.setTimeout(() => {
      setSim(startSim90({ ...setup, seed, matchFlow: !oldMatchFlow(), names: { home: homeNames, away: awayNames } }));
      setT(0);
    }, 30);
    return () => window.clearTimeout(id);
  }, [setup, seed, namesReady, homeNames, awayNames]);

  /** The real match takes over this long before your shot. */
  const stopAt = (w: NonNullable<Sim90Live["waiting"]>) => Math.max(0, w.t - 1.2);

  // The clock: match seconds advance at `speed` × real time, never past what
  // has been played. At your chance it hands over (or, Watch only, settles it
  // at the bench rate and goes on).
  useEffect(() => {
    if (!running || !sim) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      let next = Math.min(FULL_T, tRef.current + ((now - last) / 1000) * speed);
      last = now;
      const w = sim.waiting;
      if (w && next >= stopAt(w)) {
        if (watchRef.current) { resolveSim90Chance(sim, "bench-rate"); bump(); }
        else {
          next = Math.max(tRef.current, Math.min(next, stopAt(w)));
          tRef.current = next;
          setT(next);
          setRunning(false);
          setResumeIn(null);
          scoredRef.current = false;
          setStopped({ ...w });
          return;
        }
      }
      next = Math.min(next, sim.readyT);
      tRef.current = next;
      setT(next);
      if (next >= FULL_T) setRunning(false);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, speed, sim, bump]);

  const openOn = useMemo(() => {
    if (!stopped) return undefined;
    const kind = kindOf(stopped.chance.kinds);
    const s = (seed ^ (stopped.minute * 7919)) >>> 0;
    // The real match's chance maker (drawings, plan, kind rules: a free kick gets the match's keeper),
    // not a bare picture (Leo, 1 Nov 2026: test pages play like the real game).
    return (): Scenario => {
      const r = mulberry32(s);
      return makeChance({ source: { from: "kind", kind }, rng: r, strength: { keeper: setup.awayStrength, team: setup.homeStrength, vision: 55 }, memory: null }).sc;
    };
  }, [stopped, seed, setup.awayStrength, setup.homeStrength]);
  // Your result goes into the unseen match; the match carries on from it.
  const carryOn = () => {
    if (sim && sim.waiting) { resolveSim90Chance(sim, scoredRef.current ? "goal" : "missed"); bump(); }
    setResumeIn(null); setStopped(null); setRunning(true);
  };

  // The chance is over: count down, then carry on. Another chance served in
  // the same move (a pass kept it alive) stops the count.
  const onResolved = (info: { outcome: string }) => { if (info.outcome === "goal") scoredRef.current = true; setResumeIn(RESUME_S); };
  const onServed = () => setResumeIn(null);
  useEffect(() => {
    if (resumeIn === null) return;
    if (resumeIn <= 0) { carryOn(); return; }
    const id = window.setTimeout(() => setResumeIn((v) => (v === null ? null : v - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resumeIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring the real match into view when it takes over.
  useEffect(() => {
    if (stopped) chanceBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [stopped]);

  const kits = useMemo(() => kitsFor(setup.home, setup.away), [setup.home, setup.away]);
  const homeCol = kitLabelOnDark(kits.home.shirt, kits.home.trim);
  const awayCol = kitLabelOnDark(kits.away.shirt, kits.away.trim);

  const evCount = sim?.events.length ?? 0;
  const scoreAt = useMemo(() => {
    if (!sim) return [0, 0];
    const s = [0, 0];
    for (const e of sim.events) if (e.kind === "goal" && e.t <= t && e.side >= 0) s[e.side]++;
    return s;
  }, [sim, t, evCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only what has happened: the list grows as the match plays.
  const list = useMemo(() => {
    if (!sim) return [];
    return sim.events.filter((e) => e.t <= t + 1e-6 && (onlyBig ? e.kind === "goal" || e.kind === "save" || e.kind === "miss" || e.kind === "half" || e.kind === "full" : e.kind !== "kickoff")).reverse();
  }, [sim, onlyBig, t, evCount]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Back to any moment already played (the future hasn't happened yet). */
  const jump = (to: number) => {
    const v = Math.max(0, Math.min(sim?.readyT ?? 0, FULL_T, to));
    setStopped(null);
    setResumeIn(null);
    setT(v);
  };
  const minute = t / 60;
  const over = t >= FULL_T;
  const clock = `${over ? "FT" : clockOf(t)}${t >= 45 * 60 - 0.5 && t < 45 * 60 + 8 ? " · HT" : ""}`;
  const playPause = () => { if (t >= FULL_T) setT(0); if (stopped) { carryOn(); return; } setRunning((r) => !r); };
  const eventJump = (e: Sim90Event) => jump(e.t - (e.kind === "goal" ? 9 : e.kind === "full" || e.kind === "half" ? 0 : 6));

  // ── The pieces both layouts share (only one layout is ever mounted) ──
  const viewSwitch = sim ? <ViewSwitch mode={view} onChange={setView} /> : null;

  const picture = sim ? (
    view === "3D" ? <Sim90View3D track={sim.track} t={t} />
    : view === "Radar" ? (
      <div data-sim90-radar className="fm-radar">
        <LiveRadar trace={sim.ticks} minute={Math.min(90, Math.max(0, minute))}
          us={{ short: short(setup.home), colour: homeCol }} them={{ short: short(setup.away), colour: awayCol }}
          stepMs={60000 / speed} />
      </div>
    )
    : <Sim90View track={sim.track} t={t} />
  ) : (
    <div className="fm-building">Building the match…</div>
  );

  const chance = stopped && (
    <div ref={chanceBox} data-sim90-chance className="fm-chance">
      <div className="fm-chance-head">
        <b>{stopped.minute}&apos; · Your chance — {stopped.chance.reason.toLowerCase()}</b>
        <span>{kindOf(stopped.chance.kinds).replace(/_/g, " ")} · how it goes is how the match goes on</span>
      </div>
      {openOn && (
        <Match3DLayer key={`${seed}-${stopped.minute}-${stopped.t}`}>
          <EnginePlay seed={seed % 1000 + 1} openOn={openOn} onChanceResolved={onResolved} onChanceServed={onServed} />
        </Match3DLayer>
      )}
      <button data-sim90-back className="fm-back" onClick={carryOn}>
        {resumeIn === null ? "Back to the match" : `Back to the match · ${Math.max(0, resumeIn)}`}
      </button>
    </div>
  );

  const transport = (
    <div className="fm-transport">
      <button className="fm-play" data-running={running ? "true" : undefined} onClick={playPause} disabled={!sim} aria-label={running ? "Pause" : "Play"}>
        {running ? "❚❚" : over ? "↻" : "▶"}
      </button>
      <div className="fm-speeds" role="group" aria-label="Speed">
        {SPEEDS.map((s) => <Pill key={s} on={speed === s} onClick={() => setSpeed(s)}>{s}×</Pill>)}
      </div>
      <button className="fm-new" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} aria-label="New match" title="New match">↻</button>
    </div>
  );

  const scrub = (
    <div className="fm-scrub">
      <input data-sim90-scrub type="range" min={0} max={FULL_T} step={1} value={Math.round(t)} onChange={(e) => jump(Number(e.target.value))} aria-label="Back to an earlier moment" />
      <div className="fm-ticks"><span>0&apos;</span><span>45&apos;</span><span>90&apos;</span></div>
    </div>
  );

  const watch = (
    <label className="fm-watch">
      <input data-sim90-watch-only type="checkbox" checked={watchOnly} onChange={(e) => setWatchOnly(e.target.checked)} />
      Watch only (don&apos;t play my chances)
    </label>
  );

  const eventsToggle = (
    <button className="fm-link" onClick={() => setOnlyBig((v) => !v)}>{onlyBig ? "Show all" : "Goals and shots only"}</button>
  );
  const events = (
    <div className="fm-events">
      {!sim ? <Note>The match is being built.</Note>
        : list.length === 0 ? <Note>Nothing yet. Press ▶ and events show here as they happen.</Note>
        : list.map((e, k) => {
          const col = e.side === 0 ? homeCol : e.side === 1 ? awayCol : "#64748b";
          return (
            <button key={k} data-sim90-event={e.kind} className="fm-ev" data-goal={e.kind === "goal" ? "true" : undefined} onClick={() => eventJump(e)}>
              <span className="fm-ev-min">{e.minute}&apos;</span>
              <span className="fm-ev-bar" style={{ background: col }} />
              <span className="fm-ev-icon">{ICON[e.kind]}</span>
              <span className="fm-ev-text">{e.text.replaceAll("{club}", short(e.side === 1 ? setup.away : setup.home))}</span>
              <span className="fm-ev-watch">Watch</span>
            </button>
          );
        })}
    </div>
  );

  const teams = (
    <Panel title="Teams" note={<button className="fm-link" onClick={() => setShowSetup((v) => !v)}>{showSetup ? "Done" : "Change"}</button>}>
      <div className="fm-teamline">{short(setup.home)} {setup.homeStrength} v {short(setup.away)} {setup.awayStrength}</div>
      {showSetup && (
        <div className="fm-setup">
          <ClubRow label="Home" club={setup.home} strength={setup.homeStrength}
            onClub={(c) => setSetup({ ...setup, home: c })} onStrength={(v) => setSetup({ ...setup, homeStrength: v })} />
          <ClubRow label="Away" club={setup.away} strength={setup.awayStrength}
            onClub={(c) => setSetup({ ...setup, away: c })} onStrength={(v) => setSetup({ ...setup, awayStrength: v })} />
        </div>
      )}
      <Note>{realNames ? "Real squads" : "Made-up players"} in each club&apos;s own formation. Home is your side; the teams swap ends at half-time.</Note>
    </Panel>
  );

  const layoutPills = (
    <>
      <Pill on={layout === "wide"} onClick={() => setLayout("wide")} title="The match with the events beside it">Match + events</Pill>
      <Pill on={layout === "tv"} onClick={() => setLayout("tv")} title="The match full width, with a momentum graph">TV broadcast</Pill>
    </>
  );

  return (
    <BroadcastPage title="Full match" sub="A whole simulated 90 minutes. You play your own chances." actions={<div className="fm-layout fm-layout-pc">{layoutPills}</div>}>
      <div className="fm-layout fm-layout-phone"><Label>Layout</Label>{layoutPills}</div>
      {layout === "wide" ? (
        <div className="fm fm-wide">
          <div data-sim90-score className="fm-score">
            <span className="fm-side"><i style={{ background: homeCol }} />{short(setup.home)}</span>
            <b>{scoreAt[0]} – {scoreAt[1]}</b>
            <span className="fm-side"><i style={{ background: awayCol }} />{short(setup.away)}</span>
            <em>{clock}</em>
          </div>
          <div className="fm-wide-grid">
            <div className="fm-main">
              <section className="bc-panel fm-stagebox">
                <div className="fm-stage-top">{viewSwitch}</div>
                <div className="fm-stage">{picture}</div>
                <div className="fm-under">{transport}{scrub}{watch}</div>
              </section>
              {chance}
            </div>
            <div className="fm-side-col" data-side-column>
              <Panel title="Events" note={eventsToggle}>
                <Label>Newest first · tap to watch</Label>
                {events}
              </Panel>
              {teams}
            </div>
          </div>
        </div>
      ) : (
        <div className="fm fm-tv">
          <section className="bc-panel fm-stagebox">
            <div className="fm-tvbar">
              <div data-sim90-score className="fm-tvscore">
                <span style={{ borderColor: homeCol }}>{short(setup.home)}</span>
                <b>{scoreAt[0]} – {scoreAt[1]}</b>
                <span style={{ borderColor: awayCol }}>{short(setup.away)}</span>
                <em data-live={running ? "true" : undefined}>{over ? "FT" : running ? "LIVE" : "PAUSED"}</em>
                <small>{clock}</small>
              </div>
              {viewSwitch}
            </div>
            <div className="fm-stage">{picture}</div>
          </section>
          {chance}
          <Panel title="Momentum" note="above the line: home on top · tap to jump">
            {sim ? <Momentum sim={sim} t={t} homeCol={homeCol} awayCol={awayCol} homeName={short(setup.home)} awayName={short(setup.away)} onJump={jump} onEvent={eventJump} />
              : <Note>The match is being built.</Note>}
          </Panel>
          <Panel title="Simulator controls">
            <div className="fm-under fm-under-tv">{transport}{scrub}{watch}</div>
          </Panel>
          <PanelGrid min={340}>
            <Panel title="Events" note={eventsToggle}>
              <Label>Newest first · tap to watch</Label>
              {events}
            </Panel>
            {teams}
          </PanelGrid>
        </div>
      )}
      <PageGuide page="/star-sim90-dev" />
    </BroadcastPage>
  );
}

/** The real unseen match's momentum, minute by minute, up to now; goals as dots. */
function Momentum({ sim, t, homeCol, awayCol, homeName, awayName, onJump, onEvent }: {
  sim: Sim90Live; t: number; homeCol: string; awayCol: string; homeName: string; awayName: string;
  onJump: (t: number) => void; onEvent: (e: Sim90Event) => void;
}) {
  const W = 900, H = 120, MID = 60, AMP = 50;
  const x = (m: number) => (m / 90) * W;
  const now = Math.min(90, t / 60);
  const pts: [number, number][] = [[0, MID]];
  for (let m = 1; m <= Math.floor(now); m++) {
    const k = sim.ticks.get(m);
    if (k) pts.push([x(m), MID - Math.max(-1, Math.min(1, k.momentum)) * AMP]);
  }
  const line = pts.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1][0];
  const area = `${line} L${last.toFixed(1)},${MID} Z`;
  const goals = sim.events.filter((e) => e.kind === "goal" && e.t <= t + 1e-6);
  const onClick = (ev: React.MouseEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    onJump(((ev.clientX - r.left) / r.width) * 90 * 60);
  };
  return (
    <div className="fm-mom">
      <div className="fm-mom-side fm-mom-home" style={{ color: homeCol }}>{homeName}</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onClick={onClick} role="img" aria-label="Momentum so far">
        <defs>
          <clipPath id="fm-top"><rect x="0" y="0" width={W} height={MID} /></clipPath>
          <clipPath id="fm-bot"><rect x="0" y={MID} width={W} height={H - MID} /></clipPath>
        </defs>
        {[15, 30, 45, 60, 75].map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={0} y2={H} stroke="rgba(150,180,255,0.12)" strokeWidth={m === 45 ? 2 : 1} />)}
        <path d={area} fill={homeCol} opacity={0.45} clipPath="url(#fm-top)" />
        <path d={area} fill={awayCol} opacity={0.45} clipPath="url(#fm-bot)" />
        <line x1={0} x2={W} y1={MID} y2={MID} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
        <path d={line} fill="none" stroke="#cfe0ff" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        <line x1={x(now)} x2={x(now)} y1={0} y2={H} stroke="var(--bc-amber)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="fm-mom-side fm-mom-away" style={{ color: awayCol }}>{awayName}</div>
      <div className="fm-mom-goals">
        {goals.map((e, k) => (
          <button key={k} className="fm-mom-goal" style={{ left: `${(e.minute / 90) * 100}%`, borderColor: e.side === 0 ? homeCol : awayCol }}
            onClick={() => onEvent(e)} title={`${e.minute}' ${e.text}`} aria-label={`Watch ${e.minute}' goal`}>⚽</button>
        ))}
      </div>
      <div className="fm-ticks"><span>0&apos;</span><span>15&apos;</span><span>30&apos;</span><span>45&apos;</span><span>60&apos;</span><span>75&apos;</span><span>90&apos;</span></div>
    </div>
  );
}

function ClubRow({ label, club, strength, onClub, onStrength }: {
  label: string; club: string; strength: number; onClub: (c: string) => void; onStrength: (v: number) => void;
}) {
  return (
    <div className="fm-club">
      <div className="fm-club-top"><Label>{label}</Label><b>{strength}</b></div>
      <select value={club} onChange={(e) => onClub(e.target.value)}>
        {PREMIER_LEAGUE_CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input type="range" min={50} max={95} value={strength} onChange={(e) => onStrength(Number(e.target.value))} aria-label={`${label} strength`} />
    </div>
  );
}

/** 2D | 3D | Radar: how the match is shown (default 2D, remembered per device). */
function ViewSwitch({ mode, onChange }: { mode: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div data-sim90-view-switch className="fm-views">
      {VIEW_MODES.map((k) => (
        <button key={k} data-sim90-view-mode={k} className="bc-pill" aria-pressed={k === mode} onClick={() => onChange(k)}>{k}</button>
      ))}
    </div>
  );
}
