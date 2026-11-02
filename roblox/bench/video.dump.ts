// Records one played match frame by frame (30 a second) with the Roblox camera
// (camera3d.ts, eased as Match.luau eases it), for tools/match-video.py.
//   NODE_PATH=roblox/tools/stubs npx tsx roblox/bench/video.dump.ts out.json [chances]
import * as F from "../game/flow";
import * as M from "../game/match";
import * as V from "../game/matchView";
import { cameraFor, type Cam } from "../game/camera3d";
import * as C from "../../lib/star/clubs";
import { mulberry32 } from "../../lib/star/season";
import type { StarPlayer } from "../../lib/star/types";
import { writeFileSync } from "node:fs";

const CHANCES = Number(process.argv[3] ?? 6);
const ASPECT = 16 / 9, VFOV = 50, DT = 1 / 60;
const p = { firstName: "Video", lastName: "Robot", age: 18, skinTone: "tan", club: C.CHAMPIONSHIP_CLUBS[15], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
let g = F.newGame(p, [...C.CHAMPIONSHIP_CLUBS], "championship");
for (let i = 0; i < 50 && !(g.phase === "dashboard" && F.matchday(g).canPlay); i++) g = g.phase === "post-match" ? F.postMatchContinue(g) : F.backToDashboard(g);
const readied = M.readyForMatch(g.career);
const setup = M.matchSetupFor(readied)!;
Math.random = mulberry32(setup.seed);
const m = M.startMatch(setup);

const out: unknown[] = [];
let cam: Cam | null = null, want: Cam | null = null, camWait = 0, lastPhase = "", pf = 0, chances = 0, feedFrames = 0, t = 0;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (a: Cam, b: Cam, k: number): Cam => ({
  pos: { x: lerp(a.pos.x, b.pos.x, k), y: lerp(a.pos.y, b.pos.y, k), h: lerp(a.pos.h, b.pos.h, k) },
  target: { x: lerp(a.target.x, b.target.x, k), y: lerp(a.target.y, b.target.y, k), h: lerp(a.target.h, b.target.h, k) },
});
for (let f = 0; f < 400000 && !m.result; f++) {
  if (m.phase !== lastPhase) {
    if (m.phase === "aim" || m.phase === "tdDribble") chances++;
    if (chances > CHANCES) break;
  }
  const fr = V.frameOf(m);
  // the camera, as Match.luau drawFrame: worked out 5 times a second on a chance, eased, cut on a new chance
  camWait -= DT;
  if (fr.cameraMode !== "chance" || camWait <= 0 || lastPhase !== m.phase || !want) { want = cameraFor(fr, ASPECT, VFOV, t); camWait = 0.2; }
  const cut = !cam || (lastPhase !== m.phase && (m.phase === "aim" || m.phase === "tdDribble"));
  cam = cut ? want : ease(cam!, want, 1 - Math.exp(-5 * DT));
  if (m.phase !== lastPhase) { lastPhase = m.phase; pf = 0; }
  pf++; t += DT;
  // the commentary between chances: a second of it, not all of it
  const show = chances > 0 && (m.phase !== "feed" || feedFrames++ < 60);
  if (m.phase !== "feed") feedFrames = 0;
  if (show && f % 2 === 0) out.push({ ...fr, cam, t: Math.round(t * 100) / 100 });
  // the robot's hands: aim at goal, strike low middle, run up the pitch
  if (m.pause) M.continuePause(m);
  if (m.phase === "aim" && pf === 45) {
    const b = m.sc.ball, gx = (m.sc.goal.x1 + m.sc.goal.x2) / 2 + (chances % 2 ? 1.5 : -1.5), n = Math.hypot(gx - b.x, b.y) || 1;
    const pull = (m.camera.x2 - m.camera.x1) * 0.18;
    M.pointerDown(m, { x: b.x, y: b.y }); M.pointerMove(m, { x: b.x - (gx - b.x) / n * pull, y: b.y + b.y / n * pull }); M.pointerUp(m);
  } else if (m.phase === "contact" && pf === 30) M.contact(m, { cx: 0, cy: 0.2 });
  if (m.phase === "tdDribble") M.dribbleStick(m, Math.sin(pf / 30) * 0.5, 1);
  M.tick(m, DT);
}
writeFileSync(process.argv[2] ?? "/tmp/video.json", JSON.stringify(out));
console.log(`${out.length} frames, ${chances} chances, ${setup.fixture.home ? "home" : "away"} v ${setup.fixture.opponent}`);
