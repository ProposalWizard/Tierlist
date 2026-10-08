"use client";
import { useEffect, useState } from "react";
import GoalVideo from "./media/GoalVideo";
import { getClip } from "@/lib/star/goalClip/store";
import type { ClipStyle } from "@/lib/star/goalClip/edit";

/**
 * WATCH A SAVED GOAL — the recording itself, not the physics run again.
 *
 * Leo, 7 Oct 2026: "the goal replays should always be the same, not just
 * remaking the situation and letting it play again because randomness means
 * its not always a real replica of the goal." A goal recorded on this device
 * plays from its recording (lib/star/goalClip/), from the camera you pick;
 * Save video keeps it. A goal from before recordings existed — or recorded on
 * another phone — shows `fallback` (the old re-run) instead.
 */
const ANGLES: { style: ClipStyle; label: string }[] = [
  { style: "broadcast", label: "TV" },
  { style: "reverse", label: "Behind the goal" },
  { style: "fan", label: "Fan in the stand" },
];

export default function GoalClipViewer({ clipId, title, fallback }: { clipId: string; title: string; fallback: React.ReactNode }) {
  const [have, setHave] = useState<boolean | null>(null);
  const [style, setStyle] = useState<ClipStyle>("broadcast");

  useEffect(() => {
    let live = true;
    getClip(clipId).then(t => { if (live) setHave(!!t); });
    return () => { live = false; };
  }, [clipId]);

  if (have === null) return <div className="aspect-video w-full animate-pulse rounded-xl bg-white/5" />;
  if (!have) return <>{fallback}</>;

  return (
    <div data-goal-clip-viewer>
      <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-amber-200">{title}</div>
      <div className="mb-2 flex gap-1.5">
        {ANGLES.map(a => (
          <button
            key={a.style}
            onClick={() => setStyle(a.style)}
            className={`rounded px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide ${style === a.style ? "bg-white text-gray-950" : "bg-white/10 text-white"}`}
            data-goal-clip-angle={a.style}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="flex justify-center">
        <GoalVideo
          key={style}
          clipIds={[clipId]}
          style={style}
          title={title}
          autoStart
          fallback={fallback}
        />
      </div>
    </div>
  );
}
