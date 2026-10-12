"use client";

/**
 * 3D ANIMATION TEST AREA — every move the 3D match plays, each looping on its
 * own tile at the real match camera and size (lib/star/style3d/animGrid3d.ts).
 *
 * Harry, 12 Oct 2026: "the animation suck for 3d players in game I think we
 * need to lay them out in the test area like we have for 2d". Laid out like
 * the 2D one (/star-animations-dev): a grid of looping tiles, a label and a
 * frame slider under each, play / pause and speed on top.
 *
 * No football is played here: one WebGL canvas draws every tile.
 * Filming: window.__frameStep (seek(t) puts every tile at t).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageGuide from "@/components/admin/PageGuide";
import { ANIM_TILES, type AnimGrid } from "@/lib/star/style3d/animGrid3d";

const TILE_W = 112, TILE_H = 150;

export default function Anim3dDevPage() {
  const tiles = useMemo(() => ANIM_TILES.flatMap((g) => g.tiles), []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const grid = useRef<AnimGrid | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");
  const [info, setInfo] = useState<{ clip: string | null; duration: number }[]>([]);
  const [cols, setCols] = useState(3);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [facing, setFacing] = useState(0);
  /** Each tile's own frame (0..1 of its clip) while paused or scrubbed; null = follows the clock. */
  const [scrub, setScrub] = useState<(number | null)[]>(() => tiles.map(() => null));
  const clock = useRef(0);
  const scrubRef = useRef(scrub); scrubRef.current = scrub;
  const infoRef = useRef(info); infoRef.current = info;

  useEffect(() => {
    const w = box.current?.clientWidth ?? 390;
    const c = Math.max(2, Math.floor(w / TILE_W));
    setCols(c);
    let dead = false;
    void import("@/lib/star/style3d/animGrid3d").then(({ createAnimGrid }) => createAnimGrid(canvas.current!, tiles, c, TILE_W, TILE_H))
      .then((g) => {
        if (dead) { g.dispose(); return; }
        grid.current = g; setInfo(g.info); setStatus("ready");
      })
      .catch((e) => { console.error("3D animation area failed", e); if (!dead) setStatus("off"); });
    return () => { dead = true; grid.current?.dispose(); grid.current = null; };
  }, [tiles]);

  const drawAt = (t: number) => {
    const g = grid.current; if (!g) return;
    const inf = infoRef.current;
    g.draw(tiles.map((_, i) => { const s = scrubRef.current[i]; return s !== null ? s * (inf[i]?.duration ?? 1) : t; }));
  };

  // the loop (3D only: no 2D canvas here)
  useEffect(() => {
    if (status !== "ready") return;
    grid.current?.setView({ zoom, yaw: facing });
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      if (playing) clock.current += ((now - last) / 1000) * speed;
      last = now;
      drawAt(clock.current);
      if (playing) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, playing, speed, zoom, facing, scrub]);

  // filming (scripts/film/frames3d.mjs): every tile at t
  useEffect(() => {
    if (status !== "ready") return;
    const w = window as unknown as { __frameStep?: unknown; __anim3dReady?: boolean };
    w.__frameStep = { duration: 3, seek: (t: number) => { setPlaying(false); clock.current = t; drawAt(t); } };
    w.__anim3dReady = true;
    return () => { w.__frameStep = undefined; w.__anim3dReady = undefined; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const chip = (on: boolean) => `rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-amber-400 text-black" : "bg-white/10 text-white"}`;
  return (
    <div className="min-h-screen bg-[#05070d] px-4 pb-24 pt-4 text-white">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/star-3d-area-dev" className="text-sm font-bold text-white/80">‹ 3D test area</Link>
        <h1 className="text-lg font-black">3D animations</h1>
      </div>
      <p className="mb-3 text-sm font-bold">Every move the 3D match plays, at the match camera and the match size (a man is 6% of a phone screen). Each tile loops; the slider under it holds one frame.</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button className={chip(playing)} onClick={() => { setPlaying((p) => !p); setScrub(tiles.map(() => null)); }}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
        {[1, 0.5, 0.25].map((s) => <button key={s} className={chip(speed === s)} onClick={() => setSpeed(s)}>{s === 1 ? "1×" : s === 0.5 ? "½×" : "¼×"}</button>)}
        <button className={chip(zoom === 1)} onClick={() => setZoom(1)}>Match size</button>
        <button className={chip(zoom === 3)} onClick={() => setZoom(3)}>3× closer</button>
        <button className={chip(facing === 0)} onClick={() => setFacing(0)}>As you shoot</button>
        <button className={chip(facing === Math.PI / 2)} onClick={() => setFacing(Math.PI / 2)}>Side on</button>
      </div>
      {status === "loading" && <p className="mb-2 text-sm font-bold text-amber-300">Loading the players and moves…</p>}
      {status === "off" && <p className="mb-2 text-sm font-bold text-red-400">This device could not load the 3D.</p>}
      <div ref={box} className="relative w-full">
        <canvas ref={canvas} className="absolute left-0 top-0" style={{ pointerEvents: "none" }} />
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${TILE_W}px)` }}>
          {ANIM_TILES.flatMap((g) => g.tiles.map((t) => ({ g: g.group, t }))).map(({ g, t }, i) => {
            const inf = info[i];
            return (
              <div key={`${g}-${t.label}`} data-anim3d-tile={t.label} style={{ width: TILE_W, height: TILE_H }} className="relative border border-black/40">
                <div className="absolute inset-x-0 top-0 bg-black/45 px-1 text-[10px] font-bold leading-4">{g === "Keeper" ? "GK · " : ""}{t.label}</div>
                <div className="absolute inset-x-0 bottom-0 bg-black/45 px-1 pb-0.5">
                  <input type="range" min={0} max={1} step={0.01} value={scrub[i] ?? 0} className="w-full" aria-label={`${t.label} frame`}
                    onChange={(e) => { const v = Number(e.target.value); setScrub((s) => s.map((x, j) => (j === i ? v : x))); }} />
                  <div className="text-[9px] text-white/80">{inf?.clip ?? (status === "ready" ? "no clip" : "")}{scrub[i] !== null && inf ? ` · ${(scrub[i]! * inf.duration).toFixed(2)} s` : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <PageGuide page="/star-anim3d-dev" corner="bottom-left" />
    </div>
  );
}
