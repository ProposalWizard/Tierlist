"use client";
import { useEffect, useRef, useState } from "react";
import { PITCH_W, HALF_LEN } from "@/lib/star/pitch";
import {
  SCENARIO_KINDS, blankScenario, addPlayer,
  type MatchScenario, type ScenarioSide, type ScenarioMomentKind,
} from "@/lib/star/scenarios";
import { listScenarios, loadScenario, saveScenario, deleteScenario } from "@/lib/star/scenarioStore";
import {
  renderScenario, viewportFor, pitchFromPx, pxFromPitch, VIEW_ASPECT,
  type Facing,
} from "@/lib/star/scenarioRender";

/**
 * THE SCENARIO EDITOR — DRAFT TOOL, NOT WIRED INTO THE REAL GAME.
 *
 * See lib/star/scenarios.ts's own header for why this exists. Two things
 * requested directly, on top of that first build:
 *
 *  - Dragging used to put a player down "off to the side" of the actual
 *    cursor. Fixed in scenarioRender.ts's pitchFromPx, which reads the
 *    canvas's own on-screen box exactly rather than assuming it matches a
 *    fixed aspect ratio.
 *  - The pitch used to be a flat, schematic top-down diagram — coloured
 *    dots on ruled lines. It is drawn now the way an actual highlight
 *    looks (scenarioRender.ts: the same palette, the same flat overhead
 *    camera, the same hand-drawn kit figures the real match uses), so a
 *    scenario can be judged by eye rather than by imagining it.
 *
 * The ball is no longer something placed independently — it lives at your
 * own feet, always, the same way it does the moment before you actually
 * strike it in a real match; there is nothing to select or drag for it.
 */

const PITCH_LEN = HALF_LEN * 2; // 105
const KIND_LABEL: Record<ScenarioMomentKind, string> = {
  corner: "Corner", free_kick: "Free Kick", throw_in: "Throw-In",
  kickoff: "Kickoff", open_play: "Open Play",
};
const SIDE_COLOR: Record<ScenarioSide, string> = {
  you: "#10b981", teammate: "#3b82f6", opponent: "#dc2626",
};
const FACING_LABEL: Record<Facing, string> = { up: "Straight on", left: "From the left", right: "From the right" };

// The canvas's own backing-store size — fixed, at the real match's own
// aspect ratio (VIEW_ASPECT, canvasEngine.ts) so a scenario previews at the
// same shape it would actually be framed in. Scaled up by devicePixelRatio
// at mount for a crisp line on a real screen, capped so a saved scenario is
// never asked to redraw at an absurd resolution.
const CANVAS_H = 900;
const CANVAS_W = Math.round(CANVAS_H * VIEW_ASPECT);

export default function ScenarioEditor() {
  const [scenario, setScenario] = useState<MatchScenario>(() => blankScenario("corner"));
  const [saved, setSaved] = useState<MatchScenario[]>(() => listScenarios());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballImgRef = useRef<HTMLImageElement | null>(null);

  const refreshList = () => setSaved(listScenarios());

  // The real ball photo, loaded once — renderScenario falls back to a plain
  // disc for the handful of frames before this resolves.
  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.png";
    ballImgRef.current = img;
    img.onload = () => paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sizing: the backing store at devicePixelRatio, the CSS box at the
  // real match's own 5:8 shape — see CANVAS_W/H above. ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(CANVAS_W * dpr);
    canvas.height = Math.round(CANVAS_H * dpr);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Paint whenever the scenario or the selection changes ──
  const cam = scenario.camera;
  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const vp = viewportFor(cam.centerX, cam.centerY, cam.viewHeight);
    renderScenario(canvas, {
      viewport: vp,
      facing: cam.facing ?? "up", // an old saved scenario predates `facing` — default straight-on
      players: scenario.players.map(p => ({ x: p.x, y: p.y, side: p.side, selected: p.id === selectedId })),
      ball: scenario.players.find(p => p.side === "you") ?? scenario.ball,
      ballImage: ballImgRef.current,
    });
  };
  useEffect(paint);

  // ── Pitch-coordinate math ──────────────────────────────────────────────
  //
  // Reported directly: dragging a player put him down "off to the side" of
  // the actual cursor. A `<canvas>` has no letterboxing to account for the
  // way an SVG viewBox does — its CSS box IS the drawing surface — so
  // mapping through the element's own bounding rect, in the ratio of its
  // OWN width/height rather than a fixed assumed aspect ratio, is exact
  // regardless of how the panel around it happens to be sized.
  const facing = (): Facing => cam.facing ?? "up";
  const canvasPointFromEvent = (e: { clientX: number; clientY: number }): { px: number; py: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      px: ((e.clientX - rect.left) / rect.width) * canvas.width,
      py: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };
  const pitchFromEvent = (e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    const p = canvasPointFromEvent(e);
    if (!canvas || !p) return null;
    const vp = viewportFor(cam.centerX, cam.centerY, cam.viewHeight);
    return pitchFromPx(p.px, p.py, canvas.width, canvas.height, vp, facing());
  };

  /** Which player (you included) is actually under the pointer — nearest
   *  one inside a generous grab radius, so a thumb on a phone still finds
   *  the right man in a crowd. */
  const playerAt = (e: { clientX: number; clientY: number }): string | null => {
    const canvas = canvasRef.current;
    const p = canvasPointFromEvent(e);
    if (!canvas || !p) return null;
    const vp = viewportFor(cam.centerX, cam.centerY, cam.viewHeight);
    const grab = canvas.width * 0.06;
    let best: string | null = null, bestD = grab;
    for (const pl of scenario.players) {
      const s = pxFromPitch(pl.x, pl.y, canvas.width, canvas.height, vp, facing());
      const d = Math.hypot(s.px - p.px, s.py - p.py);
      if (d < bestD) { bestD = d; best = pl.id; }
    }
    return best;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const id = playerAt(e);
    setSelectedId(id);
    if (!id) return;
    dragRef.current = { id };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const p = pitchFromEvent(e);
    if (!p) return;
    const id = dragRef.current.id;
    setScenario(s => ({
      ...s,
      // The ball lives at your feet, always — dragging you IS dragging it,
      // so its own stored position stays honest without being separately
      // selectable or draggable at all.
      ball: id === "you" ? p : s.ball,
      players: s.players.map(pl => (pl.id === id ? { ...pl, x: p.x, y: p.y } : pl)),
    }));
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
    if (!selectedId || selectedId === "you") return;
    setScenario(s => ({ ...s, players: s.players.filter(p => p.id !== selectedId) }));
    setSelectedId(null);
  };

  const setFacing = (f: Facing) => setScenario(s => ({ ...s, camera: { ...s.camera, facing: f } }));

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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── The pitch ── */}
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-2">
        <div className="mx-auto" style={{ maxWidth: 420 }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", aspectRatio: `${VIEW_ASPECT}`, touchAction: "none" }}
            className="select-none rounded-lg"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 px-1 text-[10px] font-bold text-white/70">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.you }} /> You</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.teammate }} /> Teammate</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.opponent }} /> Opponent</span>
          <span className="ml-auto">Drag a player to place him. The ball stays at your feet.</span>
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
            disabled={!selectedId || selectedId === "you"}
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

          <label className="mt-3 block text-[10px] font-black uppercase tracking-wide text-white/60">Angle</label>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {(["up", "left", "right"] as Facing[]).map(f => (
              <button
                key={f}
                onClick={() => setFacing(f)}
                className={`rounded-lg px-1.5 py-1.5 text-[10px] font-black uppercase transition ${
                  facing() === f ? "bg-emerald-500 text-white" : "bg-gray-700 text-white/70 hover:bg-gray-600"}`}
              >
                {FACING_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="mt-1 text-[9px] text-white/40">
            The same three the real match ever shoots from — a free tilt would show an angle the game could not actually film.
          </div>
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
