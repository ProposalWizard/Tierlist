"use client";

/**
 * PLAY THIS PICTURE — in place, not over it.
 *
 * Asked for twice. First: "you have to allow me to play the scenarios in the
 * gallery including the simulated scenarios inside the gallery and also in
 * the infinite highlights." Then, after playing one: "once I'm playing a
 * highlight I can no longer go back to the edit phase… what if I played the
 * highlight and realised it needed more editing before I save it? Forget the
 * commentator stuff at the bottom, just keep the original UI — team-mate /
 * opponent edits and saving etc."
 *
 * The first version was a full-screen overlay, and that was the mistake: it
 * covered the editor, so playing a chance and then fixing it meant leaving,
 * finding the card again, and remembering what was wrong with it.
 *
 * So this is not an overlay. It swaps the PICTURE for the live match and
 * leaves everything else on the card exactly where it was — the edit tools,
 * Save, Next, the flag. Play it, see what is wrong, drag a defender, play it
 * again, save. No screen change in between.
 *
 * It runs through EnginePlay (the one way a test screen plays the game) in
 * the engine's standalone mode: no onComplete, so nothing is tallied and
 * nothing reaches a career. `bare`
 * strips the scoreboard, the commentary ticker and the hint — none of them
 * say anything about a scenario, and a goals tally is actively misleading on
 * a screen that counts nothing.
 */

import { useCallback, useMemo, useRef } from "react";
import EnginePlay from "./EnginePlay";
import type { Scenario } from "@/lib/star/canvasEngine";

export default function ScenarioPlay({ build, onStop, width }: {
  /** Rebuilds the scenario from scratch. Called for every chance, so this
   *  must be pure — handing back one shared object would let the engine
   *  mutate the card's own picture as you play it. */
  build: () => Scenario;
  /** Back to the editable picture. Kept on the props so a caller that has
   *  no toggle of its own can still offer one. */
  onStop?: () => void;
  /** The picture's own width, in CSS px. Given, the match plays at exactly
   *  that size, so pressing Play changes nothing on screen until you kick.
   *  It used to fill the card instead — about 13% wider than the picture —
   *  and every player appeared to jump. Bigger than the real match is fine:
   *  EnginePlay then reads the drag against the real match's canvas, so it
   *  kicks the same (see EnginePlay's `width`). */
  width?: number;
}) {
  // The latest `build`, read at the moment a chance starts — so the factory
  // handed to the engine stays the same function across re-renders.
  const buildRef = useRef(build);
  buildRef.current = build;
  const openOn = useCallback(() => buildRef.current(), []);

  /**
   * CanvasMatch takes its FIRST scenario at ref creation, so a changed picture
   * only lands by remounting. Keyed on WHAT the picture is, not on the
   * function that builds it: the gallery and highlights pass a fresh inline
   * `build` on every render, so keying on the function remounted the match on
   * any re-render at all — a phone's address bar hiding mid-kick was enough
   * to throw the chance away (found in the one-engine audit, 24 Sep 2026).
   */
  let picture = "";
  try { picture = JSON.stringify(build()); } catch { picture = String(Math.random()); }
  const key = useMemo(() => {
    let h = 0;
    for (let i = 0; i < picture.length; i++) h = (h * 31 + picture.charCodeAt(i)) | 0;
    return h;
  }, [picture]);

  // No Stop button of its own: the card's Play button toggles to Stop, in
  // the place it was already in. Two of them is the same action twice.
  void onStop;
  // Through EnginePlay, like every test screen: the picture's size (the real
  // match's feel — see EnginePlay's `width`), the real squads and weather,
  // and the Play Area's dials.
  return <EnginePlay key={key} openOn={openOn} bare width={width} />;
}
