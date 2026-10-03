"use client";
/**
 * The garden's scenery pieces — lawn, borders, paths, trees, flowers, water,
 * lamps and the trophy summer-house — all drawn in the 390 x 780 frame of
 * sky.tsx. Pure drawing: every piece reads only what it is handed.
 */
import type { GardenTier, ShelfTrophy } from "@/lib/star/gardenLevel";
import { H, HORIZON, W, type SkyLook } from "./sky";

/** The garden's vanishing point: mown stripes and the path run to it. */
const VP = { x: 195, y: 250 };
/** The back of the lawn (the house's ground line). */
export const BACK = 356;

function along(xBottom: number, y: number): number {
  return VP.x + (xBottom - VP.x) * ((y - VP.y) / (H - VP.y));
}

/** The lawn, with mown stripes that run away from you. */
export function Lawn({ tier, top = BACK }: { tier: GardenTier; top?: number }) {
  const light = tier >= 1 ? "#73c24d" : "#6fb64c";
  const dark = tier >= 1 ? "#5eab3d" : "#66aa45";
  const stripes: React.ReactNode[] = [];
  const step = tier >= 3 ? 70 : 100;
  for (let k = -14; k < 14; k += 2) {
    const a = VP.x + k * step, b = VP.x + (k + 1) * step;
    stripes.push(
      <polygon key={k} points={`${along(a, top)},${top} ${along(b, top)},${top} ${b},${H} ${a},${H}`} fill={dark} />,
    );
  }
  return (
    <g>
      <defs>
        <linearGradient id="gdnLawnFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(40,70,40,0.28)" />
          <stop offset="35%" stopColor="rgba(40,70,40,0)" />
          <stop offset="100%" stopColor="rgba(255,255,220,0.06)" />
        </linearGradient>
      </defs>
      <rect x="0" y={top} width={W} height={H - top} fill={light} />
      {stripes}
      <rect x="0" y={top} width={W} height={H - top} fill="url(#gdnLawnFade)" />
    </g>
  );
}

/** The garden's back edge either side of the house: a fence, a hedge, or a
 *  hedge with stone pillars and urns. */
export function Boundary({ tier }: { tier: GardenTier }) {
  if (tier === 0) {
    return (
      <g>
        <rect x="0" y={BACK - 46} width={W} height="46" fill="#8b6239" />
        {Array.from({ length: 14 }).map((_, i) => (
          <g key={i}>
            <rect x={i * 30} y={BACK - 46} width="2.4" height="46" fill="#6b4a2a" />
            <rect x={i * 30 + 2.4} y={BACK - 46} width="27.6" height="3" fill="#a07448" />
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((j) => (
          <line key={j} x1="0" x2={W} y1={BACK - 40 + j * 9} y2={BACK - 40 + j * 9} stroke="rgba(0,0,0,0.12)" strokeWidth="0.8" />
        ))}
      </g>
    );
  }
  const bumps = Array.from({ length: 27 }, (_, i) => i * 15);
  return (
    <g>
      <rect x="0" y={BACK - 48} width={W} height="48" fill="#2f6b34" />
      {bumps.map((x, i) => (
        <circle key={i} cx={x} cy={BACK - 48 + (i % 2) * 2} r="9" fill="#2f6b34" />
      ))}
      {bumps.map((x, i) => (
        <circle key={`h${i}`} cx={x + 4} cy={BACK - 44 + (i % 3) * 8} r="3.4" fill="#3d8443" opacity="0.8" />
      ))}
      <rect x="0" y={BACK - 10} width={W} height="10" fill="rgba(0,0,0,0.18)" />
      {tier >= 3 && [14, 92, 298, 376].map((x) => (
        <g key={x}>
          <rect x={x - 9} y={BACK - 64} width="18" height="64" fill="#ddd2b8" />
          <rect x={x - 11} y={BACK - 68} width="22" height="6" fill="#efe7d4" />
          <path d={`M ${x - 7},${BACK - 68} Q ${x - 9},${BACK - 82} ${x},${BACK - 84} Q ${x + 9},${BACK - 82} ${x + 7},${BACK - 68} Z`} fill="#cfc4a8" />
        </g>
      ))}
    </g>
  );
}

/** A broad tree with a layered crown. */
export function Tree({ x, y, s = 1, dark = false }: { x: number; y: number; s?: number; dark?: boolean }) {
  const a = dark ? "#2c5e2f" : "#3e8a3d", b = dark ? "#244d27" : "#2f6d31", c = dark ? "#3a7a3b" : "#5aae4c";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="6" cy="2" rx="40" ry="7" fill="rgba(0,0,0,0.2)" />
      <path d="M -6,0 C -7,-24 -5,-44 -3,-62 L 4,-62 C 6,-44 8,-24 8,0 Z" fill="#5d3f22" />
      <path d="M 1,-40 C 10,-48 16,-50 24,-60" stroke="#5d3f22" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M -2,-48 C -12,-54 -16,-60 -22,-70" stroke="#5d3f22" strokeWidth="4" fill="none" strokeLinecap="round" />
      <g className="gdn-sway-slow">
        <circle cx="-22" cy="-74" r="26" fill={b} />
        <circle cx="24" cy="-72" r="27" fill={b} />
        <circle cx="0" cy="-98" r="32" fill={a} />
        <circle cx="-26" cy="-96" r="20" fill={a} />
        <circle cx="26" cy="-98" r="22" fill={a} />
        <circle cx="-10" cy="-112" r="18" fill={c} />
        <circle cx="12" cy="-84" r="18" fill={a} />
        <circle cx="-30" cy="-84" r="10" fill={c} opacity="0.7" />
        <circle cx="4" cy="-118" r="10" fill={c} opacity="0.8" />
      </g>
    </g>
  );
}

/** A clipped cone of box hedge in a pot (the bigger gardens). */
export function Topiary({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="1" rx="14" ry="3" fill="rgba(0,0,0,0.22)" />
      <path d="M -10,0 L 10,0 L 12,-16 L -12,-16 Z" fill="#b8673e" />
      <rect x="-13" y="-19" width="26" height="4" fill="#cc7a4c" />
      <path d="M 0,-74 C 9,-60 15,-38 14,-19 L -14,-19 C -15,-38 -9,-60 0,-74 Z" fill="#2f6d31" />
      <path d="M 0,-74 C -5,-60 -9,-40 -8,-19 L -14,-19 C -15,-38 -9,-60 0,-74 Z" fill="#3f8a3f" />
    </g>
  );
}

const PETALS = ["#ff6f91", "#ffd23f", "#c86bfa", "#ffffff", "#ff8c42", "#5ec8ff"];

/** A flower bed: a soil mound packed with swaying flowers. */
export function FlowerBed({ x, y, w, seed, flowers }: { x: number; y: number; w: number; seed: number; flowers: number }) {
  let s = seed;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const items = Array.from({ length: flowers }, () => ({
    fx: (r() - 0.5) * w * 0.9, fy: -4 - r() * 18, c: PETALS[Math.floor(r() * PETALS.length)], k: 0.8 + r() * 0.6, d: r() * 3,
  })).sort((a, b) => a.fy - b.fy);
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx={w / 2} ry={w * 0.12} fill="#5a3b22" />
      <ellipse cx="0" cy="-3" rx={w / 2 - 4} ry={w * 0.1} fill="#6e4a2b" />
      {items.map((f, i) => (
        <g key={i} transform={`translate(${f.fx} ${f.fy}) scale(${f.k})`}>
          <g className="gdn-sway" style={{ animationDelay: `-${f.d}s` }}>
            <path d="M 0,12 C 1,6 -1,3 0,0" stroke="#2f7a32" strokeWidth="1.6" fill="none" />
            <ellipse cx="-3" cy="8" rx="3" ry="1.3" fill="#3c8f3c" transform="rotate(-30 -3 8)" />
            {[0, 72, 144, 216, 288].map((a) => (
              <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 2.6} cy={Math.sin((a * Math.PI) / 180) * 2.6} r="2.3" fill={f.c} />
            ))}
            <circle r="1.5" fill="#fff1a8" />
          </g>
        </g>
      ))}
    </g>
  );
}

/** A butterfly drifting over a bed. */
export function Butterfly({ x, y, color, delay }: { x: number; y: number; color: string; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="gdn-butterfly" style={{ animationDelay: `-${delay}s` }}>
        <g className="gdn-wing">
          <ellipse cx="-3" cy="-1" rx="3.4" ry="2.6" fill={color} />
          <ellipse cx="3" cy="-1" rx="3.4" ry="2.6" fill={color} />
          <ellipse cx="-2.4" cy="2" rx="2" ry="1.6" fill={color} opacity="0.85" />
          <ellipse cx="2.4" cy="2" rx="2" ry="1.6" fill={color} opacity="0.85" />
        </g>
        <rect x="-0.5" y="-3" width="1" height="6" fill="#222" />
      </g>
    </g>
  );
}

/** Stepping stones (small gardens) or a laid stone path (bigger ones),
 *  from the patio down to you. */
export function GardenPath({ tier }: { tier: GardenTier }) {
  if (tier <= 1) {
    const stones = [396, 420, 450, 488, 534, 592, 662, 748];
    return (
      <g>
        {stones.map((y, i) => {
          const k = (y - VP.y) / (H - VP.y);
          const off = i % 2 ? 6 * k : -6 * k;
          return (
            <g key={y}>
              <ellipse cx={VP.x + off} cy={y + 2 * k} rx={46 * k} ry={13 * k} fill="rgba(0,0,0,0.18)" />
              <ellipse cx={VP.x + off} cy={y} rx={44 * k} ry={12 * k} fill="#cfc8b8" />
              <ellipse cx={VP.x + off - 6 * k} cy={y - 3 * k} rx={22 * k} ry={5 * k} fill="#e2dccd" />
            </g>
          );
        })}
      </g>
    );
  }
  const hw = (y: number) => 14 + (y - BACK) * 0.21;
  const ys = [392, 410, 432, 458, 490, 528, 574, 630, 700, 790];
  return (
    <g>
      <polygon points={`${VP.x - hw(392) - 4},392 ${VP.x + hw(392) + 4},392 ${VP.x + hw(H) + 8},${H} ${VP.x - hw(H) - 8},${H}`} fill="#9b9384" />
      <polygon points={`${VP.x - hw(392)},392 ${VP.x + hw(392)},392 ${VP.x + hw(H)},${H} ${VP.x - hw(H)},${H}`} fill="#d8cfbd" />
      {ys.map((y) => (
        <line key={y} x1={VP.x - hw(y)} x2={VP.x + hw(y)} y1={y} y2={y} stroke="#b5ab97" strokeWidth={0.6 + (y - BACK) * 0.004} />
      ))}
      {ys.slice(0, -1).map((y, i) => (
        <line key={`v${y}`} x1={VP.x + (i % 2 ? -0.25 : 0.25) * hw(y)} x2={VP.x + (i % 2 ? -0.25 : 0.25) * hw(ys[i + 1])} y1={y} y2={ys[i + 1]} stroke="#b5ab97" strokeWidth={0.6 + (y - BACK) * 0.004} />
      ))}
    </g>
  );
}

/** The patio along the back of the house. */
export function Patio({ halfW, tier }: { halfW: number; tier: GardenTier }) {
  const y0 = BACK, y1 = BACK + 36;
  const a = halfW + 10, b = halfW + 34;
  const fill = tier >= 3 ? "#e3dac6" : tier >= 2 ? "#cdc4b1" : "#b9b2a4";
  return (
    <g>
      <polygon points={`${VP.x - a},${y0} ${VP.x + a},${y0} ${VP.x + b},${y1} ${VP.x - b},${y1}`} fill={fill} />
      <polygon points={`${VP.x - b},${y1} ${VP.x + b},${y1} ${VP.x + b},${y1 + 4} ${VP.x - b},${y1 + 4}`} fill="rgba(0,0,0,0.2)" />
      {[0.33, 0.66].map((t) => (
        <line key={t} x1={VP.x - a - (b - a) * t} x2={VP.x + a + (b - a) * t} y1={y0 + 36 * t} y2={y0 + 36 * t} stroke="rgba(0,0,0,0.12)" strokeWidth="0.7" />
      ))}
      {Array.from({ length: 13 }).map((_, i) => {
        const t = i / 12;
        return <line key={i} x1={VP.x - a + 2 * a * t} x2={VP.x - b + 2 * b * t} y1={y0} y2={y1} stroke="rgba(0,0,0,0.1)" strokeWidth="0.7" />;
      })}
    </g>
  );
}

/** A garden lamp post. Its glow is drawn by LampGlow, after the tint. */
export function Lamp({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="1" rx="7" ry="2" fill="rgba(0,0,0,0.25)" />
      <rect x="-4" y="-6" width="8" height="6" fill="#1f2227" />
      <rect x="-1.6" y="-62" width="3.2" height="58" fill="#2a2e35" />
      <path d="M -6,-62 L 6,-62 L 4,-76 L -4,-76 Z" fill="#f3e2b0" stroke="#22262c" strokeWidth="1.4" />
      <path d="M -7,-76 L 7,-76 L 0,-83 Z" fill="#22262c" />
    </g>
  );
}

/** The water feature on the lawn: a bird bath, a pond, a fountain, or a big
 *  two-tier fountain — grows with the garden. */
export function WaterFeature({ x, y, tier, look }: { x: number; y: number; tier: GardenTier; look: SkyLook }) {
  const water = look.moon ? "#3a6aa8" : "#6cc3ee";
  const deep = look.moon ? "#24477a" : "#3a95c8";
  if (tier <= 1) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx="0" cy="2" rx="22" ry="5" fill="rgba(0,0,0,0.22)" />
        <path d="M -12,0 L 12,0 L 8,-8 L 5,-34 L -5,-34 L -8,-8 Z" fill="#cfc6b2" />
        <path d="M -5,-34 L 0,-34 L -1,-8 L -8,-8 Z" fill="#e3dcca" />
        <ellipse cx="0" cy="-36" rx="26" ry="7" fill="#d9d1bd" />
        <ellipse cx="0" cy="-37" rx="21" ry="4.6" fill={water} />
        <ellipse cx="-6" cy="-38" rx="7" ry="1.4" fill="rgba(255,255,255,0.5)" />
        <ellipse cx="4" cy="-37" rx="5" ry="1.4" fill="none" stroke="rgba(255,255,255,0.7)" className="gdn-ripple" />
        {/* a robin on the rim */}
        <g transform="translate(16 -41)">
          <g className="gdn-bob">
            <ellipse cx="0" cy="-4" rx="5" ry="4" fill="#6b4a33" />
            <ellipse cx="-2" cy="-3" rx="3" ry="2.6" fill="#e2632b" />
            <circle cx="-3" cy="-8" r="2.6" fill="#6b4a33" />
            <circle cx="-3.8" cy="-8.4" r="0.6" fill="#111" />
            <path d="M -5.6,-8 L -7.6,-7.4 L -5.6,-7" fill="#e9a23b" />
            <path d="M 4,-4 L 8,-6 L 7,-2 Z" fill="#5a3d2a" />
          </g>
        </g>
      </g>
    );
  }
  if (tier === 2) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx="0" cy="0" rx="58" ry="17" fill="#8d877a" />
        <ellipse cx="0" cy="-1" rx="52" ry="14" fill={deep} />
        <ellipse cx="2" cy="-2" rx="46" ry="11" fill={water} />
        <ellipse cx="-14" cy="-4" rx="14" ry="2" fill="rgba(255,255,255,0.45)" />
        {[[-24, 2], [20, -4], [32, 3]].map(([lx, ly], i) => (
          <g key={i}>
            <ellipse cx={lx} cy={ly} rx="7" ry="2.6" fill="#3f9a45" />
            {i === 0 && <circle cx={lx + 1} cy={ly - 2} r="2.4" fill="#ffb3d1" />}
          </g>
        ))}
        <ellipse cx="6" cy="-2" rx="8" ry="2.4" fill="none" stroke="rgba(255,255,255,0.7)" className="gdn-ripple" />
        <ellipse cx="-20" cy="-1" rx="6" ry="2" fill="none" stroke="rgba(255,255,255,0.6)" className="gdn-ripple" style={{ animationDelay: "-1.3s" }} />
        {[-50, -30, 30, 50].map((sx) => <ellipse key={sx} cx={sx} cy={sx % 20 ? 8 : 10} rx="7" ry="4" fill="#a39d8e" />)}
      </g>
    );
  }
  const big = tier === 4;
  return (
    <g transform={`translate(${x} ${y}) scale(${big ? 1.15 : 1})`}>
      <ellipse cx="0" cy="3" rx="62" ry="15" fill="rgba(0,0,0,0.22)" />
      <path d="M -58,-10 L 58,-10 L 58,0 C 40,8 -40,8 -58,0 Z" fill="#d8cfba" />
      <ellipse cx="0" cy="-10" rx="58" ry="13" fill="#e8e0cc" />
      <ellipse cx="0" cy="-10" rx="51" ry="10" fill={water} />
      <ellipse cx="-16" cy="-12" rx="14" ry="2" fill="rgba(255,255,255,0.45)" />
      <ellipse cx="0" cy="-10" rx="16" ry="4" fill="none" stroke="rgba(255,255,255,0.75)" className="gdn-ripple" />
      <ellipse cx="0" cy="-10" rx="16" ry="4" fill="none" stroke="rgba(255,255,255,0.6)" className="gdn-ripple" style={{ animationDelay: "-1.3s" }} />
      <rect x="-5" y="-48" width="10" height="38" fill="#d8cfba" />
      <rect x="-5" y="-48" width="4" height="38" fill="#ebe4d3" />
      {big && (
        <g>
          <ellipse cx="0" cy="-48" rx="26" ry="6" fill="#e8e0cc" />
          <ellipse cx="0" cy="-49" rx="21" ry="4" fill={water} />
          <rect x="-3" y="-74" width="6" height="26" fill="#d8cfba" />
        </g>
      )}
      {/* the spray: a jet up, arcs down, drops falling */}
      <g transform={`translate(0 ${big ? -74 : -48})`}>
        <g className="gdn-spray">
          <path d="M -1.5,0 L 1.5,0 L 0.6,-26 L -0.6,-26 Z" fill="rgba(220,245,255,0.9)" />
          <path d="M 0,-24 C -10,-30 -20,-16 -24,4" stroke="rgba(220,245,255,0.85)" strokeWidth="1.8" fill="none" />
          <path d="M 0,-24 C 10,-30 20,-16 24,4" stroke="rgba(220,245,255,0.85)" strokeWidth="1.8" fill="none" />
          <path d="M 0,-24 C -6,-28 -12,-14 -14,6" stroke="rgba(220,245,255,0.6)" strokeWidth="1.2" fill="none" />
          <path d="M 0,-24 C 6,-28 12,-14 14,6" stroke="rgba(220,245,255,0.6)" strokeWidth="1.2" fill="none" />
        </g>
        {[-22, -12, 12, 22].map((dx, i) => (
          <circle key={dx} cx={dx} cy="-2" r="1.3" fill="rgba(230,248,255,0.95)" className="gdn-drop" style={{ animationDelay: `-${i * 0.35}s` }} />
        ))}
      </g>
    </g>
  );
}

/**
 * The trophy summer-house: a timber garden room with a glass front, and on
 * its lit shelves every trophy you have won (career.trophies), one spot per
 * competition with its count. Empty shelves stay empty — real data only.
 * `layer`: the shell draws under the tint; the lit inside draws over it at
 * sunset and night so the trophies glow.
 */
export function TrophyHouse({ x, y, shelf, layer, look }: { x: number; y: number; shelf: ShelfTrophy[]; layer: "shell" | "inside"; look: SkyLook }) {
  const w = 176, wallH = 118;
  const gx = -w / 2 + 12, gw = w - 24, gy = -wallH + 18, gh = wallH - 22;
  if (layer === "inside") {
    const spots = shelf.slice(0, 12);
    const rows = [0, 1, 2];
    const rowH = gh / 3;
    return (
      <g transform={`translate(${x} ${y})`}>
        <defs>
          <linearGradient id="gdnRoom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a3a22" />
            <stop offset="100%" stopColor="#2c1b10" />
          </linearGradient>
          <radialGradient id="gdnRoomLight" cx="50%" cy="0%" r="90%">
            <stop offset="0%" stopColor="rgba(255,226,160,0.55)" />
            <stop offset="100%" stopColor="rgba(255,226,160,0)" />
          </radialGradient>
        </defs>
        <rect x={gx} y={gy} width={gw} height={gh} fill="url(#gdnRoom)" />
        <rect x={gx} y={gy} width={gw} height={gh} fill="url(#gdnRoomLight)" />
        {rows.map((r) => (
          <g key={r}>
            <rect x={gx + 2} y={gy + rowH * (r + 1) - 4} width={gw - 4} height="3.4" fill="#c79a5f" />
            <rect x={gx + 2} y={gy + rowH * (r + 1) - 0.6} width={gw - 4} height="1.4" fill="rgba(0,0,0,0.35)" />
          </g>
        ))}
        {spots.map((t, i) => {
          const r = Math.floor(i / 4), c = i % 4;
          const cx = gx + 4 + (gw - 8) * ((c + 0.5) / 4);
          const base = gy + rowH * (r + 1) - 4;
          const th = rowH - 6;
          return (
            <g key={t.name}>
              <ellipse cx={cx} cy={base} rx="10" ry="1.6" fill="rgba(0,0,0,0.35)" />
              {t.art ? (
                <image href={t.art} x={cx - 15} y={base - th} width="30" height={th} preserveAspectRatio="xMidYMax meet" />
              ) : (
                <g transform={`translate(${cx} ${base})`}>
                  <path d="M -8,-24 L 8,-24 C 8,-14 4,-10 1.5,-9 L 1.5,-5 L 5,-5 L 5,0 L -5,0 L -5,-5 L -1.5,-5 L -1.5,-9 C -4,-10 -8,-14 -8,-24 Z" fill="#e6b93c" />
                  <path d="M -8,-22 C -13,-22 -13,-15 -7,-14 M 8,-22 C 13,-22 13,-15 7,-14" stroke="#e6b93c" strokeWidth="1.6" fill="none" />
                </g>
              )}
              {t.count > 1 && (
                <g transform={`translate(${cx + 11} ${base - 7})`}>
                  <circle r="6.2" fill="#f4c542" stroke="#6b4a1c" strokeWidth="0.8" />
                  <text x="0" y="2.6" textAnchor="middle" fontSize="7.4" fontWeight="900" fill="#3b2608">{t.count}</text>
                </g>
              )}
            </g>
          );
        })}
        {/* glass on top: a pane line and a sheen */}
        <line x1={x0(gx, gw)} y1={gy} x2={x0(gx, gw)} y2={gy + gh} stroke="#f2ede2" strokeWidth="2" />
        <polygon points={`${gx},${gy + gh * 0.55} ${gx + gw * 0.3},${gy} ${gx + gw * 0.42},${gy} ${gx},${gy + gh * 0.8}`} fill="rgba(255,255,255,0.10)" />
        {look.lightsOn && <rect x={gx} y={gy} width={gw} height={gh} fill="rgba(255,190,90,0.10)" />}
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="10" cy="4" rx={w * 0.62} ry="10" fill="rgba(0,0,0,0.25)" />
      {/* deck */}
      <polygon points={`${-w / 2 - 10},0 ${w / 2 + 10},0 ${w / 2 + 16},10 ${-w / 2 - 16},10`} fill="#9a6a3e" />
      <rect x={-w / 2 - 16} y="10" width={w + 32} height="4" fill="#6f4a29" />
      {/* timber walls */}
      <rect x={-w / 2} y={-wallH} width={w} height={wallH} fill="#3f6f6a" />
      {Array.from({ length: 16 }).map((_, i) => (
        <line key={i} x1={-w / 2} x2={w / 2} y1={-wallH + i * 7.4} y2={-wallH + i * 7.4} stroke="rgba(0,0,0,0.13)" strokeWidth="0.8" />
      ))}
      <rect x={w / 2 - 22} y={-wallH} width="22" height={wallH} fill="rgba(0,0,0,0.12)" />
      {/* roof with a little gable and a star finial */}
      <polygon points={`${-w / 2 - 12},${-wallH} ${w / 2 + 12},${-wallH} 0,${-wallH - 52}`} fill="#3a3d45" />
      <polygon points={`${-w / 2 - 12},${-wallH} 0,${-wallH - 52} 4,${-wallH - 52} ${-w / 2 - 4},${-wallH}`} fill="rgba(255,255,255,0.10)" />
      <polygon points={`${-w / 2 + 14},${-wallH} ${w / 2 - 14},${-wallH} 0,${-wallH - 38}`} fill="#f1ece0" />
      <circle cx="0" cy={-wallH - 16} r="9" fill="#2e4f4b" />
      <path d={`M 0,${-wallH - 23} L 2,${-wallH - 18} L 7,${-wallH - 18} L 3,${-wallH - 14.5} L 4.6,${-wallH - 9.5} L 0,${-wallH - 12.6} L -4.6,${-wallH - 9.5} L -3,${-wallH - 14.5} L -7,${-wallH - 18} L -2,${-wallH - 18} Z`} fill="#f4c542" />
      <rect x={-w / 2 - 12} y={-wallH - 3} width={w + 24} height="4" fill="#f1ece0" />
      {/* window frame around the glass */}
      <rect x={gx - 4} y={gy - 4} width={gw + 8} height={gh + 6} fill="#f1ece0" />
      {/* inside, when it is daylight (at night it is drawn lit, after the tint) */}
      {!look.lightsOn && <TrophyHouse x={0} y={0} shelf={shelf} layer="inside" look={look} />}
      {/* hanging baskets */}
      {[-w / 2 + 2, w / 2 - 2].map((bx) => (
        <g key={bx}>
          <line x1={bx} y1={-wallH + 4} x2={bx} y2={-wallH + 16} stroke="#333" strokeWidth="0.8" />
          <ellipse cx={bx} cy={-wallH + 19} rx="8" ry="5" fill="#5b3b20" />
          {[-5, -1, 3, 6].map((fx, i) => <circle key={fx} cx={bx + fx} cy={-wallH + 15 + (i % 2) * 3} r="2.4" fill={PETALS[i]} />)}
        </g>
      ))}
    </g>
  );
}

function x0(gx: number, gw: number) { return gx + gw / 2; }

/** Long grass blades along the bottom edge, nearest the camera. */
export function ForegroundGrass({ y = H, color = "#4f9a3a" }: { y?: number; color?: string }) {
  const blades = Array.from({ length: 30 }, (_, i) => ({ x: i * 13.5 + ((i * 7) % 5), h: 14 + ((i * 11) % 13) }));
  return (
    <g>
      {blades.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${y})`}>
          <g className="gdn-sway" style={{ animationDelay: `-${(i % 7) * 0.4}s`, animationDuration: "4s" }}>
            <path d={`M -2,0 C -2,-${b.h * 0.6} 1,-${b.h * 0.8} 3,-${b.h}`} stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d={`M 2,0 C 3,-${b.h * 0.5} 1,-${b.h * 0.7} -2,-${b.h * 0.85}`} stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.8" />
          </g>
        </g>
      ))}
    </g>
  );
}

export { HORIZON };
