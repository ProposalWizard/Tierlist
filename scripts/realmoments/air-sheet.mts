/**
 * Eye-check sheets for the real headers and volleys (headers piece 1, 21 Oct
 * 2026): every fully real open-play header and volley the game would serve,
 * drawn from the scenario the game builds (scenarioForShot, the Play frame):
 * the goal, the keeper (yellow), defenders (red), team-mates (blue), YOU
 * (white ring), the ball (white dot, with its height written), and the
 * picture's frame. 12 to a 390 x 844 sheet, so a phone-sized page can be
 * looked at one by one for overlapping bodies, stranded men and a man behind
 * the keeper.
 *
 *   npx tsx scripts/realmoments/air-sheet.mts [outDir=docs/handoffs/2026-10-21-headers]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { scenarioForShot, airKindOf, frameHoldsShot, peopleOf, type RealShot, type TrackedFile } from "../../lib/star/realMoments";
import { airZOf, type AirHeighted } from "../../lib/star/airDrawings";
import { POST_L, POST_R, CX } from "../../lib/star/pitch";
import { separateBodies } from "../../lib/star/spacing";

const out = process.argv[2] ?? "docs/handoffs/2026-10-21-headers";
mkdirSync(out, { recursive: true });
const tracked = JSON.parse(readFileSync("data/realmoments/tracked.json", "utf8")) as TrackedFile;
const shots = tracked.moments.filter((m): m is RealShot & { what: "shot" } => m.what === "shot" && m.type === "Open Play" && m.src !== "soccertrack");
// The ones the game would serve: the automatic checks other than the kind
// (fhr/realMomentHighlights.ts autoCheck: within 35 m, their keeper by his
// goal, all 22 on the pitch).
const passes = (s: RealShot) => {
  const k = peopleOf(s).keeper;
  return Math.hypot(s.ball[0] - CX, s.ball[1]) <= 35 && !!k && k.y < 12 && Math.abs(k.x - CX) < 15 && (s.ff?.length ?? 0) >= 19;
};
const air = shots.filter((s) => { const a = airKindOf(s); return (a === "header" || a === "volley") && passes(s); });

const W = 390, H = 844, COLS = 3, ROWS = 4, CW = W / COLS, CH = (H - 24) / ROWS;
const cells: string[] = [];
const faults: string[] = [];
for (const s of air) {
  const sc = scenarioForShot(s, { wideFrame: true });
  // As served: the chance maker pulls apart two bodies drawn on top of each other (chanceMaker step 1b).
  separateBodies(sc);
  const v = sc.viewport;
  const sx = (CW - 8) / (v.x2 - v.x1), sy = (CH - 22) / (v.y2 - v.y1), k = Math.min(sx, sy);
  const X = (x: number) => 4 + (x - v.x1) * k, Y = (y: number) => 16 + (y - v.y1) * k;
  const dot = (x: number, y: number, r: number, fill: string, stroke = "none") => `<circle cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
  // Team-mates: the builder's, the runner and the support runners (where a real moment's real mates go).
  const mates = [...sc.teammates, ...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((r) => r.pos)];
  const men: { x: number; y: number; who: string }[] = [
    ...sc.defenders.map((d) => ({ x: d.x, y: d.y, who: "opp" })),
    ...mates.map((m) => ({ x: m.x, y: m.y, who: "mate" })),
    { x: sc.keeper.x, y: sc.keeper.y, who: "keeper" },
    { x: sc.player.x, y: sc.player.y, who: "you" },
  ];
  // The three named faults, measured as well as drawn.
  const f: string[] = [];
  for (let i = 0; i < men.length; i++) for (let j = i + 1; j < men.length; j++) if (Math.hypot(men[i].x - men[j].x, men[i].y - men[j].y) < 0.5) f.push("overlap");
  if (sc.defenders.some((d) => d.y < sc.keeper.y - 0.3 && Math.abs(d.x - sc.keeper.x) < 4)) f.push("behind keeper");
  if (men.some((m) => m.x < v.x1 || m.x > v.x2 || m.y < v.y1 || m.y > v.y2)) f.push("off frame");
  if (!frameHoldsShot(s, v)) f.push("frame");
  if (f.length) faults.push(`${s.id}: ${Array.from(new Set(f)).join(", ")}`);
  const z = airZOf(sc as typeof sc & AirHeighted);
  const kind = airKindOf(s) === "header" ? "HEADER" : "VOLLEY";
  cells.push(`<g>
    <rect x="1" y="1" width="${CW - 2}" height="${CH - 2}" fill="#1f6b33" stroke="${f.length ? "#ff5050" : "#0d3d1c"}" stroke-width="2"/>
    <text x="4" y="12" font-size="9" fill="#fff" font-family="sans-serif">${kind} ${s.src} z ${s.z?.toFixed(1)} m (plays ${z.toFixed(2)})</text>
    <line x1="${X(POST_L)}" y1="${Y(0)}" x2="${X(POST_R)}" y2="${Y(0)}" stroke="#fff" stroke-width="3"/>
    <rect x="${X(13.85)}" y="${Y(0)}" width="${(40.3) * k}" height="${16.5 * k}" fill="none" stroke="#ffffff88"/>
    <rect x="${X(24.85)}" y="${Y(0)}" width="${(18.3) * k}" height="${5.5 * k}" fill="none" stroke="#ffffff88"/>
    ${sc.defenders.map((d) => dot(d.x, d.y, 3.2, "#e53935")).join("")}
    ${mates.map((m) => dot(m.x, m.y, 3.2, "#42a5f5")).join("")}
    ${dot(sc.keeper.x, sc.keeper.y, 3.4, "#fdd835")}
    ${dot(sc.player.x, sc.player.y, 4, "none", "#fff")}
    ${dot(sc.ball.x, sc.ball.y, 1.8, "#fff")}
    <text x="4" y="${CH - 5}" font-size="8" fill="${f.length ? "#ffb3b3" : "#cfe8d5"}" font-family="sans-serif">${s.player.slice(0, 22)}${f.length ? " · " + Array.from(new Set(f)).join(", ") : ""}</text>
  </g>`);
}

const per = COLS * ROWS;
const pages = Math.ceil(cells.length / per);
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const pg = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
for (let p = 0; p < pages; p++) {
  const part = cells.slice(p * per, (p + 1) * per).map((c, i) => `<g transform="translate(${(i % COLS) * CW},${24 + Math.floor(i / COLS) * CH})">${c}</g>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0b1a10"/><text x="6" y="16" font-size="12" fill="#fff" font-family="sans-serif">Real headers and volleys, sheet ${p + 1} of ${pages}</text>${part}</svg>`;
  await pg.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await pg.screenshot({ path: `${out}/air-sheet-${String(p + 1).padStart(2, "0")}.png` });
}
await b.close();
writeFileSync(`${out}/air-sheet-faults.txt`, `${air.length} real headers and volleys drawn, ${faults.length} with a measured fault\n${faults.join("\n")}\n`);
console.log(`${air.length} drawn on ${pages} sheets; ${faults.length} with a measured fault`);
for (const f of faults) console.log("  " + f);
