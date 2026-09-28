"use client";

/**
 * A small looping drawing of one penalty run-up, for the store's Animations
 * cards (/star-store-dev).
 *
 * A side-on shop-window sketch driven by lib/star/store/runupPreview.ts. The
 * styles themselves (ids, names, descriptions) are the real ones from
 * lib/star/runupStyles.ts; the match draws the real run-up in CanvasMatch.
 *
 * Pure SVG + CSS keyframes, sampled once from `runupPose`. No canvas and no
 * animation loop of its own: the browser plays the keyframes.
 */
import { useMemo } from "react";
import { ROLE_KIT } from "@/lib/star/fiveASide/render";
import { runupPose, hasWall, BALL_X, WALL_X, LOOP_SECONDS } from "@/lib/star/store/runupPreview";
import type { AnimationId } from "@/lib/star/store/catalogue";

const SAMPLES = 60;
const GROUND = 66;
const SKIN = "#e7b68f";
/** The figure is drawn this much bigger than its 14-unit legs, so it reads on a phone card. */
const K = 1.4;

function num(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export default function RunupPreview({ style, className = "", paused = false }: { style: AnimationId; className?: string; paused?: boolean }) {
  const id = `ru-${style}`;
  const css = useMemo(() => {
    const fig: string[] = [], back: string[] = [], front: string[] = [], arm: string[] = [], ball: string[] = [], whole: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const p = runupPose(style, t === 1 ? 0.9999 : t);
      const pct = `${num(t * 100)}%`;
      const s = (1 - p.depth * 0.4) * K;
      const y = GROUND - 14 * s - p.depth * 20 - p.hop;
      const swing = Math.sin(p.phase) * 32 * p.stride;
      fig.push(`${pct}{transform:translate(${num(p.x)}px,${num(y)}px) scale(${num(s)})}`);
      back.push(`${pct}{transform:rotate(${num(p.kick > 0 ? 8 : swing)}deg)}`);
      front.push(`${pct}{transform:rotate(${num(p.kick > 0 ? -82 * p.kick : -swing)}deg)}`);
      arm.push(`${pct}{transform:rotate(${num(p.kick > 0 ? 70 * p.kick : -swing * 1.1)}deg)}`);
      ball.push(`${pct}{transform:translate(${num(p.ballX)}px,${num(GROUND - 2.4 - p.ballUp)}px)}`);
      whole.push(`${pct}{opacity:${num(p.opacity)}}`);
    }
    const anim = (name: string) => `animation:${id}-${name} ${LOOP_SECONDS}s linear infinite;`;
    const origin = "transform-box:view-box;transform-origin:0 0;";
    return [
      `@keyframes ${id}-fig{${fig.join("")}}`,
      `@keyframes ${id}-back{${back.join("")}}`,
      `@keyframes ${id}-front{${front.join("")}}`,
      `@keyframes ${id}-arm{${arm.join("")}}`,
      `@keyframes ${id}-ball{${ball.join("")}}`,
      `@keyframes ${id}-whole{${whole.join("")}}`,
      `.${id} .fig{${origin}${anim("fig")}}`,
      `.${id} .back{${origin}${anim("back")}}`,
      `.${id} .front{${origin}${anim("front")}}`,
      `.${id} .arm{${origin}${anim("arm")}}`,
      `.${id} .ball{${origin}${anim("ball")}}`,
      `.${id} .whole{${anim("whole")}}`,
      `.${id}.paused *{animation-play-state:paused}`,
      `@media (prefers-reduced-motion: reduce){.${id} *{animation-play-state:paused}}`,
    ].join("\n");
  }, [id, style]);

  return (
    <svg viewBox="0 0 120 80" className={`${id} ${paused ? "paused" : ""} ${className}`} aria-hidden>
      <style>{css}</style>
      <defs>
        <linearGradient id={`${id}-grass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f7a3a" />
          <stop offset="1" stopColor="#14532d" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="120" height="80" fill="#0b1a2e" />
      <rect x="0" y="36" width="120" height="44" fill={`url(#${id}-grass)`} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 30} y="36" width="15" height="44" fill="rgba(255,255,255,0.035)" />
      ))}
      {/* Goal, off to the right, so the strike has somewhere to go. */}
      <path d="M104 30 V58 M104 30 H120" stroke="#f8fafc" strokeWidth="1.4" fill="none" opacity="0.85" />
      {/* The penalty spot. */}
      {!hasWall(style) && <ellipse cx={BALL_X} cy={GROUND} rx="2.2" ry="0.8" fill="rgba(255,255,255,0.7)" />}
      {/* A free kick's wall: three men, shoulder to shoulder, stepped back into the grass. */}
      {hasWall(style) && [0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${WALL_X + i * 1.6},${GROUND - 12 - i * 2.2})`} opacity={1 - i * 0.12}>
          <rect x="-2.6" y="0" width="5.2" height="8" rx="1.8" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.5" />
          <rect x="-2.3" y="7.5" width="1.5" height="4.5" fill={SKIN} />
          <rect x="0.8" y="7.5" width="1.5" height="4.5" fill={SKIN} />
          <circle cx="0" cy="-2.6" r="2.7" fill={SKIN} />
        </g>
      ))}

      <g className="whole">
        <g className="fig">
          {/* ground shadow, under the hip */}
          <ellipse cx="0" cy="14" rx="6" ry="1.4" fill="rgba(0,0,0,0.35)" />
          <g className="back">
            <line x1="0" y1="0" x2="0" y2="13" stroke={SKIN} strokeWidth="2.6" strokeLinecap="round" opacity="0.85" />
            <ellipse cx="1.4" cy="13.6" rx="2.4" ry="1.2" fill="#111827" />
          </g>
          <rect x="-3.8" y="-15" width="7.6" height="14" rx="2.4" fill={ROLE_KIT.you} stroke={ROLE_KIT.youRim} strokeWidth="0.8" />
          <rect x="-3.6" y="-2.5" width="7.2" height="5" rx="1.4" fill="#064e3b" />
          <g className="front">
            <line x1="0" y1="0" x2="0" y2="13" stroke={SKIN} strokeWidth="2.8" strokeLinecap="round" />
            <ellipse cx="1.6" cy="13.6" rx="2.6" ry="1.3" fill="#0b0f19" />
          </g>
          <g transform="translate(0,-12.5)">
            <g className="arm">
              <line x1="0" y1="0" x2="0" y2="10" stroke={SKIN} strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="0" x2="0" y2="4" stroke={ROLE_KIT.you} strokeWidth="2.6" strokeLinecap="round" />
            </g>
          </g>
          <circle cx="0.6" cy="-19.6" r="4.4" fill={SKIN} />
          <path d="M-3.8 -20.6 a4.4 4.4 0 0 1 8.4 -1.8 l-1.2 -0.1 a3.4 3.4 0 0 0 -6 0.9 z" fill="#3b2314" />
        </g>
        <g className="ball">
          <circle cx="0" cy="0" r="2.4" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.6" />
          <path d="M-0.9 -0.7 L0.9 -0.7 L1.3 0.6 L0 1.5 L-1.3 0.6 Z" fill="#0f172a" />
        </g>
      </g>
    </svg>
  );
}
