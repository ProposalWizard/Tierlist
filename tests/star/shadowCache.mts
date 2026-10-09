import * as T from "three";
import { installShadowCache, classifyCasters, shadowBodyIndex, markShadowMoving, THRASH_REBUILDS } from "../../lib/star/three3d/shadowCache";

/**
 * THE SHADOW CACHE (lib/star/three3d/shadowCache.ts), with a counting fake of
 * three's shadow pass (no GPU): the still things are drawn into the map once,
 * a still frame redraws none of them, movers are drawn on top, and anything
 * that changes is redrawn.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

/** A stand-in for three's WebGLShadowMap.render: counts what each light's pass draws, and into which map. */
function fakeRenderer() {
  const log: { light: string; map: string; drew: string[] }[] = [];
  const sm: any = { enabled: true, autoUpdate: true, needsUpdate: false, type: T.PCFSoftShadowMap };
  sm.render = (lights: any[], scene: any) => {
    if (!sm.enabled) return;
    if (sm.autoUpdate === false && sm.needsUpdate === false) return;
    for (const l of lights) {
      const s = l.shadow;
      if (s.autoUpdate === false && s.needsUpdate === false) continue;
      if (!s.map) s.map = { texture: {}, width: s.mapSize.x, height: s.mapSize.y, dispose() {}, name: "three" };
      const drew: string[] = [];
      const walk = (o: any) => {
        if (!o.visible) return;
        if ((o.isMesh) && o.castShadow) { if (o === undefined) return; o.onBeforeShadow?.(null, o, null, s.camera); drew.push(o.name || (o.userData.shadowBody ? "body" : o.customDepthMaterial ? "restore" : "?")); }
        for (const c of o.children) walk(c);
      };
      walk(scene);
      log.push({ light: l.name, map: s.map.texture?.name ?? "?", drew });
      s.needsUpdate = false;
    }
    sm.needsUpdate = false;
  };
  return { renderer: { shadowMap: sm } as any, log };
}

function build() {
  const scene = new T.Scene();
  const sun = new T.DirectionalLight("#fff", 2);
  sun.name = "sun"; sun.castShadow = true; sun.position.set(10, 20, 5); sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun, sun.target);
  const box = (name: string, x: number) => { const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial()); m.name = name; m.castShadow = true; m.position.x = x; scene.add(m); return m; };
  const stand = box("stand", 0), goal = box("goal", 3), bench = box("bench", -3);
  const ball = box("ball", 1); markShadowMoving(ball);
  scene.updateMatrixWorld(true);
  return { scene, sun, stand, goal, bench, ball };
}

const { renderer, log } = fakeRenderer();
const cache = installShadowCache(T, renderer);
check(installShadowCache(T, renderer) === cache, "installs once per renderer");
const S = build();
const frame = () => { log.length = 0; S.scene.updateMatrixWorld(true); renderer.shadowMap.render([S.sun], S.scene, null); return log.map((x) => ({ ...x })); };

// classifying
{
  const c = classifyCasters(S.scene);
  check(c.statics.length === 3 && c.movers.length === 1 && c.movers[0] === S.ball, `still: stand, goal, bench; moving: the ball (got ${c.statics.map((o) => o.name)} / ${c.movers.map((o) => o.name)})`);
}

// frame 1: the kept picture (still things only), then the ball on top of it
{
  const f = frame();
  const still = f.find((x) => x.map === "sun.shadowCache"), live = f.find((x) => x.map === "sun.shadowMap");
  check(!!still && still.drew.sort().join() === "bench,goal,stand", `first frame draws the still things into the kept picture (got ${JSON.stringify(f)})`);
  check(!!live && live.drew.join() === "restore,ball", `then the kept picture copied back and the ball on top (got ${JSON.stringify(live)})`);
  check(S.stand.castShadow && S.ball.castShadow, "casting flags are put back after the pass");
}
// a still frame: none of the still things is drawn again
{
  const f = frame();
  check(!f.some((x) => x.map === "sun.shadowCache"), "a still frame never redraws the kept picture");
  const drawn = f.flatMap((x) => x.drew);
  check(!drawn.includes("stand") && !drawn.includes("goal") && !drawn.includes("bench"), `a still frame draws no still thing (drew ${drawn})`);
  check(drawn.join() === "restore,ball", `only the copy-back and the mover (drew ${drawn})`);
}
// nothing moving casts: the kept picture is used as it is, nothing drawn
{
  S.ball.castShadow = false;
  const f = frame();
  check(f.length === 0, `nothing moving: no shadow drawing at all (got ${JSON.stringify(f)})`);
  check((S.sun.shadow.map as any)?.texture?.name === "sun.shadowCache", "and the light reads the kept picture");
  S.ball.castShadow = true;
}
// a still thing moves: it joins the movers, the picture is redrawn once without it
{
  S.goal.position.x = 4;
  const f = frame();
  const still = f.find((x) => x.map === "sun.shadowCache");
  check(!!still && still.drew.sort().join() === "bench,stand", `a moved goal is redrawn as a mover, the kept picture without it (got ${JSON.stringify(f)})`);
  const f2 = frame();
  check(!f2.some((x) => x.map === "sun.shadowCache"), "and only once");
  check(f2.flatMap((x) => x.drew).includes("goal"), "the goal is drawn every frame from then on");
}
// a still thing hidden: redrawn without it
{
  S.bench.visible = false;
  const f = frame();
  const still = f.find((x) => x.map === "sun.shadowCache");
  check(!!still && !still.drew.includes("bench"), `a hidden bench leaves the kept picture (got ${JSON.stringify(f)})`);
  S.bench.visible = true;
  frame();
}
// the light moves (the shadow box following play): redrawn; every frame for a while → three's own pass
{
  S.sun.position.x += 4; S.sun.target.position.x += 4;
  const f = frame();
  check(f.some((x) => x.map === "sun.shadowCache"), "the shadow box moved: the kept picture is redrawn");
  let passed = 0;
  for (let i = 0; i < THRASH_REBUILDS + 6; i++) {
    S.sun.position.x += 4; S.sun.target.position.x += 4;
    const g = frame();
    if (g.length === 1 && g[0].drew.includes("stand") && g[0].drew.includes("goal")) passed++;
  }
  check(passed > 0, "a box that moves every frame is left to three's own pass (no double drawing)");
}
// a light that isn't being updated this frame (autoUpdate off) draws nothing
{
  const r2 = fakeRenderer();
  installShadowCache(T, r2.renderer);
  const B = build();
  r2.renderer.shadowMap.autoUpdate = false;
  r2.renderer.shadowMap.render([B.sun], B.scene, null);
  check(r2.log.length === 0, "autoUpdate off and nothing asked: nothing drawn, as three");
  r2.renderer.shadowMap.needsUpdate = true;
  r2.renderer.shadowMap.render([B.sun], B.scene, null);
  check(r2.log.length === 2, `asked once: the kept picture and the overlay (got ${r2.log.length})`);
}

// the shadow body: fewer triangles, real vertices, no triangle across two bones
{
  const g = new T.CylinderGeometry(0.16, 0.16, 1.8, 72, 120); // about a body: 1.8 m tall, ~1.8 m² of skin, 17k triangles
  const n = g.attributes.position.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = g.attributes.position.getX(i) > 0 ? 1 : 2; sw[i * 4] = 1; }
  g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
  const from = g.index!.count / 3;
  const idx = shadowBodyIndex(g)!;
  check(!!idx && idx.length % 3 === 0, "an index list of whole triangles");
  const to = idx.length / 3;
  check(to < from * 0.5, `the shadow body has far fewer triangles (${from} → ${to})`);
  check(to > 200, `but still a body's shape (${to} triangles)`);
  check(Array.from(idx).every((v) => v < n), "every corner is an existing vertex (real skin weights)");
  let cross = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const b = [idx[t], idx[t + 1], idx[t + 2]].map((v) => si[v * 4]);
    const ob = [g.index!.getX(t)].length; void ob;
    if (new Set(b).size > 1) cross++;
  }
  // triangles across the bone seam existed before; none may join corners that were not neighbours
  let maxEdge = 0;
  const p = g.attributes.position;
  for (let t = 0; t < idx.length; t += 3) for (const [a, b] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
    maxEdge = Math.max(maxEdge, Math.hypot(p.getX(a) - p.getX(b), p.getY(a) - p.getY(b), p.getZ(a) - p.getZ(b)));
  }
  check(maxEdge < 0.2, `no long stray triangles (longest edge ${maxEdge.toFixed(3)} on a 1.8 m body)`);
  void cross;
}

if (problems.length) { console.error(`shadowCache: ${problems.length} problem(s)\n - ` + problems.join("\n - ")); process.exit(1); }
console.log("shadowCache: all checks passed");
