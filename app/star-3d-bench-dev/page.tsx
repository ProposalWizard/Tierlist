"use client";
/**
 * THE 3D BENCH — the same ten shots at phone size, each with its frame
 * numbers, so every 3D step can show its before and after on the same
 * pictures (3D plan step 1). The shots are lib/star/bench3d.ts; the stills and
 * the skin numbers come from scripts/bench3d/shots.mts.
 */
import { useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, PanelGrid, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import { BENCH3D_SHOTS, benchUrl, type Bench3dShot } from "@/lib/star/bench3d";

interface Frame3d { fps: number; worstMs: number; draws: number; tris: number; skinnedDraws: number; posts: number; jsMs: number; pixelRatio: number; frames: number }

export default function Bench3dPage() {
  const [shot, setShot] = useState<Bench3dShot>(BENCH3D_SHOTS[0]);
  const [oldSkin, setOldSkin] = useState(false);
  const [probe, setProbe] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [f, setF] = useState<Frame3d | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const src = benchUrl(shot, { oldSkin });

  // the shot's own frame meter (window.__frame3d, lib/star/three3d/frameStats.ts), read twice a second
  useEffect(() => {
    setF(null);
    const id = window.setInterval(() => {
      try {
        const w = frame.current?.contentWindow as (Window & { __frame3d?: Frame3d; __toonSkin?: { probe(on: boolean): void } }) | null;
        if (w?.__frame3d) setF({ ...w.__frame3d });
        w?.__toonSkin?.probe(probe);
      } catch { /* not loaded yet */ }
    }, 500);
    return () => window.clearInterval(id);
  }, [src, nonce, probe]);

  return (
    <BroadcastPage title="3D bench" sub="The same ten 3D shots, at phone size, with their frame numbers. Every 3D change shows its before and after here.">
      <PageGuide page="/star-3d-bench-dev" corner="top-right" />
      <PanelGrid min={340}>
        <Panel title="Shots" note={`${BENCH3D_SHOTS.length}`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {BENCH3D_SHOTS.map((s) => <Pill key={s.id} on={s.id === shot.id} onClick={() => { setShot(s); setNonce((n) => n + 1); }}>{s.label}</Pill>)}
          </div>
          <div style={{ marginTop: 12 }}>
            <Label>Skin</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Pill on={!oldSkin} onClick={() => setOldSkin(false)}>Skin now</Pill>
              <Pill on={oldSkin} onClick={() => setOldSkin(true)}>Skin before (19 Oct)</Pill>
              <Pill on={probe} onClick={() => setProbe((p) => !p)}>Show the skin it measures</Pill>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Label>Frame numbers (this computer, no graphics chip: compare shots, not with a phone)</Label>
            {f ? (
              <table style={{ fontSize: 13, borderCollapse: "collapse" }}>
                <tbody>
                  {([
                    ["Frames a second", f.fps.toFixed(0)],
                    ["Slowest frame (last 2 s)", `${f.worstMs.toFixed(0)} ms`],
                    ["Draw calls", String(f.draws)],
                    ["Triangles", `${(f.tris / 1000).toFixed(0)}k`],
                    ["People drawn (skinned)", String(f.skinnedDraws)],
                    ["Post passes", String(f.posts)],
                    ["Script per frame", `${f.jsMs.toFixed(1)} ms`],
                    ["Pixel ratio", f.pixelRatio.toFixed(2)],
                  ] as [string, string][]).map(([k, v]) => <tr key={k}><td style={{ paddingRight: 14, opacity: 0.75 }}>{k}</td><td style={{ fontWeight: 800 }}>{v}</td></tr>)}
                </tbody>
              </table>
            ) : <Note>Loading the shot… (a 3D place takes 10–40 s here).</Note>}
          </div>
          <Note>{shot.t !== undefined ? `A cut scene, stopped at ${shot.t} s.` : "A live 3D place: it keeps moving."} Address: {src}</Note>
        </Panel>
        <Panel title={shot.label} note="390 × 844">
          <div style={{ width: 390, maxWidth: "100%", aspectRatio: "390 / 844", border: "1px solid rgba(255,255,255,.18)", borderRadius: 14, overflow: "hidden", background: "#000", margin: "0 auto" }}>
            <iframe key={`${src}#${nonce}`} ref={frame} src={src} title={shot.label} style={{ width: 390, height: 844, border: 0, transformOrigin: "0 0" }} />
          </div>
        </Panel>
      </PanelGrid>
    </BroadcastPage>
  );
}
