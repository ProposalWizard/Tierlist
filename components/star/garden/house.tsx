"use client";
/**
 * Your house, seen from the bottom of the garden — it grows with the best
 * home you own (lib/star/gardenLevel.ts): a terrace, a semi, a detached
 * house, a mansion, a manor with columns. Drawn in local space with the
 * middle of its ground line at (0, 0); the caller places it.
 *
 * `layer="glow"` draws only the lit windows, for after the night/sunset tint.
 */
import type { GardenTier } from "@/lib/star/gardenLevel";

interface Win { x: number; y: number; w: number; h: number; door?: boolean }

interface Spec {
  w: number; h: number;
  wall: string; wallDark: string;
  roof: string;
  roofH: number;
  roofType: "flat" | "gable" | "hip" | "mansard";
  windows: Win[];
  chimneys: number[];
  /** Neighbouring houses either side (a terrace / a semi). */
  neighbours: "both" | "left" | "none";
  portico?: boolean;
  dormers?: number[];
  wings?: boolean;
}

function row(y: number, h: number, xs: number[], w: number): Win[] {
  return xs.map((x) => ({ x: x - w / 2, y, w, h }));
}

const SPECS: Record<GardenTier, Spec> = {
  0: {
    w: 150, h: 118, wall: "#9a4b36", wallDark: "#7d3b2a", roof: "#3d3f47", roofH: 16, roofType: "flat",
    windows: [...row(-104, 30, [-36, 36], 30), { x: -52, y: -50, w: 20, h: 50, door: true }, { x: 8, y: -46, w: 46, h: 26 }],
    chimneys: [50], neighbours: "both",
  },
  1: {
    w: 168, h: 116, wall: "#a8563e", wallDark: "#874230", roof: "#5b3a32", roofH: 48, roofType: "gable",
    windows: [...row(-102, 30, [-42, 42], 32), { x: -62, y: -54, w: 46, h: 54, door: true }, { x: 14, y: -48, w: 46, h: 30 }],
    chimneys: [-48], neighbours: "left",
  },
  2: {
    w: 222, h: 120, wall: "#eee2c6", wallDark: "#d3c3a2", roof: "#454b55", roofH: 40, roofType: "hip",
    windows: [...row(-104, 32, [-70, 0, 70], 34), { x: -96, y: -56, w: 84, h: 56, door: true }, { x: 22, y: -50, w: 64, h: 34 }],
    chimneys: [-70, 72], neighbours: "none",
  },
  3: {
    w: 300, h: 150, wall: "#e4d8bd", wallDark: "#c7b892", roof: "#3c4250", roofH: 44, roofType: "mansard",
    windows: [
      ...row(-138, 30, [-118, -70, 70, 118], 26), ...row(-90, 34, [-118, -70, 70, 118], 26),
      ...row(-138, 30, [0], 30), { x: -22, y: -64, w: 44, h: 64, door: true }, ...row(-48, 34, [-118, -70, 70, 118], 26),
    ],
    chimneys: [-110, 112], neighbours: "none", dormers: [-80, 0, 80],
  },
  4: {
    w: 360, h: 156, wall: "#efe6d0", wallDark: "#d4c6a4", roof: "#38404e", roofH: 30, roofType: "hip",
    windows: [
      ...row(-146, 32, [-150, -112, -74, 74, 112, 150], 22), ...row(-98, 36, [-150, -112, -74, 74, 112, 150], 22),
      ...row(-50, 36, [-150, -112, -74, 74, 112, 150], 22), ...row(-146, 32, [-26, 26], 22), ...row(-98, 36, [-26, 26], 22),
      { x: -18, y: -64, w: 36, h: 64, door: true },
    ],
    chimneys: [-130, 132], neighbours: "none", portico: true, wings: true,
  },
};

function Roof({ s }: { s: Spec }) {
  const hw = s.w / 2 + 6, top = -s.h;
  if (s.roofType === "flat") {
    return <rect x={-hw} y={top - s.roofH} width={hw * 2} height={s.roofH} fill={s.roof} />;
  }
  if (s.roofType === "gable") {
    return (
      <g>
        <polygon points={`${-hw},${top} ${hw},${top} 0,${top - s.roofH}`} fill={s.roof} />
        <polygon points={`${-hw + 10},${top} ${hw - 10},${top} 0,${top - s.roofH + 8}`} fill={s.wall} />
        <circle cx="0" cy={top - s.roofH * 0.42} r="7" fill="#e9e3d2" stroke="#fff" strokeWidth="1.5" />
        <line x1="0" y1={top - s.roofH * 0.42 - 7} x2="0" y2={top - s.roofH * 0.42 + 7} stroke="#fff" strokeWidth="1.2" />
        <line x1="-7" y1={top - s.roofH * 0.42} x2="7" y2={top - s.roofH * 0.42} stroke="#fff" strokeWidth="1.2" />
      </g>
    );
  }
  const inset = s.roofType === "mansard" ? 26 : s.w * 0.22;
  return (
    <g>
      <polygon points={`${-hw},${top} ${hw},${top} ${hw - inset},${top - s.roofH} ${-hw + inset},${top - s.roofH}`} fill={s.roof} />
      <polygon points={`${-hw},${top} ${-hw + inset},${top - s.roofH} ${-hw + inset + 6},${top - s.roofH} ${-hw + 8},${top}`} fill="rgba(255,255,255,0.08)" />
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1={-hw + 8} x2={hw - 8} y1={top - 6 - i * (s.roofH / 6.5)} y2={top - 6 - i * (s.roofH / 6.5)} stroke="rgba(0,0,0,0.16)" strokeWidth="0.8" />
      ))}
    </g>
  );
}

function Window({ w, s, lit }: { w: Win; s: Spec; lit: boolean }) {
  const glass = lit ? "#ffd98a" : "#7fa6c4";
  if (w.door) {
    return (
      <g>
        <rect x={w.x - 3} y={w.y - 3} width={w.w + 6} height={w.h + 3} fill="#f3efe6" />
        <rect x={w.x} y={w.y} width={w.w} height={w.h} fill={lit ? "#ffcf78" : "#5f7f98"} />
        {!lit && <polygon points={`${w.x},${w.y + w.h * 0.6} ${w.x + w.w * 0.5},${w.y} ${w.x + w.w * 0.75},${w.y} ${w.x},${w.y + w.h}`} fill="rgba(255,255,255,0.16)" />}
        {w.w > 30 && <line x1={w.x + w.w / 2} y1={w.y} x2={w.x + w.w / 2} y2={w.y + w.h} stroke="#f3efe6" strokeWidth="2" />}
        {w.w <= 30 && <rect x={w.x + 3} y={w.y + 4} width={w.w - 6} height={w.h * 0.4} fill="none" stroke="#f3efe6" strokeWidth="1.2" />}
        <rect x={w.x - 6} y={-3} width={w.w + 12} height="3" fill={s.wallDark} />
      </g>
    );
  }
  return (
    <g>
      <rect x={w.x - 2} y={w.y - 2} width={w.w + 4} height={w.h + 4} fill="#f6f2ea" />
      <rect x={w.x} y={w.y} width={w.w} height={w.h} fill={glass} />
      {!lit && <polygon points={`${w.x},${w.y + w.h * 0.7} ${w.x + w.w * 0.55},${w.y} ${w.x + w.w * 0.8},${w.y} ${w.x},${w.y + w.h}`} fill="rgba(255,255,255,0.2)" />}
      <line x1={w.x + w.w / 2} y1={w.y} x2={w.x + w.w / 2} y2={w.y + w.h} stroke="#f6f2ea" strokeWidth="1.4" />
      <line x1={w.x} y1={w.y + w.h / 2} x2={w.x + w.w} y2={w.y + w.h / 2} stroke="#f6f2ea" strokeWidth="1.4" />
      <rect x={w.x - 4} y={w.y + w.h + 1} width={w.w + 8} height="3" fill={s.wallDark} />
    </g>
  );
}

/** Which windows are lit at night — seeded, so the same ones every visit. */
function litAt(i: number): boolean {
  return ((i * 7 + 3) % 5) !== 0;
}

export function House({ tier, layer }: { tier: GardenTier; layer: "base" | "glow" }) {
  const s = SPECS[tier];
  const hw = s.w / 2;
  if (layer === "glow") {
    return (
      <g>
        {s.windows.map((w, i) => litAt(i) && <Window key={i} w={w} s={s} lit />)}
      </g>
    );
  }
  return (
    <g>
      {/* neighbours either side: a terrace carries on, a semi has a twin */}
      {(s.neighbours === "both" || s.neighbours === "left") && (
        <g>
          <rect x={-hw - 150} y={-s.h + 6} width="150" height={s.h - 6} fill="#8a4434" />
          <rect x={-hw - 150} y={-s.h + 6 - (s.roofType === "flat" ? 14 : 0)} width="150" height={s.roofType === "flat" ? 14 : 0} fill="#34363d" />
          {s.roofType === "gable" && <polygon points={`${-hw - 150},${-s.h + 6} ${-hw},${-s.h + 6} ${-hw},${-s.h - s.roofH + 10}`} fill="#4e322b" />}
          <rect x={-hw - 110} y={-s.h + 26} width="28" height="28" fill="#6a8aa3" stroke="#e9e4d9" strokeWidth="2" />
          <rect x={-hw - 50} y={-s.h + 26} width="28" height="28" fill="#6a8aa3" stroke="#e9e4d9" strokeWidth="2" />
        </g>
      )}
      {s.neighbours === "both" && (
        <g>
          <rect x={hw} y={-s.h + 4} width="150" height={s.h - 4} fill="#a1543e" />
          <rect x={hw} y={-s.h - 10} width="150" height="14" fill="#34363d" />
          <rect x={hw + 24} y={-s.h + 22} width="28" height="28" fill="#6a8aa3" stroke="#e9e4d9" strokeWidth="2" />
          <rect x={hw + 90} y={-s.h + 22} width="28" height="28" fill="#6a8aa3" stroke="#e9e4d9" strokeWidth="2" />
        </g>
      )}
      {s.wings && (
        <g>
          <rect x={-hw - 40} y={-s.h + 40} width="44" height={s.h - 40} fill={s.wallDark} />
          <rect x={hw - 4} y={-s.h + 40} width="44" height={s.h - 40} fill={s.wallDark} />
          <polygon points={`${-hw - 46},${-s.h + 40} ${-hw + 8},${-s.h + 40} ${-hw - 6},${-s.h + 22} ${-hw - 34},${-s.h + 22}`} fill={s.roof} />
          <polygon points={`${hw - 8},${-s.h + 40} ${hw + 46},${-s.h + 40} ${hw + 34},${-s.h + 22} ${hw + 6},${-s.h + 22}`} fill={s.roof} />
          {[-hw - 30, -hw - 6, hw + 6, hw + 30].map((x) => (
            <rect key={x} x={x - 6} y={-s.h + 60} width="12" height="22" fill="#7fa6c4" stroke="#f6f2ea" strokeWidth="1.5" />
          ))}
        </g>
      )}
      {s.chimneys.map((x) => (
        <g key={x}>
          <rect x={x - 7} y={-s.h - s.roofH - 14} width="14" height={s.roofH + 10} fill={s.wallDark} />
          <rect x={x - 9} y={-s.h - s.roofH - 18} width="18" height="5" fill="#5d5550" />
        </g>
      ))}
      <Roof s={s} />
      {s.dormers?.map((x) => (
        <g key={x}>
          <rect x={x - 11} y={-s.h - s.roofH + 6} width="22" height="26" fill={s.wall} />
          <polygon points={`${x - 14},${-s.h - s.roofH + 7} ${x + 14},${-s.h - s.roofH + 7} ${x},${-s.h - s.roofH - 7}`} fill={s.roof} />
          <rect x={x - 6} y={-s.h - s.roofH + 11} width="12" height="16" fill="#7fa6c4" stroke="#f6f2ea" strokeWidth="1.5" />
        </g>
      ))}
      {/* the wall, lit from the left */}
      <rect x={-hw} y={-s.h} width={s.w} height={s.h} fill={s.wall} />
      <rect x={hw - s.w * 0.18} y={-s.h} width={s.w * 0.18} height={s.h} fill="rgba(0,0,0,0.07)" />
      {tier <= 1 && Array.from({ length: Math.floor(s.h / 7) }).map((_, i) => (
        <line key={i} x1={-hw} x2={hw} y1={-s.h + 7 * i} y2={-s.h + 7 * i} stroke="rgba(0,0,0,0.07)" strokeWidth="0.7" />
      ))}
      {tier >= 3 && (
        <g>
          <rect x={-hw} y={-s.h} width={s.w} height="6" fill="#fbf6ea" />
          <rect x={-hw} y={-s.h / 2 - 22} width={s.w} height="4" fill="#fbf6ea" />
          <rect x={-hw - 4} y="-8" width={s.w + 8} height="8" fill={s.wallDark} />
        </g>
      )}
      {s.windows.map((w, i) => <Window key={i} w={w} s={s} lit={false} />)}
      {/* a drainpipe and a light by the back door */}
      {tier <= 2 && <rect x={hw - 8} y={-s.h + 2} width="3" height={s.h - 2} fill="#2c2c30" />}
      {s.portico && (
        <g>
          <polygon points="-58,-112 58,-112 0,-142" fill="#f7f1e2" stroke="#d4c6a4" strokeWidth="1.5" />
          <rect x="-62" y="-114" width="124" height="8" fill="#f7f1e2" />
          {[-48, -20, 20, 48].map((x) => (
            <g key={x}>
              <rect x={x - 5} y="-106" width="10" height="100" fill="#fbf8ef" />
              <rect x={x - 1} y="-106" width="3" height="100" fill="rgba(0,0,0,0.08)" />
              <rect x={x - 7} y="-8" width="14" height="6" fill="#e7dfc9" />
            </g>
          ))}
          <rect x="-66" y="-4" width="132" height="5" fill="#ddd3bb" />
          {/* balustrade and a small clock tower on the roof */}
          <rect x={-hw + 10} y={-s.h - s.roofH - 8} width={s.w - 20} height="8" fill="#efe8d6" />
          {Array.from({ length: 22 }).map((_, i) => (
            <rect key={i} x={-hw + 14 + i * ((s.w - 28) / 21)} y={-s.h - s.roofH - 18} width="3" height="10" fill="#efe8d6" />
          ))}
          <rect x="-18" y={-s.h - s.roofH - 52} width="36" height="40" fill="#f2ead6" />
          <path d={`M -22,${-s.h - s.roofH - 52} Q 0,${-s.h - s.roofH - 86} 22,${-s.h - s.roofH - 52} Z`} fill="#4f7d72" />
          <circle cx="0" cy={-s.h - s.roofH - 34} r="10" fill="#fffaf0" stroke="#b79a5a" strokeWidth="2" />
          <line x1="0" y1={-s.h - s.roofH - 34} x2="0" y2={-s.h - s.roofH - 41} stroke="#333" strokeWidth="1.4" />
          <line x1="0" y1={-s.h - s.roofH - 34} x2="5" y2={-s.h - s.roofH - 34} stroke="#333" strokeWidth="1.4" />
        </g>
      )}
    </g>
  );
}

/** Where the lit windows' glow sits, for the night layer. */
export function houseLights(tier: GardenTier): { x: number; y: number; r: number }[] {
  const s = SPECS[tier];
  return s.windows.filter((_, i) => litAt(i)).map((w) => ({ x: w.x + w.w / 2, y: w.y + w.h / 2, r: Math.max(w.w, w.h) * 1.1 }));
}

export function houseWidth(tier: GardenTier): number {
  const s = SPECS[tier];
  return s.w + (s.wings ? 90 : 0);
}
