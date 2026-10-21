"use client";

/**
 * Phase 2 on the test page: a generated build-up (lib/star/fhr/buildUp.ts)
 * played by the REAL match (EnginePlay, through its `leadIn` replay — the one
 * engine, no loop of its own), with the same build-up drawn from above in
 * three frames beside it. "Generate another" takes the next chance the real
 * match serves. Nothing is saved.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EnginePlay from "@/components/star/EnginePlay";
import { Btn, Note } from "@/components/admin/broadcast/BroadcastPage";
import type { Scenario } from "@/lib/star/canvasEngine";
import type { LeadIn } from "@/lib/star/leadIn";
import { fhrBuildUpFor, fhrWantsBuildUp, FHR_DATA_CREDIT, type FhrBuildUp } from "@/lib/star/fhr/buildUp";
import { servedChances, type ServedChance } from "@/lib/star/fhr/servedChances";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { PITCH_W, HALF_LEN, CX, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, POST_L, POST_R } from "@/lib/star/pitch";

const LEN = 2 * HALF_LEN;
const HZ = 15;
const COL: Record<string, string> = { you: "#ffffff", mate: "#3b82f6", extra: "#93c5fd", opp: "#ef4444", keeper: "#facc15" };
const copy = (sc: Scenario): Scenario => JSON.parse(JSON.stringify(sc));
const KIND = (k: string) => k.replace(/_/g, " ");

/** The build-up from above at time t: everyone, their trail so far, the ball and its route, the chance's frame. */
function Frame({ b, t, title }: { b: FhrBuildUp; t: number; title: string }) {
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  const grow = (p: { x: number; y: number }) => { x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y); };
  for (const p of b.people) for (const q of p.path) grow(q);
  grow({ x: CX, y: 0 });
  x1 -= 4; x2 += 4; y1 -= 4; y2 += 4;
  const W = 150, H = 200, s = Math.min(W / (x2 - x1), H / (y2 - y1));
  const ox = (W - (x2 - x1) * s) / 2, oy = (H - (y2 - y1) * s) / 2;
  const X = (x: number) => ox + (x - x1) * s, Y = (y: number) => oy + (y - y1) * s;
  // (Men still running at the hand-over have samples past durS: phase 3.)
  const i = Math.round(t * HZ);
  const at = (path: { x: number; y: number }[]) => path[Math.min(i, path.length - 1)];
  const route: string[] = [];
  for (let u = 0; u <= b.durS; u += 0.1) { const q = b.ballAt(u); route.push(`${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`); }
  const ball = b.ballAt(t), r = Math.max(2.4, 0.5 * s);
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, maxWidth: W }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", borderRadius: 4 }}>
        <rect width={W} height={H} fill="#14532d" />
        <rect x={X(0)} y={Y(0)} width={PITCH_W * s} height={LEN * s} fill="#2f7d32" stroke="#e5e7eb" strokeWidth={0.8} />
        <line x1={X(0)} y1={Y(HALF_LEN)} x2={X(PITCH_W)} y2={Y(HALF_LEN)} stroke="#e5e7eb" strokeWidth={0.8} />
        <rect x={X(BOX_L)} y={Y(0)} width={(BOX_R - BOX_L) * s} height={BOX_DEPTH * s} fill="none" stroke="#e5e7eb" strokeWidth={0.8} />
        <rect x={X(SIX_L)} y={Y(0)} width={(SIX_R - SIX_L) * s} height={SIX_DEPTH * s} fill="none" stroke="#e5e7eb" strokeWidth={0.8} />
        <rect x={X(POST_L)} y={Y(-1.2)} width={(POST_R - POST_L) * s} height={1.2 * s} fill="#fff" opacity={0.8} />
        <rect x={X(b.frame.x1)} y={Y(b.frame.y1)} width={(b.frame.x2 - b.frame.x1) * s} height={(b.frame.y2 - b.frame.y1) * s} fill="none" stroke="#fde047" strokeDasharray="3 2" strokeWidth={0.8} />
        <polyline points={route.join(" ")} fill="none" stroke="#111" strokeDasharray="1 2.5" strokeWidth={1.2} />
        {b.people.map((p) => (
          <polyline key={`t${p.key}`} points={p.path.slice(0, i + 1).map((q) => `${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(" ")} fill="none" stroke={COL[p.side]} strokeOpacity={0.45} strokeWidth={1} />
        ))}
        <circle cx={X(ball.x)} cy={Y(ball.y)} r={Math.max(2, 0.35 * s)} fill="#111" stroke="#fff" strokeWidth={0.8} />
        {b.people.map((p) => (
          <circle key={p.key} cx={X(at(p.path).x)} cy={Y(at(p.path).y)} r={r} fill={COL[p.side]} stroke={p.side === "you" ? "#f59e0b" : p.key.startsWith("cover") ? "#fff" : "#111"} strokeWidth={p.side === "you" || p.key.startsWith("cover") ? 1.6 : 0.6} />
        ))}
      </svg>
      <div style={{ fontSize: 10, textAlign: "center", opacity: 0.75 }}>{title}</div>
    </div>
  );
}

export default function BuildUpPanel() {
  // The chances the real match serves (Chances: New, an even game), open play only.
  // Made in the browser only (the chance maker reads this phone's settings), with no per-visit offset, so the same chances every visit.
  const [pool, setPool] = useState<ServedChance[]>([]);
  useEffect(() => { setVisitSalt(0); setPool(servedChances({ count: 120, seed: 21 }).filter((c) => fhrWantsBuildUp(c.sc.kind, c.moment))); }, []);
  const [at, setAt] = useState(0);
  const [run, setRun] = useState(0);
  const [prog, setProg] = useState<{ t: number; done: boolean }>({ t: 0, done: false });
  const lastSent = useRef(-1);
  const chance = pool[at % Math.max(1, pool.length)];
  // What the match plays (it casts your squad onto the chance first, so who plays each touch can differ from a bare build): shown once the match has built it.
  const [played, setPlayed] = useState<{ at: number; b: FhrBuildUp } | null>(null);
  const bare = useMemo(() => (chance ? fhrBuildUpFor(copy(chance.sc), chance.moment) : null), [chance]);
  const shown = played && played.at === at ? played.b : bare;
  const openOn = useMemo(() => () => copy(chance.sc), [chance]);
  const leadIn = useCallback((sc: Scenario): LeadIn => {
    const b = fhrBuildUpFor(sc, chance.moment);
    setPlayed({ at, b });
    lastSent.current = -1;
    return {
      ...b,
      onTick: (t, done) => {
        if (!done && t - lastSent.current < 0.2) return;
        lastSent.current = t;
        setProg({ t, done });
      },
    };
  }, [chance, at]);
  if (!chance || !shown) return <Note>No open-play chance served.</Note>;
  const another = () => { setProg({ t: 0, done: false }); setAt((a) => a + 1); };
  const again = () => { setProg({ t: 0, done: false }); setRun((r) => r + 1); };
  const who = (o: string) => (o === "you" ? "you" : o.startsWith("extra") ? "a team-mate only in the build-up" : `${shown.roles[o] ?? o} (in the chance)`);
  return (
    <div data-fhr-buildup data-fhr-buildup-state={prog.done ? "play" : "buildup"} data-fhr-buildup-t={prog.t.toFixed(2)} data-fhr-buildup-len={shown.durS.toFixed(2)}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <Btn main onClick={another}>Generate another</Btn>
        <Btn onClick={again}>↺ Watch again</Btn>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
        #{(at % pool.length) + 1} · {KIND(chance.sc.kind)} · {chance.moment.pattern === "transition" ? "a break" : "settled play"}{chance.moment.lane ? `, ${chance.moment.lane}` : ""} · {shown.durS.toFixed(1)} s · {shown.acts.length} touches
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: prog.done ? "#6ee7b7" : "#fde68a", marginBottom: 6 }}>
        {prog.done ? "Your turn: play the chance" : `Build-up ${prog.t.toFixed(1)} / ${shown.durS.toFixed(1)} s (tap the match to skip)`}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: "min(100%, 390px)" }}>
          <EnginePlay key={`${at}-${run}`} seed={7} openOn={openOn} leadIn={leadIn} />
        </div>
        <div style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 480 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Frame b={shown} t={0} title="first (0 s)" />
            <Frame b={shown} t={shown.durS / 2} title={`middle (${(shown.durS / 2).toFixed(1)} s)`} />
            <Frame b={shown} t={shown.durS + (shown.runOnS ?? 0)} title="last = the chance" />
          </div>
          <ol style={{ fontSize: 12, margin: "8px 0 0 18px", padding: 0 }}>
            {shown.acts.map((a, k) => {
              const spell = shown.actOwners[k];
              return <li key={k}>{a.type === "pass" ? (a.h > 0 ? "A ball in the air" : "A pass") : "A carry"} of {Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y).toFixed(0)} m{a.src === "chain" ? " (a real route into this chance)" : a.src === "break" ? " (the long ball of a break)" : ""} · {who(spell)}</li>;
            })}
          </ol>
          <Note>White = you · blue = the chance&apos;s team-mates · pale blue = team-mates only in the build-up (off the screen when the chance starts) · red = defenders (white ring = the extra defender in from off the screen) · yellow = keeper · dashed = the chance&apos;s frame.</Note>
        </div>
      </div>
      <Note>{FHR_DATA_CREDIT.join(" ")}</Note>
    </div>
  );
}
