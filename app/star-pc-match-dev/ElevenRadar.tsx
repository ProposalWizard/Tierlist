"use client";
/**
 * THE ELEVEN-A-SIDE RADAR — the whole pitch from above, beside the real match.
 *
 * Harry, 20 Oct 2026, on the five-a-side test area's radar: "a cool PC layout
 * — try it for the game … the way the ball's moving across the pitch is very
 * cool." This is that radar for the real match, in the same look as
 * app/star-fiveaside-dev/FiveRadar.tsx (green stripes, your goal on the left,
 * the area the ball is in lit in the colour of whoever has it).
 *
 * It shows two things, and only what the match really knows:
 *   - BETWEEN CHANCES: the unseen match (hiddenMatch.ts). It has no players,
 *     only which fifth of the pitch the ball is in, which channel, who has it
 *     and the momentum, minute by minute. So the ball dot moves zone to zone
 *     as the clock does, with a short trail; where it sits inside its area is
 *     a seeded spot (tickSpot below), never outside the area.
 *   - DURING A CHANCE: every man the match screen is playing with and the
 *     ball, where the match has just drawn them (engineFrame.ts), plus a
 *     dashed box for the part of the pitch the match screen shows.
 *
 * Pure drawing: SVG, no canvas, no animation loop of its own (the one-engine
 * guard's rule). The page hands it plain numbers in radar metres: x 0..105
 * from your goal line to theirs, y 0..68 across.
 */
import type { RadarTick, Side } from "@/lib/star/hiddenMatch";
import { attackLabel, hadBall } from "@/lib/star/matchRadar";

export const US = "#3987e5";
export const THEM = "#d95926";
export const YOU_RING = "#ffe066";

export const PITCH_L = 105;
export const PITCH_W = 68;
const PAD = 8;
const VB_W = 420;
const VB_H = Math.round(PAD * 2 + (VB_W - PAD * 2) * (PITCH_W / PITCH_L));
const sx = (m: number) => PAD + (m / PITCH_L) * (VB_W - PAD * 2);
const sy = (m: number) => PAD + (m / PITCH_W) * (VB_H - PAD * 2);
const clampX = (m: number) => Math.max(-2, Math.min(PITCH_L + 2, m));
const clampY = (m: number) => Math.max(-2, Math.min(PITCH_W + 2, m));

/** The unseen match's five areas and three channels, in metres (MatchRadar's). */
const ZONE_X: Record<RadarTick["zone"], [number, number]> = {
  own_box: [0, 16.5], defensive: [16.5, 35], middle: [35, 70], attacking: [70, 88.5], box: [88.5, 105],
};
const LANE_Y: Record<RadarTick["lane"], [number, number]> = { left: [0, 21], centre: [21, 47], right: [47, 68] };

/**
 * Where the ball sits for a minute, in radar metres: inside the area and
 * channel the unseen match names, at a seeded spot so it is not pinned to the
 * middle every minute. Not MatchRadar's `jitter`: that hash goes negative for
 * about half the minutes (`h ^= h >>> 15` gives a signed number), which puts
 * the in-match radar's dot outside its own lit area — measured over 5 real
 * matches, 220 of 455 minutes, some off the pitch. Fixing it there changes the
 * career's radar, so that is left for Harry; this one stays unsigned.
 */
function spread(minute: number, salt: number): number {
  let h = (minute * 2654435761 + salt * 40503) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0x5bd1e995) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return (h % 1000) / 1000 - 0.5;
}
export function tickSpot(t: Pick<RadarTick, "zone" | "lane" | "minute">): { x: number; y: number } {
  const [x0, x1] = ZONE_X[t.zone], [y0, y1] = LANE_Y[t.lane];
  return { x: (x0 + x1) / 2 + spread(t.minute, 1) * (x1 - x0) * 0.5, y: (y0 + y1) / 2 + spread(t.minute, 2) * (y1 - y0) * 0.5 };
}

/**
 * The match's pitch metres (x across, 34 the goal's centre; y out from the
 * goal being attacked) as the radar's (x from your goal line, y across).
 * "us": your side attacks their goal (on the right), so the attacker's left
 * is the radar's top. "them": their kick at your goal (on the left).
 */
export function toRadar(p: { x: number; y: number }, side: "us" | "them"): { x: number; y: number } {
  return side === "us" ? { x: PITCH_L - p.y, y: p.x } : { x: p.y, y: PITCH_W - p.x };
}

export interface RadarMan { x: number; y: number; team: "us" | "them"; you?: boolean; keeper?: boolean }
export interface ChancePicture {
  kind: string;
  men: RadarMan[];
  ball: { x: number; y: number; z: number } | null;
  trail: { x: number; y: number }[];
  /** The part of the pitch the match screen shows. */
  cam: { x0: number; x1: number; y0: number; y1: number } | null;
  /** Whose goal is being attacked: "us" attack theirs (right). */
  side: "us" | "them";
}

export default function ElevenRadar({ ticks, minute, stepMs, chance, usShort, themShort }: {
  /** The unseen match's minutes up to the clock, oldest first. */
  ticks: RadarTick[];
  minute: number;
  /** How long a minute of the clock lasts now (the ball's glide between areas). */
  stepMs: number;
  /** Set while a chance is being played on the match screen. */
  chance: ChancePicture | null;
  usShort: string;
  themShort: string;
}) {
  const now = ticks.length ? ticks[ticks.length - 1] : null;
  const sideCol = (s: Side) => (s === "user" ? US : THEM);
  const col = now ? sideCol(now.possession) : "#e5e7eb";
  const glide = Math.round(Math.max(120, stepMs * 0.8));
  const line = "#ffffff";

  // The minute the clock is on flashes, once (a goal, a shot, a corner, your chance).
  const fresh = !chance && now && now.minute === Math.floor(minute) ? now : null;
  const flash = fresh?.goal ? "goal" : fresh?.yours ? "yours" : fresh?.shot ? "shot" : fresh?.corner ? "corner" : null;
  const flashSide: Side = fresh ? (fresh.goal ?? fresh.shot ?? fresh.corner ?? "user") : "user";
  const goalX = flashSide === "user" ? sx(PITCH_L) : sx(0);
  const label = flash === "goal" ? "GOAL!" : flash === "yours" ? "YOUR CHANCE" : flash === "shot" ? "SHOT" : flash === "corner" ? "CORNER" : "";

  const spot = now ? tickSpot(now) : { x: PITCH_L / 2, y: PITCH_W / 2 };
  const tickTrail = ticks.slice(-7, -1).map(tickSpot);
  const zone = now ? ZONE_X[now.zone] : null, lane = now ? LANE_Y[now.lane] : null;

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block", borderRadius: 12 }} role="img"
      data-pc-radar={chance ? "chance" : "between"}
      aria-label={chance ? `Radar: a live chance, ${chance.men.length} men on the pitch` : "Radar: the unseen match"}>
      <style>{`
        @keyframes pcRing { 0% { r: 3; opacity: 0.95; } 100% { r: 34; opacity: 0; } }
        @keyframes pcLabel { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes pcGoal { 0% { opacity: 0.6; } 100% { opacity: 0; } }
        .pc-ring { animation: pcRing 1.1s ease-out 2 both; }
        .pc-label { animation: pcLabel 1.6s ease-out both; }
        .pc-goal { animation: pcGoal 1.4s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .pc-ring, .pc-label, .pc-goal { animation: none; } }
      `}</style>
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="#155e2f" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={PAD + (i * (VB_W - PAD * 2)) / 12} y={PAD} width={(VB_W - PAD * 2) / 12} height={VB_H - PAD * 2}
          fill={i % 2 === 0 ? "#1f7a3c" : "#1b6f36"} />
      ))}
      {/* Between chances: the area the unseen match has the ball in, lit for whoever has it. */}
      {!chance && zone && lane && (
        <rect x={sx(zone[0])} y={sy(lane[0])} width={sx(zone[1]) - sx(zone[0])} height={sy(lane[1]) - sy(lane[0])}
          // Same glide and easing as the ball, so the dot never leaves its lit area mid-move.
          fill={col} opacity={0.24} style={{ transition: `all ${glide}ms ease-in-out` }} />
      )}
      <Markings />
      {([16.5, 35, 70, 88.5] as const).map((m) => (
        <line key={m} x1={sx(m)} x2={sx(m)} y1={PAD} y2={VB_H - PAD} stroke={line} strokeOpacity={0.09} strokeDasharray="3 4" />
      ))}
      {([21, 47] as const).map((m) => (
        <line key={m} x1={PAD} x2={VB_W - PAD} y1={sy(m)} y2={sy(m)} stroke={line} strokeOpacity={0.07} strokeDasharray="3 4" />
      ))}
      <text x={PAD + 4} y={VB_H - PAD - 4} fill={line} fillOpacity={0.7} fontSize={9} fontWeight={800}>{attackLabel(usShort, "user")}</text>
      <text x={VB_W - PAD - 4} y={VB_H - PAD - 4} fill={line} fillOpacity={0.7} fontSize={9} fontWeight={800} textAnchor="end">{attackLabel(themShort, "opponent")}</text>

      {chance ? <ChanceLayer c={chance} /> : (
        <>
          {flash === "goal" && <rect key={`g${fresh!.minute}`} className="pc-goal" x={0} y={0} width={VB_W} height={VB_H} fill={sideCol(flashSide)} />}
          {tickTrail.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2 + i * 0.35} fill={col} opacity={0.15 + i * 0.08} />
          ))}
          {(flash === "shot" || flash === "goal") && (
            <circle key={`r${fresh!.minute}`} className="pc-ring" cx={goalX} cy={sy(PITCH_W / 2)} r={3} fill="none"
              stroke={flash === "goal" ? "#fff" : sideCol(flashSide)} strokeWidth={2.4} />
          )}
          {flash === "corner" && (
            <circle key={`c${fresh!.minute}`} className="pc-ring" cx={goalX} cy={sy(spot.y < PITCH_W / 2 ? 0 : PITCH_W)} r={3}
              fill="none" stroke={sideCol(flashSide)} strokeWidth={2} />
          )}
          <g data-pc-ball style={{ transform: `translate(${sx(spot.x)}px, ${sy(spot.y)}px)`, transition: `transform ${glide}ms ease-in-out` }}>
            {flash === "yours" && <circle key={`y${fresh!.minute}`} className="pc-ring" r={3} fill="none" stroke={YOU_RING} strokeWidth={2.4} />}
            <circle r={8} fill="#0b1630" opacity={0.5} />
            <circle r={6.8} fill={col} />
            <circle r={3.2} fill="#ffffff" />
            {now && (
              <path d={now.possession === "user" ? "M 10 -3.5 L 14.5 0 L 10 3.5" : "M -10 -3.5 L -14.5 0 L -10 3.5"}
                fill="none" stroke="#ffffff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>
          {flash && (
            <text key={`l${fresh!.minute}${flash}`} className="pc-label" x={VB_W / 2} y={flash === "goal" ? VB_H / 2 + 10 : 26} textAnchor="middle"
              fontSize={flash === "goal" ? 30 : 14} fontWeight={900} fill={flash === "yours" ? YOU_RING : flash === "goal" ? "#fff" : sideCol(flashSide)}
              stroke="#0b1630" strokeWidth={flash === "goal" ? 4 : 3} paintOrder="stroke" letterSpacing="0.06em">{label}</text>
          )}
        </>
      )}
    </svg>
  );
}

function ChanceLayer({ c }: { c: ChancePicture }) {
  const keeperCol = (m: RadarMan) => (m.team === "them" ? THEM : US);
  return (
    <g>
      {c.cam && (
        <rect data-pc-cam x={sx(clampX(c.cam.x0))} y={sy(clampY(c.cam.y0))}
          width={Math.max(2, sx(clampX(c.cam.x1)) - sx(clampX(c.cam.x0)))} height={Math.max(2, sy(clampY(c.cam.y1)) - sy(clampY(c.cam.y0)))}
          fill="#ffffff" fillOpacity={0.05} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="5 4" />
      )}
      {c.trail.map((p, i) => (
        <circle key={i} cx={sx(clampX(p.x))} cy={sy(clampY(p.y))} r={1.5 + i * 0.25} fill="#ffffff" opacity={0.08 + i * 0.05} />
      ))}
      {c.men.map((m, i) => (
        <g key={i} transform={`translate(${sx(clampX(m.x))} ${sy(clampY(m.y))})`}>
          {m.you && <circle r={9} fill="none" stroke={YOU_RING} strokeWidth={2} />}
          <circle r={m.keeper ? 6 : 5.5} fill={m.keeper ? keeperCol(m) : m.team === "them" ? THEM : US}
            stroke={m.keeper ? "#ffffff" : "#0b1630"} strokeWidth={m.keeper ? 2 : 1.3} />
        </g>
      ))}
      {c.ball && (
        <g data-pc-ball transform={`translate(${sx(clampX(c.ball.x))} ${sy(clampY(c.ball.y))})`}>
          {c.ball.z > 0.3 && <circle r={3.6} fill="#000" opacity={0.3} cy={0} />}
          <circle r={3.8 + Math.min(6, c.ball.z) * 0.45} cy={-Math.min(6, c.ball.z) * 0.9} fill="#ffffff" stroke="#0b1630" strokeWidth={1.4} />
        </g>
      )}
    </g>
  );
}

function Markings() {
  const L = "#ffffff", o = 0.55, w = 1.1;
  const box = (x0: number, x1: number, y0: number, y1: number) => (
    <rect x={sx(Math.min(x0, x1))} y={sy(y0)} width={Math.abs(sx(x1) - sx(x0))} height={sy(y1) - sy(y0)} fill="none" stroke={L} strokeOpacity={o} strokeWidth={w} />
  );
  const r = sx(9.15) - sx(0);
  return (
    <g>
      <rect x={sx(0)} y={sy(0)} width={sx(PITCH_L) - sx(0)} height={sy(PITCH_W) - sy(0)} fill="none" stroke={L} strokeOpacity={0.65} strokeWidth={1.3} />
      <line x1={sx(52.5)} x2={sx(52.5)} y1={sy(0)} y2={sy(PITCH_W)} stroke={L} strokeOpacity={o} strokeWidth={w} />
      <circle cx={sx(52.5)} cy={sy(34)} r={r} fill="none" stroke={L} strokeOpacity={o} strokeWidth={w} />
      <circle cx={sx(52.5)} cy={sy(34)} r={1.6} fill={L} fillOpacity={o} />
      {box(0, 16.5, 13.85, 54.15)}{box(105, 88.5, 13.85, 54.15)}
      {box(0, 5.5, 24.85, 43.15)}{box(105, 99.5, 24.85, 43.15)}
      <circle cx={sx(11)} cy={sy(34)} r={1.4} fill={L} fillOpacity={o} />
      <circle cx={sx(94)} cy={sy(34)} r={1.4} fill={L} fillOpacity={o} />
      <rect x={sx(0) - 4} y={sy(30.34)} width={4} height={sy(37.66) - sy(30.34)} fill={L} fillOpacity={0.85} />
      <rect x={sx(PITCH_L)} y={sy(30.34)} width={4} height={sy(37.66) - sy(30.34)} fill={L} fillOpacity={0.85} />
    </g>
  );
}

/** Momentum, a bar a minute: up in your side's colour, down in theirs; and the share of the ball. */
export function MomentumBar({ ticks, fullTime }: { ticks: RadarTick[]; fullTime: number }) {
  const W = 400;
  const bw = (W - 8) / Math.max(1, fullTime);
  // Who had the ball IN each minute: the one rule (matchRadar.ts hadBall).
  const ours = ticks.filter((k) => hadBall(k) === "user").length;
  const poss = ticks.length ? Math.round((ours / ticks.length) * 100) : 50;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }} data-pc-momentum>
      <span style={{ fontSize: 12, fontWeight: 900, color: US, fontVariantNumeric: "tabular-nums", width: 34 }}>{poss}%</span>
      <svg viewBox={`0 0 ${W} 24`} style={{ flex: 1, display: "block", height: 22 }} preserveAspectRatio="none" aria-label="Momentum">
        <line x1={4} x2={W - 4} y1={12} y2={12} stroke="#fff" strokeOpacity={0.15} />
        <line x1={4 + 45 * bw} x2={4 + 45 * bw} y1={1} y2={23} stroke="#fff" strokeOpacity={0.15} strokeDasharray="2 2" />
        {ticks.map((k) => {
          const h = Math.max(0.8, Math.min(11, Math.abs(k.momentum) * 32));
          return <rect key={k.minute} x={4 + (Math.min(fullTime, k.minute) - 1) * bw} width={Math.max(0.8, bw - 0.6)}
            y={k.momentum >= 0 ? 12 - h : 12} height={h} fill={k.momentum >= 0 ? US : THEM} />;
        })}
        {ticks.filter((k) => k.goal).map((k) => (
          <circle key={`g${k.minute}`} cx={4 + (Math.min(fullTime, k.minute) - 0.5) * bw} cy={k.goal === "user" ? 2.5 : 21.5} r={2.3} fill="#fff" />
        ))}
      </svg>
      <span style={{ fontSize: 12, fontWeight: 900, color: THEM, fontVariantNumeric: "tabular-nums", width: 34, textAlign: "right" }}>{100 - poss}%</span>
    </div>
  );
}
