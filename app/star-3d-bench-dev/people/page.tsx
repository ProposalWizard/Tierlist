"use client";
/**
 * THE BENCH'S PEOPLE SHEET (Harry, 20 Nov 2026: "if we give a lot of preset options at least
 * we can pre build all cut scenes"). Every person preset (lib/star/people/presets.ts) drawn by
 * the game's own toon renderer, one card each, labelled, on one contact sheet; and the same
 * slots as the game draws them today, for before and after. Nothing here is in the game yet.
 *
 *   ?set=staff         managers, staff, agents, press and fans (each preset as written)
 *   ?set=players       the 48 player presets, in several clubs' kits
 *   ?set=today-staff   the staff slots as today's game draws a manager (who: "signing-manager")
 *   ?set=today-players the player slots as today's game draws a team-mate (seeded by id)
 *   ?set=closeup       every Black and mixed-race preset, head and shoulders (hair, beard, features)
 *   ?set=scene         five typical scenes (boss, chairman, agent, journalist, manager) cast by castScene
 *   ?cols=8 ?w=230 ?h=330   card grid and size        ?view=34|front
 * window.__sheetDone is true when every card is drawn (stills: node scripts/bench3d/people-sheet.mjs).
 */
import { useEffect, useRef, useState } from "react";
import type { PersonLookResult } from "@/lib/star/people/presets";

const SKIN_LABEL = ["Porcelain", "Fair", "Light", "Tan", "Olive", "Brown", "Deep", "Dark"];
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Newcastle United", "Aston Villa", "Everton", "Wrexham", "Brighton & Hove Albion"];

interface Card { title: string; sub: string; look: PersonLookResult | null; today?: { who: string; suit: boolean; skin: string; hair: string; kit?: { shirt: string; trim: string } } }

export default function BenchPeoplePage() {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading…");
  useEffect(() => {
    let dead = false;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const set = q.get("set") ?? "staff";
      const cols = Number(q.get("cols") ?? 8), CW = Number(q.get("w") ?? 230), CH = Number(q.get("h") ?? 330);
      const view = q.get("view") === "front" ? 0 : -0.45;
      const PR = await import("@/lib/star/people/presets");
      const { kitsOf } = await import("@/lib/star/kits");
      const { managerFor } = await import("@/components/star/Office3D");
      const { toonPickFor } = await import("@/lib/star/style3d/toon/bodies");

      // the cards
      const cards: Card[] = [];
      if (set === "staff" || set === "today-staff") {
        PR.STAFF_PRESETS.forEach((p) => {
          const role = p.roles[0];
          const look = PR.presetLook(p, p.id, role, { club: CLUBS[cards.length % CLUBS.length], exact: true });
          if (set === "staff") cards.push({ title: p.name, sub: `${PR.HERITAGE[p.heritage].label.split(" (")[0].split(" /")[0]} · ${role} · ${look.age}`, look });
          else {
            // today: every manager is "signing-manager" (signing3dScene.ts:329); only skin and hair follow his name
            const m = managerFor(p.name);
            const kit = p.roles.includes("manager") ? kitsOf(CLUBS[cards.length % CLUBS.length]).home : undefined;
            cards.push({ title: p.name, sub: "today", look: null, today: { who: "signing-manager", suit: true, skin: m.skin, hair: m.hairColour, kit } });
          }
        });
      } else if (set === "players" || set === "today-players") {
        PR.PLAYER_PRESETS.forEach((p, i) => {
          const club = CLUBS[Math.floor(i / 6) % CLUBS.length];
          const look = PR.presetLook(p, p.id, "player", { club, exact: true });
          if (set === "players") cards.push({ title: p.name.split(" · ")[0], sub: `${p.name.split(" · ").slice(1).join(" · ")} · ${club.split(" ")[0]}`, look });
          else {
            const t = toonPickFor(`${club}#${i}`);
            cards.push({ title: `${club.split(" ")[0]} #${i + 1}`, sub: "today", look: null, today: { who: `${club}#${i}`, suit: false, skin: t.skin, hair: t.hair, kit: kitsOf(club).home } });
          }
        });
      } else if (set === "closeup") {
        // every Black and mixed-race preset, head and shoulders (Harry: their hair, beards and features must read right)
        PR.ALL_PRESETS.filter((p) => p.heritage === "black" || p.heritage === "mixed").forEach((p, i) => {
          const role = p.roles[0];
          const look = PR.presetLook(p, p.id, role, { club: CLUBS[i % CLUBS.length], exact: true });
          cards.push({ title: p.name.split(" · ")[0], sub: `${p.heritage} · ${p.texture} · ${SKIN_LABEL[p.skin]} · ${role}`, look });
        });
      } else {
        // five scenes of the five people who share a cut scene, cast together
        ["Arsenal", "Wrexham", "Everton", "Chelsea", "Aston Villa"].forEach((club, k) => {
          const s = PR.castScene([
            { id: `boss-${club}`, role: "manager", club }, { id: `chairman-${club}`, role: "staff", club }, { id: `agent-${k}`, role: "agent", club },
            { id: `journalist-${k}`, role: "journalist", club }, { id: `manager-${club}`, role: "manager", club },
          ]);
          ["boss", "chairman", "agent", "journalist", "manager"].forEach((w, j) => cards.push({ title: `${club.split(" ")[0]}: ${w}`, sub: s[j].presetName, look: s[j] }));
        });
      }

      // the renderer and the people
      const T = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
      const P3 = await import("@/lib/star/people3d");
      const { addToonFace, toonFaceFor } = await import("@/lib/star/style3d/toon/face");
      const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
      const { TOON_HEADS } = await import("@/lib/star/style3d/toon/bodies");
      if (dead || !box.current) return;
      const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as never;
      const loader = await withMeshopt(new GLTFLoader());
      const anims = await P3.loadPeople3d(loader, "anims", "new");
      const all = await P3.loadPeople3d(loader, "player", "new", TOON_HEADS);
      const rows = Math.ceil(cards.length / cols);
      const sheet = document.createElement("canvas");
      sheet.width = cols * CW; sheet.height = rows * CH;
      sheet.style.width = "100%"; sheet.style.maxWidth = `${cols * CW}px`;
      box.current.appendChild(sheet);
      const g2 = sheet.getContext("2d")!;
      g2.fillStyle = "#1a1d22"; g2.fillRect(0, 0, sheet.width, sheet.height);

      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(CW, CH - 44);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.setClearColor("#cfd6de");
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight("#dfe8f5", "#5d6b46", 1.25));
      const sun = new T.DirectionalLight("#fff0dc", 2.2); sun.position.set(1.5, 4, 3.5); scene.add(sun);
      setToonRim(T, { color: "#fff1dd", strength: 0.5, from: [-0.35, 0.55, -1] });
      // head to knee, a touch from his right: a lens camera at chest height
      const cam = new T.PerspectiveCamera(24, CW / (CH - 44), 0.1, 40);
      if (set === "closeup") { cam.position.set(0, 1.7, 2.05); cam.lookAt(0, 1.58, 0); } else { cam.position.set(0, 1.46, 3.45); cam.lookAt(0, 1.31, 0); }

      for (let i = 0; i < cards.length; i++) {
        if (dead) return;
        const c = cards[i];
        setStatus(`drawing ${i + 1} / ${cards.length}`);
        const L = c.look;
        const p = L
          ? P3.makePerson3d(T, SK, all, anims, { outline: 0.006, toonHead: L.head, toonBody: L.build, who: L.id })
          : P3.makePerson3d(T, SK, all, anims, { outline: 0.006, who: c.today!.who, suit: c.today!.suit });
        if (L) P3.dressPerson3d(T, p, L.dress);
        else P3.dressPerson3d(T, p, { skin: c.today!.skin, hair: c.today!.hair, kit: c.today!.kit, accessories: [{ slot: "boots", color: "#141416" }] });
        const face = addToonFace(T, p);
        const suitish = L ? !!L.suit : c.today!.suit;
        const clip = suitish && p.actions["boss-idle"] ? "boss-idle" : p.actions.idle ? "idle" : Object.keys(p.actions)[0];
        P3.poseClips(p, [[clip, 1.2, 1]]);
        p.root.rotation.y = view;
        p.root.updateMatrixWorld(true);
        if (p.bones.Hips) { const hp = new T.Vector3(); p.bones.Hips.getWorldPosition(hp); p.root.position.x -= hp.x; p.root.position.z -= hp.z; p.root.updateMatrixWorld(true); }
        face?.set({ face: toonFaceFor({}), blink: 0 });
        scene.add(p.root);
        renderer.render(scene, cam);
        const x = (i % cols) * CW, y = Math.floor(i / cols) * CH;
        g2.drawImage(renderer.domElement, x, y);
        g2.fillStyle = "#101216"; g2.fillRect(x, y + CH - 44, CW, 44);
        g2.fillStyle = "#ffffff"; g2.font = "bold 15px system-ui, sans-serif"; g2.fillText(c.title, x + 8, y + CH - 25, CW - 14);
        g2.fillStyle = "#9aa3ad"; g2.font = "12px system-ui, sans-serif"; g2.fillText(c.sub, x + 8, y + CH - 9, CW - 14);
        g2.strokeStyle = "#000"; g2.strokeRect(x + 0.5, y + 0.5, CW - 1, CH - 1);
        scene.remove(p.root);
        p.root.traverse((o) => { const m = o as import("three").Mesh; if (m.isMesh) { (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm?.dispose()); } });
        await new Promise((r) => setTimeout(r, 0));
      }
      setStatus(`${cards.length} people`);
      (window as unknown as { __sheetDone?: boolean }).__sheetDone = true;
    })().catch((e) => { console.error(e); setStatus(`failed: ${String(e)}`); });
    return () => { dead = true; };
  }, []);
  return (
    <div style={{ background: "#0d0f12", minHeight: "100vh", color: "#fff", padding: 12, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }} id="sheet-status">People presets · {status}</div>
      <div ref={box} />
    </div>
  );
}
