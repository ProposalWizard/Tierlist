"use client";

/**
 * FIX A BANGER (admin, Real Goals page) — Leo, 22 Oct 2026 (plan 7a): the
 * bangers are drafted by us from public record, so their shot spot, where they
 * went in and the passes before are placed by hand. This panel fixes one by
 * DRAGGING: the shot spot and the pass dots on the pitch, the end spot on the
 * goal mouth. Changes stay on this phone (a draft) until you press Download:
 * it saves a corrected bangers.json (the same shape as data/realmoments/
 * bangers.json, xG recomputed). Put that file in data/realmoments/ and commit
 * it to make the fix stick. Nothing saves to the database or the repo here.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealGoal, RgMoveEv } from "@/lib/star/realGoals";
import type { XY } from "@/lib/star/realMoments";
import { CX, POST_L, POST_R } from "@/lib/star/pitch";

const DRAFT_KEY = "star-real-goals-banger-fixes-v1";
/** The xG model every Wyscout shot uses (wyscout_shots.json meta.xg_model). */
const XG_W = [3.2513, -2.0252, 0.2372, -0.956, 0.6505];
function xgOf(x: number, y: number, head: boolean, fk: boolean): number {
  const a = Math.atan2(POST_L - x, Math.max(0.01, y)), b = Math.atan2(POST_R - x, Math.max(0.01, y));
  const f = [1, Math.log(Math.max(0.5, Math.hypot(x - CX, y))), Math.abs(b - a), head ? 1 : 0, fk ? 1 : 0];
  return 1 / (1 + Math.exp(-f.reduce((s, v, i) => s + v * XG_W[i], 0)));
}

interface Fix { ball: XY; end: number; endZ: number; move: RgMoveEv[] }
type Fixes = Record<string, Fix>;
const r2 = (v: number) => Math.round(v * 100) / 100;

function loadFixes(): Fixes {
  try { const v = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function saveFixes(f: Fixes) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch { /* private */ } }

const fixOf = (g: RealGoal): Fix => ({
  ball: [...g.shot.ball] as XY, end: g.shot.end ? g.shot.end[0] : CX, endZ: g.shot.endZ ?? 1, move: g.x.move.map((e) => [...e] as RgMoveEv),
});

/** The goal with a fix applied (what Play it plays and Download writes). */
export function applyFix(g: RealGoal, f: Fix | undefined): RealGoal {
  if (!f) return g;
  const move = f.move.map((e) => [...e] as RgMoveEv);
  if (move.length && move[move.length - 1][3]) move[move.length - 1][3] = [...f.ball] as XY;
  const passes = move.filter((e) => e[1] === "P" && e[3] && e[5]).map((e) => [e[0], e[2], e[3]!, e[4], e[5]!] as [number, XY, XY, string, string]).slice(-3);
  const xg = Math.round(xgOf(f.ball[0], f.ball[1], g.shot.body === "Head", g.shot.type === "Free Kick") * 1000) / 1000;
  return {
    ...g,
    shot: { ...g.shot, ball: [...f.ball] as XY, end: [r2(f.end), 0], endZ: r2(f.endZ), xg, lead: { passes, path: g.shot.lead?.path ?? [] } },
    x: { ...g.x, move },
  };
}

/** The chain of dots: where each action starts, then the shot spot. */
function chainOf(f: Fix): XY[] {
  const pts: XY[] = f.move.map((e) => e[2]);
  pts.push(f.ball);
  return pts;
}

// The pitch view: the attacking half, goal at the top. 68 m across, 60 m deep.
const VW = 340, VH = 300, SC = VW / 68;
const toSvg = (p: XY) => ({ x: p[0] * SC, y: 10 + p[1] * SC * 0.82 });
const fromSvg = (x: number, y: number): XY => [r2(Math.min(68, Math.max(0, x / SC))), r2(Math.min(70, Math.max(0, (y - 10) / (SC * 0.82))))];

function PitchEditor({ fix, onChange }: { fix: Fix; onChange: (f: Fix) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const pts = chainOf(fix);
  const at = (e: React.PointerEvent): XY => {
    const r = ref.current!.getBoundingClientRect();
    return fromSvg(((e.clientX - r.left) / r.width) * VW, ((e.clientY - r.top) / r.height) * VH);
  };
  const move = (i: number, p: XY) => {
    const m = fix.move.map((e) => [...e] as RgMoveEv);
    if (i === pts.length - 1) { onChange({ ...fix, ball: p, move: m }); return; }
    m[i][2] = p;
    if (i > 0 && m[i - 1][3]) m[i - 1][3] = p;
    onChange({ ...fix, move: m });
  };
  const g = (p: XY) => toSvg(p);
  return (
    <svg ref={ref} viewBox={`0 0 ${VW} ${VH}`} width="100%" className="rg-fixpitch" style={{ touchAction: "none" }}
      onPointerMove={(e) => { if (drag !== null) move(drag, at(e)); }} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
      <rect x={0} y={0} width={VW} height={VH} fill="#1f7a34" />
      {/* box, six-yard box, spot, arc, halfway */}
      <rect x={13.84 * SC} y={10} width={(54.16 - 13.84) * SC} height={16.5 * SC * 0.82} fill="none" stroke="#fff" strokeWidth={1.5} />
      <rect x={24.84 * SC} y={10} width={(43.16 - 24.84) * SC} height={5.5 * SC * 0.82} fill="none" stroke="#fff" strokeWidth={1.5} />
      <rect x={POST_L * SC} y={4} width={(POST_R - POST_L) * SC} height={6} fill="#fff" />
      <circle cx={34 * SC} cy={10 + 11 * SC * 0.82} r={2} fill="#fff" />
      <line x1={0} y1={10 + 52.5 * SC * 0.82} x2={VW} y2={10 + 52.5 * SC * 0.82} stroke="#fff" strokeWidth={1.5} />
      <line x1={0} y1={10} x2={VW} y2={10} stroke="#fff" strokeWidth={1.5} />
      {/* the move */}
      {pts.slice(1).map((p, i) => {
        const a = g(pts[i]), b = g(p), carry = fix.move[i]?.[1] === "C";
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={carry ? "#fde047" : "#fff"} strokeWidth={2} strokeDasharray={carry ? "4 3" : undefined} />;
      })}
      {(() => { const b = g(fix.ball); const e = { x: fix.end * SC, y: 10 }; return <line x1={b.x} y1={b.y} x2={e.x} y2={e.y} stroke="#f472b6" strokeWidth={2.5} />; })()}
      {pts.map((p, i) => {
        const q = g(p), shot = i === pts.length - 1;
        return (
          <g key={i} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(i); }} style={{ cursor: "grab" }}>
            <circle cx={q.x} cy={q.y} r={shot ? 11 : 9} fill={shot ? "#f472b6" : "#38bdf8"} stroke="#082f49" strokeWidth={2} />
            <text x={q.x} y={q.y + 4} fontSize={10} fontWeight={900} textAnchor="middle" fill="#082f49" pointerEvents="none">{shot ? "⚽" : i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

function MouthEditor({ fix, onChange }: { fix: Fix; onChange: (f: Fix) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState(false);
  const W = 340, pad = 20, s = (W - 2 * pad) / (POST_R - POST_L + 1.6), H = 2.44 * s + pad + 24;
  const px = (x: number) => pad + (x - (POST_L - 0.8)) * s;
  const py = (z: number) => H - 24 - z * s;
  const set = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W, sy = ((e.clientY - r.top) / r.height) * H;
    const x = (sx - pad) / s + (POST_L - 0.8), z = (H - 24 - sy) / s;
    onChange({ ...fix, end: r2(Math.min(37.4, Math.max(30.6, x))), endZ: r2(Math.min(2.1, Math.max(0.11, z))) });
  };
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", background: "#14532d", borderRadius: 8, touchAction: "none" }}
      onPointerDown={(e) => { setDrag(true); set(e); }} onPointerMove={(e) => { if (drag) set(e); }} onPointerUp={() => setDrag(false)} onPointerLeave={() => setDrag(false)}>
      <rect x={px(POST_L)} y={py(2.44)} width={(POST_R - POST_L) * s} height={2.44 * s} fill="rgba(255,255,255,0.08)" stroke="#fff" strokeWidth={3} />
      <line x1={0} y1={py(0)} x2={W} y2={py(0)} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
      <circle cx={px(fix.end)} cy={py(fix.endZ)} r={10} fill="#f472b6" stroke="#4a044e" strokeWidth={2} />
      <text x={W / 2} y={H - 6} fill="#fff" fontSize={11} fontWeight={800} textAnchor="middle">As the shooter sees it · drag the dot</text>
    </svg>
  );
}

export default function BangerFixer({ bangers, onPlay }: { bangers: RealGoal[]; onPlay: (g: RealGoal) => void }) {
  const [fixes, setFixes] = useState<Fixes>({});
  const [id, setId] = useState(bangers[0]?.id ?? "");
  useEffect(() => setFixes(loadFixes()), []);
  const goal = bangers.find((b) => b.id === id) ?? bangers[0];
  const fix = useMemo(() => (goal ? fixes[goal.id] ?? fixOf(goal) : null), [goal, fixes]);
  if (!goal || !fix) return null;
  const change = (f: Fix) => setFixes((all) => { const n = { ...all, [goal.id]: f }; saveFixes(n); return n; });
  const reset = () => setFixes((all) => { const n = { ...all }; delete n[goal.id]; saveFixes(n); return n; });
  const fixed = Object.keys(fixes).filter((k) => bangers.some((b) => b.id === k));
  const download = async () => {
    // The file as it is in the repo, with every fix on this phone applied.
    const file = await fetch("/api/star/real-moments?file=bangers").then((r) => r.json());
    const byId = new Map(bangers.map((b) => [b.id, applyFix(b, fixes[b.id])]));
    file.shots = file.shots.map((s: { id: string }) => byId.get(s.id)?.shot ?? s);
    file.goals = file.goals.map((x: { id: string }) => byId.get(x.id)?.x ?? x);
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "bangers.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const g = applyFix(goal, fixes[goal.id]);
  return (
    <div data-banger-fixer className="rg-fixer">
      <select value={goal.id} onChange={(e) => setId(e.target.value)} className="rg-search" data-fix-pick>
        {bangers.map((b) => <option key={b.id} value={b.id}>{fixes[b.id] ? "✎ " : ""}{b.x.label || `${b.shot.player} v ${b.shot.opp}`}</option>)}
      </select>
      <div className="rg-fixfacts">
        <b>{g.shot.player}</b> · {g.x.home} {g.x.score[0]}–{g.x.score[1]} {g.x.away} · {g.shot.minute}&apos; · {g.shot.body}{g.x.technique ? ` · ${g.x.technique}` : ""}
        <br />Shot spot ({g.shot.ball[0].toFixed(1)}, {g.shot.ball[1].toFixed(1)}) · {Math.hypot(g.shot.ball[0] - CX, g.shot.ball[1]).toFixed(1)} m out · xG {Math.round(g.shot.xg * 100)}%
        {g.x.source && <><br /><span className="rg-fixsrc">Source: {g.x.source}</span></>}
        {g.x.note && <><br /><span className="rg-fixsrc">Note: {g.x.note}</span></>}
      </div>
      <div className="rg-fixlabel">The pitch (goal at the top): drag ⚽ the shot spot, or a numbered dot (where each pass or run starts).</div>
      <PitchEditor fix={fix} onChange={change} />
      <div className="rg-fixlabel">Where it went in:</div>
      <MouthEditor fix={fix} onChange={change} />
      <div className="rg-fixbtns">
        <button onClick={() => onPlay(g)} className="rg-dplay">Play it ▶</button>
        <button onClick={reset} className="rg-fixbtn">↺ Undo this goal&apos;s fixes</button>
        <button onClick={download} className="rg-fixbtn" data-fix-download>⬇ Download bangers.json ({fixed.length} fixed)</button>
      </div>
      <div className="rg-fixsrc">Fixes stay on this phone until you download. Put the file in data/realmoments/ and commit it to make them stick for everyone.</div>
    </div>
  );
}
