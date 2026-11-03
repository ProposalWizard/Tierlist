// Flat cartoon avatars, head and chest in a circle, drawn from each player's photo by eye.
// skin: tone; hair: style + colour; beard: none | stubble | goatee | short | full.
const SKIN = { light: "#f3cfb3", pink: "#f0c2a6", olive: "#d9a57e", tan: "#c58b62", brown: "#93603e", dark: "#6a412a", deep: "#4f3020" };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

window.PLAYERS = {
  narr:      { name: "", full: "Narrator", pos: "", skin: "light", hair: ["tidy", "#5b3f29"], beard: "stubble", beardCol: "#4a3322" },
  cruyff:    { name: "CRUYFF", full: "Johan Cruyff", pos: "ST", num: 14, skin: "light", hair: ["side", "#6b4a2e"], beard: "none" },
  vanbasten: { name: "VAN BASTEN", full: "Marco van Basten", pos: "ST", num: 9, skin: "light", hair: ["messy", "#7a5634"], beard: "none" },
  koeman:    { name: "KOEMAN", full: "Ronald Koeman", pos: "CB", num: 4, skin: "pink", hair: ["crop", "#e2c27a"], beard: "none" },
  rijkaard:  { name: "RIJKAARD", full: "Frank Rijkaard", pos: "CM", num: 3, skin: "brown", hair: ["curlytop", "#120e0c"], beard: "goatee" },
  board1:    { name: "", full: "Board", pos: "", skin: "light", hair: ["bald", "#000"], beard: "none", suit: { jacket: "#2a2d36", tie: "#c8102e" } },
  board2:    { name: "", full: "Board", pos: "", skin: "pink", hair: ["side", "#9a9a9a"], beard: "none", suit: { jacket: "#23262e", tie: "#1c2c5b" } },
  board3:    { name: "", full: "Board", pos: "", skin: "light", hair: ["crop", "#bdbdbd"], beard: "stubble", suit: { jacket: "#30333c", tie: "#c8102e" } },
  mate1:     { name: "", full: "Team-mate", pos: "", skin: "light", hair: ["crop", "#d8b06a"], beard: "none" },
  mate2:     { name: "", full: "Team-mate", pos: "", skin: "tan", hair: ["messy", "#1e1612"], beard: "stubble" },
  mate3:     { name: "", full: "Team-mate", pos: "", skin: "light", hair: ["quiff", "#5a3e28"], beard: "short", beardCol: "#5a3e28" },
  // Manchester United (home kit)
  lammens:   { name: "LAMMENS", full: "Senne Lammens", pos: "GK", num: 31, skin: "light", hair: ["messy", "#3b2a1e"], beard: "stubble", gk: true },
  mazraoui:  { name: "MAZRAOUI", full: "Noussair Mazraoui", pos: "RB", num: 3, skin: "tan", hair: ["curlytop", "#151010"], beard: "full" },
  deligt:    { name: "DE LIGT", full: "Matthijs de Ligt", pos: "CB", num: 4, skin: "pink", hair: ["crop", "#d9a65a"], beard: "stubble" },
  martinez:  { name: "MARTÍNEZ", full: "Lisandro Martínez", pos: "CB", num: 6, skin: "olive", hair: ["slick", "#141010"], beard: "none" },
  shaw:      { name: "SHAW", full: "Luke Shaw", pos: "LB", num: 23, skin: "light", hair: ["quiff", "#8a6440"], beard: "short", beardCol: "#7a5634" },
  baleba:    { name: "BALEBA", full: "Carlos Baleba", pos: "CM", num: 18, skin: "deep", hair: ["curlytop", "#0d0a09"], beard: "none" },
  tielemans: { name: "TIELEMANS", full: "Youri Tielemans", pos: "CM", num: 8, skin: "tan", hair: ["buzz", "#121010"], beard: "goatee" },
  mbeumo:    { name: "MBEUMO", full: "Bryan Mbeumo", pos: "RW", num: 19, skin: "brown", hair: ["bald", "#000"], beard: "full" },
  bruno:     { name: "BRUNO", full: "Bruno Fernandes", pos: "CAM", num: 10, skin: "olive", hair: ["crop", "#2a1d15"], beard: "full" },
  cunha:     { name: "CUNHA", full: "Matheus Cunha", pos: "LW", num: 11, skin: "brown", hair: ["curlytop", "#110d0b"], beard: "full" },
  dalot:     { name: "DALOT", full: "Diogo Dalot", pos: "RB", num: 2, skin: "olive", hair: ["crop", "#1d1512"], beard: "short" },
  carrick:   { name: "CARRICK", full: "Michael Carrick", pos: "MGR", skin: "light", hair: ["crop", "#6b5440"], beard: "stubble", suit: { jacket: "#1f2533", tie: "#c8102e" } },
  kompany:   { name: "KOMPANY", full: "Vincent Kompany", pos: "MGR", skin: "brown", hair: ["bald", "#000"], beard: "full", beardCol: "#2a2220", suit: { jacket: "#20222a", tie: "#13274f" } },
  sesko:     { name: "ŠEŠKO", full: "Benjamin Šeško", pos: "ST", num: 30, skin: "light", hair: ["crop", "#6e5236"], beard: "stubble" },
  // Liverpool (home kit)
  isak:        { name: "ISAK", full: "Alexander Isak", pos: "ST", num: 9, skin: "brown", hair: ["buzz", "#100c0a"], beard: "goatee" },
  vandijk:     { name: "VAN DIJK", full: "Virgil van Dijk", pos: "CB", num: 4, skin: "tan", hair: ["buzz", "#120e0c"], beard: "goatee" },
  wirtz:       { name: "WIRTZ", full: "Florian Wirtz", pos: "CAM", num: 7, skin: "light", hair: ["crop", "#8a6a4a"], beard: "none" },
  szoboszlai:  { name: "SZOBOSZLAI", full: "Dominik Szoboszlai", pos: "RW", num: 8, skin: "light", hair: ["messy", "#3a281c"], beard: "short", beardCol: "#3a281c" },
  gravenberch: { name: "GRAVENBERCH", full: "Ryan Gravenberch", pos: "CM", num: 38, skin: "brown", hair: ["curlytop", "#0f0b09"], beard: "goatee" },
  macallister: { name: "MAC ALLISTER", full: "Alexis Mac Allister", pos: "CM", num: 10, skin: "light", hair: ["quiff", "#8f6a45"], beard: "short", beardCol: "#8a5a34" },
  barcola:     { name: "BARCOLA", full: "Bradley Barcola", pos: "LW", num: 11, skin: "brown", hair: ["locs", "#110d0b"], beard: "goatee" },
  frimpong:    { name: "FRIMPONG", full: "Jeremie Frimpong", pos: "RB", num: 30, skin: "dark", hair: ["locs", "#0d0a09"], beard: "none" },
  kerkez:      { name: "KERKEZ", full: "Milos Kerkez", pos: "LB", num: 6, skin: "light", hair: ["crop", "#3b2a1e"], beard: "none" },
  araujo:      { name: "ARAUJO", full: "Ronald Araujo", pos: "CB", num: 5, skin: "tan", hair: ["curlytop", "#c9a35a"], beard: "goatee", beardCol: "#1a1210" },
  alisson:     { name: "ALISSON", full: "Alisson", pos: "GK", num: 1, skin: "light", hair: ["slick", "#2a1d15"], beard: "full", gk: true },
  iraola:      { name: "IRAOLA", full: "Andoni Iraola", pos: "MGR", skin: "light", hair: ["crop", "#3a2c22"], beard: "stubble", suit: { jacket: "#1c2230", tie: "#8e1426" } },
  // Real Madrid (away kit)
  mbappe:      { name: "MBAPPÉ", full: "Kylian Mbappé", pos: "ST", num: 10, skin: "brown", hair: ["buzz", "#120e0c"], beard: "none" },
  bellingham:  { name: "BELLINGHAM", full: "Jude Bellingham", pos: "CAM", num: 5, skin: "brown", hair: ["curlytop", "#0f0b09"], beard: "none" },
  valverde:    { name: "VALVERDE", full: "Federico Valverde", pos: "CM", num: 8, skin: "light", hair: ["side", "#5a3e28"], beard: "stubble" },
  vinicius:    { name: "VINÍCIUS", full: "Vinícius Júnior", pos: "LW", num: 7, skin: "dark", hair: ["curlytop", "#0d0a09"], beard: "none" },
  cucurella:   { name: "CUCURELLA", full: "Marc Cucurella", pos: "LB", num: 24, skin: "light", hair: ["bigcurl", "#151010"], beard: "full" },
  taa:         { name: "ALEXANDER-ARNOLD", full: "Trent Alexander-Arnold", pos: "RB", num: 12, skin: "tan", hair: ["curlytop", "#0f0b09"], beard: "goatee" },
  rodrygo:     { name: "RODRYGO", full: "Rodrygo", pos: "RW", num: 11, skin: "tan", hair: ["crop", "#0f0b09"], beard: "none" },
  tchouameni:  { name: "TCHOUAMÉNI", full: "Aurélien Tchouaméni", pos: "CM", num: 14, skin: "deep", hair: ["curlytop", "#0b0908"], beard: "none" },
  rudiger:     { name: "RÜDIGER", full: "Antonio Rüdiger", pos: "CB", num: 22, skin: "dark", hair: ["buzz", "#0b0908"], beard: "full" },
  militao:     { name: "MILITÃO", full: "Éder Militão", pos: "CB", num: 3, skin: "brown", hair: ["curlytop", "#100c0a"], beard: "goatee" },
  courtois:    { name: "COURTOIS", full: "Thibaut Courtois", pos: "GK", num: 1, skin: "light", hair: ["slick", "#141010"], beard: "stubble", gk: true },
  mourinho:    { name: "MOURINHO", full: "José Mourinho", pos: "MGR", skin: "light", hair: ["side", "#a9a9a9"], beard: "none", suit: { jacket: "#24262c", tie: "#0f3d2e" } },
  haaland:     { name: "HAALAND", full: "Erling Haaland", pos: "ST", num: 9, skin: "pink", hair: ["slick", "#d9b87a"], beard: "none" },
  dembele:     { name: "DEMBÉLÉ", full: "Ousmane Dembélé", pos: "RW", num: 10, skin: "dark", hair: ["buzz", "#0d0a09"], beard: "goatee" },
  pedri:       { name: "PEDRI", full: "Pedri", pos: "CM", num: 8, skin: "light", hair: ["crop", "#2a1d15"], beard: "stubble" },
  vitinha:     { name: "VITINHA", full: "Vitinha", pos: "CM", num: 17, skin: "light", hair: ["messy", "#1e1612"], beard: "goatee" },
  yamal:       { name: "YAMAL", full: "Lamine Yamal", pos: "RW", num: 10, skin: "tan", hair: ["curlytop", "#0f0b09"], beard: "none" },
  youtux:    { name: "YOU", full: "You", pos: "ST", skin: "light", hair: ["side", "#6b4a2e"], beard: "none", suit: { jacket: "#14151b", tie: "#14151b", bow: true } },
  presenter: { name: "", full: "Presenter", pos: "", skin: "brown", hair: ["curlytop", "#141010"], beard: "none", suit: { jacket: "#1b2233", tie: "#3b6fb5" } },
  rodri:     { name: "RODRI", full: "Rodri", pos: "CM", num: 16, skin: "olive", hair: ["crop", "#1a1210"], beard: "short" },
  you:       { name: "YOU", full: "You", pos: "ST", num: 9, skin: "light", hair: ["side", "#6b4a2e"], beard: "none", you: true },
  // Bayern Munich (away kit)
  neuer:     { name: "NEUER", full: "Manuel Neuer", pos: "GK", num: 1, skin: "light", hair: ["side", "#7a5a3c"], beard: "none", gk: true },
  laimer:    { name: "LAIMER", full: "Konrad Laimer", pos: "RB", num: 27, skin: "pink", hair: ["crop", "#c98a4a"], beard: "short", beardCol: "#b5713a" },
  upamecano: { name: "UPAMECANO", full: "Dayot Upamecano", pos: "CB", num: 2, skin: "dark", hair: ["buzz", "#0d0a09"], beard: "short" },
  tah:       { name: "TAH", full: "Jonathan Tah", pos: "CB", num: 4, skin: "brown", hair: ["buzz", "#0f0c0b"], beard: "full" },
  davies:    { name: "DAVIES", full: "Alphonso Davies", pos: "LB", num: 19, skin: "deep", hair: ["curlytop", "#0b0908"], beard: "short" },
  kimmich:   { name: "KIMMICH", full: "Joshua Kimmich", pos: "CM", num: 6, skin: "light", hair: ["quiff", "#d6ad6b"], beard: "stubble" },
  pavlovic:  { name: "PAVLOVIĆ", full: "Aleksandar Pavlović", pos: "CM", num: 45, skin: "olive", hair: ["curlytop", "#151010"], beard: "goatee" },
  olise:     { name: "OLISE", full: "Michael Olise", pos: "RW", num: 17, skin: "brown", hair: ["locs", "#120e0c"], beard: "goatee" },
  musiala:   { name: "MUSIALA", full: "Jamal Musiala", pos: "CAM", num: 10, skin: "tan", hair: ["curlytop", "#120e0c"], beard: "none" },
  diaz:      { name: "DÍAZ", full: "Luis Díaz", pos: "LW", num: 14, skin: "tan", hair: ["curlytop", "#100c0a"], beard: "goatee" },
  kane:      { name: "KANE", full: "Harry Kane", pos: "ST", num: 9, skin: "light", hair: ["quiff", "#8f6a45"], beard: "short", beardCol: "#7e5a3a" },
};

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
  const s = r / 100; g.translate(cx, cy); g.scale(s, s); g.translate(0, 12); g.scale(1.22, 1.22);
  // shoulders and shirt (a manager wears a suit)
  if (opts.headOnly) {} else if (p.suit) {
    g.fillStyle = p.suit.jacket; g.beginPath(); g.moveTo(-96, 110); g.bezierCurveTo(-92, 58, -60, 44, -30, 40); g.lineTo(30, 40); g.bezierCurveTo(60, 44, 92, 58, 96, 110); g.closePath(); g.fill();
    g.fillStyle = "#f4f4f4"; g.beginPath(); g.moveTo(-22, 40); g.lineTo(22, 40); g.lineTo(0, 100); g.closePath(); g.fill();
    g.fillStyle = p.suit.tie; g.beginPath();
    if (p.suit.bow) { g.moveTo(0, 54); g.lineTo(-20, 44); g.lineTo(-20, 64); g.closePath(); g.moveTo(0, 54); g.lineTo(20, 44); g.lineTo(20, 64); g.closePath(); g.fill(); g.beginPath(); g.arc(0, 54, 5, 0, 7); }
    else { g.moveTo(-6, 48); g.lineTo(6, 48); g.lineTo(9, 92); g.lineTo(0, 102); g.lineTo(-9, 92); g.closePath(); }
    g.fill();
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 3; g.beginPath(); g.moveTo(-24, 40); g.lineTo(-6, 104); g.moveTo(24, 40); g.lineTo(6, 104); g.stroke();
  } else {
  g.fillStyle = k.shirt; g.beginPath(); g.moveTo(-96, 110); g.bezierCurveTo(-92, 58, -60, 44, -30, 40); g.lineTo(30, 40); g.bezierCurveTo(60, 44, 92, 58, 96, 110); g.closePath(); g.fill();
  if (k.pattern === "sides") { g.fillStyle = k.trim; g.fillRect(-96, 70, 12, 40); g.fillRect(84, 70, 12, 40); }
  if (k.pattern === "stripes") { g.fillStyle = k.trim; for (const x of [-72, -36, 0, 36, 72]) g.fillRect(x - 9, 40, 18, 72); }
  if (k.pattern === "halves") { g.fillStyle = k.trim; g.beginPath(); g.moveTo(0, 40); g.lineTo(30, 40); g.bezierCurveTo(60, 44, 92, 58, 96, 110); g.lineTo(0, 110); g.closePath(); g.fill(); }
  if (k.pattern === "centre") { g.fillStyle = k.trim; g.fillRect(-16, 40, 32, 72); }
  if (k.pattern === "hoops") { g.fillStyle = k.trim; g.fillRect(-100, 76, 200, 8); g.fillRect(-100, 94, 200, 8); }
  if (k.pattern === "sash") { g.fillStyle = k.trim; g.beginPath(); g.moveTo(-70, 48); g.lineTo(-50, 44); g.lineTo(60, 110); g.lineTo(36, 110); g.closePath(); g.fill(); }
  }
  // neck
  g.fillStyle = dark; g.beginPath(); g.moveTo(-17, 18); g.lineTo(17, 18); g.lineTo(20, 46); g.quadraticCurveTo(0, 56, -20, 46); g.closePath(); g.fill();
  // collar
  if (!p.suit && !opts.headOnly) {
  g.strokeStyle = k.collar || k.trim; g.lineWidth = 7; g.lineCap = "round";
  g.beginPath(); g.moveTo(-24, 40); g.quadraticCurveTo(0, 62, 24, 40); g.stroke(); }
  if (opts.chain && !opts.headOnly) { g.strokeStyle = "#d9d9d9"; g.lineWidth = 2; g.beginPath(); g.moveTo(-22, 42); g.quadraticCurveTo(0, 96, 22, 42); g.stroke(); g.fillStyle = "#e6e6e6"; g.fillRect(-2, 84, 4, 12); g.fillRect(-5, 88, 10, 3); }
  // shirt number dot / you star
  if (opts.number) { g.fillStyle = k.trim; g.font = "bold 22px Anton, sans-serif"; g.textAlign = "center"; g.fillText(String(p.num), 52, 96); }
  // back hair (long)
  if (style === "locs") { g.fillStyle = hc; for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) { const x = sd * (24 + i * 5.5); g.beginPath(); g.roundRect(x - 3.5, -44 + i * 2, 7, 70 + i * 4, 3.5); g.fill(); } }
  if (style === "bigcurl") { g.fillStyle = hc; g.beginPath(); g.ellipse(0, -20, 62, 62, 0, 0, 7); g.fill(); }
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
  else if (style === "tidy") {
    cap(-54, -26);
    g.beginPath(); g.moveTo(-30, -36); g.quadraticCurveTo(-22, -66, 8, -64); g.quadraticCurveTo(34, -62, 34, -38); g.quadraticCurveTo(14, -48, -6, -44); g.quadraticCurveTo(-20, -42, -30, -36); g.fill();
    g.strokeStyle = shade(hc, 1.35); g.lineWidth = 2.5; g.lineCap = "round";
    for (const [x0, y0, x1, y1] of [[-14, -48, 10, -60], [-2, -46, 22, -56], [10, -46, 30, -50]]) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y1 - 4, x1, y1); g.stroke(); }
    g.strokeStyle = shade(hc, 0.6); g.lineWidth = 2; g.beginPath(); g.moveTo(-16, -60); g.quadraticCurveTo(-18, -50, -20, -42); g.stroke();
  }
  else if (style === "quiff") { cap(-54, -14); g.beginPath(); g.moveTo(-24, -42); g.quadraticCurveTo(-6, -72, 26, -50); g.quadraticCurveTo(12, -40, -24, -42); g.fill(); }
  else if (style === "slick") { cap(-58, -10); g.beginPath(); g.ellipse(4, -50, 30, 14, -0.15, 0, 7); g.fill(); }
  else if (style === "messy") { cap(-56, -8); for (const [x, y, rr] of [[-26, -42, 12], [-8, -54, 13], [12, -54, 13], [28, -40, 11], [-34, -26, 9], [34, -24, 9]]) { g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); } }
  else if (style === "curlytop") { cap(-50, -16); for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-26 + i * 6.5, -52 - Math.sin(i / 8 * Math.PI) * 8, 9, 0, 7); g.fill(); } }
  else if (style === "bigcurl") { for (const [x, y, rr] of [[-40, -30, 22], [40, -30, 22], [-30, -52, 22], [0, -62, 24], [30, -52, 22], [-46, -4, 18], [46, -4, 18], [-44, 20, 15], [44, 20, 15]]) { g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); } }
  else if (style === "locs") { cap(-52, -10); g.strokeStyle = shade(hc === "#000" ? "#333333" : "#3a2c24", 1); g.lineWidth = 2; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 9, -54); g.quadraticCurveTo(i * 12, -40, i * 13, -26); g.stroke(); } }
  // bald shine
  if (style === "bald") { g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.ellipse(-10, -36, 12, 6, -0.4, 0, 7); g.fill(); }
  // brows
  g.strokeStyle = style === "bald" ? "#1a1210" : shade(hc === "#000" ? "#222222" : hc, 0.8); g.lineWidth = 5;
  const bw = opts.worried ? 4 : 0; g.beginPath(); g.moveTo(-22, -20 + bw); g.lineTo(-8, -22 - bw); g.moveTo(8, -22 - bw); g.lineTo(22, -20 + bw); g.stroke();
  // eyes
  const lx = opts.look || 0, ly = opts.lookY || 0;
  for (const x of [-14, 14]) { if (opts.blink) { g.strokeStyle = "#1c1410"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 6, -8); g.quadraticCurveTo(x, -5, x + 6, -8); g.stroke(); continue; }
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x, -9, 7, 5.5, 0, 0, 7); g.fill(); g.fillStyle = "#1c1410"; g.beginPath(); g.arc(x + 0.5 + lx * 2.5, -8.5 + ly * 2, 3.6, 0, 7); g.fill(); }
  // nose and mouth
  g.strokeStyle = dark; g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(-5, 6, 1, 7); g.stroke();
  const mouth = opts.talk != null ? "talk" : (opts.mouth || "smile");
  if (mouth === "talk") { const o = Math.max(0, Math.min(1, opts.talk)); g.fillStyle = "#4a1f1a"; g.beginPath(); g.ellipse(0, 18, 9 + o * 2, 1.8 + o * 8, 0, 0, 7); g.fill(); if (o > 0.35) { g.fillStyle = "#fff"; g.fillRect(-7, 18 - (1.8 + o * 8) + 1, 14, 3); } }
  else if (mouth === "flat") { g.strokeStyle = "#5a2a22"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(-8, 18); g.lineTo(8, 18); g.stroke(); }
  else if (mouth === "o") { g.fillStyle = "#4a1f1a"; g.beginPath(); g.ellipse(0, 18, 5, 7, 0, 0, 7); g.fill(); }
  else if (mouth === "grin") { g.fillStyle = "#4a1f1a"; g.beginPath(); g.moveTo(-14, 13); g.quadraticCurveTo(0, 30, 14, 13); g.closePath(); g.fill(); g.fillStyle = "#fff"; g.fillRect(-11, 13, 22, 4); }
  else { g.strokeStyle = "#5a2a22"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(-9, 16); g.quadraticCurveTo(0, 22, 9, 16); g.stroke(); }
  g.restore();
  // ring
  if (opts.noDisc) return;
  g.save(); g.lineWidth = Math.max(2, r * 0.06); g.strokeStyle = opts.ring || "rgba(255,255,255,.85)"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.restore();
};

window.KITS = {
  ajax: { shirt: "#f7f7f4", trim: "#d2122e", collar: "#d2122e", pattern: "centre" },
  fey:  { shirt: "#f7f7f4", trim: "#d2122e", collar: "#111111", pattern: "halves" },
  tee:  { shirt: "#121212", trim: "#121212", collar: "#1c1c1c" },
  crew: { shirt: "#1e2b45", trim: "#1e2b45", collar: "#2c3d61" },
  mci: { shirt: "#6cabdd", trim: "#ffffff", collar: "#1c2c5b" },
  rmh: { shirt: "#f5f5f2", trim: "#c9a227", collar: "#1c2c5b" },
  fcbh: { shirt: "#dc052d", trim: "#ffffff", collar: "#ffffff" },
  psg: { shirt: "#0a2240", trim: "#da291c", collar: "#ffffff", pattern: "centre" },
  bar: { shirt: "#a50044", trim: "#004d98", collar: "#edbb00", pattern: "stripes" },
  eng: { shirt: "#ffffff", trim: "#cf142b", collar: "#1c2c5b" },
  lfc: { shirt: "#8e1426", trim: "#ffffff", collar: "#ffffff", gk: { shirt: "#2bb673", trim: "#0b3d2a", collar: "#0b3d2a" } },
  rma: { shirt: "#0f3d2e", trim: "#ede8da", collar: "#ede8da", gk: { shirt: "#e8e04a", trim: "#1a1a1a", collar: "#1a1a1a" } },
  utd: { shirt: "#d81e2c", trim: "#ffffff", collar: "#111111", gk: { shirt: "#e8e04a", trim: "#1a1a1a", collar: "#1a1a1a" } },
  fcb: { shirt: "#f3f3ef", trim: "#13274f", collar: "#13274f", pattern: "sides", gk: { shirt: "#2bb673", trim: "#0b3d2a", collar: "#0b3d2a" } },
};
