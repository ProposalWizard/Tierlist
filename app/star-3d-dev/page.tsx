"use client";

/**
 * 3D — one of every mode, in the "3d" player look (Harry, 28 Sep 2026: "can
 * we make one test screen which just has 1 of every mode with the re skin and
 * call it 3d?").
 *
 * Every section mounts the mode exactly the way its own screen does — the
 * real match chance and the shootout through ScenarioPlay / ShootoutPlay
 * (EnginePlay underneath), the trial stages and training drills through their
 * own components (EngineFeature underneath), five-a-side, the first-person
 * dribble, Goalie Mode and the home avatar as themselves. Nothing here has its
 * own loop or its own drawing: the look is the one shared setting in
 * lib/star/figureSkin.ts, forced while this page is open.
 *
 * The Classic / 3D switch at the top flips that setting for this page only,
 * so the same moment can be compared. Nothing is saved to a career.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageGuide from "@/components/admin/PageGuide";
import ScenarioPlay from "@/components/star/ScenarioPlay";
import ShootoutPlay from "@/components/star/ShootoutPlay";
import TrialPenalties from "@/components/star/stages/TrialPenalties";
import TrialFreeKicks from "@/components/star/stages/TrialFreeKicks";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import FiveASide from "@/components/star/FiveASide";
import FirstPersonDribble from "@/components/star/FirstPersonDribble";
import GoalieMode from "@/components/star/GoalieMode";
import PlayerAvatar from "@/components/star/PlayerAvatar";
import { usePlayWidth } from "@/components/star/EnginePlay";
import { buildScenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { startTrial } from "@/lib/star/trial";
import { FAKE_FACES } from "@/lib/star/fakeFaces";
import { setFigureSkinOverride, type FigureSkin } from "@/lib/star/figureSkin";
import type { CareerState } from "@/lib/star/types";

const BG = "#05070d";
const INK = "#f2f5f9";
const MUTED = "#8a97aa";

const MODES = [
  { id: "match", label: "Match chance" },
  { id: "shootout", label: "Shootout" },
  { id: "penalties", label: "Trial pens" },
  { id: "freekicks", label: "Trial FKs" },
  { id: "strike", label: "Training strike" },
  { id: "gauntlet", label: "Gauntlet" },
  { id: "five", label: "Five-a-side" },
  { id: "dribble", label: "Dribble" },
  { id: "goalie", label: "Goalie Mode" },
  { id: "avatar", label: "Home avatar" },
] as const;
type Mode = (typeof MODES)[number]["id"];

const CHANCES: { kind: ScenarioKind; label: string }[] = [
  { kind: "cutback", label: "Cutback" },
  { kind: "one_on_one", label: "One-on-one" },
  { kind: "corner", label: "Corner" },
];

/** A small seeded random stream, so "Next chance" is repeatable. */
function rngFor(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Real-looking defenders for the dribble, each with a face (so the 3d look
 *  can show its fitted heads). */
const DRIBBLE_ROSTER = FAKE_FACES.map((face, i) => ({ id: `d${i}`, face, overall: 70, defending: 68 }));

/** Just enough of a career for the home avatar: a club, a kit, a number. */
const AVATAR_CAREER = {
  player: { firstName: "Test", lastName: "Player", club: "Chelsea", skinTone: "medium", portrait: undefined },
  squadNumber: 10,
  clubKits: {},
} as unknown as CareerState;

const SKILLS = { pace: 70, power: 70, technique: 70, vision: 70, freeKick: 70 };

export default function ThreeDDevPage() {
  const [skin, setSkin] = useState<FigureSkin>("3d");
  const [mode, setMode] = useState<Mode>("match");
  const [run, setRun] = useState(0);
  const [chance, setChance] = useState<ScenarioKind>("cutback");
  const [seed, setSeed] = useState(7);
  const [bank, setBank] = useState(1000);
  const [bet, setBet] = useState(10);
  const width = usePlayWidth();
  const trial = useMemo(() => startTrial(20260928), []);

  // ?mode=…&skin=classic|3d jumps straight to a section (for filming).
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const m = q.get("mode");
      if (m && MODES.some((x) => x.id === m)) setMode(m as Mode);
      const s = q.get("skin");
      if (s === "classic" || s === "3d") setSkin(s);
    } catch { /* no query: the defaults stand */ }
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // The look, forced for this page only; handed back when it closes.
  useEffect(() => setFigureSkinOverride(skin), [skin]);

  const key = `${mode}-${skin}-${run}-${chance}-${seed}`;
  const again = () => setRun((r) => r + 1);

  const body = (() => {
    switch (mode) {
      case "match":
        return (
          <>
            <Row>
              {CHANCES.map((c) => (
                <Pill key={c.kind} on={chance === c.kind} onClick={() => setChance(c.kind)}>{c.label}</Pill>
              ))}
              <Pill on={false} onClick={() => setSeed((s) => s + 1)}>Next chance ›</Pill>
            </Row>
            <ScenarioPlay key={key} width={width} build={() => buildScenario(chance, rngFor(seed * 977 + 13))} />
          </>
        );
      case "shootout":
        return <ShootoutPlay key={key} width={width} onExit={again} />;
      case "penalties":
        return <TrialPenalties key={key} trial={trial} skills={SKILLS} onDone={again} />;
      case "freekicks":
        return <TrialFreeKicks key={key} trial={trial} skills={SKILLS} onDone={again} />;
      case "strike":
        return <TrainingMinigame key={key} skill="power" trainingLevel={4} skills={SKILLS} onComplete={again} />;
      case "gauntlet":
        return <TrainingMinigame key={key} skill="pace" trainingLevel={4} skills={SKILLS} onComplete={again} />;
      case "five":
        return <FiveASide key={key} embedded seed={20260928 + run} difficulty={0.5} skills={SKILLS} onComplete={again} />;
      case "dribble":
        // The production values the real match plays with (CLAUDE.md).
        return (
          <FirstPersonDribble
            key={key}
            pace={100} oppStrength={100} chaseEye={5} chasePitchDeg={5} chaseOffset={4} cameraFollowRate={10}
            roster={DRIBBLE_ROSTER} seed={seed}
          />
        );
      case "goalie":
        return (
          <GoalieMode
            key={key} bank={bank} bet={bet} onSetBank={setBank} onExit={again}
            onChangeBet={(d) => setBet((b) => Math.max(10, b + d * 10))}
          />
        );
      case "avatar":
        return (
          <div style={{ display: "grid", justifyItems: "center", gap: 8, padding: "18px 0" }}>
            {/* The home screen's avatar IS the 3d look (A2). Classic shows the
                game's own figure lit (A1) for comparison. */}
            <PlayerAvatar key={key} career={AVATAR_CAREER} width={172} height={204} look={skin === "3d" ? "A2" : "A1"} />
            <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>
              {skin === "3d" ? "A2 — the home screen's avatar" : "A1 — the game's own figure, lit"}
            </div>
          </div>
        );
    }
  })();

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: INK }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: BG, padding: "12px 12px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/star-play-dev" aria-label="Back" style={{
              width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center",
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
              color: INK, fontSize: 17, fontWeight: 800, textDecoration: "none",
            }}>&#8249;</Link>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>3D</h1>
            <div data-skin-toggle style={{ marginLeft: "auto", display: "flex", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", overflow: "hidden" }}>
              {(["classic", "3d"] as const).map((s) => (
                <button key={s} onClick={() => setSkin(s)} style={{
                  padding: "8px 14px", fontSize: 13, fontWeight: 900, cursor: "pointer", border: "none",
                  background: skin === s ? "#10b981" : "transparent", color: skin === s ? "#04110b" : INK,
                }}>{s === "3d" ? "3D" : "Classic"}</button>
              ))}
            </div>
          </div>
          <Row>
            {MODES.map((m) => <Pill key={m.id} on={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</Pill>)}
          </Row>
        </div>
        <div style={{ padding: "0 8px 40px" }}>{body}</div>
      </div>
      <PageGuide page="/star-3d-dev" />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{children}</div>;
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 11px", borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 800,
      border: `1px solid ${on ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.1)"}`,
      background: on ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.04)", color: on ? "#d1fae5" : MUTED,
    }}>{children}</button>
  );
}
