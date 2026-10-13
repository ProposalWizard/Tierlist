"use client";

/**
 * THE MOVING HIGHLIGHT (test page only) — Harry, 13 Oct 2026: "fit the real
 * shots test page with the match radar and passes 2/3 times before receiving
 * the ball moving highlight".
 *
 * The match radar (the same RadarPitch the radar test page and the match use)
 * shows the move coming up the pitch; then the 2-3 real passes before the
 * shot play on our pitch; then the real engine (EnginePlay) takes over at the
 * shot's freeze frame. The lead-in is display only: each pass is one CSS
 * transition between keyframes (lib/star/statsbombShots.ts leadinPlan), timed
 * with setTimeout. No game loop, no ball physics, nothing on a canvas.
 */
import { useEffect, useMemo, useState } from "react";
import EnginePlay from "@/components/star/EnginePlay";
import { RadarPitch, describeArea, type RadarSide } from "@/components/star/MatchRadar";
import type { RadarFrame, RadarHighlight } from "@/lib/star/matchRadar";
import type { Zone, Lane } from "@/lib/star/hiddenMatch";
import { PITCH_W, CX, POST_L, POST_R, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, PEN_SPOT_Y, NET_DEPTH, HALF_LEN } from "@/lib/star/pitch";
import {
  leadinPlan, lerpVec, scenarioForShot, kindForShot, KIND_LABEL, type SbShot, type SbLeadin,
} from "@/lib/star/statsbombShots";

const COLOUR = { you: "#fde047", mate: "#3b82f6", opp: "#ef4444", keeper: "#a3e635" } as const;

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
  const plan = useMemo(() => leadinPlan(shot, lead), [shot, lead]);
  const frames = useMemo(() => radarFrames(shot, lead), [shot, lead]);
  /** -1: the radar alone; 0..n-1: the lead-in keys; n: handed over to the engine. */
  const [step, setStep] = useState(-1);
  const [run, setRun] = useState(0);
  const n = plan.keys.length;
  const openOn = useMemo(() => () => scenarioForShot(shot), [shot]);

  useEffect(() => {
    setStep(-1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 1600;                          // the radar shows the move first
    timers.push(setTimeout(() => setStep(0), t));
    t += 500;
    for (let k = 1; k < n; k++) { timers.push(setTimeout(() => setStep(k), t)); t += plan.keys[k].ms; }
    timers.push(setTimeout(() => setStep(n), t + 700));
    return () => timers.forEach(clearTimeout);
  }, [plan, n, run]);

  const us: RadarSide = { name: shot.team, short: short(shot.team), colour: "#2563eb", ink: "#fff", strength: 70 };
  const them: RadarSide = { name: opponentOf(shot), short: short(opponentOf(shot)), colour: "#dc2626", ink: "#fff", strength: 70 };
  // The radar runs through the move's touches as the lead-in runs.
  const frac = step < 0 ? 0.35 : step >= n ? 1 : plan.at[step];
  const shownFrames = frames.slice(0, Math.max(1, Math.round(frac * (frames.length - 1)) + 1));
  const last = shownFrames[shownFrames.length - 1];
  const kind = kindForShot(shot);
  const pending: RadarHighlight | null = step >= n - 1
    ? { minute: last.minute, zone: last.zone, lane: last.lane, reason: "a real shot", kinds: [kind], dribble: false }
    : null;

  const k = Math.max(0, Math.min(step, n - 1));
  const f = step < 0 ? 0 : plan.at[k];
  const ms = step <= 0 ? 0 : plan.keys[k].ms;
  const ball = plan.keys[k].ball;
  // Tall enough for the whole move (a move from a goal kick shows the whole pitch).
  const yMax = Math.min(2 * HALF_LEN + 2, Math.max(34, ...plan.keys.map((q) => q.ball.y + 6), ...plan.dots.map((d) => d.from.y + 3)));
  const y0 = -NET_DEPTH - 1.5;
  const h = yMax - y0;
  const line = "rgba(255,255,255,0.55)";
  const move = (p: { x: number; y: number }) => ({
    transform: `translate(${p.x}px, ${p.y}px)`,
    transition: ms ? `transform ${ms}ms linear` : "none",
  });
  const caption = step < 0 ? `Radar: ${describeArea(last.zone, last.lane)}` : step >= n ? "Your turn: play the shot" : plan.keys[k].text;

  return (
    <div data-highlight className="mb-4 rounded-lg border border-emerald-400/50 bg-white/5 p-2">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-xs font-black">
          {shot.player} · {shot.team} · {shot.minute}&apos;
          <br />
          <span className="font-bold">{shot.match} · real: {shot.outcome}, xG {Math.round(shot.xg * 100)}%</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setRun((r) => r + 1)} className="rounded bg-white/15 px-2 py-1 text-xs font-black">↺ Again</button>
          <button onClick={onClose} className="rounded bg-white/15 px-2 py-1 text-xs font-black">■ Stop</button>
        </div>
      </div>

      <div data-radar className="mb-2">
        <RadarPitch frames={shownFrames} us={us} them={them} pending={pending} flashMinute={null} stepMs={step <= 0 ? 600 : Math.max(300, ms)} />
        <div className="mt-1 text-[11px] font-bold">
          Match radar: {us.short} attacking → · {describeArea(last.zone, last.lane)}
        </div>
      </div>

      <div data-caption className="mb-1 text-sm font-black text-emerald-300">{caption}</div>

      {step < n ? (
        <svg data-leadin viewBox={`-1 ${y0} ${PITCH_W + 2} ${h}`} width="100%" style={{ background: "#166534", borderRadius: 8, display: "block", maxHeight: "46vh" }}>
          <rect x={0} y={0} width={PITCH_W} height={yMax + 5} fill="none" stroke={line} strokeWidth={0.25} />
          <rect x={BOX_L} y={0} width={BOX_R - BOX_L} height={BOX_DEPTH} fill="none" stroke={line} strokeWidth={0.25} />
          <rect x={SIX_L} y={0} width={SIX_R - SIX_L} height={SIX_DEPTH} fill="none" stroke={line} strokeWidth={0.25} />
          <circle cx={CX} cy={PEN_SPOT_Y} r={0.3} fill={line} />
          {yMax > HALF_LEN && <line x1={0} x2={PITCH_W} y1={HALF_LEN} y2={HALF_LEN} stroke={line} strokeWidth={0.25} />}
          <rect x={POST_L} y={-NET_DEPTH} width={POST_R - POST_L} height={NET_DEPTH} fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth={0.3} />
          {/* The passes already played, as a faint trail. */}
          {plan.keys.slice(1, k + 1).map((q, i) => (
            <line key={i} x1={plan.keys[i].ball.x} y1={plan.keys[i].ball.y} x2={q.ball.x} y2={q.ball.y}
              stroke="#fff" strokeOpacity={0.35} strokeWidth={0.3} strokeDasharray="0.8 0.6" />
          ))}
          {plan.dots.map((d) => (
            <g key={d.id} style={move(lerpVec(d.from, d.to, f))}>
              <circle r={d.side === "you" ? 1.3 : 1.05} fill={COLOUR[d.side]} stroke="#0b1220" strokeWidth={0.2} />
            </g>
          ))}
          <g style={move(ball)}>
            <circle r={0.6} fill="#fff" stroke="#0b1220" strokeWidth={0.15} />
          </g>
        </svg>
      ) : (
        <div data-playing>
          <div className="mb-1 text-[11px] font-bold">
            {KIND_LABEL[kind] ?? kind}: the real engine, from the shot&apos;s freeze frame. You are {shot.player}.
          </div>
          <EnginePlay key={`${shot.id}-${run}`} seed={7} openOn={openOn} />
        </div>
      )}
      <div className="mt-1 text-[11px] font-bold">
        Yellow = the shooter, blue = his team-mates, red = opponents, green = keeper.
        {lead.start ? " Start positions: StatsBomb's 360 frame at the first pass." : " No 360 frame for this move: only the shooter moves."}
      </div>
    </div>
  );
}
