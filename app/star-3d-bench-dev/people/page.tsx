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
 *   ?set=hair          every modelled hairstyle (lib/star/style3d/toon/hair.ts) on three skin tones, front, three-quarter and back
 *                      (?styles=locsLong,afro  ?base=h3|m2|h7|h8|h9|m3  ?views=front,34,back,side)
 *   ?set=faces         the face types (lib/star/style3d/toon/faceShape.ts): 28 faces, front and three-quarter, same light, several skin tones
 *   ?set=swing         one person turning and nodding his head, the loose hair swinging (hair.ts update): ?hair=locsLong ?base=h3 ?tone=6
 *                      plays live; window.__swingFrame(i) draws frame i of 30 a second (film: node scripts/bench3d/hair-swing.mjs OUTDIR)
 *   ?set=faceids       THE FACE SYSTEM (style3d/toon/faceId.ts): 28 generated people, 4 of each heritage, front and three-quarter, each with
 *                      his own drawn face. ?faceid=0 the same people as before it (the painted faces)  ?zoom=1 the face only  ?n=28
 *                      ?emotions=<person 0..27> one face in the 8 emotions  ?sliders=<person> the mould's sliders, each at its two ends
 *                      ?beards=1,9 each way to wear facial hair on those people  ?eyes=9,1 the 8 eye shapes on those people  ?allheads=9 his FaceId on each head
 *                      ?perf=22 the drawn face's cost: ms a frame with and without it, 1 close up and 22 in two rows (window.__facePerf)
 *                      ?detail=0.5 (a phone's detail)  ?views=front,34  ?players=1 players only
 *   ?set=faceplay      one face changing emotion, blinking and glancing (window.__faceFrame(i), 30 a second; film: scripts/bench3d/face-film.mjs)
 *   ?set=heads         the head shapes (the two hair heads and the four re-shaped ones), front, three-quarter and side
 *   ?cols=8 ?w=230 ?h=330   card grid and size        ?view=34|front        ?faceid=1 the staff, players, closeup and scene sets with each person's FaceId
 * window.__sheetDone is true when every card is drawn (stills: node scripts/bench3d/people-sheet.mjs).
 */
import { useEffect, useRef, useState } from "react";
import type { PersonLookResult } from "@/lib/star/people/presets";
import type { PersonLook, Person3D } from "@/lib/star/people3d";
import type { ToonBody, ToonHead } from "@/lib/star/style3d/toon/bodies";
import type { ToonHair } from "@/lib/star/style3d/toon/hairStyles";
import type { ToonFaceId } from "@/lib/star/style3d/toon/faceShape";
import type { FaceId, EmotionName } from "@/lib/star/style3d/toon/faceId";

const SKIN_LABEL = ["Porcelain", "Fair", "Light", "Tan", "Olive", "Brown", "Deep", "Dark"];
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Newcastle United", "Aston Villa", "Everton", "Wrexham", "Brighton & Hove Albion"];

interface Card {
  title: string; sub: string; look: PersonLookResult | null;
  today?: { who: string; suit: boolean; skin: string; hair: string; kit?: { shirt: string; trim: string } };
  /** A head dressed by hand (the hair and head-shape sheets). */
  raw?: { head: ToonHead; build: ToonBody; dress: PersonLook; hair?: ToonHair; yaw: number; face?: ToonFaceId };
  /** The face system (set=faceids): this card's turn, whether his FaceId is put on, his emotion, a change to his FaceId. */
  fid?: { yaw: number; on: boolean; emotion?: EmotionName; mod?: (f: FaceId) => FaceId };
}

/**
 * The swing test: one man, his head turned left and right, nodded, then his whole body turned,
 * the same moves every time (frame i is 1/30 s after frame i - 1), so a film is the same film.
 */
async function swingPage(box: HTMLDivElement, q: URLSearchParams, dead: () => boolean, setStatus: (s: string) => void) {
  const T = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
  const P3 = await import("@/lib/star/people3d");
  const PR = await import("@/lib/star/people/presets");
  const HAIR = await import("@/lib/star/style3d/toon/hair");
  const { kitsOf } = await import("@/lib/star/kits");
  const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
  const { addToonFace, toonFaceFor } = await import("@/lib/star/style3d/toon/face");
  const hairId = (q.get("hair") ?? "locsLong") as ToonHair, base = (q.get("base") ?? "h3") as ToonHead, tone = Number(q.get("tone") ?? 6);
  const still = q.get("still") === "1";   // the same film with the swing off, to compare
  const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as never;
  const loader = await withMeshopt(new GLTFLoader());
  const anims = await P3.loadPeople3d(loader, "anims", "new");
  const all = await P3.loadPeople3d(loader, "player", "new", [base]);
  const W = Number(q.get("w") ?? 390), H = Number(q.get("h") ?? 700);
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.setClearColor("#cfd6de");
  // one canvas (a dev build runs this twice): the last one made is the one __swingFrame draws
  box.querySelectorAll("#swing-canvas").forEach((c) => c.remove());
  renderer.domElement.id = "swing-canvas";
  box.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight("#dfe8f5", "#5d6b46", 1.25));
  const sun = new T.DirectionalLight("#fff0dc", 2.2); sun.position.set(1.5, 4, 3.5); scene.add(sun);
  setToonRim(T, { color: "#fff1dd", strength: 0.5, from: [-0.35, 0.55, -1] });
  const cam = new T.PerspectiveCamera(24, W / H, 0.1, 40);
  cam.position.set(0.25, 1.62, 2.7); cam.lookAt(0, 1.5, 0);
  const p = P3.makePerson3d(T, SK, all, anims, { outline: 0.006, toonHead: base, toonBody: "c2", who: "swing" });
  P3.dressPerson3d(T, p, { skin: PR.toonSkinHex(tone), hair: "#1f1a17", hairCut: { scalp: 0, beard: 1, stubble: 0 }, kit: kitsOf("Arsenal").home, accessories: [{ slot: "boots", color: "#141416" }] } as PersonLook);
  const face = addToonFace(T, p);
  face?.set({ face: toonFaceFor({}), blink: 0 });
  const hair = await HAIR.wearToonHair(T, loader, p, hairId, { outline: 0.0045 });
  scene.add(p.root);
  const ease = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  const clip = p.actions.idle ? "idle" : Object.keys(p.actions)[0];
  const frame = (i: number) => {
    const t = i / 30;
    // head: left, right, centre, a nod; then the whole man turns his back and comes round again
    const yaw = 0.95 * (ease(0.5, 0.75, t) - 2 * ease(1.5, 1.8, t) + ease(2.6, 2.85, t));
    const nod = 0.45 * (ease(3.0, 3.2, t) - ease(3.5, 3.7, t));
    const turn = Math.PI * (ease(4.1, 4.6, t) - ease(5.4, 5.9, t)) - 0.3;
    P3.poseClips(p, [[clip, 1.2 + t * 0.4, 1]]);
    p.bones.neck?.rotateY(yaw * 0.4); p.bones.Head?.rotateY(yaw * 0.6);
    p.bones.neck?.rotateX(nod * 0.4); p.bones.Head?.rotateX(nod * 0.6);
    p.root.rotation.y = turn;
    p.root.updateMatrixWorld(true);
    if (!still) hair?.update(1 / 30);
    renderer.render(scene, cam);
  };
  frame(0);
  (window as unknown as { __swingFrame?: (i: number) => void; __sheetDone?: boolean }).__swingFrame = frame;
  (window as unknown as { __sheetDone?: boolean }).__sheetDone = true;
  setStatus(`swing: ${hairId} on ${base}${hair?.swings ? "" : " (this style has no loose hair)"}`);
  // live: three's own render loop (this page keeps no animation loop of its own)
  if (q.get("play") !== "0") { let i = 0; renderer.setAnimationLoop(() => { if (dead()) { renderer.setAnimationLoop(null); return; } frame(i++ % 195); }); }
}

/** The face system's people: generated ids (as the game makes them), the first `n / 7` of each heritage, grouped by heritage. */
function facePeople(PR: typeof import("@/lib/star/people/presets"), n: number, playersOnly = false): PersonLookResult[] {
  const HER = ["black", "mixed", "white", "southAsian", "eastAsian", "mena", "latin"] as const;
  const per = Math.max(1, Math.round(n / HER.length));
  const got: Record<string, PersonLookResult[]> = {};
  const roles = ["player", "player", "manager", "player", "staff", "player", "journalist", "fan"] as const;
  for (let i = 0; i < 4000; i++) {
    const role = playersOnly ? "player" : roles[i % roles.length];
    const l = PR.personLook(`face-${i}`, role, { club: CLUBS[i % CLUBS.length] });
    const h = PR.presetById(l.preset)!.heritage;
    if ((got[h] ??= []).length < per) got[h].push(l);
    if (HER.every((k) => (got[k]?.length ?? 0) >= per)) break;
  }
  return HER.flatMap((h) => got[h] ?? []);
}

/**
 * One face changing emotion: 1.2 s held on each of the eight, 0.5 s moving between, natural blinks
 * and small glances on top. Frame i is 1/30 s after frame i − 1 (the same film every time).
 */
async function facePlayPage(box: HTMLDivElement, q: URLSearchParams, dead: () => boolean, setStatus: (s: string) => void) {
  const T = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
  const P3 = await import("@/lib/star/people3d");
  const PR = await import("@/lib/star/people/presets");
  const HAIR = await import("@/lib/star/style3d/toon/hair");
  const FI = await import("@/lib/star/style3d/toon/faceId");
  const { applyToonFaceId } = await import("@/lib/star/style3d/toon/faceIdApply");
  const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
  const { addToonFace, blinkAt, wanderGaze } = await import("@/lib/star/style3d/toon/face");
  const L = facePeople(PR, 28)[Number(q.get("person") ?? 0) % 28];
  const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as never;
  const loader = await withMeshopt(new GLTFLoader());
  const anims = await P3.loadPeople3d(loader, "anims", "new");
  const all = await P3.loadPeople3d(loader, "player", "new", [L.head]);
  const W = Number(q.get("w") ?? 540), H = Number(q.get("h") ?? 600);
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.setClearColor("#cfd6de");
  box.querySelectorAll("#swing-canvas").forEach((c) => c.remove());
  renderer.domElement.id = "swing-canvas";
  box.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight("#dfe8f5", "#5d6b46", 1.25));
  const sun = new T.DirectionalLight("#fff0dc", 2.2); sun.position.set(1.5, 4, 3.5); scene.add(sun);
  setToonRim(T, { color: "#fff1dd", strength: 0.5, from: [-0.35, 0.55, -1] });
  const cam = new T.PerspectiveCamera(24, W / H, 0.1, 40);
  const p = P3.makePerson3d(T, SK, all, anims, { outline: 0.006, toonHead: L.head, toonBody: L.build, who: L.id });
  P3.dressPerson3d(T, p, L.dress);
  applyToonFaceId(T, p, L.faceId, { detail: Number(q.get("detail") ?? 1) });
  const face = addToonFace(T, p);
  if (L.hairMesh) await HAIR.wearToonHair(T, loader, p, L.hairMesh, { outline: 0.0045 });
  scene.add(p.root);
  const clip = L.suit && p.actions["boss-idle"] ? "boss-idle" : p.actions.idle ? "idle" : Object.keys(p.actions)[0];
  const HOLD = 1.2, MOVE = 0.5, STEP = HOLD + MOVE;
  const frames = Math.round(FI.EMOTION_NAMES.length * STEP * 30);
  const frame = (i: number) => {
    const t = i / 30;
    const k = Math.floor(t / STEP) % FI.EMOTION_NAMES.length, into = t - Math.floor(t / STEP) * STEP;
    const a = FI.EMOTION_NAMES[k], b = FI.EMOTION_NAMES[(k + 1) % FI.EMOTION_NAMES.length];
    const m = Math.max(0, Math.min(1, (into - HOLD) / MOVE)), e = m * m * (3 - 2 * m);
    const w = { [a]: 1 - e, [b]: e } as Partial<Record<EmotionName, number>>;
    const g0 = wanderGaze(t, 5), g1 = FI.emotionGaze(w);
    // (one held pose: the film is about the face)
    P3.poseClips(p, [[clip, 1.2, 1]]);
    p.root.rotation.y = -0.3;
    p.root.updateMatrixWorld(true);
    face?.set({ face: FI.blendEmotions(w), blink: blinkAt(t, 3), gaze: [g0[0] * 0.35 + g1[0], g0[1] * 0.35 + g1[1]] });
    const hp = new T.Vector3(); p.bones.Head.getWorldPosition(hp);
    cam.position.set(hp.x, hp.y + 0.06, hp.z + 1.05); cam.lookAt(hp.x, hp.y + 0.03, hp.z + 0.04);
    renderer.render(scene, cam);
    return e < 0.5 ? a : b;
  };
  frame(0);
  const win = window as unknown as { __faceFrame?: (i: number) => string; __faceFrames?: number; __sheetDone?: boolean };
  win.__faceFrame = frame; win.__faceFrames = frames; win.__sheetDone = true;
  setStatus(`face play: ${L.presetName} (${frames} frames)`);
  // live: three's own render loop (this page keeps no animation loop of its own)
  if (q.get("play") !== "0") { let i = 0; renderer.setAnimationLoop(() => { if (dead()) { renderer.setAnimationLoop(null); return; } frame(i++ % frames); }); }
}

export default function BenchPeoplePage() {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading…");
  useEffect(() => {
    let dead = false;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const set = q.get("set") ?? "staff";
      const close = set === "closeup" || set === "hair" || set === "heads" || set === "faces" || set === "faceids";
      const zoom = q.get("zoom") === "1";
      const cols = Number(q.get("cols") ?? (set === "hair" ? 9 : set === "heads" ? 6 : 8)), CW = Number(q.get("w") ?? (close ? 250 : 230)), CH = Number(q.get("h") ?? 330);
      const view = q.get("view") === "front" ? 0 : -0.45;
      const PR = await import("@/lib/star/people/presets");
      if (set === "swing") { await swingPage(box.current!, q, () => dead, setStatus); return; }
      if (set === "faceplay") { await facePlayPage(box.current!, q, () => dead, setStatus); return; }
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
      } else if (set === "faceids") {
        const FI = await import("@/lib/star/style3d/toon/faceId");
        const people = facePeople(PR, Number(q.get("n") ?? 28), q.get("players") === "1");
        const on = q.get("faceid") !== "0";
        const YAW: Record<string, number> = { front: -0.27, "34": -0.95, side: -1.6 };
        const label = (l: PersonLookResult) => `${PR.HERITAGE[PR.presetById(l.preset)!.heritage].label.split(" (")[0].split(" /")[0]} · ${SKIN_LABEL[["porcelain", "fair", "light", "tan", "olive", "brown", "deep", "dark"].indexOf(l.skinId)]}`;
        const what = (f: FaceId) => `${f.faceBuild} · ${f.eyeShape} ${f.irisName} · ${f.beardStyle}`;
        if (q.get("emotions") !== null) {
          const l = people[Number(q.get("emotions")) % people.length];
          FI.EMOTION_NAMES.forEach((e) => cards.push({ title: e[0].toUpperCase() + e.slice(1), sub: label(l), look: l, fid: { yaw: -0.25, on: true, emotion: e } }));
        } else if (q.get("beards") !== null) {
          // every way to wear facial hair, on these people (the same faces, only the beard changed)
          for (const k of q.get("beards")!.split(",").map(Number)) {
            const l = people[k % people.length];
            FI.BEARD_STYLE_NAMES.filter((b) => b !== "none").forEach((b) => (q.get("views")?.split(",") ?? ["front"]).forEach((v) => cards.push({ title: b, sub: `${label(l)} · ${v === "34" ? "three-quarter" : v}`, look: l, fid: { yaw: YAW[v] ?? 0, on: true, mod: (f) => ({ ...f, ...FI.BEARD_STYLES[b] }) } })));
          }
        } else if (q.get("eyes") !== null) {
          // the 8 eye shapes on the same faces (they must read apart on a 120 px card)
          for (const k of q.get("eyes")!.split(",").map(Number)) {
            const l = people[k % people.length];
            FI.EYE_SHAPE_NAMES.forEach((e) => cards.push({ title: e, sub: label(l), look: l, fid: { yaw: -0.2, on: true, mod: (f) => ({ ...f, ...FI.eyeOfShape(e), irisR: 0.0076 }) } }));
          }
        } else if (q.get("allheads") !== null) {
          // one person's FaceId on each of the 12 heads (which heads read as a lean adult)
          const l = people[Number(q.get("allheads")) % people.length];
          const heads = (q.get("heads")?.split(",") ?? ["h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8", "h9", "m1", "m2", "m3"]) as ToonHead[];
          for (const head of heads) for (const v of q.get("views")?.split(",") ?? ["front", "34"])
            cards.push({ title: `${head} · ${l.faceId.faceBuild}`, sub: v, look: { ...l, head, hairMesh: undefined }, fid: { yaw: YAW[v], on: true } });
        } else if (q.get("sliders") !== null) {
          const l = people[Number(q.get("sliders")) % people.length];
          const S = FI.FACE_LIMITS.shape;
          const zero = (f: FaceId): FaceId => ({ ...f, shape: { ...f.shape, jawW: 0, chinLen: 0, chinW: 0, cheek: 0, full: 0, noseW: 0, noseLen: 0, noseBridge: 0, noseTip: 0, faceLen: 0, faceW: 0, taper: 0, lips: 0, browRidge: 0 } });
          const rows: [string, (keyof typeof S)[]][] = [["Jaw width", ["faceW", "jawW"]], ["Chin", ["chinLen", "chinW"]], ["Cheeks", ["cheek", "full"]], ["Nose width", ["noseW"]], ["Nose length", ["noseLen"]], ["Nose bridge and tip", ["noseBridge", "noseTip"]], ["Face length", ["faceLen"]], ["Jaw taper", ["taper"]]];
          for (const [name, keys] of rows) for (const end of [0, -1, 1]) for (const v of ["front", "34"]) {
            const mod = (f: FaceId): FaceId => { const z = zero(f); if (end !== 0) for (const k of keys) (z.shape as unknown as Record<string, number>)[k] = S[k][end < 0 ? 0 : 1]; return z; };
            cards.push({ title: `${name}: ${end === 0 ? "middle" : end < 0 ? "least" : "most"}`, sub: v === "34" ? "three-quarter" : v, look: l, fid: { yaw: YAW[v], on: true, mod } });
          }
        } else {
          const views = q.get("views")?.split(",") ?? ["front", "34"];
          people.forEach((l) => views.forEach((v) => cards.push({ title: on ? what(l.faceId) : l.presetName.split(" · ")[0], sub: `${label(l)} · ${l.role} · ${l.age}`, look: l, fid: { yaw: YAW[v] ?? 0, on } })));
        }
      } else if (set === "closeup") {
        // every Black and mixed-race preset, head and shoulders (Harry: their hair, beards and features must read right)
        PR.ALL_PRESETS.filter((p) => p.heritage === "black" || p.heritage === "mixed").forEach((p, i) => {
          const role = p.roles[0];
          const look = PR.presetLook(p, p.id, role, { club: CLUBS[i % CLUBS.length], exact: true });
          cards.push({ title: p.name.split(" · ")[0], sub: `${p.heritage} · ${p.texture} · ${SKIN_LABEL[p.skin]} · ${role}`, look });
        });
      } else if (set === "hair" || set === "heads" || set === "faces") {
        const HS = await import("@/lib/star/style3d/toon/hairStyles");
        const { MANAGER_HAIR_COLOURS } = await import("@/lib/star/managerFace");
        const YAW: Record<string, number> = { front: 0, "34": -0.62, back: Math.PI, side: -Math.PI / 2 };
        const SUIT = { coat: "#1f2533", trousers: "#232733", shirt: "#eef0f2", tie: "#7a1d2b", shoes: "#141416" };
        const dressFor = (head: ToonHead, skin: number, hair: string, cut: { scalp: number; beard: number; stubble: number }, club: string): PersonLook =>
          ({ skin: PR.toonSkinHex(skin), hair, grey: 0, hairCut: cut, browDark: PR.toonBrowDark((Object.keys(MANAGER_HAIR_COLOURS) as (keyof typeof MANAGER_HAIR_COLOURS)[]).find((k) => MANAGER_HAIR_COLOURS[k] === hair) ?? "fair", hair === "#8d8985" ? 0.6 : 0), ...(head.startsWith("m") ? { suit: SUIT } : { kit: kitsOf(club).home }), accessories: [{ slot: "boots", color: "#141416" }] }) as PersonLook;
        if (set === "hair") {
          const base = (q.get("base") ?? "h3") as ToonHead;
          const styles = (q.get("styles")?.split(",") ?? HS.TOON_HAIRS) as ToonHair[];
          const views = q.get("views")?.split(",") ?? ["front", "34", "back"];
          styles.forEach((hair, si) => {
            const info = HS.TOON_HAIR_INFO[hair];
            const coily = info.textures[0] === "coily", curly = info.textures[0] === "curly", old = info.scalp > 0;
            const tones = coily ? [4, 6, 7] : curly ? [3, 4, 5] : old ? [1, 4, 6] : [0, 2, 4];
            const cols3 = coily || curly ? ["black", "darkBrown", "black"] : old ? ["fair", "black", "black"] : ["blond", "brown", "black"];
            tones.forEach((tone, ti) => {
              const col = MANAGER_HAIR_COLOURS[cols3[ti] as keyof typeof MANAGER_HAIR_COLOURS];
              const hex = old ? `#${[1, 3, 5].map((k) => Math.round(parseInt(col.slice(k, k + 2), 16) * 0.35 + 201 * 0.65).toString(16).padStart(2, "0")).join("")}` : col;
              const cut = { scalp: info.scalp, beard: ti === 0 ? 0 : 1, stubble: ti === 2 ? 0.7 : 0 };
              views.forEach((v) => cards.push({ title: `${info.label}`, sub: `${base} · ${SKIN_LABEL[tone]} · ${v === "34" ? "three-quarter" : v}`, look: null,
                raw: { head: base, build: (["c1", "c2", "c3"] as const)[(si + ti) % 3], dress: dressFor(base, tone, hex, cut, CLUBS[(si + ti) % CLUBS.length]), hair, yaw: YAW[v] ?? 0 } }));
            });
          });
        } else if (set === "faces") {
          const FS = await import("@/lib/star/style3d/toon/faceShape");
          // every face type on the Buzz head, clean-shaven, then faces on the other heads; the skin a tone its heritage has
          const TONE: Record<string, number> = { base: 3, a1: 6, a2: 7, a3: 5, c1: 4, s1: 4, s2: 3, e1: 2, e2: 1, e3: 2, m1: 3, m2: 2, l1: 3, l2: 2, w1: 0, w2: 1, w3: 0, w4: 1, x1: 2 };
          // each wears a haircut, beard and hair colour his heritage's presets have (not one shared hairline)
          const WEAR: Record<string, [ToonHair | null, string, "clean" | "as" | "stubble"]> = {
            base: [null, "black", "clean"], a1: ["locsShort", "black", "as"], a2: ["twists", "black", "clean"], a3: ["afro", "black", "as"], c1: ["curlyTop", "darkBrown", "stubble"],
            s1: ["slickBack", "black", "stubble"], s2: ["crew", "black", "clean"], e1: ["crew", "black", "clean"], e2: ["ponytail", "black", "clean"], e3: ["slickBack", "darkBrown", "clean"],
            m1: ["slickBack", "black", "as"], m2: ["crew", "darkBrown", "as"], l1: ["manBun", "black", "stubble"], l2: ["mullet", "darkBrown", "clean"],
            w1: ["crew", "blond", "clean"], w2: ["thinning", "fair", "stubble"], w3: ["mullet", "ginger", "clean"], w4: ["slickBack", "darkBrown", "as"], x1: ["ponytail", "brown", "stubble"],
          };
          const list: [ToonHead, ToonFaceId, number][] = [
            ...FS.TOON_FACE_IDS.map((f) => ["h3", f, TONE[f] ?? 3] as [ToonHead, ToonFaceId, number]),
            ["h7", "w4", 1], ["h8", "w1", 0], ["h9", "a3", 6], ["h8", "a2", 7], ["m2", "m1", 3], ["m3", "w2", 1], ["h9", "s2", 4], ["h1", "c1", 4], ["h2", "w3", 0], ["h5", "e1", 2],
          ];
          list.forEach(([head, face, tone], i) => {
            const [hair0, colour, beard] = WEAR[face] ?? [null, "black", "clean"];
            // the second time a face is shown (on another head) it wears that head's own cut
            const hair = i < FS.TOON_FACE_IDS.length && HS.toonHairFits(head) ? hair0 : null;
            const hex = head.startsWith("m") ? "#8d8985" : MANAGER_HAIR_COLOURS[colour as keyof typeof MANAGER_HAIR_COLOURS];
            const cut = { scalp: hair ? HS.TOON_HAIR_INFO[hair].scalp : 0, beard: beard === "as" ? 0 : 1, stubble: beard === "stubble" ? 0.7 : 0 };
            for (const v of ["front", "34"]) cards.push({ title: `${face} · ${FS.TOON_FACE_TYPES[face].label}`, sub: `${head} · ${SKIN_LABEL[tone]} · ${v === "34" ? "three-quarter" : v}`, look: null,
              raw: { head, build: "c2", dress: dressFor(head, tone, hex, cut, CLUBS[i % CLUBS.length]), hair: hair ?? undefined, yaw: YAW[v], face } });
          });
        } else {
          const { TOON_HEAD_LABEL } = await import("@/lib/star/style3d/toon/bodies");
          const heads = (q.get("heads")?.split(",") ?? ["h3", "h7", "h8", "h9", "m2", "m3"]) as ToonHead[];
          const tone = Number(q.get("tone") ?? 5);
          const hairPick = q.get("hair") as ToonHair | null;
          heads.forEach((head, hi) => {
            const suit = head.startsWith("m");
            for (const cutName of ["clean", "as"] as const) {
              const cut = cutName === "clean" ? { scalp: 0, beard: 1, stubble: 0 } : { scalp: 0, beard: 0, stubble: 0 };
              for (const v of ["front", "34", "side"]) cards.push({ title: TOON_HEAD_LABEL[head], sub: `${head} · ${cutName === "clean" ? "clean-shaven" : "beard"} · ${v === "34" ? "three-quarter" : v}`, look: null,
                raw: { head, build: "c2", dress: dressFor(head, tone, suit ? "#8d8985" : "#1f1a17", cut, CLUBS[hi % CLUBS.length]), hair: hairPick ?? undefined, yaw: YAW[v] } });
            }
          });
        }
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
      const { TOON_ALL_HEADS } = await import("@/lib/star/style3d/toon/bodies");
      const HAIR = await import("@/lib/star/style3d/toon/hair");
      const { applyToonFaceShape } = await import("@/lib/star/style3d/toon/faceShapeApply");
      const { applyToonFaceId } = await import("@/lib/star/style3d/toon/faceIdApply");
      const FIE = await import("@/lib/star/style3d/toon/faceId");
      const detail = Number(q.get("detail") ?? 1);
      if (dead || !box.current) return;
      const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as never;
      const loader = await withMeshopt(new GLTFLoader());
      const anims = await P3.loadPeople3d(loader, "anims", "new");
      const need = new Set<ToonHead>(set.startsWith("today") ? TOON_ALL_HEADS.slice(0, 8) : []);
      for (const c of cards) { if (c.look) need.add(c.look.head); if (c.raw) need.add(c.raw.head); }
      const all = await P3.loadPeople3d(loader, "player", "new", Array.from(need));
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
      if (set === "faces") { cam.position.set(0, 1.74, 1.5); cam.lookAt(0, 1.685, 0); }
      else if (set === "hair" || set === "heads") { cam.position.set(0, 1.76, 1.85); cam.lookAt(0, 1.69, 0); }
      else if (set === "closeup") { cam.position.set(0, 1.7, 2.05); cam.lookAt(0, 1.58, 0); } else { cam.position.set(0, 1.46, 3.45); cam.lookAt(0, 1.31, 0); }

      if (set === "faceids" && q.get("perf") !== null) {
        // THE FACE SHADER'S COST: the same people drawn with and without their FaceId, 1 close up and N in two rows,
        // each timed over ?frames=12 frames, the best of two goes (the GPU made to finish before the clock is read)
        const n = Number(q.get("perf")) || 22, W = Number(q.get("w") ?? 960), H = Number(q.get("h") ?? 540), F = Number(q.get("frames") ?? 12);
        renderer.setSize(W, H); cam.aspect = W / H;
        box.current.replaceChildren(renderer.domElement);
        const squad = facePeople(PR, 28, true);
        const gl = renderer.getContext(), px = new Uint8Array(4);
        const run = async (count: number, on: boolean): Promise<number> => {
          const made: Person3D[] = [];
          for (let i = 0; i < count; i++) {
            const L = squad[i % squad.length];
            const p = P3.makePerson3d(T, SK, all, anims, { outline: 0.006, toonHead: L.head, toonBody: L.build, who: L.id });
            P3.dressPerson3d(T, p, L.dress);
            if (on) applyToonFaceId(T, p, L.faceId, { detail }); else applyToonFaceShape(T, p, L.face, L.faceK);
            addToonFace(T, p)?.set({ face: toonFaceFor({}), blink: 0 });
            P3.poseClips(p, [[p.actions.idle ? "idle" : Object.keys(p.actions)[0], 1.2, 1]]);
            const per = Math.ceil(count / 2);
            p.root.position.set(count === 1 ? 0 : ((i % per) - (per - 1) / 2) * 0.62, 0, count === 1 ? 0 : i < per ? 0.5 : -0.5);
            p.root.updateMatrixWorld(true);
            scene.add(p.root); made.push(p);
          }
          if (count === 1) { const hp = new T.Vector3(); made[0].bones.Head!.getWorldPosition(hp); cam.fov = 9.5; cam.position.set(hp.x, hp.y + 0.06, hp.z + 1.25); cam.lookAt(hp.x, hp.y + 0.035, hp.z + 0.04); }
          else { cam.fov = 24; cam.position.set(0, 1.5, 8.6); cam.lookAt(0, 1.0, 0); }
          cam.updateProjectionMatrix();
          for (let k = 0; k < 2; k++) renderer.render(scene, cam);
          gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const t0 = performance.now();
          for (let k = 0; k < F; k++) renderer.render(scene, cam);
          gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const ms = (performance.now() - t0) / F;
          setStatus(`${count} ${on ? "drawn" : "painted"}: ${ms.toFixed(1)} ms`); console.log(`FSDBG ${count} ${on} ${ms.toFixed(2)}`);
          await new Promise((r) => setTimeout(r, 0));
          if (!(q.get("keep") === `${count}` && on)) for (const p of made) { scene.remove(p.root); p.root.traverse((o) => { const m = o as import("three").Mesh; if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm?.dispose()); }); }
          return Math.round(ms * 100) / 100;
        };
        const out: Record<string, number> = {};
        for (const count of [1, n]) for (const on of [false, true, false, true]) { const key = `${count} ${on ? "drawn" : "painted"}`; const ms = await run(count, on); out[key] = out[key] === undefined ? ms : Math.min(out[key], ms); }
        (window as unknown as { __facePerf?: unknown }).__facePerf = out;
        setStatus(`face shader, ms a frame at ${W}x${H}: ${JSON.stringify(out)}`);
        (window as unknown as { __sheetDone?: boolean }).__sheetDone = true;
        return;
      }

      for (let i = 0; i < cards.length; i++) {
        if (dead) return;
        const c = cards[i];
        setStatus(`drawing ${i + 1} / ${cards.length}`);
        const L = c.look;
        const R = c.raw;
        const p = L
          ? P3.makePerson3d(T, SK, all, anims, { outline: 0.006, toonHead: L.head, toonBody: L.build, who: L.id })
          : R ? P3.makePerson3d(T, SK, all, anims, { outline: 0.006, toonHead: R.head, toonBody: R.build, who: `raw-${i}` })
          : P3.makePerson3d(T, SK, all, anims, { outline: 0.006, who: c.today!.who, suit: c.today!.suit });
        if (L) P3.dressPerson3d(T, p, L.dress);
        else if (R) P3.dressPerson3d(T, p, R.dress);
        else P3.dressPerson3d(T, p, { skin: c.today!.skin, hair: c.today!.hair, kit: c.today!.kit, accessories: [{ slot: "boots", color: "#141416" }] });
        if (L && (c.fid?.on || (!c.fid && q.get("faceid") === "1"))) applyToonFaceId(T, p, c.fid?.mod ? c.fid.mod(L.faceId) : L.faceId, { detail });
        else if (L) applyToonFaceShape(T, p, L.face, L.faceK);
        else if (R?.face) applyToonFaceShape(T, p, R.face, 1);
        const face = addToonFace(T, p);
        const hairId = R?.hair ?? L?.hairMesh;
        const worn = hairId ? await HAIR.wearToonHair(T, loader, p, hairId, { outline: 0.0045 }) : null;
        const suitish = L ? !!L.suit : R ? !!R.dress.suit : c.today!.suit;
        const clip = suitish && p.actions["boss-idle"] ? "boss-idle" : p.actions.idle ? "idle" : Object.keys(p.actions)[0];
        P3.poseClips(p, [[clip, 1.2, 1]]);
        p.root.rotation.y = c.fid ? c.fid.yaw : R ? R.yaw : view;
        p.root.updateMatrixWorld(true);
        if (p.bones.Hips) { const hp = new T.Vector3(); p.bones.Hips.getWorldPosition(hp); p.root.position.x -= hp.x; p.root.position.z -= hp.z; p.root.updateMatrixWorld(true); }
        face?.set({ face: toonFaceFor({}), blink: 0 });
        if (c.fid?.emotion) face?.set({ face: FIE.blendEmotions({ [c.fid.emotion]: 1 }), gaze: FIE.EMOTION_GAZE[c.fid.emotion] });
        if (c.fid && p.bones.Head) {
          // the face system's cards aim at this person's own head (builds and heads differ in height)
          const hp = new T.Vector3(); p.bones.Head.getWorldPosition(hp);
          // (the close-up through a long lens, so the face is not bent by the camera)
          const dist = zoom ? 2.3 : 1.5;
          cam.fov = zoom ? 9.5 : 24; cam.updateProjectionMatrix();
          cam.position.set(hp.x, hp.y + 0.06, hp.z + dist); cam.lookAt(hp.x, hp.y + (zoom ? 0.035 : 0.0), hp.z + 0.04);
        }
        scene.add(p.root);
        renderer.render(scene, cam);
        const x = (i % cols) * CW, y = Math.floor(i / cols) * CH;
        g2.drawImage(renderer.domElement, x, y);
        g2.fillStyle = "#101216"; g2.fillRect(x, y + CH - 44, CW, 44);
        g2.fillStyle = "#ffffff"; g2.font = "bold 15px system-ui, sans-serif"; g2.fillText(c.title, x + 8, y + CH - 25, CW - 14);
        g2.fillStyle = "#9aa3ad"; g2.font = "12px system-ui, sans-serif"; g2.fillText(c.sub, x + 8, y + CH - 9, CW - 14);
        g2.strokeStyle = "#000"; g2.strokeRect(x + 0.5, y + 0.5, CW - 1, CH - 1);
        scene.remove(p.root);
        worn?.dispose();
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
