// Who would win? template copy (tools/video-factory/ww). Flat cartoon avatars, head and chest in a circle, drawn from each player's photo by eye.
// skin: tone; hair: style + colour; beard: none | stubble | goatee | short | full.
const SKIN = { light: "#f3cfb3", pink: "#f0c2a6", olive: "#d9a57e", tan: "#c58b62", brown: "#93603e", dark: "#6a412a", deep: "#4f3020" };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

// window.PLAYERS is filled from match.json by edit.html. Each player: { name, full, num, skin, hair: [style, colour],
// beard, beardCol?, gk?, suit?: { jacket, tie }, photoImg? (a loaded photo: drawn in the disc instead of the cartoon) }.
window.PLAYERS = {};

// kit: { shirt, trim, collar, pattern? }  gk players get kit.gk instead.
window.drawAvatar = function (g, cx, cy, r, p, kit, opts = {}) {
  const k = p.gk ? kit.gk : kit;
  const skin = SKIN[p.skin], dark = shade(skin, 0.82), [style, hc] = p.hair;
  g.save();
  // the disc
  if (!opts.noDisc) {
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.closePath();
  const bg = g.createLinearGradient(0, cy - r, 0, cy + r); bg.addColorStop(0, opts.bgTop || "#2b3550"); bg.addColorStop(1, opts.bgBot || "#141a2c");
  g.fillStyle = bg; g.fill(); g.clip(); }
  if (p.photoImg && !opts.noDisc && !opts.noPhoto) { // cover-fit, the face a little above centre
    const im = p.photoImg, sc = (2 * r) / Math.min(im.width, im.height); const w = im.width * sc, h = im.height * sc;
    g.drawImage(im, cx - w / 2, cy - r - (h - 2 * r) * 0.15, w, h); g.restore();
    g.save(); g.lineWidth = Math.max(2, r * 0.06); g.strokeStyle = opts.ring || "rgba(255,255,255,.85)"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.restore(); return;
  }
  const s = r / 100; g.translate(cx, cy); g.scale(s, s); g.translate(0, 12); g.scale(1.22, 1.22);
  // shoulders and shirt (a manager wears a suit)
  if (p.suit) {
    g.fillStyle = p.suit.jacket; g.beginPath(); g.moveTo(-96, 110); g.bezierCurveTo(-92, 58, -60, 44, -30, 40); g.lineTo(30, 40); g.bezierCurveTo(60, 44, 92, 58, 96, 110); g.closePath(); g.fill();
    g.fillStyle = "#f4f4f4"; g.beginPath(); g.moveTo(-22, 40); g.lineTo(22, 40); g.lineTo(0, 100); g.closePath(); g.fill();
    g.fillStyle = p.suit.tie; g.beginPath(); g.moveTo(-6, 48); g.lineTo(6, 48); g.lineTo(9, 92); g.lineTo(0, 102); g.lineTo(-9, 92); g.closePath(); g.fill();
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 3; g.beginPath(); g.moveTo(-24, 40); g.lineTo(-6, 104); g.moveTo(24, 40); g.lineTo(6, 104); g.stroke();
  } else {
  g.fillStyle = k.shirt; g.beginPath(); g.moveTo(-96, 110); g.bezierCurveTo(-92, 58, -60, 44, -30, 40); g.lineTo(30, 40); g.bezierCurveTo(60, 44, 92, 58, 96, 110); g.closePath(); g.fill();
  if (k.pattern) { g.save(); g.clip(); // the pattern is part of the shirt, never loose lines over the shoulders
  const pc = k.patternCol || k.trim;
  if (k.pattern === "sides") { g.fillStyle = pc; g.fillRect(-96, 70, 12, 40); g.fillRect(84, 70, 12, 40); }
  if (k.pattern === "hoops") { g.fillStyle = pc; g.fillRect(-100, 58, 200, 9); g.fillRect(-100, 76, 200, 9); g.fillRect(-100, 94, 200, 9); }
  if (k.pattern === "stripes") { g.fillStyle = pc; for (let x = -88; x < 100; x += 32) g.fillRect(x, 36, 14, 80); }
  if (k.pattern === "halves") { g.fillStyle = pc; g.fillRect(0, 36, 100, 80); }
  if (k.pattern === "band") { g.fillStyle = k.band[0]; g.fillRect(-100, 66, 200, 11); g.fillStyle = k.band[1]; g.fillRect(-100, 77, 200, 11); }
  if (k.pattern === "sash") { g.fillStyle = pc; g.beginPath(); g.moveTo(-70, 48); g.lineTo(-50, 44); g.lineTo(60, 110); g.lineTo(36, 110); g.closePath(); g.fill(); }
  g.restore(); }
  }
  // neck
  g.fillStyle = dark; g.beginPath(); g.moveTo(-17, 18); g.lineTo(17, 18); g.lineTo(20, 46); g.quadraticCurveTo(0, 56, -20, 46); g.closePath(); g.fill();
  // collar
  if (!p.suit) {
  g.strokeStyle = k.collar || k.trim; g.lineWidth = 7; g.lineCap = "round";
  g.beginPath(); g.moveTo(-24, 40); g.quadraticCurveTo(0, 62, 24, 40); g.stroke(); }
  // shirt number dot / you star
  if (opts.number) { g.fillStyle = k.trim; g.font = "bold 22px Anton, sans-serif"; g.textAlign = "center"; g.fillText(String(p.num), 52, 96); }
  // back hair (long)
  if (style === "locs") { g.fillStyle = hc; for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) { const x = sd * (24 + i * 5.5); g.beginPath(); g.roundRect(x - 3.5, -44 + i * 2, 7, 70 + i * 4, 3.5); g.fill(); } }
  // ears
  g.fillStyle = skin; g.beginPath(); g.ellipse(-36, -6, 8, 11, 0, 0, 7); g.ellipse(36, -6, 8, 11, 0, 0, 7); g.fill();
  // head
  g.fillStyle = skin; g.beginPath(); g.ellipse(0, -8, 34, 40, 0, 0, 7); g.fill();
  // beard
  const bc = p.beardCol || hc;
  if (p.beard === "full" || p.beard === "short") {
    g.fillStyle = bc; g.globalAlpha = p.beard === "full" ? 1 : 0.85; g.beginPath();
    g.moveTo(-34, -6); g.quadraticCurveTo(-34, p.beard === "full" ? 40 : 30, 0, p.beard === "full" ? 40 : 33); g.quadraticCurveTo(34, p.beard === "full" ? 40 : 30, 34, -6);
    g.lineTo(28, -4); g.quadraticCurveTo(24, 16, 12, 12); g.quadraticCurveTo(0, 8, -12, 12); g.quadraticCurveTo(-24, 16, -28, -4); g.closePath(); g.fill(); g.globalAlpha = 1;
    g.fillStyle = skin; g.beginPath(); g.ellipse(0, 17, 10, 5, 0, 0, 7); g.fill(); // around the mouth
  } else if (p.beard === "stubble") { g.fillStyle = bc; g.globalAlpha = 0.22; g.beginPath(); g.moveTo(-32, 4); g.quadraticCurveTo(-30, 34, 0, 33); g.quadraticCurveTo(30, 34, 32, 4); g.quadraticCurveTo(0, 14, -32, 4); g.fill(); g.globalAlpha = 1; }
  else if (p.beard === "goatee") { g.fillStyle = bc; g.beginPath(); g.ellipse(0, 26, 9, 8, 0, 0, 7); g.fill(); g.fillRect(-12, 9, 24, 4); }
  // hair on top
  g.fillStyle = hc;
  const cap = (top, side) => { g.beginPath(); g.moveTo(-35, side); g.quadraticCurveTo(-38, top - 6, 0, top); g.quadraticCurveTo(38, top - 6, 35, side); g.quadraticCurveTo(24, -36, 0, -34); g.quadraticCurveTo(-24, -36, -35, side); g.fill(); };
  if (style === "buzz") { g.globalAlpha = 0.9; cap(-50, -16); g.globalAlpha = 1; }
  else if (style === "crop") cap(-56, -14);
  else if (style === "side") { cap(-56, -12); g.beginPath(); g.moveTo(-30, -36); g.quadraticCurveTo(0, -60, 34, -40); g.lineTo(32, -30); g.quadraticCurveTo(4, -44, -24, -28); g.fill(); }
  else if (style === "quiff") { cap(-54, -14); g.beginPath(); g.moveTo(-24, -42); g.quadraticCurveTo(-6, -72, 26, -50); g.quadraticCurveTo(12, -40, -24, -42); g.fill(); }
  else if (style === "slick") { cap(-58, -10); g.beginPath(); g.ellipse(4, -50, 30, 14, -0.15, 0, 7); g.fill(); }
  else if (style === "messy") { cap(-56, -8); for (const [x, y, rr] of [[-26, -42, 12], [-8, -54, 13], [12, -54, 13], [28, -40, 11], [-34, -26, 9], [34, -24, 9]]) { g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); } }
  else if (style === "curlytop") { cap(-50, -16); for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-26 + i * 6.5, -52 - Math.sin(i / 8 * Math.PI) * 8, 9, 0, 7); g.fill(); } }
  else if (style === "locs") { cap(-52, -10); g.strokeStyle = shade(hc === "#000" ? "#333333" : "#3a2c24", 1); g.lineWidth = 2; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 9, -54); g.quadraticCurveTo(i * 12, -40, i * 13, -26); g.stroke(); } }
  // bald shine
  if (style === "bald") { g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.ellipse(-10, -36, 12, 6, -0.4, 0, 7); g.fill(); }
  // brows
  g.strokeStyle = style === "bald" ? "#1a1210" : shade(hc === "#000" ? "#222222" : hc, 0.8); g.lineWidth = 5;
  g.beginPath(); g.moveTo(-22, -20); g.lineTo(-8, -22); g.moveTo(8, -22); g.lineTo(22, -20); g.stroke();
  // eyes
  for (const x of [-14, 14]) { g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x, -9, 7, 5.5, 0, 0, 7); g.fill(); g.fillStyle = "#1c1410"; g.beginPath(); g.arc(x + 0.5, -8.5, 3.6, 0, 7); g.fill(); }
  // nose and mouth
  g.strokeStyle = dark; g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(-5, 6, 1, 7); g.stroke();
  g.strokeStyle = "#5a2a22"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(-9, 16); g.quadraticCurveTo(0, 22, 9, 16); g.stroke();
  g.restore();
  // ring
  if (opts.noDisc) return;
  g.save(); g.lineWidth = Math.max(2, r * 0.06); g.strokeStyle = opts.ring || "rgba(255,255,255,.85)"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.restore();
};

// The Knowitball end-card face and its kit: fixed, identical in every Who would win? video (the approved United v Roma end card).
window.END_CARD_FACE = { name: "YOU", full: "You", pos: "ST", num: 9, skin: "light", hair: ["side", "#6b4a2e"], beard: "none", you: true };
window.END_CARD_KIT = { shirt: "#d81e2c", trim: "#ffffff", collar: "#111111", gk: { shirt: "#e8e04a", trim: "#1a1a1a", collar: "#1a1a1a" } };
