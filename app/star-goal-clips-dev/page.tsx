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
import { BroadcastPage, Panel } from "@/components/admin/broadcast/BroadcastPage";
import EnginePlay from "@/components/star/EnginePlay";
import GoalVideo from "@/components/star/media/GoalVideo";
import { buildScenario, initDefenders, type Scenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { DEFAULT_PLAY_SETTINGS, type PlaySettings } from "@/lib/star/playArea";
import { putClip, listClips, type ClipListing } from "@/lib/star/goalClip/store";
import type { GoalTrack } from "@/lib/star/goalClip/track";
import type { ClipStyle } from "@/lib/star/goalClip/edit";
import { useAnimationsLook } from "@/lib/star/animLook";

const CHANCES: { kind: ScenarioKind; label: string }[] = [
  { kind: "penalty", label: "Penalty" },
  { kind: "one_on_one", label: "One-on-one" },
  { kind: "free_kick", label: "Free kick" },
  { kind: "cutback", label: "Cut-back" },
];

const ANGLES: { style: ClipStyle; label: string; who: string }[] = [
  { style: "broadcast", label: "TV", who: "the club's own account" },
  { style: "reverse", label: "Behind the goal", who: "pages and papers" },
  { style: "fan", label: "Fan in the stand", who: "fans and team-mates" },
  { style: "tiktok", label: "TikTok edit", who: "meme pages and TikTok accounts" },
];

/** A weak keeper and clear weather, so a goal comes quickly. */
const SETTINGS: PlaySettings = { ...DEFAULT_PLAY_SETTINGS, realKeeper: false, keeperStrength: 25, weather: "clear" };

/** A Broadcast pill: blue when picked. */
const pick = (on: boolean) =>
  `bc-pill !text-[12px] font-black uppercase tracking-wide ${on ? "" : "!text-white"}`;

export default function GoalClipsDevPage() {
  const [kind, setKind] = useState<ScenarioKind>("penalty");
  const [round, setRound] = useState(1);
  const [list, setList] = useState<ClipListing[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [style, setStyle] = useState<ClipStyle>("broadcast");
  // Each account cuts its goals one of a few ways; this page can show each.
  const [variant, setVariant] = useState(0);
  // The men's moves: always the New animations (decided 12 Oct 2026).
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
    <div data-goal-clips-dev>
    <BroadcastPage title="Goal videos" sub="Score below. Every goal is recorded frame by frame, the same way a real match records it. Pick one to watch it from each camera and save it." width={480}>
      <div className="flex flex-col gap-4">

        <Panel title="1 · Score one">
          <div className="flex flex-wrap gap-1.5">
            {CHANCES.map(c => (
              <button
                key={c.kind}
                onClick={() => { setKind(c.kind); setRound(r => r + 1); }}
                className={pick(kind === c.kind)} aria-pressed={kind === c.kind}
                data-clip-chance={c.kind}
              >
                {c.label}
              </button>
            ))}
            <button onClick={() => setRound(r => r + 1)} className="bc-btn" data-clip-restart>
              New chance
            </button>
          </div>
          <div>
            <EnginePlay key={`${kind}-${round}`} seed={round} settings={SETTINGS} openOn={openOn} bare onGoalClip={onGoalClip} />
          </div>
        </Panel>

        <Panel title={`2 · Recordings on this device (${list.length})`}>
          {list.length === 0 ? (
            <div className="bc-note">None yet. Score above, or score in a real match.</div>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {list.map(l => (
                <button
                  key={l.id}
                  onClick={() => setChosen(l.id)}
                  className={`block w-full rounded-[3px] border px-2.5 py-2 text-left text-[12.5px] font-bold ${chosen === l.id ? "border-transparent bg-[var(--bc-accent)] text-white" : "border-[var(--bc-line)] bg-white/5 text-[var(--bc-ink)]"}`}
                  data-clip-row={l.id}
                >
                  {l.scorer} · {l.minuteLabel}&apos; · {l.home} v {l.away}
                  <span className="ml-1 opacity-70">{l.how ? `· ${l.how.replace(/_/g, " ")}` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {chosenRow && (
          <div data-clip-chosen={chosenRow.id}>
          <Panel title="3 · Watch it">
            <div className="flex flex-wrap gap-1.5">
              {ANGLES.map(a => (
                <button
                  key={a.style}
                  onClick={() => setStyle(a.style)}
                  className={pick(style === a.style)} aria-pressed={style === a.style}
                  data-goal-clip-angle={a.style}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="bc-note">
              In the feed this one is posted by {ANGLES.find(a => a.style === style)?.who}.
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="bc-label">Cut</span>
              {[0, 1, 2].map(v => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  className={pick(variant === v)} aria-pressed={variant === v}
                  data-goal-clip-variant={v}
                >
                  {v + 1}
                </button>
              ))}
              <span className="text-[12px] font-bold text-[var(--bc-ink2)]">each account always uses one of these</span>
            </div>
            <div className="flex justify-center">
              <GoalVideo
                key={`${chosenRow.id}-${style}-${variant}`}
                clipIds={[chosenRow.id]}
                style={style}
                variant={variant}
                credit={{ handle: "FootyGoalsHQ", name: "Footy Goals HQ" }}
                title={`${chosenRow.scorer} ${chosenRow.minuteLabel}'`}
                badge="GOAL"
                autoStart
                fallback={<div className="text-[13px] text-[var(--bc-amber)]">That recording is no longer on this device.</div>}
              />
            </div>
          </Panel>
          </div>
        )}
      </div>
      <PageGuide page="/star-goal-clips-dev" />
    </BroadcastPage>
    </div>
  );
}
