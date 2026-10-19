"use client";

/**
 * DRIBBLE ON THE STICK (TEST) — prototype, not in the game.
 *
 * Harry, 14 Oct 2026: "when I say top-down dribble chance ... I mean the other
 * top-down dribbling we had, especially in 3D, where you had the joystick and
 * you were moving around with the ball. You're actually dribbling, not just
 * swiping left and right."
 *
 * The real match (EnginePlay, the one engine) with every chance it hands you
 * made a dribble run (`dribbleOnly`), and the run steered by a stick
 * (`dribbleControl="stick"`, lib/star/firstPersonDribble.ts "THE STICK") or
 * by the game's own swipe, to compare. Same men, tackle and passes either way.
 * ?control=swipe opens on the swipe.
 *
 * Look (Harry, 19 Oct 2026): the Broadcast frame. Title bar with the
 * Stick / Swipe switch, a small notes panel, the match itself unchanged.
 */
import { useEffect, useState } from "react";
import EnginePlay from "@/components/star/EnginePlay";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Pill } from "@/components/admin/broadcast/BroadcastPage";
import "./dribble-stick.css";

type Control = "stick" | "swipe";

export default function DribbleStickDev() {
  const [control, setControl] = useState<Control | null>(null);
  const [seed, setSeed] = useState(1);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setControl(p.get("control") === "swipe" ? "swipe" : "stick");
    const s = Number(p.get("seed"));
    if (Number.isFinite(s) && s > 0) setSeed(s);
  }, []);
  if (!control) return null;
  return (
    <div className="ds">
      <BroadcastPage
        title="Dribble on a stick"
        sub="Test page: every chance is a dribble run"
        width={1100}
        actions={
          <div className="ds-pills">
            {(["stick", "swipe"] as const).map((c) => (
              <Pill key={c} on={control === c} onClick={() => { setControl(c); setSeed((v) => v + 1); }}>
                {c === "stick" ? "Stick" : "Swipe"}
              </Pill>
            ))}
          </div>
        }
      >
        <div className="ds-layout">
          <div className="ds-stage">
            <EnginePlay key={`${control}-${seed}`} seed={seed} dribbleOnly dribbleControl={control} />
          </div>
          <Panel title="How to play" note={control === "stick" ? "Stick" : "Swipe"}>
            <p className="ds-help">
              {control === "stick"
                ? "Left thumb: push to move. A small push walks, a full push sprints. Let go to stop. Flick it sideways, or swipe on the right, to knock it past. Tap a team-mate to pass."
                : "The game's own: drag to pick a lane, flick sideways to knock it past, tap a team-mate to pass."}
            </p>
            <p className="ds-help ds-dim">Each switch starts a new match. Nothing is saved.</p>
          </Panel>
        </div>
      </BroadcastPage>
      <PageGuide page="/star-dribble-stick-dev" />
    </div>
  );
}
