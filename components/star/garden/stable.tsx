"use client";
/**
 * The stable yard: the stable block (bigger with the Horse Stable you bought
 * in the shop, `stableLevel`), a post-and-rail paddock, hay and a water
 * trough, and your horse (career.horse) — or the faded outline of one when
 * you have none.
 */
import { W, type SkyLook } from "./sky";

/** Horse colour gradients and the one soft shadow the horse uses. */
export function HorseDefs() {
  return (
    <defs>
      <linearGradient id="horseBodyGrad" x1="0" y1="0" x2="0.15" y2="1">
        <stop offset="0%" stopColor="#b5703f" />
        <stop offset="50%" stopColor="#8a4a2c" />
        <stop offset="100%" stopColor="#5c2f16" />
      </linearGradient>
    </defs>
  );
}

/** The stable block. `level` 0 = a plain field shelter (no stable bought). */
export function StableBlock({ level, y }: { level: number; y: number }) {
  const stalls = level <= 0 ? 0 : level === 1 ? 1 : level === 2 ? 2 : level <= 4 ? 3 : 4;
  const brick = level >= 3;
  const w = level <= 0 ? 150 : 110 + stalls * 62;
  const wallH = level >= 3 ? 104 : 90;
  const wall = brick ? "#a24a37" : "#8e3b31";
  const roof = "#3b3f48";
  const x0 = W / 2 - w / 2;
  if (level <= 0) {
    // a three-sided timber field shelter
    return (
      <g transform={`translate(${W / 2 - 30} ${y}) scale(1.25)`}>
        <ellipse cx="0" cy="4" rx="96" ry="8" fill="rgba(0,0,0,0.2)" />
        <rect x="-75" y="-78" width="150" height="78" fill="#6f4b2c" />
        {Array.from({ length: 11 }).map((_, i) => <line key={i} x1={-75 + i * 15} x2={-75 + i * 15} y1="-78" y2="0" stroke="rgba(0,0,0,0.18)" />)}
        <rect x="-62" y="-66" width="124" height="66" fill="#2a1d14" />
        <path d="M -42,0 C -42,-14 -30,-18 -20,-12 C -14,-20 -2,-18 0,0 Z" fill="#d9b25a" />
        <polygon points="-86,-78 86,-78 76,-100 -76,-100" fill={roof} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={W / 2} cy={y + 5} rx={w * 0.6} ry="9" fill="rgba(0,0,0,0.22)" />
      {level >= 5 && (
        <g>
          <rect x={x0 - 30} y={y - wallH + 26} width="34" height={wallH - 26} fill="#8f3e2f" />
          <rect x={x0 + w - 4} y={y - wallH + 26} width="34" height={wallH - 26} fill="#8f3e2f" />
          <polygon points={`${x0 - 36},${y - wallH + 26} ${x0 + 6},${y - wallH + 26} ${x0 + 6},${y - wallH + 6}`} fill={roof} />
          <polygon points={`${x0 + w - 6},${y - wallH + 26} ${x0 + w + 36},${y - wallH + 26} ${x0 + w - 6},${y - wallH + 6}`} fill={roof} />
        </g>
      )}
      <rect x={x0} y={y - wallH} width={w} height={wallH} fill={wall} />
      {brick
        ? Array.from({ length: Math.floor(wallH / 6) }).map((_, i) => (
          <line key={i} x1={x0} x2={x0 + w} y1={y - wallH + i * 6} y2={y - wallH + i * 6} stroke="rgba(0,0,0,0.10)" strokeWidth="0.7" />
        ))
        : Array.from({ length: Math.floor(w / 9) }).map((_, i) => (
          <line key={i} x1={x0 + i * 9} x2={x0 + i * 9} y1={y - wallH} y2={y} stroke="rgba(0,0,0,0.16)" strokeWidth="0.8" />
        ))}
      <rect x={x0 + w - w * 0.16} y={y - wallH} width={w * 0.16} height={wallH} fill="rgba(0,0,0,0.10)" />
      {/* roof */}
      <polygon points={`${x0 - 10},${y - wallH} ${x0 + w + 10},${y - wallH} ${x0 + w - 18},${y - wallH - 34} ${x0 + 18},${y - wallH - 34}`} fill={roof} />
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1={x0 - 4 + i * 4.5} x2={x0 + w + 4 - i * 4.5} y1={y - wallH - 4 - i * 6.5} y2={y - wallH - 4 - i * 6.5} stroke="rgba(255,255,255,0.08)" />
      ))}
      <rect x={x0 - 10} y={y - wallH - 2} width={w + 20} height="4" fill="#f2efe6" />
      {/* the cupola and weathervane on the bigger yards */}
      {level >= 3 && (
        <g transform={`translate(${W / 2} ${y - wallH - 34})`}>
          <rect x="-13" y="-24" width="26" height="24" fill="#f2efe6" />
          <rect x="-8" y="-20" width="16" height="14" fill="#2b3a3f" />
          <line x1="0" y1="-20" x2="0" y2="-6" stroke="#f2efe6" strokeWidth="1.2" />
          <polygon points="-18,-24 18,-24 0,-44" fill="#4f7d72" />
          <line x1="0" y1="-44" x2="0" y2="-58" stroke="#222" strokeWidth="1.4" />
          <path d="M -9,-54 L 6,-54 L 9,-57 L 9,-51 Z" fill="#222" />
        </g>
      )}
      {/* stalls: split doors, top half open */}
      {Array.from({ length: stalls }).map((_, i) => {
        const cx = x0 + w / 2 + (i - (stalls - 1) / 2) * 62;
        return (
          <g key={i} transform={`translate(${cx} ${y})`}>
            <rect x="-22" y="-74" width="44" height="74" fill="#f2efe6" />
            <rect x="-19" y="-71" width="38" height="32" fill="#1b130d" />
            <rect x="-19" y="-36" width="38" height="36" fill={brick ? "#2f5b4f" : "#5f3a22"} />
            <path d="M -19,-36 L 19,0 M 19,-36 L -19,0" stroke="#f2efe6" strokeWidth="2" />
            <rect x="-19" y="-38" width="38" height="3" fill="#f2efe6" />
            <circle cx="0" cy="-82" r="4" fill="#2b2b2b" />
            <path d="M -4,-82 L 4,-82 L 3,-78 L -3,-78 Z" fill="#f3e2b0" />
          </g>
        );
      })}
      {/* a hay loft door over the middle */}
      {stalls % 2 === 0 && (
        <g transform={`translate(${W / 2} ${y - wallH + 4})`}>
          <rect x="-12" y="0" width="24" height="16" fill="#f2efe6" />
          <rect x="-9.5" y="2.5" width="19" height="12" fill="#1b130d" />
          <path d="M -9,14 C -6,8 -1,9 0,12 C 3,8 8,9 9,14 Z" fill="#d9b25a" />
        </g>
      )}
    </g>
  );
}

/** Where each stall lamp is, for the night glow. */
export function stallLamps(level: number, y: number): { x: number; y: number }[] {
  const stalls = level <= 0 ? 0 : level === 1 ? 1 : level === 2 ? 2 : level <= 4 ? 3 : 4;
  const w = 110 + stalls * 62;
  const x0 = W / 2 - w / 2;
  return Array.from({ length: stalls }, (_, i) => ({ x: x0 + w / 2 + (i - (stalls - 1) / 2) * 62, y: y - 80 }));
}

/** A post-and-rail paddock fence across the yard (white on the bigger yards). */
export function PaddockFence({ y, level }: { y: number; level: number }) {
  const c = level >= 3 ? "#f3f1ea" : "#8a6240";
  const d = level >= 3 ? "#cfcabd" : "#664629";
  const posts = Array.from({ length: 10 }, (_, i) => i * 44 - 6);
  return (
    <g>
      {posts.map((x) => <ellipse key={`s${x}`} cx={x + 6} cy={y + 1} rx="7" ry="2" fill="rgba(0,0,0,0.2)" />)}
      {[y - 34, y - 18].map((ry) => (
        <g key={ry}>
          <rect x="0" y={ry} width={W} height="6" fill={c} />
          <rect x="0" y={ry + 4} width={W} height="2" fill={d} />
        </g>
      ))}
      {posts.map((x) => (
        <g key={x}>
          <rect x={x} y={y - 44} width="8" height="44" fill={c} />
          <rect x={x + 5} y={y - 44} width="3" height="44" fill={d} />
        </g>
      ))}
    </g>
  );
}

export function HayBale({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="4" cy="1" rx="30" ry="5" fill="rgba(0,0,0,0.22)" />
      <rect x="-24" y="-34" width="44" height="34" rx="4" fill="#d9b25a" />
      <ellipse cx="20" cy="-17" rx="9" ry="17" fill="#e8c878" />
      <ellipse cx="20" cy="-17" rx="5" ry="10" fill="none" stroke="#c49a44" strokeWidth="1.2" />
      {[-30, -22, -14, -6].map((ly) => <line key={ly} x1="-22" x2="12" y1={ly} y2={ly} stroke="#c49a44" strokeWidth="1" />)}
    </g>
  );
}

export function Trough({ x, y, look }: { x: number; y: number; look: SkyLook }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="2" rx="40" ry="5" fill="rgba(0,0,0,0.22)" />
      <path d="M -34,-22 L 34,-22 L 30,0 L -30,0 Z" fill="#8e969c" />
      <rect x="-36" y="-25" width="72" height="5" rx="2" fill="#b4bcc2" />
      <rect x="-31" y="-21" width="62" height="3" fill={look.moon ? "#3a6aa8" : "#5fb6e2"} />
      {[-22, 0, 22].map((rx) => <line key={rx} x1={rx} y1="-20" x2={rx * 0.9} y2="0" stroke="rgba(0,0,0,0.14)" />)}
    </g>
  );
}

/**
 * A bay horse in profile — the drawing the garden has carried since its
 * first rebuild (one continuous body: barrel, rump and chest; legs under
 * the chest and the rump; one arched neck), now with hooves, a blaze and a
 * real frame to stand in. `faded` = outline only, for no horse yet.
 */
export function Horse({ faded = false }: { faded?: boolean }) {
  const black = "#1c1712";
  const fill = faded ? "none" : "url(#horseBodyGrad)";
  const fillBlack = faded ? "none" : black;
  const stroke = faded ? "rgba(255,255,255,0.5)" : "none";
  const strokeBlack = faded ? "rgba(255,255,255,0.4)" : "none";
  const sw = faded ? 1.6 : 0;
  return (
    <g>
      {!faded && <ellipse cx="2" cy="2" rx="46" ry="5" fill="rgba(0,0,0,0.25)" />}
      <g className={faded ? undefined : "gdn-hleg-b"}>
        <g fill={fill} stroke={stroke} strokeWidth={sw}>
          <path d="M 12,-30 L 21,-30 L 20,-12 L 18,-2 L 13,-2 L 13,-14 Z" />
          <path d="M 25,-30 L 34,-30 L 33,-12 L 31,-2 L 26,-2 L 26,-14 Z" />
        </g>
        <g fill={fillBlack} stroke={strokeBlack} strokeWidth={sw}>
          <rect x="12.6" y="-3" width="6.4" height="4" rx="1" />
          <rect x="25.6" y="-3" width="6.4" height="4" rx="1" />
        </g>
      </g>
      <path d="M 33,-42 C 47,-34 49,-10 39,12 C 43,-10 39,-30 27,-38 Z" fill={fillBlack} stroke={strokeBlack} strokeWidth={sw} className={faded ? undefined : "gdn-tail"} />
      <ellipse cx="0" cy="-32" rx="30" ry="14" fill={fill} stroke={stroke} strokeWidth={sw} />
      <ellipse cx="20" cy="-35" rx="16" ry="15" fill={fill} stroke={stroke} strokeWidth={sw} />
      <ellipse cx="-22" cy="-33" rx="12" ry="13" fill={fill} stroke={stroke} strokeWidth={sw} />
      {!faded && <ellipse cx="-4" cy="-41" rx="22" ry="5" fill="rgba(255,255,255,0.14)" />}
      {!faded && <ellipse cx="22" cy="-30" rx="10" ry="9" fill="rgba(0,0,0,0.12)" />}
      {!faded && <ellipse cx="6" cy="-22" rx="20" ry="5" fill="rgba(0,0,0,0.12)" />}
      <g className={faded ? undefined : "gdn-hleg-f"}>
        <g fill={fill} stroke={stroke} strokeWidth={sw}>
          <path d="M -33,-28 L -24,-28 L -25,-12 L -26,-2 L -31,-2 L -31,-14 Z" />
          <path d="M -21,-28 L -12,-28 L -13,-12 L -14,-2 L -19,-2 L -19,-14 Z" />
        </g>
        <g fill={fillBlack} stroke={strokeBlack} strokeWidth={sw}>
          <rect x="-31.4" y="-3" width="6.4" height="4" rx="1" />
          <rect x="-19.4" y="-3" width="6.4" height="4" rx="1" />
        </g>
        {!faded && <rect x="-19" y="-9" width="5.4" height="5" fill="#f1ece2" />}
      </g>
      <g className={faded ? undefined : "horse-head"}>
        <path d="M -16,-42 C -27,-49 -37,-60 -42,-75 C -37,-66 -28,-57 -18,-51 C -14,-55 -9,-58 -3,-58 C -10,-53 -14,-47 -16,-42 Z" fill={fillBlack} stroke={strokeBlack} strokeWidth={sw} />
        <path d="M -6,-40 C -18,-49 -30,-61 -37,-76 C -34,-80 -30,-82 -25,-83 C -20,-68 -10,-55 5,-46 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d="M -37,-76 C -42,-83 -43,-91 -37,-96 C -30,-100 -20,-98 -14,-91 C -10,-87 -11,-82 -18,-78 L -26,-75 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d="M -32,-95 L -29,-105 L -23,-93 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
        {!faded && (
          <>
            <path d="M -31,-97 C -26,-96 -20,-92 -15,-86 C -17,-85 -19,-86 -21,-88 C -24,-91 -28,-94 -31,-97 Z" fill="#f1ece2" />
            <ellipse cx="-24" cy="-88" rx="2.6" ry="2.9" fill="#241408" />
            <circle cx="-23.2" cy="-89.1" r="1" fill="#fff" opacity="0.9" />
            <circle cx="-15" cy="-84" r="1.1" fill="#3a2314" />
            <path d="M -27,-83 C -22,-80 -18,-80 -16,-82" stroke="#3a2314" strokeWidth="1.2" fill="none" />
          </>
        )}
      </g>
    </g>
  );
}

export const STABLE_CSS = `
.horse-roam { animation: gdnHorseRoam 26s ease-in-out infinite; }
@keyframes gdnHorseRoam {
  0%, 100% { transform: translateX(-34px) scaleX(-1); }
  8% { transform: translateX(-34px) scaleX(1); }
  44% { transform: translateX(34px) scaleX(1); }
  52% { transform: translateX(34px) scaleX(-1); }
  92% { transform: translateX(-34px) scaleX(-1); }
}
.horse-head { transform-origin: -8px -46px; animation: gdnGraze 13s ease-in-out infinite; animation-delay: 3s; }
@keyframes gdnGraze { 0%, 70%, 100% { transform: rotate(0deg); } 78%, 92% { transform: rotate(46deg) translate(6px, 14px); } }
.gdn-hleg-f, .gdn-hleg-b { animation: gdnHorseStep 1.1s ease-in-out infinite; }
.gdn-hleg-b { animation-delay: -0.55s; }
@keyframes gdnHorseStep { 0%,100% { transform: translateX(-1.6px); } 50% { transform: translateX(1.6px); } }
.gdn-tail { transform-origin: 33px -40px; animation: gdnTail 3s ease-in-out infinite; }
@keyframes gdnTail { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(8deg); } }
`;
