"use client";

/**
 * MATCH RADAR — watch the unseen match, all ninety minutes of it.
 *
 * Asked for directly (Harry, 27 Sep 2026): "there is a full match being simmed
 * in the background. Is there a way we could do a test area that shows a full
 * 90 minutes of gameplay? That would be a bit like Football Manager at that
 * point… not necessary, but … I would like to see that."
 *
 * Every minute on this screen is one call to the real `tick` (hiddenMatch.ts),
 * through lib/star/matchRadar.ts — the same function a career match runs
 * between your chances. Nothing here simulates football of its own.
 *
 * A dev page reached from the Play Area, gated the way the Play Area is (no
 * sign-in needed) — it reads and writes nothing but this browser's own screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, PanelGrid, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./radar.css";
import FunTargetsReport from "@/components/star/FunTargetsReport";
import RealWorldTable from "@/components/star/RealWorldTable";
import {
  RadarPitch, MomentumStrip, LiveRadar, RadarFeed, Scoreboard, FullTime, describeArea, handedKinds,
  type RadarSide,
} from "@/components/star/MatchRadar";
import {
  startRadar, stepRadar, resolveHighlight, radarOver, radarSummary, type RadarMatch,
} from "@/lib/star/matchRadar";
import { benchConversion, type HiddenMatchInputs, type RadarTick } from "@/lib/star/hiddenMatch";
import { PREMIER_LEAGUE_CLUBS, CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsFor, labelInk, kitLabelOnDark, type Kit } from "@/lib/star/kits";
import { oldMatchFlow } from "@/lib/star/gameplayVersion";
import { withCornerReach } from "@/lib/star/cornerReach";

/** Which of the two layouts this device shows (Harry: "match radar both as toggles"). */
const LAYOUT_KEY = "star-radar-dev-layout";
const SPEEDS = [1, 2, 5, 10, 20] as const;
const POSITIONS = ["ST", "CAM", "LW", "RW"] as const;

interface Setup {
  us: string; usStrength: number;
  them: string; themStrength: number;
  home: boolean; position: (typeof POSITIONS)[number]; skill: number;
  stopAtHighlights: boolean;
  /** Your energy at kick-off — the full-time injury check reads it. */
  energy: number;
}
const DEFAULT_SETUP: Setup = {
  us: "Chelsea", usStrength: 83, them: "Brighton & Hove Albion", themStrength: 72,
  home: true, position: "ST", skill: 75, stopAtHighlights: false, energy: 100,
};

/** The dev radar's frames as the live radar's minutes. */
function ticksOf(frames: RadarMatch["frames"]): Map<number, RadarTick> {
  const out = new Map<number, RadarTick>();
  for (const f of frames.slice(1)) {
    const t: RadarTick = { minute: f.minute, possession: f.possession, zone: f.zone, lane: f.lane, momentum: f.momentum };
    for (const e of f.events) {
      if (e.kind === "goal-us" || e.kind === "highlight-goal") { t.goal = "user"; t.shot = "user"; }
      else if (e.kind === "goal-them") { t.goal = "opponent"; t.shot = "opponent"; }
      else if (e.kind === "chance-us" && !t.shot) t.shot = "user";
      else if (e.kind === "chance-them" && !t.shot) t.shot = "opponent";
      else if (e.kind === "corner-us") t.corner = "user";
      else if (e.kind === "corner-them") t.corner = "opponent";
    }
    if (f.highlight) t.yours = true;
    out.set(f.minute, t);
  }
  return out;
}

function side(club: string, strength: number, k: Kit): RadarSide {
  const short = CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
  // On the dark page a near-black or near-white shirt still has to read.
  const colour = kitLabelOnDark(k.shirt, k.trim);
  return { name: club, short, colour, ink: labelInk(colour), strength };
}

function inputsFor(s: Setup): HiddenMatchInputs {
  // Mikey's corner rule, as the real match passes it (lib/star/cornerReach.ts).
  return withCornerReach({
    teamStrength: s.usStrength, oppStrength: s.themStrength, home: s.home,
    playerSkill: s.skill, pace: s.skill, freeKick: s.skill, position: s.position,
    // Settings → Look → Gameplay → Match flow, as the real match reads it.
    matchFlow: !oldMatchFlow(),
  });
}

export default function MatchRadarPage() {
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [seed, setSeed] = useState(20260927);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(5);
  const [running, setRunning] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [, force] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const matchRef = useRef<RadarMatch>(startRadar(seed, inputsFor(setup), 90, setup.energy));
  const [layout, setLayout] = useState<"1" | "2">("1");
  useEffect(() => {
    try { const v = localStorage.getItem(LAYOUT_KEY); if (v === "1" || v === "2") setLayout(v); } catch { /* private window */ }
  }, []);
  const pickLayout = (v: "1" | "2") => { setLayout(v); try { localStorage.setItem(LAYOUT_KEY, v); } catch { /* private window */ } };

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // Who wears what comes from the real match's own clash rule (kitsFor): the
  // away side changes when the two shirts would be hard to tell apart.
  const kits = useMemo(() => (setup.home ? kitsFor(setup.us, setup.them) : kitsFor(setup.them, setup.us)), [setup.us, setup.them, setup.home]);
  const us = useMemo(() => side(setup.us, setup.usStrength, setup.home ? kits.home : kits.away), [setup.us, setup.usStrength, setup.home, kits]);
  const them = useMemo(() => side(setup.them, setup.themStrength, setup.home ? kits.away : kits.home), [setup.them, setup.themStrength, setup.home, kits]);
  const stepMs = Math.max(50, Math.round(1000 / speed));

  const restart = useCallback((s: number, next: Setup) => {
    matchRef.current = startRadar(s, inputsFor(next), 90, next.energy);
    setFlash(null);
    force((n) => n + 1);
  }, []);

  // One real minute per tick of the clock. A highlight either stops the clock
  // (Stop at my highlights) or plays out at the bench rate and flashes.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const m = matchRef.current;
      if (radarOver(m)) { setRunning(false); force((n) => n + 1); return; }
      if (m.pending) {
        if (setup.stopAtHighlights) return;
        const at = m.pending.minute;
        resolveHighlight(m, "bench-rate");
        setFlash(at);
      } else {
        stepRadar(m);
        const waiting = m.pending as RadarMatch["pending"];
        if (waiting && setup.stopAtHighlights) setFlash(waiting.minute);
      }
      force((n) => n + 1);
    }, stepMs);
    return () => window.clearInterval(id);
  }, [running, stepMs, setup.stopAtHighlights]);

  const m = matchRef.current;
  const frame = m.frames[m.frames.length - 1];
  const over = radarOver(m);
  const pending = setup.stopAtHighlights ? m.pending : null;

  const decide = (how: "goal" | "missed" | "bench-rate") => {
    resolveHighlight(matchRef.current, how);
    force((n) => n + 1);
  };
  const change = (patch: Partial<Setup>) => {
    const next = { ...setup, ...patch };
    setSetup(next);
    setRunning(false);
    restart(seed, next);
  };

  // ---- the pieces, laid out two ways below (Harry, 19 Oct 2026: "match radar both as toggles") ----
  const scoreboard = (
    <div className="rd-score"><Scoreboard us={us} them={them} frame={frame} over={over} /></div>
  );
  /* The radar as the real match shows it above the commentary (Settings → Look → Match radar). */
  const liveRadar = (
    <div className="rd-live">
      <LiveRadar trace={ticksOf(m.frames)} minute={frame.minute} us={{ short: us.short, colour: us.colour }} them={{ short: them.short, colour: them.colour }} stepMs={stepMs} />
    </div>
  );
  const pitch = (
    <div className="rd-pitch">
      <RadarPitch frames={m.frames} us={us} them={them} pending={pending} flashMinute={flash} stepMs={stepMs} />
      {pending && (
        <div className="rd-hl">
          <div className="rd-hl-t">⭐ {pending.minute}&apos; · YOUR HIGHLIGHT</div>
          <div className="rd-hl-r">{pending.reason}</div>
          <div className="rd-hl-a">
            {describeArea(pending.zone, pending.lane)} — you&apos;d be handed: {handedKinds(pending)}
          </div>
          <div className="rd-hl-b">
            <button onClick={() => decide("goal")} data-k="goal">⚽ You score</button>
            <button onClick={() => decide("missed")} data-k="miss">✕ You miss</button>
            <button onClick={() => decide("bench-rate")} data-k="bench">
              Bench odds · {Math.round(benchConversion(pending.zone) * 100)}%
            </button>
          </div>
        </div>
      )}
    </div>
  );
  const controls = (
    <div className="rd-ctl">
      <button
        className="rd-play" data-on={running ? "true" : undefined}
        onClick={() => { if (over) { restart(seed, setup); setRunning(true); } else setRunning((r) => !r); }}
        aria-label={running ? "Pause" : "Play"}
      >{running ? "❚❚" : over ? "↻" : "▶"}</button>
      <div className="rd-speeds">
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s}>{s}×</button>
        ))}
      </div>
      <button className="rd-new" onClick={() => { const s = Math.floor(Math.random() * 1e9); setSeed(s); setRunning(false); restart(s, setup); }}
        aria-label="New match" title="New match">↻</button>
    </div>
  );
  const momentum = <MomentumStrip frames={m.frames} us={us} them={them} fullTime={m.fullTime} />;
  const feed = over ? <FullTime s={radarSummary(m)} us={us} them={them} /> : <RadarFeed frames={m.frames} us={us} them={them} clubName={us.short} />;
  const setupBox = (
    <>
      <button className="rd-sum" onClick={() => setShowSetup((v) => !v)}>
        <span>
          {us.short} {setup.usStrength} v {them.short} {setup.themStrength} · {setup.home ? "home" : "away"} · {setup.position}
          {setup.stopAtHighlights ? " · stops at yours" : ""}
          {setup.energy < 100 ? ` · ${setup.energy}% energy` : ""}
        </span>
        <b>{showSetup ? "Done" : "Change"}</b>
      </button>
      {showSetup && (
        <div className="rd-setup">
          <ClubRow label="Your side" club={setup.us} strength={setup.usStrength}
            onClub={(c) => change({ us: c })} onStrength={(v) => change({ usStrength: v })} />
          <ClubRow label="Opponent" club={setup.them} strength={setup.themStrength}
            onClub={(c) => change({ them: c })} onStrength={(v) => change({ themStrength: v })} />
          <Chips label="Where">
            <Pill on={setup.home} onClick={() => change({ home: true })}>Home</Pill>
            <Pill on={!setup.home} onClick={() => change({ home: false })}>Away</Pill>
          </Chips>
          <Chips label="You play">
            {POSITIONS.map((p) => <Pill key={p} on={setup.position === p} onClick={() => change({ position: p })}>{p}</Pill>)}
          </Chips>
          <div>
            <div className="rd-row"><Label>Your energy at kick-off</Label><span className="rd-num">{setup.energy}%</span></div>
            <input className="rd-range" type="range" min={10} max={100} value={setup.energy} onChange={(e) => change({ energy: Number(e.target.value) })} />
            <Note>Injuries are checked once, at full time, the way a career does it — the more tired you finish, the likelier.</Note>
          </div>
          <Chips label="Your highlights">
            <Pill on={!setup.stopAtHighlights} onClick={() => change({ stopAtHighlights: false })}>Play out at bench odds</Pill>
            <Pill on={setup.stopAtHighlights} onClick={() => change({ stopAtHighlights: true })}>Stop and ask me</Pill>
          </Chips>
        </div>
      )}
    </>
  );
  const fun = <div className="rd-fun"><RealWorldTable inputs={inputsFor(setup)} label={`${setup.usStrength} v ${setup.themStrength}, you a ${setup.position}`} /><FunTargetsReport /></div>;

  return (
    <BroadcastPage
      title="Match Radar"
      sub="The unseen 90, minute by minute"
    >
      <div className="rd-layout-pick" role="group" aria-label="Layout">
        <Label>Layout</Label>
        <Pill on={layout === "1"} onClick={() => pickLayout("1")}>Three columns</Pill>
        <Pill on={layout === "2"} onClick={() => pickLayout("2")}>Big pitch</Pill>
      </div>
      {layout === "1" ? (
        <div className="rd-l1" data-radar-layout="1">
          <div className="rd-a-score">{scoreboard}</div>
          <div className="rd-a-stats">
            <Panel title="Live radar" note="as in the match">{liveRadar}</Panel>
            <Panel title="Momentum">{momentum}</Panel>
          </div>
          <div className="rd-a-pitch">
            <Panel title="Radar pitch" note={over ? "full time" : frame.minute === 0 ? "kick-off" : `${frame.minute}'`}>
              {pitch}
              {controls}
            </Panel>
          </div>
          <div className="rd-a-side">
            <Panel title="The match">{setupBox}</Panel>
            <Panel title={over ? "Full time" : "Minute by minute"}>{feed}</Panel>
          </div>
          <div className="rd-a-fun"><Panel title="Real world · many matches">{fun}</Panel></div>
        </div>
      ) : (
        <div className="rd-l2" data-radar-layout="2">
          <div className="rd-b-top">
            <Panel title="Radar pitch" note={over ? "full time" : frame.minute === 0 ? "kick-off" : `${frame.minute}'`}>
              {scoreboard}
              {pitch}
              {controls}
            </Panel>
            <div className="rd-b-side">
              <Panel title="Live radar" note="as in the match">{liveRadar}</Panel>
              <Panel title={over ? "Full time" : "Minute by minute"}>{feed}</Panel>
            </div>
          </div>
          <Panel title="Events" note="up is you on top"><div className="rd-events">{momentum}</div></Panel>
          <PanelGrid min={360}>
            <Panel title="The match">{setupBox}</Panel>
            <Panel title="Real world · many matches">{fun}</Panel>
          </PanelGrid>
        </div>
      )}
      <PageGuide page="/star-radar-dev" />
    </BroadcastPage>
  );
}

function ClubRow({ label, club, strength, onClub, onStrength }: {
  label: string; club: string; strength: number; onClub: (c: string) => void; onStrength: (v: number) => void;
}) {
  return (
    <div>
      <div className="rd-row"><Label>{label}</Label><span className="rd-num">{strength}</span></div>
      <select className="rd-select" value={club} onChange={(e) => onClub(e.target.value)}>
        {PREMIER_LEAGUE_CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input className="rd-range" type="range" min={50} max={95} value={strength} onChange={(e) => onStrength(Number(e.target.value))} />
    </div>
  );
}

function Chips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 6 }}><Label>{label}</Label></div>
      <div className="rd-chips">{children}</div>
    </div>
  );
}
