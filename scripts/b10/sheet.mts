// B10: a SHEET of served header and volley chances to check by eye (CLAUDE.md:
// anything placed outside a drawing gets a sheet, and every picture is looked
// at). Each card is the chance as the chance maker serves it, from above, the
// whole box: you (white, gold ring) with the ball over you, the crosser (blue,
// "C") who put it there and his ball's path (dotted), team-mates blue,
// defenders red, the keeper yellow, the chance's frame dashed.
//
//   npx tsx scripts/b10/sheet.mts [--n=12] [--out=docs/handoffs/2026-10-20-builds/b10]
import { chromium } from "playwright";
import { makeChance, PictureMemory } from "../../lib/star/chanceMaker";
import { mateBodiesOf } from "../../lib/star/authoredChance";
import { mulberry32 } from "../../lib/star/season";
import { PITCH_W, CX, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, POST_L, POST_R, PEN_SPOT_Y } from "../../lib/star/pitch";
import type { ScenarioKind } from "../../lib/star/canvasEngine";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "12"));
const OUT = arg("out", "docs/handoffs/2026-10-20-builds/b10");
const f1 = (v: number) => v.toFixed(1);
const parked = (p: { x: number; y: number }) => p.x < -50 || p.x > PITCH_W + 50 || p.y > 150 || p.y < -50;

const cards: string[] = [];
const notes: string[] = [];
for (const kind of ["header", "volley"] as ScenarioKind[]) {
  const memory = new PictureMemory(`b10-sheet-${kind}`, false);
  for (let i = 0; i < N; i++) {
    const m = makeChance({ source: { from: "kind", kind }, rng: mulberry32(9001 + i * 7919), memory });
    const sc = m.sc;
    // The view: the box and a bit, 0..34 m deep, the whole width the bodies use.
    const pts = [sc.ball, sc.player, sc.keeper, ...sc.defenders, ...mateBodiesOf(sc)].filter((p) => !parked(p));
    const x1 = Math.min(BOX_L - 3, ...pts.map((p) => p.x)) - 2, x2 = Math.max(BOX_R + 3, ...pts.map((p) => p.x)) + 2;
    const y1 = -3, y2 = Math.max(26, ...pts.map((p) => p.y)) + 2;
    const W = 300, s = W / (x2 - x1), H = Math.round((y2 - y1) * s);
    const X = (x: number) => (x - x1) * s, Y = (y: number) => (y - y1) * s;
    const lines = [
      `<rect x="${X(0)}" y="${Y(0)}" width="${PITCH_W * s}" height="${(y2 - 0) * s}" fill="#2f7d32"/>`,
      `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(PITCH_W)}" y2="${Y(0)}" stroke="#e5e7eb"/>`,
      `<rect x="${X(BOX_L)}" y="${Y(0)}" width="${(BOX_R - BOX_L) * s}" height="${BOX_DEPTH * s}" fill="none" stroke="#e5e7eb"/>`,
      `<rect x="${X(SIX_L)}" y="${Y(0)}" width="${(SIX_R - SIX_L) * s}" height="${SIX_DEPTH * s}" fill="none" stroke="#e5e7eb"/>`,
      `<rect x="${X(POST_L)}" y="${Y(-1.5)}" width="${(POST_R - POST_L) * s}" height="${1.5 * s}" fill="#fff" opacity="0.85"/>`,
      `<circle cx="${X(CX)}" cy="${Y(PEN_SPOT_Y)}" r="1.5" fill="#e5e7eb"/>`,
    ].join("");
    const vp = sc.viewport;
    const frame = `<rect x="${X(vp.x1)}" y="${Y(vp.y1)}" width="${(vp.x2 - vp.x1) * s}" height="${(vp.y2 - vp.y1) * s}" fill="none" stroke="#fde047" stroke-dasharray="4 3"/>`;
    const r = Math.max(3.5, 0.55 * s);
    const dot = (p: { x: number; y: number }, fill: string, extra = "", label = "") =>
      `<circle cx="${f1(X(p.x))}" cy="${f1(Y(p.y))}" r="${f1(r)}" fill="${fill}" stroke="#111" stroke-width="0.8" ${extra}/>` +
      (label ? `<text x="${f1(X(p.x) + r + 1)}" y="${f1(Y(p.y) + 3)}" font-size="9" font-weight="700" fill="#fff">${label}</text>` : "");
    const crosser = sc.teammates[0];
    const body = [
      crosser && !parked(crosser) ? `<line x1="${X(crosser.x)}" y1="${Y(crosser.y)}" x2="${X(sc.ball.x)}" y2="${Y(sc.ball.y)}" stroke="#fff" stroke-dasharray="2 3" opacity="0.8"/>` : "",
      ...sc.defenders.filter((d) => !parked(d)).map((d) => dot(d, "#ef4444")),
      ...mateBodiesOf(sc).filter((m) => !parked(m) && m !== crosser).map((mm) => dot(mm, "#3b82f6")),
      crosser && !parked(crosser) ? dot(crosser, "#3b82f6", "", "C") : "",
      dot(sc.keeper, "#facc15"),
      dot(sc.player, "#ffffff", `stroke="#f59e0b" stroke-width="2"`),
      `<circle cx="${f1(X(sc.ball.x))}" cy="${f1(Y(sc.ball.y))}" r="${f1(r * 0.6)}" fill="#111" stroke="#fff" stroke-width="1"/>`,
    ].join("");
    // What to look for, measured here: the closest two bodies, anyone behind the keeper, anyone off the frame.
    const all = [sc.player, ...sc.defenders, ...mateBodiesOf(sc)].filter((p) => !parked(p));
    let close = Infinity;
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) close = Math.min(close, Math.hypot(all[a].x - all[b].x, all[a].y - all[b].y));
    const behind = all.filter((p) => p.y < sc.keeper.y && Math.abs(p.x - CX) < 6).length;
    const offFrame = all.filter((p) => p !== crosser && (p.x < vp.x1 || p.x > vp.x2 || p.y < vp.y1 || p.y > vp.y2)).length;
    const label = `${i + 1 + (kind === "volley" ? N : 0)}. ${kind} · ${m.sourceId?.replace(/^air-\w+-gallery-/, "") ?? m.how}`;
    const check = `closest ${close.toFixed(1)} m · behind keeper ${behind} · off frame ${offFrame} · faults ${m.faults.length}`;
    notes.push(`${label} — ${check}`);
    cards.push(`<div class="c"><div class="h">${label}</div><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#14532d"/>${lines}${frame}${body}</svg><div class="m">${check}</div></div>`);
  }
}
const css = `body{margin:0;background:#0b0f14;color:#e5e7eb;font:12px system-ui}.t{padding:8px 10px 0;font-weight:700}.g{display:grid;grid-template-columns:repeat(6,310px);gap:6px;padding:8px}.c{background:#111827;border:1px solid #374151;border-radius:6px;padding:4px}.h{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m{font-size:10px;color:#cbd5e1}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="t">B10 — ${N} headers then ${N} volleys as served (the team's cross drawings; you white with a gold ring, ball black, crosser "C" and his ball dotted, mates blue, defenders red, keeper yellow, frame dashed)</div><div class="g">${cards.join("")}</div></body></html>`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 6 * 316 + 20, height: 900 } });
await page.setContent(html);
await page.screenshot({ path: `${OUT}/b10-air-chances-sheet.jpg`, type: "jpeg", quality: 62, fullPage: true });
await browser.close();
console.log(notes.join("\n"));
