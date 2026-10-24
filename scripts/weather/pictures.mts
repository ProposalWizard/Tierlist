/**
 * ONE PICTURE PER CONDITION for the patch notes (hub, 22 Oct 2026).
 *   npx tsx scripts/weather/pictures.mts            writes docs/handoffs/2026-10-22-leo-tonight/chat4/pictures/cards.html
 *   node scripts/weather/shoot-pictures.mjs         turns each card into a JPEG next to it
 * Each card: the strike from above, this condition (solid) over the clear
 * day (dashed), the side view, and carry / sideways / bounce / roll averaged
 * over 200 strikes, against clear. The Old ball (the game's default).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { buildConditions, CLEAR_DIALS, flyBall, measure, STRIKES, windWords, type Flight, type WeatherDials } from "../../lib/star/weatherLab";

const OUT = new URL("../../docs/handoffs/2026-10-22-leo-tonight/chat4/pictures/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const S = Object.fromEntries(STRIKES.map((s) => [s.id, s]));

const CARDS: { id: string; title: string; strike: string; d: Partial<WeatherDials>; line: string }[] = [
  { id: "wind-across", title: "Wind across", strike: "long", d: { weather: "wind", windSpeed: 10, windTo: 90 }, line: "A 10 m/s wind left to right bends a long ball." },
  { id: "wind-face", title: "Wind in your face", strike: "long", d: { weather: "wind", windSpeed: 10, windTo: 180 }, line: "A head wind holds a long ball up and drops it short." },
  { id: "wind-behind", title: "Wind behind you", strike: "long", d: { weather: "wind", windSpeed: 10, windTo: 0 }, line: "A tail wind carries it on." },
  { id: "gale-lofted", title: "A gale across", strike: "chip", d: { weather: "wind", windSpeed: 17, windTo: 270 }, line: "A 17 m/s gale right to left takes a lofted pass with it." },
  { id: "rain", title: "Rain", strike: "driven", d: { weather: "rain" }, line: "It skids off the wet grass and runs on." },
  { id: "heavy", title: "Heavy rain", strike: "chip", d: { weather: "heavy" }, line: "A slow, wet pitch: it sits down and dies." },
  { id: "dry-poor", title: "A poor pitch in a dry spell", strike: "long", d: { pitch: 0.45, ground: "dry" }, line: "Baked and bare: a long ball hardly bounces and runs out sooner." },
  { id: "dry-worst", title: "The worst pitch, dry", strike: "chip", d: { pitch: 0.25, ground: "dry" }, line: "No bounce to speak of, and it stops dead at a crawl." },
];

// The ball goes left to right; right of the shooter (+x) is down the card.
const W = 720;
let PX = 6, LANE = 16, H = 20 + 2 * LANE * PX + 20;   // PX px a metre, both ways
const fx = (y: number) => 30 + y * PX;
const path = (f: Flight) => f.path.map((p) => `${fx(p.y).toFixed(1)},${(20 + (LANE + p.x) * PX).toFixed(1)}`).join(" ");
const sv = (f: Flight, top: number) => f.path.map((p) => `${fx(Math.hypot(p.x, p.y)).toFixed(1)},${(118 - (p.z / top) * 100).toFixed(1)}`).join(" ");

function arrow(to: number, speed: number): string {
  if (!speed) return "";
  // On the card the ball goes left to right, so "towards the goal" (0°) is right; "left to right" (90°) is down the card.
  const a = to * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  const cx = W - 60, cy = 52, L = 26;
  return `<g><circle cx="${cx}" cy="${cy}" r="34" fill="rgba(0,0,0,.25)"/><line x1="${cx - dx * L}" y1="${cy - dy * L}" x2="${cx + dx * L * 0.55}" y2="${cy + dy * L * 0.55}" stroke="#ffc24a" stroke-width="5" stroke-linecap="round"/>
  <polygon points="${cx + dx * L},${cy + dy * L} ${cx + dx * L * 0.35 - dy * 10},${cy + dy * L * 0.35 + dx * 10} ${cx + dx * L * 0.35 + dy * 10},${cy + dy * L * 0.35 - dx * 10}" fill="#ffc24a"/>
  <text x="${cx}" y="${cy + 50}" text-anchor="middle" font-size="12" fill="#fde68a" font-weight="800">${speed} m/s</text></g>`;
}

const sg = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)} m`;
let html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#06102a;font-family:Inter,system-ui,sans-serif;color:#eef4ff}
.card{width:${W + 40}px;padding:20px;box-sizing:border-box;background:linear-gradient(180deg,#0e2862,#061436);margin:0 0 12px}
h2{margin:0;font-size:26px;font-weight:900;letter-spacing:-.01em}.line{color:#a9bde2;font-size:15px;margin:2px 0 12px}
.nums{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.n{background:rgba(255,255,255,.06);padding:8px 10px}
.n b{display:block;font-size:22px}.n span{font-size:12px;color:#a9bde2}.n i{font-style:normal;font-size:13px;color:#ffc24a;font-weight:800}
.key{font-size:12px;color:#a9bde2;margin-top:6px}</style>`;
for (const c of CARDS) {
  const st = S[c.strike];
  const clearC = buildConditions(CLEAR_DIALS), cond = buildConditions({ ...CLEAR_DIALS, ...c.d });
  const a = flyBall(st.speed, st.angle, clearC, "old"), b = flyBall(st.speed, st.angle, cond, "old");
  const ma = measure(st, clearC, "old"), mb = measure(st, cond, "old");
  const far = Math.max(110, ...a.path.map((p) => p.y), ...b.path.map((p) => p.y)) + 6;
  PX = (W - 40) / far;
  LANE = Math.max(10, Math.ceil(Math.max(...a.path.map((p) => Math.abs(p.x)), ...b.path.map((p) => Math.abs(p.x))) + 4));
  H = 20 + 2 * LANE * PX + 20;
  const top = Math.max(1.5, ...a.path.map((p) => p.z), ...b.path.map((p) => p.z)) * 1.1;
  const lines = Array.from({ length: Math.floor((W - 40) / PX / 10) + 1 }, (_, i) => `<line x1="${fx(i * 10)}" x2="${fx(i * 10)}" y1="20" y2="${H - 20}" stroke="rgba(255,255,255,.12)"/><text x="${fx(i * 10) + 3}" y="${H - 6}" font-size="11" fill="rgba(255,255,255,.6)">${i * 10} m</text>`).join("");
  const air = (f: Flight) => f.path.filter((p) => p.z > 0.15).map((p) => `${fx(p.y).toFixed(1)},${(20 + (LANE + p.x) * PX).toFixed(1)}`).join(" ");
  const end = (f: Flight) => f.path[f.path.length - 1];
  html += `<section class="card" id="${c.id}"><h2>${c.title}</h2><div class="line">${c.line} ${st.name}, ${st.speed} m/s.</div>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;background:linear-gradient(90deg,#1f6b3a,#1a5e33)">${lines}
<line x1="20" x2="${W}" y1="${20 + LANE * PX}" y2="${20 + LANE * PX}" stroke="rgba(255,255,255,.18)" stroke-dasharray="2 6"/>
<polyline points="${path(a)}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.5" stroke-dasharray="6 5"/>
<polyline points="${path(b)}" fill="none" stroke="#fde68a" stroke-width="2.5"/><polyline points="${air(b)}" fill="none" stroke="#fff" stroke-width="4"/>
<circle cx="${fx(end(a).y)}" cy="${20 + (LANE + end(a).x) * PX}" r="6" fill="none" stroke="#fff" stroke-width="2"/>
<circle cx="${fx(end(b).y)}" cy="${20 + (LANE + end(b).x) * PX}" r="7" fill="#fff" stroke="#111" stroke-width="2"/>
<circle cx="${fx(30)}" cy="${20 + LANE * PX}" r="0"/>${c.d.windSpeed ? arrow(c.d.windTo ?? 0, c.d.windSpeed) : ""}</svg>
<svg width="${W}" height="130" viewBox="0 0 ${W} 130" style="display:block;background:rgba(255,255,255,.04);margin-top:6px">
<line x1="20" x2="${W}" y1="118" y2="118" stroke="#34e08b" stroke-width="2"/><text x="24" y="16" font-size="11" fill="#6f86b3">from the side · ${top.toFixed(1)} m high</text>
<polyline points="${sv(a, top)}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-dasharray="6 5"/><polyline points="${sv(b, top)}" fill="none" stroke="#ffc24a" stroke-width="2.5"/></svg>
<div class="key">Solid: ${c.title.toLowerCase()} · dashed: a clear day, perfect pitch · white = in the air · dots = where it stops${c.d.windSpeed ? ` · wind ${windWords(c.d.windTo ?? 0)}` : ""}</div>
<div class="nums">
<div class="n"><span>Carry</span><b>${mb.carry.toFixed(1)} m</b><i>${sg(mb.carry - ma.carry)}</i></div>
<div class="n"><span>Sideways at the bounce</span><b>${Math.abs(mb.drift - ma.drift).toFixed(1)} m</b><i>${Math.abs(mb.drift - ma.drift) < 0.05 ? "none" : (mb.drift > ma.drift ? "to the right" : "to the left")}</i></div>
<div class="n"><span>Bounce</span><b>${mb.bounce.toFixed(1)} m</b><i>${sg(mb.bounce - ma.bounce)}</i></div>
<div class="n"><span>Roll after</span><b>${mb.roll.toFixed(1)} m</b><i>${sg(mb.roll - ma.roll)}</i></div>
</div><div class="key">Averages of 200 strikes against a clear day. Old ball (the game's default).</div></section>`;
}
writeFileSync(new URL("cards.html", OUT), html);
console.log("wrote", CARDS.length, "cards");
