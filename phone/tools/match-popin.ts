// THE POP-IN CHECK: plays whole matches headless with the bot and, every stepped frame of a chance,
// lists the men the pitch draws (the pitch's own list, src/match/menNow.ts) and the camera. It reports:
//   APPEAR / VANISH  a man on the list this frame and not the last (or the other way), mid-chance
//   JUMP             a man who moved more than 1.2 m in one frame (72 m/s: a teleport)
//   CUT              the camera's frame moving more than 12% of its width in one frame
//   NO-SPRITE        (with --png) a man whose picture could not be drawn: a shadow with nobody on it
// Only what is INSIDE the camera's frame counts (off-screen men cannot be seen).
// With --png DIR it also DRAWS every frame with the phone's own drawing code (CanvasKit) and writes
// the frames around each kind of find (the first two of each).
//   cd phone && npx tsx tools/match-popin.ts [matches] [-v] [--png DIR]
import fs from "node:fs";
import path from "node:path";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { kitsFor } from "@/lib/star/kits";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import type { Viewport } from "@/lib/star/canvasEngine";
import type { Fixture } from "@/lib/star/types";
import type { SkPicture } from "@shopify/react-native-skia";
import { setSkia } from "../src/match/skiaApi";
import { setSpriteSheet, setAtlas, spriteMiss, type SpriteIndex } from "../src/match/sprites";
import { drawPitch } from "../src/match/drawPitch";
import { MatchDriver } from "../src/match/driver";
import { matchSetupFor } from "../src/match/setup";
import { drawnMen } from "../src/match/menNow";
import { botWait, botAim, botContact, botContactWait, flatPullFor } from "./match-bot";
import { testCareer } from "./match-run-career";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
setVisitSalt(0);
const argv = process.argv.slice(2);
const N = Number(argv.find((a) => /^\d+$/.test(a)) ?? 6), VERBOSE = argv.includes("-v");
const PNG = argv.includes("--png") ? argv[argv.indexOf("--png") + 1] : null;
const AT = argv.includes("--at") ? argv[argv.indexOf("--at") + 1].split(":").map(Number) : null;
const W = 412, H = 720;

const inView = (v: Viewport, p: { x: number; y: number }) => p.x > v.x1 - 0.5 && p.x < v.x2 + 0.5 && p.y > v.y1 - 0.5 && p.y < v.y2 + 0.5;
const tally: Record<string, number> = {};
const samples: string[] = [];
/** True when this find's frames should be written (the first two of each kind). */
function note(kind: string, where: string, line: string): boolean {
  const k = `${kind} @ ${where}`;
  tally[k] = (tally[k] ?? 0) + 1;
  if (samples.length < 400 && (VERBOSE || tally[k] <= 3)) samples.push(`${k}: ${line}`);
  return tally[k] <= 2;
}

async function main() {
  let Skia: typeof import("@shopify/react-native-skia").Skia | null = null;
  if (PNG) {
    const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
    Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
    setSkia(Skia);
    const dir = path.join(__dirname, "../src/match/assets/sprites");
    const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as SpriteIndex;
    const img = (f: string) => Skia!.Image.MakeImageFromEncoded(Skia!.Data.fromBytes(new Uint8Array(fs.readFileSync(path.join(dir, f)))))!;
    setSpriteSheet(idx, img("atlas-0.webp"), img("mask-0.webp"));
    for (let n = 1; n <= 5; n++) setAtlas(n, img(`atlas-${n}.webp`), img(`mask-${n}.webp`));
    fs.mkdirSync(PNG, { recursive: true });
  }
  const surf = Skia ? Skia.Surface.Make(W, H)! : null;
  const career = testCareer();
  const fixtures = career.fixtures.filter((f: Fixture) => !f.played).slice(0, N);
  let frames = 0, chances = 0, shots = 0;
  for (const [mi, fx] of fixtures.entries()) {
    const d = new MatchDriver(matchSetupFor({ ...career, week: fx.week }, fx), { hw: H / W });
    const kits = fx.home ? kitsFor(career.player.club, fx.opponent) : kitsFor(fx.opponent, career.player.club);
    const seed = 1000 + mi;
    let last: Map<string, { x: number; y: number }> | null = null, lastCam: Viewport | null = null, lastKey: unknown = null, lastPhase = "", lastWhere = "";
    let aimTicks = 0, contactTicks = 0, nCh = 0, sinceNew = 0;
    // The last few pictures, and how many more to write after a find.
    const ring: { pic: SkPicture; tag: string }[] = [];
    let after = 0, shotName = "";
    const write = (pic: SkPicture, name: string) => {
      if (!Skia || !surf || !PNG) return;
      const cv = surf.getCanvas(); cv.clear(Skia.Color("black")); cv.drawPicture(pic); surf.flush();
      fs.writeFileSync(path.join(PNG, name), Buffer.from(surf.makeImageSnapshot().encodeToBytes()));
    };
    d.start();
    for (let n = 0; n < 3_000_000 && !d.done; n++) {
      if (d.pause) { d.continuePause(); continue; }
      if ((d.phase === "aim" || d.phase === "tdDribble") && lastPhase !== d.phase && lastPhase !== "aim") { nCh++; chances++; aimTicks = 0; }
      if (d.phase === "contact" && lastPhase !== "contact") contactTicks = 0;
      const phase0 = d.phase;
      if (d.phase === "tdDribble" && d.tdReady) d.tdTap({ x: 0, y: 0 });
      if (d.phase === "aim" && !d.lead) {
        aimTicks++;
        if (aimTicks === botWait(seed, nCh)) {
          const b = d.sc.ball, pull = flatPullFor(d.viewport, d.facing);
          d.pointerDown({ x: b.x, y: b.y }, 99, 0);
          d.pointerMove(botAim(b, d.viewport, d.facing, seed, nCh), pull);
          d.pointerUp(pull);
        }
      }
      if (d.phase === "contact" && !d.contactLocked) {
        contactTicks++;
        if (contactTicks === botContactWait(seed, nCh)) { const c = botContact(nCh); d.tapContact(c.cx, c.cy); }
      }
      lastPhase = phase0;
      d.tick();
      if (d.phase === "feed" || d.phase === "done") { last = null; lastCam = null; ring.length = 0; after = 0; continue; }
      if (d.phase === "contact") continue;
      frames++;
      const cam = d.leadCamera() ?? d.viewport;
      const key = d.phase === "tdDribble" ? d.td : d.sc;
      const men = new Map(drawnMen(d).map((m) => [m.id, { x: m.p.x, y: m.p.y }]));
      const where = `${d.phase === "tdDribble" ? "dribble" : d.sc.kind}/${d.lead ? "build-up" : d.playOn ? "play-on" : d.phase}`;
      if (key !== lastKey || !last) sinceNew = 0; else sinceNew++;
      const tag = `m${mi} ${d.matchMinute}' f${sinceNew} (was ${lastWhere})`;
      let found = "";
      const hit = (kind: string, line: string) => { if (note(kind, where, `${line} ${tag}`) && !found) found = `${kind}-${where.replace(/\W+/g, "-")}`; };
      if (last && key === lastKey && lastCam) {
        for (const [id, p] of men) {
          const q = last.get(id);
          if (!q) { if (inView(cam, p)) hit("APPEAR", `${id} at ${p.x.toFixed(1)},${p.y.toFixed(1)}`); continue; }
          const dist = Math.hypot(p.x - q.x, p.y - q.y);
          if (dist > 1.2 && (inView(cam, p) || inView(lastCam, q))) hit("JUMP", `${id} ${dist.toFixed(1)} m ${q.x.toFixed(1)},${q.y.toFixed(1)} -> ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        }
        for (const [id, q] of last) if (!men.has(id) && inView(lastCam, q)) hit("VANISH", `${id} at ${q.x.toFixed(1)},${q.y.toFixed(1)}`);
        const w = cam.x2 - cam.x1;
        const move = Math.max(Math.abs(cam.x1 - lastCam.x1), Math.abs(cam.x2 - lastCam.x2), Math.abs(cam.y1 - lastCam.y1), Math.abs(cam.y2 - lastCam.y2));
        if (move > 0.12 * w) hit("CUT", `camera moved ${move.toFixed(1)} m of ${w.toFixed(1)}`);
      }
      if (Skia) {
        const miss0 = spriteMiss.n;
        const pic = drawPitch(d, kits, W, H);
        if (spriteMiss.n > miss0) hit("NO-SPRITE", `${spriteMiss.n - miss0} men not drawn (${spriteMiss.last})`);
        // --at m:f writes match m, frames f-1 and f of a chance (a before/after still of a known find).
        if (AT && mi === AT[0] && (sinceNew === AT[1] - 1 || sinceNew === AT[1])) write(pic, `at-m${mi}-f${sinceNew}-${where.replace(/\W+/g, "-")}.png`);
        if (found && shots < 40) {
          shots++; shotName = `${String(shots).padStart(2, "0")}-${found}`;
          ring.slice(-3).forEach((r, i, a) => write(r.pic, `${shotName}-a${i - a.length}.png`));
          write(pic, `${shotName}-b0.png`);
          after = 3;
        } else if (after > 0) { write(pic, `${shotName}-b${4 - after}.png`); after--; }
        ring.push({ pic, tag }); if (ring.length > 4) ring.shift();
      }
      last = men; lastCam = { ...cam }; lastKey = key; lastWhere = where;
    }
  }
  console.log(`${fixtures.length} matches, ${chances} chances, ${frames} drawn frames${Skia ? " (every one drawn)" : ""}`);
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(6), k);
  console.log(samples.join("\n"));
}
void main();
