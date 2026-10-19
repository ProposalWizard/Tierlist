// A SHEET of generated build-ups (lib/star/fhr/buildUp.ts, phase 2) to check
// by eye: the first, middle and last frame of each, from above, with everyone's
// trail so far. CLAUDE.md: anything placed outside a drawing gets a sheet, and
// every picture is looked at.
//
//   npx tsx scripts/fhr/buildup-sheet.mts [count=48] [--seed=101] [--per=8] [--out=docs/handoffs/2026-10-19-ui-lookover/built-pages]
//
// Writes fhr-buildup-sheet-1.jpg, -2.jpg … (`per` build-ups a sheet).
// Colours: you white (gold ring), the chance's team-mates blue, team-mates only
// in the build-up pale blue, defenders red, the keeper yellow; the ball black
// with its route dotted; the chance's own frame dashed. Each card says the
// kind, the radar's pattern and lane, the length, the touches (P pass / C carry
// @ zone), who plays them, the closest two men come and the fastest man.
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { fhrBuildUpFor, fhrWantsBuildUp, maxSpeed, type FhrBuildUp } from "../../lib/star/fhr/buildUp";
import type { Scenario } from "../../lib/star/canvasEngine";
import { PITCH_W, HALF_LEN, CX, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, POST_L, POST_R, CENTRE_R } from "../../lib/star/pitch";

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 48);
const seed = Number(args.find((a) => a.startsWith("--seed="))?.slice(7) ?? 101);
const per = Number(args.find((a) => a.startsWith("--per="))?.slice(6) ?? 8);
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/handoffs/2026-10-19-ui-lookover/built-pages";
const LEN = 2 * HALF_LEN;
const PANEL_W = Number(args.find((a) => a.startsWith("--w="))?.slice(4) ?? 230);
const COLS = PANEL_W > 300 ? 1 : 2;

// An even spread over the open-play kinds, in the order the match serves them.
const pool = servedChances({ count: count * 6, seed }).filter((c) => fhrWantsBuildUp(c.sc.kind, c.moment));
const byKind = new Map<string, typeof pool>();
for (const c of pool) { const l = byKind.get(c.sc.kind) ?? []; l.push(c); byKind.set(c.sc.kind, l); }
const chosen: typeof pool = [];
for (let round = 0; chosen.length < count && round < 100; round++) {
  for (const l of byKind.values()) if (l[round] && chosen.length < count) chosen.push(l[round]);
}

const COL: Record<string, string> = { you: "#ffffff", mate: "#3b82f6", extra: "#93c5fd", opp: "#ef4444", keeper: "#facc15" };
const f1 = (v: number) => v.toFixed(1);

function card(b: FhrBuildUp, sc: Scenario, label: string, n: number): string {
  // One box round everything that happens, the same for all three frames.
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  const grow = (p: { x: number; y: number }) => { x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y); };
  for (const p of b.people) for (const q of p.path) grow(q);
  for (let t = 0; t <= b.durS; t += 0.1) grow(b.ballAt(t));
  grow({ x: CX, y: 0 });
  x1 -= 4; x2 += 4; y1 -= 4; y2 += 4;
  // Panels are 3:4 (wide:tall); fit the box.
  const W = PANEL_W, H = Math.round(PANEL_W * 4 / 3);
  const s = Math.min(W / (x2 - x1), H / (y2 - y1));
  const ox = (W - (x2 - x1) * s) / 2, oy = (H - (y2 - y1) * s) / 2;
  const X = (x: number) => ox + (x - x1) * s, Y = (y: number) => oy + (y - y1) * s;
  const pitch = [
    `<rect x="${X(0)}" y="${Y(0)}" width="${PITCH_W * s}" height="${LEN * s}" fill="#2f7d32" stroke="#e5e7eb" stroke-width="1"/>`,
    `<line x1="${X(0)}" y1="${Y(HALF_LEN)}" x2="${X(PITCH_W)}" y2="${Y(HALF_LEN)}" stroke="#e5e7eb" stroke-width="1"/>`,
    `<circle cx="${X(CX)}" cy="${Y(HALF_LEN)}" r="${CENTRE_R * s}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`,
    `<rect x="${X(BOX_L)}" y="${Y(0)}" width="${(BOX_R - BOX_L) * s}" height="${BOX_DEPTH * s}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`,
    `<rect x="${X(SIX_L)}" y="${Y(0)}" width="${(SIX_R - SIX_L) * s}" height="${SIX_DEPTH * s}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`,
    `<rect x="${X(POST_L)}" y="${Y(-1.2)}" width="${(POST_R - POST_L) * s}" height="${1.2 * s}" fill="#fff" opacity="0.8"/>`,
  ].join("");
  const fr = b.frame;
  const frameRect = `<rect x="${X(fr.x1)}" y="${Y(fr.y1)}" width="${(fr.x2 - fr.x1) * s}" height="${(fr.y2 - fr.y1) * s}" fill="none" stroke="#fde047" stroke-dasharray="4 3" stroke-width="1"/>`;
  const route: string[] = [];
  for (let t = 0; t <= b.durS; t += 0.08) { const q = b.ballAt(t); route.push(`${f1(X(q.x))},${f1(Y(q.y))}`); }
  const HZ = 15;
  const panel = (t: number, title: string) => {
    const i = Math.min(b.people[0].path.length - 1, Math.round(t * HZ));
    const trails = b.people.map((p) => {
      const pts = p.path.slice(0, i + 1).map((q) => `${f1(X(q.x))},${f1(Y(q.y))}`).join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${COL[p.side]}" stroke-opacity="0.45" stroke-width="1.2"/>`;
    }).join("");
    const r = Math.max(3.2, 0.5 * s);
    const bodies = b.people.map((p) => {
      const q = p.path[i];
      const ring = p.side === "you" ? `stroke="#f59e0b" stroke-width="2"` : `stroke="#111" stroke-width="0.8"`;
      return `<circle cx="${f1(X(q.x))}" cy="${f1(Y(q.y))}" r="${f1(r)}" fill="${COL[p.side]}" ${ring}/>` +
        `<text x="${f1(X(q.x) + r + 1)}" y="${f1(Y(q.y) - r)}" font-size="8" fill="#fff">${p.side === "you" ? "YOU" : p.role}</text>`;
    }).join("");
    const bq = b.ballAt(t);
    const ball = `<circle cx="${f1(X(bq.x))}" cy="${f1(Y(bq.y))}" r="${f1(Math.max(2.4, 0.35 * s) + bq.z * 0.4)}" fill="#111" stroke="#fff" stroke-width="1"/>`;
    return `<div class="pn"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#14532d"/>${pitch}${frameRect}<polyline points="${route.join(" ")}" fill="none" stroke="#111" stroke-dasharray="1 3" stroke-width="1.4"/>${trails}${ball}${bodies}</svg><div class="t">${title}</div></div>`;
  };
  // The checks, measured here (not taken from the generator's own list).
  let gap = Infinity, gapWho = "";
  const N = b.people[0].path.length - 1, stop = N - 9;
  for (let i = 0; i < stop; i++) for (let a = 0; a < b.people.length; a++) for (let c = a + 1; c < b.people.length; c++) {
    const d = Math.hypot(b.people[a].path[i].x - b.people[c].path[i].x, b.people[a].path[i].y - b.people[c].path[i].y);
    if (d < gap) { gap = d; gapWho = `${b.people[a].key}/${b.people[c].key} @${(i / HZ).toFixed(1)}s`; }
  }
  let vMax = 0, vWho = "";
  for (const p of b.people) { const v = maxSpeed(p.path); if (v > vMax) { vMax = v; vWho = `${p.key} (${p.role}, top ${p.vmax.toFixed(1)})`; } }
  const mid = b.durS / 2;
  const owners = b.owners.map((o) => (o.startsWith("extra") ? "x" : o)).join("→");
  const bad = b.problems.length ? `<div class="bad">${b.problems.join("; ")}</div>` : "";
  return `<div class="card"><div class="h"><b>#${n} ${sc.kind.replace(/_/g, " ")}</b> · ${label} · <b>${b.durS.toFixed(1)} s</b> · ${b.acts.length} touches ${b.signature} · ${owners}</div>` +
    `<div class="row">${panel(0, "first (0 s)")}${panel(mid, `middle (${mid.toFixed(1)} s)`)}${panel(b.durS, `last (${b.durS.toFixed(1)} s) = the chance`)}</div>` +
    `<div class="m">closest ${gap.toFixed(2)} m (${gapWho}) · fastest ${vMax.toFixed(1)} m/s ${vWho} · try ${b.tries + 1}</div>${bad}</div>`;
}

const cards = chosen.map((c, i) => card(fhrBuildUpFor(c.sc, c.moment), c.sc, `${c.moment.pattern ?? "?"} ${c.moment.lane ?? ""}`, i + 1));
const css = `body{margin:0;background:#0b0f14;color:#e5e7eb;font:12px system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(${COLS},${PANEL_W * 3 + 30}px);gap:10px;padding:10px}
.card{background:#111827;border:1px solid #374151;border-radius:6px;padding:6px}.h{font-size:11.5px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row{display:flex;gap:4px}.pn{width:${PANEL_W}px}.t{font-size:10px;color:#9ca3af;text-align:center}.m{font-size:10.5px;color:#cbd5e1;margin-top:3px}.bad{color:#f87171;font-weight:700;font-size:11px}`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: COLS * (PANEL_W * 3 + 40) + 20, height: 900 } });
const files: string[] = [];
for (let k = 0; k * per < cards.length; k++) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="grid">${cards.slice(k * per, (k + 1) * per).join("")}</div></body></html>`;
  await page.setContent(html);
  const file = `${out}/fhr-buildup-sheet-${k + 1}.jpg`;
  await page.screenshot({ path: file, type: "jpeg", quality: 82, fullPage: true });
  files.push(file);
}
await browser.close();
writeFileSync(`${out}/fhr-buildup-sheet.txt`, chosen.map((c, i) => `#${i + 1} ${c.sc.kind} match ${c.match} minute ${c.minute}`).join("\n") + "\n");
console.log(`${chosen.length} build-ups on ${files.length} sheets:\n${files.join("\n")}`);
