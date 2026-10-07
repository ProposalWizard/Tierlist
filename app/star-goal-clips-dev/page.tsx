"use client";

/**
 * GOAL VIDEOS — the test page (Leo, 7 Oct 2026: "actual videos in the social
 * media bit after a game … different angles … download the goal replays …
 * the goal replays should always be the same").
 *
 * Score a chance in the real match (EnginePlay, the one engine) with a weak
 * keeper, and every goal is recorded frame by frame exactly as the real
 * career match records it (lib/star/goalClip/). Pick a recording to watch it
 * from each of the three cameras the feed uses, and save it as a video file.
 * Recordings are kept in this browser only, the same place the game keeps
 * them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import EnginePlay from "@/components/star/EnginePlay";
import GoalVideo from "@/components/star/media/GoalVideo";
import { buildScenario, initDefenders, type Scenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { DEFAULT_PLAY_SETTINGS, type PlaySettings } from "@/lib/star/playArea";
import { putClip, listClips, type ClipListing } from "@/lib/star/goalClip/store";
import type { GoalTrack } from "@/lib/star/goalClip/track";
import type { ClipStyle } from "@/lib/star/goalClip/edit";
import { setAnimationsLookOverride, useAnimationsLook, type AnimationsLook } from "@/lib/star/animLook";

const CHANCES: { kind: ScenarioKind; label: string }[] = [
  { kind: "penalty", label: "Penalty" },
  { kind: "one_on_one", label: "One-on-one" },
  { kind: "free_kick", label: "Free kick" },
  { kind: "cutback", label: "Cut-back" },
];

const ANGLES: { style: ClipStyle; label: string; who: string }[] = [
  { style: "broadcast", label: "TV", who: "the club's own account" },
  { style: "reverse", label: "Behind the goal", who: "pages and papers" },
  { style: "fan", label: "Fan in the stand", who: "fans and meme pages" },
];

/** A weak keeper and clear weather, so a goal comes quickly. */
const SETTINGS: PlaySettings = { ...DEFAULT_PLAY_SETTINGS, realKeeper: false, keeperStrength: 25, weather: "clear" };

export default function GoalClipsDevPage() {
  const [kind, setKind] = useState<ScenarioKind>("penalty");
  const [round, setRound] = useState(1);
  const [list, setList] = useState<ClipListing[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [style, setStyle] = useState<ClipStyle>("broadcast");
  // The men's moves follow Settings → Look → Animations; this page can force
  // one while it is open (the match above follows it too).
  const [movesForced, setMovesForced] = useState<AnimationsLook | null>(null);
  useEffect(() => setAnimationsLookOverride(movesForced), [movesForced]);
  const moves = useAnimationsLook();
  const n = useRef(0);

  const refresh = useCallback(async () => {
    const l = await listClips();
    setList(l);
    return l;
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const openOn = useCallback((): Scenario => {
    n.current += 1;
    const rng = mulberry32((round * 7919 + n.current * 104729) >>> 0);
    const sc = buildScenario(kind, rng, SETTINGS.keeperStrength, 60, 55);
    initDefenders(sc, rng);
    return sc;
  }, [kind, round]);

  const onGoalClip = useCallback((track: GoalTrack) => {
    void putClip(track).then(() => refresh()).then(() => setChosen(track.meta.id));
  }, [refresh]);

  const chosenRow = useMemo(() => list.find(l => l.id === chosen) ?? null, [list, chosen]);

  return (
    <div className="min-h-screen bg-gray-950 px-3 py-4 text-white" data-goal-clips-dev>
      <div className="mx-auto max-w-md">
        <h1 className="text-[20px] font-black uppercase tracking-wide">Goal videos</h1>
        <p className="mt-1 text-[13px] font-bold text-white/80">
          Score below. Every goal is recorded frame by frame, the same way a real match records it. Pick one to watch it from each camera and save it.
        </p>

        <section className="mt-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-200">1 · Score one</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CHANCES.map(c => (
              <button
                key={c.kind}
                onClick={() => { setKind(c.kind); setRound(r => r + 1); }}
                className={`rounded px-2.5 py-1.5 text-[12px] font-black uppercase tracking-wide ${kind === c.kind ? "bg-white text-gray-950" : "bg-white/10 text-white"}`}
                data-clip-chance={c.kind}
              >
                {c.label}
              </button>
            ))}
            <button onClick={() => setRound(r => r + 1)} className="rounded bg-white/10 px-2.5 py-1.5 text-[12px] font-black uppercase tracking-wide text-white" data-clip-restart>
              New chance
            </button>
          </div>
          <div className="mt-2">
            <EnginePlay key={`${kind}-${round}`} seed={round} settings={SETTINGS} openOn={openOn} bare onGoalClip={onGoalClip} />
          </div>
        </section>

        <section className="mt-5">
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-200">2 · Recordings on this device ({list.length})</div>
          {list.length === 0 ? (
            <div className="mt-1 text-[13px] text-white/80">None yet. Score above, or score in a real match.</div>
          ) : (
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
              {list.map(l => (
                <button
                  key={l.id}
                  onClick={() => setChosen(l.id)}
                  className={`block w-full rounded px-2.5 py-2 text-left text-[12.5px] font-bold ${chosen === l.id ? "bg-white text-gray-950" : "bg-white/10 text-white"}`}
                  data-clip-row={l.id}
                >
                  {l.scorer} · {l.minuteLabel}&apos; · {l.home} v {l.away}
                  <span className="ml-1 opacity-70">{l.how ? `· ${l.how.replace(/_/g, " ")}` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {chosenRow && (
          <section className="mt-5" data-clip-chosen={chosenRow.id}>
            <div className="text-[11px] font-black uppercase tracking-widest text-amber-200">3 · Watch it</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ANGLES.map(a => (
                <button
                  key={a.style}
                  onClick={() => setStyle(a.style)}
                  className={`rounded px-2.5 py-1.5 text-[12px] font-black uppercase tracking-wide ${style === a.style ? "bg-white text-gray-950" : "bg-white/10 text-white"}`}
                  data-goal-clip-angle={a.style}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="mt-1 text-[12px] font-bold text-white/70">
              In the feed this one is posted by {ANGLES.find(a => a.style === style)?.who}.
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/60">Moves</span>
              {(["old", "new"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMovesForced(m)}
                  className={`rounded px-2.5 py-1.5 text-[12px] font-black uppercase tracking-wide ${moves === m ? "bg-white text-gray-950" : "bg-white/10 text-white"}`}
                  data-goal-clip-moves={m}
                >
                  {m === "old" ? "Old" : "New"}
                </button>
              ))}
              <span className="text-[11px] font-bold text-white/60">{movesForced ? "forced on this page" : "from Settings → Look → Animations"}</span>
            </div>
            <div className="mt-2 flex justify-center">
              <GoalVideo
                key={`${chosenRow.id}-${style}`}
                clipIds={[chosenRow.id]}
                style={style}
                credit={{ handle: "FootyGoalsHQ", name: "Footy Goals HQ" }}
                title={`${chosenRow.scorer} ${chosenRow.minuteLabel}'`}
                badge="GOAL"
                autoStart
                fallback={<div className="text-[13px] text-amber-200">That recording is no longer on this device.</div>}
              />
            </div>
          </section>
        )}
      </div>
      <PageGuide page="/star-goal-clips-dev" />
    </div>
  );
}
