"use client";
/**
 * THE BENCH'S HAIR SHEET (the barber, lib/star/barber.ts). YOUR player as every place builds him (home3d/wear.ts
 * buildWearer, the kit), wearing a barber's cut and a beard step, one card per cut × view, with and without the
 * cap, to check by eye that no hair floats, gaps or passes through the head or the cap. Nothing here is saved.
 *
 *   ?cuts=afro:0,crew:2,locsLong:3,slickBack:1        the rows: barber style id : beard step (0 clean … 3 beard)
 *   ?grow=buzz:coily:1                                rows instead: that style cut at week 0, seen at weeks 0, 6, 12 (and 18)
 *   ?head=h1..h6  ?skin=deep  ?hair=black            your own head (the cut is worn on its close-cut skull), skin, hair colour
 *   ?views=hfront,h34,hside,hback,full                each card's framing   ?cap=0,1  without and with the cap
 *   ?cols= ?w=240 ?h=300
 * window.__sheetDone is true when every card is drawn.
 */
import { useEffect, useRef, useState } from "react";

export default function HairBench() {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading…");
  useEffect(() => {
    let dead = false;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      (globalThis as { __hairDebug?: boolean }).__hairDebug = !!q.get("debug");
      const T = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
      const { buildWearer } = await import("@/lib/star/home3d/wear");
      const { accessoryLook, bootLookOf } = await import("@/lib/star/wearables");
      const { setToonYou } = await import("@/lib/star/style3d/toon/bodies");
      const { kitsOf } = await import("@/lib/star/kits");
      const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
      const { wearYourHair } = await import("@/lib/star/style3d/toon/yourHair");
      const BB = await import("@/lib/star/barber");
      const { SKIN_TONES, HAIR_COLOURS } = await import("@/lib/star/playerIdentity");
      const head = (q.get("head") ?? "h1") as import("@/lib/star/style3d/toon/bodies").ToonHead;
      const skin = SKIN_TONES.find((s) => s.id === (q.get("skin") ?? "deep"))?.hex ?? SKIN_TONES[6].hex;
      const hairHex = HAIR_COLOURS.find((h) => h.id === (q.get("hair") ?? "black"))?.hex ?? HAIR_COLOURS[0].hex;
      const views = (q.get("views") ?? "hfront,h34,hside,hback").split(",");
      const caps = (q.get("cap") ?? "0,1").split(",").map((x) => x === "1");
      const W = Number(q.get("w") ?? 240), H = Number(q.get("h") ?? 300);
      // the rows: a style and a beard step each
      type Row = { label: string; style: import("@/lib/star/barber").HairStyleId; beard: number };
      let rowsIn: Row[] = [];
      const grow = q.get("grow");
      if (grow) {
        const [style, tex, b0] = grow.split(":");
        const hairS = BB.packHair({ style: style as never, texture: (tex ?? "coily") as never, beard0: Number(b0 ?? 0), cutWeek: 1, shaveWeek: 1 });
        for (const wk of (q.get("weeks") ?? "0,6,12").split(",").map(Number)) {
          const n = BB.hairNow({ hair: hairS, player: { skinTone: "deep" } as never, season: 1, week: 1 + wk }, head);
          rowsIn.push({ label: `week ${wk} · ${BB.STYLES[n.style].label} · ${BB.BEARD_LABEL[n.beard]}`, style: n.style, beard: n.beard });
        }
      } else {
        rowsIn = (q.get("cuts") ?? "afro:0,crew:2,locsLong:3,slickBack:1").split(",").map((x) => {
          const [s, b] = x.split(":");
          return { label: `${BB.STYLES[s as never] ? BB.STYLES[s as keyof typeof BB.STYLES].label : s} · ${BB.BEARD_LABEL[Number(b ?? 0)]}`, style: s as never, beard: Number(b ?? 0) };
        });
      }
      const cards: { label: string; row: number; cap: boolean; view: string }[] = [];
      rowsIn.forEach((r, ri) => { for (const cp of caps) for (const v of views) cards.push({ label: `${r.label}${cp ? " · cap" : ""} · ${v}`, row: ri, cap: cp, view: v }); });
      const cols = Number(q.get("cols") ?? caps.length * views.length);
      const rows = Math.ceil(cards.length / cols);
      const loader = await withMeshopt(new GLTFLoader());
      const kits = { home: kitsOf("Arsenal").home, away: kitsOf("Arsenal").away };
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(W * cols, H * rows);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.setScissorTest(true);
      box.current?.querySelectorAll("canvas").forEach((c) => c.remove());
      box.current?.appendChild(renderer.domElement);
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight("#dfe8f5", "#5a5244", 1.25));
      const sun = new T.DirectionalLight("#fff1dd", 2.3); sun.position.set(2.5, 4, 4); scene.add(sun);
      setToonRim(T, { color: "#fff1dd", strength: 0.5, from: [-0.35, 0.55, -1] });
      const capLook = accessoryLook("cap", Number(q.get("capl") ?? 3));
      const people = new Map<string, { p: Awaited<ReturnType<typeof buildWearer>>; at: number }>();
      let n = 0;
      const info: string[] = [];
      for (const c of cards) {
        const key = `${c.row}|${c.cap}`;
        if (people.has(key)) continue;
        const r = rowsIn[c.row];
        setStatus(`dressing ${r.label}${c.cap ? " with the cap" : ""}…`);
        const look = BB.hairLook3d(r.style, r.beard, head);
        setToonYou({ head, body: "c1", skin, hair: hairHex, name: "Player", hairLook: look });
        const worn = { kind: "kit" as const, kit: "home" as const, boots: "#141416", bootLook: bootLookOf({ id: "maestro-l4" } as never), extras: c.cap && capLook ? [capLook] : [] };
        const p = await buildWearer(T, SkU, loader, { worn, kits, number: null, skin, hair: hairHex, outline: 0.006, castShadow: false });
        const h = await wearYourHair(T, p);
        if (dead) return;
        const at = n++ * 3;
        p.root.position.set(at, 0, 0);
        p.root.rotation.y = 0.45;
        p.mixer.update(0);
        scene.add(p.root);
        p.root.updateMatrixWorld(true);
        people.set(key, { p, at });
        info.push(`${r.label}${c.cap ? " cap" : ""}: head ${p.toonHead}${h ? `, ${h.hair} ${h.mesh.geometry.getAttribute("position").count / 3 | 0} tris${(h.mesh.geometry as { capPressed?: boolean }).capPressed ? ` pressed ${(h.mesh.geometry as { capMoved?: number }).capMoved ?? 0}` : ""}` : ""} [${p.body.parent?.children.map((o) => o.name).join(",")}]`);
      }
      // the hair your player's own build put on comes in a moment later: let it land (and count every head's hair)
      await new Promise((r) => setTimeout(r, 800));
      if (dead) return;
      people.forEach(({ p }, k) => {
        const hs = (p.body.parent?.children.filter((o) => o.name === "ToonHair") ?? []) as import("three").SkinnedMesh[];
        if (hs.length !== 1) info.push(`${k}: ${hs.length} hair meshes`);
        if (q.get("debug")) {
          p.root.updateMatrixWorld(true);
          const hb = new T.Vector3(); p.bones.Head.getWorldPosition(hb);
          let top = -9; const pv = new T.Vector3();
          for (const m of hs) { const n = m.geometry.getAttribute("position").count; for (let i = 0; i < n; i++) { m.getVertexPosition(i, pv); pv.applyMatrix4(m.matrixWorld); top = Math.max(top, pv.y - hb.y); } }
          const acc = p.body.parent?.children.find((o) => o.name === "Accessories") as import("three").SkinnedMesh | undefined;
          let ctop = -9; if (acc) { const n = acc.geometry.getAttribute("position").count; for (let i = 0; i < n; i++) { acc.getVertexPosition(i, pv); pv.applyMatrix4(acc.matrixWorld); ctop = Math.max(ctop, pv.y - hb.y); } }
          info.push(`#${k} ${hs[0]?.uuid.slice(0, 6)} geoMaxY ${(() => { let b = -9; const a = hs[0]?.geometry.getAttribute("position"); if (a) for (let i = 0; i < a.count; i++) b = Math.max(b, a.getY(i)); return b.toFixed(3); })()} hair top ${top.toFixed(3)} cap top ${ctop.toFixed(3)} posType ${hs[0]?.geometry.getAttribute("position").array.constructor.name}`);
        }
      });
      const cam = new T.PerspectiveCamera(30, W / H, 0.02, 30);
      const v = new T.Vector3();
      const yaw = 0.45;
      cards.forEach((c, i) => {
        const { p, at } = people.get(`${c.row}|${c.cap}`)!;
        const AROUND: Record<string, [number, number, number]> = { hfront: [0, 0.03, 0.86], h34: [0.8, 0.06, 0.86], hside: [Math.PI / 2, 0.05, 0.86], hback: [Math.PI * 0.85, 0.08, 0.86], full: [0, 0.1, 3.6] };
        const [da, up, dist] = AROUND[c.view] ?? AROUND.hfront;
        p.bones.Head.getWorldPosition(v);
        const t = c.view === "full" ? new T.Vector3(at, 0.95, 0) : v.clone().add(new T.Vector3(0, 0.07, 0));
        cam.position.set(t.x + Math.sin(yaw + da) * dist, t.y + up, t.z + Math.cos(yaw + da) * dist);
        cam.lookAt(t);
        const x = (i % cols) * W, y = (rows - 1 - Math.floor(i / cols)) * H;
        renderer.setViewport(x, y, W, H); renderer.setScissor(x, y, W, H);
        renderer.setClearColor(i % 2 ? "#cfd6de" : "#c6ced8");
        renderer.clear();
        renderer.render(scene, cam);
      });
      const host = box.current!;
      host.querySelectorAll("[data-card-label]").forEach((e) => e.remove());
      cards.forEach((c, i) => {
        const d = document.createElement("div");
        d.dataset.cardLabel = "1";
        d.textContent = c.label;
        Object.assign(d.style, { position: "absolute", left: `${(i % cols) * W + 6}px`, top: `${Math.floor(i / cols) * H + 4}px`, font: "700 11px system-ui", color: "#1f2430", background: "rgba(255,255,255,.75)", padding: "1px 5px", borderRadius: "6px", maxWidth: `${W - 16}px` });
        host.appendChild(d);
      });
      setStatus(`${cards.length} cards · ${info.join(" · ")}`);
      (window as unknown as { __sheetDone?: boolean }).__sheetDone = true;
    })().catch((e) => { console.error(e); setStatus(`failed: ${String(e)}`); });
    return () => { dead = true; };
  }, []);
  return (
    <div style={{ background: "#11151c", minHeight: "100vh", color: "#e8ecf2", padding: 8 }}>
      <div style={{ font: "600 12px system-ui", marginBottom: 6 }} data-hair-status>{status}</div>
      <div ref={box} style={{ position: "relative" }} />
    </div>
  );
}
