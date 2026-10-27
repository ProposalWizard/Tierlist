// Benchmark (not a twin test): every frame of played matches, timed; the slowest frames listed.
import * as F from "../game/flow";
import * as M from "../game/match";
import * as S from "../game/strikeScreen";
import * as V from "../game/matchView";
import * as C from "../../lib/star/clubs";
import { mulberry32 } from "../../lib/star/season";
import type { StarPlayer } from "../../lib/star/types";
declare const performance: { now(): number };
const MATCHES = 3;
const p = { firstName: "Bench", lastName: "Robot", age: 18, skinTone: "light", club: C.PREMIER_LEAGUE_CLUBS[4], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
let g = F.newGame(p, [...C.PREMIER_LEAGUE_CLUBS], "premier");
const times: { ms: number; what: string }[] = [];
let played = 0;
for (let steps = 0; played < MATCHES && steps < 300; steps++) {
  if (g.phase !== "dashboard") { g = g.phase === "post-match" ? F.postMatchContinue(g) : F.backToDashboard(g); continue; }
  const day = F.matchday(g);
  if (!day.canPlay || !day.fixture) { g = F.watchFromStands(g); continue; }
  const readied = M.readyForMatch(g.career);
  const setup = M.matchSetupFor(readied)!;
  Math.random = mulberry32(setup.seed);
  const t0 = performance.now();
  const m = M.startMatch(JSON.parse(JSON.stringify(M.deviceSetup(setup))));
  times.push({ ms: performance.now() - t0, what: "startMatch" });
  let pf = 0, last = "", strike: S.StrikeScreen | null = null, chance = 0;
  for (let f = 0; f < 200000 && !m.result; f++) {
    if (m.phase !== last) { last = m.phase; pf = 0; if (m.phase === "aim") chance++; }
    pf++;
    if (m.pause) M.continuePause(m);
    else if (m.phase === "aim" && pf % 90 === 20) {
      const b = m.sc.ball, gx = (m.sc.goal.x1 + m.sc.goal.x2) / 2, n = Math.hypot(gx - b.x, b.y) || 1;
      const pull = (m.camera.x2 - m.camera.x1) * 0.18;
      M.pointerDown(m, { x: b.x, y: b.y }); M.pointerMove(m, { x: b.x - (gx - b.x) / n * pull, y: b.y + b.y / n * pull }); M.pointerUp(m);
    } else if (m.phase === "contact") {
      if (!strike) strike = S.openStrike(m);
      if (strike && pf === 15) S.strikeTap(strike, 0, 0.2);
    }
    if (m.phase !== "contact") strike = null;
    if (m.phase === "tdDribble") M.dribbleStick(m, Math.sin(pf / 30) * 0.5, 1);
    const before = m.phase;
    const t1 = performance.now();
    if (strike) S.strikeStep(strike, m, 1 / 60);
    M.tick(m, 1 / 60);
    V.frameOf(m);
    times.push({ ms: performance.now() - t1, what: `${before}->${m.phase} ${m.minute}' ${m.sc?.kind}` });
  }
  if (!m.result) { console.log(`stuck: phase ${m.phase} minute ${m.minute} kind ${m.sc?.kind} pause ${m.pause?.cta}`); break; }
  g = F.matchComplete(g, m.result, readied, setup.fixture);
  played++;
}
const sorted = times.slice().sort((a, b) => b.ms - a.ms);
const sum = times.reduce((a, t) => a + t.ms, 0);
console.log(`frames ${times.length}, mean ${(sum / times.length).toFixed(2)} ms, total ${(sum / 1000).toFixed(1)} s`);
for (const t of sorted.slice(0, 12)) console.log(`${t.ms.toFixed(1)} ms  ${t.what}`);
