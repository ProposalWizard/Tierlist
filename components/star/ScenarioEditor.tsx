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
  type Facing, type Viewport,
} from "@/lib/star/scenarioRender";

/**
 * THE SCENARIO EDITOR — DRAFT TOOL, NOT WIRED INTO THE REAL GAME.
 *
 * See lib/star/scenarios.ts's own header for why this exists. Requested
 * directly, on top of the first build (which drew the pitch the real way
 * but still had a schematic editor around it):
 *
 *  - Added players were invisible — `addPlayer` placed them relative to
 *    the BALL, which for a corner sits at the touchline while the camera
 *    is centred on goal; fixed in `scenarios.ts` to place relative to the
 *    camera's own frame instead, so a new player is always somewhere you
 *    can actually see and drag.
 *  - Deleting a player used to mean leaving the pitch entirely for a
 *    button in the side panel. There's now a small ✕ that floats right
 *    over a selected player on the canvas itself — tap him, tap the ✕ (or
 *    press Delete/Backspace with him selected) — no separate panel needed.
 *  - The Add Teammate/Add Opponent controls used to be the second of five
 *    stacked panels below the canvas, forcing a scroll on anything under a
 *    1024px-wide window. They're a small sidebar beside the pitch now,
 *    using the space the narrow portrait canvas was leaving empty.
 *  - The turned ("from the left"/"from the right") camera used to render
 *    with a badly disproportionate D-arc and goal — `viewportFor` in
 *    `scenarioRender.ts` wasn't accounting for the fact that a turned frame
 *    swaps which screen axis each pitch axis maps through, so one metre
 *    stopped being one metre on both screen axes. Fixed there; see that
 *    file's own note on the arithmetic.
 *  - A "Pick on pitch" mode: the canvas can show the WHOLE pitch, zoomed
 *    out, with the current camera's frame drawn as a dashed rectangle you
 *    drag around — wherever you release becomes the new centre. Requested
 *    directly as an easier way to pick a framing than the raw X/Y sliders.
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

// A fixed "up"-facing frame sized to hold the entire pitch with a little
// breathing room on every edge, used only by the "Pick on pitch" mode.
// (125m tall is bigger than the pitch's own 105m length specifically so
// the DERIVED width, 125*VIEW_ASPECT≈78m, comfortably clears the pitch's
// 68m width too — the frame is portrait-shaped, so it's the WIDTH that's
// the tight dimension here, not the length.)
const FULL_PITCH_VIEW_HEIGHT = 125;

export default function ScenarioEditor() {
  const [scenario, setScenario] = useState<MatchScenario>(() => blankScenario("corner"));
  const [saved, setSaved] = useState<MatchScenario[]>(() => listScenarios());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pitchPicker, setPitchPicker] = useState(false);
  const dragRef = useRef<{ id: string } | null>(null);
  const pickerDraggingRef = useRef(false);
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

  const cam = scenario.camera;
  const facing = (): Facing => cam.facing ?? "up";
  const camVp = () => viewportFor(cam.centerX, cam.centerY, cam.viewHeight, facing());
  const fullPitchVp = (): Viewport => viewportFor(PITCH_W / 2, HALF_LEN, FULL_PITCH_VIEW_HEIGHT, "up");

  // ── Paint whenever the scenario or the selection changes ──
  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (pitchPicker) {
      renderScenario(canvas, {
        viewport: fullPitchVp(),
        facing: "up",
        players: scenario.players.map(p => ({ x: p.x, y: p.y, side: p.side })),
        ball: scenario.players.find(p => p.side === "you") ?? scenario.ball,
        ballImage: ballImgRef.current,
        frameOverlay: camVp(),
      });
      return;
    }
    renderScenario(canvas, {
      viewport: camVp(),
      facing: facing(), // an old saved scenario predates `facing` — default straight-on
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
    return pitchFromPx(p.px, p.py, canvas.width, canvas.height, camVp(), facing());
  };

  /** Which player (you included) is actually under the pointer — nearest
   *  one inside a generous grab radius, so a thumb on a phone still finds
   *  the right man in a crowd. */
  const playerAt = (e: { clientX: number; clientY: number }): string | null => {
    const canvas = canvasRef.current;
    const p = canvasPointFromEvent(e);
    if (!canvas || !p) return null;
    const vp = camVp();
    const grab = canvas.width * 0.06;
    let best: string | null = null, bestD = grab;
    for (const pl of scenario.players) {
      const s = pxFromPitch(pl.x, pl.y, canvas.width, canvas.height, vp, facing());
      const d = Math.hypot(s.px - p.px, s.py - p.py);
      if (d < bestD) { bestD = d; best = pl.id; }
    }
    return best;
  };

  /** In picker mode, move the CAMERA's own centre to wherever the pointer
   *  is on the full-pitch overview — live, so the dashed frame visibly
   *  follows the drag, and wherever it's released is what stays. */
  const moveCameraTo = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const p = canvasPointFromEvent(e);
    if (!canvas || !p) return;
    const pt = pitchFromPx(p.px, p.py, canvas.width, canvas.height, fullPitchVp(), "up");
    setScenario(s => ({ ...s, camera: { ...s.camera, centerX: pt.x, centerY: pt.y } }));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    if (pitchPicker) {
      pickerDraggingRef.current = true;
      moveCameraTo(e);
      return;
    }
    const id = playerAt(e);
    setSelectedId(id);
    if (!id) return;
    dragRef.current = { id };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pitchPicker) {
      if (pickerDraggingRef.current) moveCameraTo(e);
      return;
    }
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

  const endDrag = () => { dragRef.current = null; pickerDraggingRef.current = false; };

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

  // Delete/Backspace deletes the selected player — the on-canvas ✕ is the
  // primary way now, this is the desktop-keyboard equivalent of it. Skips
  // when a text field (the Name input) actually has focus.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!selectedId || selectedId === "you") return;
      e.preventDefault();
      removeSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const setFacing = (f: Facing) => setScenario(s => ({ ...s, camera: { ...s.camera, facing: f } }));

  const save = () => {
    saveScenario(scenario);
    refreshList();
    setStatus(`Saved "${scenario.name}".`);
    setTimeout(() => setStatus(null), 2000);
  };

  const load = (id: string) => {
    const s = loadScenario(id);
    if (s) { setScenario(s); setSelectedId(null); setPitchPicker(false); }
  };

  const startNew = () => { setScenario(blankScenario(scenario.kind)); setSelectedId(null); };

  const remove = (id: string) => {
    deleteScenario(id);
    refreshList();
    if (scenario.id === id) startNew();
  };

  // Where to float the on-canvas delete button — the selected player's own
  // screen position, converted from the canvas's backing-store pixels to a
  // CSS percentage so it tracks the canvas's own responsive `width: 100%`.
  const selectedPlayer = scenario.players.find(p => p.id === selectedId);
  let deleteButtonPct: { left: number; top: number } | null = null;
  if (selectedPlayer && selectedId !== "you" && !pitchPicker && canvasRef.current) {
    const canvas = canvasRef.current;
    const s = pxFromPitch(selectedPlayer.x, selectedPlayer.y, canvas.width, canvas.height, camVp(), facing());
    deleteButtonPct = { left: (s.px / canvas.width) * 100, top: (s.py / canvas.height) * 100 };
  }

  const teammateCount = scenario.players.filter(p => p.side === "teammate").length;
  const opponentCount = scenario.players.filter(p => p.side === "opponent").length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── The pitch, with player-add controls beside it — using the space
          the narrow portrait canvas would otherwise leave empty. ── */}
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-row sm:flex-col gap-1.5 sm:w-28 shrink-0">
            <button onClick={() => addSide("teammate")} className="flex-1 sm:flex-none rounded-lg bg-sky-600 py-1.5 text-[11px] font-black text-white hover:bg-sky-500">+ Teammate</button>
            <button onClick={() => addSide("opponent")} className="flex-1 sm:flex-none rounded-lg bg-red-600 py-1.5 text-[11px] font-black text-white hover:bg-red-500">+ Opponent</button>
            <button
              onClick={removeSelected}
              disabled={!selectedId || selectedId === "you"}
              className="flex-1 sm:flex-none rounded-lg bg-gray-700 py-1.5 text-[10px] font-black text-white/80 hover:bg-gray-600 disabled:opacity-40"
            >
              Remove
            </button>
            <div className="hidden sm:block text-[9px] text-white/50">
              {teammateCount} mate(s)<br />{opponentCount} opp(s)
            </div>
          </div>

          <div className="relative mx-auto w-full" style={{ maxWidth: 420 }}>
            <canvas
              ref={canvasRef}
              style={{ width: "100%", aspectRatio: `${VIEW_ASPECT}`, touchAction: "none" }}
              className="select-none rounded-lg"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            />
            {deleteButtonPct && (
              <button
                onClick={removeSelected}
                aria-label="Delete selected player"
                className="absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 border-white/80 bg-red-600 text-xs font-black text-white shadow-lg hover:bg-red-500"
                style={{ left: `${deleteButtonPct.left}%`, top: `calc(${deleteButtonPct.top}% - 12px)` }}
              >
                ✕
              </button>
            )}
            {pitchPicker && (
              <div className="pointer-events-none absolute inset-x-0 top-1 z-10 flex justify-center">
                <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black text-amber-300">
                  Drag anywhere — release to set the camera there
                </span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 px-1 text-[10px] font-bold text-white/70">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.you }} /> You</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.teammate }} /> Teammate</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.opponent }} /> Opponent</span>
            </div>
            <div className="mt-1 px-1 text-[10px] text-white/50">
              {pitchPicker ? "Drag to move the camera's frame." : "Drag a player to place him, tap him then ✕ to remove him."}
            </div>
          </div>
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
          <div className="text-[10px] font-black uppercase tracking-wide text-white/60">Camera framing</div>

          <button
            onClick={() => setPitchPicker(v => !v)}
            className={`mt-2 w-full rounded-lg py-1.5 text-[11px] font-black uppercase transition ${
              pitchPicker ? "bg-amber-400 text-amber-950" : "bg-gray-700 text-white/80 hover:bg-gray-600"}`}
          >
            {pitchPicker ? "Done — back to editing" : "Pick on the whole pitch"}
          </button>

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
