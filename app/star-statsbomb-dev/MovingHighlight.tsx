"use client";

/**
 * THE MOVING HIGHLIGHT (test page only) — Harry, 13 Oct 2026: "fit the real
 * shots test page with the match radar and passes 2/3 times before receiving
 * the ball moving highlight", then: "the 3 shots in real shot and all of it
 * should be in 3d aswell and needs to be playable in 2d/3d. u need to actually
 * see the 3 moves before u".
 *
 * The match radar (the same RadarPitch the match uses) follows the move. Under
 * it is the REAL MATCH (EnginePlay, the one engine), inside the career's own
 * 3D layer (Match3DLayer), so it is drawn in 2D or 3D exactly as a career
 * match is (the 3D | 2D button in the match's bar flips it). The match first
 * replays the 2-3 real passes before the shot in its own picture (CanvasMatch's
 * `leadIn`: recorded positions, no physics; lib/star/statsbombShots.ts
 * leadinTrack), with you receiving the last one; then the shot is yours to
 * play, live, from exactly where the replay ended.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import EnginePlay from "@/components/star/EnginePlay";
import Match3DLayer from "@/components/star/Match3DLayer";
import { RadarPitch, describeArea, type RadarSide } from "@/components/star/MatchRadar";
import type { RadarFrame, RadarHighlight } from "@/lib/star/matchRadar";
import type { Zone, Lane } from "@/lib/star/hiddenMatch";
import type { Scenario } from "@/lib/star/canvasEngine";
import type { LeadIn } from "@/lib/star/leadIn";
import {
  leadinTrack, scenarioForShot, kindForShot, KIND_LABEL, type SbShot, type SbLeadin,
} from "@/lib/star/statsbombShots";

/** The radar's areas, from a StatsBomb point (attacking left → right, as the radar draws it). */
function areaOf(x: number, y: number): { zone: Zone; lane: Lane } {
  const m = (x * 105) / 120;
  const zone: Zone = m < 16.5 ? "own_box" : m < 35 ? "defensive" : m < 70 ? "middle" : m < 88.5 ? "attacking" : "box";
  const across = (y * 68) / 80;
  const lane: Lane = across < 21 ? "left" : across < 47 ? "centre" : "right";
  return { zone, lane };
}

function radarFrames(s: SbShot, lead: SbLeadin): RadarFrame[] {
  const pts = [...lead.path, [s.minute + 0.99, s.loc[0], s.loc[1]] as [number, number, number]];
  return pts.map(([minute, x, y]) => ({
    minute, possession: "user", ...areaOf(x, y), momentum: 0.6, userScore: 0, oppScore: 0, events: [],
  }));
}

/** "Morocco 1-0 Belgium" → the side that did not shoot. */
function opponentOf(s: SbShot): string {
  const m = s.match.match(/^(.*) \d+-\d+ (.*)$/);
  if (!m) return "Them";
  return m[1] === s.team ? m[2] : m[1];
}
const short = (n: string) => n.slice(0, 3).toUpperCase();

export default function MovingHighlight({ shot, lead, onClose }: { shot: SbShot; lead: SbLeadin; onClose: () => void }) {
  const frames = useMemo(() => radarFrames(shot, lead), [shot, lead]);
  const [run, setRun] = useState(0);
  /** How far through the lead-in (0..1), and its caption; 1 = the shot is yours. */
  const [prog, setProg] = useState<{ f: number; text: string; done: boolean }>({ f: 0, text: "", done: false });
  const lastSent = useRef({ at: -1, text: "" });
  const openOn = useMemo(() => () => scenarioForShot(shot), [shot]);
  const leadIn = useCallback((sc: Scenario): LeadIn => {
    const track = leadinTrack(shot, lead, sc);
    lastSent.current = { at: -1, text: "" };
    return {
      ...track,
      // Only re-render the page when the caption changes or a quarter-second has passed.
      onTick: (t, done) => {
        const text = track.captionAt?.(t) ?? "";
        if (!done && text === lastSent.current.text && t - lastSent.current.at < 0.25) return;
        lastSent.current = { at: t, text };
        setProg({ f: Math.min(1, t / track.durS), text, done });
      },
    };
  }, [shot, lead]);

  const us: RadarSide = { name: shot.team, short: short(shot.team), colour: "#2563eb", ink: "#fff", strength: 70 };
  const them: RadarSide = { name: opponentOf(shot), short: short(opponentOf(shot)), colour: "#dc2626", ink: "#fff", strength: 70 };
  // The radar runs through the move's touches as the lead-in runs.
  const frac = prog.done ? 1 : 0.35 + 0.65 * prog.f;
  const shownFrames = frames.slice(0, Math.max(1, Math.round(frac * (frames.length - 1)) + 1));
  const last = shownFrames[shownFrames.length - 1];
  const kind = kindForShot(shot);
  const pending: RadarHighlight | null = prog.f > 0.7 || prog.done
    ? { minute: last.minute, zone: last.zone, lane: last.lane, reason: "a real shot", kinds: [kind], dribble: false }
    : null;
  const caption = prog.done ? "Your turn: play the shot" : prog.text || "The move…";

  return (
    <div data-highlight className="mb-4 rounded-lg border border-emerald-400/50 bg-white/5 p-2">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-xs font-black">
          {shot.player} · {shot.team} · {shot.minute}&apos;
          <br />
          <span className="font-bold">{shot.match} · real: {shot.outcome}, xG {Math.round(shot.xg * 100)}%</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => { setProg({ f: 0, text: "", done: false }); setRun((r) => r + 1); }} className="rounded bg-white/15 px-2 py-1 text-xs font-black">↺ Again</button>
          <button onClick={onClose} className="rounded bg-white/15 px-2 py-1 text-xs font-black">■ Stop</button>
        </div>
      </div>

      <div data-radar className="mb-2">
        <RadarPitch frames={shownFrames} us={us} them={them} pending={pending} flashMinute={null} stepMs={500} />
        <div className="mt-1 text-[11px] font-bold">
          Match radar: {us.short} attacking → · {describeArea(last.zone, last.lane)}
        </div>
      </div>

      <div data-caption data-leadin-state={prog.done ? "play" : "leadin"} className="mb-1 text-sm font-black text-emerald-300">{caption}</div>
      <div className="mb-1 text-[11px] font-bold">
        {KIND_LABEL[kind] ?? kind} · You are {shot.player}. The real passes first, then it is yours.
        {lead.start ? " Start positions: StatsBomb's 360 frame at the first pass." : " No 360 frame for this move: the others start from their team's shape."}
        {" "}3D | 2D: the button in the match bar.
      </div>
      <Match3DLayer key={`${shot.id}-${run}`}>
        <EnginePlay seed={7} openOn={openOn} leadIn={leadIn} />
      </Match3DLayer>
    </div>
  );
}
