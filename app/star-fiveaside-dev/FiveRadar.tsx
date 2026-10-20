"use client";
/**
 * THE FIVE-A-SIDE RADAR — the match from above, beside the match itself.
 *
 * Why not the Match radar's own picture (components/star/MatchRadar.tsx)? That
 * one draws what the unseen ELEVEN-a-side match knows: which fifth of a
 * 105 × 68 m pitch the ball is in, and no players at all. Five-a-side knows
 * where all ten men and the ball are, on a 36 × 24 m pitch, so this draws
 * that instead, in the same look: green stripes, the area the ball is in lit
 * in the colour of whoever has it, your goal on the left.
 *
 * Fed only by FiveASide's read-only `onFrame`: it never changes the match.
 * SVG, not a canvas, and no animation loop of its own (the one-engine guard's
 * rule on canvas loops).
 */
import type { FiveFrameReport } from "@/components/star/FiveASide";
import { FIVE_PITCH } from "@/lib/star/fiveASide/geometry";
import { FIVE_A_SIDE } from "@/lib/star/fiveASide/rules";

export const US = "#3987e5";
export const THEM = "#d95926";

const L = FIVE_PITCH.y2 - FIVE_PITCH.y1;   // 36 m, goal to goal
const W = FIVE_PITCH.x2 - FIVE_PITCH.x1;   // 24 m wide
const PAD = 8;
const VB_W = 360, VB_H = Math.round(PAD * 2 + (VB_W - PAD * 2) * (W / L));
/** Your goal (y = 36) on the left, theirs (y = 0) on the right. */
const sx = (y: number) => PAD + ((FIVE_PITCH.y2 - y) / L) * (VB_W - PAD * 2);
const sy = (x: number) => PAD + ((x - FIVE_PITCH.x1) / W) * (VB_H - PAD * 2);

/** The five areas the five-a-side's own simulation thinks in (flow.ts), as
 *  depths from THEIR goal line: box, attacking, middle, defensive, own box. */
const BAND_EDGES = [0, 0.2, 0.39, 0.61, 0.8, 1];
const BAND_NAMES = ["their box", "their third", "midfield", "your third", "your box"];

export function bandName(y: number): string {
  const d = (y - FIVE_PITCH.y1) / L;
  for (let i = 0; i < 5; i++) if (d <= BAND_EDGES[i + 1]) return BAND_NAMES[i];
  return BAND_NAMES[4];
}

export default function FiveRadar({ frame, trail }: { frame: FiveFrameReport | null; trail: { x: number; y: number }[] }) {
  const col = frame?.possession === "them" ? THEM : US;
  const ball = frame?.ball;
  let band: [number, number] | null = null;
  if (ball) {
    const d = (ball.y - FIVE_PITCH.y1) / L;
    for (let i = 0; i < 5; i++) {
      if (d <= BAND_EDGES[i + 1] || i === 4) {
        band = [FIVE_PITCH.y1 + BAND_EDGES[i] * L, FIVE_PITCH.y1 + BAND_EDGES[i + 1] * L];
        break;
      }
    }
  }
  const line = "#ffffff";
  const goalW = FIVE_A_SIDE.goal.x2 - FIVE_A_SIDE.goal.x1;
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block", borderRadius: 12 }} role="img"
      aria-label={frame ? `Five-a-side radar: ball in ${bandName(frame.ball.y)}, ${frame.possession === "them" ? "they have it" : "your side has it"}` : "Five-a-side radar"}>
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="#155e2f" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={PAD + (i * (VB_W - PAD * 2)) / 10} y={PAD} width={(VB_W - PAD * 2) / 10} height={VB_H - PAD * 2}
          fill={i % 2 === 0 ? "#1f7a3c" : "#1b6f36"} />
      ))}
      {band && (
        <rect x={sx(band[1])} y={sy(FIVE_PITCH.x1)} width={sx(band[0]) - sx(band[1])} height={sy(FIVE_PITCH.x2) - sy(FIVE_PITCH.x1)}
          fill={col} opacity={0.2} />
      )}
      {/* Markings: touchlines, halfway, centre circle, the two goal areas and goals. */}
      <rect x={sx(FIVE_PITCH.y2)} y={sy(FIVE_PITCH.x1)} width={sx(FIVE_PITCH.y1) - sx(FIVE_PITCH.y2)} height={sy(FIVE_PITCH.x2) - sy(FIVE_PITCH.x1)}
        fill="none" stroke={line} strokeOpacity={0.6} strokeWidth={1.3} />
      <line x1={sx(L / 2)} x2={sx(L / 2)} y1={sy(FIVE_PITCH.x1)} y2={sy(FIVE_PITCH.x2)} stroke={line} strokeOpacity={0.55} strokeWidth={1.1} />
      <circle cx={sx(L / 2)} cy={sy(FIVE_PITCH.x1 + W / 2)} r={sx(0) - sx(3)} fill="none" stroke={line} strokeOpacity={0.5} strokeWidth={1.1} />
      {[FIVE_PITCH.y1, FIVE_PITCH.y2].map((gy) => {
        const deep = 4.5, wide = 8;
        const x0 = FIVE_PITCH.x1 + W / 2 - wide / 2;
        const near = gy === FIVE_PITCH.y1 ? gy + deep : gy - deep;
        return (
          <g key={gy}>
            <rect x={Math.min(sx(gy), sx(near))} y={sy(x0)} width={Math.abs(sx(near) - sx(gy))} height={sy(x0 + wide) - sy(x0)}
              fill="none" stroke={line} strokeOpacity={0.5} strokeWidth={1.1} />
            <rect x={gy === FIVE_PITCH.y1 ? sx(gy) : sx(gy) - 4} y={sy(FIVE_A_SIDE.goal.x1)} width={4} height={sy(FIVE_A_SIDE.goal.x1 + goalW) - sy(FIVE_A_SIDE.goal.x1)}
              fill="#ffffff" fillOpacity={0.85} />
          </g>
        );
      })}
      {/* The five areas, faintly. */}
      {BAND_EDGES.slice(1, -1).map((d) => (
        <line key={d} x1={sx(FIVE_PITCH.y1 + d * L)} x2={sx(FIVE_PITCH.y1 + d * L)} y1={PAD} y2={VB_H - PAD}
          stroke="#ffffff" strokeOpacity={0.1} strokeDasharray="3 4" />
      ))}
      <text x={PAD + 4} y={VB_H - PAD - 4} fill="#ffffff" fillOpacity={0.7} fontSize={9} fontWeight={800}>YOUR GOAL</text>
      <text x={VB_W - PAD - 4} y={VB_H - PAD - 4} fill="#ffffff" fillOpacity={0.7} fontSize={9} fontWeight={800} textAnchor="end">THEIR GOAL</text>
      {trail.map((p, i) => (
        <circle key={i} cx={sx(p.y)} cy={sy(p.x)} r={1.6 + i * 0.3} fill="#ffffff" opacity={0.08 + i * 0.06} />
      ))}
      {frame?.figures.map((f, i) => (
        <g key={i} transform={`translate(${sx(f.y)} ${sy(f.x)})`}>
          {f.star && <circle r={9} fill="none" stroke="#ffe066" strokeWidth={2} />}
          <circle r={f.keeper ? 6.5 : 6} fill={f.side === "them" ? THEM : US} stroke={f.keeper ? "#ffffff" : "#0b1630"} strokeWidth={f.keeper ? 2 : 1.4} />
        </g>
      ))}
      {ball && (
        <g transform={`translate(${sx(ball.y)} ${sy(ball.x)})`}>
          <circle r={4.4} fill="#ffffff" stroke="#0b1630" strokeWidth={1.4} />
        </g>
      )}
    </svg>
  );
}
