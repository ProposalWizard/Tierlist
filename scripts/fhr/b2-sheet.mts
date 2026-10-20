// THE B2 SHEET (Full highlights rebuild, 20 Oct 2026): 24 build-ups to check
// by eye, the mix this round added — open play (some with the extra defender
// in from off the screen), fouls before free kicks and penalties, and the big
// moment (a level final, 90th minute). CLAUDE.md: anything placed outside a
// drawing gets a sheet, and every picture is looked at.
//
//   npx tsx scripts/fhr/b2-sheet.mts [--seed=101] [--per=6] [--out=docs/handoffs/2026-10-20-builds/b2]
//
// Four frames a card: the first, the middle, the hand-over (the chance is
// yours; men still running) and the chance (once they have stopped). Colours:
// you white (gold ring), team-mates blue, team-mates only in the build-up pale
// blue, defenders red (white ring: the extra defender; black ring: the man who
// fouls you), keeper yellow; the ball black with its route dotted; the chance's
// own frame dashed; the foul spot a cross. Each card lists what the checks say.
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { fhrBuildUpFor, fhrWantsBuildUp, maxSpeed } from "../../lib/star/fhr/buildUp";
import { fhrFoulBuildUpFor, fhrWantsFoul } from "../../lib/star/fhr/foulBuildUp";
import { standBackFor, yourRunupFor, penaltyRunupOf, freeKickRunupOf } from "../../lib/star/runupStyles";
import type { Scenario, Vec2 } from "../../lib/star/canvasEngine";
import type { LeadIn } from "../../lib/star/leadIn";
import { PITCH_W, HALF_LEN, CX, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, POST_L, POST_R, CENTRE_R } from "../../lib/star/pitch";

const args = process.argv.slice(2);
const seed = Number(args.find((a) => a.startsWith("--seed="))?.slice(7) ?? 101);
const per = Number(args.find((a) => a.startsWith("--per="))?.slice(6) ?? 6);
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/handoffs/2026-10-20-builds/b2";
const LEN = 2 * HALF_LEN;
const HZ = 15;
const PANEL_W = Number(args.find((a) => a.startsWith("--w="))?.slice(4) ?? 190);
const COLS = PANEL_W > 240 ? 1 : 2;

type Person = { key: string; side: string; role: string; path: Vec2[] };
interface Card { label: string; sc: Scenario; lead: LeadIn & { people: Person[]; problems: string[] }; foulSpot?: Vec2; fouler?: string; frame?: { x1: number; x2: number; y1: number; y2: number } }

// ── The 24 ──
const served = servedChances({ count: 900, seed });
const openPool = served.filter((c) => fhrWantsBuildUp(c.sc.kind, c.moment));
const cards: Card[] = [];
// 12 open play: 6 with the extra defender, 6 without, spread over the kinds.
const withCover: Card[] = [], without: Card[] = [];
const seenKind = new Map<string, number>(), coverKind = new Map<string, number>();
for (const c of openPool) {
  if (withCover.length >= 6 && without.length >= 6) break;
  const b = fhrBuildUpFor(c.sc, c.moment);
  const n = seenKind.get(c.sc.kind) ?? 0;
  const card: Card = { label: `${c.sc.kind.replace(/_/g, " ")} · ${c.moment.pattern ?? "open play"} ${c.moment.lane ?? ""}${b.cover ? " · EXTRA DEFENDER" : ""}`, sc: c.sc, lead: b, frame: b.frame };
  if (b.cover && withCover.length < 6 && (coverKind.get(c.sc.kind) ?? 0) < 2) { withCover.push(card); coverKind.set(c.sc.kind, (coverKind.get(c.sc.kind) ?? 0) + 1); }
  else if (!b.cover && without.length < 6 && n < 2) { without.push(card); seenKind.set(c.sc.kind, n + 1); }
}
cards.push(...withCover, ...without);
// 6 free kicks and 4 penalties with the foul first (stood back for the run-up, as the match does).
let fk = 0, pen = 0;
for (const c of served) {
  if (fk >= 6 && pen >= 4) break;
  const sc = c.sc;
  if (sc.kind !== "free_kick" && sc.kind !== "penalty") continue;
  if ((sc.kind === "free_kick" && fk >= 6) || (sc.kind === "penalty" && pen >= 4)) continue;
  sc.player = standBackFor(yourRunupFor(sc.kind, penaltyRunupOf(undefined), freeKickRunupOf(undefined)), sc.ball, sc.player, sc.viewport);
  const m = { ...c.moment, fresh: true };
  if (!fhrWantsFoul(sc, m)) continue;
  const b = fhrFoulBuildUpFor(sc, m, { keepBest: true });
  if (!b) continue;
  if (sc.kind === "free_kick") fk++; else pen++;
  cards.push({ label: `${sc.kind.replace(/_/g, " ")} · THE FOUL FIRST`, sc, lead: b, foulSpot: b.foul.spot, fouler: b.foul.by, frame: sc.viewport });
}
// 2 big moments (a level final, 90th minute): one settled move, one break.
const settledBig = openPool.slice(40).find((c) => c.moment.pattern !== "transition");
const breakBig = openPool.slice(40).find((c) => c.moment.pattern === "transition");
for (const c of [settledBig, breakBig].filter((x): x is NonNullable<typeof x> => !!x)) {
  const b = fhrBuildUpFor(c.sc, { ...c.moment, minute: 90, scoreDiff: 0, stakes: "final" });
  cards.push({ label: `${c.sc.kind.replace(/_/g, " ")} · BIG MOMENT (final, 90', level)${b.cover ? " · EXTRA DEFENDER" : ""}`, sc: c.sc, lead: b, frame: b.frame });
}

const COL: Record<string, string> = { you: "#ffffff", mate: "#3b82f6", extra: "#93c5fd", opp: "#ef4444", keeper: "#facc15" };
const f1 = (v: number) => v.toFixed(1);
const at = (path: Vec2[], i: number) => path[Math.max(0, Math.min(path.length - 1, i))];
/** Sample index for time t (samples 0…N-1 at i/HZ, N at durS, run-on after). */
const idxOf = (lead: LeadIn, path: Vec2[], t: number) => {
  const N = Math.ceil(lead.durS * HZ);
  return t <= lead.durS ? Math.min(N, Math.round(t * HZ)) : Math.min(path.length - 1, N + Math.round((t - lead.durS) * HZ));
};

function card(c: Card, n: number): string {
  const { lead, sc } = c;
  const endT = lead.durS + (lead.runOnS ?? 0);
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  const grow = (p: Vec2) => { x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y); };
  for (const p of lead.people) for (const q of p.path) grow(q);
  for (let t = 0; t <= lead.durS; t += 0.1) grow(lead.ballAt(t));
  grow({ x: CX, y: 0 });
  x1 -= 4; x2 += 4; y1 -= 4; y2 += 4;
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
  const fr = c.frame;
  const frameRect = fr ? `<rect x="${X(fr.x1)}" y="${Y(fr.y1)}" width="${(fr.x2 - fr.x1) * s}" height="${(fr.y2 - fr.y1) * s}" fill="none" stroke="#fde047" stroke-dasharray="4 3" stroke-width="1"/>` : "";
  const route: string[] = [];
  for (let t = 0; t <= lead.durS; t += 0.08) { const q = lead.ballAt(t); route.push(`${f1(X(q.x))},${f1(Y(q.y))}`); }
  const foul = c.foulSpot ? `<g stroke="#000" stroke-width="2"><line x1="${X(c.foulSpot.x) - 5}" y1="${Y(c.foulSpot.y) - 5}" x2="${X(c.foulSpot.x) + 5}" y2="${Y(c.foulSpot.y) + 5}"/><line x1="${X(c.foulSpot.x) + 5}" y1="${Y(c.foulSpot.y) - 5}" x2="${X(c.foulSpot.x) - 5}" y2="${Y(c.foulSpot.y) + 5}"/></g>` : "";
  const panel = (t: number, title: string) => {
    const trails = lead.people.map((p) => {
      const i = idxOf(lead, p.path, t);
      const pts = p.path.slice(0, i + 1).map((q) => `${f1(X(q.x))},${f1(Y(q.y))}`).join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${COL[p.side] ?? "#fff"}" stroke-opacity="0.45" stroke-width="1.2"/>`;
    }).join("");
    const r = Math.max(3.2, 0.5 * s);
    const bodies = lead.people.map((p) => {
      const q = at(p.path, idxOf(lead, p.path, t));
      const ring = p.side === "you" ? `stroke="#f59e0b" stroke-width="2"` : p.key.startsWith("cover") ? `stroke="#fff" stroke-width="2.4"` : p.key === c.fouler ? `stroke="#000" stroke-width="2.4"` : `stroke="#111" stroke-width="0.8"`;
      return `<circle cx="${f1(X(q.x))}" cy="${f1(Y(q.y))}" r="${f1(r)}" fill="${COL[p.side] ?? "#fff"}" ${ring}/>`;
    }).join("");
    const bq = lead.ballAt(Math.min(t, lead.durS));
    const ball = `<circle cx="${f1(X(bq.x))}" cy="${f1(Y(bq.y))}" r="${f1(Math.max(2.4, 0.35 * s) + bq.z * 0.4)}" fill="#111" stroke="#fff" stroke-width="1"/>`;
    return `<div class="pn"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#14532d"/>${pitch}${frameRect}<polyline points="${route.join(" ")}" fill="none" stroke="#111" stroke-dasharray="1 3" stroke-width="1.4"/>${foul}${trails}${ball}${bodies}</svg><div class="t">${title}</div></div>`;
  };
  // Measured here: the closest two men (not the last second; not you and the man fouling you at the foul) and the fastest.
  let gap = Infinity, gapWho = "";
  const lastT = endT - 1;
  for (let t = 0; t < lastT; t += 1 / HZ) {
    for (let a = 0; a < lead.people.length; a++) for (let b = a + 1; b < lead.people.length; b++) {
      const pa = lead.people[a], pb = lead.people[b];
      const pair = c.fouler && ((pa.key === "you" && pb.key === c.fouler) || (pb.key === "you" && pa.key === c.fouler));
      if (pair) continue;
      const qa = at(pa.path, idxOf(lead, pa.path, t)), qb = at(pb.path, idxOf(lead, pb.path, t));
      const d = Math.hypot(qa.x - qb.x, qa.y - qb.y);
      if (d < gap) { gap = d; gapWho = `${pa.key}/${pb.key} @${t.toFixed(1)}s`; }
    }
  }
  let vMax = 0, vWho = "";
  for (const p of lead.people) { const v = maxSpeed(p.path); if (v > vMax) { vMax = v; vWho = p.key; } }
  const bad = lead.problems.length ? `<div class="bad">${lead.problems.join("; ")}</div>` : "";
  const mid = lead.durS / 2;
  return `<div class="card"><div class="h"><b>#${n} ${c.label}</b> · ${lead.durS.toFixed(1)} s${lead.runOnS ? ` + ${lead.runOnS.toFixed(1)} s still running (${lead.runOnKeys?.length} men)` : ""}</div>` +
    `<div class="row">${panel(0, "first (0 s)")}${panel(mid, `middle (${mid.toFixed(1)} s)`)}${panel(lead.durS, `hand-over (${lead.durS.toFixed(1)} s)`)}${panel(endT, "the chance")}</div>` +
    `<div class="m">closest ${gap.toFixed(2)} m (${gapWho}) · fastest ${vMax.toFixed(1)} m/s (${vWho})${c.foulSpot ? ` · foul at ${(lead as unknown as { foul: { at: number } }).foul.at.toFixed(1)} s` : ""}</div>${bad}</div>`;
}

const html = cards.map((c, i) => card(c, i + 1));
const css = `body{margin:0;background:#0b0f14;color:#e5e7eb;font:12px system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(${COLS},${PANEL_W * 4 + 40}px);gap:10px;padding:10px}
.card{background:#111827;border:1px solid #374151;border-radius:6px;padding:6px}.h{font-size:11.5px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row{display:flex;gap:4px}.pn{width:${PANEL_W}px}.t{font-size:10px;color:#cbd5e1;text-align:center}.m{font-size:10.5px;color:#cbd5e1;margin-top:3px}.bad{color:#f87171;font-weight:700;font-size:11px}`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: COLS * (PANEL_W * 4 + 50) + 20, height: 900 } });
const files: string[] = [];
for (let k = 0; k * per < html.length; k++) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="grid">${html.slice(k * per, (k + 1) * per).join("")}</div></body></html>`);
  const file = `${out}/b2-sheet-${k + 1}.jpg`;
  await page.screenshot({ path: file, type: "jpeg", quality: 68, fullPage: true });
  files.push(file);
}
await browser.close();
writeFileSync(`${out}/b2-sheet.txt`, cards.map((c, i) => `#${i + 1} ${c.label} · ${c.lead.durS.toFixed(2)} s · problems: ${c.lead.problems.join("; ") || "none"}`).join("\n") + "\n");
console.log(`${cards.length} build-ups on ${files.length} sheets:\n${files.join("\n")}`);
