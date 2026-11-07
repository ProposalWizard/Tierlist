// "Analysed like chess" layout, v2 (Mikey, 7 Nov 2026): a FOOTBALL video first,
// with the chess analysis laid on top. A real pitch (metres, correct markings),
// every player a drawn icon in his kit with his name, a camera that moves to
// the action, then the chess layer: typed move card, grade badges, the
// evaluation bar. Players, kits and shapes come from the story JSON
// (`players`, `shapes`); see STORYBOARD.md "Layout chess".
(() => {
const { W, ez, pop, cl } = window.SC;
const X0 = 64, X1 = 950;                        // safe area (FACT-KIB-004)
const PX = 116, PY = 492, PW = X1 - PX, PH = 820; // pitch window
const EVX = 64, EVW = 38;
const L = 105, WD = 68;                          // pitch in metres

const BADGES = {
  brilliant: { sym: "!!", label: "BRILLIANT", col: "#1baca6" },
  great: { sym: "!", label: "GREAT MOVE", col: "#5c8bb0" },
  best: { sym: "★", label: "BEST MOVE", col: "#81b64c" },
  excellent: { sym: "👍", label: "EXCELLENT", col: "#81b64c" },
  book: { sym: "📖", label: "BOOK MOVE", col: "#a88865" },
  inaccuracy: { sym: "?!", label: "INACCURACY", col: "#f7c631" },
  mistake: { sym: "?", label: "MISTAKE", col: "#e6912c" },
  blunder: { sym: "??", label: "BLUNDER", col: "#ca3431" },
  checkmate: { sym: "#", label: "CHECKMATE", col: "#81b64c" },
  nogoal: { sym: "✕", label: "NO GOAL", col: "#8a8f98" },
};
const ST = () => window.STORY;
const club = (id) => (ST().clubs || {})[id] || { name: id, short: "?", c1: "#666", c2: "#fff" };
function T(g, s, x, y, size, o = {}) {
  g.save(); g.font = `${o.weight || 400} ${size}px ${o.font || "Anton"}`; g.textAlign = o.align || "left"; g.textBaseline = "alphabetic";
  if (o.maxW) { const w = g.measureText(s).width; if (w > o.maxW) { size *= o.maxW / w; g.font = `${o.weight || 400} ${size}px ${o.font || "Anton"}`; } }
  g.globalAlpha = o.alpha ?? 1;
  if (o.stroke) { g.lineJoin = "round"; g.lineWidth = o.stroke; g.strokeStyle = o.strokeColor || "#000"; g.strokeText(s, x, y); }
  g.fillStyle = o.color || "#fff"; g.fillText(s, x, y); g.restore();
}
function rr(g, x, y, w, h, r, fill) { g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
const lerp = (a, b, k) => a + (b - a) * k;

// ── people ──
function kitOf(clubId, gk) {
  const c = club(clubId);
  if (gk) return { shirt: c.gk || "#e8e04a", trim: "#1a1a1a", collar: "#1a1a1a" };
  return { shirt: c.c1, trim: c.c2, collar: c.collar || c.c2, pattern: c.pattern === "plain" ? undefined : c.pattern };
}
function avatar(g, id, x, y, r, opts = {}) {
  const p = (ST().players || {})[id] || (ST().people || {})[id]; if (!p) return;
  const spec = { name: p.name, skin: p.skin || "light", hair: p.hair || ["crop", "#2a1d15"], beard: p.beard || "none", beardCol: p.beardCol };
  if (p.kit === "suit") spec.suit = { jacket: "#1f232c", tie: club(p.club).c1 };
  const c = club(p.club);
  window.drawAvatar(g, x, y, r, spec, kitOf(p.club, p.gk), { mouth: opts.mouth || "smile", bgTop: opts.bgTop || c.c1, bgBot: opts.bgBot || shade(c.c1, 0.45), ring: opts.ring || "#ffffff", ...opts });
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
const nameOf = (id) => (((ST().players || {})[id] || (ST().people || {})[id] || {}).short || ((ST().players || {})[id] || {}).name || id).toUpperCase();

// ── camera ──
function camOf(sc) { const c = sc.cam || {}; return { cx: c.cx ?? WD / 2, cy: c.cy ?? L / 2, len: c.len ?? L + 6 }; }
function camAt(lt, sc, prev) {
  const a = prev ? camOf(prev) : camOf(sc), b = camOf(sc); const k = ez(lt / 0.9);
  let cx = lerp(a.cx, b.cx, k), cy = lerp(a.cy, b.cy, k), len = lerp(a.len, b.len, k);
  if (sc.cam && sc.cam.push) len *= 1 - 0.08 * ez(lt / 4); // slow push-in
  const s = PH / len; const vw = PW / s, vh = PH / s;
  // never show empty stands past the goal lines or touchlines when zoomed in
  cy = Math.min(Math.max(cy, -3 + vh / 2), L + 3 - vh / 2); if (vh > L + 6) cy = L / 2;
  cx = vw >= WD + 6 ? WD / 2 : Math.min(Math.max(cx, -3 + vw / 2), WD + 3 - vw / 2);
  return { s, ox: PX + PW / 2 - cx * s, oy: PY + PH / 2 - cy * s };
}
const P = (cam, x, y) => [cam.ox + x * cam.s, cam.oy + y * cam.s];

function stands(g, gt) {
  g.fillStyle = "#14161b"; g.fillRect(PX, PY, PW, PH);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cols = ["#a50044", "#004d98", "#2b2b2b", "#e6e6e6", "#3b3f48", "#edbb00"];
  for (let i = 0; i < 1400; i++) { const x = PX + r() * PW, y = PY + r() * PH; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.globalAlpha = 0.35 + 0.2 * Math.sin(gt * 3 + i); g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
function pitch(g, cam) {
  const [x0, y0] = P(cam, 0, 0), [x1, y1] = P(cam, WD, L); const m = 3 * cam.s;
  g.fillStyle = "#2f7a35"; g.fillRect(x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m);
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? "#3a8f3f" : "#348537"; const a = P(cam, 0, i * L / 14); g.fillRect(x0, a[1], x1 - x0, (L / 14) * cam.s + 1); }
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = Math.max(2, 0.14 * cam.s);
  const rect = (x, y, w, h) => { const [a, b] = P(cam, x, y); g.strokeRect(a, b, w * cam.s, h * cam.s); };
  rect(0, 0, WD, L);
  g.beginPath(); g.moveTo(...P(cam, 0, L / 2)); g.lineTo(...P(cam, WD, L / 2)); g.stroke();
  g.beginPath(); g.arc(...P(cam, WD / 2, L / 2), 9.15 * cam.s, 0, 7); g.stroke();
  for (const top of [true, false]) {
    const y = top ? 0 : L, d = top ? 1 : -1;
    rect(WD / 2 - 20.16, top ? 0 : L - 16.5, 40.32, 16.5); rect(WD / 2 - 9.16, top ? 0 : L - 5.5, 18.32, 5.5);
    g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(...P(cam, WD / 2, y + d * 11), 0.35 * cam.s, 0, 7); g.fill();
    g.beginPath(); const c = P(cam, WD / 2, y + d * 11); const a0 = Math.acos(5.5 / 9.15);
    if (top) g.arc(c[0], c[1], 9.15 * cam.s, a0, Math.PI - a0); else g.arc(c[0], c[1], 9.15 * cam.s, Math.PI + a0, 2 * Math.PI - a0); g.stroke();
    // goal and net
    const [gx, gy] = P(cam, WD / 2 - 3.66, top ? -2.2 : L); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(gx, gy, 7.32 * cam.s, 2.2 * cam.s);
    g.save(); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(gx + i * 7.32 * cam.s / 8, gy); g.lineTo(gx + i * 7.32 * cam.s / 8, gy + 2.2 * cam.s); g.stroke(); } g.restore();
    g.strokeStyle = "#fff"; g.lineWidth = Math.max(3, 0.2 * cam.s); g.strokeRect(gx, gy, 7.32 * cam.s, 2.2 * cam.s); g.lineWidth = Math.max(2, 0.14 * cam.s); g.strokeStyle = "rgba(255,255,255,.85)";
  }
}

// ── players: shapes from the story, gliding between scenes ──
function shapeOf(sc) { const out = {}; for (const k of [].concat(sc.shape || [])) Object.assign(out, (ST().shapes || {})[k] || {}); return out; }
function posAt(lt, sc, prev, gt) {
  const cur = shapeOf(sc), old = prev ? shapeOf(prev) : cur; const k = ez(lt / 1.0); const out = {};
  for (const id in cur) { const a = old[id] || cur[id]; out[id] = { x: lerp(a[0], cur[id][0], k), y: lerp(a[1], cur[id][1], k), a: old[id] ? 1 : ez(lt / 0.6) }; }
  for (const id in old) if (!cur[id]) out[id] = { x: old[id][0], y: old[id][1], a: 1 - ez(lt / 0.5) };
  for (const m of sc.runs || []) { const p = out[m.id]; if (!p) continue; const s = ez((lt - (m.at || 0.5)) / (m.dur || 1.4)); p.x = lerp(p.x, m.to[0], s); p.y = lerp(p.y, m.to[1], s); }
  if (sc.red && out[sc.red]) { const s = ez((lt - (sc.redAt || 1.6)) / 1.6); out[sc.red].x = lerp(out[sc.red].x, -6, s); out[sc.red].a *= 1 - 0.5 * s; }
  if (sc.sway) for (const id in out) { if ((ST().players[id] || {}).club === sc.sway) { out[id].x += Math.sin(gt * 1.4 + id.length) * 0.9; } }
  return out;
}
function drawPlayers(g, cam, pos, sc, lt, gt) {
  const r = Math.max(19, Math.min(34, cam.s * 2.5)); const focus = new Set([].concat(sc.focus || []));
  const ids = Object.keys(pos).sort((a, b) => pos[a].y - pos[b].y);
  for (const id of ids) {
    const p = pos[id]; if (p.a <= 0.01) continue; const [x, y] = P(cam, p.x, p.y);
    const dim = focus.size && !focus.has(id) ? 0.55 : 1; const hl = focus.has(id);
    g.save(); g.globalAlpha = p.a * dim;
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x + 3, y + r * 0.95, r * 0.9, r * 0.3, 0, 0, 7); g.fill();
    if (hl) { g.save(); g.globalAlpha = p.a * (0.5 + 0.3 * Math.sin(gt * 7)); g.fillStyle = "#ffe14a"; g.beginPath(); g.arc(x, y, r * 1.35, 0, 7); g.fill(); g.restore(); }
    const pl = (ST().players || {})[id] || {}; const c = club(pl.club);
    avatar(g, id, x, y, r * (hl ? 1.15 : 1), { ring: c.c1 === "#a50044" ? "#edbb00" : "#ffffff" });
    const nm = nameOf(id); g.font = `700 ${Math.round(r * 0.6)}px Oswald`; const w = g.measureText(nm).width + 14;
    rr(g, x - w / 2, y + r * (hl ? 1.2 : 1.05), w, r * 0.78, 6, hl ? "#ffe14a" : "rgba(10,10,12,.82)");
    g.fillStyle = hl ? "#111" : "#fff"; g.textAlign = "center"; g.fillText(nm, x, y + r * (hl ? 1.2 : 1.05) + r * 0.6);
    g.restore();
  }
  return r;
}
function ballAt(lt, sc, pos, gt) {
  if (sc.pass) { const ids = sc.pass.filter((i) => pos[i]); if (ids.length < 2) return null; const u = (gt * (sc.passSpeed || 1.1)) % ids.length; const i = Math.floor(u), f = ez(u - i); const a = pos[ids[i]], b = pos[ids[(i + 1) % ids.length]]; return [lerp(a.x, b.x, f), lerp(a.y, b.y, f) + 1.6]; }
  const b = sc.ball; if (!b) return null; const pts = b.path; const s = cl((lt - (b.at || 0.6)) / (b.dur || 1.2)); const seg = s * (pts.length - 1); const i = Math.min(pts.length - 2, Math.floor(seg)); const f = seg - i;
  return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
}
function drawBall(g, cam, b) { if (!b) return; const [x, y] = P(cam, b[0], b[1]); const r = Math.max(8, cam.s * 0.7); g.save(); g.fillStyle = "#fff"; g.strokeStyle = "#111"; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.fillStyle = "#111"; g.beginPath(); g.arc(x, y, r * 0.38, 0, 7); g.fill(); g.restore(); }
function arrow(g, cam, a, b, k, col = "rgba(255,200,40,.95)") {
  if (k <= 0) return; const [x1, y1] = P(cam, a[0], a[1]), [x2, y2] = P(cam, b[0], b[1]); const ex = lerp(x1, x2, k), ey = lerp(y1, y2, k); const an = Math.atan2(ey - y1, ex - x1);
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 7; g.setLineDash([16, 10]); g.lineCap = "round"; g.beginPath(); g.moveTo(x1, y1); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
  g.translate(ex, ey); g.rotate(an); g.beginPath(); g.moveTo(14, 0); g.lineTo(-12, -14); g.lineTo(-12, 14); g.fill(); g.restore();
}

// ── big moments ──
function flash(g, text, k, col = "#ffffff", sub) {
  if (k <= 0 || k >= 1) return; const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1; const sc = 0.7 + 0.3 * pop(k * 4);
  g.save(); g.globalAlpha = a; g.translate(PX + PW / 2, PY + PH * 0.42); g.rotate(-0.06); g.scale(sc, sc);
  T(g, text, 0, 0, 170, { align: "center", color: col, stroke: 18, strokeColor: "#111", maxW: PW - 40 });
  if (sub) T(g, sub, 0, 70, 46, { align: "center", color: "#fff", stroke: 8, font: "Oswald", weight: 700, maxW: PW - 60 });
  g.restore();
}
function redCard(g, lt, sc) {
  const k = pop((lt - 0.9) * 2.2); if (k <= 0) return; const out = ez((lt - 3.4) / 0.5);
  g.save(); g.globalAlpha = 1 - out; g.translate(PX + PW - 150, PY + 190); g.rotate(0.14); g.scale(k, k);
  g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 24; rr(g, -70, -100, 140, 200, 14, "#e0202e"); g.shadowBlur = 0; g.restore();
  if (lt > 1.6) { const a = ez((lt - 1.6) * 3); g.save(); g.globalAlpha = a; rr(g, PX + 24, PY + 24, 230, 64, 14, "#e0202e"); T(g, "10 MEN", PX + 139, PY + 74, 48, { align: "center" }); g.restore(); }
}
function banks(g, cam, pos, lt) {
  const k = ez((lt - 1.2) / 0.8); if (k <= 0) return;
  for (const [ids, lab] of [[["maicon", "lucio", "samuel", "zanetti"], "BANK 1"], [["etoo", "sneijder", "cambiasso", "chivu"], "BANK 2"]]) {
    const ps = ids.map((i) => pos[i]).filter(Boolean); if (ps.length < 2) continue;
    const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y); const y = ys.reduce((a, b) => a + b) / ys.length;
    const [ax, ay] = P(cam, Math.min(...xs) - 3, y - 2.6), [bx, by] = P(cam, Math.max(...xs) + 3, y + 2.6);
    g.save(); g.globalAlpha = 0.32 * k; rr(g, ax, ay, (bx - ax) * k, by - ay, 12, "#ffd84a"); g.restore();
  }
}
function possession(g, lt, pct) {
  const k = ez((lt - 0.8) / 1.2); if (k <= 0) return; const x = PX + 30, y = PY + 26, w = PW - 60;
  g.save(); g.globalAlpha = ez((lt - 0.6) * 3); rr(g, x, y, w, 120, 18, "rgba(10,10,12,.88)");
  T(g, "POSSESSION", x + w / 2, y + 40, 30, { align: "center", font: "Oswald", weight: 700, color: "#cfd3da" });
  const bw = w - 220, bx = x + 110; rr(g, bx, y + 62, bw, 34, 17, "#1f4fb3"); rr(g, bx, y + 62, bw * (pct / 100) * k, 34, 17, "#a50044");
  T(g, `${Math.round(pct * k)}%`, x + 20, y + 92, 40, { color: "#ff6b9a" }); T(g, `${Math.round(100 - pct * k)}%`, x + w - 20, y + 92, 40, { align: "right", color: "#7fa8ff" });
  g.restore();
}
function coachMap(g, lt) {
  const k = ez((lt - 0.3) / 0.6); if (k <= 0) return; const x = PX + 24, y = PY + 24, w = 430, h = 260;
  g.save(); g.globalAlpha = k; rr(g, x, y, w, h, 18, "rgba(12,16,26,.92)");
  // a simple drawn map: sea, land, two cities
  rr(g, x + 14, y + 14, w - 28, h - 70, 12, "#1d3550"); g.fillStyle = "#3b4a3c"; g.beginPath(); g.moveTo(x + 14, y + 60); g.quadraticCurveTo(x + 150, y + 30, x + w - 14, y + 40); g.lineTo(x + w - 14, y + 120); g.quadraticCurveTo(x + 260, y + 110, x + 200, y + 190); g.lineTo(x + 14, y + 190); g.closePath(); g.fill();
  const A = [x + 90, y + 170], B = [x + 300, y + 95]; g.strokeStyle = "#ffd84a"; g.lineWidth = 5; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(...A); g.quadraticCurveTo(x + 200, y + 150, ...B); g.stroke(); g.setLineDash([]);
  for (const [p, n] of [[A, "BARCELONA"], [B, "MILAN"]]) { g.fillStyle = "#fff"; g.beginPath(); g.arc(p[0], p[1], 8, 0, 7); g.fill(); T(g, n, p[0] + 12, p[1] - 10, 22, { font: "Oswald", weight: 700 }); }
  const f = cl((lt - 0.6) / 3); const bx = (1 - f) * (1 - f) * A[0] + 2 * (1 - f) * f * (x + 200) + f * f * B[0], by = (1 - f) * (1 - f) * A[1] + 2 * (1 - f) * f * (y + 150) + f * f * B[1];
  T(g, "🚌", bx - 18, by + 10, 34, { font: "'Noto Color Emoji'" });
  for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(150,150,150,${0.55 - i * 0.06})`; g.beginPath(); g.arc(x + 70 + i * 34, y + 34 + Math.sin(lt * 2 + i) * 4, 13 + i * 3, 0, 7); g.fill(); }
  T(g, "🌋", x + 26, y + 62, 40, { font: "'Noto Color Emoji'" });
  T(g, "ABOUT 15 HOURS BY COACH", x + w / 2, y + h - 22, 34, { align: "center", color: "#ffd84a", maxW: w - 30 });
  g.restore();
}
function sprinklers(g, cam, lt, gt) {
  if (lt < 2.2) return; const k = cl((lt - 2.2) / 0.6);
  for (const [sx, sy] of [[8, 60], [60, 60], [8, 92], [60, 92], [34, 76]]) { const [x, y] = P(cam, sx, sy);
    for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2 + gt * 1.3; const d = ((gt * 160 + i * 41) % 150) * k; g.fillStyle = `rgba(200,230,255,${0.8 * (1 - d / 160)})`; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 4.5, 0, 7); g.fill(); } }
}
function mourinhoRun(g, cam, lt, gt) {
  const k = ez((lt - 0.4) / 2.4); if (lt < 0.4) return; const x = lerp(PX + 60, PX + PW - 220, k), y = PY + PH * 0.62 + Math.sin(gt * 14) * 8;
  T(g, "☝️", x + 92, y - 70, 96, { font: "'Noto Color Emoji'" });
  avatar(g, "mourinho", x, y, 120, { mouth: "grin" });
  T(g, "MOURINHO", x, y + 175, 44, { align: "center", stroke: 8 });
}
function bigEars(g, lt) {
  const k = pop((lt - 0.8) * 2); if (k <= 0) return; g.save(); g.fillStyle = `rgba(0,0,0,${0.55 * cl(k)})`; g.fillRect(PX, PY, PW, PH);
  g.translate(PX + PW / 2, PY + PH * 0.5); g.scale(k * 2, k * 2);
  const s = g.createLinearGradient(-60, 0, 60, 0); s.addColorStop(0, "#6b6f75"); s.addColorStop(0.4, "#ffffff"); s.addColorStop(1, "#7a7f86");
  g.fillStyle = s; g.beginPath(); g.moveTo(-46, -90); g.quadraticCurveTo(-46, 0, -10, 20); g.lineTo(-8, 60); g.lineTo(8, 60); g.lineTo(10, 20); g.quadraticCurveTo(46, 0, 46, -90); g.closePath(); g.fill();
  g.lineWidth = 12; g.strokeStyle = s; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 42, -80); g.bezierCurveTo(d * 120, -100, d * 125, -10, d * 18, 10); g.stroke(); } g.fillRect(-36, 60, 72, 30);
  g.restore();
  T(g, "CHAMPIONS OF EUROPE", PX + PW / 2, PY + 110, 66, { align: "center", color: "#ffd84a", stroke: 10, alpha: cl(k), maxW: PW - 40 });
  T(g, "INTER 2-0 BAYERN · BERNABÉU", PX + PW / 2, PY + PH - 60, 40, { align: "center", font: "Oswald", weight: 700, stroke: 6, alpha: cl(k), maxW: PW - 40 });
}
function hook(g, lt) {
  g.save(); g.fillStyle = "rgba(8,8,12,.62)"; g.fillRect(PX, PY, PW, PH);
  const a = ez(lt * 3), b = ez((lt - 0.2) * 3);
  avatar(g, "pep", PX + PW * 0.26 - (1 - a) * 200, PY + 300, 150, { mouth: "flat" });
  avatar(g, "mourinho", PX + PW * 0.74 + (1 - b) * 200, PY + 300, 150, { mouth: "grin" });
  T(g, "VS", PX + PW / 2, PY + 330, 110, { align: "center", color: "#ffd84a", stroke: 12, alpha: ez((lt - 0.3) * 3) });
  T(g, "GUARDIOLA", PX + PW * 0.26, PY + 510, 54, { align: "center", stroke: 8, alpha: a }); T(g, "MOURINHO", PX + PW * 0.74, PY + 510, 54, { align: "center", stroke: 8, alpha: b });
  T(g, "BARÇA v INTER · CAMP NOU · 2010", PX + PW / 2, PY + 600, 40, { align: "center", font: "Oswald", weight: 700, color: "#ffd84a", alpha: ez((lt - 0.5) * 3), maxW: PW - 40 });
  g.restore();
}
function nextUp(g, lt) {
  g.save(); g.fillStyle = "rgba(8,8,12,.7)"; g.fillRect(PX, PY, PW, PH);
  avatar(g, "pep", PX + PW / 2, PY + 330, 180, { mouth: "grin" });
  T(g, "PART 2", PX + PW / 2, PY + 600, 90, { align: "center", color: "#ffd84a", stroke: 10, alpha: ez(lt * 3) });
  T(g, "PEP'S REVENGE", PX + PW / 2, PY + 690, 70, { align: "center", stroke: 10, alpha: ez((lt - 0.3) * 3) });
  g.restore();
}

// ── chess layer ──
function badgeIcon(g, b, x, y, r, k = 1) {
  if (k <= 0) return; g.save(); g.translate(x, y); g.scale(k, k);
  g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 16; g.fillStyle = b.col; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = "#fff"; g.lineWidth = r * 0.1; g.stroke();
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; const emoji = /[\u{1F300}-\u{1FAFF}]/u.test(b.sym);
  g.font = emoji ? `${r * 0.95}px 'Noto Color Emoji'` : `${r * (b.sym.length > 1 ? 1.0 : 1.2)}px Anton, 'DejaVu Sans', sans-serif`;
  g.fillText(b.sym, 0, r * (emoji ? 0.06 : 0.08));
  g.restore();
}
function evalFrac(e) { if (e === "M") return 1; if (e === "-M") return 0; return 0.5 + 0.5 * Math.tanh(Number(e) / 4); }
function evalText(e) { if (e === "M") return "M"; const v = Number(e); return (v > 0 ? "+" : "") + v.toFixed(1); }
function flipAt(s) { const sc = s.scene; if (sc.flipWord) { const w = (s.words || []).find((x) => x.w.toLowerCase().replace(/[^a-z]/g, "").startsWith(sc.flipWord)); if (w) return w.t0 - s.t0; } return sc.flipAt || 3.2; }
function wordAt(s, word, dflt) { const w = (s.words || []).find((x) => x.w.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(word)); return w ? w.t0 - s.t0 : dflt; }
function evalBar(g, t, s, prevSc) {
  const sc = s.scene; const from = prevSc ? (prevSc.evalAfter ?? prevSc.eval ?? 0) : 0; const mid = sc.eval ?? 0; const after = sc.evalAfter;
  const k1 = ez((t - 0.3) / 0.7); let f = evalFrac(from) + (evalFrac(mid) - evalFrac(from)) * k1; let shown = k1 > 0.5 ? mid : from;
  if (after != null) { const k2 = ez((t - flipAt(s)) / 0.5); f += (evalFrac(after) - evalFrac(mid)) * k2; if (k2 > 0.5) shown = after; }
  rr(g, EVX, PY, EVW, PH, 8, "#403d39"); g.save(); g.beginPath(); g.roundRect(EVX, PY, EVW, PH, 8); g.clip(); g.fillStyle = "#f4f1ea"; const h = PH * f; g.fillRect(EVX, PY + PH - h, EVW, h); g.restore();
  const white = f >= 0.5; T(g, evalText(shown), EVX + EVW / 2, white ? PY + PH - 14 : PY + 28, 19, { align: "center", font: "Oswald", weight: 700, color: white ? "#222" : "#eee", maxW: EVW - 4 });
}
function wrap(g, words, maxW, font) {
  g.save(); g.font = font; const lines = []; let cur = [], w = 0; const sp = g.measureText(" ").width;
  for (const wd of words) { const ww = g.measureText(wd.w).width; if (cur.length && w + sp + ww > maxW) { lines.push(cur); cur = []; w = 0; } cur.push({ ...wd, ww }); w += (cur.length > 1 ? sp : 0) + ww; }
  if (cur.length) lines.push(cur); g.restore(); return lines;
}
function moveCard(g, gt, lt, s) {
  const sc = s.scene; const b = BADGES[sc.flip && lt > flipAt(s) ? sc.flip : sc.badge] || BADGES.book;
  const y0 = 160, x = X0, w = X1 - X0; const font = "400 34px Oswald"; const lines = wrap(g, s.words || [], w - 60, font); const lh = 44;
  const h = Math.max(250, 118 + lines.length * lh + 16);
  rr(g, x, y0, w, h, 18, "rgba(18,18,20,.94)"); g.fillStyle = b.col; g.fillRect(x, y0, 9, h);
  const ppl = ST().people || {};
  const who = sc.who === "result" ? "RESULT" : sc.who === "next" ? "UP NEXT" : sc.hook ? "ANALYSED LIKE CHESS" : `MOVE ${sc.n} · ${(ppl[sc.who] || {}).name || ""}`.toUpperCase();
  T(g, who, x + 32, y0 + 40, 22, { font: "Oswald", weight: 700, color: "#9a9ea8", maxW: w - 300 });
  g.save(); g.font = "700 22px Oswald"; const pw = g.measureText(b.label).width + 50; const pk = pop((lt - 0.25) * 3);
  g.translate(x + w - pw / 2 - 22, y0 + 32); g.scale(pk, pk); rr(g, -pw / 2, -19, pw, 38, 19, b.col); g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(b.label, 0, 8); g.restore();
  T(g, sc.title || "", x + 32, y0 + 94, sc.hook ? 50 : 46, { color: sc.hook ? "#fff" : b.col, maxW: w - 64 });
  g.save(); g.font = font; g.fillStyle = "#fff"; const sp = g.measureText(" ").width;
  lines.forEach((ln, i) => { let cx = x + 32; for (const wd of ln) { const a = cl((gt - wd.t0 + 0.05) / 0.12); if (a > 0) { g.globalAlpha = a; g.fillText(wd.w, cx, y0 + 148 + i * lh); } cx += wd.ww + sp; } });
  g.restore();
}
function bottomBar(g, lt, sc) {
  const y = PY + PH + 18, h = 1536 - y; rr(g, X0, y, X1 - X0, h, 18, "#111114");
  const s = sc.score || {}; const blackOn = sc.who === "pep", whiteOn = ["mourinho", "result"].includes(sc.who);
  for (const [id, x, al, on, side] of [["pep", X0 + 60, "left", blackOn, "BLACK"], ["mourinho", X1 - 60, "right", whiteOn, "WHITE"]]) {
    if (on) { g.save(); g.globalAlpha = 0.5 + 0.3 * Math.sin(lt * 6); g.fillStyle = "#81b64c"; g.beginPath(); g.arc(x, y + h / 2, 52, 0, 7); g.fill(); g.restore(); }
    avatar(g, id, x, y + h / 2, 46, { mouth: "smile" });
    const p = (ST().people || {})[id] || {}; const tx = al === "left" ? x + 60 : x - 60;
    T(g, (p.short || p.name || "").toUpperCase(), tx, y + h / 2 - 2, 34, { align: al, maxW: 200 });
    T(g, `${club(p.club).name} · ${side}`, tx, y + h / 2 + 30, 20, { align: al, font: "Oswald", weight: 700, color: "#9a9ea8", maxW: 200 });
  }
  const cx = W / 2 - 5 + (X0 + X1 - W) / 2; const names = s.names || ["BAR", "INT"];
  rr(g, cx - 70, y + 22, 140, 64, 12, "#e8263f"); T(g, `${s.h ?? 0}-${s.a ?? 0}`, cx, y + 72, 52, { align: "center" });
  T(g, names[0], cx - 82, y + 68, 30, { align: "right", maxW: 90 }); T(g, names[1], cx + 82, y + 68, 30, { align: "left", maxW: 90 });
  if (s.min) { rr(g, cx - 40, y + 94, 80, 32, 8, "#2a2a2e"); T(g, s.min, cx, y + 118, 22, { align: "center", font: "Oswald", weight: 700, maxW: 74 }); }
  T(g, s.agg || "", cx, y + h - 16, 22, { align: "center", font: "Oswald", weight: 700, color: "#ffd84a", maxW: 300 });
}

window.CHESS = { BADGES, draw(g, gt, s, prev) {
  const sc = s.scene, lt = gt - s.t0; const pv = prev && prev.scene;
  g.fillStyle = "#1c1c21"; g.fillRect(0, 0, W, 1920);
  const grd = g.createRadialGradient(540, 900, 200, 540, 900, 1300); grd.addColorStop(0, "rgba(255,255,255,.05)"); grd.addColorStop(1, "rgba(0,0,0,.45)"); g.fillStyle = grd; g.fillRect(0, 0, W, 1920);
  // the match
  g.save(); g.beginPath(); g.roundRect(PX, PY, PW, PH, 16); g.clip();
  stands(g, gt); const cam = camAt(lt, sc, pv); pitch(g, cam);
  const pos = posAt(lt, sc, pv, gt);
  for (const a of sc.arrows || []) arrow(g, cam, a.from, a.to, ez((lt - (a.at || 0.6)) / 0.8));
  if (sc.banks) banks(g, cam, pos, lt);
  const r = drawPlayers(g, cam, pos, sc, lt, gt);
  drawBall(g, cam, ballAt(lt, sc, pos, gt));
  if (sc.where) { g.save(); g.font = "700 22px Oswald"; const tw = g.measureText(sc.where).width + 24; rr(g, PX + PW - tw - 18, PY + PH - 50, tw, 34, 8, "rgba(0,0,0,.6)"); g.fillStyle = "#fff"; g.fillText(sc.where, PX + PW - tw - 6, PY + PH - 26); g.restore(); }
  if (sc.goal) { const gt0 = sc.goalWord ? wordAt(s, sc.goalWord, 1.8) : 1.8; const k = (lt - gt0) / 1.6; if (k > 0 && k < 0.3) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - k / 0.3)})`; g.fillRect(PX, PY, PW, PH); } flash(g, "GOAL!", k, "#ffd84a"); }
  if (sc.flip === "nogoal") { const ft = flipAt(s); const k = (lt - ft) / 2.6; if (k > 0) { g.fillStyle = `rgba(0,0,0,${0.4 * cl(k * 4)})`; g.fillRect(PX, PY, PW, PH); flash(g, "NO GOAL", Math.min(k, 0.79), "#ff4d5e", "HANDBALL · YAYA TOURÉ"); } }
  if (sc.red) redCard(g, lt, sc);
  if (sc.overlay === "coach") coachMap(g, lt);
  if (sc.overlay === "possession") possession(g, lt, 76);
  if (sc.overlay === "sprinklers") { sprinklers(g, cam, lt, gt); mourinhoRun(g, cam, lt, gt); flash(g, "FULL TIME", (lt - 0.1) / 1.6, "#ffffff"); }
  if (sc.overlay === "trophy") bigEars(g, lt);
  if (sc.overlay === "hook") hook(g, lt);
  if (sc.overlay === "next") nextUp(g, lt);
  // the grade lands next to the player who made the move
  const b = BADGES[sc.flip && lt > flipAt(s) ? sc.flip : sc.badge];
  if (b) { let bx = PX + PW - 70, by = PY + 70; const p = pos[sc.on];
    if (p && !['hook', 'next', 'trophy', 'sprinklers'].includes(sc.overlay)) { [bx, by] = P(cam, p.x, p.y); bx += r * 1.1; by -= r * 1.1; }
    const flipT = sc.flip ? flipAt(s) : -1; const k = flipT > 0 && lt > flipT ? pop((lt - flipT) * 3) : pop((lt - (sc.badgeAt || 0.35)) * 3);
    badgeIcon(g, b, bx, by, 40, k); }
  g.restore();
  g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 2; g.beginPath(); g.roundRect(PX, PY, PW, PH, 16); g.stroke();
  evalBar(g, lt, s, pv);
  T(g, "♚", EVX + EVW / 2, PY - 10, 30, { align: "center", font: "'DejaVu Sans', sans-serif", color: "#cfcfcf" });
  moveCard(g, gt, lt, s);
  bottomBar(g, lt, sc);
  // drawn, not footage (RUL-KIB-002)
  T(g, "ILLUSTRATION", PX + 16, PY + PH - 16, 18, { font: "Oswald", weight: 700, color: "rgba(255,255,255,.55)" });
} };
})();
