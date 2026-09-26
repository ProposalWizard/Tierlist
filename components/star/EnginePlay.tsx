"use client";

/**
 * THE ONE WAY A TEST SCREEN PLAYS THE GAME.
 *
 * "There has to be a way that ANY new feature used the base engine — when we
 * are trialling new features that can be extra stuff built on top of the base
 * engine." This is that way. Anything outside the real career match that
 * needs football played mounts THIS, never <CanvasMatch> directly and never a
 * copy of its loop — tests/star/oneEngine.mts fails the build otherwise.
 *
 * What it guarantees, and why each one was a real, measured difference (see
 * lib/star/engineProfile.ts for the numbers):
 *   - the real match's size by default (`realMatchWidth`). A test screen may
 *     ask for a bigger one (`width`, guardrailed by `testPlayWidth`'s caps),
 *     and then the drag is measured against the real match's canvas height
 *     (`dragReferenceHeightPx`), so a drag still hits exactly as hard as it
 *     does in a career;
 *   - the real squads — real faces, real finishing, the opposition's own
 *     keeper — from the same fetches the real game makes;
 *   - the real weather, unless the Play Area's Weather dial says clear;
 *   - the Play Area's dials, which are props on THIS mount only. Nothing here
 *     writes to a career or to the engine, so a dial never leaves the test
 *     area it was turned in.
 *
 * Extras a feature adds sit AROUND this (buttons, overlays, scoring) and read
 * the match through its observers — `onChanceServed` before a chance,
 * `onChanceResolved` after it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { revealOnScreen } from "@/lib/revealOnScreen";
import CanvasMatch, { type ChanceResolved } from "./CanvasMatch";
import type { ScenePicture } from "@/lib/star/scenePicture";
import {
  buildTestCareer, withRealSquads, testConditions, conditionsLabel,
  realMatchWidth, realMatchHeight, testPlayWidth, testMatchKits,
  TEST_PLAY_MAX_W, FATIGUE_RESET_MINUTES,
} from "@/lib/star/engineProfile";
import type { FrameKits } from "@/lib/star/scenarioFrame";
import { loadPlaySettings, sanitizePlaySettings, type PlaySettings } from "@/lib/star/playArea";
import type { CareerState, MatchStats } from "@/lib/star/types";
import type { Scenario, ScenarioKind } from "@/lib/star/canvasEngine";
import type { PenaltyReadSettings } from "@/lib/star/penaltyKeeper";

/**
 * Real squads, fetched once per club per page — the gallery can press Play a
 * hundred times and fetch once. A promise, so two cards opening together
 * share one request rather than racing two.
 */
const REAL_SQUADS = new Map<string, Promise<Pick<CareerState, "squad" | "leagueSquads" | "league">>>();

function realSquadsFor(career: CareerState, key: string) {
  let p = REAL_SQUADS.get(key);
  if (!p) {
    p = withRealSquads(career).then((c) => ({ squad: c.squad, leagueSquads: c.leagueSquads, league: c.league }));
    REAL_SQUADS.set(key, p);
  }
  return p;
}

/**
 * The real match's width on this screen, in CSS px, kept up to date as the
 * window changes. For a test screen that draws a PICTURE of a chance before
 * it is played: size the picture with this and pressing Play changes nothing.
 */
export function useRealMatchWidth(): number {
  const [vw, setVw] = useState(0);
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return realMatchWidth(vw);
}

/**
 * The size a test screen's PICTURE and its Play should share on this screen:
 * the real match's width on a phone, bigger on a laptop (up to
 * `TEST_PLAY_MAX_W`, and never taller than the screen). Hand the same number
 * to EnginePlay's `width` and pressing Play changes nothing on screen, while
 * the drag still kicks exactly as hard as a career's (see `width`).
 * The real match's default until the screen has been measured.
 */
export function usePlayWidth(): number {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  // Before the screen is measured: the real match's default, never 0 (a 0
  // width once gave the pitch a negative size and blanked the card).
  return testPlayWidth(vp.w, vp.h);
}

/**
 * The kits EnginePlay's match will wear for these settings and this seed —
 * the same `kitsFor` choice CanvasMatch makes (see `testMatchKits`). A still
 * picture of a chance draws in these so pressing Play changes no colours.
 * Read after mount: the Play Area's saved dials live in this browser.
 */
export function useTestKits(settings?: PlaySettings, seed = 1): FrameKits | null {
  const [kits, setKits] = useState<FrameKits | null>(null);
  useEffect(() => {
    const s = sanitizePlaySettings(settings ?? loadPlaySettings());
    setKits(testMatchKits(s, seed));
  }, [settings, seed]);
  return kits;
}

type ServedInfo = { kind: ScenarioKind | "dribble"; minute: number; reason?: string; scenario?: Scenario };

/**
 * PUT THE PITCH ON SCREEN WHEN A CHANCE IS SERVED.
 *
 * Found on a phone (26 Sep 2026): the bars above the pitch pushed it off the
 * bottom — Infinite Match drew the pitch at 292→878 px on a 664 px screen, so
 * "Where do you strike it?" put the ball at 635–838, mostly out of sight; the
 * trial's penalties had the ball at 544–742. And the pitch swallows swipes,
 * so there was no scrolling down to it from the pitch itself.
 *
 * Scrolling, not resizing: the canvas stays exactly the size it was, so a
 * drag reads exactly as hard as before (`dragReferenceHeightPx` untouched).
 * Nothing moves when the pitch is already fully on screen, and the real
 * career match never mounts this, so it is untouched.
 */
function useRevealPitch(onChanceServed?: (info: ServedInfo) => void) {
  const boxRef = useRef<HTMLDivElement>(null);
  const served = useCallback((info: ServedInfo) => {
    onChanceServed?.(info);
    requestAnimationFrame(() => {
      const pitch = boxRef.current?.querySelector("canvas")?.parentElement;
      revealOnScreen(pitch ?? boxRef.current);
    });
  }, [onChanceServed]);
  return { boxRef, served };
}

/** How long to wait for the real squads before playing with the generated
 *  ones — the same fallback the real game uses when a fetch fails. */
const SQUAD_WAIT_MS = 4000;

export default function EnginePlay({
  settings, seed = 1, openOn, bare = false, width,
  onChanceServed, onChanceResolved, onComplete,
}: {
  /** The Play Area's dials. Absent: whatever this device has saved there —
   *  one set, shared by every test screen. */
  settings?: PlaySettings;
  /** Picks the club, the fixture and the match's own randomness. */
  seed?: number;
  /** Play this picture (the gallery / highlights "Play"). See CanvasMatch. */
  openOn?: () => Scenario;
  bare?: boolean;
  /**
   * Play bigger than the real match (the gallery and highlights, on a
   * laptop). A guardrailed dial: never smaller than the real match's width,
   * never past `TEST_PLAY_MAX_W`, never wider than the screen. Whenever it
   * differs from the real width the drag is read against the real match's
   * canvas height, so the same finger movement kicks exactly as hard.
   * Absent: the real match's own size.
   */
  width?: number;
  onChanceServed?: (info: { kind: ScenarioKind | "dribble"; minute: number; reason?: string; scenario?: Scenario }) => void;
  onChanceResolved?: (info: ChanceResolved) => void;
  /** Given: a full match (Infinite Match). Absent: one chance at a time. */
  onComplete?: (stats: MatchStats) => void;
}) {
  // Cleaned even when handed in, so no caller can push a dial outside the
  // Play Area's own guardrails (a keeper of 0, a NaN power…).
  const s = useMemo(() => sanitizePlaySettings(settings ?? loadPlaySettings()), [settings]);
  const built = useMemo(() => buildTestCareer(s, seed), [s, seed]);
  const [career, setCareer] = useState<CareerState | null>(null);

  useEffect(() => {
    if (!built) return;
    let live = true;
    setCareer(null);
    const key = `${s.division}|${built.career.player.club}`;
    const fallback = setTimeout(() => { if (live) setCareer((c) => c ?? built.career); }, SQUAD_WAIT_MS);
    realSquadsFor(built.career, key).then((real) => {
      if (!live) return;
      clearTimeout(fallback);
      setCareer({ ...built.career, ...real });
    }, () => { if (live) setCareer(built.career); });
    return () => { live = false; clearTimeout(fallback); };
  }, [built, s.division]);

  // The size IS part of the game — the engine reads a drag as a fraction of
  // the canvas — so a bigger canvas is only allowed together with
  // `dragReferenceHeightPx`, which puts the feel back exactly.
  const realW = useRealMatchWidth();
  const [vpW, setVpW] = useState(0);
  useEffect(() => {
    const on = () => setVpW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const maxW = vpW > 0 ? Math.min(TEST_PLAY_MAX_W, Math.max(realW, vpW - 24)) : realW;
  const w = width && width > 0 ? Math.round(Math.max(realW, Math.min(maxW, width))) : realW;
  const dragReferenceHeightPx = w !== realW ? realMatchHeight(vpW) : undefined;
  const { boxRef, served } = useRevealPitch(onChanceServed);

  if (!built) {
    return <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "#8a97aa" }}>No clubs in that division.</div>;
  }
  if (!career) {
    return (
      <div style={{ width: w, maxWidth: "100%", margin: "0 auto", aspectRatio: "5 / 8", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "#8a97aa" }}>
        Loading the real squads…
      </div>
    );
  }

  const conditions = testConditions(s, career, built.fixture);
  const weather = conditionsLabel(conditions);

  return (
    // CanvasMatch's own column is Tailwind `max-w-sm` (384 px, the real
    // match's). A test screen that asked for a bigger `width` lifts that cap
    // on its direct children only — the real career match never mounts
    // EnginePlay, so it keeps its 384.
    <div
      ref={boxRef}
      className={w > realW ? "[&>div]:!max-w-none" : undefined}
      style={{ width: w, maxWidth: "100%", margin: "0 auto" }}
    >
      {weather && (
        <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fde68a", textAlign: "center", padding: "2px 0 4px" }}>
          {weather} — the real game&apos;s weather. Play Area → Weather to turn it off.
        </div>
      )}
      <CanvasMatch
        career={career}
        fixture={built.fixture}
        seed={seed}
        position={s.position}
        teamRelationship={career.relationships.team}
        skills={{ power: s.power, technique: s.technique }}
        canCurve={s.curve}
        canExtraTouch={s.extraTouch}
        oppStrength={s.oppStrength}
        keeperStrength={s.keeperStrength}
        forceKeeperStrength={!s.realKeeper}
        conditions={conditions}
        fatigueResetEvery={FATIGUE_RESET_MINUTES}
        neverHooked
        openOn={openOn}
        bare={bare}
        onChanceServed={served}
        onChanceResolved={onChanceResolved}
        onComplete={onComplete}
        dragReferenceHeightPx={dragReferenceHeightPx}
      />
    </div>
  );
}

/**
 * THE SAME DOOR, FOR A FEATURE THAT IS PART OF THE GAME — not a test screen.
 *
 * The trial and the training play real football as part of a career, so they
 * get none of the Play Area's dials and no borrowed test club: the engine,
 * the player's own skills (and, for a trial, the "invisible stats" a brand-new
 * career starts with — Harry, 24 Sep 2026: "if the trial acts differently
 * because of no ratings for set pieces and boots, let's give invisible stats
 * for each"), at the real match's size.
 *
 * What makes the feature a feature is what it wraps AROUND this — its own
 * scoring from `onChanceResolved`, its own tutorial card, its own reps — and
 * the one dial it may turn inside the engine: `penaltyRead`, the trial's
 * harder keeper. Everything else is the real match.
 */
export function EngineFeature({
  openOn, onChanceServed, onChanceResolved, skills, setPieceSkill, keeperStrength = 62,
  penaltyRead, seed = 1, markers, onBallStep, scene,
}: {
  /** The picture for the next chance. Called again after every result. */
  openOn: () => Scenario;
  onChanceServed?: (info: { kind: ScenarioKind | "dribble"; minute: number; reason?: string; scenario?: Scenario }) => void;
  onChanceResolved?: (info: ChanceResolved) => void;
  skills: { power: number; technique: number };
  /** The free-kick rating penalties and free kicks are struck with. */
  setPieceSkill?: number;
  keeperStrength?: number;
  penaltyRead?: Partial<PenaltyReadSettings>;
  seed?: number;
  /** Cones on the grass (decoration only). */
  markers?: { x: number; y: number; color?: string }[];
  /** Watches the ball each physics step (read-only). */
  onBallStep?: (ball: { x: number; y: number; z: number }) => void;
  /** What is on the pitch: leave out the keeper, goal, team-mates or the
   *  match's own GOAL/PASS text. The ball and the kick are always the match's. */
  scene?: ScenePicture;
}) {
  const w = useRealMatchWidth();
  const { boxRef, served } = useRevealPitch(onChanceServed);
  return (
    <div ref={boxRef} style={{ width: w, maxWidth: "100%", margin: "0 auto" }}>
      <CanvasMatch
        seed={seed}
        skills={skills}
        setPieceSkill={setPieceSkill}
        keeperStrength={keeperStrength}
        penaltyRead={penaltyRead}
        neverHooked
        openOn={openOn}
        bare
        onChanceServed={served}
        onChanceResolved={onChanceResolved}
        markers={markers}
        onBallStep={onBallStep}
        scene={scene}
      />
    </div>
  );
}
