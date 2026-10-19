"use client";

/**
 * THE MOVING HIGHLIGHT (test page only) — Harry, 13 Oct 2026: "fit the real
 * shots test page with the match radar and passes 2/3 times before receiving
 * the ball moving highlight … needs to be playable in 2d/3d. u need to
 * actually see the 3 moves before u".
 *
 * The match radar (the same RadarPitch the match uses) follows the move. Under
 * it is the REAL MATCH (EnginePlay, the one engine), inside the career's own
 * 3D layer (Match3DLayer), so it is drawn in 2D or 3D exactly as a career
 * match is. The match first replays the build-up in its own picture
 * (CanvasMatch's `leadIn`: recorded positions, no physics), then the shot is
 * yours to play, live, from exactly where the replay ended:
 *  - a FULLY REAL shot replays where the ball and every man really were for
 *    the 4 s before it (tracking; lib/star/realMoments trackLeadIn);
 *  - a PLACED shot replays its last real passes at the real timing, the
 *    others moving from their team's shape (Wyscout; leadinTrack).
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
  leadinTrack, trackLeadIn, buildUpOf, scenarioForShot, kindForShot, isFullyReal, KIND_LABEL, type RealShot, type RealTrack,
} from "@/lib/star/realMoments";

/** The radar's areas, from one of our pitch points (y from the goal being attacked; the radar draws the attack left → right). */
function areaOf(x: number, y: number): { zone: Zone; lane: Lane } {
  const m = 105 - y;
  const zone: Zone = m < 16.5 ? "own_box" : m < 35 ? "defensive" : m < 70 ? "middle" : m < 88.5 ? "attacking" : "box";
  const lane: Lane = x < 21 ? "left" : x < 47 ? "centre" : "right";
  return { zone, lane };
}

function radarFrames(s: RealShot, track: RealTrack | null): RadarFrame[] {
  let pts: [number, number, number][];
  if (track) {
    const b = buildUpOf(track);
    pts = b.ball.filter((_, i) => i % 3 === 0).map((q) => [s.minute - 0.02 - (b.eventT - q.t) / 60, q.x, q.y]);
  } else pts = [...(s.lead?.path ?? [])];
  pts.push([s.minute - 0.01, s.ball[0], s.ball[1]]);
  return pts.map(([minute, x, y]) => ({ minute, possession: "user", ...areaOf(x, y), momentum: 0.6, userScore: 0, oppScore: 0, events: [] }));
}

const OWN_FRAME = { ownFrame: true } as const;
const short = (n: string) => n.slice(0, 3).toUpperCase();

export default function MovingHighlight({ shot, track, onClose }: { shot: RealShot; track: RealTrack | null; onClose: () => void }) {
  const full = isFullyReal(shot) && !!track;
  const frames = useMemo(() => radarFrames(shot, full ? track : null), [shot, track, full]);
  const [run, setRun] = useState(0);
  /** How far through the lead-in (0..1), and its caption; 1 = the shot is yours. */
  const [prog, setProg] = useState<{ f: number; text: string; done: boolean; t?: number }>({ f: 0, text: "", done: false });
  const lastSent = useRef({ at: -1, text: "" });
  const openOn = useMemo(() => () => scenarioForShot(shot, { wideFrame: true }), [shot]);
  const leadIn = useCallback((sc: Scenario): LeadIn | null => {
    const tr = full ? trackLeadIn(track!, sc) : shot.lead && shot.lead.passes.length ? leadinTrack(shot, shot.lead, sc) : null;
    if (!tr) return null;
    lastSent.current = { at: -1, text: "" };
    return {
      ...tr,
      // Only re-render the page when the caption changes or a quarter-second has passed.
      onTick: (t, done) => {
        const text = tr.captionAt?.(t) ?? "";
        if (!done && text === lastSent.current.text && t - lastSent.current.at < 0.25) return;
        lastSent.current = { at: t, text };
        setProg({ f: Math.min(1, t / tr.durS), text, done, t });
      },
    };
  }, [shot, track, full]);

  const us: RadarSide = { name: shot.team, short: short(shot.team), colour: "#2563eb", ink: "#fff", strength: 70 };
  const them: RadarSide = { name: shot.opp, short: short(shot.opp), colour: "#dc2626", ink: "#fff", strength: 70 };
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
          <span className="font-bold">{shot.comp} · {shot.match} · real: {shot.outcome}, xG {Math.round(shot.xg * 100)}%</span>
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

      <div data-caption data-leadin-state={prog.done ? "play" : "leadin"} data-leadin-t={(prog.t ?? 0).toFixed(2)} className="mb-1 text-sm font-black text-emerald-300">{caption}</div>
      <div className="mb-1 text-[11px] font-bold">
        {KIND_LABEL[kind] ?? kind} · You are {shot.player}.
        {full
          ? " Fully real: every player moves where he really moved for the 4 seconds before the shot."
          : " The real passes first (the others start from their team's shape and are placed by the game's rules)."}
        {" "}Then it is yours. 3D | 2D: the button in the match bar.
      </div>
      <Match3DLayer key={`${shot.id}-${run}`}>
        <EnginePlay seed={7} openOn={openOn} leadIn={leadIn} scene={OWN_FRAME} />
      </Match3DLayer>
    </div>
  );
}
