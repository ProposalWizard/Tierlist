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

function bg(g, pal, t = 0) {
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
  else { person(g, 540, 1920, 1.3, { suit: false }); }
  if (sc.label) nameTag(g, sc.label, 540, 300, cl((t - 0.3) * 3));
};
// a betting slip: the odds tick up to the number
S.odds = (g, t, dur, sc) => {
  bg(g, sc.bg || "blue", t); const k = sc.cut ? 1 : ez(t * 2.2); g.save(); g.translate(540, 820 + 300 * (1 - k)); g.rotate(-0.05);
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
// the end card
S.cta = (g, t, dur, sc) => { bg(g, "red", t); const k = pop(cl(t * 2.5)); g.save(); g.translate(540, 900); g.scale(k, k); T(g, "FOLLOW", 0, -40, 190, { shadow: true }); T(g, "FOR MORE", 0, 150, 150, { color: YEL, shadow: true }); g.restore(); };
S.text = (g, t, dur, sc) => { bg(g, sc.bg || "teal", t); };

window.EXPLAINER = { S, bg, finish, T, rr, INK, YEL, IMG, cl, ez, pop };
})();
