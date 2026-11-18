// Video factory scenes, v2 (Mikey, 4 Nov 2026; v1 3 Nov). Every scene fills the
// whole 1080x1920 frame. Each draws at time t (seconds into its line) of a line
// lasting `dur` seconds. Layout rules for every scene:
//   - the story lives in y 200..1220 (TikTok's top bar is above, captions below)
//   - y 1250..1500 is the caption band: only background may show there
//   - below 1500 is TikTok's own caption: background only
//   - keep words and faces left of x 960 below y 900 (TikTok's buttons)
// People come from avatars.js; clubs show their REAL badge when make.py found one
// (Supabase club_logos), otherwise a drawn crest. charts.js adds the data scenes.
const W = 1080, H = 1920, TOP = 220, BOT = 1220;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ez = (x) => { x = cl(x); return 1 - Math.pow(1 - x, 3); };
const ezio = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const pop = (x) => { x = cl(x); const s = 1.70158 * 1.4; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
function seeded(n) { let s = n; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function hexRgb(hex) { const n = parseInt((hex || "#888888").replace("#", "").slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function shadeC(hex, k) { const [r, g, b] = hexRgb(hex); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function tint(hex, k) { const [r, g, b] = hexRgb(hex); const f = (v) => Math.round(v + (255 - v) * k); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function lum(hex) { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
// a club colour that still glows on navy (very dark kits are lifted)
function glowOf(hex) { return lum(hex) < 0.18 ? tint(hex, 0.35) : hex; }

const FONT = { anton: (s) => `${s}px Anton`, antonI: (s) => `italic ${s}px Anton`, inter: (s, w = 700) => `${w} ${s}px KInter`, osw: (s) => `700 ${s}px Oswald` };
function T(g, s, x, y, size, o = {}) {
  s = String(s ?? ""); g.save();
  const font = o.font === "Oswald" ? FONT.osw : o.font === "Inter" ? (z) => FONT.inter(z, o.weight || 700) : o.italic ? FONT.antonI : FONT.anton;
  g.font = font(size); g.textAlign = o.align || "center"; g.textBaseline = o.base || "alphabetic";
  g.letterSpacing = (o.spacing ?? 0) + "px";
  if (o.maxW) { const w = g.measureText(s).width; if (w > o.maxW) { size = size * o.maxW / w; g.font = font(size); } }
  g.globalAlpha *= o.alpha ?? 1;
  if (o.shadow) { g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = o.shadow; g.shadowOffsetY = o.shadow / 3; }
  if (o.stroke) { g.lineJoin = "round"; g.lineWidth = o.stroke; g.strokeStyle = o.strokeColor || "#000"; g.strokeText(s, x, y); g.shadowColor = "transparent"; }
  if (o.glow) { g.shadowColor = o.glowColor || o.color || "#fff"; g.shadowBlur = o.glow; }
  g.fillStyle = o.color || "#fff"; g.fillText(s, x, y); g.restore(); return size;
}
function wrapLines(g, s, maxW, font) {
  g.save(); g.font = font; const words = String(s ?? "").split(/\s+/).filter(Boolean); const lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); g.restore(); return lines;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function panel(g, x, y, w, h, fill = "#fff", r = 22, shadow = 0.35) { g.save(); g.shadowColor = `rgba(0,0,0,${shadow})`; g.shadowBlur = 30; g.shadowOffsetY = 10; g.fillStyle = fill; rr(g, x, y, w, h, r); g.fill(); g.restore(); }
// The game's own card look (components/star/ui ClubCard): slate glass, a club-colour
// wash from the top-left corner, a hairline edge and a highlight along the top.
function card(g, x, y, w, h, glow = "#2F6F4E", r = 28, strength = 0.28) {
  g.save(); g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 40; g.shadowOffsetY = 16;
  const base = g.createLinearGradient(0, y, 0, y + h); base.addColorStop(0, "rgba(31,41,55,.95)"); base.addColorStop(1, "rgba(12,17,28,.97)");
  g.fillStyle = base; rr(g, x, y, w, h, r); g.fill(); g.restore();
  g.save(); rr(g, x, y, w, h, r); g.clip();
  const wash = g.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 1.2); wash.addColorStop(0, rgba(glowOf(glow), strength)); wash.addColorStop(0.55, rgba(glowOf(glow), 0)); g.fillStyle = wash; g.fillRect(x, y, w, h);
  g.fillStyle = "rgba(255,255,255,.10)"; g.fillRect(x, y, w, 2);
  g.restore();
  g.save(); g.strokeStyle = rgba(glowOf(glow), 0.3); g.lineWidth = 2; rr(g, x + 1, y + 1, w - 2, h - 2, r); g.stroke(); g.restore();
}

// ── backgrounds: every one fills the whole frame and moves ──
function studio(g, t, o = {}) {
  const c1 = glowOf(o.c1 || "#2b4cff"), c2 = glowOf(o.c2 || "#e8263f");
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, o.top || "#0b1124"); bg.addColorStop(1, o.bot || "#05070f"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const a = g.createRadialGradient(120 + Math.sin(t * 0.4) * 60, 380, 0, 120, 380, 900); a.addColorStop(0, rgba(c1, 0.42)); a.addColorStop(1, rgba(c1, 0)); g.fillStyle = a; g.fillRect(0, 0, W, H);
  const b = g.createRadialGradient(980, 1150 + Math.cos(t * 0.35) * 60, 0, 980, 1150, 900); b.addColorStop(0, rgba(c2, 0.28)); b.addColorStop(1, rgba(c2, 0)); g.fillStyle = b; g.fillRect(0, 0, W, H);
  // drifting diagonal light streaks
  g.save(); g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) { const x = ((i * 310 + t * 60) % 1700) - 400; const gr = g.createLinearGradient(x, 0, x + 140, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(255,255,255,${0.035 + (i % 2) * 0.02})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.save(); g.translate(x, 0); g.transform(1, 0, -0.45, 1, 0, 0); g.fillRect(0, 0, 140 + i * 30, H); g.restore(); }
  g.restore();
  // a fine dot grid
  g.fillStyle = "rgba(255,255,255,.05)"; for (let y = 40; y < H; y += 44) for (let x = (y / 44) % 2 ? 22 : 0; x < W; x += 44) g.fillRect(x, y, 2.4, 2.4);
  vignette(g);
}
function vignette(g, k = 0.55) { const v = g.createRadialGradient(540, 820, 300, 540, 820, 1250); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${k})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
// a floodlit stadium at night: stands of fans in club colours, the pitch below
function stadium(g, t, o = {}) {
  const sky = g.createLinearGradient(0, 0, 0, 900); sky.addColorStop(0, "#050816"); sky.addColorStop(1, o.day ? "#5a8fc8" : "#18264f"); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (const [x, y] of [[90, 140], [990, 140]]) { const f = g.createRadialGradient(x, y, 0, x, y, 520); f.addColorStop(0, "rgba(255,250,225,.75)"); f.addColorStop(0.08, "rgba(255,245,210,.35)"); f.addColorStop(1, "rgba(255,245,210,0)"); g.fillStyle = f; g.fillRect(0, 0, W, 1000); g.fillStyle = "#fffbe8"; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.fillRect(x - 36 + i * 20, y - 20 + j * 16, 14, 10); }
  const sy = 520, sh = 560; g.fillStyle = "#1a1d27"; g.fillRect(0, sy, W, sh);
  const r = seeded(o.seed || 11); const cols = o.crowd || ["#d2122e", "#ffffff", "#f2c94c", "#2b2b2b", "#e7e7e7", "#1d4fa3"];
  for (let row = 0; row < 26; row++) { const y = sy + 14 + row * (sh - 20) / 26; const sz = 6 + row * 0.35; for (let x = (row % 2) * 9; x < W; x += sz * 2.2) { const bob = Math.sin(t * 6 + x * 0.05 + row) * (row % 3 === 0 ? 2 : 0); g.fillStyle = cols[Math.floor(r() * cols.length)]; g.globalAlpha = 0.55 + 0.45 * r(); g.beginPath(); g.arc(x + r() * 4, y + bob, sz * 0.75, 0, 7); g.fill(); } }
  g.globalAlpha = 1;
  const shadeStand = g.createLinearGradient(0, sy, 0, sy + sh); shadeStand.addColorStop(0, "rgba(5,8,22,.65)"); shadeStand.addColorStop(1, "rgba(5,8,22,.1)"); g.fillStyle = shadeStand; g.fillRect(0, sy, W, sh);
  // an advertising board strip that glows in club colours
  const ad = g.createLinearGradient(0, 0, W, 0); ad.addColorStop(0, o.c1 || "#e8263f"); ad.addColorStop(0.5, "#ffffff"); ad.addColorStop(1, o.c1 || "#e8263f");
  g.globalAlpha = 0.75; g.fillStyle = ad; g.fillRect(0, sy + sh - 6, W, 22); g.globalAlpha = 1;
  const py = sy + sh + 16; const pg = g.createLinearGradient(0, py, 0, H); pg.addColorStop(0, "#2f8a3c"); pg.addColorStop(1, "#1c5a26"); g.fillStyle = pg; g.fillRect(0, py, W, H - py);
  for (let i = 0; i < 9; i++) { const y0 = py + Math.pow(i / 9, 1.6) * (H - py), y1 = py + Math.pow((i + 1) / 9, 1.6) * (H - py); g.fillStyle = i % 2 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)"; g.fillRect(0, y0, W, y1 - y0); }
  vignette(g, 0.6);
}

// ── clubs, badges, people ──
const D = () => window.STORY;
const IMG = new Map();
function loadImg(src) { if (!IMG.has(src)) IMG.set(src, new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; })); return IMG.get(src); }
const BADGE = {};
async function preload() {
  for (const [id, c] of Object.entries(D().clubs || {})) if (c.badgeSrc) BADGE[id] = await loadImg("file://" + c.badgeSrc);
}
function teamOf(raw) { return raw.kit === "suit" ? (raw.club || "") : raw.kit; }
function club(id) { return (D().clubs || {})[id] || { name: id || "", short: (id || "?").slice(0, 3).toUpperCase(), c1: "#555555", c2: "#ffffff", pattern: "plain" }; }
function drawnCrest(g, id, x, y, r) {
  const c = club(id); g.save(); g.translate(x, y);
  const shield = () => { g.beginPath(); g.moveTo(-r * 0.86, -r * 0.92); g.lineTo(r * 0.86, -r * 0.92); g.lineTo(r * 0.86, r * 0.05); g.quadraticCurveTo(r * 0.82, r * 0.72, 0, r); g.quadraticCurveTo(-r * 0.82, r * 0.72, -r * 0.86, r * 0.05); g.closePath(); };
  g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = r * 0.2; g.shadowOffsetY = r * 0.06; shield(); g.fillStyle = "#f4f1e8"; g.fill(); g.restore();
  g.save(); g.scale(0.86, 0.86); shield(); g.clip(); g.fillStyle = c.c1; g.fillRect(-r, -r, 2 * r, 2 * r); g.fillStyle = c.c2;
  if (c.pattern === "stripes") for (let i = -3; i <= 3; i += 2) g.fillRect(i * r * 0.26 - r * 0.13, -r, r * 0.26, 2 * r);
  else if (c.pattern === "halves") g.fillRect(0, -r, r, 2 * r);
  else if (c.pattern === "hoops") for (let i = -3; i <= 3; i += 2) g.fillRect(-r, i * r * 0.26 - r * 0.13, 2 * r, r * 0.26);
  else if (c.pattern === "centre") g.fillRect(-r * 0.22, -r, r * 0.44, 2 * r);
  else if (c.pattern === "sash") { g.beginPath(); g.moveTo(-r, -r * 0.6); g.lineTo(-r * 0.6, -r); g.lineTo(r, r * 0.6); g.lineTo(r * 0.6, r); g.closePath(); g.fill(); }
  else { g.fillRect(-r, -r * 0.1, 2 * r, r * 0.22); }
  g.restore();
  const txt = c.short || ""; T(g, txt, 0, r * 0.2, r * (txt.length > 3 ? 0.46 : 0.6), { color: "#fff", stroke: r * 0.12, strokeColor: "#111", maxW: r * 1.4 });
  g.restore();
}
// the club's real badge when there is one, else the drawn crest; (x, y) is the centre
function crest(g, id, x, y, r) {
  const im = BADGE[id];
  if (!im) return drawnCrest(g, id, x, y, r);
  const k = Math.min(2 * r / im.width, 2 * r / im.height); const w = im.width * k, h = im.height * k;
  if (club(id).badgeDark) { g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = r * 0.2; g.shadowOffsetY = r * 0.05; const lg = g.createLinearGradient(0, y - r, 0, y + r); lg.addColorStop(0, "#ffffff"); lg.addColorStop(1, "#dfe3ea"); g.fillStyle = lg; g.beginPath(); g.arc(x, y, r * 1.08, 0, 7); g.fill(); g.restore(); }
  g.save(); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = r * 0.25; g.shadowOffsetY = r * 0.08; g.drawImage(im, x - w / 2, y - h / 2, w, h); g.restore();
}
function kitFor(p) {
  if (!p || p.kit === "suit") return null;
  const c = club(p.kit); const darkShirt = lum(c.c1) < 0.5;
  return { shirt: c.c1, trim: c.c2, collar: c.pattern === "plain" ? (darkShirt ? "#ffffff" : "#111111") : c.c2, pattern: c.pattern === "plain" ? undefined : c.pattern };
}
function personSpec(id) {
  const p = (D().people || {})[id]; if (!p) return null;
  return { spec: { name: p.name, skin: p.skin || "light", hair: p.hair || ["crop", "#3a281c"], beard: p.beard || "none", beardCol: p.beardCol, suit: p.kit === "suit" ? { jacket: "#22252e", tie: "#8e1426" } : undefined }, kit: kitFor(p) || { shirt: "#222", trim: "#222", collar: "#333" }, raw: p };
}
function colourOf(id) { const p = personSpec(id); const c = p && teamOf(p.raw) ? club(teamOf(p.raw)) : null; return c ? c.c1 : "#3b6fb5"; }
const MOOD = { happy: { mouth: "grin" }, flat: { mouth: "flat" }, worried: { mouth: "flat", worried: true }, shocked: { mouth: "o", worried: true }, smile: { mouth: "smile" } };
function person(g, id, x, y, r, o = {}) {
  const p = personSpec(id); if (!p) return;
  window.drawAvatar(g, x, y, r, p.spec, p.kit, { ...(MOOD[o.mood] || { mouth: "smile" }), ...o });
}
// a person in a ringed disc (portraits in charts, podiums and lists)
function portrait(g, id, x, y, r, o = {}) { const c = colourOf(id); person(g, id, x, y, r, { mood: o.mood || "smile", bgTop: shadeC(glowOf(c), 0.75), bgBot: shadeC(c, 0.3), ring: o.ring || "rgba(255,255,255,.9)", ...o }); }
function surname(id) { const p = personSpec(id); if (!p) return ""; const n = p.raw.name.split(" "); return n.length > 1 ? n.slice(1).join(" ") : n[0]; }

function trophy(g, kind, x, y, h) { window.drawTrophy(g, kind, x, y, h); }
function stamp(g, s, x, y, t, rot = -0.14, col = "#ff3b4e", size = 110) {
  const k = ez(t * 4); if (k <= 0) return; const sc = 1 + (1 - k) * 1.6;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc); g.globalAlpha = k; g.font = FONT.anton(size);
  const w = Math.min(980, g.measureText(s).width + 70), h = size * 1.2;
  g.fillStyle = "rgba(0,0,0,.45)"; rr(g, -w / 2, -h * 0.68, w, h, 14); g.fill();
  g.strokeStyle = col; g.lineWidth = 12; rr(g, -w / 2, -h * 0.68, w, h, 14); g.stroke(); g.lineWidth = 3; rr(g, -w / 2 + 14, -h * 0.68 + 14, w - 28, h - 28, 8); g.stroke();
  T(g, s, 0, size * 0.32, size, { color: col, maxW: w - 50 }); g.restore();
}
const COL = { red: "#ff3b4e", yellow: "#ffd84a", white: "#ffffff", green: "#22c55e" };
// A scene header: a coloured kicker tag, then a big two-line-max title, left aligned.
function header(g, t, kicker, title, o = {}) {
  const y = o.y ?? 290; const k = ez(t * 3.5); let yy = y;
  g.save(); g.globalAlpha = k; g.translate((1 - k) * -40, 0);
  if (kicker) { g.font = FONT.inter(28, 900); g.letterSpacing = "4px"; const s = String(kicker).toUpperCase(); const w = g.measureText(s).width; g.fillStyle = o.kc || "#e8263f"; rr(g, 60, yy - 40, w + 36, 50, 8); g.fill(); g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(s, 78, yy - 14); yy += 30; }
  if (title) { const size = o.size || 96; const lines = wrapLines(g, String(title).toUpperCase(), o.maxW || 900, FONT.anton(size)).slice(0, 2); lines.forEach((l, i) => T(g, l, 60, yy + size * 0.95 + i * size * 1.02, size, { align: "left", color: o.color || "#fff", shadow: 16, maxW: o.maxW || 900 })); yy += lines.length * size * 1.02 + 10; }
  g.restore(); return yy;
}
function reveal(i, n, dur, start = 0.15, end = 0.75) { return dur * (start + (end - start) * (n <= 1 ? 0 : i / (n - 1))); }
function count(n, k) { const m = String(n).match(/^([^0-9]*)([0-9][0-9,.]*)(.*)$/); if (!m) return String(n); const v = parseFloat(m[2].replace(/,/g, "")); const dec = (m[2].split(".")[1] || "").length; const x = v * k; const txt = m[2].includes(",") ? x.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : x.toFixed(dec); return m[1] + txt + m[3]; }
// a big faded word behind a scene (an editorial touch)
function ghost(g, s, y, size = 300, a = 0.07) { if (!s) return; T(g, String(s).toUpperCase(), 540, y, size, { color: `rgba(255,255,255,${a})`, maxW: 1300 }); }
function nameplate(g, t, x, y, name, sub, clubId, o = {}) {
  const k = ez(t * 3); if (k <= 0) return; g.save(); g.globalAlpha = k; g.translate((1 - k) * -60, 0);
  g.font = FONT.anton(64); const w = Math.max(420, Math.min(880, g.measureText(String(name).toUpperCase()).width + (clubId ? 150 : 60)));
  panel(g, x, y, w, 96, "#ffffff", 10); g.fillStyle = o.accent || "#e8263f"; g.fillRect(x, y, 12, 96);
  if (clubId) crest(g, clubId, x + 70, y + 48, 36);
  T(g, String(name).toUpperCase(), x + (clubId ? 120 : 40), y + 72, 64, { align: "left", color: "#0b1020", maxW: w - (clubId ? 150 : 60) });
  if (sub) { g.font = FONT.inter(30, 900); const sw = g.measureText(String(sub).toUpperCase()).width + 40; g.fillStyle = "#0b1020"; rr(g, x, y + 104, Math.min(880, sw + 6), 50, 8); g.fill(); T(g, String(sub).toUpperCase(), x + 20, y + 140, 30, { align: "left", font: "Inter", weight: 900, spacing: 2, color: "#ffd84a", maxW: 840 }); }
  g.restore();
}
function rays(g, cx, cy, t, col = "rgba(255,255,255,.06)", n = 16) { g.save(); g.translate(cx, cy); g.rotate(t * 0.12); for (let i = 0; i < n; i++) { g.rotate(Math.PI * 2 / n); if (i % 2) continue; g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.lineTo(-110, -1500); g.lineTo(110, -1500); g.closePath(); g.fill(); } g.restore(); }
function confetti(g, t, seed = 5, n = 70, cols = ["#ffd84a", "#ffffff", "#e8263f", "#3b82f6"]) { const r = seeded(seed); for (let i = 0; i < n; i++) { const x = r() * W, sp = 120 + r() * 220, y = ((r() * H + t * sp) % (H + 100)) - 50, a = t * (2 + r() * 3) + i; g.save(); g.translate(x + Math.sin(a) * 20, y); g.rotate(a); g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85; g.fillRect(-7, -4, 14, 8); g.restore(); } }

// ════════ scene types ════════
const S = {};
S.title = (g, t, dur, s) => {
  const p = personSpec(s.person); const cid = s.club || (p ? teamOf(p.raw) : ""); const c = cid ? club(cid) : null;
  stadium(g, t, { seed: 3, c1: c?.c1, crowd: c ? [c.c1, c.c2, "#2b2b2b", "#ffffff", c.c1] : undefined });
  if (cid) { g.save(); g.globalAlpha = 0.16 * ez(t * 2); crest(g, cid, 540, 900, 380); g.restore(); }
  rays(g, 540, 1000, t, "rgba(255,240,200,.05)");
  if (s.person) { const lift = (1 - ez(t * 1.8)) * 120; g.save(); g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 50; person(g, s.person, 540, 1010 + lift, 300, { noDisc: true, mouth: "grin" }); g.restore(); }
  const k = ez((t - 0.1) * 3);
  g.save(); g.globalAlpha = k;
  const head = String(s.heading || "").toUpperCase(); const lines = wrapLines(g, head, 960, FONT.antonI(170)).slice(0, 2);
  lines.forEach((l, i) => T(g, l, 540, 420 + i * 165 - (lines.length - 1) * 80 + (1 - k) * 40, 170, { italic: true, color: "#fff", stroke: 16, shadow: 30, maxW: 960 }));
  if (s.sub) T(g, String(s.sub).toUpperCase(), 540, 500 + (lines.length - 1) * 85, 50, { font: "Inter", weight: 900, spacing: 3, color: "#ffd84a", stroke: 8, maxW: 900 });
  g.restore();
  if (cid) { const q = pop((t - 0.35) * 3); if (q > 0) { g.save(); g.translate(930, 600); g.scale(q, q); crest(g, cid, 0, 0, 70); g.restore(); } }
  if (s.pill && t > 0.6) { const q = pop((t - 0.6) * 2.8); g.save(); g.translate(540, 650 + (lines.length - 1) * 85); g.rotate(-0.04); g.scale(q, q); g.font = FONT.antonI(64); const w = Math.min(980, g.measureText(s.pill).width + 80); g.save(); g.shadowColor = "rgba(232,38,63,.7)"; g.shadowBlur = 40; g.fillStyle = "#e8263f"; rr(g, -w / 2, -54, w, 96, 12); g.fill(); g.restore(); T(g, String(s.pill).toUpperCase(), 0, 22, 64, { italic: true, color: "#fff", maxW: w - 50 }); g.restore(); }
};
S.person = (g, t, dur, s) => {
  const p = personSpec(s.person); const cid = p ? teamOf(p.raw) : ""; const c = club(cid);
  studio(g, t, { c1: c.c1, c2: c.c2 === "#ffffff" ? c.c1 : c.c2 });
  // diagonal club-colour bands behind
  g.save(); g.translate(540, 820); g.rotate(-0.32); for (let i = -3; i <= 3; i++) { g.fillStyle = rgba(i % 2 ? c.c2 : glowOf(c.c1), 0.10); g.fillRect(i * 170 - 60 + Math.sin(t * 0.6) * 20, -1400, 110, 2800); } g.restore();
  ghost(g, surname(s.person), 1180, 330, 0.08);
  if (cid) { g.save(); g.globalAlpha = 0.18; crest(g, cid, 790, 560, 200); g.restore(); }
  const lift = (1 - ez(t * 2.2)) * 80; g.save(); g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 60; person(g, s.person, 540, 900 + lift, 330, { noDisc: true, mood: s.mood || "happy" }); g.restore();
  header(g, t, p ? p.raw.name : "", s.label || "", { size: 84 });
};
S.versus = (g, t, dur, s) => {
  const L = s.left || {}, R = s.right || {}; const lc = L.person ? colourOf(L.person) : club(L.club).c1, rc = R.person ? colourOf(R.person) : club(R.club).c1;
  g.fillStyle = "#070a14"; g.fillRect(0, 0, W, H);
  const split = (side, col) => { g.save(); g.beginPath(); if (side < 0) { g.moveTo(0, 0); g.lineTo(600, 0); g.lineTo(480, H); g.lineTo(0, H); } else { g.moveTo(600, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(480, H); } g.closePath(); g.clip(); const gr = g.createLinearGradient(side < 0 ? 0 : W, 0, 540, 0); gr.addColorStop(0, shadeC(glowOf(col), 0.75)); gr.addColorStop(1, shadeC(col, 0.25)); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = "rgba(255,255,255,.04)"; for (let y = 0; y < H; y += 26) g.fillRect(0, y, W, 2); g.restore(); };
  split(-1, lc); split(1, rc);
  g.save(); g.strokeStyle = "#ffd84a"; g.lineWidth = 8; g.shadowColor = "#ffd84a"; g.shadowBlur = 30; g.beginPath(); g.moveTo(600, 0); g.lineTo(480, H); g.stroke(); g.restore();
  vignette(g, 0.4);
  if (s.title) T(g, String(s.title).toUpperCase(), 540, 290, 78, { color: "#fff", stroke: 10, shadow: 20, maxW: 960, alpha: ez(t * 3) });
  const a = ez(t * 2.6), b = ez((t - 0.2) * 2.6);
  const side = (o, x, k, dir) => {
    const cid = o.club || (o.person ? teamOf(personSpec(o.person)?.raw || {}) : "");
    if (o.person) portrait(g, o.person, x + dir * (1 - k) * 300, 600, 200, { mood: "happy", ring: "#ffffff" });
    else if (cid) crest(g, cid, x + dir * (1 - k) * 300, 600, 180);
    if (cid && o.person) crest(g, cid, x + 150 + dir * (1 - k) * 300, 760, 52);
  };
  side(L, 280, a, -1); side(R, 800, b, 1);
  const vk = pop((t - 0.35) * 3); if (vk > 0) { g.save(); g.translate(540, 640); g.scale(vk, vk); g.rotate(-0.08); T(g, "VS", 0, 50, 150, { italic: true, color: "#ffd84a", stroke: 14, glow: 30, glowColor: "rgba(255,216,74,.7)" }); g.restore(); }
  const v = ez((t - 0.5) * 2.5);
  for (const [o, x] of [[L, 280], [R, 800]]) {
    g.save(); g.globalAlpha = v; g.font = FONT.anton(52); const lbl = String(o.label || "").toUpperCase(); const w = Math.min(440, g.measureText(lbl).width + 50);
    g.fillStyle = "#ffffff"; rr(g, x - w / 2, 880, w, 78, 10); g.fill(); T(g, lbl, x, 940, 52, { color: "#0b1020", maxW: w - 30 }); g.restore();
    if (o.value != null) T(g, count(o.value, ez((t - 0.6) * 1.4)), x, 1170, 190, { color: o.win ? "#ffd84a" : "#fff", stroke: 14, shadow: 30, alpha: v, maxW: 470 });
    if (o.sub) T(g, String(o.sub).toUpperCase(), x, 1215, 32, { font: "Inter", weight: 900, spacing: 2, color: "rgba(255,255,255,.8)", alpha: v, maxW: 470 });
  }
};
S.stats = (g, t, dur, s) => {
  const c = s.person ? colourOf(s.person) : "#3b6fb5"; studio(g, t, { c1: c });
  const items = (s.items || []).slice(0, 4); const n = items.length;
  let y0 = header(g, t, s.kicker || (s.person ? personSpec(s.person)?.raw.name : ""), s.title, { maxW: s.person ? 640 : 900, size: 88 });
  if (s.person) { const k = pop((t - 0.1) * 2.5); g.save(); g.translate(850, 360); g.scale(k, k); portrait(g, s.person, 0, 0, 140, { mood: "happy" }); g.restore(); }
  y0 = Math.max(y0 + 30, 560);
  const cols = n > 2 ? 2 : 1, rows = Math.ceil(n / cols), gap = 28;
  const cw = (960 - gap * (cols - 1)) / cols, ch = Math.min(320, (BOT - y0 - gap * (rows - 1)) / rows);
  items.forEach((it, i) => {
    const at = reveal(i, n, dur, 0.12, 0.5); const k = cl((t - at) / 0.7); if (k <= 0) return;
    const x = 60 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap) + (1 - ez(k)) * 60;
    g.save(); g.globalAlpha = ez(k * 1.5); card(g, x, y, cw, ch, i % 2 ? "#ffd84a" : c, 28, 0.35);
    const big = cols === 1 ? 210 : 150; const col = i % 2 ? "#ffd84a" : "#ffffff";
    T(g, count(it.n, ez(k)), x + (cols === 1 ? 60 : cw / 2), y + ch * 0.62, big, { align: cols === 1 ? "left" : "center", color: col, glow: 24, glowColor: rgba(i % 2 ? "#ffd84a" : glowOf(c), 0.6), maxW: cols === 1 ? 520 : cw - 40 });
    T(g, String(it.l || "").toUpperCase(), cols === 1 ? x + cw - 50 : x + cw / 2, cols === 1 ? y + ch * 0.58 : y + ch - 36, cols === 1 ? 46 : 34, { align: cols === 1 ? "right" : "center", font: "Inter", weight: 900, spacing: 3, color: "rgba(255,255,255,.75)", maxW: cols === 1 ? 360 : cw - 40 });
    g.fillStyle = col; g.globalAlpha *= 0.9; rr(g, x + 30, y + ch - 14, (cw - 60) * ez(k), 6, 3); g.fill();
    g.restore();
  });
};
S.score = (g, t, dur, s) => {
  const hc = club(s.home), ac = club(s.away); studio(g, t, { c1: hc.c1, c2: ac.c1 });
  const k = ez(t * 3);
  // competition strap
  g.save(); g.globalAlpha = k; g.font = FONT.inter(34, 900); g.letterSpacing = "4px"; const comp = String(s.comp || "").toUpperCase(); const cw = Math.min(960, g.measureText(comp).width + 70);
  g.fillStyle = "#ffd84a"; rr(g, 540 - cw / 2, 270, cw, 64, 32); g.fill(); g.restore();
  T(g, comp, 540, 314, 34, { font: "Inter", weight: 900, spacing: 4, color: "#0b1020", alpha: k, maxW: 900 });
  if (s.date) T(g, String(s.date).toUpperCase(), 540, 392, 32, { font: "Inter", weight: 700, spacing: 3, color: "rgba(255,255,255,.75)", alpha: k });
  card(g, 60, 450, 960, 520, "#ffffff", 34, 0.08);
  const a = pop((t - 0.15) * 2.6), b = pop((t - 0.3) * 2.6);
  g.save(); g.translate(230, 650); g.scale(a, a); crest(g, s.home, 0, 0, 130); g.restore();
  g.save(); g.translate(850, 650); g.scale(b, b); crest(g, s.away, 0, 0, 130); g.restore();
  T(g, (hc.name || "").toUpperCase(), 230, 880, 46, { color: "#fff", maxW: 300, alpha: ez((t - 0.3) * 3) }); T(g, (ac.name || "").toUpperCase(), 850, 880, 46, { color: "#fff", maxW: 300, alpha: ez((t - 0.3) * 3) });
  const q = pop((t - 0.5) * 2.5); g.save(); g.translate(540, 660); g.scale(q, q);
  g.fillStyle = "#0b1020"; rr(g, -150, -110, 300, 190, 24); g.fill(); g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 3; rr(g, -150, -110, 300, 190, 24); g.stroke();
  T(g, `${s.hs ?? ""}`, -70, 50, 150, { color: "#fff" }); T(g, "-", 0, 40, 110, { color: "rgba(255,255,255,.5)" }); T(g, `${s.as ?? ""}`, 70, 50, 150, { color: "#fff" });
  g.restore();
  if (s.ft !== false) T(g, s.ft || "FULL TIME", 540, 820, 30, { font: "Inter", weight: 900, spacing: 4, color: "#ffd84a", alpha: ez((t - 0.7) * 3) });
  if (s.note) { const lines = wrapLines(g, s.note, 860, FONT.inter(44, 700)).slice(0, 3); const h = lines.length * 58 + 50; const kk = ez((t - 0.8) * 3); g.save(); g.globalAlpha = kk; card(g, 60, 1010, 960, h, "#e8263f", 22, 0.35); lines.forEach((l, i) => T(g, l, 540, 1068 + i * 58, 44, { font: "Inter", weight: 700, color: "#fff" })); g.restore(); }
};
S.trophies = (g, t, dur, s) => {
  // a dark trophy room, spotlights, each trophy on its own plinth with a name plate
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0d0b08"); bg.addColorStop(0.6, "#1c160c"); bg.addColorStop(1, "#060504"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const items = (s.items || []).slice(0, 6); const n = items.length; const rows = n > 3 ? 2 : 1; const per = Math.ceil(n / rows);
  const y0 = header(g, t, s.kicker || (s.person ? personSpec(s.person)?.raw.name : "Trophy cabinet"), s.title || "", { kc: "#b8862a", size: 84 });
  const areaTop = Math.max(y0 + 30, 480), areaH = BOT - areaTop; const rowH = areaH / rows;
  items.forEach((it, i) => {
    const row = Math.floor(i / per), col = i % per, inRow = row === rows - 1 ? n - per * (rows - 1) : per;
    const gap = 960 / inRow, x = 60 + gap * (col + 0.5), base = areaTop + rowH * (row + 1) - 40;
    const at = reveal(i, n, dur, 0.1, 0.6); const k = cl((t - at) / 0.5); if (k <= 0) return;
    const sp = g.createLinearGradient(x, 0, x, base); sp.addColorStop(0, `rgba(255,228,170,${0.0})`); sp.addColorStop(1, `rgba(255,228,170,${0.18 * k})`); g.fillStyle = sp; g.beginPath(); g.moveTo(x - 30, areaTop - 200); g.lineTo(x + 30, areaTop - 200); g.lineTo(x + gap * 0.48, base); g.lineTo(x - gap * 0.48, base); g.fill();
    const pw = Math.min(300, gap * 0.86), ph = 90;
    const pl = g.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0); pl.addColorStop(0, "#1b1712"); pl.addColorStop(0.5, "#3b3226"); pl.addColorStop(1, "#1b1712"); g.fillStyle = pl; g.fillRect(x - pw / 2, base - ph, pw, ph + 40);
    g.fillStyle = "#c9a24a"; g.fillRect(x - pw / 2, base - ph, pw, 5);
    const th = Math.min(rowH - 130, gap * 1.3, 560); const q = pop(k * 1.4);
    g.save(); g.translate(x, base - ph); g.scale(q, q); trophy(g, it.kind || "cup", 0, 0, th); g.restore();
    // glints
    if (k >= 1) { const ph2 = (t * 1.3 + i * 0.37) % 2.4; if (ph2 < 0.5) { g.save(); g.globalAlpha = Math.sin(ph2 / 0.5 * Math.PI); g.fillStyle = "#fffbe6"; g.translate(x + th * 0.12, base - ph - th * 0.7); g.rotate(ph2 * 2); g.fillRect(-2, -18, 4, 36); g.fillRect(-18, -2, 36, 4); g.restore(); } }
    wrapLines(g, String(it.label || "").toUpperCase(), pw - 20, FONT.inter(28, 900)).slice(0, 3).forEach((l, j, arr) => T(g, l, x, base - 32 + (j - (arr.length - 1) / 2) * 29, 28, { font: "Inter", weight: 900, color: "#f3dc9a", alpha: ez(k * 2), maxW: pw - 16 }));
    if (it.count) { const cq = pop((t - at - 0.3) * 3); if (cq > 0) { g.save(); g.translate(x + pw / 2 - 10, base - ph - th + 20); g.scale(cq, cq); g.fillStyle = "#e8263f"; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); T(g, "×" + it.count, 0, 14, 40, { color: "#fff" }); g.restore(); } }
  });
};
S.list = (g, t, dur, s) => {
  studio(g, t, {});
  const y0 = Math.max(header(g, t, s.kicker || "", s.title, { size: 84 }) + 20, 470);
  const rows = (s.rows || []).slice(0, 8); const n = rows.length; const rh = Math.min(150, (BOT - y0) / Math.max(1, n));
  card(g, 60, y0 - 10, 960, rh * n + 20, "#3b6fb5", 26, 0.2);
  rows.forEach((r, i) => {
    const at = reveal(i, n, dur, 0.08, 0.6); const k = ez((t - at) * 4); if (k <= 0) return;
    const y = y0 + i * rh; g.save(); g.globalAlpha = k; g.translate((1 - k) * 120, 0);
    const col = r.club ? glowOf(club(r.club).c1) : "#ffd84a";
    if (r.hl) { const gr = g.createLinearGradient(70, 0, 1010, 0); gr.addColorStop(0, rgba(col, 0.85)); gr.addColorStop(0.55, rgba(col, 0.45)); gr.addColorStop(1, rgba(col, 0.25)); g.fillStyle = gr; rr(g, 70, y + 4, 940, rh - 8, 14); g.fill(); g.strokeStyle = tint(col, 0.5); g.lineWidth = 3; rr(g, 70, y + 4, 940, rh - 8, 14); g.stroke(); }
    else if (i % 2 === 0) { g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(70, y + 4, 940, rh - 8); }
    T(g, String(r.pos ?? i + 1), 130, y + rh * 0.66, rh * 0.5, { color: r.hl ? "#fff" : "#ffd84a" });
    let x = 190; if (r.person) { portrait(g, r.person, x + rh * 0.38, y + rh / 2, rh * 0.36); x += rh * 0.85; } else if (r.club) { crest(g, r.club, x + rh * 0.34, y + rh / 2, rh * 0.34); x += rh * 0.8; }
    T(g, String(r.name || ""), x, y + rh * 0.64, rh * 0.38, { align: "left", font: "Inter", weight: 900, color: "#fff", maxW: 600 - (x - 190) });
    if (r.value != null) T(g, count(r.value, ez((t - at) * 2)), 980, y + rh * 0.68, rh * 0.55, { align: "right", color: r.hl ? "#fef08a" : "#fff", maxW: 240 });
    g.restore();
  });
};
S.text = (g, t, dur, s) => {
  studio(g, t, { c1: "#7c3aed" });
  const k = ez(t * 3); const y = 330 + (1 - k) * 60;
  const lines = wrapLines(g, s.body || "", 820, FONT.inter(50, 700)).slice(0, 9); const h = 200 + lines.length * 70 + 40;
  g.save(); g.globalAlpha = k; card(g, 60, y, 960, Math.min(h, BOT - y), "#7c3aed", 32, 0.35);
  g.fillStyle = "#a78bfa"; g.beginPath(); g.arc(140, y + 90, 40, 0, 7); g.fill(); T(g, "i", 140, y + 112, 60, { color: "#140b2e" });
  T(g, String(s.heading || "").toUpperCase(), 210, y + 116, 76, { align: "left", color: "#fff", maxW: 760 });
  g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(110, y + 170, 860, 3);
  lines.forEach((l, i) => T(g, l, 110, y + 250 + i * 70, 50, { align: "left", font: "Inter", weight: 700, color: "#e9e6ff", alpha: ez((t - 0.25 - i * 0.12) * 3) }));
  g.restore();
};
S.quote = (g, t, dur, s) => {
  const c = colourOf(s.person); studio(g, t, { c1: c });
  const lines = wrapLines(g, s.text || "", 840, FONT.inter(76, 900)).slice(0, 5); const h = lines.length * 94 + 250;
  const k = ez((t - 0.1) * 3);
  g.save(); g.globalAlpha = k; g.translate(0, (1 - k) * 40);
  card(g, 60, 260, 960, h, c, 32, 0.35);
  g.save(); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 20; g.fillStyle = glowOf(c); g.beginPath(); g.arc(150, 262, 62, 0, 7); g.fill(); g.restore(); T(g, "“", 150, 345, 170, { color: "#fff" });
  lines.forEach((l, i) => T(g, l, 120, 470 + i * 94, 76, { align: "left", font: "Inter", weight: 900, color: "#fff", alpha: ez((t - 0.3 - i * 0.12) * 3) }));
  T(g, "— " + (personSpec(s.person)?.raw.name || s.by || ""), 960, 260 + h - 40, 36, { align: "right", font: "Inter", weight: 700, color: "#ffd84a", spacing: 1 });
  g.restore();
  const top = 260 + h + 40;
  person(g, s.person, 400, Math.max(top + 200, 980), 250, { noDisc: true, talk: 0.45 + 0.45 * Math.sin(t * 17), mouth: "smile" });
};
S.timeline = (g, t, dur, s) => {
  studio(g, t, { c1: "#0ea5e9" });
  const y0 = Math.max(header(g, t, s.kicker || "", s.title, { size: 84 }) + 30, 470);
  const items = (s.items || []).slice(0, 6); const n = items.length; const step = Math.min(200, (BOT - y0) / Math.max(1, n)); const lx = 250;
  const prog = ez((t - 0.1) / Math.max(0.5, dur * 0.75));
  g.strokeStyle = "rgba(255,255,255,.15)"; g.lineWidth = 8; g.beginPath(); g.moveTo(lx, y0); g.lineTo(lx, y0 + step * n - 30); g.stroke();
  const lg = g.createLinearGradient(0, y0, 0, y0 + step * n); lg.addColorStop(0, "#38bdf8"); lg.addColorStop(1, "#ffd84a"); g.strokeStyle = lg; g.beginPath(); g.moveTo(lx, y0); g.lineTo(lx, y0 + (step * n - 30) * prog); g.stroke();
  items.forEach((it, i) => {
    const at = reveal(i, n, dur, 0.1, 0.7); const k = cl((t - at) / 0.45); if (k <= 0) return; const y = y0 + i * step + step / 2 - 20;
    const hl = it.hl; const col = hl ? "#ffd84a" : "#38bdf8";
    g.save(); g.globalAlpha = ez(k);
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 20; g.beginPath(); g.arc(lx, y, 18 * pop(k), 0, 7); g.fill(); g.shadowBlur = 0;
    T(g, String(it.year), lx - 40, y + 22, 64, { align: "right", color: col, maxW: 170 });
    const x = lx + 50 + (1 - ez(k)) * 80, w = 1000 - x; const ch = step - 26;
    card(g, x, y - ch / 2, w, ch, hl ? "#ffd84a" : "#38bdf8", 18, hl ? 0.45 : 0.22);
    let tx = x + 28; if (it.club) { crest(g, it.club, x + 60, y, Math.min(42, ch * 0.36)); tx += 80; }
    const ls = wrapLines(g, it.label || "", w - (tx - x) - 24, FONT.inter(46, 800)).slice(0, 2); const fs = ls.length > 1 || ch < 120 ? 40 : 48;
    ls.forEach((l, j) => T(g, l, tx, y + 15 + (j - (ls.length - 1) / 2) * 50, fs, { align: "left", font: "Inter", weight: 800, color: "#fff", maxW: w - (tx - x) - 24 }));
    g.restore();
  });
};
S.podium = (g, t, dur, s) => {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0b0a12"); bg.addColorStop(0.65, "#1d160a"); bg.addColorStop(1, "#060504"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (const [x, a] of [[240, 0.08], [540, 0.16], [840, 0.08]]) { const sp = g.createLinearGradient(x, 0, x, H); sp.addColorStop(0, `rgba(255,230,160,${a * 2})`); sp.addColorStop(1, "rgba(255,230,160,0)"); g.fillStyle = sp; g.beginPath(); g.moveTo(x - 40, 0); g.lineTo(x + 40, 0); g.lineTo(x + 200, H); g.lineTo(x - 200, H); g.fill(); }
  header(g, t, s.year ? `Ballon d'Or ${s.year}` : "Ballon d'Or", s.title && s.title.toLowerCase() !== "ballon d'or" ? s.title : "The vote", { kc: "#b8862a", size: 84, color: "#ffd84a" });
  const places = (s.places || []).slice(0, 3); const order = [1, 0, 2]; const xs = [230, 540, 850], hs = [250, 340, 180], cols = ["#c9ced8", "#ffd23f", "#c98a4f"];
  const base = 1220;
  order.forEach((pi, slot) => {
    const pl = places[pi]; if (!pl) return; const at = dur * (0.12 + 0.22 * (2 - pi)); const k = ez((t - at) * 2.2); if (k <= 0) return;
    const x = xs[slot], h = hs[pi] * k, w = pi === 0 ? 300 : 270;
    const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, "#151a28"); gr.addColorStop(0.5, "#2a3146"); gr.addColorStop(1, "#151a28"); g.fillStyle = gr; g.fillRect(x - w / 2, base - h, w, h + 300);
    g.fillStyle = cols[pi]; g.fillRect(x - w / 2, base - h, w, 8);
    T(g, String(pi + 1), x, base - h + 100, 96, { color: cols[pi], alpha: k });
    if (pl.points != null) T(g, count(pl.points, ez((t - at - 0.3) * 1.5)) + " PTS", x, base - h + 160, 36, { font: "Inter", weight: 900, color: "#fff", alpha: k, maxW: w - 20 });
    const py = base - h - 140;
    if (pl.person) portrait(g, pl.person, x, py, pi === 0 ? 125 : 110, { mood: pi === 0 ? "happy" : "flat", ring: cols[pi] }); else if (pl.club) crest(g, pl.club, x, py, 100);
    if (pl.club && pl.person) crest(g, pl.club, x + 95, py + 80, 36);
    T(g, String(pl.name || surname(pl.person) || "").toUpperCase(), x, py - (pi === 0 ? 150 : 135), 46, { color: "#fff", stroke: 8, maxW: 290, alpha: k });
  });
  if (places[0]) { const k = ez((t - dur * 0.62) * 2); if (k > 0) { g.save(); g.globalAlpha = k; trophy(g, "ballon", 540, 1220 - 340 - 140 - 250 + (1 - k) * -80, 150); g.restore(); } }
};
S.stamp = (g, t, dur, s) => {
  const c = s.person ? colourOf(s.person) : "#e8263f";
  stadium(g, t, { seed: 19, c1: c }); g.fillStyle = "rgba(10,0,4,.55)"; g.fillRect(0, 0, W, H);
  const col = COL[s.color] || COL.red; const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  const rg = g.createRadialGradient(540, 760, 0, 540, 760, 900); rg.addColorStop(0, rgba(col === COL.yellow ? "#ffd84a" : "#ff3b4e", 0.18 + 0.08 * pulse)); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  if (s.person) { g.save(); g.filter = "saturate(.55)"; person(g, s.person, 540, 930, 320, { noDisc: true, mood: s.mood || "worried" }); g.restore(); }
  stamp(g, String(s.text || "").toUpperCase(), 540, 470, t - 0.3, -0.1, col, 170);
  if (s.sub) T(g, String(s.sub).toUpperCase(), 540, 640, 40, { font: "Inter", weight: 900, spacing: 3, color: "#fff", stroke: 8, alpha: ez((t - 0.8) * 3), maxW: 940 });
};
S.whatif = (g, t, dur, s) => {
  g.fillStyle = "#0b0d14"; g.fillRect(0, 0, W, H);
  const R = s.real || {}, A = s.alt || {};
  header(g, t, "What if?", s.title, { kc: "#7c3aed", size: 80 });
  const a = ez((t - 0.15) * 3), b = ez((t - dur * 0.4) * 3);
  const box = (o, y, h, k, alt) => {
    g.save(); g.globalAlpha = k; g.translate(alt ? (1 - k) * 120 : (1 - k) * -120, 0);
    if (alt) { const gr = g.createLinearGradient(60, y, 1020, y + h); gr.addColorStop(0, "#4b1d78"); gr.addColorStop(1, "#1d2b78"); g.save(); g.shadowColor = "rgba(124,58,237,.6)"; g.shadowBlur = 50; g.fillStyle = gr; rr(g, 60, y, 960, h, 30); g.fill(); g.restore(); const sh = (t * 200) % 1400 - 200; const sg = g.createLinearGradient(sh, 0, sh + 200, 0); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,.10)"); sg.addColorStop(1, "rgba(255,255,255,0)"); g.save(); rr(g, 60, y, 960, h, 30); g.clip(); g.fillStyle = sg; g.fillRect(0, y, W, h); g.restore(); }
    else card(g, 60, y, 960, h, "#9ca3af", 30, 0.2);
    T(g, alt ? "ALTERNATE WORLD" : "REAL WORLD", 110, y + 70, 34, { align: "left", font: "Inter", weight: 900, spacing: 5, color: alt ? "#e6d2ff" : "#cfd3da" });
    wrapLines(g, o.label || "", o.value != null ? 520 : 860, FONT.inter(44, 800)).slice(0, 4).forEach((l, i) => T(g, l, 110, y + 150 + i * 56, 44, { align: "left", font: "Inter", weight: 800, color: "#fff" }));
    if (o.value != null) T(g, String(o.value), 970, y + h / 2 + 60, 160, { align: "right", color: alt ? "#ffd84a" : "#fff", stroke: 10, maxW: 380 });
    g.restore();
  };
  box(R, 520, 330, a, false); box(A, 880, 330, b, true);
  const ak = ez((t - dur * 0.35) * 4); if (ak > 0) { g.save(); g.globalAlpha = ak; g.fillStyle = "#ffd84a"; g.beginPath(); g.moveTo(540, 870); g.lineTo(500, 845); g.lineTo(580, 845); g.fill(); g.restore(); }
};
S.cta = (g, t) => S.end(g, t);
// ── the end card: the approved Man United v Roma end card, 1:1 (drawn at 720x1280 there, x1.5 here) ──
function endText(g, s, x, y, size, fill, { italic = false, stroke = 10, base = "alphabetic" } = {}) {
  g.font = `${italic ? "italic " : ""}${size}px Anton`; g.letterSpacing = `${Math.round(size * 0.02)}px`; g.textAlign = "center"; g.textBaseline = base; g.lineJoin = "round";
  if (stroke) { g.lineWidth = stroke; g.strokeStyle = "#000"; g.strokeText(s, x, y); }
  g.fillStyle = fill; g.fillText(s, x, y); g.textBaseline = "alphabetic";
}
S.end = (g, t) => {
  g.save(); g.setTransform(1.5, 0, 0, 1.5, 0, 0);
  const EW = 720, EH = 1280, CX = 340, GOLD = "#ffd23f", GREEN = "#16d466";
  const bg = g.createRadialGradient(EW / 2, EH * 0.45, 40, EW / 2, EH * 0.45, EH * 0.8); bg.addColorStop(0, "#1a2140"); bg.addColorStop(1, "#05070f"); g.fillStyle = bg; g.fillRect(0, 0, EW, EH);
  let sd = 7; const r = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 140; i++) { const x = r() * EW, y = r() * EH, k = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + r()) + i)); g.fillStyle = `rgba(255,255,255,${0.55 * k})`; g.fillRect(x, y, r() < 0.15 ? 2 : 1, r() < 0.15 ? 2 : 1); }
  g.save(); g.translate(CX, 380); g.rotate(t * 0.15); for (let i = 0; i < 14; i++) { g.rotate(Math.PI / 7); g.fillStyle = i % 2 ? "rgba(255,210,63,.08)" : "rgba(0,0,0,0)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(-70, -1000); g.lineTo(70, -1000); g.closePath(); g.fill(); } g.restore();
  window.drawAvatar(g, CX, 380, 120, PLAYERS.you, KITS.utd, { ring: GOLD });
  const k = ez((t - 0.2) / 0.4); g.globalAlpha = k;
  endText(g, "YOUR STRIKER. YOUR STORY.", CX, 590, 44, "#fff", { stroke: 8 });
  endText(g, "KNOWITBALL", CX, 700, 110, "#fff", { stroke: 14, italic: true }); endText(g, "ROAD TO BALLON D'OR", CX, 770, 52, GOLD, { stroke: 10, italic: true });
  g.fillStyle = GREEN; g.beginPath(); g.roundRect(CX - 210, 820, 420, 74, 37); g.fill(); endText(g, "KNOWITBALL.CO.UK", CX, 859, 46, "#05080f", { stroke: 0, base: "middle" });
  if (t > 1.0) endText(g, "FOLLOW FOR THE NEXT ONE", CX, 980, 40, "#fff", { stroke: 8 });
  if (t > 1.0) endText(g, "LINK IN BIO", CX, 1045, 40, "#fff", { stroke: 8 });
  g.globalAlpha = 1; g.letterSpacing = "0px"; g.restore();
};

window.SCENES = S;
window.SC = { W, H, TOP, BOT, ez, ezio, pop, cl, lerp, seeded, stamp, COL, T, wrapLines, rr, panel, card, studio, stadium, vignette, crest, club, person, personSpec, portrait, colourOf, surname, header, reveal, count, ghost, rays, confetti, nameplate, rgba, tint, shadeC, glowOf, lum, loadImg, preload, FONT, trophy, teamOf };
