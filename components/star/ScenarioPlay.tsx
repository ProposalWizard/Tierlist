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
 * It runs in CanvasMatch's own standalone sandbox mode: no fixture, no
 * onComplete, so nothing is tallied and nothing reaches a career. `bare`
 * strips the scoreboard, the commentary ticker and the hint — none of them
 * say anything about a scenario, and a goals tally is actively misleading on
 * a screen that counts nothing.
 */

import { useCallback, useEffect, useState } from "react";
import CanvasMatch from "./CanvasMatch";
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
   *  and every player appeared to jump. */
  width?: number;
}) {
  const openOn = useCallback(() => build(), [build]);

  /**
   * CanvasMatch takes its FIRST scenario at ref creation, so handing it a new
   * `openOn` does not move the picture already on screen — it would only take
   * effect on the chance after this one. Remounting is what makes an edit, or
   * a move to the next chance, land immediately.
   */
  const [nonce, setNonce] = useState(0);
  useEffect(() => { setNonce((n) => n + 1); }, [build]);

  // No Stop button of its own: the card's Play button toggles to Stop, in
  // the place it was already in. Two of them is the same action twice.
  void onStop;
  const match = <CanvasMatch key={nonce} openOn={openOn} bare />;
  if (!width) return match;
  return <div style={{ width, maxWidth: "100%", margin: "0 auto" }}>{match}</div>;
}
