"use client";
/**
 * The garden's sky, distance and light — shared by all three garden scenes
 * (components/star/GardenScreen.tsx) so a swipe reads as one place.
 *
 * The light follows Home's own sky (lib/star/kickoff.ts, `homeSkyFor`): the
 * time of your next kick-off. Day is bright with a high sun; sunset is warm
 * with a low sun and long shadows; night is blue with a moon, stars and the
 * lamps and windows lit. Everything is drawn in one 390 x 780 frame.
 */
import type { HomeSky } from "@/lib/star/kickoff";

export const W = 390;
export const H = 780;
/** Where the far edge of the garden meets the trees. */
export const HORIZON = 336;

export interface SkyLook {
  sky: [string, string, string, string];
  sun: { x: number; y: number; r: number; fill: string; glow: string } | null;
  moon: boolean;
  hillFar: string;
  hillNear: string;
  treeLine: string;
  cloud: string;
  cloudShade: string;
  /** Laid over the finished picture (multiply) — null for full daylight. */
  tint: { color: string; opacity: number } | null;
  /** Ground shadows: how dark and how far they stretch sideways. */
  shadow: string;
  shadowStretch: number;
  /** Lit windows, lamps and fairy lights show from this light on. */
  lightsOn: boolean;
}

export const LOOKS: Record<HomeSky, SkyLook> = {
  day: {
    sky: ["#2a6fc4", "#4f98e0", "#9fd0f2", "#e4f4fb"],
    sun: { x: 318, y: 84, r: 22, fill: "#fff8d6", glow: "rgba(255,246,200,0.7)" },
    moon: false,
    hillFar: "#8fb9a6",
    hillNear: "#6e9f7c",
    treeLine: "#4f8a5c",
    cloud: "#ffffff",
    cloudShade: "#d7e5f1",
    tint: null,
    shadow: "rgba(18,46,12,0.30)",
    shadowStretch: 1,
    lightsOn: false,
  },
  sunset: {
    sky: ["#2f2a6b", "#8c4a90", "#ee7a55", "#ffcf86"],
    sun: { x: 290, y: 300, r: 34, fill: "#ffe2a0", glow: "rgba(255,170,90,0.75)" },
    moon: false,
    hillFar: "#a5687a",
    hillNear: "#6e4f63",
    treeLine: "#3f3a4c",
    cloud: "#ffc29a",
    cloudShade: "#c86a78",
    tint: { color: "#ff9f6a", opacity: 0.3 },
    shadow: "rgba(40,10,30,0.34)",
    shadowStretch: 2.1,
    lightsOn: true,
  },
  night: {
    sky: ["#040817", "#0b1638", "#16285a", "#2c4176"],
    sun: null,
    moon: true,
    hillFar: "#1c2c52",
    hillNear: "#15223f",
    treeLine: "#0f1a33",
    cloud: "#3a4b78",
    cloudShade: "#24335a",
    tint: { color: "#2a3f86", opacity: 0.62 },
    shadow: "rgba(0,0,10,0.35)",
    shadowStretch: 0.6,
    lightsOn: true,
  },
};

/** Seeded so a picture is the same on every visit (house rule: no random art). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const STARS = (() => {
  const r = rng(7);
  return Array.from({ length: 70 }, () => ({ x: r() * W, y: -380 + r() * 640, s: 0.5 + r() * 1.3, d: r() * 4 }));
})();

function Cloud({ x, y, s, look, dur, delay }: { x: number; y: number; s: number; look: SkyLook; dur: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="gdn-drift" style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}>
        <ellipse cx="0" cy="6" rx="46" ry="11" fill={look.cloudShade} />
        <circle cx="-22" cy="0" r="15" fill={look.cloud} />
        <circle cx="2" cy="-8" r="20" fill={look.cloud} />
        <circle cx="26" cy="-1" r="14" fill={look.cloud} />
        <ellipse cx="2" cy="6" rx="42" ry="8" fill={look.cloud} />
      </g>
    </g>
  );
}

function Bird({ y, dur, delay, s }: { y: number; dur: number; delay: number; s: number }) {
  return (
    <g className="gdn-fly" style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}>
      <g transform={`translate(0 ${y}) scale(${s})`}>
        <g className="gdn-flap">
          <path d="M -7,0 Q -3.5,-4 0,0 Q 3.5,-4 7,0" stroke="#22283a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
}

/** Sky, sun or moon, clouds, birds and the far hills and tree line. */
export function SkyAndDistance({ look, seed = 1, stadium }: { look: SkyLook; seed?: number; stadium?: number }) {
  const r = rng(seed * 97 + 13);
  const treeBumps = Array.from({ length: 22 }, (_, i) => ({ x: i * 19 + r() * 10 - 6, r: 13 + r() * 13, y: HORIZON - 14 - r() * 18 }));
  return (
    <g>
      <defs>
        <linearGradient id="gdnSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={look.sky[0]} />
          <stop offset="45%" stopColor={look.sky[1]} />
          <stop offset="80%" stopColor={look.sky[2]} />
          <stop offset="100%" stopColor={look.sky[3]} />
        </linearGradient>
        {look.sun && (
          <radialGradient id="gdnSunGlow">
            <stop offset="0%" stopColor={look.sun.glow} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        )}
        <radialGradient id="gdnMoonGlow">
          <stop offset="0%" stopColor="rgba(200,220,255,0.45)" />
          <stop offset="100%" stopColor="rgba(200,220,255,0)" />
        </radialGradient>
      </defs>
      <rect x="-60" y="-420" width={W + 120} height="420" fill={look.sky[0]} />
      <rect x="-60" y="0" width={W + 120} height={HORIZON + 10} fill="url(#gdnSky)" />
      {look.moon && STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" className="gdn-twinkle" style={{ animationDelay: `-${s.d}s` }} />
      ))}
      {look.sun && (
        <g>
          <circle cx={look.sun.x} cy={look.sun.y} r={look.sun.r * 4} fill="url(#gdnSunGlow)" />
          <circle cx={look.sun.x} cy={look.sun.y} r={look.sun.r} fill={look.sun.fill} />
        </g>
      )}
      {look.moon && (
        <g>
          <circle cx="300" cy="86" r="70" fill="url(#gdnMoonGlow)" />
          <circle cx="300" cy="86" r="17" fill="#f3f1e3" />
          <circle cx="294" cy="82" r="3.4" fill="#dedbc8" />
          <circle cx="306" cy="92" r="2.4" fill="#dedbc8" />
          <circle cx="303" cy="78" r="1.6" fill="#dedbc8" />
        </g>
      )}
      <Cloud x={70} y={96} s={1} look={look} dur={160} delay={10} />
      <Cloud x={230} y={160} s={0.7} look={look} dur={210} delay={90} />
      <Cloud x={140} y={46} s={0.55} look={look} dur={240} delay={170} />
      {!look.moon && (
        <>
          <Bird y={150} dur={26} delay={4} s={1} />
          <Bird y={162} dur={26} delay={5.2} s={0.8} />
          <Bird y={118} dur={34} delay={20} s={0.9} />
        </>
      )}
      {/* far hills, then a nearer line of trees: two depths of distance */}
      <path d={`M 0,${HORIZON - 52} C 70,${HORIZON - 86} 140,${HORIZON - 70} 210,${HORIZON - 60} C 280,${HORIZON - 50} 330,${HORIZON - 92} ${W},${HORIZON - 70} L ${W},${HORIZON} L 0,${HORIZON} Z`} fill={look.hillFar} />
      <path d={`M 0,${HORIZON - 30} C 90,${HORIZON - 50} 160,${HORIZON - 28} 250,${HORIZON - 38} C 320,${HORIZON - 46} 360,${HORIZON - 30} ${W},${HORIZON - 34} L ${W},${HORIZON} L 0,${HORIZON} Z`} fill={look.hillNear} />
      {stadium !== undefined && <Stadium x={stadium} look={look} />}
      {treeBumps.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={look.treeLine} />
      ))}
      <rect x="0" y={HORIZON - 16} width={W} height="20" fill={look.treeLine} />
    </g>
  );
}

/** A football ground on the far hills, its floodlights on at night — you
 *  are never far from a pitch. `glow` draws only the lit lamps. */
export function Stadium({ x, look, glow = false }: { x: number; look: SkyLook; glow?: boolean }) {
  const y = HORIZON - 40;
  const lamps = [x - 34, x + 34];
  if (glow) {
    return (
      <g>
        {lamps.map((lx) => (
          <g key={lx}>
            <Glow x={lx} y={y - 26} r={26} color="235,245,255" strength={0.9} />
            <rect x={lx - 5} y={y - 30} width="10" height="5" fill="#f4f8ff" />
          </g>
        ))}
      </g>
    );
  }
  const c = look.hillNear;
  return (
    <g>
      {lamps.map((lx) => (
        <g key={lx}>
          <rect x={lx - 1} y={y - 26} width="2" height="30" fill={c} />
          <rect x={lx - 5} y={y - 31} width="10" height="6" fill={c} />
        </g>
      ))}
      <path d={`M ${x - 40},${y + 12} L ${x - 34},${y - 4} L ${x + 34},${y - 4} L ${x + 40},${y + 12} Z`} fill={c} />
      <path d={`M ${x - 34},${y - 4} Q ${x},${y - 12} ${x + 34},${y - 4}`} fill={c} />
    </g>
  );
}

/** The colour of the light, laid over the whole finished picture. */
export function Tint({ look }: { look: SkyLook }) {
  if (!look.tint) return null;
  return <rect x="-60" y="-420" width={W + 120} height={H + 440} fill={look.tint.color} opacity={look.tint.opacity} style={{ mixBlendMode: "multiply" }} />;
}

/** A soft round glow — lamps, windows, fairy lights. Drawn after the Tint. */
export function Glow({ x, y, r, color = "255,214,140", strength = 0.75 }: { x: number; y: number; r: number; color?: string; strength?: number }) {
  const id = `gdnGlow${color.replace(/\D/g, "")}`;
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" stopColor={`rgba(${color},1)`} />
          <stop offset="35%" stopColor={`rgba(${color},0.35)`} />
          <stop offset="100%" stopColor={`rgba(${color},0)`} />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} opacity={strength} />
    </>
  );
}

/** Fireflies over the grass at night — a little life after dark. */
export function Fireflies({ look, area }: { look: SkyLook; area: [number, number, number, number] }) {
  if (!look.moon) return null;
  const r = rng(31);
  const [x0, y0, x1, y1] = area;
  return (
    <g>
      {Array.from({ length: 9 }, (_, i) => {
        const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="1.8" fill="#f6ff9a" className="gdn-firefly" style={{ animationDelay: `-${(r() * 6).toFixed(2)}s`, animationDuration: `${5 + r() * 4}s` }} />
          </g>
        );
      })}
    </g>
  );
}

/** Every animation the garden uses, one place. Transforms only, so a phone
 *  can run them on the compositor. */
export const GARDEN_CSS = `
.gdn-drift { animation: gdnDrift 180s linear infinite; }
@keyframes gdnDrift { from { transform: translateX(-260px); } to { transform: translateX(520px); } }
.gdn-fly { animation: gdnFly 28s linear infinite; }
@keyframes gdnFly { from { transform: translateX(-40px); } to { transform: translateX(440px); } }
.gdn-flap { animation: gdnFlap 0.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes gdnFlap { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(-0.5); } }
.gdn-twinkle { animation: gdnTwinkle 3.4s ease-in-out infinite; }
@keyframes gdnTwinkle { 0%,100% { opacity: 0.95; } 50% { opacity: 0.25; } }
.gdn-firefly { animation: gdnFirefly 6s ease-in-out infinite; }
@keyframes gdnFirefly {
  0%,100% { transform: translate(0,0); opacity: 0.1; }
  25% { transform: translate(6px,-8px); opacity: 1; }
  50% { transform: translate(-4px,-14px); opacity: 0.4; }
  75% { transform: translate(-9px,-5px); opacity: 1; }
}
.gdn-sway { animation: gdnSway 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes gdnSway { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
.gdn-sway-slow { animation: gdnSwaySlow 6s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes gdnSwaySlow { 0%,100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
.gdn-spray { animation: gdnSpray 1.1s ease-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes gdnSpray { 0% { transform: scaleY(0.7); opacity: 0.9; } 60% { transform: scaleY(1.05); opacity: 0.75; } 100% { transform: scaleY(0.7); opacity: 0.9; } }
.gdn-drop { animation: gdnDrop 1.4s ease-in infinite; }
@keyframes gdnDrop { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(16px); opacity: 0; } }
.gdn-ripple { animation: gdnRipple 2.6s ease-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes gdnRipple { from { transform: scale(0.3); opacity: 0.8; } to { transform: scale(1.4); opacity: 0; } }
.gdn-flame { animation: gdnFlame 0.45s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes gdnFlame { from { transform: scale(0.9, 0.85) skewX(-4deg); } to { transform: scale(1.05, 1.1) skewX(4deg); } }
.gdn-bob { animation: gdnBob 2.4s ease-in-out infinite; }
@keyframes gdnBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.6px); } }
.gdn-butterfly { animation: gdnButterfly 14s ease-in-out infinite; }
@keyframes gdnButterfly {
  0%,100% { transform: translate(0,0); } 20% { transform: translate(40px,-26px); }
  40% { transform: translate(90px,-6px); } 60% { transform: translate(60px,-40px); } 80% { transform: translate(20px,-14px); }
}
.gdn-wing { animation: gdnWing 0.22s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 50%; }
@keyframes gdnWing { from { transform: scaleX(1); } to { transform: scaleX(0.25); } }
`;
