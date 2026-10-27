// Dumps match frames (matchView) at the start of each chance and mid-flight, for the camera preview (tools/camera-preview.py).
import * as F from "../game/flow";
import * as M from "../game/match";
import * as V from "../game/matchView";
import { cameraFor } from "../game/camera3d";
import * as C from "../../lib/star/clubs";
import { mulberry32 } from "../../lib/star/season";
import type { StarPlayer } from "../../lib/star/types";
import { writeFileSync } from "node:fs";
const out: unknown[] = [];
const p = { firstName: "Cam", lastName: "Robot", age: 18, skinTone: "light", club: C.CHAMPIONSHIP_CLUBS[15], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
let g = F.newGame(p, [...C.CHAMPIONSHIP_CLUBS], "championship");
let played = 0;
for (let steps = 0; played < 3 && steps < 300; steps++) {
  if (g.phase !== "dashboard") { g = g.phase === "post-match" ? F.postMatchContinue(g) : F.backToDashboard(g); continue; }
  const day = F.matchday(g);
  if (!day.canPlay || !day.fixture) { g = F.watchFromStands(g); continue; }
  const readied = M.readyForMatch(g.career);
  const setup = M.matchSetupFor(readied)!;
  Math.random = mulberry32(setup.seed);
  const m = M.startMatch(setup);
  let pf = 0, last = "";
  for (let f = 0; f < 200000 && !m.result; f++) {
    if (m.phase !== last) { last = m.phase; pf = 0; }
    pf++;
    if (m.pause) M.continuePause(m);
    if ((m.phase === "aim" && pf === 2) || (m.phase === "flight" && pf === 30) || (m.phase === "tdDribble" && pf === 60)) { const f = V.frameOf(m); out.push({ ...f, camLand: cameraFor(f, 16 / 9, 50, 0), camPort: cameraFor(f, 9 / 19.5, 50, 0) }); }
    if (m.phase === "aim" && pf % 90 === 20) {
      const b = m.sc.ball, gx = (m.sc.goal.x1 + m.sc.goal.x2) / 2, n = Math.hypot(gx - b.x, b.y) || 1;
      const pull = (m.camera.x2 - m.camera.x1) * 0.18;
      M.pointerDown(m, { x: b.x, y: b.y }); M.pointerMove(m, { x: b.x - (gx - b.x) / n * pull, y: b.y + b.y / n * pull }); M.pointerUp(m);
    } else if (m.phase === "contact" && pf === 10) M.contact(m, { cx: 0, cy: 0.2 });
    if (m.phase === "tdDribble") M.dribbleStick(m, Math.sin(pf / 30) * 0.5, 1);
    M.tick(m, 1 / 60);
  }
  if (!m.result) break;
  g = F.matchComplete(g, m.result, readied, setup.fixture);
  played++;
}
writeFileSync(process.argv[2] ?? "/tmp/frames.json", JSON.stringify(out));
console.log(`${out.length} frames`);
