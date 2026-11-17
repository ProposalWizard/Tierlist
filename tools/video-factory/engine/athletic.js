// "Explainer" look (Mikey, 17 Nov 2026): a full-screen illustrated short in the style of the big football
// explainer accounts. A bold flat colour per idea with grain, drawn props and people, something moving all
// the time, a circle-wipe into each new idea, 2-3 word captions (yellow on a dark box) and a big white hook.
// Every scene draws the whole 1080x1920 frame at time t (seconds into its line) of a line lasting `dur`.
// People are drawn silhouettes until illustrated portraits exist: scene.image (a transparent PNG in
// STORY.images) replaces a silhouette when given.
(() => {
const W = 1080, H = 1920;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ez = (x) => { x = cl(x); return 1 - Math.pow(1 - x, 3); };
const inout = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const pop = (x) => { x = cl(x); const s = 2.2; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const PAL = { red: ["#e2384a", "#a8182c"], teal: ["#5ec8d8", "#1f7f8f"], green: ["#7fe3a1", "#2f9a5c"], pink: ["#f08ad2", "#a2338a"],
  purple: ["#8f5cf0", "#3b1f9a"], orange: ["#f5913a", "#c2410c"], yellow: ["#ffd84a", "#e0a400"], navy: ["#24345e", "#0d1530"], blue: ["#4c8cf0", "#1d3fa0"] };
const INK = "#1b1416", YEL = "#ffd400";

// ── grain, made once ──
const grain = document.createElement("canvas"); grain.width = 540; grain.height = 960;
{ const gg = grain.getContext("2d"); const im = gg.createImageData(540, 960); let s = 7;
  for (let i = 0; i < im.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = s % 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 22; }
  gg.putImageData(im, 0, 0); }

let THon = false;
function bg(g, pal, t = 0) {
  const TH = (window.STORY && window.STORY.theme) || {};   // read late: timeline.js loads after this file
  if (!THon && TH.palette) { Object.assign(PAL, TH.palette); THon = true; }
  if (TH.mono) pal = TH.mono;
  const [a, b] = PAL[pal] || PAL.teal;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(540, 760, 120, 540, 760, 1300); rg.addColorStop(0, "rgba(255,255,255,.18)"); rg.addColorStop(1, "rgba(0,0,0,.22)"); g.fillStyle = rg; g.fillRect(0, 0, W, H);
}
function finish(g, t) { g.save(); g.globalCompositeOperation = "overlay"; g.drawImage(grain, (t * 37) % 40 - 40, (t * 23) % 40 - 40, W + 80, H + 80); g.restore(); }

function T(g, s, x, y, size, o = {}) {
  g.save(); g.font = `${o.weight || 400} ${size}px ${o.font || "Anton"}`; g.textAlign = o.align || "center"; g.textBaseline = o.base || "alphabetic";
  if (o.maxW) { const w = g.measureText(s).width; if (w > o.maxW) { size *= o.maxW / w; g.font = `${o.weight || 400} ${size}px ${o.font || "Anton"}`; } }
  g.globalAlpha = o.alpha ?? 1;
  if (o.shadow) { g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 0; g.shadowOffsetX = 6; g.shadowOffsetY = 8; }
  if (o.stroke) { g.lineJoin = "round"; g.lineWidth = o.stroke; g.strokeStyle = o.strokeColor || INK; g.strokeText(s, x, y); }
  g.fillStyle = o.color || "#fff"; g.fillText(s, x, y); g.restore();
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function card(g, x, y, w, h, fill = "#fff", r = 26) { g.save(); g.fillStyle = "rgba(0,0,0,.25)"; rr(g, x + 10, y + 14, w, h, r); g.fill(); g.fillStyle = fill; g.lineWidth = 6; g.strokeStyle = INK; rr(g, x, y, w, h, r); g.fill(); g.stroke(); g.restore(); }

// ── drawn people: a dark silhouette with a light rim (the faceless style), or a portrait image ──
const IMG = {};
function person(g, x, y, s, o = {}) {
  const im = o.image && IMG[o.image] && IMG[o.image].naturalWidth ? IMG[o.image] : null;
  if (im) { const w = 760 * s, h = w * im.height / im.width; g.drawImage(im, x - w / 2, y - h, w, h); return; }
  g.save(); g.translate(x, y); g.scale(s, s);
  const body = o.color || "#2a1f22", rim = o.rim || "rgba(255,255,255,.55)";
  // shoulders and suit
  g.fillStyle = body; g.beginPath(); g.moveTo(-330, 0); g.bezierCurveTo(-330, -230, -250, -330, -120, -360); g.lineTo(120, -360); g.bezierCurveTo(250, -330, 330, -230, 330, 0); g.closePath(); g.fill();
  if (o.suit !== false) { g.fillStyle = o.shirt || "#f2f2f2"; g.beginPath(); g.moveTo(-70, -360); g.lineTo(0, -230); g.lineTo(70, -360); g.closePath(); g.fill();
    g.fillStyle = o.tie || "#1d2a4a"; g.beginPath(); g.moveTo(-14, -330); g.lineTo(14, -330); g.lineTo(22, -200); g.lineTo(0, -170); g.lineTo(-22, -200); g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 8; g.beginPath(); g.moveTo(-70, -360); g.lineTo(-30, -120); g.moveTo(70, -360); g.lineTo(30, -120); g.stroke(); }
  // neck and head
  g.fillStyle = body; rr(g, -55, -440, 110, 110, 30); g.fill();
  g.beginPath(); g.ellipse(0, -560, 120, 150, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(-118, -555, 22, 40, 0, 0, 7); g.ellipse(118, -555, 22, 40, 0, 0, 7); g.fill();
  // hair
  g.fillStyle = o.hair || "#3a2c2a"; g.beginPath();
  if (o.hairStyle === "slick") { g.moveTo(-122, -560); g.bezierCurveTo(-130, -700, 120, -740, 124, -585); g.bezierCurveTo(60, -660, -40, -650, -122, -560); }
  else if (o.hairStyle === "bald") { g.moveTo(-121, -565); g.bezierCurveTo(-128, -620, -110, -640, -95, -600); g.moveTo(121, -565); g.bezierCurveTo(128, -620, 110, -640, 95, -600); }
  else { g.moveTo(-124, -560); g.bezierCurveTo(-140, -720, 140, -720, 124, -560); g.bezierCurveTo(80, -640, -80, -640, -124, -560); }
  g.fill();
  // rim light
  g.strokeStyle = rim; g.lineWidth = 7; g.beginPath(); g.ellipse(0, -560, 120, 150, 0, -0.6, 0.9); g.stroke();
  g.beginPath(); g.moveTo(330, 0); g.bezierCurveTo(330, -230, 250, -330, 120, -360); g.stroke();
  g.restore();
}
function nameTag(g, s, x, y, k) { if (k <= 0) return; g.save(); g.translate(x, y); g.scale(pop(k), pop(k)); g.font = "64px Anton"; const w = g.measureText(s).width + 50;
  g.fillStyle = INK; rr(g, -w / 2, -62, w, 84, 10); g.fill(); g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(s, 0, 0); g.restore(); }

// ── props ──
function shirt(g, x, y, s, c1, c2, txt, num) {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = "round";
  const path = () => { g.beginPath(); g.moveTo(-120, -260); g.lineTo(-300, -180); g.lineTo(-250, -40); g.lineTo(-190, -70); g.lineTo(-190, 240); g.lineTo(190, 240); g.lineTo(190, -70); g.lineTo(250, -40); g.lineTo(300, -180); g.lineTo(120, -260); g.bezierCurveTo(80, -200, -80, -200, -120, -260); g.closePath(); };
  path(); g.fillStyle = c1; g.fill(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke();
  g.fillStyle = c2; g.beginPath(); g.moveTo(-120, -260); g.bezierCurveTo(-80, -200, 80, -200, 120, -260); g.lineTo(100, -268); g.bezierCurveTo(60, -215, -60, -215, -100, -268); g.fill();
  if (txt) T(g, txt, 0, -110, 70, { color: c2 });
  if (num) T(g, num, 0, 130, 240, { color: c2 });
  g.restore();
}
function trophy(g, x, y, s, col = "#f2c230", kind = "cup") {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineWidth = 8; g.strokeStyle = INK; g.fillStyle = col;
  if (kind === "plate") { g.beginPath(); g.ellipse(0, -120, 110, 110, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.ellipse(0, -120, 70, 70, 0, 0, 7); g.stroke(); rr(g, -40, -10, 80, 40, 8); g.fill(); g.stroke(); }
  else if (kind === "bigears") { g.beginPath(); g.moveTo(-90, -260); g.lineTo(90, -260); g.bezierCurveTo(90, -120, 40, -90, 20, -60); g.lineTo(-20, -60); g.bezierCurveTo(-40, -90, -90, -120, -90, -260); g.fill(); g.stroke();
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 110, -190, 45, 70, 0, 0, 7); g.stroke(); }
    rr(g, -60, -60, 120, 60, 10); g.fill(); g.stroke(); }
  else { g.beginPath(); g.moveTo(-100, -260); g.lineTo(100, -260); g.bezierCurveTo(100, -140, 40, -110, 18, -80); g.lineTo(-18, -80); g.bezierCurveTo(-40, -110, -100, -140, -100, -260); g.fill(); g.stroke();
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 100, -200, 45, sx > 0 ? -1.4 : 1.7, sx > 0 ? 1.4 : 4.6); g.stroke(); }
    rr(g, -30, -80, 60, 40, 6); g.fill(); g.stroke(); rr(g, -70, -40, 140, 50, 10); g.fill(); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.ellipse(-45, -210, 14, 34, 0.2, 0, 7); g.fill();
  g.restore();
}
function calendar(g, x, y, s, top, big, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  card(g, -170, -170, 340, 360, "#fff", 30);
  g.fillStyle = o.head || "#e2384a"; rr(g, -170, -170, 340, 110, 30); g.fill(); g.fillRect(-170, -100, 340, 40);
  g.lineWidth = 6; g.strokeStyle = INK; rr(g, -170, -170, 340, 360, 30); g.stroke();
  T(g, top, 0, -92, 58); T(g, big, 0, 120, big.length > 3 ? 120 : 170, { color: INK });
  if (o.cross > 0) { g.strokeStyle = "#e2384a"; g.lineWidth = 26; g.lineCap = "round"; const k = cl(o.cross); g.beginPath(); g.moveTo(-140, -140); g.lineTo(-140 + 280 * cl(k * 2), -140 + 300 * cl(k * 2)); if (k > 0.5) { g.moveTo(140, -140); g.lineTo(140 - 280 * cl(k * 2 - 1), -140 + 300 * cl(k * 2 - 1)); } g.stroke(); }
  if (o.tick > 0) { g.strokeStyle = "#1ea85a"; g.lineWidth = 30; g.lineCap = "round"; g.lineJoin = "round"; const k = cl(o.tick); g.beginPath(); g.moveTo(-90, 40); g.lineTo(-90 + 70 * cl(k * 2.5), 40 + 70 * cl(k * 2.5)); if (k > 0.4) g.lineTo(-20 + 150 * cl((k - 0.4) * 1.7), 110 - 210 * cl((k - 0.4) * 1.7)); g.stroke(); }
  g.restore();
}
function pitch(g, x0, y0, w, h) {
  g.save(); g.fillStyle = "#2f9a4e"; rr(g, x0, y0, w, h, 24); g.fill();
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)"; g.fillRect(x0, y0 + i * h / 8, w, h / 8); }
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 6; rr(g, x0 + 20, y0 + 20, w - 40, h - 40, 6); g.stroke();
  g.beginPath(); g.moveTo(x0 + 20, y0 + h / 2); g.lineTo(x0 + w - 20, y0 + h / 2); g.stroke(); g.beginPath(); g.arc(x0 + w / 2, y0 + h / 2, 90, 0, 7); g.stroke();
  g.strokeRect(x0 + w / 2 - 170, y0 + 20, 340, 150); g.strokeRect(x0 + w / 2 - 170, y0 + h - 170, 340, 150);
  g.restore();
}
function dot(g, x, y, r, fill, label) { g.save(); g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.arc(x + 5, y + 7, r, 0, 7); g.fill(); g.fillStyle = fill; g.lineWidth = 6; g.strokeStyle = INK; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); if (label) T(g, label, x, y + r * 0.36, r * 0.95, { color: "#fff" }); g.restore(); }
function arrow(g, x1, y1, x2, y2, k, col = "#fff", w = 14, curve = 0) {
  if (k <= 0) return; const mx = (x1 + x2) / 2 - (y2 - y1) * curve, my = (y1 + y2) / 2 + (x2 - x1) * curve;
  const pt = (u) => [(1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2];
  g.save(); g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.setLineDash([w * 1.6, w * 1.2]); g.beginPath(); for (let i = 0; i <= 30; i++) { const [px, py] = pt(i / 30 * k); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.setLineDash([]);
  const [ax, ay] = pt(k), [bx, by] = pt(Math.max(0, k - 0.04)); const an = Math.atan2(ay - by, ax - bx);
  g.fillStyle = col; g.beginPath(); g.moveTo(ax + Math.cos(an) * w * 2, ay + Math.sin(an) * w * 2); g.lineTo(ax + Math.cos(an + 2.4) * w * 2.2, ay + Math.sin(an + 2.4) * w * 2.2); g.lineTo(ax + Math.cos(an - 2.4) * w * 2.2, ay + Math.sin(an - 2.4) * w * 2.2); g.fill(); g.restore();
}
const lerp = (a, b, k) => a + (b - a) * k;

// formation positions on a vertical pitch (x 0..1, y 0..1, own goal at the bottom)
const F4231 = [[0.5, 0.93], [0.15, 0.74], [0.38, 0.78], [0.62, 0.78], [0.85, 0.74], [0.37, 0.62], [0.63, 0.62], [0.16, 0.44], [0.5, 0.47], [0.84, 0.44], [0.5, 0.29]];
const PX = 110, PY = 430, PW = 860, PH = 1180;
const fp = ([x, y]) => [PX + x * PW, PY + y * PH];

// ── the scenes ──
const S = {};
// a person on a colour, sliding up into frame, slow push; props around
S.portrait = (g, t, dur, sc) => {
  bg(g, sc.bg || "red", t); const k = ez(t * 2.2), z = 1 + 0.05 * (t / dur);
  g.save(); g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000);
  if (sc.shirt) shirt(g, 540, 640 - 60 * ez(t * 1.5), 1.25, sc.shirt[0], sc.shirt[1], sc.shirt[2], sc.shirt[3]);
  if (sc.person !== false) person(g, 540, 1920 + 360 * (1 - k), sc.scale || 1.55, sc.person || {});
  if (sc.stamp) { const s = cl((t - 0.5) * 3); if (s > 0) { g.save(); g.translate(540, 520); g.rotate(-0.18); g.scale(2.4 - 1.4 * pop(s), 2.4 - 1.4 * pop(s)); g.globalAlpha = cl(s * 2); g.strokeStyle = "#e2384a"; g.lineWidth = 14; rr(g, -260, -90, 520, 150, 16); g.stroke(); T(g, sc.stamp, 0, 40, 120, { color: "#e2384a" }); g.restore(); } }
  g.restore();
  if (sc.name) nameTag(g, sc.name, 540, 1700, cl((t - 0.3) * 3));
};
// the bottom of the table: rows slide in, United's row lights up in the red zone
S.table = (g, t, dur, sc) => {
  bg(g, sc.bg || "navy", t); const rows = sc.rows; const y0 = 520, rh = 128;
  T(g, sc.title || "PREMIER LEAGUE", 540, 420, 64, { color: YEL });
  rows.forEach((r, i) => {
    const k = ez((t - 0.12 * i) * 3); if (k <= 0) return; const y = y0 + i * rh, x = 90 + (1 - k) * 900, hi = r.hi;
    g.save(); g.globalAlpha = k; card(g, x, y, 900, 108, hi ? "#e2384a" : (r.zone ? "#ffd6db" : "#fff"), 18);
    T(g, String(r.pos), x + 70, y + 76, 60, { color: hi ? "#fff" : INK }); T(g, r.name, x + 140, y + 76, 58, { color: hi ? "#fff" : INK, align: "left", maxW: 520 });
    T(g, String(r.pts), x + 840, y + 76, 60, { color: hi ? "#fff" : INK, align: "right" }); g.restore();
  });
  const zy = y0 + ((sc.zoneFrom || 99) - 1) * rh - 22; const zk = sc.zoneFrom ? ez((t - 1.0) * 2) : 0;
  if (zk > 0) { g.save(); g.globalAlpha = zk; g.strokeStyle = "#fff"; g.lineWidth = 6; g.setLineDash([22, 16]); g.beginPath(); g.moveTo(60, zy); g.lineTo(1020, zy); g.stroke(); g.restore(); T(g, "RELEGATION ZONE", 540, zy + 3 * rh + 75, 52, { alpha: zk, color: "#fff" }); }
};
// a row of result tiles, one per game, popping in time
S.tiles = (g, t, dur, sc) => {
  bg(g, sc.bg || "navy", t); const res = sc.results, n = res.length, cols = 5, sz = 170, gap = 26;
  const x0 = 540 - (cols * sz + (cols - 1) * gap) / 2, y0 = 640;
  T(g, sc.title || "", 540, 540, 70, { color: YEL });
  res.forEach((r, i) => { const k = cl((t - 0.15 - i * (dur * 0.6 / n)) * 5); if (k <= 0) return; const cx = x0 + (i % cols) * (sz + gap) + sz / 2, cy = y0 + Math.floor(i / cols) * (sz + gap) + sz / 2;
    g.save(); g.translate(cx, cy); g.scale(pop(k), pop(k)); card(g, -sz / 2, -sz / 2, sz, sz, r === "W" ? "#1ea85a" : r === "D" ? "#9aa3ad" : "#e2384a", 22); T(g, r, 0, 42, 120, { color: "#fff" }); g.restore(); });
  const tot = { W: 0, D: 0, L: 0 }; res.forEach((r, i) => { if (t > 0.15 + i * (dur * 0.6 / n)) tot[r]++; });
  T(g, `${tot.W}W  ${tot.D}D  ${tot.L}L`, 540, 1180, 110, { shadow: true });
};
// calendar cards: years crossed out, then the one that happened
S.years = (g, t, dur, sc) => {
  bg(g, sc.bg || "purple", t); const items = sc.items, n = items.length;
  items.forEach((it, i) => { const k = ez((t - i * 0.55) * 2.5); if (k <= 0) return; const x = 540 + (i - (n - 1) / 2) * 330, y = 820 + (1 - k) * 900;
    calendar(g, x, y, 0.9, it.top || "", it.year, { head: it.head, cross: it.cross ? (t - i * 0.55 - 0.6) * 2 : 0, tick: it.tick ? (t - i * 0.55 - 0.6) * 2 : 0 });
    if (it.label) T(g, it.label, x, y + 260, 46, { maxW: 300, alpha: cl((t - i * 0.55 - 0.5) * 3) }); });
};
// a big number counting up, with a word under it
S.counter = (g, t, dur, sc) => {
  bg(g, sc.bg || "teal", t); const k = ez(t / Math.min(1.4, dur * 0.6)); const v = sc.from + (sc.to - sc.from) * k;
  if (sc.prop === "contract") { g.save(); g.translate(540, 760); g.rotate(-0.06 + 0.02 * Math.sin(t)); card(g, -300, -380, 600, 760, "#fbf7ea", 16); for (let i = 0; i < 9; i++) { g.fillStyle = "rgba(0,0,0,.15)"; g.fillRect(-230, -300 + i * 56, i === 8 ? 220 : 460, 14); }
    g.strokeStyle = "#1d3fa0"; g.lineWidth = 8; g.beginPath(); for (let i = 0; i <= 40 * cl(t * 1.2); i++) { const u = i / 40; g.lineTo(-180 + 360 * u, 270 + Math.sin(u * 18) * 24 * (1 - u)); } g.stroke(); g.restore(); }
  if (sc.prop === "calendar") calendar(g, 540, 700, 1.3, sc.top || "", String(Math.round(v)), { head: "#e2384a" });
  const nf = (x) => sc.dec ? x.toFixed(sc.dec) : (sc.comma ? Math.round(x).toLocaleString("en-GB") : String(Math.round(x)));
  const txt = sc.fmt ? sc.fmt.replace("{v}", nf(v)) : nf(v);
  const ty = sc.prop ? 1250 : 1000;
  if (sc.prop !== "calendar") T(g, txt, 540, ty, sc.size || 300, { shadow: true, stroke: 14 });
  if (sc.word) T(g, sc.word, 540, ty + 110, 80, { alpha: cl((t - 0.4) * 3), color: YEL, stroke: 10 });
};
// the formation: eleven dots fly in and settle into 4-2-3-1
S.formation = (g, t, dur, sc) => {
  bg(g, sc.bg || "green", t); pitch(g, PX, PY, PW, PH);
  F4231.forEach((p, i) => { const k = pop(cl((t - 0.08 * i) * 2.4)); if (k <= 0) return; const [x, y] = fp(p); const sx = 540 + Math.cos(i * 2.3) * 900, sy = 960 + Math.sin(i * 1.7) * 1200;
    dot(g, lerp(sx, x, k), lerp(sy, y, k), 44, i === 0 ? "#ffd400" : "#e2384a"); });
  const lk = ez((t - 1.1) * 2); if (lk > 0) T(g, sc.label || "4-2-3-1", 540, 360, 120, { alpha: lk, shadow: true });
};
// the press: the shape steps up, three swarm the man on the ball, it's won, and away
S.press = (g, t, dur, sc) => {
  bg(g, sc.bg || "green", t); pitch(g, PX, PY, PW, PH);
  const up = inout(cl((t - 0.2) / 1.2)) * 0.13; const carrier = [0.42, 0.24];
  const opp = [[0.5, 0.06], [0.2, 0.18], [0.42, 0.24], [0.62, 0.17], [0.82, 0.2]];
  opp.forEach((p, i) => { const [x, y] = fp(p); dot(g, x, y, 38, "#4c8cf0"); });
  const won = cl((t - 1.6) * 3), runK = ez((t - 1.9) / 1.0);
  F4231.forEach((p, i) => { let [x, y] = fp([p[0], p[1] - up]); if ([7, 8, 10].includes(i)) { const [cx, cy] = fp(carrier); const sw = inout(cl((t - 0.8) / 0.8)); x = lerp(x, cx + Math.cos(i) * 70, sw); y = lerp(y, cy + 60 + Math.sin(i) * 40, sw); } dot(g, x, y, 44, i === 0 ? "#ffd400" : "#e2384a"); });
  const [cx, cy] = fp(carrier); const [gx, gy] = [540, PY + 40];
  const bx = won > 0 ? lerp(cx + 30, gx, runK) : cx + 30, by = won > 0 ? lerp(cy + 50, gy + 30, runK) : cy + 50;
  g.save(); g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(bx, by, 20, 0, 7); g.fill(); g.stroke(); g.restore();
  if (t > 0.8 && won <= 0) { g.save(); g.strokeStyle = YEL; g.lineWidth = 8; g.setLineDash([18, 12]); g.beginPath(); g.arc(cx, cy + 20, 120 + 10 * Math.sin(t * 9), 0, 7); g.stroke(); g.restore(); }
  arrow(g, cx + 30, cy + 50, gx, gy + 30, runK, YEL, 14, 0.15);
  if (won > 0) T(g, sc.won || "WON IT HIGH", 540, 1700, 90, { alpha: won, color: YEL, stroke: 12 });
};
// width: full-backs bomb on, wingers come inside
S.width = (g, t, dur, sc) => {
  bg(g, sc.bg || "green", t); pitch(g, PX, PY, PW, PH);
  F4231.forEach((p, i) => { const [x, y] = fp(p); dot(g, x, y, 44, i === 0 ? "#ffd400" : "#e2384a"); });
  const k1 = ez((t - 0.2) / 1.0), k2 = ez((t - 1.0) / 1.0);
  for (const i of [1, 4]) { const [x, y] = fp(F4231[i]); arrow(g, x, y - 50, x, PY + 200, k1, "#fff", 14, 0); }
  for (const i of [7, 9]) { const [x, y] = fp(F4231[i]); arrow(g, x, y - 50, 540 + (x < 540 ? -90 : 90), PY + 230, k2, YEL, 14, x < 540 ? 0.25 : -0.25); }
};
// mentor: two people, a line between them
S.mentor = (g, t, dur, sc) => {
  bg(g, sc.bg || "orange", t); const k1 = ez(t * 2.4), k2 = ez((t - 0.5) * 2.4);
  person(g, 285, 1500 + 400 * (1 - k1), sc.left?.image ? 0.7 : 0.85, sc.left || {}); nameTag(g, sc.leftName, 285, 1620, k1);
  person(g, 800, 1500 + 400 * (1 - k2), sc.right?.image ? 0.7 : 0.85, sc.right || {}); nameTag(g, sc.rightName, 800, 1620, k2);
  arrow(g, 360, 820, 720, 820, ez((t - 1.0) * 1.5), "#fff", 14, -0.2);
  if (sc.caption) T(g, sc.caption, 540, 660, 64, { alpha: cl((t - 1.2) * 3) });
};
// trophies on a shelf, one at a time, with labels
S.shelf = (g, t, dur, sc) => {
  bg(g, sc.bg || "blue", t); const it = sc.items, n = it.length;
  g.fillStyle = "#6b4a2b"; g.fillRect(80, 1150, 920, 40); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(80, 1190, 920, 18);
  it.forEach((x, i) => { const k = pop(cl((t - 0.2 - i * (dur * 0.5 / n)) * 3)); if (k <= 0) return; const cx = 540 + (i - (n - 1) / 2) * (900 / n);
    trophy(g, cx, 1150 - 200 * (1 - k), 1.45 * Math.min(1, 3 / n) * k, x.col || "#f2c230", x.kind); T(g, x.label, cx, 1290, 50, { maxW: 900 / n - 20, alpha: cl(k) }); T(g, x.year || "", cx, 1350, 40, { color: YEL, alpha: cl(k) }); });
  if (sc.title) T(g, sc.title, 540, 520, 80, { shadow: true });
};
// a result card that shuts the loop: then and now
S.fixture = (g, t, dur, sc) => {
  bg(g, sc.bg || "red", t); const k1 = ez(t * 2.5), k2 = ez((t - 0.7) * 2.5);
  if (sc.then) { g.save(); g.globalAlpha = k1; card(g, 120, 420 - 200 * (1 - k1), 840, 360, "#fff", 26); T(g, sc.then.top, 540, 500 - 200 * (1 - k1), 46, { color: "#666" });
    T(g, sc.then.score, 540, 650 - 200 * (1 - k1), 120, { color: INK, maxW: 780 }); T(g, sc.then.foot, 540, 730 - 200 * (1 - k1), 46, { color: "#e2384a" }); g.restore(); }
  if (k2 > 0) { g.save(); g.translate(540, 1150); g.scale(pop(k2), pop(k2)); card(g, -420, -230, 840, 460, INK, 26); T(g, sc.now.top, 0, -130, 50, { color: YEL }); T(g, sc.now.teams, 0, 20, 110, { maxW: 780 }); T(g, sc.now.foot, 0, 140, 56, { color: "#bbb" }); g.restore(); }
};

// heads down: United players under the floodlights in the rain, hands on heads, one crouched
function player(g, x, y, s, pose, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = "round"; g.lineCap = "round";
  const skin = o.skin || "#d9a27c", shirt = o.shirt || "#d7192d", shorts = o.shorts || "#f4f4f4", sock = o.sock || "#111";
  g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(0, 6, 120, 22, 0, 0, 7); g.fill();
  const leg = (dx, bend) => { g.strokeStyle = skin; g.lineWidth = 34; g.beginPath(); g.moveTo(dx * 30, -270); g.lineTo(dx * (34 + bend), -140); g.stroke(); g.strokeStyle = sock; g.lineWidth = 36; g.beginPath(); g.moveTo(dx * (34 + bend), -140); g.lineTo(dx * 36, -20); g.stroke(); g.fillStyle = "#111"; rr(g, dx * 36 - 26 + dx * 14, -26, 52, 26, 10); g.fill(); };
  if (pose === "crouch") { g.translate(0, 120); }
  leg(-1, pose === "crouch" ? 40 : 0); leg(1, pose === "crouch" ? 40 : 0);
  g.fillStyle = shorts; g.strokeStyle = INK; g.lineWidth = 6; rr(g, -70, -330, 140, 90, 16); g.fill(); g.stroke();
  g.fillStyle = shirt; rr(g, -82, -540, 164, 230, 34); g.fill(); g.stroke();
  g.fillStyle = "#fff"; g.fillRect(-30, -540, 60, 10);
  // head bowed
  const hy = pose === "crouch" ? -560 : -585; g.fillStyle = skin; g.beginPath(); g.ellipse(0, hy, 52, 60, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = o.hair || "#2a1d16"; g.beginPath(); g.ellipse(0, hy - 18, 54, 46, 0, Math.PI, 0); g.fill();
  // arms
  g.strokeStyle = skin; g.lineWidth = 30;
  if (pose === "hands-head") { for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 74, -520); g.lineTo(d * 130, -620); g.lineTo(d * 40, -650); g.stroke(); } }
  else if (pose === "hips") { for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 74, -520); g.lineTo(d * 130, -420); g.lineTo(d * 66, -350); g.stroke(); } }
  else if (pose === "crouch") { for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 74, -520); g.lineTo(d * 60, -420); g.lineTo(d * 50, -300); g.stroke(); } }
  else { for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 78, -520); g.lineTo(d * 96, -400); g.lineTo(d * 92, -300); g.stroke(); } }
  g.restore();
}
S.dejected = (g, t, dur, sc) => {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#101629"); gr.addColorStop(0.55, "#1d2742"); gr.addColorStop(0.56, "#1e5a33"); gr.addColorStop(1, "#123d22"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // the stand and the floodlights
  g.fillStyle = "#0b0f1d"; g.fillRect(0, 760, W, 300); for (let i = 0; i < 400; i++) { g.fillStyle = i % 3 ? "rgba(200,30,45,.35)" : "rgba(255,255,255,.12)"; g.fillRect((i * 97) % W, 780 + ((i * 53) % 260), 7, 7); }
  for (const lx of [150, 930]) { const lg = g.createRadialGradient(lx, 260, 10, lx, 260, 420); lg.addColorStop(0, "rgba(255,250,220,.9)"); lg.addColorStop(0.15, "rgba(255,250,220,.25)"); lg.addColorStop(1, "rgba(255,250,220,0)"); g.fillStyle = lg; g.fillRect(lx - 420, -160, 840, 840); g.fillStyle = "#e9e7da"; rr(g, lx - 70, 220, 140, 70, 8); g.fill(); }
  const z = 1 + 0.07 * (t / dur); g.save(); g.translate(540, 1500); g.scale(z, z); g.translate(-540, -1500);
  const team = [[180, 1560, 0.78, "hips"], [400, 1500, 0.72, "hands-head"], [640, 1580, 0.8, "crouch"], [880, 1520, 0.74, "hands-head"], [1020, 1640, 0.9, "down"]];
  team.forEach(([x, y, s, p], i) => { const k = ez((t - 0.1 * i) * 2.5); g.save(); g.globalAlpha = k; player(g, x, y + 40 * (1 - k), s, p, { skin: ["#d9a27c", "#8d5a3b", "#e8b896", "#6b4430", "#c98e66"][i], hair: ["#2a1d16", "#111", "#7a5a2a", "#111", "#3b2a1d"][i] }); g.restore(); });
  g.restore();
  // rain
  g.strokeStyle = "rgba(220,230,255,.35)"; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 140; i++) { const x = (i * 131 + t * 300) % (W + 200) - 100, y = (i * 263 + t * 1900) % H; g.moveTo(x, y); g.lineTo(x - 16, y + 60); } g.stroke();
  g.fillStyle = "rgba(10,14,30,.25)"; g.fillRect(0, 0, W, H);
};

// a grid of footballs filling one per goal, coloured by group ({n, col, label} each)
function ball(g, x, y, r) { g.save(); g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = Math.max(2, r * 0.16); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
  g.fillStyle = INK; g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; g.lineTo(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42); } g.fill(); g.restore(); }
S.grid = (g, t, dur, sc) => {
  bg(g, sc.bg || "navy", t); const groups = sc.groups; const n = groups.reduce((a, b) => a + b.n, 0); const cols = sc.cols || 13;
  const cell = 72, x0 = 540 - (cols * cell) / 2 + cell / 2, y0 = 470; const fill = sc.instant ? 1 : cl(t / Math.max(0.6, dur * 0.7));
  let i = 0, shown = Math.floor(n * fill + (sc.instant ? 0 : 0.0001));
  groups.forEach((gp) => { for (let j = 0; j < gp.n; j++, i++) { const x = x0 + (i % cols) * cell, y = y0 + Math.floor(i / cols) * cell; const on = i < shown || sc.instant;
    if (on) { g.save(); g.fillStyle = gp.col; g.beginPath(); g.arc(x, y, 32, 0, 7); g.fill(); g.restore(); ball(g, x, y, 22); } else { g.save(); g.globalAlpha = 0.18; g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, 28, 0, 7); g.fill(); g.restore(); } } });
  const rows = Math.ceil(n / cols); const yb = y0 + rows * cell + 40;
  T(g, String(Math.min(n, shown)), 540, yb + 190, 220, { shadow: true, stroke: 12 });
  if (sc.legend) groups.forEach((gp, k) => { const lx = 540 + (k - (groups.length - 1) / 2) * 440; g.fillStyle = gp.col; g.beginPath(); g.arc(lx - 160, 360, 26, 0, 7); g.fill(); T(g, `${gp.n} ${gp.label}`, lx - 120, 380, 54, { align: "left", alpha: cl(fill * 3 - 2) || 1 }); });
};
// two people, two numbers, face to face
S.versus = (g, t, dur, sc) => {
  bg(g, sc.bg || "purple", t); const k1 = ez(t * 2.4), k2 = ez((t - 0.4) * 2.4);
  g.save(); g.beginPath(); g.rect(0, 0, 540, H); g.clip(); person(g, 270, 1500 + 300 * (1 - k1), sc.left?.image ? 0.72 : 0.8, sc.left || {}); g.restore();
  g.save(); g.beginPath(); g.rect(540, 0, 540, H); g.clip(); person(g, 810, 1500 + 300 * (1 - k2), sc.right?.image ? 0.72 : 0.8, sc.right || {}); g.restore();
  g.fillStyle = INK; g.fillRect(534, 0, 12, H);
  T(g, sc.leftNum, 270, 520, 230, { shadow: true, stroke: 12, alpha: k1 }); T(g, sc.rightNum, 810, 520, 230, { shadow: true, stroke: 12, alpha: k2, color: YEL });
  nameTag(g, sc.leftName, 270, 1640, k1); nameTag(g, sc.rightName, 810, 1640, k2);
  const vk = pop(cl((t - 0.9) * 3)); if (vk > 0) { g.save(); g.translate(540, 1020); g.scale(vk, vk); g.fillStyle = "#e2384a"; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 90, 0, 7); g.fill(); g.stroke(); T(g, "VS", 0, 30, 90); g.restore(); }
};
// a flag waving on its own colour
S.flag = (g, t, dur, sc) => {
  bg(g, sc.bg || "green", t); const k = ez(t * 2); g.save(); g.translate(540, 820); g.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); g.rotate(-0.04);
  const w = 840, h = 560; const wave = (x) => Math.sin(x / 120 + t * 4) * 18 * (x + w / 2) / w;
  for (let x = -w / 2; x < w / 2; x += 6) { const y = wave(x); const fx = (x + w / 2) / w;
    let col = sc.flag.base; for (const s of sc.flag.stripes || []) if (fx >= s.x0 && fx < s.x1) { g.fillStyle = sc.flag.base; g.fillRect(x, -h / 2 + y, 7, h * (s.top || 0)); }
    g.fillStyle = col; g.fillRect(x, -h / 2 + y, 7, h);
    for (const s of sc.flag.stripes || []) if (fx >= s.x0 && fx < s.x1) { g.fillStyle = s.col; g.fillRect(x, -h / 2 + y + h * (s.top || 0), 7, h * (1 - (s.top || 0))); } }
  if (sc.flag.emblem) { const ex = w / 2 - 150, ey = -h / 2 + 90 + wave(ex); g.fillStyle = sc.flag.emblem; g.beginPath(); g.moveTo(ex - 90, ey); g.quadraticCurveTo(ex, ey - 60, ex + 90, ey); g.quadraticCurveTo(ex, ey - 20, ex - 90, ey); g.fill(); g.beginPath(); g.arc(ex, ey + 10, 22, 0, 7); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(-w / 2, -h / 2, w, h); g.restore();
  g.fillStyle = "#6b4a2b"; g.fillRect(96, 500, 22, 1000);
  if (sc.label) T(g, sc.label, 540, 1340, 110, { shadow: true, alpha: cl((t - 0.4) * 3) });
};
// an old record book: half the pages missing, question marks where the numbers should be
S.ledger = (g, t, dur, sc) => {
  bg(g, sc.bg || "orange", t); g.save(); g.translate(540, 860); g.rotate(-0.05 + 0.01 * Math.sin(t * 2));
  card(g, -420, -460, 840, 920, "#efe3c4", 14); g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(-6, -460, 12, 920);
  T(g, sc.title || "1972", -210, -370, 70, { color: "#6b4a2b" }); T(g, sc.title2 || "RESULTS", 210, -370, 50, { color: "#6b4a2b" });
  const rows = 11; for (let i = 0; i < rows; i++) { const y = -290 + i * 66; const k = cl((t - 0.08 * i) * 4); if (k <= 0) continue;
    for (const side of [-1, 1]) { const x = side * 210; g.fillStyle = "rgba(60,40,20,.35)"; g.fillRect(x - 170, y, 200 * k, 10);
      const miss = ((i * 7 + (side + 1) * 3) % 4) === 0; if (miss) T(g, "?", x + 120, y + 26, 70, { color: "#e2384a", alpha: k }); else T(g, String((i * 3 + side + 4) % 6), x + 120, y + 22, 50, { color: "#3a2a1a", alpha: k }); } }
  // a torn corner
  g.fillStyle = PAL[sc.bg || "orange"][1]; g.beginPath(); g.moveTo(420, 200); g.lineTo(420, 460); g.lineTo(160, 460); g.lineTo(260, 380); g.lineTo(300, 300); g.closePath(); g.fill();
  g.restore();
};

// a full-screen illustration (STORY.images[sc.image]) with a slow push and drift
S.picture = (g, t, dur, sc) => {
  bg(g, sc.bg || "navy", t); const im = IMG[sc.image] && IMG[sc.image].naturalWidth ? IMG[sc.image] : null;
  if (im) { const z = 1.04 + 0.08 * (t / dur), w = W * z, h = w * im.height / im.width; const dx = (sc.drift || 0) * 60 * (t / dur);
    g.drawImage(im, 540 - w / 2 + dx, Math.min(0, (H - h) / 2), w, Math.max(h, H * z)); g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(0, 0, W, H); }
  else { g.save(); g.setLineDash([24, 18]); g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 8; rr(g, 70, 380, 940, 1160, 30); g.stroke(); g.restore(); T(g, "IMAGE: " + sc.image, 540, 980, 60, { color: "rgba(255,255,255,.8)", maxW: 880 }); }
  if (sc.label) nameTag(g, sc.label, 540, 300, cl((t - 0.3) * 3));
  if (sc.big) T(g, sc.big, 540, sc.bigY || 1250, sc.bigSize || 200, { shadow: true, stroke: 14, color: sc.bigCol || "#fff", alpha: cl((t - 0.15) * 4), maxW: 980 });
  if (sc.stamp) { const s = cl((t - 0.25) * 3); if (s > 0) { g.save(); g.translate(540, sc.stampY || 600); g.rotate(-0.15); g.scale(2.4 - 1.4 * pop(s), 2.4 - 1.4 * pop(s)); g.globalAlpha = cl(s * 2); g.strokeStyle = "#e2384a"; g.lineWidth = 16; rr(g, -330, -100, 660, 170, 18); g.stroke(); T(g, sc.stamp, 0, 50, 130, { color: "#e2384a", maxW: 620 }); g.restore(); } }
};
// a betting slip: the odds tick up to the number
S.odds = (g, t, dur, sc) => {
  bg(g, sc.bg || "blue", t); const k = sc.cut ? 1 : ez(t * 2.2); g.save(); g.translate(540, (sc.y || 820) + 300 * (1 - k)); g.rotate(-0.05);
  card(g, -360, -420, 720, 840, "#fbf7ea", 18);
  for (let x = -360; x < 360; x += 40) { g.fillStyle = PAL[sc.bg || "blue"][0]; g.beginPath(); g.arc(x + 20, 420, 18, Math.PI, 0); g.fill(); }
  T(g, sc.title || "BET SLIP", 0, -320, 60, { color: INK }); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(-300, -290, 600, 6);
  T(g, sc.pick || "", 0, -190, 64, { color: INK, maxW: 620 }); T(g, sc.market || "", 0, -120, 44, { color: "#666", maxW: 620 });
  const v = sc.cut ? sc.to : Math.round(sc.to * ez(cl((t - 0.4) / 1.2))); T(g, `${v.toLocaleString("en-GB")}/1`, 0, 110, 190, { color: "#e2384a", maxW: 640 });
  T(g, sc.foot || "", 0, 260, 44, { color: "#666", maxW: 620 });
  g.restore();
};
// ages as bars: the record getting younger
S.ages = (g, t, dur, sc) => {
  bg(g, sc.bg || "teal", t); const it = sc.items; const max = Math.max(...it.map((x) => x.days)), min = Math.min(...it.map((x) => x.days)) - 60;
  T(g, sc.title || "", 540, 380, 70, { color: YEL });
  it.forEach((x, i) => { const k = ez((t - 0.35 * i) * 2.2); if (k <= 0) return; const y = 520 + i * 260, w = 160 + 640 * (x.days - min) / (max - min);
    g.save(); g.globalAlpha = k; card(g, 110, y, w * k, 150, x.col || "#fff", 20); T(g, x.name, 140, y - 18, 50, { align: "left" }); T(g, x.age, 140 + w * k - 30, y + 98, 60, { align: "right", color: x.ink || INK }); g.restore(); });
};
// two cities, a parcel flying between them
S.route = (g, t, dur, sc) => {
  bg(g, sc.bg || "teal", t); const [a, b] = sc.cities; const ax = 230, ay = 1250, bx = 850, by = 560;
  for (const [x, y, c] of [[ax, ay, a], [bx, by, b]]) { g.fillStyle = "#e2384a"; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(x, y - 60, 44, Math.PI, 0); g.lineTo(x, y); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y - 60, 16, 0, 7); g.fill(); nameTag(g, c, x, y + 110, 1); }
  const k = inout(cl((t - 0.3) / Math.max(1, dur * 0.6))); arrow(g, ax, ay - 120, bx, by - 120, k, "#fff", 12, 0.25);
  const mx = (ax + bx) / 2 - (by - ay) * 0.25, my = (ay + by) / 2 + (bx - ax) * 0.25 - 120; const px = (1 - k) * (1 - k) * ax + 2 * (1 - k) * k * mx + k * k * bx, py = (1 - k) * (1 - k) * (ay - 120) + 2 * (1 - k) * k * my + k * k * (by - 120);
  if (sc.parcel) { g.save(); g.translate(px, py - 30); g.rotate(Math.sin(t * 6) * 0.1); card(g, -70, -55, 140, 110, "#c9945a", 10); g.fillStyle = "#8a5a2b"; g.fillRect(-8, -55, 16, 110); g.restore(); }
};
// a shirt that changes: from one look to another (fade), with stripes and a tie when asked
S.kit = (g, t, dur, sc) => {
  bg(g, sc.bg || "pink", t); const k = sc.change ? inout(cl((t - 0.6) / 1.2)) : 0;
  const mix = (a, b, u) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - u) + ((pb >> s) & 255) * u)); return `rgb(${c[0]},${c[1]},${c[2]})`; };
  const from = sc.from, to = sc.to || sc.from; const z = 1 + 0.05 * (t / dur);
  g.save(); g.translate(540, 900); g.scale(1.5 * z, 1.5 * z);
  const path = () => { g.beginPath(); g.moveTo(-120, -260); g.lineTo(-300, -180); g.lineTo(-250, -40); g.lineTo(-190, -70); g.lineTo(-190, 240); g.lineTo(190, 240); g.lineTo(190, -70); g.lineTo(250, -40); g.lineTo(300, -180); g.lineTo(120, -260); g.bezierCurveTo(80, -200, -80, -200, -120, -260); g.closePath(); };
  path(); g.fillStyle = mix(from.c1, to.c1, k); g.fill(); g.save(); path(); g.clip();
  const st = (look, a) => { if (!look.stripes || a <= 0) return; g.globalAlpha = a; g.fillStyle = look.stripes; for (let x = -300; x < 300; x += 100) g.fillRect(x + 25, -300, 50, 600); g.globalAlpha = 1; };
  st(from, 1 - k); st(to, k); if (sc.fade) { g.fillStyle = `rgba(255,255,255,${0.55 * ez(cl((t - 0.5) / 1.5))})`; g.fillRect(-320, -300, 640, 600); }
  g.restore(); path(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke();
  if (from.tie && k < 0.5) { g.globalAlpha = 1 - k * 2; g.fillStyle = "#111"; g.beginPath(); g.moveTo(-18, -215); g.lineTo(18, -215); g.lineTo(28, -40); g.lineTo(0, 0); g.lineTo(-28, -40); g.closePath(); g.fill(); g.globalAlpha = 1; }
  g.restore();
  if (sc.label) T(g, sc.label, 540, 1380, 90, { shadow: true, alpha: cl((t - 0.4) * 3) });
};

// ── format scenes (17 Nov batch): countdown rank, myth/fact, clues, a big statement, a stopwatch ──
S.rank = (g, t, dur, sc) => {
  bg(g, sc.bg || "navy", t); const k = pop(cl(t * 3));
  g.save(); g.translate(540, 640); g.scale(k, k); T(g, "#" + sc.n, 0, 120, 420, { shadow: true, stroke: 16, color: YEL }); g.restore();
  if (sc.person) person(g, 540, 1920 + 260 * (1 - ez(t * 2)), sc.scale || 1.05, sc.person);
  const k2 = ez((t - 0.3) * 3); if (k2 > 0) { g.save(); g.globalAlpha = k2; card(g, 90, 900, 900, 230, "#fff", 24); T(g, sc.title, 540, 1000, 86, { color: INK, maxW: 820 }); T(g, sc.sub || "", 540, 1080, 50, { color: "#666", maxW: 820 }); g.restore(); }
};
S.myth = (g, t, dur, sc) => {
  const fact = sc.verdict === "fact"; bg(g, sc.bg || (fact ? "green" : "red"), t);
  const k = ez(t * 2.5); g.save(); g.globalAlpha = k; card(g, 90, 520 + 60 * (1 - k), 900, 520, "#fff", 26);
  const lines = String(sc.claim).split("|"); lines.forEach((l, i) => T(g, l, 540, 680 + i * 110 + 60 * (1 - k), 84, { color: INK, maxW: 820 })); g.restore();
  const s = cl((t - 0.6) * 3); if (s > 0) { g.save(); g.translate(540, 1240); g.rotate(-0.12); const z = 2.2 - 1.2 * pop(s); g.scale(z, z); g.globalAlpha = cl(s * 2);
    const col = fact ? "#1ea85a" : "#e2384a"; g.strokeStyle = col; g.lineWidth = 16; rr(g, -270, -100, 540, 170, 18); g.stroke(); T(g, fact ? "TRUE" : "MYTH", 0, 45, 140, { color: col }); g.restore(); }
  if (sc.label) T(g, sc.label, 540, 430, 60, { color: YEL, alpha: k });
};
S.clues = (g, t, dur, sc) => {
  bg(g, sc.bg || "purple", t); T(g, sc.title || "GUESS THE CLUB", 540, 400, 80, { color: YEL, shadow: true });
  sc.items.forEach((c, i) => { const shown = i < (sc.show ?? sc.items.length); if (!shown) return; const k = i === (sc.show ?? sc.items.length) - 1 ? ez(t * 3) : 1;
    g.save(); g.globalAlpha = k; card(g, 100 + 60 * (1 - k), 520 + i * 190, 880, 150, "#fff", 22); T(g, `${i + 1}`, 170, 625 + i * 190, 80, { color: "#e2384a" }); T(g, c, 240, 615 + i * 190, 56, { color: INK, align: "left", maxW: 700 }); g.restore(); });
  if (sc.answer) { const k = pop(cl((t - 0.3) * 3)); if (k > 0) { g.save(); g.translate(540, 1420); g.scale(k, k); g.fillStyle = "#e2384a"; g.strokeStyle = INK; g.lineWidth = 8; rr(g, -440, -110, 880, 180, 24); g.fill(); g.stroke(); T(g, sc.answer, 0, 20, 110, { maxW: 820 }); g.restore(); } }
};
S.statement = (g, t, dur, sc) => {
  bg(g, sc.bg || "navy", t); const lines = String(sc.text).split("|"); const n = lines.length;
  lines.forEach((l, i) => { const k = ez((t - i * 0.25) * 3); T(g, l, 540 + 80 * (1 - k), 820 + (i - (n - 1) / 2) * 150, sc.size || 130, { alpha: k, shadow: true, stroke: 12, color: i === (sc.hi ?? -1) ? YEL : "#fff", maxW: 960 }); });
};
S.stopwatch = (g, t, dur, sc) => {
  bg(g, sc.bg || "red", t); const v = Math.min(sc.to, sc.to * cl(t / Math.max(0.5, dur * 0.7)));
  g.save(); g.translate(540, 820); g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 14; g.beginPath(); g.arc(0, 0, 330, 0, 7); g.fill(); g.stroke();
  rr(g, -50, -420, 100, 80, 14); g.fillStyle = INK; g.fill();
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; g.strokeStyle = INK; g.lineWidth = i % 5 ? 4 : 10; g.beginPath(); g.moveTo(Math.sin(a) * 300, -Math.cos(a) * 300); g.lineTo(Math.sin(a) * (i % 5 ? 280 : 260), -Math.cos(a) * (i % 5 ? 280 : 260)); g.stroke(); }
  const a = v / 60 * Math.PI * 2; g.strokeStyle = "#e2384a"; g.lineWidth = 12; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(a) * 250, -Math.cos(a) * 250); g.stroke(); g.restore();
  T(g, v.toFixed(2) + "s", 540, 1330, 190, { shadow: true, stroke: 12 }); if (sc.word) T(g, sc.word, 540, 1440, 64, { color: YEL, alpha: cl((t - 0.4) * 3) });
};

// ── full-screen beats (17 Nov 2026 redo) ──
// a big score that fills the screen: two team names in their colours and the score between
S.score = (g, t, dur, sc) => {
  bg(g, sc.bg || "navy", t); const k = pop(cl(t * 4));
  if (sc.top) T(g, sc.top, 540, 470, 64, { color: YEL, alpha: cl(t * 4) });
  const half = (y, name, col, ink, d) => { const kk = ez(cl((t - d) * 4)); g.save(); g.translate((1 - kk) * (y < 900 ? -1100 : 1100), 0); g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 8; rr(g, 60, y, 960, 230, 28); g.fill(); g.stroke(); T(g, name, 540, y + 155, 120, { color: ink, maxW: 900 }); g.restore(); };
  half(560, sc.home, sc.homeCol || "#1d3fa0", sc.homeInk || "#fff", 0); half(1090, sc.away, sc.awayCol || "#fff", sc.awayInk || INK, 0.12);
  g.save(); g.translate(540, 940); g.scale(k, k); g.fillStyle = YEL; g.strokeStyle = INK; g.lineWidth = 10; rr(g, -230, -110, 460, 220, 30); g.fill(); g.stroke(); T(g, sc.score, 0, 60, 170, { color: INK }); g.restore();
  if (sc.foot) T(g, sc.foot, 540, 1480, 70, { shadow: true, alpha: cl((t - 0.4) * 3) });
};
// n tiles that pop in one by one across the beat (goals in a row, wins, games)
S.tally = (g, t, dur, sc) => {
  bg(g, sc.bg || "blue", t); const n = sc.n, cols = sc.cols || 4, sz = 210, gap = 26; const x0 = 540 - (cols * sz + (cols - 1) * gap) / 2; const rows = Math.ceil(n / cols); const y0 = 960 - (rows * sz + (rows - 1) * gap) / 2 + (sc.dy || 0);
  const per = Math.max(0.12, (dur * 0.85) / n); let shown = 0;
  for (let i = 0; i < n; i++) { const k = pop(cl((t - i * per) * 6)); if (k <= 0) continue; shown++; const x = x0 + (i % cols) * (sz + gap) + sz / 2, y = y0 + Math.floor(i / cols) * (sz + gap) + sz / 2; const lab = (sc.labels || [])[i];
    g.save(); g.translate(x, y); g.scale(k, k); card(g, -sz / 2, -sz / 2, sz, sz, sc.col || "#fff", 26); if (sc.icon === "ball") { g.fillStyle = INK; g.beginPath(); g.arc(0, -18, 52, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(0, -18, 44, 0, 7); g.fill(); g.fillStyle = INK; g.beginPath(); for (let j = 0; j < 5; j++) { const a = -Math.PI / 2 + j * 2 * Math.PI / 5; g.lineTo(Math.cos(a) * 19, -18 + Math.sin(a) * 19); } g.fill(); }
    else T(g, sc.mark || String(i + 1), 0, 20, 110, { color: sc.markCol || INK });
    T(g, lab || ("GAME " + (i + 1)), 0, sz / 2 - 22, lab ? 30 : 30, { color: "#555", maxW: sz - 20 }); g.restore(); }
  if (sc.title) T(g, sc.title, 540, y0 - 70, 90, { shadow: true, color: YEL, stroke: 10 });
  if (sc.count) T(g, `${shown}`, 540, y0 + rows * (sz + gap) + 170, 200, { shadow: true, stroke: 12 });
};
// a pitch covered by a heat map that spreads everywhere
S.heatmap = (g, t, dur, sc) => {
  bg(g, sc.bg || "green", t); pitch(g, PX, PY, PW, PH); const k = cl(t / Math.max(0.8, dur * 0.8)); let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.save(); g.globalCompositeOperation = "source-over";
  for (let i = 0; i < 70 * k; i++) { const x = PX + 60 + rnd() * (PW - 120), y = PY + 60 + rnd() * (PH - 120); const r = 90 + rnd() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,40,40,.55)"); gr.addColorStop(0.5, "rgba(255,200,0,.28)"); gr.addColorStop(1, "rgba(255,200,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  g.restore(); if (sc.label) T(g, sc.label, 540, 360, 90, { shadow: true, stroke: 10, alpha: cl(t * 3) });
};
// a person on the left half, stat bars growing on the right
S.statbars = (g, t, dur, sc) => {
  bg(g, sc.bg || "blue", t); if (sc.person) person(g, 300, 1920 + 200 * (1 - ez(t * 2.5)), sc.scale || 0.95, sc.person);
  sc.stats.forEach((st, i) => { const k = ez((t - 0.25 - i * 0.35) * 2.5); if (k <= 0) return; const y = 560 + i * 300;
    g.save(); g.globalAlpha = k; card(g, 560, y, 460, 240, "#fff", 24); T(g, String(Math.round(st.v * k)), 790, y + 150, 150, { color: st.col || "#1d3fa0" }); T(g, st.label, 790, y + 215, 40, { color: "#555", maxW: 420 }); g.restore(); });
};
// the end card
S.cta = (g, t, dur, sc) => { bg(g, "red", t); const k = pop(cl(t * 2.5)); g.save(); g.translate(540, 900); g.scale(k, k); T(g, "FOLLOW", 0, -40, 190, { shadow: true }); T(g, "FOR MORE", 0, 150, 150, { color: YEL, shadow: true }); g.restore(); };
S.text = (g, t, dur, sc) => { bg(g, sc.bg || "teal", t); };

// (fork x2) a breakdown: one bar per part, growing in turn, value at the end ({title, items:[{label, v, col}]})
S.x2_bars = (g, t, dur, sc) => {
  bg(g, sc.bg || "navy", t); const it = sc.items, n = it.length, max = Math.max(...it.map((x) => x.v)); const rh = Math.min(200, 1000 / n), y0 = 960 - (n * rh) / 2;
  if (sc.title) T(g, sc.title, 540, y0 - 90, 90, { shadow: true, color: YEL, stroke: 10 });
  it.forEach((x, i) => { const k = ez((t - 0.15 - i * Math.min(0.45, dur * 0.6 / n)) * 2.5); if (k <= 0) return; const y = y0 + i * rh, w = 120 + 560 * x.v / max;
    g.save(); g.globalAlpha = cl(k * 2); T(g, x.label, 80, y + 56, 64, { align: "left", maxW: 900, shadow: true });
    card(g, 80, y + 70, w * k, rh - 100, x.col || "#fff", 18); T(g, String(Math.round(x.v * k)), 80 + w * k + 24, y + rh - 36, 110, { align: "left", shadow: true }); g.restore(); });
};

// x5_move (ex05b/ex09b, 17 Nov 2026): a move told on a full-screen pitch. Players are dots (0..1 pitch
// coordinates, y 0 = the goal at the top); the ball follows `path` from 0.15 s to 85% of the step, drawing
// a yellow arrow behind it; `carrier` (a player index) runs with the ball; `moves` slide other dots to `to`.
S.x5_move = (g, t, dur, sc) => {
  bg(g, sc.bg || "green", t); pitch(g, PX, PY, PW, PH);
  const path = sc.path || [[0.5, 0.5], [0.5, 0.05]]; const T0 = sc.delay ?? 0.15, T1 = Math.max(T0 + 0.6, dur * (sc.span || 0.85));
  const u = inout(cl((t - T0) / (T1 - T0))); const segs = path.length - 1;
  const at = (v) => { const s = Math.min(segs - 1, Math.floor(v * segs)), f = v * segs - s; const a = fp(path[s]), b = fp(path[s + 1]); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; };
  for (let s = 0; s < segs; s++) { const k = cl(u * segs - s); if (k <= 0) break; const a = fp(path[s]), b = fp(path[s + 1]); arrow(g, a[0], a[1], b[0], b[1], k, YEL, 12, 0); }
  const [bx, by] = at(u);
  (sc.players || []).forEach((p, i) => { let [x, y] = fp([p.x, p.y]);
    if (p.to) { const k = inout(cl((t - (p.at ?? T0)) / (p.dur ?? (T1 - T0)))); const [tx, ty] = fp(p.to); x = lerp(x, tx, k); y = lerp(y, ty, k); }
    if (i === sc.carrier && u > (sc.carryFrom ?? 0)) { x = bx - 26; y = by + 40; }
    dot(g, x, y, p.r || 40, p.col || "#e2384a", p.n || ""); if (p.label) T(g, p.label, x, y - 58, 42, { stroke: 8, maxW: 360 }); });
  g.save(); g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(bx, by, 20, 0, 7); g.fill(); g.stroke(); g.restore();
  if (sc.title) T(g, sc.title, 540, 330, 80, { shadow: true, stroke: 10, color: YEL, maxW: 960 });
  const done = cl((t - T1) * 3); if (sc.foot && done > 0) T(g, sc.foot, 540, 1720, 96, { alpha: done, color: YEL, stroke: 12, maxW: 960 });
};

// x5_bars (ex05b/ex09b): a full-screen ranking. Each row: a name above a thick bar whose length is `frac`
// (0..1) with the value at its end; rows slide in one by one; `hi` rows are yellow.
S.x5_bars = (g, t, dur, sc) => {
  bg(g, sc.bg || "navy", t); const it = sc.items || []; const n = it.length; const rh = Math.min(260, 940 / Math.max(1, n)); const y0 = 460 + (940 - n * rh) / 2;
  if (sc.title) T(g, sc.title, 540, y0 - 90, 84, { shadow: true, stroke: 10, color: YEL, maxW: 980 });
  it.forEach((x, i) => { const k = ez(cl((t - 0.15 - i * (sc.gap ?? 0.35)) * 2.5)); if (k <= 0) return; const y = y0 + i * rh; const w = (300 + 660 * (x.frac ?? 1)) * k;
    g.save(); g.globalAlpha = cl(k * 2); T(g, x.name, 60, y + 58, 62, { align: "left", stroke: 9, maxW: 960 });
    card(g, 60, y + 80, w, rh - 120, x.hi ? YEL : (x.col || "#fff"), 18); T(g, x.val, 60 + w - 26, y + rh - 62, Math.min(110, rh - 150), { align: "right", color: INK }); g.restore(); });
};

window.EXPLAINER = { S, bg, finish, T, rr, INK, YEL, IMG, cl, ez, pop };
})();

// ── x7_ scenes (17 Nov 2026, explainer redo: offside / hat-trick / rules / World Cup 2030). Added, not edits. ──
(() => {
const X = window.EXPLAINER, S = X.S, T = X.T, rr = X.rr, INK = X.INK, YEL = X.YEL, cl = X.cl, ez = X.ez, pop = X.pop, bg = X.bg;
const card = (g, x, y, w, h, fill = "#fff", r = 26) => { g.save(); g.fillStyle = "rgba(0,0,0,.25)"; rr(g, x + 10, y + 14, w, h, r); g.fill(); g.fillStyle = fill; g.lineWidth = 6; g.strokeStyle = INK; rr(g, x, y, w, h, r); g.fill(); g.stroke(); g.restore(); };
const dot = (g, x, y, r, fill, k = 1) => { if (k <= 0) return; g.save(); g.translate(x, y); g.scale(k, k); g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.arc(5, 7, r, 0, 7); g.fill(); g.fillStyle = fill; g.lineWidth = 7; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke(); g.restore(); };
const ball = (g, x, y, r) => { g.save(); g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); for (let j = 0; j < 5; j++) { const a = j / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42); } g.fill(); g.restore(); };
const stamp = (g, s, x, y, k, col = "#e2384a", size = 150) => { if (k <= 0) return; g.save(); g.translate(x, y); g.rotate(-0.08); const z = 1.6 - 0.6 * ez(k); g.scale(z, z); g.globalAlpha = cl(k * 2); g.font = `${size}px Anton`; const w = g.measureText(s).width + 70;
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 10; rr(g, -w / 2, -size * 0.85, w, size * 1.15, 18); g.fill(); g.stroke(); T(g, s, 0, size * 0.2, size, { color: "#fff", stroke: 10 }); g.restore(); };

// a vertical attacking half: goal at the top, halfway line at the bottom. Positions are 0..1 (x across, y from goal line).
const P = { x0: 70, y0: 300, w: 940, h: 1180 };
const pp = ([x, y]) => [P.x0 + x * P.w, P.y0 + y * P.h];
S.x7_offside = (g, t, dur, sc) => {
  bg(g, sc.bg || "green", t); const sp = Math.min(1, Math.max(0.45, dur / 2.4)); const u = (a) => t / sp - a;
  g.save(); g.fillStyle = "#2f9a4e"; rr(g, P.x0, P.y0 - 40, P.w, P.h + 80, 24); g.fill();
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)"; g.fillRect(P.x0, P.y0 + i * P.h / 9, P.w, P.h / 9); }
  g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 7; g.beginPath(); g.moveTo(P.x0, P.y0); g.lineTo(P.x0 + P.w, P.y0); g.stroke();
  g.strokeRect(P.x0 + P.w * 0.2, P.y0, P.w * 0.6, P.h * 0.15); g.strokeRect(P.x0 + P.w * 0.36, P.y0, P.w * 0.28, P.h * 0.05);
  g.fillStyle = "#fff"; g.fillRect(P.x0 + P.w * 0.4, P.y0 - 34, P.w * 0.2, 30); g.strokeStyle = INK; g.lineWidth = 5; g.strokeRect(P.x0 + P.w * 0.4, P.y0 - 34, P.w * 0.2, 30);
  const hy = P.y0 + P.h * (sc.halfY ?? 0.86); g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 7; g.beginPath(); g.moveTo(P.x0, hy); g.lineTo(P.x0 + P.w, hy); g.stroke(); g.beginPath(); g.arc(P.x0 + P.w / 2, hy, 120, Math.PI, 0); g.stroke();
  if (sc.half) { const k = cl(u(0.3) * 2); g.fillStyle = `rgba(255,212,0,${0.28 * k})`; g.fillRect(P.x0, hy, P.w, P.y0 + P.h + 40 - hy); T(g, "OWN HALF", P.x0 + P.w / 2, hy + 120, 70, { color: YEL, stroke: 8, alpha: k }); }
  g.restore();
  const step = (sc.step || 0) * ez(u(0.5) * 1.5);
  const def = (sc.def || []).map(([x, y], i) => [x, i === 0 ? y : y + step]);
  const order = def.map((d, i) => [d[1], i]).sort((a, b) => a[0] - b[0]); const second = order[Math.min(1, order.length - 1)];
  const ly = P.y0 + P.h * (sc.lineY ?? second[0]);
  if (sc.line !== false && def.length) { const k = ez(u(0.35) * 2.5); g.save(); g.strokeStyle = YEL; g.lineWidth = 9; g.setLineDash([30, 20]); g.beginPath(); g.moveTo(P.x0, ly); g.lineTo(P.x0 + P.w * k, ly); g.stroke(); g.restore(); }
  def.forEach((d, i) => { const [x, y] = pp(d); dot(g, x, y, 44, i === 0 ? "#ffd400" : "#e2384a", pop(cl(u(i * 0.06) * 4))); });
  if (sc.ring != null && def[sc.ring]) { const [x, y] = pp(def[sc.ring]); const k = ez(u(0.5) * 3); g.save(); g.strokeStyle = "#fff"; g.lineWidth = 8; g.beginPath(); g.arc(x, y, 70, 0, 7 * k); g.stroke(); g.restore(); if (sc.ringLabel) T(g, sc.ringLabel, x, y - 90, 54, { stroke: 8, alpha: k }); }
  if (sc.keeperLabel) { const [x, y] = pp(def[0]); T(g, sc.keeperLabel, x, y + 110, 50, { stroke: 8, alpha: ez(u(0.4) * 3) }); }
  const mate = sc.mate && pp(sc.mate); if (mate) dot(g, mate[0], mate[1], 44, "#4c8cf0", pop(cl(u(0.1) * 4)));
  const att = sc.att && pp(sc.att);
  if (att) { dot(g, att[0], att[1], 44, "#4c8cf0", pop(cl(u(0.15) * 4)));
    if (sc.arm) { const k = ez(u(0.3) * 3); g.save(); g.strokeStyle = INK; g.lineWidth = 26; g.lineCap = "round"; g.beginPath(); g.moveTo(att[0] + 20, att[1] - 20); g.lineTo(att[0] + 20 + 50 * k, att[1] - 20 - 120 * k); g.stroke(); g.strokeStyle = "#f2c7a5"; g.lineWidth = 16; g.stroke(); g.restore();
      if (sc.armX) { const k2 = cl(u(0.9) * 3); g.save(); g.strokeStyle = "#e2384a"; g.lineWidth = 12; g.globalAlpha = k2; g.beginPath(); g.moveTo(att[0] + 20, att[1] - 170); g.lineTo(att[0] + 120, att[1] - 70); g.moveTo(att[0] + 120, att[1] - 170); g.lineTo(att[0] + 20, att[1] - 70); g.stroke(); g.restore(); } }
    if (sc.attLabel) T(g, sc.attLabel, att[0], att[1] + 110, 50, { stroke: 8, alpha: ez(u(0.3) * 3) }); }
  if (mate && att && sc.pass !== false) { const k = ez(u(0.7) * 1.6); if (k > 0) { const bx = mate[0] + (att[0] - mate[0]) * k, by = mate[1] + (att[1] - mate[1]) * k; g.save(); g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 8; g.setLineDash([18, 14]); g.beginPath(); g.moveTo(mate[0], mate[1]); g.lineTo(bx, by); g.stroke(); g.restore(); ball(g, bx, by, 24); } }
  if (sc.title) T(g, sc.title, 540, 210, 92, { shadow: true, stroke: 10, alpha: ez(t * 4) });
  if (sc.verdict) stamp(g, sc.verdict, 540, sc.vy || 900, cl(u(1.2) * 3), sc.vcol || (sc.verdict.includes("ON") && !sc.verdict.includes("OFF") ? "#1ea85a" : "#e2384a"), sc.vsize || 150);
};

// a big countdown ring: from N to 0, then a stamp
S.x7_countdown = (g, t, dur, sc) => {
  bg(g, sc.bg || "red", t); const n = sc.from || 5, run = Math.min(dur * 0.7, n * (sc.per || 0.32)); const f = cl(t / run); const v = Math.ceil(n * (1 - f));
  if (sc.title) T(g, sc.title, 540, 330, 100, { shadow: true, stroke: 10, alpha: ez(t * 4), maxW: 960 });
  g.save(); g.translate(540, 900); const k = pop(cl(t * 4)); g.scale(k, k);
  g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 14; g.beginPath(); g.arc(0, 0, 340, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = f < 1 ? "#e2384a" : "#888"; g.lineWidth = 46; g.lineCap = "round"; g.beginPath(); g.arc(0, 0, 280, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - f)); g.stroke();
  const tick = (t / run * n) % 1; const z = 1 + 0.18 * (1 - ez(tick * 3)) * (f < 1 ? 1 : 0); g.scale(z, z);
  T(g, String(v), 0, 110, 330, { color: INK }); g.restore();
  if (sc.word) T(g, sc.word, 540, sc.wordY || 1335, 76, { color: YEL, shadow: true, stroke: 10, alpha: ez((t - 0.2) * 3), maxW: 960 });
  if (sc.end && f >= 1) stamp(g, sc.end, 540, 900, cl((t - run) * 4), sc.endCol || "#e2384a", sc.endSize || 130);
};

// flags as cards (simple drawn flags, no emblems): items [{code, label, old}] - new ones pop in one after another
const FLAGS = {
  ES: (g, w, h) => { g.fillStyle = "#c60b1e"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffc400"; g.fillRect(0, h / 4, w, h / 2); },
  PT: (g, w, h) => { g.fillStyle = "#006600"; g.fillRect(0, 0, w * 0.4, h); g.fillStyle = "#ff0000"; g.fillRect(w * 0.4, 0, w * 0.6, h); g.fillStyle = "#ffcc00"; g.beginPath(); g.arc(w * 0.4, h / 2, h * 0.2, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); },
  MA: (g, w, h) => { g.fillStyle = "#c1272d"; g.fillRect(0, 0, w, h); g.strokeStyle = "#006233"; g.lineWidth = h * 0.05; g.beginPath(); for (let j = 0; j <= 5; j++) { const a = j * 4 * Math.PI / 5 - Math.PI / 2; g.lineTo(w / 2 + Math.cos(a) * h * 0.3, h / 2 + Math.sin(a) * h * 0.3); } g.closePath(); g.stroke(); },
  UY: (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#0038a8"; for (let j = 1; j < 9; j += 2) g.fillRect(0, j * h / 9, w, h / 9); g.fillStyle = "#fff"; g.fillRect(0, 0, w * 0.4, h * 5 / 9); g.fillStyle = "#fcd116"; g.beginPath(); g.arc(w * 0.2, h * 2.5 / 9, h * 0.14, 0, 7); g.fill(); },
  AR: (g, w, h) => { g.fillStyle = "#74acdf"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.fillRect(0, h / 3, w, h / 3); g.fillStyle = "#f6b40e"; g.beginPath(); g.arc(w / 2, h / 2, h * 0.11, 0, 7); g.fill(); },
  PY: (g, w, h) => { g.fillStyle = "#d52b1e"; g.fillRect(0, 0, w, h / 3); g.fillStyle = "#fff"; g.fillRect(0, h / 3, w, h / 3); g.fillStyle = "#0038a8"; g.fillRect(0, h * 2 / 3, w, h / 3); },
  FR: (g, w, h) => { g.fillStyle = "#0055a4"; g.fillRect(0, 0, w / 3, h); g.fillStyle = "#fff"; g.fillRect(w / 3, 0, w / 3, h); g.fillStyle = "#ef4135"; g.fillRect(w * 2 / 3, 0, w / 3, h); },
  BE: (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w / 3, h); g.fillStyle = "#fdda24"; g.fillRect(w / 3, 0, w / 3, h); g.fillStyle = "#ef3340"; g.fillRect(w * 2 / 3, 0, w / 3, h); },
  RO: (g, w, h) => { g.fillStyle = "#002b7f"; g.fillRect(0, 0, w / 3, h); g.fillStyle = "#fcd116"; g.fillRect(w / 3, 0, w / 3, h); g.fillStyle = "#ce1126"; g.fillRect(w * 2 / 3, 0, w / 3, h); },
  YU: (g, w, h) => { g.fillStyle = "#0c4076"; g.fillRect(0, 0, w, h / 3); g.fillStyle = "#fff"; g.fillRect(0, h / 3, w, h / 3); g.fillStyle = "#c6363c"; g.fillRect(0, h * 2 / 3, w, h / 3); },
};
S.x7_flags = (g, t, dur, sc) => {
  bg(g, sc.bg || "blue", t); const it = sc.items || [], cols = sc.cols || 2, n = it.length; const cw = cols === 1 ? 760 : cols === 2 ? 440 : 300, chh = cw * 0.62, gap = 40, lab = 90;
  const rows = Math.ceil(n / cols), totH = rows * (chh + lab) + (rows - 1) * gap; const y0 = (sc.y ?? 960) - totH / 2; let fresh = 0;
  if (sc.title) T(g, sc.title, 540, Math.max(200, y0 - 60), 90, { shadow: true, stroke: 10, alpha: ez(t * 4), maxW: 960 });
  it.forEach((f, i) => { const d = f.old ? -1 : (fresh++) * (sc.gap ?? 0.3); const k = f.old ? 1 : pop(cl((t - d) * 4)); if (k <= 0) return;
    const r = Math.floor(i / cols), c = i % cols; const rowN = Math.min(cols, n - r * cols); const x = 540 + (c - (rowN - 1) / 2) * (cw + gap), y = y0 + r * (chh + lab + gap) + chh / 2;
    g.save(); g.translate(x, y); g.scale(k, k); g.rotate(Math.sin(t * 2 + i) * 0.015); g.fillStyle = "rgba(0,0,0,.25)"; rr(g, -cw / 2 + 10, -chh / 2 + 14, cw, chh, 18); g.fill();
    g.save(); rr(g, -cw / 2, -chh / 2, cw, chh, 18); g.clip(); g.translate(-cw / 2, -chh / 2); (FLAGS[f.code] || FLAGS.FR)(g, cw, chh); g.restore();
    g.lineWidth = 7; g.strokeStyle = INK; rr(g, -cw / 2, -chh / 2, cw, chh, 18); g.stroke();
    if (f.dim) { g.fillStyle = "rgba(0,0,0,.55)"; rr(g, -cw / 2, -chh / 2, cw, chh, 18); g.fill(); }
    T(g, f.label || "", 0, chh / 2 + 78, 66, { stroke: 9, maxW: cw, color: f.hi ? YEL : "#fff" }); g.restore(); });
};
})();
