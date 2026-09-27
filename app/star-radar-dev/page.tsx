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
import Link from "next/link";
import PageGuide from "@/components/admin/PageGuide";
import {
  RadarPitch, MomentumStrip, RadarFeed, Scoreboard, FullTime, describeArea, handedKinds,
  type RadarSide,
} from "@/components/star/MatchRadar";
import {
  startRadar, stepRadar, resolveHighlight, radarOver, radarSummary, type RadarMatch,
} from "@/lib/star/matchRadar";
import { benchConversion, type HiddenMatchInputs } from "@/lib/star/hiddenMatch";
import { PREMIER_LEAGUE_CLUBS, CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsFor, labelInk, kitLabelOnDark, type Kit } from "@/lib/star/kits";

const BG = "#05070d";
const INK = "#f2f5f9";
const MUTED = "#8a97aa";
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

function side(club: string, strength: number, k: Kit): RadarSide {
  const short = CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
  // On the dark page a near-black or near-white shirt still has to read.
  const colour = kitLabelOnDark(k.shirt, k.trim);
  return { name: club, short, colour, ink: labelInk(colour), strength };
}

function inputsFor(s: Setup): HiddenMatchInputs {
  return {
    teamStrength: s.usStrength, oppStrength: s.themStrength, home: s.home,
    playerSkill: s.skill, pace: s.skill, freeKick: s.skill, position: s.position,
  };
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

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: INK }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 12px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 2px 8px" }}>
          <Link href="/star-play-dev" aria-label="Back" style={{
            width: 34, height: 34, borderRadius: 999, flex: "none", display: "grid", placeItems: "center",
            border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: INK,
            fontSize: 17, fontWeight: 800, textDecoration: "none",
          }}>&#8249;</Link>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, letterSpacing: "-0.01em" }}>Match Radar</h1>
          <span style={{ marginLeft: "auto", marginRight: 52, fontSize: 11, fontWeight: 800, color: MUTED }}>the unseen 90</span>
        </div>

        <div style={{ padding: "10px 12px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Scoreboard us={us} them={them} frame={frame} over={over} />
        </div>

        <div style={{ position: "relative", marginTop: 10 }}>
          <RadarPitch frames={m.frames} us={us} them={them} pending={pending} flashMinute={flash} stepMs={stepMs} />
          {pending && (
            <div style={{
              position: "absolute", left: 8, right: 8, bottom: 8, padding: "10px 12px", borderRadius: 14,
              background: "rgba(8,10,18,0.92)", border: "1.5px solid #fde047", boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#fde047", letterSpacing: "0.1em" }}>
                ⭐ {pending.minute}&apos; · YOUR HIGHLIGHT
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 900, marginTop: 3 }}>{pending.reason}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", marginTop: 2 }}>
                {describeArea(pending.zone, pending.lane)} — you&apos;d be handed: {handedKinds(pending)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: 6, marginTop: 8 }}>
                <button onClick={() => decide("goal")} style={btn("#059669")}>⚽ You score</button>
                <button onClick={() => decide("missed")} style={btn("#475569")}>✕ You miss</button>
                <button onClick={() => decide("bench-rate")} style={btn("#1e293b")}>
                  Bench odds · {Math.round(benchConversion(pending.zone) * 100)}%
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <button
            onClick={() => { if (over) { restart(seed, setup); setRunning(true); } else setRunning((r) => !r); }}
            aria-label={running ? "Pause" : "Play"}
            style={{
              width: 48, height: 40, borderRadius: 12, border: "none", cursor: "pointer", flex: "none",
              background: running ? "#334155" : "#10b981", color: "#fff", fontSize: 17, fontWeight: 900,
            }}
          >{running ? "❚❚" : over ? "↻" : "▶"}</button>
          <div style={{ display: "flex", flex: 1, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.09)" }}>
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)} style={{
                flex: 1, height: 38, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 900,
                background: speed === s ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.03)",
                color: speed === s ? "#e0f2fe" : MUTED,
              }}>{s}×</button>
            ))}
          </div>
          <button onClick={() => { const s = Math.floor(Math.random() * 1e9); setSeed(s); setRunning(false); restart(s, setup); }}
            aria-label="New match" style={{
              width: 40, height: 40, borderRadius: 12, cursor: "pointer", flex: "none",
              border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)", color: INK, fontSize: 17, fontWeight: 900,
            }}>↻</button>
        </div>

        <div style={{ marginTop: 10 }}>
          <MomentumStrip frames={m.frames} us={us} them={them} fullTime={m.fullTime} />
        </div>

        <div style={{ marginTop: 10 }}>
          {over ? <FullTime s={radarSummary(m)} us={us} them={them} /> : <RadarFeed frames={m.frames} us={us} them={them} clubName={us.short} />}
        </div>

        <button onClick={() => setShowSetup((v) => !v)} style={{
          marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 13px", borderRadius: 13, cursor: "pointer", color: INK,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 800 }}>
            {us.short} {setup.usStrength} v {them.short} {setup.themStrength} · {setup.home ? "home" : "away"} · {setup.position}
            {setup.stopAtHighlights ? " · stops at yours" : ""}
            {setup.energy < 100 ? ` · ${setup.energy}% energy` : ""}
          </span>
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 900 }}>{showSetup ? "Done" : "Change"}</span>
        </button>

        {showSetup && (
          <div style={{ marginTop: 8, display: "grid", gap: 12, padding: 13, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <ClubRow label="Your side" club={setup.us} strength={setup.usStrength}
              onClub={(c) => change({ us: c })} onStrength={(v) => change({ usStrength: v })} />
            <ClubRow label="Opponent" club={setup.them} strength={setup.themStrength}
              onClub={(c) => change({ them: c })} onStrength={(v) => change({ themStrength: v })} />
            <Chips label="Where">
              <Chip on={setup.home} onClick={() => change({ home: true })}>Home</Chip>
              <Chip on={!setup.home} onClick={() => change({ home: false })}>Away</Chip>
            </Chips>
            <Chips label="You play">
              {POSITIONS.map((p) => <Chip key={p} on={setup.position === p} onClick={() => change({ position: p })}>{p}</Chip>)}
            </Chips>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>Your energy at kick-off</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#7dd3fc", fontFamily: "ui-monospace, monospace" }}>{setup.energy}%</span>
              </div>
              <input type="range" min={10} max={100} value={setup.energy} onChange={(e) => change({ energy: Number(e.target.value) })}
                style={{ width: "100%", accentColor: "#38bdf8" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginTop: 3 }}>
                Injuries are checked once, at full time, the way a career does it — the more tired you finish, the likelier.
              </div>
            </div>
            <Chips label="Your highlights">
              <Chip on={!setup.stopAtHighlights} onClick={() => change({ stopAtHighlights: false })}>Play out at bench odds</Chip>
              <Chip on={setup.stopAtHighlights} onClick={() => change({ stopAtHighlights: true })}>Stop and ask me</Chip>
            </Chips>
          </div>
        )}
      </div>
      <PageGuide page="/star-radar-dev" />
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return { height: 36, borderRadius: 10, border: "none", cursor: "pointer", background: bg, color: "#fff", fontSize: 12, fontWeight: 900 };
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

function Chips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 12px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
      border: `1px solid ${on ? "rgba(56,189,248,0.75)" : "rgba(255,255,255,0.09)"}`,
      background: on ? "rgba(14,116,144,0.4)" : "rgba(255,255,255,0.045)",
      color: on ? "#e0f2fe" : MUTED, fontSize: 12.5, fontWeight: 800,
    }}>{children}</button>
  );
}
