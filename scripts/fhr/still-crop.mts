// How many figures does each still leave off the picture? Today's still
// (the builder's frame) against the match-camera still (phase 1), over N
// Infinite Highlights chances. Decides whether the match camera should also
// be the test page's default.   npx tsx scripts/fhr/still-crop.mts [N=300]
import { nextHighlight, newSimMemory, buildSimScenario } from "../../lib/star/gallerySim";
import { SCENARIO_KINDS } from "../../lib/star/canvasEngine";
import { isSwitchedOff } from "../../lib/star/switchedOffKinds";
import { frameFromScenario, type Frame } from "../../lib/star/scenarioFrame";
import { matchStill, matchCanvasHW, withMatchCamera } from "../../lib/star/fhr/stillCamera";
import { mulberry32 } from "../../lib/star/fhr/ruler";

const n = Number(process.argv[2] ?? 300);
const kinds = SCENARIO_KINDS.filter((k) => !isSwitchedOff(k));
const rng = mulberry32(7), mem = newSimMemory();
let last: string | null = null;
const off = (f: Frame) => f.items.filter((it) => it.at.x < f.camera.x1 || it.at.x > f.camera.x2 || it.at.y < f.camera.y1 || it.at.y > f.camera.y2).length
  + (f.ball.x < f.camera.x1 || f.ball.x > f.camera.x2 || f.ball.y < f.camera.y1 || f.ball.y > f.camera.y2 ? 1 : 0);
let todayOff = 0, matchOff = 0, todayPics = 0, matchPics = 0, zoomSum = 0;
for (let i = 0; i < n; i++) {
  const spec = nextHighlight([...kinds], rng, mem, last);
  if (!spec) break;
  const sc = buildSimScenario(spec);
  last = JSON.stringify(sc.ball);
  const today = frameFromScenario(sc);
  // A phone (iPhone 13: 366 px picture, ~700 px of room under the bars).
  const still = matchStill(sc, matchCanvasHW(366, 700), 20);
  const shown = withMatchCamera(today, still);
  const a = off(today), b = off(shown);
  todayOff += a; matchOff += b; if (a) todayPics++; if (b) matchPics++;
  zoomSum += (today.camera.x2 - today.camera.x1) / (shown.camera.x2 - shown.camera.x1);
}
console.log(`${n} chances: figures off the picture — today ${todayOff} (${todayPics} pictures), match camera ${matchOff} (${matchPics} pictures); match camera is ${(zoomSum / n).toFixed(2)}× today's zoom on average`);
