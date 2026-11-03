// Video factory scenes (Mikey, 3 Nov 2026). Each scene type in STORYBOARD.md
// draws into the card area at time t (seconds into the line) of a line lasting
// `dur` seconds. Everything is drawn: people from avatars.js, roundel crests
// in club colours (never real crests), trophies, cards.
const W = 1080, H = 1920, CY = 190, CH = 780;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ez = (x) => { x = cl(x); return 1 - Math.pow(1 - x, 3); };
const pop = (x) => { x = cl(x); const s = 1.70158 * 1.4; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
function seeded(n) { let s = n; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function shadeC(hex, k) { const n = parseInt((hex || "#888888").slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function lum(hex) { const n = parseInt((hex || "#888888").slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

function T(g, s, x, y, size, o = {}) {
  g.save(); g.font = `${o.weight || 400} ${size}px ${o.font || "Anton"}`; g.textAlign = o.align || "center"; g.textBaseline = o.base || "alphabetic";
  if (o.spacing) g.letterSpacing = o.spacing + "px";
  if (o.maxW) { const w = g.measureText(s).width; if (w > o.maxW) { size = size * o.maxW / w; g.font = `${o.weight || 400} ${size}px ${o.font || "Anton"}`; } }
  g.globalAlpha = o.alpha ?? 1;
  if (o.stroke) { g.lineJoin = "round"; g.lineWidth = o.stroke; g.strokeStyle = o.strokeColor || "#000"; g.strokeText(s, x, y); }
  if (o.shadow) { g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 10; g.shadowOffsetY = 4; }
  g.fillStyle = o.color || "#fff"; g.fillText(s, x, y); g.restore();
}
function wrapLines(g, s, maxW, size, font = "700 {s}px Oswald") {
  g.save(); g.font = font.replace("{s}", size); const words = String(s).split(" "); const lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); g.restore(); return lines;
}
function panel(g, x, y, w, h, fill = "#fff", r = 22) { g.save(); g.shadowColor = "rgba(0,0,0,.3)"; g.shadowBlur = 18; g.shadowOffsetY = 6; g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); g.restore(); }

// ── backgrounds ──
function stadium(g, opts = {}) {
  const top = opts.night ? ["#0f1838", "#2a3a6a"] : ["#8fc7ef", "#dcefff"];
  const gr = g.createLinearGradient(0, CY, 0, CY + CH); gr.addColorStop(0, top[0]); gr.addColorStop(0.45, top[1]); g.fillStyle = gr; g.fillRect(0, CY, W, CH);
  const sy = CY + CH * 0.18, sh = CH * 0.36; g.fillStyle = "#3c3f4a"; g.fillRect(0, sy, W, sh);
  const r = seeded(opts.seed || 11); const cols = opts.crowd || ["#d2122e", "#ffffff", "#f2c94c", "#2b2b2b", "#e7e7e7", "#1d4fa3"];
  for (let i = 0; i < 850; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.arc(r() * W, sy + 8 + r() * (sh - 16), 5 + r() * 3, 0, 7); g.fill(); }
  g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, sy + sh - 18, W, 18);
  const py = sy + sh; const pg = g.createLinearGradient(0, py, 0, CY + CH); pg.addColorStop(0, "#3f9b46"); pg.addColorStop(1, "#2e7d36"); g.fillStyle = pg; g.fillRect(0, py, W, CY + CH - py);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)"; g.fillRect(0, py + i * (CY + CH - py) / 6, W, (CY + CH - py) / 6); }
  if (opts.night) { g.fillStyle = "rgba(10,14,40,.35)"; g.fillRect(0, CY, W, CH); }
}
function dark(g, c1 = "#0f1a33", c2 = "#1d2b52") { const gr = g.createLinearGradient(0, CY, 0, CY + CH); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, CY, W, CH); }
function paper(g) { g.fillStyle = "#fbf8ee"; g.fillRect(0, CY, W, CH); }
function room(g, wall = "#3a3f52", floor = "#5b4636") { g.fillStyle = wall; g.fillRect(0, CY, W, CH); g.fillStyle = "rgba(255,255,255,.04)"; for (let x = 0; x < W; x += 90) g.fillRect(x, CY, 45, CH * 0.62); g.fillStyle = floor; g.fillRect(0, CY + CH * 0.62, W, CH * 0.38); }

// ── clubs, people, objects ──
const D = () => window.STORY;
// a suited person (kit "suit") has no kit club; an optional "club" gives their badge and colours
function teamOf(raw) { return raw.kit === "suit" ? (raw.club || "") : raw.kit; }
function club(id) { return (D().clubs || {})[id] || { name: id || "", short: (id || "?").slice(0, 3).toUpperCase(), c1: "#555555", c2: "#ffffff", pattern: "plain" }; }
function crest(g, id, x, y, r) {
  const c = club(id); g.save(); g.translate(x, y);
  g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(0, 0, r * 0.9, 0, 7); g.clip(); g.fillStyle = c.c1; g.fillRect(-r, -r, 2 * r, 2 * r);
  g.fillStyle = c.c2;
  if (c.pattern === "stripes") for (let i = -3; i <= 3; i += 2) g.fillRect(i * r * 0.26 - r * 0.13, -r, r * 0.26, 2 * r);
  else if (c.pattern === "halves") g.fillRect(0, -r, r, 2 * r);
  else if (c.pattern === "hoops") for (let i = -3; i <= 3; i += 2) g.fillRect(-r, i * r * 0.26 - r * 0.13, 2 * r, r * 0.26);
  else if (c.pattern === "centre") g.fillRect(-r * 0.22, -r, r * 0.44, 2 * r);
  else if (c.pattern === "sash") { g.beginPath(); g.moveTo(-r, -r * 0.6); g.lineTo(-r * 0.6, -r); g.lineTo(r, r * 0.6); g.lineTo(r * 0.6, r); g.closePath(); g.fill(); }
  else { g.beginPath(); g.arc(0, 0, r * 0.62, 0, 7); g.fill(); }
  g.restore();
  g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = r * 0.06; g.beginPath(); g.arc(0, 0, r * 0.9, 0, 7); g.stroke();
  const txt = c.short || "";
  T(g, txt, 0, r * 0.22, r * (txt.length > 3 ? 0.46 : 0.62), { color: "#fff", stroke: r * 0.12, strokeColor: "#111", maxW: r * 1.6 });
  g.restore();
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
const MOOD = { happy: { mouth: "grin" }, flat: { mouth: "flat" }, worried: { mouth: "flat", worried: true }, shocked: { mouth: "o", worried: true } };
function person(g, id, x, y, r, o = {}) {
  const p = personSpec(id); if (!p) return;
  window.drawAvatar(g, x, y, r, p.spec, p.kit, { ...(MOOD[o.mood] || { mouth: "smile" }), ...o });
}
function nameTag(g, s, x, y, col = "#d2122e", size = 34, a = 1) { if (!s) return; g.save(); g.globalAlpha = a; g.font = `${size}px Anton`; const w = Math.min(980, g.measureText(s).width + 36); panel(g, x - w / 2, y - size, w, size * 1.45, col, 12); T(g, s, x, y + 2, size, { maxW: w - 24 }); g.restore(); }
function trophy(g, kind, x, y, h) {
  const s = h / 200; g.save(); g.translate(x, y); g.scale(s, s);
  const gold = g.createLinearGradient(-60, 0, 60, 0); gold.addColorStop(0, "#9a7322"); gold.addColorStop(0.4, "#fff2c2"); gold.addColorStop(1, "#a07a28");
  const silver = g.createLinearGradient(-60, 0, 60, 0); silver.addColorStop(0, "#6b6f75"); silver.addColorStop(0.4, "#ffffff"); silver.addColorStop(1, "#7a7f86");
  if (kind === "ballon") { const b = g.createRadialGradient(-20, -40, 10, 0, -10, 90); b.addColorStop(0, "#fff6d0"); b.addColorStop(1, "#b8862a"); g.fillStyle = b; g.beginPath(); g.arc(0, -20, 72, 0, 7); g.fill(); g.strokeStyle = "rgba(120,80,20,.5)"; g.lineWidth = 3; for (const a of [-0.6, 0, 0.6]) { g.beginPath(); g.ellipse(0, -20, 72 * Math.abs(Math.cos(a)) + 6, 72, 0, 0, 7); g.stroke(); } g.fillStyle = "#3a2a14"; g.fillRect(-34, 50, 68, 40); }
  else if (kind === "boot") { g.fillStyle = gold; g.beginPath(); g.moveTo(-70, 20); g.quadraticCurveTo(-60, -60, -20, -70); g.lineTo(10, -70); g.lineTo(14, -10); g.quadraticCurveTo(70, 0, 80, 30); g.lineTo(80, 50); g.lineTo(-70, 50); g.closePath(); g.fill(); g.fillStyle = "#3a2a14"; g.fillRect(-60, 60, 120, 30); }
  else if (kind === "league") { const r = g.createRadialGradient(-20, -20, 10, 0, 0, 110); r.addColorStop(0, "#fff"); r.addColorStop(1, "#9aa3ad"); g.fillStyle = r; g.beginPath(); g.arc(0, -10, 90, 0, 7); g.fill(); g.strokeStyle = "#6f7780"; g.lineWidth = 8; g.stroke(); T(g, "★", 0, 14, 70, { color: "#e9c35a" }); }
  else if (kind === "bigears") { g.fillStyle = silver; g.beginPath(); g.moveTo(-46, -90); g.quadraticCurveTo(-46, 0, -10, 20); g.lineTo(-8, 60); g.lineTo(8, 60); g.lineTo(10, 20); g.quadraticCurveTo(46, 0, 46, -90); g.closePath(); g.fill(); g.lineWidth = 12; g.strokeStyle = silver; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 42, -80); g.bezierCurveTo(k * 120, -100, k * 125, -10, k * 18, 10); g.stroke(); } g.fillStyle = silver; g.fillRect(-36, 60, 72, 30); }
  else { const fill = kind === "worldcup" || kind === "cup" ? gold : silver; g.fillStyle = fill; g.beginPath(); g.moveTo(-50, -90); g.quadraticCurveTo(-50, 0, -10, 20); g.lineTo(-8, 60); g.lineTo(8, 60); g.lineTo(10, 20); g.quadraticCurveTo(50, 0, 50, -90); g.closePath(); g.fill(); g.lineWidth = 10; g.strokeStyle = fill; g.beginPath(); g.arc(-56, -55, 22, Math.PI * 0.5, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(56, -55, 22, -Math.PI * 0.5, Math.PI * 0.5); g.stroke(); g.fillStyle = "#5a3b1e"; g.fillRect(-36, 60, 72, 34); if (kind === "euro") { g.fillStyle = "#fff"; g.fillRect(-30, 66, 60, 6); } }
  g.restore();
}
function stamp(g, s, x, y, t, rot = -0.14, col = "#d2122e", size = 96) {
  const k = ez(t * 4); if (k <= 0) return; const sc = 1 + (1 - k) * 1.6;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc); g.globalAlpha = k; g.font = `${size}px Anton`;
  const w = Math.min(1000, g.measureText(s).width + 50); g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(-w / 2, -size * 0.78, w, size * 1.08);
  g.strokeStyle = col; g.lineWidth = 10; g.strokeRect(-w / 2, -size * 0.78, w, size * 1.08); T(g, s, 0, size * 0.18, size, { color: col, maxW: w - 30 }); g.restore();
}
const COL = { red: "#ff3b4e", yellow: "#ffd84a", white: "#ffffff" };
function heading(g, s, y = CY + 92, size = 70, color = "#fff") { if (s) T(g, String(s).toUpperCase(), W / 2, y, size, { color, stroke: 8, maxW: 1000 }); }
function reveal(i, n, dur, start = 0.15, end = 0.75) { return dur * (start + (end - start) * (n <= 1 ? 0 : i / (n - 1))); }
function count(n, k) { const m = String(n).match(/^([^0-9]*)([0-9][0-9,.]*)(.*)$/); if (!m) return String(n); const v = parseFloat(m[2].replace(/,/g, "")); const dec = (m[2].split(".")[1] || "").length; return m[1] + (v * k).toFixed(dec) + m[3]; }

// ════════ scene types ════════
const S = {};
S.title = (g, t, dur, s) => {
  const p = personSpec(s.person); stadium(g, { seed: 3, crowd: p && teamOf(p.raw) ? [club(teamOf(p.raw)).c1, club(teamOf(p.raw)).c2, "#2b2b2b", "#ffffff"] : undefined });
  if (s.person) person(g, s.person, 540, CY + CH * 0.66 + (1 - ez(t * 2)) * 60, 250, { noDisc: true, mouth: "grin" });
  T(g, String(s.heading || "").toUpperCase(), 40, CY + 110, 100, { align: "left", stroke: 10, maxW: 820 });
  if (s.sub) T(g, s.sub, 44, CY + 162, 40, { align: "left", stroke: 7, font: "Oswald", weight: 700, maxW: 800 });
  if (p && teamOf(p.raw)) crest(g, teamOf(p.raw), 960, CY + 110, 78);
  if (s.pill && t > 0.5) { const q = pop((t - 0.5) * 2.5); g.save(); g.translate(540, CY + CH * 0.4); g.scale(q, q); g.font = "700 46px Oswald"; const w = Math.min(1000, g.measureText(s.pill).width + 60); panel(g, -w / 2, -42, w, 76, "#101010", 38); g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.roundRect(-w / 2, -42, w, 76, 38); g.stroke(); T(g, s.pill, 0, 14, 46, { font: "Oswald", weight: 700, maxW: w - 40 }); g.restore(); }
};
S.person = (g, t, dur, s) => {
  const p = personSpec(s.person); stadium(g, { seed: 7, night: s.mood === "worried", crowd: p && teamOf(p.raw) ? [club(teamOf(p.raw)).c1, club(teamOf(p.raw)).c2, "#2b2b2b"] : undefined });
  person(g, s.person, 540, CY + CH * 0.62 + (1 - ez(t * 2.5)) * 50, 260, { noDisc: true, mood: s.mood || "happy" });
  if (s.label) nameTag(g, s.label, 540, CY + 110, "#d2122e", 52, ez(t * 3));
};
S.versus = (g, t, dur, s) => {
  const L = s.left || {}, R = s.right || {}; const lp = personSpec(L.person), rp = personSpec(R.person);
  const lc = lp && teamOf(lp.raw) ? club(teamOf(lp.raw)).c1 : "#1d4fa3", rc = rp && teamOf(rp.raw) ? club(teamOf(rp.raw)).c1 : "#b3122e";
  g.fillStyle = shadeC(lc, 0.55); g.fillRect(0, CY, W / 2, CH); g.fillStyle = shadeC(rc, 0.55); g.fillRect(W / 2, CY, W / 2, CH);
  g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.moveTo(W / 2 - 30, CY); g.lineTo(W / 2 + 30, CY); g.lineTo(W / 2 - 30, CY + CH); g.lineTo(W / 2 - 90, CY + CH); g.fill();
  heading(g, s.title, CY + 80, 58);
  const a = ez(t * 3), b = ez((t - 0.25) * 3);
  if (L.person) person(g, L.person, 270 - (1 - a) * 200, CY + 330, 165, { mood: "happy", bgTop: shadeC(lc, 0.9), bgBot: shadeC(lc, 0.5) });
  if (R.person) person(g, R.person, 810 + (1 - b) * 200, CY + 330, 165, { mood: "happy", bgTop: shadeC(rc, 0.9), bgBot: shadeC(rc, 0.5) });
  T(g, "VS", W / 2, CY + 360, 110, { color: "#ffd84a", stroke: 10, alpha: ez((t - 0.3) * 3) });
  const v = ez((t - 0.5) * 2.5);
  for (const [side, x] of [[L, 270], [R, 810]]) { nameTag(g, String(side.label || "").toUpperCase(), x, CY + 560, "#111", 38, v); if (side.value != null) T(g, String(side.value), x, CY + 720, 110, { color: "#fff", stroke: 10, alpha: v, maxW: 480 }); }
};
S.stats = (g, t, dur, s) => {
  dark(g); heading(g, s.title, CY + 92, 64);
  const items = (s.items || []).slice(0, 4); const hasP = !!s.person; const x0 = hasP ? 380 : 0, wA = W - x0;
  if (hasP) person(g, s.person, 190, CY + 470, 170, { mood: "happy", bgTop: "#2b3a66", bgBot: "#141d38" });
  items.forEach((it, i) => {
    const at = reveal(i, items.length, dur, 0.1, 0.55); const k = cl((t - at) / 0.8); if (k <= 0) return;
    const cols = items.length > 2 && !hasP ? 2 : 1; const rows = Math.ceil(items.length / cols);
    const cx = x0 + wA * ((i % cols) + 0.5) / cols, cy = CY + 230 + (Math.floor(i / cols) + 0.5) * (CH - 260) / rows;
    T(g, count(it.n, ez(k)), cx, cy + 20, items.length > 2 ? 130 : 170, { color: i % 2 ? "#ffd84a" : "#ffffff", maxW: wA / cols - 30 });
    T(g, String(it.l || "").toUpperCase(), cx, cy + 75, 40, { color: "#cfd8ef", font: "Oswald", weight: 700, maxW: wA / cols - 30, alpha: ez(k * 2) });
  });
};
S.score = (g, t, dur, s) => {
  paper(g);
  T(g, (s.comp || "").toUpperCase(), 540, CY + 70, 34, { color: "#1b6fa8", font: "Oswald", weight: 700, maxW: 1000 });
  if (s.date) T(g, s.date, 540, CY + 115, 30, { color: "#444", font: "Oswald", weight: 700, maxW: 1000 });
  crest(g, s.home, 200, CY + 290, 120); crest(g, s.away, 880, CY + 290, 120);
  T(g, club(s.home).name.toUpperCase(), 200, CY + 460, 40, { color: "#111", maxW: 360 }); T(g, club(s.away).name.toUpperCase(), 880, CY + 460, 40, { color: "#111", maxW: 360 });
  panel(g, 380, CY + 200, 320, 180, "#ece8da", 16);
  const k = pop((t - 0.3) * 2.5); g.save(); g.translate(540, CY + 330); g.scale(k, k); T(g, `${s.hs ?? ""}-${s.as ?? ""}`, 0, 0, 130, { color: "#111" }); g.restore();
  if (s.note) { const lines = wrapLines(g, s.note, 920, 38); lines.slice(0, 4).forEach((l, i) => T(g, l, 540, CY + 560 + i * 50, 38, { color: "#222", font: "Oswald", weight: 700, alpha: ez((t - 0.6) * 3) })); }
};
S.trophies = (g, t, dur, s) => {
  dark(g, "#14100a", "#2a2010"); heading(g, s.title, CY + 92, 60, "#ffd84a");
  const items = (s.items || []).slice(0, 6); const hasP = !!s.person;
  if (hasP) person(g, s.person, 540, CY + CH * 0.86, 150, { noDisc: true, mood: "happy" });
  const n = items.length, gap = Math.min(300, 960 / Math.max(1, n));
  items.forEach((it, i) => { const at = reveal(i, n, dur, 0.1, 0.6); const k = pop((t - at) * 3); if (k <= 0) return; const x = 540 + (i - (n - 1) / 2) * gap; g.save(); g.translate(x, CY + 330); g.scale(k, k); trophy(g, it.kind || "cup", 0, 0, Math.min(230, gap * 0.9)); g.restore(); T(g, String(it.label || "").toUpperCase(), x, CY + 500, 32, { color: "#fff", stroke: 6, alpha: cl(k), maxW: gap - 10, font: "Oswald", weight: 700 }); });
};
S.list = (g, t, dur, s) => {
  dark(g, "#0e1324", "#1a2240"); heading(g, s.title, CY + 82, 56);
  const rows = (s.rows || []).slice(0, 8); const n = rows.length; const rh = Math.min(84, (CH - 140) / Math.max(1, n));
  rows.forEach((r, i) => {
    const at = reveal(i, n, dur, 0.08, 0.7); const k = ez((t - at) * 4); if (k <= 0) return;
    const y = CY + 125 + i * rh, x = 50 + (1 - k) * 80; g.save(); g.globalAlpha = k;
    panel(g, x, y, 980, rh - 10, r.hl ? "#ffd84a" : "#ffffff", 14);
    const fg = "#111"; T(g, String(r.pos ?? i + 1), x + 46, y + rh * 0.62, rh * 0.5, { color: r.hl ? "#111" : "#d2122e" });
    if (r.club) crest(g, r.club, x + 120, y + (rh - 10) / 2, (rh - 10) * 0.38);
    T(g, String(r.name || ""), x + (r.club ? 170 : 100), y + rh * 0.62, rh * 0.42, { align: "left", color: fg, font: "Oswald", weight: 700, maxW: 600 });
    if (r.value != null) T(g, String(r.value), x + 950, y + rh * 0.62, rh * 0.44, { align: "right", color: fg, maxW: 260 });
    g.restore();
  });
};
S.text = (g, t, dur, s) => {
  room(g, "#232a3c", "#232a3c"); const a = ez(t * 3);
  g.save(); g.globalAlpha = a; panel(g, 60, CY + 60 + (1 - a) * 30, 960, CH - 120, "#ffffff", 18);
  g.fillStyle = "#d2122e"; g.fillRect(60, CY + 60 + (1 - a) * 30, 14, CH - 120);
  T(g, String(s.heading || "").toUpperCase(), 110, CY + 150, 56, { align: "left", color: "#111", maxW: 870 });
  wrapLines(g, s.body || "", 860, 42, "400 {s}px Oswald").slice(0, 9).forEach((l, i) => T(g, l, 110, CY + 230 + i * 58, 42, { align: "left", color: "#222", font: "Oswald", weight: 400, alpha: ez((t - 0.2 - i * 0.12) * 3) }));
  g.restore();
};
S.quote = (g, t, dur, s) => {
  room(g, "#7b2a2a", "#5b4636");
  person(g, s.person, 330, CY + 560, 220, { noDisc: true, talk: 0.5 + 0.5 * Math.sin(t * 18) });
  const b = ez((t - 0.25) * 3); if (b <= 0) return;
  const lines = wrapLines(g, `"${s.text}"`, 470, 42); const h = lines.length * 54 + 44; const x = 570, y = CY + 60;
  g.save(); g.globalAlpha = b; panel(g, x - 20, y, 520, h, "#fff", 30); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(x + 10, y + h - 2); g.lineTo(x - 40, y + h + 60); g.lineTo(x + 60, y + h - 2); g.fill();
  lines.forEach((l, i) => T(g, l, x + 240, y + 64 + i * 54, 42, { color: "#111", font: "Oswald", weight: 700 })); g.restore();
};
S.timeline = (g, t, dur, s) => {
  dark(g, "#101828", "#1c2a44"); heading(g, s.title, CY + 92, 56);
  const items = (s.items || []).slice(0, 6); const n = items.length; const y = CY + 400;
  g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 6; g.beginPath(); g.moveTo(80, y); g.lineTo(80 + 920 * ez(t * 1.5), y); g.stroke();
  items.forEach((it, i) => { const at = reveal(i, n, dur, 0.1, 0.7); const k = pop((t - at) * 3); if (k <= 0) return; const x = 120 + i * (840 / Math.max(1, n - 1)); g.fillStyle = "#ffd84a"; g.beginPath(); g.arc(x, y, 16 * cl(k), 0, 7); g.fill(); const up = i % 2 === 0; T(g, String(it.year), x, up ? y - 60 : y + 90, 52, { color: "#ffd84a", alpha: cl(k) }); wrapLines(g, it.label || "", 200, 30).slice(0, 3).forEach((l, j) => T(g, l, x, (up ? y - 200 : y + 140) + j * 36, 30, { color: "#fff", font: "Oswald", weight: 700, alpha: cl(k) })); });
};
S.podium = (g, t, dur, s) => {
  dark(g, "#1a1408", "#3a2c10"); heading(g, s.title || (s.year ? `BALLON D'OR ${s.year}` : ""), CY + 82, 60, "#ffd84a");
  const places = (s.places || []).slice(0, 3); const order = [1, 0, 2]; const xs = [270, 540, 810], hs = [170, 250, 120], cols = ["#c0c4cc", "#e9c35a", "#c98a4a"];
  order.forEach((pi, slot) => {
    const pl = places[pi]; if (!pl) return; const at = dur * (0.15 + 0.25 * (2 - pi)); const k = ez((t - at) * 2.5); if (k <= 0) return;
    const x = xs[slot], h = hs[pi] * k, base = CY + CH - 40; g.fillStyle = cols[pi]; g.fillRect(x - 120, base - h, 240, h); T(g, String(pi + 1), x, base - h + 80, 80, { color: "#111", alpha: k });
    if (pl.person) person(g, pl.person, x, base - h - 120, 110, { mood: pi === 0 ? "happy" : "flat", bgTop: "#3a2c08", bgBot: "#16120a", ring: cols[pi] });
    else if (pl.club) crest(g, pl.club, x, base - h - 120, 90);
    T(g, String(pl.name || personSpec(pl.person)?.raw.name || "").toUpperCase(), x, base - h - 250, 34, { color: "#fff", stroke: 6, maxW: 250 });
  });
};
S.stamp = (g, t, dur, s) => {
  stadium(g, { seed: 19, night: true }); g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, CY, W, CH);
  if (s.person) person(g, s.person, 540, CY + 560, 250, { noDisc: true, mood: "worried" });
  stamp(g, String(s.text || "").toUpperCase(), 540, CY + 260, t - 0.3, -0.1, COL[s.color] || COL.red, 120);
};
S.whatif = (g, t, dur, s) => {
  g.fillStyle = "#3b3f48"; g.fillRect(0, CY, W / 2, CH); const gr = g.createLinearGradient(W / 2, CY, W, CY + CH); gr.addColorStop(0, "#4b1d78"); gr.addColorStop(1, "#1d2b78"); g.fillStyle = gr; g.fillRect(W / 2, CY, W / 2, CH);
  heading(g, s.title, CY + 80, 54);
  T(g, "REAL WORLD", 270, CY + 180, 44, { color: "#cfd3da", font: "Oswald", weight: 700 }); T(g, "ALTERNATE WORLD", 810, CY + 180, 44, { color: "#e6d2ff", font: "Oswald", weight: 700 });
  const R = s.real || {}, A = s.alt || {}; const a = ez((t - 0.2) * 3), b = ez((t - dur * 0.45) * 3);
  for (const [o, x, k] of [[R, 270, a], [A, 810, b]]) { wrapLines(g, o.label || "", 440, 40).slice(0, 4).forEach((l, i) => T(g, l, x, CY + 280 + i * 50, 40, { color: "#fff", font: "Oswald", weight: 700, alpha: k })); if (o.value != null) T(g, String(o.value), x, CY + 620, 120, { color: x > 540 ? "#ffd84a" : "#fff", stroke: 8, alpha: k, maxW: 480 }); }
};
S.cta = (g, t, dur, s) => {
  dark(g, "#0b0b0b", "#1a1a1a");
  const k = pop(t * 2.2); g.save(); g.translate(540, CY + 300); g.scale(k, k); T(g, "FOLLOW FOR MORE", 0, 0, 96, { color: "#fff", maxW: 980 }); g.restore();
  const a = ez((t - 0.5) * 3); panel(g, 90, CY + 400, 900, 230, "#d2122e", 26);
  g.save(); g.globalAlpha = a; T(g, "PLAY ROAD TO BALLON D'OR", 540, CY + 495, 60, { maxW: 840 }); T(g, "knowitball.co.uk", 540, CY + 580, 54, { font: "Oswald", weight: 700, color: "#fff" }); g.restore();
};
S.end = (g, t) => {
  g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, W, H);
  const k = pop(t * 2); g.save(); g.translate(540, 860); g.scale(k, k); T(g, "KNOWITBALL", 0, 0, 150, { color: "#fff" }); g.restore();
  T(g, "knowitball.co.uk", 540, 960, 50, { font: "Oswald", weight: 700, color: "#d2122e", alpha: ez(t * 2 - 0.6) });
  T(g, "Follow for more", 540, 1040, 40, { font: "Oswald", weight: 700, color: "#ffffff", alpha: ez(t * 2 - 1) });
};

window.SCENES = S; window.SC = { W, H, CY, CH, ez, pop, cl, stamp, COL };
