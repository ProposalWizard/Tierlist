/**
 * CHECKS THE PHONE'S WALK-AROUND 3D (src/three/walkHost.ts + the garden, the 3D shop) WITHOUT A PHONE.
 *
 *   cd phone && npx tsx tools/walk-check.ts [--place garden|shop] [--out DIR] [--sizes 412x915,360x780] [--sky day|sunset|night] [--quality low|medium|high] [--dpr 2]
 *
 * The place (the garden, or with --place shop the 3D shop) is started through the phone's host inside a Web Worker in headless Chromium.
 * A worker has no `document`, no `window`, no storage and no DOM, like the phone's JavaScript
 * engine (Hermes), so the stand-ins (src/three/standIn.ts, env.ts) are what the scene meets;
 * the GL is an OffscreenCanvas's, the pictures are unpacked by Skia (CanvasKit), the 3D files
 * come only through the phone's file reader (and are listed: each must be bundled,
 * src/three/assetList.ts). It then walks to spots, takes a still of each, reads the scene's own
 * numbers (draw calls, triangles) and the frames drawn, and checks that leaving puts everything back.
 * The machine has no graphics chip (SwiftShader draws on the processor): read times as relative.
 * With --place garden it also gets on the horse and into a car (KIB RIDE: src/three/garden/): mounts, moves with the stick for some game seconds,
 * asserts the position changed, stayed inside the garden and out of every obstacle, gets off, and prints the JavaScript time a frame on foot, riding and driving.
 * Exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { THREE_ASSET_URLS } from "../src/three/assetList";
import { CAR_BODY, HORSE_BODY, bodyFree, type Obstacles } from "../src/three/garden/ride"; // KIB RIDE

const args = process.argv.slice(2);
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "walk-check"));
const SIZES = arg("--sizes", "412x915,360x780").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const SKY = arg("--sky", "day");
const QUALITY = arg("--quality", "medium");
const DPR = Number(arg("--dpr", "2"));
const PLACE = arg("--place", "garden") as "garden" | "shop" | "house";
/** House only: which home (starter|flat|penthouse|house|villa|estate), the living rooms on/off, and whether to start in his eyes (the 3D phone). */
const TIER = arg("--tier", "house");
const LIVING = arg("--living", "on") !== "off";
const POV = args.includes("--pov");
/** Shop only: every frame moves the game on by this many seconds (software GL draws about 1 frame a second; 0 = real time). */
const STEP = Number(arg("--step", "0.1"));
const RIDE_ONLY = args.includes("--ride-only");
/** The ride flow's game seconds are multiplied by this (software GL draws a frame or two a second: 1 = the full lengths). */
const SCALE = Number(arg("--ride-scale", "1"));
const PHONE = path.join(__dirname, "..");
const ROOT = path.join(PHONE, "..");
let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.log(`   FAIL ${what}`); } };

(async () => {
  const esbuildAt = findEsbuild();
  const chrome = process.env.CHROME ?? findChrome();
  if (!esbuildAt || !chrome) { console.log(`skipped (chrome: ${chrome ?? "not found"}, esbuild: ${esbuildAt ?? "not found"})`); return; }
  const eb = require(esbuildAt) as typeof import("esbuild");
  const built = await eb.build({
    entryPoints: [path.join(__dirname, "walk-worker-entry.ts")], bundle: true, format: "iife", write: false,
    tsconfig: path.join(PHONE, "tsconfig.json"), platform: "browser", logLevel: "error", plugins: [aliasPlugin()],
    define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [path.join(PHONE, "node_modules"), path.join(ROOT, "node_modules")],
    external: ["fs", "path", "react-native", "react-native-mmkv"],
  });
  const workerJs = built.outputFiles[0].text;
  const { chromium } = require(require.resolve("playwright", { paths: [ROOT] })) as typeof import("playwright");
  const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  fs.mkdirSync(OUT, { recursive: true });
  const prof: Record<string, { pr: number }> = { low: { pr: 1.25 }, medium: { pr: 1.5 }, high: { pr: 1.5 } };

  for (const [W, H] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
    const served = new Map<string, "app" | "public">();
    const stray = new Set<string>();
    await ctx.route("http://kib.test/**", (route) => {
      const u = new URL(route.request().url());
      const p = decodeURIComponent(u.pathname);
      if (p === "/") return route.fulfill({ contentType: "text/html", body: `<html><body style="margin:0;background:#000"><canvas id="c" style="width:${W}px;height:${H}px;display:block"></canvas></body></html>` });
      if (p === "/worker.js") return route.fulfill({ contentType: "text/javascript", body: workerJs });
      if (p === "/font-bold.ttf") return route.fulfill({ body: fs.readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf") });
      if (p === "/canvaskit.wasm") return route.fulfill({ contentType: "application/wasm", body: fs.readFileSync(path.join(PHONE, "node_modules/canvaskit-wasm/bin/full/canvaskit.wasm")) });
      // the phone reads the copies in phone/assets/3d (some unpacked: tools/garden-props-unpack.mjs)
      const mine = p.startsWith("/star/trophies/") ? path.join(PHONE, "assets/trophies", path.basename(p)) : path.join(PHONE, "assets/3d", p.replace(/^\/star\//, "").replace(/\.json$/, ".bin"));
      if (p.startsWith("/star/") && fs.existsSync(mine)) { served.set(p, "app"); return route.fulfill({ body: fs.readFileSync(mine) }); }
      const pub = path.join(ROOT, "public", p);
      if (fs.existsSync(pub)) { served.set(p, "public"); return route.fulfill({ body: fs.readFileSync(pub) }); }
      stray.add(p);
      return route.fulfill({ status: 404, body: "" });
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto("http://kib.test/");
    const pr = prof[QUALITY].pr;
    const bw = Math.round(W * pr), bh = Math.round(H * pr);
    await page.evaluate(([bw, bh]) => {
      const c = document.getElementById("c") as HTMLCanvasElement;
      c.width = bw; c.height = bh;
      const off = c.transferControlToOffscreen();
      const w = new Worker("/worker.js");
      const waits = new Map<number, (v: { ok: boolean; v?: unknown; e?: string }) => void>();
      w.onmessage = (e) => waits.get(e.data.id)?.(e.data);
      let n = 0;
      (window as unknown as { call: (op: string, extra: object, transfer?: Transferable[]) => Promise<unknown> }).call = (op, extra, transfer) => new Promise((res, rej) => {
        const id = ++n;
        waits.set(id, (d) => (d.ok ? res(d.v) : rej(new Error(d.e))));
        w.postMessage({ id, op, ...extra }, transfer ?? []);
      });
      (window as unknown as { __off: OffscreenCanvas }).__off = off;
    }, [bw, bh]);
    const call = (op: string, extra: object = {}) => page.evaluate(([op, extra]) => (window as unknown as { call: (o: string, e: object) => Promise<unknown> }).call(op as string, extra as object), [op, extra]);
    console.log(`\n== ${W}x${H} css, dpr ${DPR}, GL buffer ${bw}x${bh} (${pr} per point), tier ${QUALITY}, sky ${SKY}`);
    const t0 = Date.now();
    let started: { ms: number; requested: string[]; log: string[]; rooms?: string[] };
    try {
      started = await page.evaluate(async ([W, H, pr, q, sky, place, step, tier, living, pov]) => {
        const w = window as unknown as { call: (o: string, e: object, t?: Transferable[]) => Promise<unknown>; __off: OffscreenCanvas };
        return w.call("start", { canvas: w.__off, w: W, h: H, pr, quality: q, arrive: place === "shop" ? "start" : "gate", sky, place, step, tier, living, pov }, [w.__off]);
      }, [W, H, pr, QUALITY, SKY, PLACE, STEP, TIER, LIVING, POV] as const) as { ms: number; requested: string[]; log: string[]; rooms?: string[] };
    } catch (e) {
      console.log(`   the ${PLACE} did not start:`, (e as Error).message.split("\n").slice(0, 6).join("\n   "));
      console.log("   page errors:", errors.slice(0, 5));
      ok(false, `the ${PLACE} did not start`);
      await ctx.close();
      continue;
    }
    console.log(`   started in ${started.ms.toFixed(0)} ms (wall ${Date.now() - t0} ms); the scene asked for ${started.requested.length} files`);
    const missing = started.requested.filter((u) => !THREE_ASSET_URLS.includes(u));
    ok(missing.length === 0, `not bundled in the app (src/three/assetList.ts): ${missing.join(", ")}`);
    const notMine = Array.from(served).filter(([p, w]) => w === "public" && p.startsWith("/star/")).map(([p]) => p);
    if (notMine.length) console.log(`   served from the website's folder (not phone/assets/3d): ${notMine.join(", ")}`);
    ok(stray.size === 0, `404 (not found anywhere): ${Array.from(stray).join(", ")}`);
    if (started.log.length) console.log("   log:", started.log.slice(0, 8));
    await sleep(2500);

    const spots: { name: string; at: [number, number, number]; want?: string }[] = PLACE === "house" ? [] : PLACE === "shop" ? [
      { name: "start", at: [-0.5, 3.7, Math.PI] },
      { name: "boots", at: [-3.2, 0, -Math.PI / 2], want: "boots" },
      { name: "car", at: [2.35, 1.6, Math.PI], want: "car" },
      { name: "cans", at: [3.9, 4.3, Math.PI / 2], want: "cans" },
      { name: "counter", at: [-1.2, -4.95, Math.PI], want: "counter" },
      { name: "homes", at: [2.7, 5.2, 0], want: "homes" },
    ] : [
      { name: "gate", at: [0, 15.5, Math.PI] },
      { name: "fountain", at: [0, 0.8, Math.PI], want: "fountain" },
      { name: "horse", at: [-5.6, 6.5, -Math.PI / 2], want: "horse" },
      { name: "cars", at: [9.5, 10.2, Math.PI], want: "cars" },
      { name: "shop", at: [0, -7.9, 0], want: "shop" },
      { name: "trophies", at: [-5.4, -5.8, -Math.PI / 2], want: "trophies" },
      { name: "mates", at: [8.2, 2.2, Math.PI / 2], want: "mates" },
    ];
    const shot = async (name: string) => { await page.locator("#c").screenshot({ path: path.join(OUT, `${name}-${W}x${H}.jpg`), type: "jpeg", quality: 82 }); };
    /** The house: every room of the home (the fade, the swap, his stats), the three cards, the wardrobe's change, the eyes, the front door. */
    const houseFlow = async (rooms: string[]) => {
      console.log(`   rooms of the ${TIER}: ${rooms.join(", ") || "(the one room)"}`);
      for (const id of rooms.length ? rooms : ["main"]) {
        if (id !== (await call("state") as { room?: string }).room) { const went = await call("cmd", { fn: "call", name: "goToRoom", args: [id] }); ok(went !== false, `could not go to the ${id}`); }
        await sleep(2500);
        const b = await call("state") as { room: string; stats: { calls: number; triangles: number; pixelRatio: number; quality?: string; swapMs?: number }; js: { median: number; p95: number; n: number } };
        console.log(`   ${id.padEnd(12)} room=${String(b.room).padEnd(10)} ${b.stats.calls} draws, ${(b.stats.triangles / 1000).toFixed(0)}k tris, JS/frame median ${b.js.median.toFixed(1)} ms p95 ${b.js.p95.toFixed(1)} ms, swap ${b.stats.swapMs ?? "?"} ms`);
        ok(b.room === id, `in the ${b.room}, wanted the ${id}`);
        await shot(`room-${TIER}-${id}`);
        const plan = (await call("cmd", { fn: "call", name: "plan", args: [] })) as { spots?: string[] };
        for (const sp of plan.spots ?? []) {
          if (sp !== "wardrobe" && sp !== "cabinet" && sp !== "drive") continue;
          const shown = await call("cmd", { fn: "call", name: "showView", args: [sp] });
          // a living house keeps the arrival shot (no card) until he moves: a tap-walk to the spot moves him, and its card opens as he arrives
          await call("cmd", { fn: "call", name: "walkToSpot", args: [sp] });
          // software GL draws a frame or two a second, and the dwell that opens a card counts game time: wait for it
          const tNear = Date.now();
          let nr = (await call("state")) as { near: string | null };
          while (nr.near !== sp && Date.now() - tNear < 45000) { await sleep(1000); nr = (await call("state")) as { near: string | null }; }
          await sleep(1200);
          console.log(`   ${sp} in the ${id}: near=${nr.near} after ${((Date.now() - tNear) / 1000).toFixed(1)} s`);
          if (nr.near !== sp) console.log("   debug:", JSON.stringify(await call("cmd", { fn: "call", name: "lifeDebug", args: [] })).slice(0, 600), JSON.stringify(await call("state")).slice(0, 300));
          ok(nr.near === sp, `after showView(${sp}) in the ${id} the scene says near=${nr.near}`);
          await shot(`card-${TIER}-${id}-${sp}`);
          ok(shown === true, `no ${sp} in the ${id}`);
          await call("cmd", { fn: "call", name: "setCardOpen", args: [null] });
        }
      }
      // the wardrobe's change: into the club's away kit and into a tracksuit (resolves once he wears it), and back
      const t1 = Date.now();
      await call("cmd", { fn: "wear", what: "kit" });
      await call("cmd", { fn: "wear", what: "tracksuit" });
      console.log(`   changed clothes twice in ${Date.now() - t1} ms`);
      await shot(`wear-${TIER}`);
      // the 3D phone: in his eyes, HELD (one frame, then no loop at all), then eased out and drawing again
      await call("cmd", { fn: "call", name: "setPov", args: [1] });
      await call("cmd", { fn: "call", name: "hold", args: [true] });
      await sleep(1500);
      const h0 = (await call("state") as { frames: number }).frames;
      await sleep(2500);
      const h1 = (await call("state") as { frames: number }).frames;
      await shot(`pov-held-${TIER}`);
      console.log(`   in his eyes and held: ${h1 - h0} frames in 2.5 s`);
      ok(h1 - h0 <= 1, "the held house kept drawing (the phone in your hand must cost nothing)");
      await call("cmd", { fn: "call", name: "hold", args: [false] });
      await call("cmd", { fn: "call", name: "setPov", args: [null] });
      await sleep(2500);
      const h2 = (await call("state") as { frames: number }).frames;
      await sleep(2500);
      const h3 = (await call("state") as { frames: number }).frames;
      console.log(`   released: ${h3 - h2} frames in 2.5 s`);
      ok(h3 - h2 >= 1, "the house did not draw again after it was let go");
    };

    /** KIB RIDE: the horse and the car, in the worker (no document), through the scene's own controller. */
    const rideFlow = async () => {
      type St = { where: { x: number; z: number; yaw: number; t: number }; near: string | null; ride?: { mode: string; phase: string; mph: number; gait: string; canRide: boolean; canDrive: boolean; car: number | null; off: boolean }; rideLog: string[]; js: { n: number; median: number; p95: number }; stats: { calls: number; triangles: number; mode?: string }; log: string[] };
      const st = async (reset = false) => (await call("state", { reset })) as St;
      const rcall = (name: string, ...args: unknown[]) => call("cmd", { fn: "ride", name, args });
      const until = async (what: string, pred: (s: St) => boolean, ms = 90000) => { const t = Date.now(); let s = await st(); while (!pred(s) && Date.now() - t < ms) { await sleep(500); s = await st(); } ok(pred(s), `timed out waiting for ${what}`); return s; };
      const getObs = async () => (await rcall("obstacles")) as Obstacles;
      let obs: Obstacles = await getObs();
      console.log(`   KIB RIDE: ${obs.boxes.length} boxes, ${obs.circles.length} circles, ${obs.extra?.length ?? 0} vehicle-only plugs`);
      /** The free pose nearest to where a test wants the vehicle (the garden is full of bushes and trees). */
      const freeNear = (x: number, z: number, yw: number, body: typeof HORSE_BODY | typeof CAR_BODY, lane = 0): [number, number, number] => {
        // `lane`: metres of free ground wanted along the heading (negative: behind him)
        const laneOk = (px: number, pz: number) => { for (let d = 0.5; d <= Math.abs(lane); d += 0.5) { const k = Math.sign(lane) * d; if (!bodyFree(px + Math.sin(yw) * k, pz + Math.cos(yw) * k, yw, body, obs)) return false; } return true; };
        for (let r = 0; r < 16; r += 0.5) for (let a = 0; a < 16; a++) { const px = x + Math.cos((a / 16) * 6.283) * r, pz = z + Math.sin((a / 16) * 6.283) * r; if (bodyFree(px, pz, yw, body, obs) && laneOk(px, pz)) return [px, pz, yw]; }
        return [x, z, yw];
      };
      const putAt = async (kind: "horse" | "car", x: number, z: number, yw: number, lane = 0) => { obs = await getObs(); const [px, pz] = freeNear(x, z, yw, kind === "horse" ? HORSE_BODY : CAR_BODY, lane); return rcall("put", px, pz, yw); };
      /** Where the vehicle is, as the scene says. */
      const vehicle = async () => { const d = (await rcall("debug")) as { mode: string; horse: { x: number; z: number; yaw: number; speed: number }; car: { x: number; z: number; yaw: number; vf: number }; rider: number[]; saddle: number[]; cars: ({ i: number; moved: boolean; at: number[] } | null)[]; horseBox: { size: number[]; min: number[] } | null; bones: [string, number[]][] | null; hit: number; sit: boolean; sitHips: number[] }; return d; };
      /** Run a stick for `secs` and check the vehicle is never inside an obstacle (polled between frames: every sample is a frame's end state). */
      const drive = async (label: string, x: number, y: number, secs0: number, kind: "horse" | "car") => {
        const secs = secs0 * SCALE;
        obs = await getObs();
        const body = kind === "horse" ? HORSE_BODY : CAR_BODY;
        const t0 = (await st()).where.t;
        await call("cmd", { fn: "stick", args: [x, y] });
        let s = await st(), bad = 0, n = 0, out = 0, top = 0, hit = 0;
        const wall = Date.now();
        let p = await vehicle();
        const start = kind === "horse" ? { ...p.horse } : { ...p.car };
        while (s.where.t - t0 < secs && Date.now() - wall < 150000) {
          await sleep(350);
          s = await st(); p = await vehicle();
          const v = kind === "horse" ? p.horse : p.car;
          n++;
          if (!bodyFree(v.x, v.z, v.yaw, body, obs)) bad++;
          if (Math.abs(v.x) > 18.3 || Math.abs(v.z) > 18.3) out++;
          top = Math.max(top, Math.abs(kind === "horse" ? (p.horse as { speed: number }).speed : (p.car as { vf: number }).vf));
          hit = Math.max(hit, p.hit);
        }
        await call("cmd", { fn: "stick", args: [0, 0] });
        const end = kind === "horse" ? p.horse : p.car;
        const moved = Math.hypot(end.x - start.x, end.z - start.z);
        console.log(`   ${label.padEnd(26)} ${(s.where.t - t0).toFixed(1)} game s, ${n} samples: moved ${moved.toFixed(1)} m to ${end.x.toFixed(1)}, ${end.z.toFixed(1)}, top ${top.toFixed(1)} m/s, hit ${hit.toFixed(1)}, ${s.ride?.gait ?? ""} ${s.ride?.mph ?? 0} mph`);
        ok(bad === 0, `${label}: inside an obstacle in ${bad} of ${n} samples`);
        ok(out === 0, `${label}: left the garden in ${out} of ${n} samples`);
        return { moved, end, top, hit, bad };
      };
      const jsOf = async (label: string, secs0: number) => {
        const secs = secs0 * SCALE;
        await st(true);
        const t0 = (await st()).where.t; const w = Date.now();
        let s = await st();
        while (s.where.t - t0 < secs && Date.now() - w < 60000) { await sleep(500); s = await st(); }
        console.log(`   JS per frame ${label.padEnd(8)} median ${s.js.median.toFixed(2)} ms, p95 ${s.js.p95.toFixed(2)} ms over ${s.js.n} frames; ${s.stats.calls} draws, ${(s.stats.triangles / 1000).toFixed(0)}k tris, mode ${s.stats.mode}`);
        return s.js;
      };

      console.log("   -- the horse");
      await call("cmd", { fn: "place", args: [-5.5, 6.5, -Math.PI / 2] });
      await sleep(1500);
      const jsWalk = await (async () => { await call("cmd", { fn: "stick", args: [0, 0.5] }); const r = await jsOf("on foot", 8); await call("cmd", { fn: "stick", args: [0, 0] }); return r; })();
      await call("cmd", { fn: "place", args: [-5.5, 6.5, -Math.PI / 2] });
      await sleep(1500);
      let s0 = await until("the horse's card (near=horse and canRide)", (s) => s.near === "horse" && !!s.ride?.canRide, 30000);
      ok(!!s0.ride?.canRide, "Ride is not offered at the paddock");
      const p0 = await vehicle();
      console.log(`   horse model: ${JSON.stringify(p0.horseBox)} bones ${JSON.stringify(p0.bones)}`);
      ok(await rcall("mountHorse") === true, "mountHorse refused");
      for (let k = 0; k < 24 && process.env.RIDE_TRACE; k++) { const d = await vehicle(); const q = await st(); console.log(`   trace ${k}: t=${q.where.t.toFixed(1)} mode ${q.ride?.mode}/${q.ride?.phase} horse ${d.horse.x},${d.horse.z} yaw ${d.horse.yaw} sp ${d.horse.speed} hit ${d.hit}`); if (q.ride?.phase === "on") break; await sleep(400); }
      s0 = await until("the horse to come and him to get on (phase on)", (s) => s.ride?.mode === "horse" && s.ride.phase === "on", 120000);
      let v = await vehicle();
      console.log(`   mounted: rider at ${v.rider.join(",")} saddle ${v.saddle.join(",")} sit pose ${v.sit} hips ${v.sitHips.join(",")}; ride log ${s0.rideLog.join(" > ")}`);
      ok(v.sit, "no seated pose for the rider");
      // his hips (the foot of the rider plus the seated hips turned to the horse's way) are on the saddle
      const hy = v.horse.yaw, hipX = v.rider[0] + v.sitHips[0] * Math.cos(hy) + v.sitHips[2] * Math.sin(hy), hipZ = v.rider[2] - v.sitHips[0] * Math.sin(hy) + v.sitHips[2] * Math.cos(hy);
      ok(Math.hypot(hipX - v.saddle[0], hipZ - v.saddle[2]) < 0.15 && Math.abs(v.rider[1] + v.sitHips[1] - v.saddle[1]) < 0.15, `the rider is not on the saddle (hips ${hipX.toFixed(2)},${(v.rider[1] + v.sitHips[1]).toFixed(2)},${hipZ.toFixed(2)} saddle ${v.saddle.join(",")})`);
      await shot("ride-mounted");
      // his seat from the side: the legs, the saddle (the debug camera, then back to the follow camera)
      { const hy2 = v.horse.yaw, rx = Math.cos(hy2), rz = -Math.sin(hy2);
        await call("cmd", { fn: "cam", args: [v.horse.x + rx * 3.6, 1.3, v.horse.z + rz * 3.6, v.horse.x, 1.1, v.horse.z] }); await sleep(2500); await shot("ride-side");
        await call("cmd", { fn: "cam", args: [v.horse.x - Math.sin(hy2) * 4.2 + rx * 1.6, 1.8, v.horse.z - Math.cos(hy2) * 4.2 + rz * 1.6, v.horse.x, 1.2, v.horse.z] }); await sleep(2500); await shot("ride-rear34");
        await call("cmd", { fn: "cam", args: [] }); }
      // out of the paddock by the gate, then along the lane
      await putAt("horse", -7.6, 6.5, Math.PI / 2); // by the gate, facing east (the gate is on the east side)
      const h1 = await drive("walk (push 0.3)", 0, 0.3, 4, "horse");
      ok(h1.moved > 0.25 * 4 * SCALE, "the walk did not move him");
      await shot("ride-walk");
      await putAt("horse", 4, 14, Math.PI);
      const h2 = await drive("canter (full push)", 0, 1, 7, "horse");
      ok(h2.moved > 1.5 * 7 * SCALE, `the canter moved only ${h2.moved.toFixed(1)} m`);
      ok(h2.top > (SCALE >= 0.4 ? 4.5 : 2.5), `the canter top speed was ${h2.top.toFixed(1)}`);
      await shot("ride-canter");
      const jsRide = await (async () => { await call("cmd", { fn: "stick", args: [0, 0.8] }); const r = await jsOf("riding", 8); await call("cmd", { fn: "stick", args: [0, 0] }); return r; })();
      await drive("steer left then right", -0.8, 0.7, 4, "horse");
      await drive("steer right", 0.8, 0.7, 4, "horse");
      // into the things: the fountain, the shop, the boundary, a tree line
      await putAt("horse", 0, 4, Math.PI); const f = await drive("at the fountain", 0, 1, 8, "horse");
      ok(Math.hypot(f.end.x - 0, f.end.z + 2.2) > 1.95 + 0.4, "ended inside the fountain");
      await putAt("horse", 0, -4, Math.PI); const sh = await drive("at the shop front", 0, 1, 6, "horse");
      ok(sh.end.z > -9, `went into the shop (z ${sh.end.z.toFixed(2)})`);
      await putAt("horse", 12, 0, Math.PI / 2); const bd = await drive("at the east boundary", 0, 1, 8, "horse");
      ok(bd.end.x <= 18.3, "left the garden by the east");
      await putAt("horse", -12, 14, -Math.PI / 2); const bw = await drive("at the west boundary", 0, 1, 8, "horse");
      ok(bw.end.x >= -18.3, "left the garden by the west");
      await putAt("horse", 6, -3, 0); await drive("round the garden (stick right)", 1, 0.9, 12, "horse");
      // off
      await putAt("horse", -3, 8, 0);
      await rcall("stop");
      s0 = await until("him to be off (mode walk)", (s) => s.ride?.mode === "walk", 90000);
      const afterH = (await st()).where; const hv = await vehicle();
      console.log(`   dismounted at ${afterH.x.toFixed(2)}, ${afterH.z.toFixed(2)}; horse at ${hv.horse.x.toFixed(2)}, ${hv.horse.z.toFixed(2)}; ride log ${s0.rideLog.join(" > ")}`);
      ok(Math.hypot(afterH.x - hv.horse.x, afterH.z - hv.horse.z) < 3.2 && Math.hypot(afterH.x - hv.horse.x, afterH.z - hv.horse.z) > 0.6, "he did not get off beside the horse");
      ok(bodyFree(afterH.x, afterH.z, 0, { r: 0.32, at: [0] }, obs), "he got off inside something");
      { const o2 = await getObs(); const posts = o2.circles.filter((c) => Math.hypot(c[0] - hv.horse.x, c[1] - hv.horse.z) < 1.2 && c[2] >= 0.5);
        console.log(`   the horse left outside the paddock is ${posts.length} post(s) for walkers and cars`);
        ok(posts.length === 2, "the horse left outside the paddock is not something to walk round"); }
      await shot("ride-dismounted");
      console.log("   -- the cars");
      await call("cmd", { fn: "place", args: [9.5, 10.2, Math.PI] });
      await sleep(1500);
      s0 = await until("the cars' card (near=cars and canDrive)", (s) => s.near === "cars" && !!s.ride?.canDrive, 30000);
      const before = await vehicle();
      console.log(`   cars before: ${JSON.stringify(before.cars)}; canDrive car ${s0.ride?.car}`);
      ok(await rcall("driveCar") === true, "driveCar refused");
      s0 = await until("him to be in the car (phase on)", (s) => s.ride?.mode === "car" && s.ride.phase === "on", 60000);
      v = await vehicle();
      console.log(`   in car ${s0.ride?.car}: at ${v.car.x.toFixed(2)}, ${v.car.z.toFixed(2)} facing ${v.car.yaw.toFixed(2)}; ride log ${s0.rideLog.join(" > ")}`);
      await shot("drive-in");
      { const cy2 = v.car.yaw, rx = Math.cos(cy2), rz = -Math.sin(cy2);
        await call("cmd", { fn: "cam", args: [v.car.x + rx * 6, 1.6, v.car.z + rz * 6, v.car.x, 0.7, v.car.z] }); await sleep(2500); await shot("drive-side");
        await call("cmd", { fn: "cam", args: [] }); }
      const startCar = { ...v.car };
      const c1 = await drive("throttle (up)", 0, 1, 4, "car");
      ok(c1.moved > 1.5 * 4 * SCALE, `the car moved only ${c1.moved.toFixed(1)} m`);
      await shot("drive-moving");
      const jsDrive = await (async () => { await call("cmd", { fn: "stick", args: [0, 1] }); const r = await jsOf("driving", 6); await call("cmd", { fn: "stick", args: [0, 0] }); return r; })();
      await putAt("car", 0, 15, Math.PI);
      await drive("steer left (push left+up)", -1, 0.8, 4, "car");
      await shot("drive-turn");
      await putAt("car", -6, 4, Math.PI / 2, -7);
      const cb = await drive("brake then reverse (down)", 0, -1, 5, "car");
      const cv = await vehicle();
      ok(cv.car.vf < -0.5, `it did not reverse (vf ${cv.car.vf})`);
      await putAt("car", 0, 5, Math.PI); const cf = await drive("car at the fountain", 0, 1, 6, "car");
      ok(Math.hypot(cf.end.x - 0, cf.end.z + 2.2) > 1.95 + 0.9, "the car ended inside the fountain");
      await putAt("car", 0, -3, Math.PI); const cs2 = await drive("car at the shop front", 0, 1, 6, "car");
      ok(cs2.end.z > -9 + 0.9, `the car went into the shop (z ${cs2.end.z.toFixed(2)})`);
      await putAt("car", 12, 0, Math.PI / 2); const cbd = await drive("car at the east boundary", 0, 1, 6, "car");
      ok(cbd.end.x <= 18.3, "the car left the garden by the east");
      await putAt("car", 12, 1.5, -Math.PI / 2); await drive("car at the gazebo side", 0, 1, 8, "car");
      await putAt("car", 6, 4, Math.PI); await drive("car, circle (stick right)", 1, 0.9, 8, "car");
      // park it somewhere open, get out
      await putAt("car", -2, 10, Math.PI / 2);
      await rcall("stop");
      s0 = await until("him to be out (mode walk)", (s) => s.ride?.mode === "walk", 60000);
      const outAt = (await st()).where; const after = await vehicle();
      const mine = after.cars.find((c) => c && c.i === (before.cars.find((c2) => c2 && c2.moved === false)?.i ?? 0));
      console.log(`   out at ${outAt.x.toFixed(2)}, ${outAt.z.toFixed(2)}; cars now ${JSON.stringify(after.cars)}; ride log ${s0.rideLog.slice(-4).join(" > ")}`);
      const driven = after.cars.find((c) => c && c.moved);
      ok(!!driven, "no car is marked as driven");
      if (driven) {
        ok(Math.hypot(driven.at[0] - after.car.x, driven.at[2] - after.car.z) < 0.3, "the car is not parked where it stopped");
        ok(Math.hypot(outAt.x - driven.at[0], outAt.z - driven.at[2]) > 1.2 && Math.hypot(outAt.x - driven.at[0], outAt.z - driven.at[2]) < 3.5, "he did not get out beside the car");
      }
      void mine; void startCar; void cb;
      ok(bodyFree(outAt.x, outAt.z, 0, { r: 0.32, at: [0] }, (await rcall("obstacles")) as Obstacles), "he got out inside something");
      await shot("drive-out");
      // the parked car is something to walk round: walk into it
      await call("cmd", { fn: "stick", args: [0, 0] });
      // an error in the ride puts him back on his feet and switches the ride off
      await call("cmd", { fn: "place", args: [-5.5, 6.5, -Math.PI / 2] });
      await sleep(800);
      ok(await rcall("mountHorse") === true, "mountHorse refused (fault test)");
      await until("on the horse again", (s) => s.ride?.mode === "horse" && s.ride.phase === "on", 120000);
      await rcall("fault");
      s0 = await until("the fault to put him back on his feet", (s) => s.ride?.mode === "walk" && s.ride.off, 30000);
      console.log(`   fault: mode ${s0.ride?.mode}, off ${s0.ride?.off}; the garden is still drawing: ${(await st()).stats.calls} draws`);
      ok(await rcall("mountHorse") === false, "the ride is not off after a fault");
      console.log(`   JS per frame (median, V8 on this machine, Hermes will be several times more): on foot ${jsWalk.median.toFixed(2)} ms, riding ${jsRide.median.toFixed(2)} ms, driving ${jsDrive.median.toFixed(2)} ms`);
      return { jsWalk, jsRide, jsDrive };
    };
    for (const s of RIDE_ONLY ? [] : spots) {
      await call("cmd", { fn: "place", args: s.at });
      await sleep(1800);
      // frames drawn over 3 s standing there
      const a = await call("state", { reset: true }) as { frames: number };
      await sleep(3000);
      const b = await call("state") as { frames: number; near: string | null; stats: { calls: number; triangles: number; pixelRatio: number; quality?: string }; where: { x: number; z: number }; js: { n: number; median: number; p95: number } };
      const fps = (b.frames - a.frames) / 3;
      console.log(`   ${s.name.padEnd(9)} near=${String(b.near).padEnd(9)} ${b.stats.calls} draws, ${(b.stats.triangles / 1000).toFixed(0)}k tris, JS/frame median ${b.js.median.toFixed(1)} ms p95 ${b.js.p95.toFixed(1)} ms (${b.js.n} frames), ${fps.toFixed(1)} fps (software GL), pr ${b.stats.pixelRatio}, tier ${b.stats.quality ?? "?"}`);
      if (s.want) ok(b.near === s.want, `at the ${s.name}: expected near=${s.want}, got ${b.near}`);
      await shot(s.name);
    }
    if (PLACE === "house") await houseFlow(started.rooms ?? []);
    // touch paths: a tap on the ground walks, the stick walks, a drag looks round
    const home: [number, number, number] = PLACE === "shop" ? [-0.5, 3.7, Math.PI] : [0, 15.5, Math.PI];
    await call("cmd", { fn: "place", args: home });
    await sleep(800);
    const w0 = (await call("state") as { where: { x: number; z: number; yaw: number } }).where;
    if (PLACE !== "house" && !RIDE_ONLY) {
    await call("cmd", { fn: "stick", args: [0, 1] });
    // software GL draws about a frame a second (less when the machine is busy): wait until he has moved, up to 20 s
    const tStick = Date.now();
    let w1 = w0;
    while (Date.now() - tStick < 20000 && Math.hypot(w1.x - w0.x, w1.z - w0.z) <= 0.5) { await sleep(1000); w1 = (await call("state") as { where: { x: number; z: number; yaw: number } }).where; }
    await call("cmd", { fn: "stick", args: [0, 0] });
    console.log(`   stick forward ${((Date.now() - tStick) / 1000).toFixed(1)} s: moved ${Math.hypot(w1.x - w0.x, w1.z - w0.z).toFixed(2)} m`);
    ok(Math.hypot(w1.x - w0.x, w1.z - w0.z) > 0.5, "the stick did not walk him");
    await call("cmd", { fn: "tap", args: [W * 0.5, PLACE === "shop" ? H * 0.3 : H * 0.62] });
    await sleep(2500);
    const st = (await call("state")) as { walking: { to: [number, number] | null; active: boolean } | undefined; where: { x: number; z: number } };
    console.log(`   tap on the ground: walking=${JSON.stringify(st.walking)} now at ${st.where.x.toFixed(1)}, ${st.where.z.toFixed(1)}`);
    ok(!!st.walking, "no tap-walk in the controller");
    }
    // a pinch: two pointers handed to the scene's own listeners
    await call("cmd", { fn: "pointer", type: "pointerdown", args: [1, 100, 400] });
    await call("cmd", { fn: "pointer", type: "pointerdown", args: [2, 300, 400] });
    const pin = (await call("state")) as { pinching: boolean };
    await call("cmd", { fn: "pointer", type: "pointerup", args: [1, 100, 400] });
    await call("cmd", { fn: "pointer", type: "pointerup", args: [2, 300, 400] });
    ok(pin.pinching, "two fingers did not start the scene's pinch");
    if (PLACE === "shop") {
      // a card: a display's item picked, its level shown, the camera moved in, the buy gesture; a pick under a tap; the doorway
      // every car, bike, jet and home is shown once, so every file the shop can ask for is in the list below
      for (let i = 0; i < 8; i++) { await call("cmd", { fn: "call", name: "select", args: ["car", i] }); await sleep(900); }
      for (let i = 0; i < 9; i++) { await call("cmd", { fn: "call", name: "select", args: ["homes", i] }); await sleep(900); }
      const all = (await call("state")) as { log: string[] };
      const asked2 = (await call("asked")) as string[];
      const missing2 = asked2.filter((u) => !THREE_ASSET_URLS.includes(u));
      ok(missing2.length === 0, `after every car and home: not bundled: ${missing2.join(", ")}`);
      console.log(`   after showing every car and home the scene has read ${asked2.length} files`);
      void all;
      await call("cmd", { fn: "place", args: [2.35, 1.6, Math.PI] });
      await sleep(1200);
      await call("cmd", { fn: "call", name: "select", args: ["car", 2] });
      await call("cmd", { fn: "call", name: "setLevel", args: ["car", 2, 3] });
      await call("cmd", { fn: "call", name: "setCardOpen", args: [true] });
      await sleep(3500);
      await shot("card-car");
      await call("cmd", { fn: "call", name: "playBuy", args: [] });
      await sleep(1500);
      await call("cmd", { fn: "call", name: "setCardOpen", args: [false] });
      await call("cmd", { fn: "call", name: "select", args: ["boots", 3] });
      await call("cmd", { fn: "call", name: "setCardOpen", args: [true] });
      await sleep(3000);
      await shot("card-boots");
      await call("cmd", { fn: "call", name: "setCardOpen", args: [false] });
      await sleep(800);
      const picks: string[] = [];
      for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5], [0.5, 0.3], [0.5, 0.7]]) {
        const pk = await call("cmd", { fn: "call", name: "pick", args: [W * fx, H * fy] });
        picks.push(JSON.stringify(pk));
      }
      console.log(`   pick under five taps: ${picks.join(" ")}`);
      await call("cmd", { fn: "place", args: [0, 7.1, 0] });
      await sleep(600);
      await call("cmd", { fn: "stick", args: [0, 1] });
      await sleep(2500);
      await call("cmd", { fn: "stick", args: [0, 0] });
      const door = (await call("state")) as { doors: string[]; where: { x: number; z: number } };
      console.log(`   walked at the doorway: doors=${JSON.stringify(door.doors)} now at ${door.where.x.toFixed(1)}, ${door.where.z.toFixed(1)}`);
      ok(door.doors.includes("door"), "walking through the doorway did not call onDoor");
    }
    if (PLACE === "garden" && !args.includes("--no-ride")) await rideFlow();
    // pause holds the frames, resume goes on
    await call("cmd", { fn: "pause" });
    await sleep(300);
    const p0 = (await call("state") as { frames: number }).frames;
    await sleep(1500);
    const p1 = (await call("state") as { frames: number }).frames;
    await call("cmd", { fn: "resume" });
    await sleep(1500);
    const p2 = (await call("state") as { frames: number }).frames;
    console.log(`   paused: ${p1 - p0} frames in 1.5 s; resumed: ${p2 - p1} frames in 1.5 s`);
    ok(p1 - p0 <= 1, "frames kept drawing while paused");
    ok(p2 - p1 >= 1, "frames did not come back after resume");
    const fin = (await call("state")) as { log: string[] };
    const gone = (await call("dispose")) as { document: string; dpr: number | undefined; log: string[] };
    console.log(`   after leaving: document is ${gone.document}, devicePixelRatio ${gone.dpr}`);
    ok(gone.document === "undefined", "the stand-in document was left behind");
    ok(gone.dpr === undefined || gone.dpr === 1, "devicePixelRatio was not put back");
    const bad = fin.log.concat(errors).filter((l) => !/Failed to load resource|WEBGL_debug|GPU stall|ReadPixels/i.test(l));
    if (bad.length) console.log("   messages:", Array.from(new Set(bad)).slice(0, 10));
    const asked = Array.from(new Set(((await call("asked")) as string[]).concat(started.requested)));
    const bytes = asked.reduce((n, u) => { const f = u.startsWith("/star/trophies/") ? path.join(PHONE, "assets/trophies", path.basename(u)) : path.join(PHONE, "assets/3d", u.replace(/^\/star\//, "").replace(/\.json$/, ".bin")); return n + (fs.existsSync(f) ? fs.statSync(f).size : 0); }, 0);
    console.log(`   the files it read add up to ${(bytes / 1048576).toFixed(1)} MB in the app`);
    console.log(`   files read through the phone's reader (${asked.length}): ${asked.map((u) => u.replace("/star/", "")).join(", ")}`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\npictures: ${OUT}/<spot>-<size>.jpg`);
  console.log(failed ? `${failed} problem(s)` : "all good");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The phone's two swaps (phone/metro.config.js) for esbuild. */
function aliasPlugin(): import("esbuild").Plugin {
  return {
    name: "kib-three",
    setup(b) {
      const here = (p: string) => path.join(PHONE, "src/three", p);
      b.onResolve({ filter: /(^|\/)meshopt$/ }, (a) => {
        const abs = a.path.startsWith("@/") ? path.join(ROOT, a.path.slice(2)) : a.path.startsWith(".") ? path.resolve(a.resolveDir, a.path) : "";
        return abs === path.join(ROOT, "lib/star/three3d/meshopt") ? { path: here("meshopt.ts") } : undefined;
      });
      b.onResolve({ filter: /^three\/examples\/jsm\/loaders\/GLTFLoader\.js$/ }, (a) => (!a.importer.endsWith(path.join("src/three/GLTFLoader.ts")) ? { path: here("GLTFLoader.ts") } : undefined));
      b.onResolve({ filter: /^three$/ }, () => ({ path: require.resolve("three", { paths: [ROOT] }) }));
    },
  };
}

function findEsbuild(): string | null {
  try { return require.resolve("esbuild"); } catch { /* look further */ }
  try { return require.resolve("esbuild", { paths: [ROOT] }); } catch { /* look further */ }
  const npx = path.join(process.env.HOME ?? "/root", ".npm/_npx");
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) {
    const f = path.join(npx, d, "node_modules/esbuild");
    if (fs.existsSync(f)) return f;
  }
  return null;
}
function findChrome(): string | null {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(process.env.HOME ?? "", ".cache/ms-playwright")].filter(Boolean) as string[];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter((x) => x.startsWith("chromium-")).sort().reverse()) {
      for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const f = path.join(r, d, sub);
        if (fs.existsSync(f)) return f;
      }
    }
  }
  return null;
}
