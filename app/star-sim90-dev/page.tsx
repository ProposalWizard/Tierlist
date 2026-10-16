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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { buildScenario, SCENARIO_KINDS, type ScenarioKind, type Scenario } from "@/lib/star/canvasEngine";
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

const BG = "#05070d";
const INK = "#f2f5f9";
const MUTED = "#8a97aa";
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
    return (): Scenario => buildScenario(kind, mulberry32(s), setup.awayStrength);
  }, [stopped, seed, setup.awayStrength]);
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

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: INK }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 12px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 2px 8px" }}>
          <Link href="/star-play-dev" aria-label="Back" style={{
            width: 34, height: 34, borderRadius: 999, flex: "none", display: "grid", placeItems: "center",
            border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: INK,
            fontSize: 17, fontWeight: 800, textDecoration: "none",
          }}>&#8249;</Link>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>Full match (test)</h1>
        </div>

        {/* Scoreboard + clock */}
        <div data-sim90-score style={{
          display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8,
          padding: "8px 10px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: homeCol, flex: "none" }} />
            <span style={{ fontWeight: 900, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{short(setup.home)}</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>{scoreAt[0]} – {scoreAt[1]}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#7dd3fc", fontFamily: "ui-monospace, monospace" }}>
              {t >= FULL_T ? "FT" : clockOf(t)}{t >= 45 * 60 - 0.5 && t < 45 * 60 + 8 ? " · HT" : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", minWidth: 0 }}>
            <span style={{ fontWeight: 900, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{short(setup.away)}</span>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: awayCol, flex: "none" }} />
          </div>
        </div>

        {/* The picture: one area, 2D | 3D | Radar (only the chosen one is mounted) */}
        <div style={{ marginTop: 8, position: "relative" }}>
          {sim && <ViewSwitch mode={view} onChange={setView} />}
          {sim ? (
            view === "3D" ? <Sim90View3D track={sim.track} t={t} />
            : view === "Radar" ? (
              <div data-sim90-radar style={{ borderRadius: 12, overflow: "hidden" }}>
                <LiveRadar trace={sim.ticks} minute={Math.min(90, Math.max(0, minute))}
                  us={{ short: short(setup.home), colour: homeCol }} them={{ short: short(setup.away), colour: awayCol }}
                  stepMs={60000 / speed} />
              </div>
            )
            : <Sim90View track={sim.track} t={t} />
          ) : (
            <div style={{ height: 220, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.04)", color: MUTED, fontWeight: 800 }}>
              Building the match…
            </div>
          )}
        </div>

        {/* One of your chances: the real match takes over, then the replay carries on */}
        {stopped && (
          <div ref={chanceBox} data-sim90-chance style={{ marginTop: 8, padding: 10, borderRadius: 14, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.45)" }}>
            <div style={{ fontSize: 13, fontWeight: 900 }}>{stopped.minute}&apos; · Your chance — {stopped.chance.reason.toLowerCase()}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#a7f3d0", marginTop: 2 }}>
              {kindOf(stopped.chance.kinds).replace(/_/g, " ")} · how it goes is how the match goes on
            </div>
            <div style={{ marginTop: 8 }}>
              {openOn && (
                <Match3DLayer key={`${seed}-${stopped.minute}-${stopped.t}`}>
                  <EnginePlay seed={seed % 1000 + 1} openOn={openOn} onChanceResolved={onResolved} onChanceServed={onServed} />
                </Match3DLayer>
              )}
              <button data-sim90-back onClick={carryOn} style={{
                width: "100%", marginTop: 8, height: 42, borderRadius: 12, border: "none", cursor: "pointer", background: "#38bdf8", color: "#04111d", fontSize: 14, fontWeight: 900,
              }}>{resumeIn === null ? "Back to the match" : `Back to the match · ${Math.max(0, resumeIn)}`}</button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <button onClick={() => { if (t >= FULL_T) setT(0); if (stopped) { carryOn(); return; } setRunning((r) => !r); }} disabled={!sim} aria-label={running ? "Pause" : "Play"}
            style={{ width: 48, height: 40, borderRadius: 12, border: "none", cursor: "pointer", flex: "none", background: running ? "#334155" : "#10b981", color: "#fff", fontSize: 17, fontWeight: 900 }}>
            {running ? "❚❚" : t >= FULL_T ? "↻" : "▶"}
          </button>
          <div style={{ display: "flex", flex: 1, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.09)" }}>
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)} style={{
                flex: 1, height: 38, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 900,
                background: speed === s ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.03)", color: speed === s ? "#e0f2fe" : MUTED,
              }}>{s}×</button>
            ))}
          </div>
          <button onClick={() => setSeed(Math.floor(Math.random() * 1e9))} aria-label="New match" style={{
            width: 40, height: 40, borderRadius: 12, cursor: "pointer", flex: "none",
            border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)", color: INK, fontSize: 17, fontWeight: 900,
          }}>↻</button>
        </div>
        <input data-sim90-scrub type="range" min={0} max={FULL_T} step={1} value={Math.round(t)} onChange={(e) => jump(Number(e.target.value))} aria-label="Back to an earlier moment"
          style={{ width: "100%", marginTop: 8, accentColor: "#38bdf8" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTED, fontWeight: 800, marginTop: -2 }}>
          <span>0&apos;</span><span>45&apos;</span><span>90&apos;</span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12, fontWeight: 800 }}>
          <input data-sim90-watch-only type="checkbox" checked={watchOnly} onChange={(e) => setWatchOnly(e.target.checked)} />
          Watch only (don&apos;t play my chances)
        </label>

        {/* Events: tap to jump */}
        {sim && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 900 }}>Match events · newest first · tap to watch</span>
              <button onClick={() => setOnlyBig((v) => !v)} style={{
                fontSize: 11.5, fontWeight: 800, color: "#7dd3fc", background: "none", border: "none", cursor: "pointer",
              }}>{onlyBig ? "Show all" : "Goals and shots only"}</button>
            </div>
            <div style={{ display: "grid", gap: 4, maxHeight: 280, overflowY: "auto" }}>
              {list.map((e, k) => {
                const col = e.side === 0 ? homeCol : e.side === 1 ? awayCol : "#64748b";
                return (
                  <button key={k} data-sim90-event={e.kind} onClick={() => jump(e.t - (e.kind === "goal" ? 9 : e.kind === "full" || e.kind === "half" ? 0 : 6))} style={{
                    display: "flex", alignItems: "center", gap: 8, textAlign: "left", padding: "7px 9px", borderRadius: 10, cursor: "pointer",
                    border: "1px solid rgba(255,255,255,0.06)", background: e.kind === "goal" ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.03)",
                    color: INK,
                  }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, fontWeight: 900, width: 30, color: "#7dd3fc" }}>{e.minute}&apos;</span>
                    <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: col }} />
                    <span style={{ fontSize: 13 }}>{ICON[e.kind]}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>{e.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Setup */}
        <button onClick={() => setShowSetup((v) => !v)} style={{
          marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 13px", borderRadius: 13, cursor: "pointer", color: INK,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 800 }}>{short(setup.home)} {setup.homeStrength} v {short(setup.away)} {setup.awayStrength}</span>
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 900 }}>{showSetup ? "Done" : "Change"}</span>
        </button>
        {showSetup && (
          <div style={{ marginTop: 8, display: "grid", gap: 12, padding: 13, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <ClubRow label="Home" club={setup.home} strength={setup.homeStrength}
              onClub={(c) => setSetup({ ...setup, home: c })} onStrength={(v) => setSetup({ ...setup, homeStrength: v })} />
            <ClubRow label="Away" club={setup.away} strength={setup.awayStrength}
              onClub={(c) => setSetup({ ...setup, away: c })} onStrength={(v) => setSetup({ ...setup, awayStrength: v })} />
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>
              {realNames ? "Real squads" : "Made-up players"} in each club&apos;s own formation. Home is your side; the teams swap ends at half-time.
            </div>
          </div>
        )}
      </div>
      <PageGuide page="/star-sim90-dev" />
    </div>
  );
}

function ClubRow({ label, club, strength, onClub, onStrength }: {
  label: string; club: string; strength: number; onClub: (c: string) => void; onStrength: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: "#7dd3fc", fontFamily: "ui-monospace, monospace" }}>{strength}</span>
      </div>
      <select value={club} onChange={(e) => onClub(e.target.value)} style={{
        width: "100%", height: 36, borderRadius: 10, padding: "0 10px", marginBottom: 6,
        background: "#0f172a", color: INK, border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, fontWeight: 700,
      }}>
        {PREMIER_LEAGUE_CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input type="range" min={50} max={95} value={strength} onChange={(e) => onStrength(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#38bdf8" }} />
    </div>
  );
}

/** 2D | 3D | Radar: how the match is shown (default 2D, remembered per device). */
function ViewSwitch({ mode, onChange }: { mode: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div data-sim90-view-switch style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
      <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        {VIEW_MODES.map((k) => {
          const sel = k === mode;
          return (
            <button key={k} data-sim90-view-mode={k} onClick={() => onChange(k)} style={{
              width: 58, height: 30, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 900,
              background: sel ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.03)", color: sel ? "#e0f2fe" : MUTED,
            }}>{k}</button>
          );
        })}
      </div>
    </div>
  );
}
