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
import { BroadcastPage, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "../star-animations-dev/animations.css";
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
  const [group, setGroup] = useState(ANIM_TILES[0].group);
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

  const jump = (g: string) => { setGroup(g); document.querySelector(`[data-anim3d-group="${g}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <BroadcastPage title="3D Animations" sub="Every move the 3D match plays, at the match camera and the match size">
      <div className="anim-layout">
        <nav className="anim-rail" aria-label="Sections">
          <div className="anim-rail-label">Moves</div>
          {ANIM_TILES.map((g) => <button key={g.group} className="anim-railitem" aria-pressed={group === g.group} onClick={() => jump(g.group)}>{g.group}</button>)}
          <div className="anim-rail-label">Pages</div>
          <a className="anim-railitem" href="/star-3d-area-dev">3D test area</a>
          <a className="anim-railitem" href="/star-animations-dev">2D animations</a>
        </nav>
        <div className="anim-main">
          <div className="anim-bar">
            <button className="anim-play" aria-pressed={!playing} title={playing ? "Pause" : "Play"}
              onClick={() => { setPlaying((p) => !p); setScrub(tiles.map(() => null)); }}>{playing ? "❚❚" : "▶"}</button>
            <div className="anim-row"><Label>Speed</Label>{[1, 0.5, 0.25].map((s) => <Pill key={s} on={speed === s} onClick={() => setSpeed(s)}>{s === 1 ? "1×" : s === 0.5 ? "½×" : "¼×"}</Pill>)}</div>
            <span className="anim-sep" />
            <div className="anim-row"><Label>Size</Label><Pill on={zoom === 1} onClick={() => setZoom(1)}>Match size</Pill><Pill on={zoom === 3} onClick={() => setZoom(3)}>3× closer</Pill></div>
            <span className="anim-sep" />
            <div className="anim-row"><Label>Camera</Label><Pill on={facing === 0} onClick={() => setFacing(0)}>As you shoot</Pill><Pill on={facing === Math.PI / 2} onClick={() => setFacing(Math.PI / 2)}>Side on</Pill></div>
          </div>
          <Note>A man is 6% of a phone screen here, as in a real match. Each tile loops; its slider holds one frame.</Note>
          {status === "loading" && <Note>Loading the players and moves…</Note>}
          {status === "off" && <Note>This device could not load the 3D.</Note>}
          <div className="anim-sec"><h2>Every move</h2><i /><i /><i /></div>
          <div ref={box} className="relative w-full">
            <canvas ref={canvas} className="absolute left-0 top-0" style={{ pointerEvents: "none" }} />
            <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${TILE_W}px)` }}>
              {ANIM_TILES.flatMap((g) => g.tiles.map((t, k) => ({ g: g.group, t, first: k === 0 }))).map(({ g, t, first }, i) => {
                const inf = info[i];
                return (
                  <div key={`${g}-${t.label}`} data-anim3d-tile={t.label} data-anim3d-group={first ? g : undefined} style={{ width: TILE_W, height: TILE_H, scrollMarginTop: 60 }} className="relative border border-black/40">
                    <div className="absolute inset-x-0 top-0 bg-black/55 px-1 text-[12px] font-black italic uppercase leading-4">{g === "Keeper" ? "GK · " : ""}{t.label}</div>
                    <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 pb-0.5">
                      <input type="range" min={0} max={1} step={0.01} value={scrub[i] ?? 0} className="w-full" style={{ accentColor: "#d8ff3c" }} aria-label={`${t.label} frame`}
                        onChange={(e) => { const v = Number(e.target.value); setScrub((s) => s.map((x, j) => (j === i ? v : x))); }} />
                      <div className="text-[9px] text-white/80">{inf?.clip ?? (status === "ready" ? "no clip" : "")}{scrub[i] !== null && inf ? ` · ${(scrub[i]! * inf.duration).toFixed(2)} s` : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <PageGuide page="/star-anim3d-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}
