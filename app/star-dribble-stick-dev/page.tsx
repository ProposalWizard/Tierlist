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
 */
import { useEffect, useState } from "react";
import EnginePlay from "@/components/star/EnginePlay";
import PageGuide from "@/components/admin/PageGuide";

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
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-md px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-black">Dribble · stick test</h1>
          <div className="flex rounded-lg bg-white/10 p-1">
            {(["stick", "swipe"] as const).map((c) => (
              <button
                key={c}
                onClick={() => { setControl(c); setSeed((v) => v + 1); }}
                className={`min-h-[40px] px-4 rounded-md text-sm font-bold ${control === c ? "bg-emerald-500 text-emerald-950" : "text-white"}`}
              >
                {c === "stick" ? "Stick" : "Swipe"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm font-bold text-white">
          {control === "stick"
            ? "Left thumb: push to move. A small push walks, a full push sprints. Let go to stop. Flick it sideways, or swipe on the right, to knock it past. Tap a team-mate to pass."
            : "The game's own: drag to pick a lane, flick sideways to knock it past, tap a team-mate to pass."}
        </p>
        <EnginePlay key={`${control}-${seed}`} seed={seed} dribbleOnly dribbleControl={control} />
      </div>
      <PageGuide page="/star-dribble-stick-dev" />
    </div>
  );
}
