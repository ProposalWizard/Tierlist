"use client";

/**
 * THE MATCH RADAR — the picture.
 *
 * Draws what the unseen match knows and nothing it doesn't: which fifth of
 * the pitch the ball is in, which channel, who has it, the momentum, the
 * score and the clock. There are no twenty-two players here because the
 * unseen match has none — the dot moving between areas IS the simulation.
 * Where it sits inside an area is decoration (a small, seeded wobble so it
 * doesn't sit dead-centre every minute); the area itself is real.
 *
 * SVG, not a canvas: this is a chart of the match, updated once a simulated
 * minute, never a screen that runs its own ball physics (see the one-engine
 * guard's rule on canvas animation loops).
 */
import type { RadarFrame, RadarHighlight, RadarMatch, RadarSummary, RadarEvent } from "@/lib/star/matchRadar";
import type { Zone, Lane } from "@/lib/star/hiddenMatch";
import { withoutSwitchedOff } from "@/lib/star/switchedOffKinds";
import type { ScenarioKind } from "@/lib/star/canvasEngine";

export interface RadarSide { name: string; short: string; colour: string; ink: string; strength: number }

// Pitch geometry, in real metres, drawn left (your goal) to right (theirs).
const PITCH_L = 105, PITCH_W = 68;
const VB_W = 360, VB_H = 234, PAD = 6;
const sx = (m: number) => PAD + (m / PITCH_L) * (VB_W - PAD * 2);
const sy = (m: number) => PAD + (m / PITCH_W) * (VB_H - PAD * 2);

/** Where each of the unseen match's five areas actually is, in metres. */
const ZONE_X: Record<Zone, [number, number]> = {
  own_box: [0, 16.5], defensive: [16.5, 35], middle: [35, 70], attacking: [70, 88.5], box: [88.5, 105],
};
const LANE_Y: Record<Lane, [number, number]> = { left: [0, 21], centre: [21, 47], right: [47, 68] };
const ZONE_NAME: Record<Zone, string> = {
  own_box: "your box", defensive: "your third", middle: "midfield", attacking: "their third", box: "their box",
};
const LANE_NAME: Record<Lane, string> = { left: "left channel", centre: "down the middle", right: "right channel" };

const KIND_NAME: Record<string, string> = {
  one_on_one: "one-on-one", through_ball: "through ball", cutback: "cutback", byline_cross: "byline cross",
  tight_angle: "tight angle", long_range: "long shot", midfield_pass: "midfield pass", buildup: "build-up pass",
  penalty: "penalty", free_kick: "free kick", corner: "corner", volley: "volley", header: "header",
};

/** Seeded wobble inside an area, so the dot isn't pinned to one spot. */
function jitter(minute: number, salt: number): number {
  let h = (minute * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return (h % 1000) / 1000 - 0.5;
}
export function ballAt(f: Pick<RadarFrame, "zone" | "lane" | "minute">): { x: number; y: number } {
  const [x0, x1] = ZONE_X[f.zone], [y0, y1] = LANE_Y[f.lane];
  const x = (x0 + x1) / 2 + jitter(f.minute, 1) * (x1 - x0) * 0.55;
  const y = (y0 + y1) / 2 + jitter(f.minute, 2) * (y1 - y0) * 0.55;
  return { x: sx(x), y: sy(y) };
}

export function describeArea(zone: Zone, lane: Lane): string {
  return `${ZONE_NAME[zone]}, ${LANE_NAME[lane]}`;
}
export function handedKinds(h: RadarHighlight): string {
  if (h.dribble) return "a run at the defence";
  return withoutSwitchedOff(h.kinds as ScenarioKind[]).map((k) => KIND_NAME[k] ?? k).join(" · ");
}

export function RadarPitch({ frames, us, them, pending, flashMinute, stepMs }: {
  frames: RadarFrame[]; us: RadarSide; them: RadarSide; pending: RadarHighlight | null;
  /** The minute of the most recent highlight, for a brief gold pulse. */
  flashMinute: number | null; stepMs: number;
}) {
  const f = frames[frames.length - 1];
  const at = ballAt(f);
  const col = f.possession === "user" ? us.colour : them.colour;
  const trail = frames.slice(-7, -1).map(ballAt);
  const [zx0, zx1] = ZONE_X[f.zone], [ly0, ly1] = LANE_Y[f.lane];
  const glow = pending || flashMinute === f.minute;
  const stripe = (i: number) => (i % 2 === 0 ? "#1f7a3c" : "#1b6f36");

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block", borderRadius: 14 }} aria-label="Match radar">
      <defs>
        <radialGradient id="rdr-glow">
          <stop offset="0%" stopColor={glow ? "#fde047" : col} stopOpacity={glow ? 0.55 : 0.35} />
          <stop offset="100%" stopColor={glow ? "#fde047" : col} stopOpacity={0} />
        </radialGradient>
        <filter id="rdr-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="#155e2f" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={PAD + (i * (VB_W - PAD * 2)) / 12} y={PAD} width={(VB_W - PAD * 2) / 12} height={VB_H - PAD * 2} fill={stripe(i)} />
      ))}
      {/* The area the ball is in, lit in the colour of whoever has it. */}
      <rect x={sx(zx0)} y={sy(ly0)} width={sx(zx1) - sx(zx0)} height={sy(ly1) - sy(ly0)}
        fill={glow ? "#fde047" : col} opacity={glow ? 0.22 : 0.16}
        style={{ transition: `all ${Math.round(stepMs * 0.8)}ms ease-out` }} />
      <Markings />
      {/* Where each fifth of the pitch ends — the unseen match's own areas. */}
      {([16.5, 35, 70, 88.5] as const).map((m) => (
        <line key={m} x1={sx(m)} x2={sx(m)} y1={PAD} y2={VB_H - PAD} stroke="#ffffff" strokeOpacity={0.09} strokeDasharray="3 4" />
      ))}
      {([21, 47] as const).map((m) => (
        <line key={m} x1={PAD} x2={VB_W - PAD} y1={sy(m)} y2={sy(m)} stroke="#ffffff" strokeOpacity={0.07} strokeDasharray="3 4" />
      ))}
      <text x={PAD + 5} y={VB_H - PAD - 5} fill="#ffffff" fillOpacity={0.55} fontSize={8.5} fontWeight={800}>{us.short.toUpperCase()} ←</text>
      <text x={VB_W - PAD - 5} y={VB_H - PAD - 5} fill="#ffffff" fillOpacity={0.55} fontSize={8.5} fontWeight={800} textAnchor="end">→ {them.short.toUpperCase()}</text>
      {trail.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.2 + i * 0.35} fill={col} opacity={0.12 + i * 0.07} />
      ))}
      <circle cx={at.x} cy={at.y} r={glow ? 30 : 22} fill="url(#rdr-glow)"
        style={{ transition: `cx ${Math.round(stepMs * 0.85)}ms ease-in-out, cy ${Math.round(stepMs * 0.85)}ms ease-in-out` }} />
      <g filter="url(#rdr-shadow)" style={{ transform: `translate(${at.x}px, ${at.y}px)`, transition: `transform ${Math.round(stepMs * 0.85)}ms ease-in-out` }}>
        <circle r={7.5} fill={col} />
        <circle r={4.6} fill="#ffffff" />
        {/* Which way the side on the ball is going. */}
        <path d={f.possession === "user" ? "M 9 -3.5 L 13.5 0 L 9 3.5" : "M -9 -3.5 L -13.5 0 L -9 3.5"}
          fill="none" stroke="#ffffff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {glow && (
        <text x={at.x} y={at.y - 13} textAnchor="middle" fontSize={13} style={{ transition: "all 200ms" }}>⭐</text>
      )}
    </svg>
  );
}

function Markings() {
  const L = "#ffffff", o = 0.55, w = 1.1;
  const box = (x0: number, x1: number, y0: number, y1: number) => (
    <rect x={sx(Math.min(x0, x1))} y={sy(y0)} width={Math.abs(sx(x1) - sx(x0))} height={sy(y1) - sy(y0)} fill="none" stroke={L} strokeOpacity={o} strokeWidth={w} />
  );
  return (
    <g>
      <rect x={sx(0)} y={sy(0)} width={sx(PITCH_L) - sx(0)} height={sy(PITCH_W) - sy(0)} fill="none" stroke={L} strokeOpacity={o} strokeWidth={w * 1.2} />
      <line x1={sx(52.5)} x2={sx(52.5)} y1={sy(0)} y2={sy(PITCH_W)} stroke={L} strokeOpacity={o} strokeWidth={w} />
      <circle cx={sx(52.5)} cy={sy(34)} r={sx(9.15) - sx(0)} fill="none" stroke={L} strokeOpacity={o} strokeWidth={w} />
      <circle cx={sx(52.5)} cy={sy(34)} r={1.6} fill={L} fillOpacity={o} />
      {box(0, 16.5, 13.85, 54.15)}{box(105, 88.5, 13.85, 54.15)}
      {box(0, 5.5, 24.85, 43.15)}{box(105, 99.5, 24.85, 43.15)}
      <circle cx={sx(11)} cy={sy(34)} r={1.3} fill={L} fillOpacity={o} />
      <circle cx={sx(94)} cy={sy(34)} r={1.3} fill={L} fillOpacity={o} />
      <rect x={sx(0) - 4} y={sy(30.34)} width={4} height={sy(37.66) - sy(30.34)} fill={L} fillOpacity={0.8} />
      <rect x={sx(105)} y={sy(30.34)} width={4} height={sy(37.66) - sy(30.34)} fill={L} fillOpacity={0.8} />
    </g>
  );
}

/** Sofascore-style attack momentum: a bar a minute, up for you, down for them. */
export function MomentumStrip({ frames, us, them, fullTime }: { frames: RadarFrame[]; us: RadarSide; them: RadarSide; fullTime: number }) {
  const W = 360, H = 64, mid = H / 2, bw = (W - 12) / fullTime;
  const x = (min: number) => 6 + (min - 0.5) * bw;
  const played = frames.slice(1);
  const marks: { m: number; up: boolean; icon: string }[] = [];
  for (const f of played) {
    for (const e of f.events) {
      if (e.kind === "goal-us" || e.kind === "highlight-goal") marks.push({ m: f.minute, up: true, icon: "⚽" });
      if (e.kind === "goal-them") marks.push({ m: f.minute, up: false, icon: "⚽" });
      if (e.kind === "injury") marks.push({ m: f.minute, up: false, icon: "🚑" });
    }
    if (f.highlight) marks.push({ m: f.minute, up: true, icon: "⭐" });
  }
  const now = frames[frames.length - 1].minute;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} aria-label="Momentum">
      <rect x={0} y={0} width={W} height={H} rx={10} fill="rgba(255,255,255,0.035)" />
      <line x1={6} x2={W - 6} y1={mid} y2={mid} stroke="#ffffff" strokeOpacity={0.12} />
      <line x1={x(45.5)} x2={x(45.5)} y1={6} y2={H - 6} stroke="#ffffff" strokeOpacity={0.12} strokeDasharray="2 3" />
      {played.map((f) => {
        const v = f.momentum;
        const h = Math.max(1, Math.abs(v) * (mid - 12));
        return <rect key={f.minute} x={x(f.minute) + 0.4} width={Math.max(1, bw - 0.8)} y={v >= 0 ? mid - h : mid} height={h}
          fill={v >= 0 ? us.colour : them.colour} opacity={0.9} rx={0.6} />;
      })}
      {marks.map((k, i) => (
        <text key={i} x={x(k.m) + bw / 2} y={k.up ? 9 : H - 2} fontSize={8} textAnchor="middle">{k.icon}</text>
      ))}
      {now > 0 && now < fullTime && <line x1={x(now) + bw} x2={x(now) + bw} y1={4} y2={H - 4} stroke="#ffffff" strokeOpacity={0.5} />}
    </svg>
  );
}

const ICON: Record<RadarEvent["kind"], string> = {
  "goal-us": "⚽", "goal-them": "⚽", "chance-us": "•", "chance-them": "•", quiet: "·",
  highlight: "⭐", "highlight-goal": "⚽", "highlight-miss": "✕", injury: "🚑",
};

export function RadarFeed({ frames, us, them, clubName, rows = 5 }: { frames: RadarFrame[]; us: RadarSide; them: RadarSide; clubName: string; rows?: number }) {
  const lines = frames.flatMap((f) => f.events).filter((e) => e.kind !== "quiet" || true).slice(-rows).reverse();
  return (
    <div style={{ display: "grid", gap: 3 }}>
      {lines.map((e, i) => {
        const ours = e.kind === "goal-us" || e.kind === "chance-us" || e.kind.startsWith("highlight");
        const theirs = e.kind === "goal-them" || e.kind === "chance-them";
        const tint = e.kind === "injury" ? "#ef4444" : e.kind.startsWith("highlight") ? "#fde047" : ours ? us.colour : theirs ? them.colour : "#64748b";
        const big = e.kind.startsWith("goal") || e.kind === "highlight-goal";
        return (
          <div key={`${e.minute}-${i}-${e.text}`} style={{
            display: "grid", gridTemplateColumns: "30px 16px 1fr", alignItems: "baseline", gap: 4,
            padding: "4px 8px", borderRadius: 8, background: i === 0 ? "rgba(255,255,255,0.06)" : "transparent",
            borderLeft: `3px solid ${tint}`, opacity: i === 0 ? 1 : 0.82 - i * 0.08,
          }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{e.minute}&apos;</span>
            <span style={{ fontSize: 11 }}>{ICON[e.kind]}</span>
            <span style={{ fontSize: 12, fontWeight: big ? 900 : 700, color: "#f1f5f9", lineHeight: 1.35 }}>
              {e.text.replace(/\{club\}/g, clubName)}
            </span>
          </div>
        );
      })}
      {lines.length === 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", padding: "4px 8px" }}>Kick-off…</div>}
    </div>
  );
}

export function Scoreboard({ us, them, frame, over }: { us: RadarSide; them: RadarSide; frame: RadarFrame; over: boolean }) {
  const chip = (s: RadarSide, right = false) => (
    <div style={{ display: "flex", alignItems: "center", gap: 7, flexDirection: right ? "row-reverse" : "row", minWidth: 0 }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, background: s.colour, boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.25)", flex: "none" }} />
      <span style={{ fontSize: 14.5, fontWeight: 900, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.short}</span>
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
      {chip(us)}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", lineHeight: 1 }}>
          {frame.userScore}<span style={{ color: "#64748b", margin: "0 6px" }}>–</span>{frame.oppScore}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, fontWeight: 900, color: over ? "#fde047" : "#34d399", letterSpacing: "0.08em" }}>
          {over ? "FULL TIME" : frame.minute === 0 ? "KICK-OFF" : `${frame.minute}'`}
        </div>
      </div>
      {chip(them, true)}
    </div>
  );
}

function Bar({ label, a, b, us, them, suffix = "" }: { label: string; a: number; b: number; us: RadarSide; them: RadarSide; suffix?: string }) {
  const t = Math.max(1, a + b);
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 900, color: "#f8fafc" }}>
        <span>{a}{suffix}</span><span style={{ color: "#94a3b8", fontWeight: 800 }}>{label}</span><span>{b}{suffix}</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${(a / t) * 100}%`, background: us.colour }} />
        <div style={{ width: `${(b / t) * 100}%`, background: them.colour }} />
      </div>
    </div>
  );
}

export function FullTime({ s, us, them }: { s: RadarSummary; us: RadarSide; them: RadarSide }) {
  return (
    <div style={{ display: "grid", gap: 10, padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <Bar label="Possession" a={s.possessionUs} b={100 - s.possessionUs} us={us} them={them} suffix="%" />
      <Bar label="Chances" a={s.chancesUs} b={s.chancesThem} us={us} them={them} />
      <Bar label="Time in their half" a={s.territoryUs} b={s.territoryThem} us={us} them={them} suffix="%" />
      <div>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#fde047", letterSpacing: "0.1em", marginBottom: 6 }}>
          ⭐ YOUR HIGHLIGHTS · {s.highlights.length}
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          {s.highlights.map((h, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 6, fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>
              <span style={{ color: "#94a3b8", fontWeight: 900 }}>{h.minute}&apos;</span>
              <span>{handedKinds(h)}</span>
              <span style={{ fontWeight: 900, color: h.result === "goal" ? "#34d399" : "#f87171" }}>{h.result === "goal" ? "GOAL" : "missed"}</span>
            </div>
          ))}
          {s.highlights.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>None — the ball never found you.</div>}
        </div>
      </div>
      {s.injuryCheck && (
        // A career rolls your injury once, at full time, from the energy you
        // finish on — the unseen match never injures anyone minute by minute.
        <div style={{
          padding: "8px 10px", borderRadius: 10, fontSize: 12, fontWeight: 800, lineHeight: 1.4,
          background: s.injuryCheck.injury ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${s.injuryCheck.injury ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
          color: s.injuryCheck.injury ? "#fecaca" : "#cbd5e1",
        }}>
          🚑 {s.injuryCheck.injury ? `Injured — ${s.injuryCheck.injury.note}` : "No injury"}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginTop: 2 }}>
            Full-time check, as in a career: finished on {s.injuryCheck.endEnergy}% energy, a {(s.injuryCheck.risk * 100).toFixed(1)}% chance.
          </div>
        </div>
      )}
    </div>
  );
}

export type { RadarMatch };
