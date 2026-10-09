/**
 * THE PEOPLE BENCH — /star-people-dev. Each proof drives the people layer
 * (people.ts) exactly as a cut-scene script would, in a plain Golden Hour
 * room, so the face, hands, props, reaches, look-at and handshake can be seen
 * and judged on their own. Not a cut scene itself: the director's scripts
 * (lib/star/cutscene/director*.ts) are the real scenes.
 */
import type * as THREE from "three";
import { makeCast, type Actor, type Cast, type ExpressionName, type HandPoseName, type CutProp } from "./people";
import { signaturePoints } from "./props";
import type { PersonModel } from "../people3d";
import type { CutscenePeopleLook } from "./look";

type Three = typeof import("three");

export type BenchProof = "faces" | "hands" | "sign" | "shake" | "shirt" | "trophy" | "goal" | "lineup" | "builds" | "rest" | "heads" | "bakeoff";

export interface BenchState {
  proof: BenchProof;
  model: PersonModel;
  skin: string;
  hair: string;
  expression: ExpressionName;
  hand: HandPoseName;
  /** Faces: turn the head this many degrees (0 = straight at the camera). */
  turn: number;
  look: CutscenePeopleLook;
}

export interface BenchHandle {
  set(s: Partial<BenchState>): Promise<void>;
  /** Hold the proof at t seconds (deterministic: no random blinks or darts). */
  hold(t: number): void;
  /** Play live from t. */
  play(t?: number): void;
  camera(pos: [number, number, number] | null, look?: [number, number, number], fov?: number): void;
  info(): Record<string, unknown>;
  dispose(): void;
}

const SIG_D = "M12 44 C 26 12, 38 12, 44 30 C 50 48, 58 48, 66 26 C 72 10, 84 14, 86 34 C 88 50, 100 48, 108 32 C 116 16, 130 18, 132 36 C 134 52, 148 50, 158 30 C 168 10, 184 14, 190 32 C 196 50, 212 48, 224 30 C 234 16, 250 16, 262 34 C 268 43, 278 46, 288 40";
const KIT = { shirt: "#b3202c", trim: "#f5f1e6", shorts: "#b3202c" };

export async function createPeopleBench(container: HTMLElement, init: BenchState): Promise<BenchHandle> {
  const T: Three = await import("three");
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = T.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.03, 80);

  // ── Golden hour room: a painted sky dome, warm floor, sun behind ──
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { top: { value: new T.Color("#5d7fb8") }, mid: { value: new T.Color("#e7a978") }, hor: { value: new T.Color("#ffcf8a") }, sunDir: { value: new T.Vector3(-0.45, 0.16, -0.88).normalize() } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform vec3 top, mid, hor, sunDir; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = mix(hor, mid, smoothstep(-0.02, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.7, h));
        float s = max(dot(vP, sunDir), 0.0); c += vec3(1.0, 0.75, 0.45) * (pow(s, 60.0) * 1.2 + pow(s, 6.0) * 0.25);
        c = mix(c, vec3(0.42, 0.32, 0.22), smoothstep(0.0, -0.08, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new T.Mesh(new T.SphereGeometry(40, 32, 16), skyMat);
  scene.add(sky);
  const floorMat = new T.MeshLambertMaterial({ color: "#8a6e52" });
  const floor = new T.Mesh(new T.CircleGeometry(12, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const hemi = new T.HemisphereLight("#ffd7a6", "#6b5a32", 1.15);
  scene.add(hemi);
  const sun = new T.DirectionalLight("#ffb36b", 2.4);
  sun.position.set(-2.4, 1.6, -4.5);
  scene.add(sun);
  const fill = new T.DirectionalLight("#fff0dc", 1.25);
  fill.position.set(1.6, 2.2, 3.2);
  scene.add(fill);

  // ── Furniture used by some proofs ──
  const wood = new T.MeshLambertMaterial({ color: "#6b4024" });
  const desk = new T.Group();
  const top = new T.Mesh(new T.BoxGeometry(1.2, 0.04, 0.62), wood); top.position.y = 0.74; desk.add(top);
  for (const [x, z] of [[-0.55, -0.26], [0.55, -0.26], [-0.55, 0.26], [0.55, 0.26]]) { const l = new T.Mesh(new T.BoxGeometry(0.05, 0.72, 0.05), wood); l.position.set(x, 0.36, z); desk.add(l); }
  desk.position.set(0, 0, 0.62);
  scene.add(desk);
  const chair = new T.Mesh(new T.BoxGeometry(0.46, 0.46, 0.44), new T.MeshLambertMaterial({ color: "#3b2a22" }));
  chair.position.set(0, 0.23, -0.12);
  scene.add(chair);
  const back = new T.Mesh(new T.BoxGeometry(0.46, 0.6, 0.06), new T.MeshLambertMaterial({ color: "#3b2a22" }));
  back.position.set(0, 0.76, -0.33);
  scene.add(back);

  const cast: Cast = await makeCast(T, scene, { look: init.look });
  cast.light.rimDir.copy(sun.position).normalize();
  let state: BenchState = { ...init };
  let actors: Actor[] = [];
  let props: CutProp[] = [];
  let extras: THREE.Object3D[] = [];
  let cam: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
  let tNow = 0, live = true, last = performance.now(), raf = 0;
  const sig = signaturePoints(SIG_D);

  const build = async () => {
    cast.clear();
    actors = []; props = [];
    const s = state;
    desk.visible = chair.visible = back.visible = s.proof === "sign";
    sky.visible = floor.visible = s.proof !== "rest";
    scene.background = s.proof === "rest" ? new T.Color("#6b6b70") : null;
    floorMat.color.set(s.proof === "goal" ? "#5aa63c" : "#8a6e52");
    const isMgr = s.model === "manager";
    const you = await cast.actor({ model: s.model, skin: s.skin, hair: s.hair, kit: isMgr ? undefined : KIT, grey: 0.6, beard: isMgr ? 0.8 : 0, name: "you" });
    actors.push(you);
    if (s.proof === "lineup" || s.proof === "builds" || s.proof === "heads") {
      you.root.visible = false;
      const { npcPerson } = await import("../human3d/npc");
      const list = s.proof === "lineup"
        ? ["manager:1", "manager:2", "manager:3", "manager:4", "chairman:5", "journalist:6", "fan:7", "manager:8"]
        : s.proof === "heads" ? ["head:buzz", "head:short", "head:crop", "head:side", "head:slick", "head:curly", "head:long", "head:receding"]
        : ["build:lean", "build:base", "build:muscle", "build:heavy", "build:short", "build:tall", "build:keeper", "build:old"];
      for (let i = 0; i < list.length; i++) {
        const id = list[i];
        const [role, seed] = id.split(":");
        const npc = npcPerson(role, seed);
        const a = await cast.actor({ ...npc.actor, name: id });
        a.root.position.set((i - (list.length - 1) / 2) * 0.72, 0, 0);
        actors.push(a);
      }
    }
    if (s.proof === "bakeoff") {
      // TEMP bake-off: A = image-to-3D mesh, B = raw MakeHuman default male, C = ours (you).
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const ld = new GLTFLoader();
      extras.forEach((o) => o.removeFromParent()); extras = [];
      for (const [url, x] of [["/star/_bakeoff/higgs.glb", -0.85], ["/star/_bakeoff/mhbase.glb", 0]] as [string, number][]) {
        // The benchmark files are not in the repo (scratch copies only): without them, C stands alone.
        const g = await ld.loadAsync(url).catch(() => null);
        if (!g) continue;
        const o = g.scene;
        const box = new T.Box3().setFromObject(o);
        const k = 1.8 / (box.max.y - box.min.y);
        const piv = new T.Group();
        o.scale.setScalar(k);
        const c = box.getCenter(new T.Vector3());
        o.position.set(-c.x * k, -box.min.y * k, -c.z * k);
        piv.add(o); piv.position.x = x;
        o.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh) { mm.frustumCulled = false; (mm.material as THREE.MeshStandardMaterial).metalness = 0; } });
        scene.add(piv); extras.push(piv);
      }
      you.root.position.x = 0.85;
    }
    if (s.proof === "shake") {
      const boss = await cast.actor({ model: "manager", skin: "#c68642", hair: "#3a2a20", grey: 0.55, beard: 0.85, name: "boss" });
      boss.root.position.set(0, 0, 0.9); boss.root.rotation.y = Math.PI;
      actors.push(boss);
    }
    if (s.proof === "sign") {
      const contract = cast.prop("contract", { contract: { club: "Knowitball FC", playerName: "Your Player", managerName: "The Boss", rows: [["Seasons", "2"], ["Wage", "★35 a week"], ["Shirt", "#9"]], shirt: KIT.shirt, trim: KIT.trim }, signature: sig });
      contract.obj.position.set(0.02, 0.762, 0.47); contract.obj.rotation.y = Math.PI;
      const pen = cast.prop("pen");
      props.push(contract, pen);
    }
    if (s.proof === "shirt") props.push(cast.prop("shirt", { kit: KIT, name: "Player", number: 9 }));
    if (s.proof === "trophy") props.push(cast.prop("trophy"));
    if (s.proof === "goal") await cast.addClips(you, "/star/anims3d/football.glb").catch(() => undefined);
  };

  /** One proof's script at time t (tracks only change when they need to). */
  const script = (t: number, dt: number) => {
    const s = state;
    const [you, boss] = actors;
    const v3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
    switch (s.proof) {
      case "faces": {
        you.clips = [["idle", 1.2, 1]];
        you.root.rotation.y = (s.turn * Math.PI) / 180;
        if (!cam) { const e = you.eyes(); setCam([e.x, e.y - 0.005, e.z + 0.62], [e.x, e.y - 0.02, e.z], 22); }
        you.look({ camera: true }, { head: 0.15, fade: 0 });
        break;
      }
      case "hands": {
        you.clips = [["idle", 1.2, 1]];
        you.reach("R", v3(-0.08, 1.32, 0.34), { along: v3(0.15, 1, 0.1), palm: v3(0, 0, 1), fade: 0 });
        you.hand("R", s.hand, 0);
        you.look({ actor: you, part: "R" }, { fade: 0 });
        if (!cam) setCam([-0.12, 1.36, 0.82], [-0.08, 1.33, 0.3], 20);
        break;
      }
      case "sign": {
        const [contract, pen] = props;
        // Sat at the desk (the upright part of the seated clip).
        you.clips = [["sitidle", 0.45, 1]];
        you.root.position.set(0, 0, -0.06);
        you.lean = 0.28;
        const w0 = 0.9, w1 = 3.3;
        const k = Math.max(0, Math.min(1, (t - w0) / (w1 - w0)));
        contract.setInk!(k, t > w1 + 0.25);
        const sigAt = (kk: number) => new T.Vector3(...contract.sigPoint!(kk)).applyMatrix4(contract.obj.matrixWorld);
        const lift = t < w0 ? 0.02 * (1 - t / w0) + 0.004 : t > w1 ? Math.min(0.06, (t - w1) * 0.12) : 0.0005 + 0.002 * Math.max(0, Math.sin(k * 40)) * 0;
        const nib = () => sigAt(t < w0 ? 0 : k).add(v3(0, lift, 0));
        you.carry("R", pen, "write", 0);
        you.aim("R", pen, "tip", nib, { along: you.dir(0.42, -0.5, 0.75), palm: you.dir(0.55, -0.8, 0.1), pole: you.dir(-0.85, -0.45, -0.2), fade: 0 });
        you.grab("L", contract, "steady", { fade: 0 });
        if (t < w1 + 0.3) { you.look({ prop: pen, point: "tip" }, { head: 0.9, fade: 0.2 }); you.expression("determined", 0.4); }
        else { you.look({ camera: true }, { head: 0.8, fade: 0.45 }); you.expression("proud", 0.5); }
        if (!cam) setCam([0.75, 1.45, 1.35], [0, 0.95, 0.38], 32);
        break;
      }
      case "shake": {
        you.clips = [["idle", 1.0 + t * 0.6, 1]];
        boss.clips = [["boss-idle", 2.0 + t * 0.6, 1]];
        if (t > 0.3) cast.handshake(you, boss, { pump: t > 1.0 && t < 2.6 ? 1 : 0, fade: 0.5 });
        you.expression("smile", 0.4); boss.expression("smile", 0.4);
        if (t < 3) { you.look({ actor: boss }, { head: 0.8 }); boss.look({ actor: you }, { head: 0.8 }); }
        else { you.look({ camera: true }, { head: 0.7, fade: 0.4 }); boss.look({ camera: true }, { head: 0.7, fade: 0.5 }); }
        if (!cam) setCam([1.9, 1.45, 0.45], [0, 1.18, 0.45], 34);
        break;
      }
      case "shirt": {
        const [shirt] = props;
        you.clips = [["idle", 1.0 + t * 0.6, 1]];
        const lift = Math.min(1, t / 0.8);
        shirt.obj.position.set(0, 1.0 + 0.24 * lift, 0.3);
        shirt.obj.rotation.set(-0.06, 0, 0);
        you.grab("L", shirt, "shoulderL", { fade: 0 }); you.grab("R", shirt, "shoulderR", { fade: 0 });
        you.expression(t > 1.2 ? "proud" : "smile", 0.5);
        you.look({ camera: true }, { head: 0.6 });
        if (!cam) setCam([0.1, 1.42, 2.2], [0, 1.32, 0], 30);
        break;
      }
      case "trophy": {
        const [tr] = props;
        you.clips = [["idle", 1.0 + t * 0.6, 1]];
        const up = Math.min(1, Math.max(0, (t - 0.4) / 1.0));
        const e = up * up * (3 - 2 * up);
        tr.obj.position.set(0, 1.05 + 0.95 * e, 0.3 - 0.18 * e);
        you.grab("L", tr, "handleL", { fade: 0 }); you.grab("R", tr, "handleR", { fade: 0 });
        you.expression(t > 1.2 ? "roar" : "joy", 0.4);
        you.look(t > 1.0 ? { prop: tr, point: "top" } : { camera: true }, { head: 0.7 });
        if (!cam) setCam([0.4, 1.35, 2.6], [0, 1.45, 0], 36);
        break;
      }
      case "bakeoff": {
        you.clips = [];
        you.root.rotation.y = (s.turn * Math.PI) / 180;
        for (const e of extras) e.rotation.y = (s.turn * Math.PI) / 180;
        if (!cam) setCam([0, 1.0, 9], [0, 0.95, 0], 22);
        break;
      }
      case "rest": {
        you.clips = [];
        you.root.rotation.y = (s.turn * Math.PI) / 180;
        if (!cam) setCam([0, 0.92, 24], [0, 0.92, 0], 4.8);
        break;
      }
      case "heads": {
        for (let i = 1; i < actors.length; i++) { const a = actors[i]; a.clips = [["idle", 1 + i * 0.7, 1]]; a.look({ camera: true }, { head: 0.6 }); }
        if (!cam) setCam([0, 1.62, 3.3], [0, 1.5, 0], 30);
        break;
      }
      case "lineup": case "builds": {
        for (let i = 1; i < actors.length; i++) { const a = actors[i]; a.clips = [[a.name.startsWith("build") ? "idle" : "boss-idle", 1 + i * 0.7 + t * 0.6, 1]]; a.look({ camera: true }, { head: 0.3 }); }
        if (!cam) setCam([0, 1.05, 6.4], [0, 0.95, 0], 40);
        break;
      }
      case "goal": {
        // Knees: hips down, knees on the grass, shins back, chest up and arched, arms wide.
        const k = Math.min(1, t / 0.9);
        const e = k * k * (3 - 2 * k);
        you.clips = [["idle", 1.0, 1]];
        you.hips = [0, -0.42 * e, -0.05 * e];
        you.lean = -0.32 * e;
        for (const sd of [-1, 1]) {
          const side = sd > 0 ? "L" : "R";
          you.foot(side, you.at(sd * 0.13, 0.07, -0.4), you.dir(0, -0.2, 1), 0);
          you.reach(side, you.at(sd * 0.72, 1.22 - 0.42 * e + 0.2, 0.2), { along: you.dir(sd, 0.35, 0.25), palm: you.dir(0, 0.35, 1), fade: 0 });
          you.hand(side, "wave", 0.2);
        }
        you.expression(t < 0.6 ? "effort" : "roar", 0.35);
        you.look({ point: v3(0, 2.2, 3) }, { head: 0.6 });
        if (!cam) setCam([0.35, 0.42, 1.55], [0, 0.95, 0], 38);
        break;
      }
    }
    void dt;
  };

  const setCam = (pos: [number, number, number], look: [number, number, number], fov: number) => {
    camera.position.set(...pos); camera.lookAt(new T.Vector3(...look)); camera.fov = fov; camera.updateProjectionMatrix();
  };
  const applyCam = () => {
    if (cam) { camera.position.copy(cam.pos); camera.lookAt(cam.look); camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  };

  const frame = (dt: number) => {
    tNow += dt;
    applyCam();
    if (!cam) { /* each proof sets its own camera */ }
    camera.updateMatrixWorld();
    script(tNow, dt);
    applyCam();
    camera.updateMatrixWorld();
    cast.update(dt, camera);
    renderer.render(scene, camera);
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!live) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frame(dt);
  };

  await build();
  frame(0.016);
  loop();

  const onResize = () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  return {
    async set(s) {
      const rebuild = s.proof !== undefined && s.proof !== state.proof || s.model !== undefined && s.model !== state.model || s.skin !== undefined && s.skin !== state.skin || s.hair !== undefined && s.hair !== state.hair;
      state = { ...state, ...s };
      if (s.look && s.look !== cast.look) { cast.setLook(s.look); await build(); tNow = 0; return; }
      if (rebuild) { await build(); tNow = 0; }
      if (s.expression) for (const a of actors) a.expression(s.expression, 0.3);
    },
    hold(t) {
      live = false;
      for (const a of actors) a.autoBlink = false;
      tNow = 0;
      const n = Math.max(1, Math.round(t / 0.02));
      for (let i = 0; i < n; i++) { tNow += 0.02; applyCam(); camera.updateMatrixWorld(); script(tNow, 0.02); applyCam(); camera.updateMatrixWorld(); cast.update(0.02, camera); }
      renderer.render(scene, camera);
    },
    play(t = 0) { tNow = t; live = true; last = performance.now(); for (const a of actors) a.autoBlink = true; },
    camera(pos, look, fov) { cam = pos ? { pos: new T.Vector3(...pos), look: new T.Vector3(...(look ?? [0, 1.6, 0])), fov: fov ?? 30 } : null; },
    info() { return { heads: [...extras.map((e) => { const b = new T.Box3().setFromObject(e); return [b.min.x, b.max.y, b.max.z]; })], eyes: actors[0]?.eyes().toArray(), t: tNow, actors: actors.map((a) => a.name), face: actors[0]?.currentFace() }; },
    dispose() { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); cast.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
