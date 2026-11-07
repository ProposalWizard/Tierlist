// "Analysed like chess" layout (Mikey, 7 Nov 2026; format from TikToks R14 to R17).
// A football duel told as a chess game: a typed move card on top, the pitch
// drawn as a chessboard with an evaluation bar, a name tag for each side and
// a scoreboard. Every scene is { type: "move", ... } (see STORYBOARD.md).
// White = the side at the bottom (defends the bottom goal), Black = the top.
(() => {
const { W, ez, pop, cl } = window.SC;
const X0 = 64, X1 = 950;                 // safe area (FACT-KIB-004)
const BX = 128, BY = 700, BW = 822, BH = 640; // the board
const EVX = 64, EVW = 44;                // the evaluation bar

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

// formations: id -> [x, y] on a 0..1 board (y 0 = top goal)
const F = {
  i4231: { i0: [0.5, 0.95], i1: [0.86, 0.82], i2: [0.62, 0.85], i3: [0.38, 0.85], i4: [0.14, 0.82], i5: [0.4, 0.7], i6: [0.6, 0.7], i7: [0.84, 0.56], i8: [0.5, 0.56], i10: [0.16, 0.56], i9: [0.5, 0.42] },
  i4231deep: { i0: [0.5, 0.95], i1: [0.84, 0.86], i2: [0.61, 0.88], i3: [0.39, 0.88], i4: [0.16, 0.86], i5: [0.4, 0.76], i6: [0.6, 0.76], i7: [0.82, 0.66], i8: [0.5, 0.66], i10: [0.18, 0.66], i9: [0.5, 0.55] },
  i441: { i0: [0.5, 0.95], i1: [0.82, 0.87], i2: [0.6, 0.89], i3: [0.4, 0.89], i4: [0.18, 0.87], i7: [0.8, 0.77], i5: [0.6, 0.78], i8: [0.4, 0.78], i10: [0.2, 0.77], i9: [0.5, 0.62], i6: [-0.2, 0.7] },
  b433: { b0: [0.5, 0.05], b1: [0.14, 0.18], b2: [0.38, 0.15], b3: [0.62, 0.15], b4: [0.86, 0.18], b5: [0.5, 0.3], b6: [0.3, 0.38], b7: [0.7, 0.38], b8: [0.16, 0.5], b9: [0.5, 0.52], b10: [0.84, 0.5] },
  siege: { b0: [0.5, 0.12], b2: [0.38, 0.4], b3: [0.62, 0.4], b1: [0.08, 0.6], b4: [0.92, 0.6], b5: [0.5, 0.5], b6: [0.3, 0.63], b7: [0.7, 0.63], b8: [0.14, 0.72], b9: [0.5, 0.69], b10: [0.86, 0.72] },
  pique: { b0: [0.5, 0.16], b2: [0.47, 0.84], b3: [0.55, 0.42], b1: [0.08, 0.62], b4: [0.92, 0.62], b5: [0.5, 0.55], b6: [0.3, 0.66], b7: [0.68, 0.7], b8: [0.14, 0.74], b9: [0.58, 0.72], b10: [0.75, 0.79] },
};
const LABELS = { i6: "MOTTA", i10: "ETO'O", i9: "MILITO", b2: "PIQUÉ", b5: "BUSQUETS", b9: "MESSI", b10: "BOJAN" };
const ON = { motta: "i6", etoo: "i10", pique: "b2", bojan: "b10" };

function T(g, s, x, y, size, o = {}) {
  g.save(); g.font = `${o.weight || 400} ${size}px ${o.font || "Anton"}`; g.textAlign = o.align || "left"; g.textBaseline = "alphabetic";
  if (o.maxW) { const w = g.measureText(s).width; if (w > o.maxW) { size *= o.maxW / w; g.font = `${o.weight || 400} ${size}px ${o.font || "Anton"}`; } }
  g.globalAlpha = o.alpha ?? 1; g.fillStyle = o.color || "#fff"; g.fillText(s, x, y); g.restore();
}
const club = (id) => (window.STORY.clubs || {})[id] || { short: "?", c1: "#666", c2: "#fff" };
function rr(g, x, y, w, h, r, fill) { g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }

function badgeIcon(g, b, x, y, r, k = 1) {
  if (k <= 0) return; g.save(); g.translate(x, y); g.scale(k, k);
  g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 14; g.fillStyle = b.col; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = r * 0.08; g.stroke();
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  const emoji = /[\u{1F300}-\u{1FAFF}]/u.test(b.sym);
  g.font = emoji ? `${r * 0.95}px 'Noto Color Emoji'` : `${r * (b.sym.length > 1 ? 1.0 : 1.2)}px Anton, 'DejaVu Sans', sans-serif`;
  g.fillText(b.sym, 0, r * (emoji ? 0.06 : 0.08)); g.restore();
}

function evalFrac(e) { if (e === "M") return 1; if (e === "-M") return 0; return 0.5 + 0.5 * Math.tanh(Number(e) / 4); }
function evalText(e) { if (e === "M") return "M"; const v = Number(e); return (v > 0 ? "+" : "") + v.toFixed(1); }

function pawn(g, x, y, s, white, ring) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(2, 30, 26, 8, 0, 0, 7); g.fill();
  g.fillStyle = ring; g.beginPath(); g.ellipse(0, 26, 25, 9, 0, 0, 7); g.fill();
  const body = white ? "#f4f1ea" : "#26221f", edge = white ? "#3b3b3b" : "#d9d4c8";
  g.fillStyle = body; g.strokeStyle = edge; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-18, 24); g.quadraticCurveTo(-16, 8, -8, 2); g.quadraticCurveTo(-12, -4, -9, -10); g.lineTo(9, -10); g.quadraticCurveTo(12, -4, 8, 2); g.quadraticCurveTo(16, 8, 18, 24); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, -19, 11, 0, 7); g.fill(); g.stroke();
  g.restore();
}

function boardPos(spec) {
  const out = {}; const a = F[spec.inter] || {}, b = F[spec.barca] || {};
  for (const k in a) out[k] = a[k]; for (const k in b) out[k] = b[k]; return out;
}
const toPx = ([x, y]) => [BX + 40 + x * (BW - 80), BY + 26 + y * (BH - 52)];

function drawBoard(g, t, sc, prevSc, globalT) {
  // chessboard pitch: 8 x 10 mown squares
  const cols = 8, rows = 10, cw = BW / cols, rh = BH / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { g.fillStyle = (r + c) % 2 ? "#4f8f3f" : "#5fa24c"; g.fillRect(BX + c * cw, BY + r * rh, cw + 1, rh + 1); }
  g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 4; const m = 18;
  g.strokeRect(BX + m, BY + m, BW - 2 * m, BH - 2 * m);
  g.beginPath(); g.moveTo(BX + m, BY + BH / 2); g.lineTo(BX + BW - m, BY + BH / 2); g.stroke();
  g.beginPath(); g.arc(BX + BW / 2, BY + BH / 2, 70, 0, 7); g.stroke();
  for (const top of [true, false]) {
    const y = top ? BY + m : BY + BH - m, d = top ? 1 : -1;
    g.strokeRect(BX + BW / 2 - 200, top ? y : y - 110, 400, 110); g.strokeRect(BX + BW / 2 - 90, top ? y : y - 40, 180, 40);
    g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(BX + BW / 2 - 55, top ? y - 12 : y, 110, 12);
  }
  // pieces glide from the last scene's spot
  const cur = boardPos(sc.board || {}), prev = prevSc ? boardPos(prevSc.board || {}) : cur;
  const k = ez(t / 0.9);
  const onId = ON[sc.on];
  const ic = club("int").c1, bc = club("bar").c1;
  for (const id of Object.keys(cur)) {
    let p = cur[id], q = prev[id] || p;
    let x = q[0] + (p[0] - q[0]) * k, y = q[1] + (p[1] - q[1]) * k;
    if (sc.red === id) { const s = cl((t - 1.4) / 1.2); x = p[0] + (-0.25 - p[0]) * ez(s); }
    if (sc.passes && id[0] === "b") { const w = Math.sin(globalT * 1.3 + Number(id.slice(1))) * 0.025; x += w; }
    const [px, py] = toPx([x, y]); if (px < BX - 30) continue;
    const white = id[0] === "i"; const hl = id === onId;
    if (hl) { g.save(); g.globalAlpha = 0.45 + 0.25 * Math.sin(globalT * 6); g.fillStyle = "#ffe14a"; g.beginPath(); g.arc(px, py + 6, 40, 0, 7); g.fill(); g.restore(); }
    pawn(g, px, py, 0.95, white, white ? ic : bc);
    const lab = (sc.labels || {})[id] || LABELS[id];
    if (lab && (hl || ["i6", "i10", "b2", "b9"].includes(id) && !(sc.red === id && t > 2))) {
      g.save(); g.font = "700 24px Oswald"; const w = g.measureText(lab).width + 16; rr(g, px - w / 2, py + 34, w, 30, 8, hl ? "#ffe14a" : "rgba(0,0,0,.7)");
      g.fillStyle = hl ? "#111" : "#fff"; g.textAlign = "center"; g.fillText(lab, px, py + 57); g.restore();
    }
    if (sc.red === id && t > 0.5) { const q2 = pop((t - 0.5) * 3); g.save(); g.translate(px + 30, py - 40); g.rotate(0.2); g.scale(q2, q2); rr(g, -16, -24, 32, 46, 5, "#e0202e"); g.restore(); }
  }
  // arrows (sideways passes, pushes)
  for (const a of (sc.board || {}).arrows || []) {
    const s = ez((t - 0.6) * 1.5); if (s <= 0) continue; const [x1, y1] = toPx([a[0], a[1]]), [x2, y2] = toPx([a[2], a[3]]);
    const ex = x1 + (x2 - x1) * s, ey = y1 + (y2 - y1) * s; const ang = Math.atan2(ey - y1, ex - x1);
    g.save(); g.strokeStyle = "rgba(255,170,30,.9)"; g.fillStyle = "rgba(255,170,30,.9)"; g.lineWidth = 14; g.lineCap = "round";
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(ex, ey); g.stroke(); g.translate(ex, ey); g.rotate(ang); g.beginPath(); g.moveTo(16, 0); g.lineTo(-14, -20); g.lineTo(-14, 20); g.fill(); g.restore();
  }
  if (sc.passes) { // the ball circles round the outside of the wall
    const pts = [[0.1, 0.62], [0.32, 0.6], [0.5, 0.66], [0.68, 0.6], [0.9, 0.62], [0.68, 0.6], [0.5, 0.66], [0.32, 0.6]];
    const u = (globalT * 1.6) % pts.length, i = Math.floor(u), f = u - i; const a = pts[i], b = pts[(i + 1) % pts.length];
    const [bx, by] = toPx([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - 0.05]); ball(g, bx, by);
  }
  const bl = (sc.board || {}).ball; if (bl) { const s = ez((t - 0.5) * 1.6); const [fx, fy] = toPx([0.5, 0.5]); const [tx, ty] = toPx(bl); ball(g, fx + (tx - fx) * s, fy + (ty - fy) * s); }
  if ((sc.board || {}).goal && t > 1.3) { const f = cl((t - 1.3) / 0.6); g.fillStyle = `rgba(255,255,255,${0.45 * (1 - f)})`; g.fillRect(BX, BY, BW, BH); }
  if (sc.sprinklers) sprinklers(g, t, globalT);
  if (sc.trophy) bigEars(g, t);
  // label: this is a drawing, not footage (RUL-KIB-002)
  g.save(); g.font = "700 20px Oswald"; g.fillStyle = "rgba(0,0,0,.5)"; const w = g.measureText("ILLUSTRATION").width + 16; g.fillRect(BX + BW - w - 26, BY + BH - 56, w, 28); g.fillStyle = "#fff"; g.fillText("ILLUSTRATION", BX + BW - w - 18, BY + BH - 35); g.restore();
}
function ball(g, x, y) { g.save(); g.fillStyle = "#fff"; g.strokeStyle = "#111"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); g.stroke(); g.fillStyle = "#111"; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.restore(); }
function sprinklers(g, t, gt) {
  if (t < 1.8) return; const k = cl((t - 1.8) / 0.6);
  for (const [sx, sy] of [[0.12, 0.2], [0.88, 0.2], [0.12, 0.8], [0.88, 0.8], [0.5, 0.5]]) {
    const [x, y] = toPx([sx, sy]);
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + gt * 1.5; const d = ((gt * 140 + i * 37) % 120) * k; g.fillStyle = `rgba(200,230,255,${0.75 * (1 - d / 130)})`; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 4, 0, 7); g.fill(); }
  }
}
function bigEars(g, t) {
  const k = pop((t - 1.0) * 2); if (k <= 0) return; g.save(); g.fillStyle = `rgba(0,0,0,${0.45 * cl(k)})`; g.fillRect(BX, BY, BW, BH);
  g.translate(BX + BW / 2, BY + BH / 2 + 20); g.scale(k * 1.5, k * 1.5);
  const s = g.createLinearGradient(-60, 0, 60, 0); s.addColorStop(0, "#6b6f75"); s.addColorStop(0.4, "#ffffff"); s.addColorStop(1, "#7a7f86");
  g.fillStyle = s; g.beginPath(); g.moveTo(-46, -90); g.quadraticCurveTo(-46, 0, -10, 20); g.lineTo(-8, 60); g.lineTo(8, 60); g.lineTo(10, 20); g.quadraticCurveTo(46, 0, 46, -90); g.closePath(); g.fill();
  g.lineWidth = 12; g.strokeStyle = s; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 42, -80); g.bezierCurveTo(d * 120, -100, d * 125, -10, d * 18, 10); g.stroke(); } g.fillRect(-36, 60, 72, 30);
  g.restore(); T(g, "TREBLE", BX + BW / 2, BY + 120, 72, { align: "center", color: "#ffd84a", alpha: cl(k) });
}

function flipAt(s) { const sc = s.scene; if (sc.flipWord) { const w = (s.words || []).find((x) => x.w.toLowerCase().startsWith(sc.flipWord)); if (w) return w.t0 - s.t0; } return sc.flipAt || 3.2; }
function evalBar(g, t, sc, prevSc, s) {
  const from = prevSc ? (prevSc.evalAfter ?? prevSc.eval ?? 0) : 0; const mid = sc.eval ?? 0; const after = sc.evalAfter;
  const k1 = ez((t - 0.3) / 0.7); let f = evalFrac(from) + (evalFrac(mid) - evalFrac(from)) * k1; let shown = k1 > 0.5 ? mid : from;
  if (after != null) { const k2 = ez((t - flipAt(s)) / 0.5); f += (evalFrac(after) - evalFrac(mid)) * k2; if (k2 > 0.5) shown = after; }
  rr(g, EVX, BY, EVW, BH, 6, "#403d39"); g.save(); g.beginPath(); g.roundRect(EVX, BY, EVW, BH, 6); g.clip();
  g.fillStyle = "#f4f1ea"; const h = BH * f; g.fillRect(EVX, BY + BH - h, EVW, h); g.restore();
  const white = f >= 0.5; T(g, evalText(shown), EVX + EVW / 2, white ? BY + BH - 12 : BY + 28, 20, { align: "center", font: "Oswald", weight: 700, color: white ? "#222" : "#eee" });
}

function nameTag(g, id, y, colour, active) {
  const p = (window.STORY.people || {})[id] || {}; const c = club(p.club);
  rr(g, X0, y, X1 - X0, 74, 14, active ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.06)");
  const spec = { name: p.name, skin: p.skin, hair: p.hair, beard: p.beard, beardCol: p.beardCol, suit: { jacket: "#22252e", tie: c.c1 } };
  window.drawAvatar(g, X0 + 44, y + 37, 30, spec, { shirt: "#222", trim: "#222", collar: "#333" }, { mouth: "smile", bgTop: c.c1, bgBot: c.c2 });
  T(g, p.name || "", X0 + 92, y + 36, 36, { font: "Oswald", weight: 700 });
  T(g, `${c.name} · ${colour}`, X0 + 92, y + 64, 22, { font: "Oswald", weight: 700, color: "#b9bcc4" });
  if (active) { g.fillStyle = "#81b64c"; g.beginPath(); g.arc(X1 - 30, y + 37, 9, 0, 7); g.fill(); }
}

function wrap(g, words, maxW, font) {
  g.save(); g.font = font; const lines = []; let cur = [], w = 0; const sp = g.measureText(" ").width;
  for (const wd of words) { const ww = g.measureText(wd.w).width; if (cur.length && w + sp + ww > maxW) { lines.push(cur); cur = []; w = 0; } cur.push({ ...wd, ww }); w += (cur.length > 1 ? sp : 0) + ww; }
  if (cur.length) lines.push(cur); g.restore(); return lines;
}

function moveCard(g, gt, lt, s, sc) {
  const b = BADGES[sc.flip && lt > flipAt(s) ? sc.flip : sc.badge] || BADGES.book;
  const y0 = 200, x = X0, w = X1 - X0;
  const font = "400 38px Oswald"; const lines = wrap(g, s.words || [], w - 64, font); const lh = 50;
  const h = Math.max(300, 140 + lines.length * lh + 24);
  rr(g, x, y0, w, h, 18, "rgba(24,24,26,.92)"); g.fillStyle = b.col; g.fillRect(x, y0, 10, h);
  const who = sc.who === "result" ? "RESULT" : sc.who === "next" ? "NEXT" : sc.hook ? "KNOWITBALL · ANALYSED LIKE CHESS" : `MOVE ${sc.n} · ${((window.STORY.people || {})[sc.who] || {}).name || ""}`.toUpperCase();
  T(g, who, x + 36, y0 + 46, 24, { font: "Oswald", weight: 700, color: "#9a9ea8", maxW: w - 300 });
  // pill with the grade
  g.save(); g.font = "700 24px Oswald"; const pw = g.measureText(b.label).width + 56; const pk = pop((lt - 0.25) * 3);
  g.translate(x + w - pw / 2 - 24, y0 + 38); g.scale(pk, pk); rr(g, -pw / 2, -20, pw, 40, 20, b.col); g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(b.label, 6, 9); g.restore();
  const title = sc.hook ? sc.title : `${sc.title}`;
  T(g, title, x + 36, y0 + 108, sc.hook ? 56 : 52, { color: sc.hook ? "#fff" : b.col, maxW: w - 72 });
  // typed text, word by word with the voice
  g.save(); g.font = font; g.fillStyle = "#fff";
  lines.forEach((ln, i) => { let cx = x + 36; for (const wd of ln) { const a = cl((gt - wd.t0 + 0.05) / 0.12); if (a > 0) { g.globalAlpha = a; g.fillText(wd.w, cx, y0 + 172 + i * lh); } cx += wd.ww + g.measureText(" ").width; } });
  g.restore();
}

function scoreboard(g, lt, sc) {
  const s = sc.score; if (!s) return; const y = 1452;
  rr(g, X0, y, X1 - X0, 84, 14, "#111");
  T(g, s.where, X0 + 24, y + 30, 20, { font: "Oswald", weight: 700, color: "#9a9ea8", maxW: 380 });
  T(g, s.agg + (s.poss ? "   ·   " + s.poss : ""), X0 + 24, y + 66, 26, { font: "Oswald", weight: 700, color: "#ffd84a", maxW: 380 });
  const names = s.names || ["BAR", "INT"]; const cx = X1 - 300;
  T(g, names[0], cx - 70, y + 56, 30, { align: "right", maxW: 110 }); T(g, names[1], cx + 70, y + 56, 30, { align: "left", maxW: 110 });
  rr(g, cx - 56, y + 16, 112, 54, 10, "#e8263f"); T(g, `${s.h}-${s.a}`, cx, y + 58, 40, { align: "center" });
  if (s.min) { rr(g, X1 - 92, y + 22, 70, 40, 8, "#2a2a2e"); T(g, s.min, X1 - 57, y + 51, 24, { align: "center", font: "Oswald", weight: 700, maxW: 62 }); }
}

window.CHESS = { BADGES, draw(g, gt, s, prev) {
  const sc = s.scene, lt = gt - s.t0;
  g.fillStyle = "#26252a"; g.fillRect(0, 0, W, 1920);
  const grd = g.createRadialGradient(540, 960, 200, 540, 960, 1200); grd.addColorStop(0, "rgba(255,255,255,.04)"); grd.addColorStop(1, "rgba(0,0,0,.4)"); g.fillStyle = grd; g.fillRect(0, 0, W, 1920);
  moveCard(g, gt, lt, s, sc);
  const blackOn = sc.who === "pep", whiteOn = sc.who === "mourinho" || sc.who === "result";
  nameTag(g, "pep", BY - 92, "Black", blackOn);
  drawBoard(g, lt, sc, prev && prev.scene, gt);
  evalBar(g, lt, sc, prev && prev.scene, s);
  nameTag(g, "mourinho", BY + BH + 18, "White", whiteOn);
  // the grade lands on the board, chess.com style
  const b = BADGES[sc.flip && lt > flipAt(s) ? sc.flip : sc.badge];
  if (b) { const onId = ON[sc.on]; let px = BX + BW - 90, py = BY + 90;
    if (onId) { const pos = boardPos(sc.board || {})[onId]; if (pos && pos[0] > 0) { [px, py] = toPx(pos); px += 46; py -= 54; } }
    const flipT = sc.flip ? flipAt(s) : -1; const k = lt > flipT && flipT > 0 ? pop((lt - flipT) * 3) : pop((lt - 0.25) * 3);
    badgeIcon(g, b, px, py, 44, k); }
  scoreboard(g, lt, sc);
} };
})();
