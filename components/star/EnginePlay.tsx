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
 *   - the real match's size, so a drag hits exactly as hard as it does in a
 *     career (`realMatchWidth`);
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

import { useEffect, useMemo, useState } from "react";
import CanvasMatch, { type ChanceResolved } from "./CanvasMatch";
import {
  buildTestCareer, withRealSquads, testConditions, conditionsLabel,
  realMatchWidth, FATIGUE_RESET_MINUTES,
} from "@/lib/star/engineProfile";
import { loadPlaySettings, sanitizePlaySettings, type PlaySettings } from "@/lib/star/playArea";
import type { CareerState, MatchStats } from "@/lib/star/types";
import type { Scenario, ScenarioKind } from "@/lib/star/canvasEngine";

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

/** How long to wait for the real squads before playing with the generated
 *  ones — the same fallback the real game uses when a fetch fails. */
const SQUAD_WAIT_MS = 4000;

export default function EnginePlay({
  settings, seed = 1, openOn, bare = false,
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

  // Not a dial, deliberately: there is no width prop. The engine reads a drag
  // as a fraction of the canvas, so the size IS part of the game — every test
  // screen plays at the real match's own size on this screen, full stop.
  const w = useRealMatchWidth();

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
    <div style={{ width: w, maxWidth: "100%", margin: "0 auto" }}>
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
        onChanceServed={onChanceServed}
        onChanceResolved={onChanceResolved}
        onComplete={onComplete}
      />
    </div>
  );
}
