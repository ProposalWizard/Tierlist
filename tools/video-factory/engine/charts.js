// Video factory v2 data and story scenes (Mikey, 4 Nov 2026): news, table, bars,
// line, compare, badge, gameclip, plus the trophy art every scene shares.
// Same layout rules as scenes.js (story in y 200..1220, captions 1250..1500).
(() => {
const S = window.SCENES, { W, H, BOT, ez, pop, cl, lerp, T, wrapLines, rr, panel, card, studio, stadium, vignette, crest, club, portrait, colourOf, personSpec, surname, header, reveal, count, rgba, tint, shadeC, glowOf, lum, loadImg, FONT, rays, confetti, teamOf } = window.SC;

// ════════ trophies: proper metal, drawn standing on (x, y), `h` tall ════════
function metal(g, x0, x1, kind) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  const stops = kind === "gold" ? ["#6b4a12", "#c9962e", "#fff1b8", "#e2b043", "#8a611a", "#5a3d0e"] : ["#4a4e55", "#9aa1aa", "#ffffff", "#c9ced6", "#6c7178", "#3c4046"];
  stops.forEach((c, i) => gr.addColorStop([0, 0.22, 0.38, 0.55, 0.8, 1][i], c)); return gr;
}
function plinth(g, w, h, band = "#c9a24a") {
  const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, "#0c0c0e"); gr.addColorStop(0.45, "#3a3a40"); gr.addColorStop(1, "#0c0c0e");
  g.fillStyle = gr; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.lineTo(w * 0.42, -h); g.lineTo(-w * 0.42, -h); g.closePath(); g.fill();
  if (band) { g.fillStyle = band; g.fillRect(-w * 0.45, -h * 0.55, w * 0.9, h * 0.12); }
}
function handle(g, side, x0, y0, x1, y1, bulge, width, fill) { g.strokeStyle = fill; g.lineWidth = width; g.lineCap = "round"; g.beginPath(); g.moveTo(side * x0, y0); g.bezierCurveTo(side * (x0 + bulge), y0 - 10, side * (x1 + bulge), y1 + 10, side * x1, y1); g.stroke(); }
window.drawTrophy = function (g, kind, x, y, h) {
  const s = h / 400; g.save(); g.translate(x, y); g.scale(s, s);
  g.save(); g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(0, 4, 120, 14, 0, 0, 7); g.fill(); g.restore();
  const silver = metal(g, -120, 120, "silver"), gold = metal(g, -120, 120, "gold");
  if (kind === "ballon") {
    plinth(g, 150, 110, "#c9a24a"); g.fillStyle = metal(g, -60, 60, "gold"); g.fillRect(-40, -150, 80, 42);
    const b = g.createRadialGradient(-45, -310, 10, 0, -260, 150); b.addColorStop(0, "#fff7d6"); b.addColorStop(0.35, "#f0c75a"); b.addColorStop(0.8, "#a8741f"); b.addColorStop(1, "#6b4a12");
    g.fillStyle = b; g.beginPath(); g.arc(0, -265, 125, 0, 7); g.fill();
    g.strokeStyle = "rgba(110,72,16,.55)"; g.lineWidth = 4; g.save(); g.beginPath(); g.arc(0, -265, 125, 0, 7); g.clip();
    for (const [cx, cy] of [[0, -265], [-110, -330], [110, -330], [-110, -190], [110, -190], [0, -400], [0, -130]]) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52); } g.closePath(); g.stroke(); }
    g.restore(); g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(-48, -320, 34, 18, -0.6, 0, 7); g.fill();
  } else if (kind === "boot") {
    plinth(g, 220, 110);
    g.fillStyle = gold; g.beginPath(); g.moveTo(-110, -120); g.lineTo(-110, -330); g.quadraticCurveTo(-110, -360, -80, -360); g.lineTo(-10, -360); g.lineTo(-6, -230); g.quadraticCurveTo(80, -220, 120, -175); g.quadraticCurveTo(130, -130, 100, -120); g.closePath(); g.fill();
    g.strokeStyle = "rgba(90,60,10,.6)"; g.lineWidth = 4; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-90 + i * 18, -300 + i * 14); g.lineTo(-20 + i * 14, -290 + i * 12); g.stroke(); }
    g.fillStyle = "#6b4a12"; for (const sx of [-80, -30, 30, 80]) g.fillRect(sx - 8, -122, 16, 10);
  } else if (kind === "league") {
    plinth(g, 220, 120, null); g.fillStyle = metal(g, -100, 100, "gold"); g.fillRect(-92, -78, 184, 14);
    g.fillStyle = silver; g.beginPath(); g.moveTo(-80, -120); g.lineTo(80, -120); g.quadraticCurveTo(110, -190, 70, -250); g.lineTo(-70, -250); g.quadraticCurveTo(-110, -190, -80, -120); g.fill();
    handle(g, -1, 74, -235, 84, -140, 60, 14, silver); handle(g, 1, 74, -235, 84, -140, 60, 14, silver);
    // the crown
    g.fillStyle = gold; g.beginPath(); g.moveTo(-90, -250); for (let i = 0; i <= 8; i++) { const xx = -90 + i * 22.5; g.lineTo(xx, i % 2 ? -300 : -350); } g.lineTo(90, -250); g.closePath(); g.fill();
    g.fillStyle = "#3a6df0"; for (const xx of [-45, 0, 45]) { g.beginPath(); g.arc(xx, -275, 9, 0, 7); g.fill(); }
    g.fillStyle = "#d4202c"; for (const xx of [-90, 0, 90]) { g.beginPath(); g.arc(xx * 1, -352, 9, 0, 7); g.fill(); }
  } else if (kind === "bigears") {
    plinth(g, 170, 90);
    g.fillStyle = silver; g.beginPath(); g.moveTo(-26, -90); g.lineTo(26, -90); g.lineTo(14, -170); g.lineTo(-14, -170); g.fill();
    g.beginPath(); g.moveTo(-70, -170); g.lineTo(70, -170); g.quadraticCurveTo(100, -270, 82, -390); g.lineTo(-82, -390); g.quadraticCurveTo(-100, -270, -70, -170); g.fill();
    g.fillStyle = "rgba(255,255,255,.45)"; g.fillRect(-40, -380, 10, 190);
    handle(g, -1, 78, -370, 66, -200, 120, 18, silver); handle(g, 1, 78, -370, 66, -200, 120, 18, silver);
  } else if (kind === "euro") {
    plinth(g, 160, 80);
    g.fillStyle = silver; g.beginPath(); g.moveTo(-40, -80); g.lineTo(40, -80); g.lineTo(62, -370); g.lineTo(-62, -370); g.closePath(); g.fill();
    handle(g, -1, 58, -360, 50, -290, 34, 10, silver); handle(g, 1, 58, -360, 50, -290, 34, 10, silver);
    g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(-18, -360, 8, 270);
  } else if (kind === "worldcup") {
    g.fillStyle = metal(g, -80, 80, "gold"); g.beginPath(); g.moveTo(-80, 0); g.lineTo(80, 0); g.lineTo(66, -80); g.lineTo(-66, -80); g.fill();
    g.fillStyle = "#1f7a3a"; g.fillRect(-76, -60, 152, 14); g.fillRect(-70, -34, 140, 12);
    g.fillStyle = gold; g.beginPath(); g.moveTo(-60, -80); g.bezierCurveTo(-90, -160, 40, -200, -40, -290); g.lineTo(40, -290); g.bezierCurveTo(-40, -200, 90, -160, 60, -80); g.closePath(); g.fill();
    g.strokeStyle = "rgba(110,72,16,.6)"; g.lineWidth = 5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-50 + i * 30, -90); g.bezierCurveTo(-70 + i * 40, -170, 20 + i * 10, -220, -30 + i * 30, -290); g.stroke(); }
    const b = g.createRadialGradient(-30, -360, 10, 0, -330, 90); b.addColorStop(0, "#fff3c4"); b.addColorStop(1, "#a8741f"); g.fillStyle = b; g.beginPath(); g.arc(0, -335, 72, 0, 7); g.fill();
    g.strokeStyle = "rgba(110,72,16,.5)"; g.lineWidth = 4; g.beginPath(); g.ellipse(0, -335, 72, 26, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(0, -335, 30, 72, 0, 0, 7); g.stroke();
  } else if (kind === "award" || kind === "medal") {
    g.fillStyle = "#3a2614"; g.fillRect(-90, -70, 180, 70); g.fillStyle = metal(g, -60, 60, "gold"); g.fillRect(-60, -48, 120, 22);
    g.fillStyle = metal(g, -20, 20, "gold"); g.fillRect(-14, -230, 28, 160);
    g.fillStyle = gold; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 50 : 120, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, -300 + Math.sin(a) * r); } g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.arc(-25, -325, 16, 0, 7); g.fill();
  } else { // cup: the FA Cup shape (silver, or gold when kind is "goldcup")
    const m = kind === "goldcup" ? gold : silver; plinth(g, 180, 90);
    g.fillStyle = m; g.beginPath(); g.moveTo(-24, -90); g.lineTo(24, -90); g.lineTo(14, -150); g.lineTo(-14, -150); g.fill();
    g.beginPath(); g.ellipse(0, -150, 46, 10, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-90, -290); g.quadraticCurveTo(-96, -170, 0, -155); g.quadraticCurveTo(96, -170, 90, -290); g.closePath(); g.fill();
    g.fillRect(-96, -300, 192, 16);
    handle(g, -1, 86, -280, 50, -180, 70, 13, m); handle(g, 1, 86, -280, 50, -180, 70, 13, m);
    g.beginPath(); g.moveTo(-70, -300); g.quadraticCurveTo(0, -360, 70, -300); g.fill();
    g.beginPath(); g.ellipse(0, -350, 14, 22, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0, -380, 12, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,.45)"; g.fillRect(-55, -280, 10, 100);
  }
  g.restore();
};

// ════════ news: a sports-site story ════════
S.news = (g, t, dur, s) => {
  const cid = s.club || (s.person ? teamOf(personSpec(s.person)?.raw || {}) : "");
  const c = cid ? club(cid) : { c1: "#e8263f", c2: "#ffffff" };
  studio(g, t, { c1: c.c1, c2: "#e8263f" });
  const k = ez(t * 2.6); const x = 60, w = 960; let y = 250 + (1 - k) * 160;
  g.save(); g.globalAlpha = cl(k * 1.4);
  const lines = wrapLines(g, s.headline || "", w - 100, FONT.inter(76, 900)).slice(0, 4);
  const stand = wrapLines(g, s.standfirst || "", w - 100, FONT.inter(38, 600)).slice(0, 3);
  const hasImg = !!(s.person || cid || s.image);
  const imgH = hasImg ? Math.max(220, Math.min(380, BOT - (y + 96 + 58 + 70 + lines.length * 84 + 20 + stand.length * 50 + 60 + 40))) : 0;
  const ch = 96 + 58 + 70 + lines.length * 84 + 20 + stand.length * 50 + 60 + (hasImg ? imgH + 30 : 0) + 20;
  panel(g, x, y, w, ch, "#ffffff", 22, 0.5);
  g.save(); rr(g, x, y, w, ch, 22); g.clip();
  // masthead
  const mc = s.mastColor || "#121826"; g.fillStyle = mc; g.fillRect(x, y, w, 96);
  T(g, (s.outlet || "KNOWITBALL").toUpperCase(), x + 40, y + 64, 50, { align: "left", italic: true, color: "#fff" });
  g.save(); g.font = FONT.antonI(50); const ow = g.measureText((s.outlet || "KNOWITBALL").toUpperCase()).width; g.restore();
  g.fillStyle = "#e8263f"; rr(g, x + 56 + ow, y + 26, 130, 44, 6); g.fill(); T(g, s.desk || "SPORT", x + 56 + ow + 65, y + 59, 30, { font: "Inter", weight: 900, spacing: 3, color: "#fff" });
  // live dot + time on the right
  g.fillStyle = "#e8263f"; g.beginPath(); g.arc(x + w - 200, y + 48, 9 + Math.sin(t * 6) * 2, 0, 7); g.fill(); T(g, "LATEST", x + w - 180, y + 58, 26, { align: "left", font: "Inter", weight: 900, spacing: 2, color: "rgba(255,255,255,.85)" });
  // nav row
  g.fillStyle = "#f1f2f5"; g.fillRect(x, y + 96, w, 58); g.fillStyle = "#e3e5ea"; g.fillRect(x, y + 152, w, 2);
  let nx = x + 40; for (const n of (s.nav || ["Football", "Premier League", "Europe", "Transfers"])) { T(g, n, nx, y + 135, 26, { align: "left", font: "Inter", weight: 700, color: "#4b5563" }); g.save(); g.font = FONT.inter(26, 700); nx += g.measureText(n).width + 40; g.restore(); if (nx > x + w - 120) break; }
  y += 96 + 58;
  T(g, String(s.section || "Football").toUpperCase(), x + 50, y + 52, 28, { align: "left", font: "Inter", weight: 900, spacing: 3, color: "#c8102e" }); y += 70;
  // headline, with a marker sweep under it
  const mark = ez((t - 0.7) * 1.6);
  lines.forEach((l, i) => {
    if (s.mark !== false && mark > 0) { g.save(); g.font = FONT.inter(76, 900); const lw = g.measureText(l).width; g.fillStyle = "rgba(255,216,74,.55)"; const p = cl(mark * lines.length - i); g.fillRect(x + 46, y + i * 84 + 48, lw * p + 8, 26); g.restore(); }
    T(g, l, x + 50, y + 66 + i * 84, 76, { align: "left", font: "Inter", weight: 900, color: "#0b0f1a", maxW: w - 100 });
  });
  y += lines.length * 84 + 20;
  stand.forEach((l, i) => T(g, l, x + 50, y + 40 + i * 50, 38, { align: "left", font: "Inter", weight: 600, color: "#3b4252", alpha: ez((t - 0.4) * 3) }));
  y += stand.length * 50 + 18;
  g.fillStyle = "#e5e7eb"; g.fillRect(x + 50, y, w - 100, 2);
  T(g, (s.date || "").toUpperCase(), x + 50, y + 42, 26, { align: "left", font: "Inter", weight: 700, spacing: 2, color: "#6b7280" });
  T(g, s.byline || "", x + w - 50, y + 42, 26, { align: "right", font: "Inter", weight: 700, color: "#6b7280" });
  y += 60;
  if (hasImg) {
    const ix = x + 50, iw = w - 100; g.save(); rr(g, ix, y, iw, imgH, 14); g.clip();
    const gr = g.createLinearGradient(ix, y, ix + iw, y + imgH); gr.addColorStop(0, shadeC(glowOf(c.c1), 0.9)); gr.addColorStop(1, shadeC(c.c1, 0.3)); g.fillStyle = gr; g.fillRect(ix, y, iw, imgH);
    g.fillStyle = "rgba(255,255,255,.07)"; for (let i = -8; i < 20; i++) g.fillRect(ix + i * 70 + (t * 30) % 70, y, 30, imgH);
    const zoom = 1 + 0.06 * cl(t / dur);
    g.translate(ix + iw / 2, y + imgH / 2); g.scale(zoom, zoom); g.translate(-(ix + iw / 2), -(y + imgH / 2));
    if (cid) { g.save(); g.globalAlpha = s.person ? 0.35 : 1; crest(g, cid, s.person ? ix + iw - 170 : ix + iw / 2, y + imgH / 2, imgH * (s.person ? 0.42 : 0.38)); g.restore(); }
    if (s.person) window.SC.person(g, s.person, ix + iw * 0.38, y + imgH * 0.62, imgH * 0.62, { noDisc: true, mood: s.mood || "smile" });
    g.restore();
    T(g, s.caption || "", ix + 16, y + imgH - 16, 22, { align: "left", font: "Inter", weight: 600, color: "rgba(255,255,255,.85)" });
  }
  g.restore(); g.restore();
};

// ════════ table: the game's league table (components/star/LeagueScreen.tsx) ════════
const ZONES = { champ: { color: "#fbbf24", label: "Champions" }, ucl: { color: "#3b82f6", label: "Champions League" }, uel: { color: "#f97316", label: "Europa League" }, up: { color: "#22c55e", label: "Promotion" }, po: { color: "#14b8a6", label: "Play-offs" }, down: { color: "#ef4444", label: "Relegation" } };
S.table = (g, t, dur, s) => {
  const rows = (s.rows || []).slice(0, 12); const n = rows.length;
  const hlClub = rows.find((r) => r.hl)?.club; const glow = hlClub ? club(hlClub).c1 : "#2F6F4E";
  studio(g, t, { c1: glow, c2: "#3b82f6" });
  const top = Math.max(header(g, t, s.kicker || s.season || "", s.title || "League table", { size: 84 }) + 24, 460);
  const cols = s.cols || ["P", "W", "D", "L", "GD", "Pts"]; const keys = cols.map((c) => c.toLowerCase());
  const zones = (s.zones || []).map((z) => ({ ...(ZONES[z.kind] || {}), ...z }));
  const legendH = zones.length ? 56 : 0, headH = 56;
  const rh = Math.min(124, (BOT - top - headH - legendH - 10) / Math.max(1, n));
  const x = 140, w = 880, y = top; const ch = headH + rh * n + legendH;
  card(g, x, y, w, ch, glow, 28, 0.28);
  g.save(); rr(g, x, y, w, ch, 28); g.clip();
  const sw = 64, ptsW = 92; const colX = []; let cx = x + w - 16 - ptsW / 2; colX[cols.length - 1] = cx; for (let i = cols.length - 2; i >= 0; i--) { cx -= (i === cols.length - 2 ? ptsW / 2 + sw / 2 : sw); colX[i] = cx; }
  const posX = x + 44, nameX = x + 84; const nameMax = colX[0] - sw / 2 - nameX - 10;
  // header row
  g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(x, y, w, headH); g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(x, y + headH - 2, w, 2);
  T(g, "#", posX, y + 37, 24, { font: "Inter", weight: 900, spacing: 2, color: "rgba(255,255,255,.55)" });
  T(g, "CLUB", nameX, y + 37, 24, { align: "left", font: "Inter", weight: 900, spacing: 3, color: "rgba(255,255,255,.55)" });
  cols.forEach((c, i) => T(g, c.toUpperCase(), colX[i], y + 37, 24, { font: "Inter", weight: 900, spacing: 2, color: i === cols.length - 1 ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.55)" }));
  const zoneOf = (pos) => zones.find((z) => pos >= z.rows[0] && pos <= z.rows[1]);
  const up = s.reveal === "up";
  rows.forEach((r, i) => {
    const pos = r.pos ?? i + 1; const ry = y + headH + i * rh;
    const order = up ? n - 1 - i : i; const at = reveal(order, n, dur, 0.1, 0.55); const k = ez((t - at) * 3.5); if (k <= 0) return;
    g.save(); g.globalAlpha = k; g.translate((1 - k) * 90, 0);
    const z = zoneOf(pos); const prevZ = i > 0 ? zoneOf(rows[i - 1].pos ?? i) : z;
    if (r.hl) {
      const col = club(r.club).c1, lit = tint(glowOf(col), 0.22);
      const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, rgba(lit, 0.85)); gr.addColorStop(0.55, rgba(glowOf(col), 0.5)); gr.addColorStop(1, rgba(glowOf(col), 0.3));
      const pulse = 0.6 + 0.4 * Math.sin(t * 4);
      g.save(); g.shadowColor = rgba(lit, 0.9 * pulse); g.shadowBlur = 26; g.fillStyle = gr; rr(g, x + 6, ry + 3, w - 12, rh - 6, 12); g.fill(); g.restore();
      g.strokeStyle = rgba(tint(glowOf(col), 0.5), 0.95); g.lineWidth = 3; rr(g, x + 6, ry + 3, w - 12, rh - 6, 12); g.stroke();
      g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(x + 18, ry + 4, w - 36, 2);
    } else if (i % 2 === 0) { g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(x, ry, w, rh); }
    if (i > 0 && z !== prevZ) { g.fillStyle = "rgba(255,255,255,.15)"; g.fillRect(x, ry, w, 2); }
    if (z) { g.save(); g.shadowColor = z.color; g.shadowBlur = 14; g.fillStyle = z.color; g.fillRect(x, ry + 2, 6, rh - 4); g.restore(); const wash = g.createLinearGradient(x, 0, x + w / 3, 0); wash.addColorStop(0, rgba(z.color, 0.13)); wash.addColorStop(1, rgba(z.color, 0)); g.fillStyle = wash; g.fillRect(x, ry, w / 3, rh); }
    const fs = Math.min(44, rh * 0.4); const by = ry + rh / 2 + fs * 0.36;
    T(g, String(pos), posX, by, fs, { font: "Inter", weight: 900, color: "#fff" });
    crest(g, r.club, nameX + rh * 0.3, ry + rh / 2, rh * 0.3);
    T(g, r.name || club(r.club).name, nameX + rh * 0.68, by, fs, { align: "left", font: "Inter", weight: r.hl ? 900 : 700, color: "#fff", maxW: nameMax - rh * 0.68 });
    keys.forEach((kk, ci) => { const v = r[kk] ?? r[cols[ci]]; if (v == null) return; const last = ci === cols.length - 1; const txt = kk === "gd" && typeof v === "number" && v > 0 ? "+" + v : String(v); T(g, txt, colX[ci], by, fs, { font: "Inter", weight: last ? 900 : 700, color: last ? (r.hl ? "#fef08a" : "#fff") : "rgba(255,255,255,.85)", maxW: (last ? ptsW : sw) - 6 }); });
    if (r.move) T(g, r.move > 0 ? "▲" + r.move : "▼" + -r.move, nameX + nameMax - 10, by, fs * 0.6, { align: "right", font: "Inter", weight: 900, color: r.move > 0 ? "#6ee7b7" : "#fca5a5" });
    g.restore();
  });
  if (zones.length) {
    const ly = y + headH + rh * n; g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x, ly, w, legendH); g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(x, ly, w, 2);
    let lx = x + 30; const seen = new Set();
    for (const z of zones) { if (seen.has(z.label)) continue; seen.add(z.label); g.save(); g.shadowColor = z.color; g.shadowBlur = 10; g.fillStyle = z.color; rr(g, lx, ly + 20, 18, 18, 4); g.fill(); g.restore(); T(g, z.label, lx + 28, ly + 37, 24, { align: "left", font: "Inter", weight: 700, color: "rgba(255,255,255,.75)" }); g.save(); g.font = FONT.inter(24, 700); lx += g.measureText(z.label).width + 70; g.restore(); }
  }
  g.restore();
  // the gap: a gold bracket in the left gutter joining two rows, and its number
  if (s.gap) {
    const ia = rows.findIndex((r, i) => (r.pos ?? i + 1) === s.gap.from), ib = rows.findIndex((r, i) => (r.pos ?? i + 1) === s.gap.to);
    const k = ez((t - dur * (s.gap.at ?? 0.6)) * 3);
    if (ia >= 0 && ib >= 0 && k > 0) {
      const ya = y + headH + ia * rh + rh / 2, yb = y + headH + ib * rh + rh / 2; const yb2 = lerp(ya, yb, k); const bx = 118;
      g.save(); g.strokeStyle = "#ffd84a"; g.lineWidth = 6; g.lineCap = "round"; g.shadowColor = "#ffd84a"; g.shadowBlur = 16;
      g.beginPath(); g.moveTo(bx + 18, ya); g.lineTo(bx, ya); g.lineTo(bx, yb2); if (k > 0.95) g.lineTo(bx + 18, yb); g.stroke(); g.restore();
      const q = pop((t - dur * (s.gap.at ?? 0.6) - 0.25) * 3); if (q > 0) {
        const label = String(s.gap.label || "").toUpperCase(); g.save(); g.translate(bx - 24, (ya + yb) / 2); g.rotate(-Math.PI / 2); g.scale(q, q); g.font = FONT.anton(40); const lw = Math.max(Math.abs(yb - ya) - 10, g.measureText(label).width + 40);
        g.fillStyle = "#ffd84a"; rr(g, -lw / 2, -26, lw, 52, 26); g.fill(); T(g, label, 0, 15, 40, { color: "#0b1020" }); g.restore();
      }
    }
  }
};

// ════════ bars: a ranked bar chart ════════
S.bars = (g, t, dur, s) => {
  studio(g, t, { c1: "#22c55e" });
  const top = Math.max(header(g, t, s.kicker || "", s.title, { size: 84 }) + 30, 470);
  const items = (s.items || []).slice(0, 7); const n = items.length; const max = s.max || Math.max(...items.map((i) => +i.value || 0), 1);
  const rh = Math.min(230, (BOT - top) / Math.max(1, n)); const bx = 200, bw = 740;
  items.forEach((it, i) => {
    const at = reveal(i, n, dur, 0.1, 0.5); const k = ez((t - at) * 1.6); if (k <= 0) return;
    const y = top + i * rh; const cy = y + rh / 2 + 10;
    const col = it.hl ? "#ffd84a" : it.club ? glowOf(club(it.club).c1) : it.person ? glowOf(colourOf(it.person)) : "#38bdf8";
    g.save(); g.globalAlpha = cl(k * 2);
    if (it.person) portrait(g, it.person, 120, cy, rh * 0.36); else if (it.club) crest(g, it.club, 120, cy, rh * 0.34);
    else T(g, String(i + 1), 120, cy + 24, 70, { color: col });
    T(g, String(it.label || "").toUpperCase(), bx, cy - Math.min(78, rh * 0.38) / 2 - 8, Math.min(44, rh * 0.26), { align: "left", font: "Inter", weight: 900, spacing: 1, color: it.hl ? "#ffd84a" : "rgba(255,255,255,.85)", maxW: bw });
    const bh = Math.min(78, rh * 0.38), len = Math.max(8, bw * (+it.value || 0) / max * k);
    g.fillStyle = "rgba(255,255,255,.07)"; rr(g, bx, cy - bh / 2 + 8, bw, bh, bh / 2); g.fill();
    const gr = g.createLinearGradient(bx, 0, bx + len, 0); gr.addColorStop(0, shadeC(col, 0.6)); gr.addColorStop(1, col);
    g.save(); g.shadowColor = rgba(col, 0.7); g.shadowBlur = it.hl ? 30 : 12; g.fillStyle = gr; rr(g, bx, cy - bh / 2 + 8, len, bh, bh / 2); g.fill(); g.restore();
    const vtxt = count(it.value, k) + (s.unit ? " " + s.unit : "");
    const inside = len > 260; T(g, vtxt, inside ? bx + len - 20 : bx + len + 16, cy + 8 + bh * 0.3, bh * 0.82, { align: inside ? "right" : "left", color: inside ? "#0b1020" : "#fff", maxW: 260 });
    g.restore();
  });
  if (s.note) T(g, s.note, 60, BOT - 4, 30, { align: "left", font: "Inter", weight: 600, color: "rgba(255,255,255,.6)", alpha: ez((t - 1) * 2) });
};

// ════════ line: a line graph over time ════════
S.line = (g, t, dur, s) => {
  studio(g, t, { c1: "#0ea5e9" });
  const top = Math.max(header(g, t, s.kicker || "", s.title, { size: 84 }) + 30, 470);
  const series = (s.series || []).slice(0, 3); const xs = s.x || (series[0]?.values || []).map((_, i) => String(i + 1));
  const all = series.flatMap((se) => se.values.filter((v) => v != null));
  let lo = s.y?.min ?? Math.min(0, ...all), hi = s.y?.max ?? Math.max(...all) * 1.12;
  const cx = 60, cw = 960, cy = top, ch = BOT - top; card(g, cx, cy, cw, ch, "#0ea5e9", 28, 0.2);
  const px = cx + 110, pw = cw - 170, py = cy + 150, ph = ch - 250;
  const X = (i) => px + pw * (xs.length <= 1 ? 0.5 : i / (xs.length - 1)), Y = (v) => py + ph - ph * (v - lo) / (hi - lo || 1);
  // legend
  let lx = cx + 40; series.forEach((se) => { const col = se.color || (se.club ? glowOf(club(se.club).c1) : "#38bdf8"); g.fillStyle = col; rr(g, lx, cy + 34, 30, 10, 5); g.fill(); T(g, se.name || "", lx + 42, cy + 48, 28, { align: "left", font: "Inter", weight: 800, color: "#fff" }); g.save(); g.font = FONT.inter(28, 800); lx += g.measureText(se.name || "").width + 90; g.restore(); });
  if (s.y?.label) { g.save(); g.translate(cx + 36, py + ph / 2); g.rotate(-Math.PI / 2); T(g, s.y.label.toUpperCase(), 0, 0, 24, { font: "Inter", weight: 900, spacing: 3, color: "rgba(255,255,255,.55)" }); g.restore(); }
  // grid
  const ticks = 4; for (let i = 0; i <= ticks; i++) { const v = lo + (hi - lo) * i / ticks, yy = Y(v); g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(px, yy, pw, 2); T(g, String(Math.round(v)), px - 20, yy + 10, 26, { align: "right", font: "Inter", weight: 700, color: "rgba(255,255,255,.5)" }); }
  const step = Math.ceil(xs.length / 7); xs.forEach((l, i) => { if (i % step && i !== xs.length - 1) return; T(g, l, X(i), py + ph + 46, 26, { font: "Inter", weight: 700, color: "rgba(255,255,255,.6)" }); });
  const prog = cl((t - 0.3) / Math.max(0.8, dur * 0.6));
  series.forEach((se, si) => {
    const col = se.color || (se.club ? glowOf(club(se.club).c1) : ["#38bdf8", "#ffd84a", "#f472b6"][si]); const vals = se.values; const last = (vals.length - 1) * prog;
    const pts = []; for (let i = 0; i <= Math.floor(last); i++) if (vals[i] != null) pts.push([X(i), Y(vals[i])]);
    const fi = Math.floor(last); if (fi < vals.length - 1 && vals[fi] != null && vals[fi + 1] != null) { const f = last - fi; pts.push([lerp(X(fi), X(fi + 1), f), lerp(Y(vals[fi]), Y(vals[fi + 1]), f)]); }
    if (pts.length < 1) return;
    if (series.length === 1) { const ar = g.createLinearGradient(0, py, 0, py + ph); ar.addColorStop(0, rgba(col, 0.35)); ar.addColorStop(1, rgba(col, 0)); g.fillStyle = ar; g.beginPath(); g.moveTo(pts[0][0], py + ph); pts.forEach(([a, b]) => g.lineTo(a, b)); g.lineTo(pts[pts.length - 1][0], py + ph); g.fill(); }
    g.save(); g.strokeStyle = col; g.lineWidth = 9; g.lineJoin = "round"; g.lineCap = "round"; g.shadowColor = col; g.shadowBlur = 16; g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.stroke(); g.restore();
    for (let i = 0; i <= fi; i++) if (vals[i] != null) { g.fillStyle = "#0b1020"; g.beginPath(); g.arc(X(i), Y(vals[i]), 8, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(X(i), Y(vals[i]), 5, 0, 7); g.fill(); }
    const [hx, hy] = pts[pts.length - 1]; g.fillStyle = "#fff"; g.beginPath(); g.arc(hx, hy, 13, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(hx, hy, 8, 0, 7); g.fill();
    const cur = vals[Math.min(vals.length - 1, Math.round(last))]; if (cur != null) { g.font = FONT.anton(40); const tw = g.measureText(String(cur)).width + 26; const bxx = Math.min(hx + 18, px + pw - tw + 40); g.fillStyle = col; rr(g, bxx, hy - 62, tw, 50, 10); g.fill(); T(g, String(cur), bxx + tw / 2, hy - 22, 40, { color: lum(col.startsWith("#") ? col : "#888888") > 0.6 ? "#0b1020" : "#fff" }); }
  });
  (s.notes || []).forEach((nt) => {
    const k = ez((t - 0.3 - (nt.i / Math.max(1, xs.length - 1)) * Math.max(0.8, dur * 0.6)) * 3); if (k <= 0) return; const se = series[nt.series || 0]; const v = se.values[nt.i];
    const ax = X(nt.i), ay = Math.max(Y(v), py + 170); g.save(); g.globalAlpha = k; g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 3; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(ax, ay - 20); g.lineTo(ax, ay - 110); g.stroke(); g.setLineDash([]);
    g.font = FONT.inter(28, 900); const tw = g.measureText(nt.text).width + 30; const bxx = Math.max(px - 40, Math.min(ax - tw / 2, px + pw - tw + 30)); g.fillStyle = "#fff"; rr(g, bxx, ay - 160, tw, 50, 10); g.fill(); T(g, nt.text, bxx + tw / 2, ay - 124, 28, { font: "Inter", weight: 900, color: "#0b1020" }); g.restore();
  });
};

// ════════ compare: two players head to head ════════
S.compare = (g, t, dur, s) => {
  const L = s.left || {}, R = s.right || {}; const lc = glowOf(L.person ? colourOf(L.person) : club(L.club).c1), rc = glowOf(R.person ? colourOf(R.person) : club(R.club).c1);
  studio(g, t, { c1: lc, c2: rc });
  if (s.title) T(g, String(s.title).toUpperCase(), 540, 290, 80, { color: "#fff", shadow: 20, maxW: 960, alpha: ez(t * 3) });
  const a = pop((t - 0.1) * 2.5), b = pop((t - 0.25) * 2.5);
  const head = (o, x, k, col) => {
    g.save(); g.translate(x, 470); g.scale(k, k);
    if (o.person) portrait(g, o.person, 0, 0, 120, { mood: "happy", ring: col }); else if (o.club) crest(g, o.club, 0, 0, 110);
    const cid = o.club || (o.person ? teamOf(personSpec(o.person)?.raw || {}) : ""); if (cid && o.person) crest(g, cid, 100, 80, 38);
    g.restore();
    T(g, String(o.name || surname(o.person) || club(o.club).name).toUpperCase(), x, 660, 54, { color: "#fff", maxW: 420, alpha: ez((t - 0.3) * 3) });
    if (o.sub) T(g, String(o.sub).toUpperCase(), x, 702, 28, { font: "Inter", weight: 900, spacing: 2, color: col, maxW: 420, alpha: ez((t - 0.3) * 3) });
  };
  head(L, 250, a, lc); head(R, 830, b, rc);
  T(g, "VS", 540, 500, 90, { italic: true, color: "#ffd84a", stroke: 10, alpha: ez((t - 0.3) * 3) });
  const rows = (s.rows || []).slice(0, 6); const n = rows.length; const top = 760, rh = Math.min(160, (BOT - top) / Math.max(1, n)); const half = 370;
  rows.forEach((r, i) => {
    const at = reveal(i, n, dur, 0.25, 0.65); const k = ez((t - at) * 2); if (k <= 0) return;
    const y = top + i * rh; const lv = parseFloat(String(r.l).replace(/[^0-9.\-]/g, "")) || 0, rv = parseFloat(String(r.r).replace(/[^0-9.\-]/g, "")) || 0; const mx = Math.max(Math.abs(lv), Math.abs(rv), 1e-9);
    const better = r.better || (r.lower ? (lv < rv ? "l" : rv < lv ? "r" : "") : (lv > rv ? "l" : rv > lv ? "r" : ""));
    g.save(); g.globalAlpha = cl(k * 2);
    T(g, String(r.label || "").toUpperCase(), 540, y + 34, 32, { font: "Inter", weight: 900, spacing: 3, color: "rgba(255,255,255,.7)" });
    const bh = 40, by = y + 52;
    g.fillStyle = "rgba(255,255,255,.07)"; rr(g, 540 - half, by, half - 8, bh, bh / 2); g.fill(); rr(g, 548, by, half - 8, bh, bh / 2); g.fill();
    const lw = (half - 8) * Math.abs(lv) / mx * k, rw = (half - 8) * Math.abs(rv) / mx * k;
    g.save(); g.shadowColor = lc; g.shadowBlur = better === "l" ? 18 : 0; g.fillStyle = better === "l" ? lc : rgba(lc, 0.4); rr(g, 532 - lw, by, lw, bh, bh / 2); g.fill(); g.restore();
    g.save(); g.shadowColor = rc; g.shadowBlur = better === "r" ? 18 : 0; g.fillStyle = better === "r" ? rc : rgba(rc, 0.4); rr(g, 548, by, rw, bh, bh / 2); g.fill(); g.restore();
    T(g, String(r.l), 540 - half - 14, by + 38, 64, { align: "right", color: better === "l" ? "#ffd84a" : "#fff", maxW: 140 });
    T(g, String(r.r), 540 + half + 14, by + 38, 64, { align: "left", color: better === "r" ? "#ffd84a" : "#fff", maxW: 120 });
    g.restore();
  });
};

// ════════ badge: a club's real badge, big ════════
S.badge = (g, t, dur, s) => {
  const ids = s.clubs || [s.club]; const c = club(ids[0]);
  studio(g, t, { c1: c.c1, c2: c.c2 === "#ffffff" ? c.c1 : c.c2 });
  if (ids.length === 1) {
    rays(g, 540, 720, t, rgba(glowOf(c.c1), 0.10), 20);
    const k = pop(t * 2.2); const gl = g.createRadialGradient(540, 720, 0, 540, 720, 420); gl.addColorStop(0, rgba(glowOf(c.c1), 0.45)); gl.addColorStop(1, rgba(glowOf(c.c1), 0)); g.fillStyle = gl; g.fillRect(0, 300, W, 900);
    g.save(); g.translate(540, 720 + Math.sin(t * 2) * 8); g.scale(k, k); g.rotate((1 - ez(t * 2)) * -0.3); crest(g, ids[0], 0, 0, 290); g.restore();
    if (s.kicker) T(g, String(s.kicker).toUpperCase(), 540, 300, 34, { font: "Inter", weight: 900, spacing: 5, color: "#ffd84a", alpha: ez(t * 3) });
    T(g, String(s.title || c.name).toUpperCase(), 540, 1130, 110, { color: "#fff", stroke: 12, shadow: 30, maxW: 940, alpha: ez((t - 0.3) * 3) });
    if (s.sub) T(g, String(s.sub).toUpperCase(), 540, 1200, 36, { font: "Inter", weight: 900, spacing: 3, color: "rgba(255,255,255,.85)", maxW: 900, alpha: ez((t - 0.5) * 3) });
  } else {
    const y0 = Math.max(header(g, t, s.kicker || "", s.title, { size: 84 }) + 40, 480);
    const n = ids.length, per = n <= 4 ? 2 : 3, rows = Math.ceil(n / per), cw = 960 / per, chh = Math.min(330, (BOT - y0) / rows);
    ids.forEach((id, i) => { const k = pop((t - reveal(i, n, dur, 0.1, 0.5)) * 3); if (k <= 0) return; const x = 60 + cw * (i % per + 0.5), y = y0 + chh * (Math.floor(i / per) + 0.45); g.save(); g.translate(x, y); g.scale(k, k); crest(g, id, 0, 0, Math.min(cw, chh) * 0.32); g.restore(); T(g, String(club(id).name).toUpperCase(), x, y + Math.min(cw, chh) * 0.32 + 52, 36, { color: "#fff", maxW: cw - 20, alpha: cl(k) }); });
  }
};

// ════════ gameclip: Knowitball's own match footage (gamecap frames) ════════
S.gameclip = async (g, t, dur, s) => {
  const files = s.frames || []; const fps = s.fps || 30; const from = s.from || 0;
  g.fillStyle = "#0b1022"; g.fillRect(0, 0, W, H);
  if (files.length) {
    const speed = s.speed || 1; let idx = Math.floor((from + t * speed) * fps); idx = Math.max(0, Math.min(files.length - 1, idx));
    const im = await loadImg("file://" + files[idx]);
    if (im) { const k = Math.max(W / im.width, H / im.height); const w = im.width * k, h = im.height * k; g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); }
  }
  const goal = s.goalAt != null ? (s.goalAt - from) / (s.speed || 1) : null;
  const capAt = goal != null ? goal + 0.25 : 0.4;
  if (goal != null && t >= goal && t - goal < 0.12) { g.fillStyle = "rgba(255,255,255,.45)"; g.fillRect(0, 0, W, H); }
  if (s.popup && t >= (goal ?? 0.3)) scorePop(g, t - (goal ?? 0.3), s.popup);
  if (s.caption && t >= capAt) { const q = pop((t - capAt) / 0.25); g.save(); g.translate(510, 1160); g.scale(q, q); T(g, String(s.caption).toUpperCase(), 0, 0, 120, { italic: true, color: window.SC.COL[s.captionColor] || s.captionColor || "#fff", stroke: 18, maxW: 900 }); g.restore(); }
};
// the scoreboard pop-up from the Who would win? goals: GOAL tab, teams, score, scorer line
function scorePop(g, t, p) {
  const k = ez(t * 5); const y = 210 - (1 - k) * 160; g.save(); g.globalAlpha = cl(k * 1.4);
  const x = 90, w = 900;
  g.fillStyle = "#ffd23f"; rr(g, 540 - 70, y - 34, 140, 40, 8); g.fill(); T(g, "GOAL", 540, y - 4, 28, { font: "Inter", weight: 900, spacing: 4, color: "#0b1022" });
  const gr = g.createLinearGradient(0, y, 0, y + 92); gr.addColorStop(0, "#1b2238"); gr.addColorStop(1, "#0a0e1c"); g.fillStyle = gr; rr(g, x, y, w, 92, 12); g.fill();
  g.strokeStyle = "rgba(255,255,255,.15)"; g.lineWidth = 2; rr(g, x, y, w, 92, 12); g.stroke();
  const hn = String(p.homeName || club(p.home).name || "").toUpperCase(), an = String(p.awayName || club(p.away).name || "").toUpperCase();
  if (p.home) crest(g, p.home, x + 50, y + 46, 30); if (p.away) crest(g, p.away, x + w - 50, y + 46, 30);
  T(g, hn, x + 96, y + 60, 38, { align: "left", font: "Inter", weight: 900, color: "#fff", maxW: 250 });
  T(g, an, x + w - 96, y + 60, 38, { align: "right", font: "Inter", weight: 900, color: "#fff", maxW: 250 });
  g.fillStyle = "#ffffff"; rr(g, 540 - 95, y + 12, 190, 68, 10); g.fill();
  const flip = t < 0.35 ? (p.hs0 ?? p.hs) : p.hs, flipA = t < 0.35 ? (p.as0 ?? p.as) : p.as;
  T(g, `${flip ?? ""} - ${flipA ?? ""}`, 540, y + 66, 54, { color: "#0b1022" });
  if (p.scorer) { const line = `GOAL  ${String(p.scorer).toUpperCase()}${p.assist ? "   ASSIST  " + String(p.assist).toUpperCase() : ""}`; g.fillStyle = "rgba(10,14,28,.85)"; rr(g, x + 120, y + 92, w - 240, 50, 8); g.fill(); T(g, line, 540, y + 127, 28, { font: "Inter", weight: 900, spacing: 2, color: "#ffd23f", maxW: w - 280 }); }
  g.restore();
}
})();
