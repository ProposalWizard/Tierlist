"use client";
import { useRef, useState } from "react";
import { PITCH_W, HALF_LEN, POST_L, POST_R, SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH, PEN_SPOT_Y, ARC_R } from "@/lib/star/pitch";
import {
  SCENARIO_KINDS, blankScenario, addPlayer,
  type MatchScenario, type ScenarioSide, type ScenarioMomentKind,
} from "@/lib/star/scenarios";
import { listScenarios, loadScenario, saveScenario, deleteScenario } from "@/lib/star/scenarioStore";

/**
 * THE SCENARIO EDITOR — DRAFT TOOL, NOT WIRED INTO THE REAL GAME.
 *
 * See lib/star/scenarios.ts's own header for why this exists. Two pitch
 * lengths tall (105m) drawn at 1 SVG unit per metre, using the exact same
 * real-geometry constants (pitch.ts) the actual match renderer draws
 * against, so this looks like the same pitch because it genuinely is the
 * same numbers, not a separate approximation.
 */

const PITCH_LEN = HALF_LEN * 2; // 105
const KIND_LABEL: Record<ScenarioMomentKind, string> = {
  corner: "Corner", free_kick: "Free Kick", throw_in: "Throw-In",
  kickoff: "Kickoff", open_play: "Open Play",
};
const SIDE_COLOR: Record<ScenarioSide, string> = {
  you: "#fbbf24", teammate: "#38bdf8", opponent: "#f87171",
};

export default function ScenarioEditor() {
  const [scenario, setScenario] = useState<MatchScenario>(() => blankScenario("corner"));
  const [saved, setSaved] = useState<MatchScenario[]>(() => listScenarios());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const refreshList = () => setSaved(listScenarios());

  // ── Pitch-coordinate math ──────────────────────────────────────────────
  const pointFromEvent = (e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PITCH_W;
    // The SVG is drawn goal-at-top (y grows downward on screen) — pitch.ts's
    // own y grows upfield, so screen-down is pitch-up: flipped here, once.
    const y = PITCH_LEN - ((e.clientY - rect.top) / rect.height) * PITCH_LEN;
    return {
      x: Math.max(0, Math.min(PITCH_W, x)),
      y: Math.max(0, Math.min(PITCH_LEN, y)),
    };
  };

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { id };
    setSelectedId(id);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const p = pointFromEvent(e);
    if (!p) return;
    const id = dragRef.current.id;
    setScenario(s => id === "ball"
      ? { ...s, ball: p }
      : { ...s, players: s.players.map(pl => (pl.id === id ? { ...pl, x: p.x, y: p.y } : pl)) });
  };

  const endDrag = () => { dragRef.current = null; };

  // ── Scenario-level actions ─────────────────────────────────────────────
  const setKind = (kind: ScenarioMomentKind) => {
    if (scenario.players.length > 1 || scenario.name !== "Untitled scenario") {
      setScenario(s => ({ ...s, kind }));
    } else {
      setScenario(blankScenario(kind));
    }
  };

  const addSide = (side: ScenarioSide) => {
    setScenario(s => addPlayer(s, side));
  };

  const removeSelected = () => {
    if (!selectedId || selectedId === "you" || selectedId === "ball") return;
    setScenario(s => ({ ...s, players: s.players.filter(p => p.id !== selectedId) }));
    setSelectedId(null);
  };

  const save = () => {
    saveScenario(scenario);
    refreshList();
    setStatus(`Saved "${scenario.name}".`);
    setTimeout(() => setStatus(null), 2000);
  };

  const load = (id: string) => {
    const s = loadScenario(id);
    if (s) { setScenario(s); setSelectedId(null); }
  };

  const startNew = () => { setScenario(blankScenario(scenario.kind)); setSelectedId(null); };

  const remove = (id: string) => {
    deleteScenario(id);
    refreshList();
    if (scenario.id === id) startNew();
  };

  // ── Camera frame preview rectangle, in pitch metres ─────────────────────
  const cam = scenario.camera;
  const camRectW = Math.min(PITCH_W, cam.viewHeight * (PITCH_W / PITCH_LEN));
  const camX = cam.centerX - camRectW / 2;
  const camY = PITCH_LEN - cam.centerY - cam.viewHeight / 2; // flipped, same as pointFromEvent

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── The pitch ── */}
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${PITCH_W} ${PITCH_LEN}`}
          className="w-full touch-none select-none rounded-lg"
          style={{ maxHeight: "72vh", background: "#1a6e3c" }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onPointerDown={() => setSelectedId(null)}
        >
          {/* Stripes, purely decorative */}
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={0} y={(i * PITCH_LEN) / 10} width={PITCH_W} height={PITCH_LEN / 10}
              fill={i % 2 === 0 ? "#1a6e3c" : "#1c7a40"} />
          ))}

          {/* Markings — goal-at-top (y=0) since that's the shot this scenario
              is usually about; the other goal line still draws at PITCH_LEN
              for open-play/kickoff scenarios that use the far end too. */}
          <g stroke="#ffffffaa" strokeWidth={0.25} fill="none">
            <rect x={0} y={0} width={PITCH_W} height={PITCH_LEN} />
            <line x1={0} y1={HALF_LEN} x2={PITCH_W} y2={HALF_LEN} />
            <circle cx={PITCH_W / 2} cy={HALF_LEN} r={9.15} />
            <circle cx={PITCH_W / 2} cy={HALF_LEN} r={0.4} fill="#ffffffaa" />
            {/* Near goal (top) */}
            <rect x={SIX_L} y={0} width={SIX_R - SIX_L} height={SIX_DEPTH} />
            <rect x={BOX_L} y={0} width={BOX_R - BOX_L} height={BOX_DEPTH} />
            <circle cx={PITCH_W / 2} cy={PEN_SPOT_Y} r={0.4} fill="#ffffffaa" />
            <path d={`M ${PITCH_W / 2 - ARC_R} ${BOX_DEPTH} A ${ARC_R} ${ARC_R} 0 0 0 ${PITCH_W / 2 + ARC_R} ${BOX_DEPTH}`} />
            <line x1={POST_L} y1={0} x2={POST_L} y2={-2} strokeWidth={0.6} />
            <line x1={POST_R} y1={0} x2={POST_R} y2={-2} strokeWidth={0.6} />
            {/* Far goal (bottom) */}
            <rect x={SIX_L} y={PITCH_LEN - SIX_DEPTH} width={SIX_R - SIX_L} height={SIX_DEPTH} />
            <rect x={BOX_L} y={PITCH_LEN - BOX_DEPTH} width={BOX_R - BOX_L} height={BOX_DEPTH} />
            <line x1={POST_L} y1={PITCH_LEN} x2={POST_L} y2={PITCH_LEN + 2} strokeWidth={0.6} />
            <line x1={POST_R} y1={PITCH_LEN} x2={POST_R} y2={PITCH_LEN + 2} strokeWidth={0.6} />
            {/* Corner arcs */}
            <path d={`M 0 1.5 A 1.5 1.5 0 0 0 1.5 0`} />
            <path d={`M ${PITCH_W - 1.5} 0 A 1.5 1.5 0 0 0 ${PITCH_W} 1.5`} />
            <path d={`M 0 ${PITCH_LEN - 1.5} A 1.5 1.5 0 0 1 1.5 ${PITCH_LEN}`} />
            <path d={`M ${PITCH_W - 1.5} ${PITCH_LEN} A 1.5 1.5 0 0 1 ${PITCH_W} ${PITCH_LEN - 1.5}`} />
          </g>

          {/* Camera framing preview — a dashed window, not interactive */}
          <g transform={`rotate(${cam.angle}, ${cam.centerX}, ${PITCH_LEN - cam.centerY})`}>
            <rect
              x={camX} y={camY} width={camRectW} height={cam.viewHeight}
              fill="none" stroke="#facc15" strokeWidth={0.35} strokeDasharray="1.5,1"
            />
          </g>

          {/* Ball */}
          <circle
            cx={scenario.ball.x} cy={PITCH_LEN - scenario.ball.y} r={0.9}
            fill="#fff" stroke="#00000055" strokeWidth={0.15}
            onPointerDown={startDrag("ball")}
            className="cursor-grab active:cursor-grabbing"
          />

          {/* Players */}
          {scenario.players.map(p => (
            <g key={p.id} onPointerDown={startDrag(p.id)} className="cursor-grab active:cursor-grabbing">
              <circle
                cx={p.x} cy={PITCH_LEN - p.y} r={1.6}
                fill={SIDE_COLOR[p.side]}
                stroke={selectedId === p.id ? "#fff" : "#00000066"}
                strokeWidth={selectedId === p.id ? 0.45 : 0.2}
              />
              {p.side === "you" && (
                <text x={p.x} y={PITCH_LEN - p.y + 0.6} fontSize={1.6} textAnchor="middle" fontWeight="900" fill="#052e1a">Y</text>
              )}
            </g>
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap items-center gap-3 px-1 text-[10px] font-bold text-white/70">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.you }} /> You</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.teammate }} /> Teammate</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.opponent }} /> Opponent</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-yellow-300" /> Camera frame</span>
          <span className="ml-auto">Drag any dot to place it. Click a dot to select it.</span>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
          <label className="block text-[10px] font-black uppercase tracking-wide text-white/60">Name</label>
          <input
            value={scenario.name}
            onChange={e => setScenario(s => ({ ...s, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm font-bold text-white"
          />

          <label className="mt-3 block text-[10px] font-black uppercase tracking-wide text-white/60">Moment</label>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {SCENARIO_KINDS.map(k => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-lg px-1.5 py-1 text-[10px] font-black uppercase transition ${
                  scenario.kind === k ? "bg-emerald-500 text-white" : "bg-gray-700 text-white/70 hover:bg-gray-600"}`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
          <div className="text-[10px] font-black uppercase tracking-wide text-white/60">Players</div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button onClick={() => addSide("teammate")} className="rounded-lg bg-sky-600 py-1.5 text-[11px] font-black text-white hover:bg-sky-500">+ Teammate</button>
            <button onClick={() => addSide("opponent")} className="rounded-lg bg-red-600 py-1.5 text-[11px] font-black text-white hover:bg-red-500">+ Opponent</button>
          </div>
          <button
            onClick={removeSelected}
            disabled={!selectedId || selectedId === "you" || selectedId === "ball"}
            className="mt-1.5 w-full rounded-lg bg-gray-700 py-1.5 text-[11px] font-black text-white/80 hover:bg-gray-600 disabled:opacity-40"
          >
            Remove selected
          </button>
          <div className="mt-1.5 text-[10px] text-white/50">
            {scenario.players.filter(p => p.side === "teammate").length} teammate(s), {scenario.players.filter(p => p.side === "opponent").length} opponent(s)
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
          <div className="text-[10px] font-black uppercase tracking-wide text-white/60">Camera framing</div>
          <SliderRow label="Centre X" value={cam.centerX} min={0} max={PITCH_W} step={0.5}
            onChange={v => setScenario(s => ({ ...s, camera: { ...s.camera, centerX: v } }))} />
          <SliderRow label="Centre Y" value={cam.centerY} min={0} max={PITCH_LEN} step={0.5}
            onChange={v => setScenario(s => ({ ...s, camera: { ...s.camera, centerY: v } }))} />
          <SliderRow label="Zoom (view height, m)" value={cam.viewHeight} min={10} max={PITCH_LEN} step={1}
            onChange={v => setScenario(s => ({ ...s, camera: { ...s.camera, viewHeight: v } }))} />
          <SliderRow label="Tilt (°)" value={cam.angle} min={-30} max={30} step={1}
            onChange={v => setScenario(s => ({ ...s, camera: { ...s.camera, angle: v } }))} />
        </div>

        <div className="flex gap-1.5">
          <button onClick={save} className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-black text-white hover:bg-emerald-400">Save scenario</button>
          <button onClick={startNew} className="rounded-lg bg-gray-700 px-3 py-2 text-xs font-black text-white/80 hover:bg-gray-600">New</button>
        </div>
        {status && <div className="text-center text-[10px] font-bold text-emerald-300">{status}</div>}

        <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
          <div className="text-[10px] font-black uppercase tracking-wide text-white/60">
            Saved ({saved.length})
          </div>
          <div className="mt-1.5 max-h-56 space-y-1 overflow-y-auto">
            {saved.length === 0 && <div className="text-[10px] text-white/40">Nothing saved yet.</div>}
            {saved.map(s => (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1 text-[10px] ${
                  s.id === scenario.id ? "bg-emerald-600/30" : "bg-gray-900"}`}
              >
                <button onClick={() => load(s.id)} className="min-w-0 flex-1 truncate text-left font-bold text-white">
                  {s.name} <span className="text-white/40">· {KIND_LABEL[s.kind]}</span>
                </button>
                <button onClick={() => remove(s.id)} className="shrink-0 rounded bg-red-900/60 px-1.5 py-0.5 font-black text-red-200 hover:bg-red-800">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] font-bold text-white/70">
        <span>{label}</span>
        <span className="tabular-nums text-white">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-0.5 w-full accent-emerald-500"
      />
    </div>
  );
}
