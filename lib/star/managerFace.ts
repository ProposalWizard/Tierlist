/**
 * THE MANAGER'S FACE — a drawn head, never a photo.
 *
 * Harry and Mikey, v0.23 review (P72, P90): "I can't say that's the manager …
 * we can make different faces for now" / "it's either a real image or a
 * cartoon that is made for now. We don't have real images of managers' faces
 * anyway. Maybe just base it on an image of them somewhat, to the point where
 * no one could sue us, but it's somewhat right, like skin colour, hair type."
 *
 * So every manager gets a cartoon head that is the SAME every time (it comes
 * from his name) and DIFFERENT from the next man's (skin, hair, grey, beard,
 * glasses, face shape). For the managers we know, the broad strokes follow the
 * real man (skin tone, bald or not, grey or not, beard, glasses) and nothing
 * more: no likeness. Anyone else is hashed to a believable gaffer.
 */

export type ManagerHair = "bald" | "buzz" | "short" | "swept" | "receding" | "curly" | "ring";
export type ManagerBeard = "none" | "stubble" | "short" | "full";

export interface ManagerLook {
  skin: string;
  hair: ManagerHair;
  hairColour: string;
  /** 0 = none, 1 = white. */
  grey: number;
  beard: ManagerBeard;
  glasses: boolean;
  /** Face width, 1 = the game's head. */
  width: number;
  /** Lines on the forehead and cheeks, 0-1. */
  age: number;
}

const SKIN = { pale: "#f1c7a5", fair: "#e8b995", olive: "#d9a077", tan: "#c68642", brown: "#a8703f", deep: "#8d5524", dark: "#6b3e1f" };
const HAIR = { black: "#17110d", darkBrown: "#2b1b12", brown: "#3d2616", chestnut: "#5a3a22", fair: "#b88a4a", blond: "#d7b26a", ginger: "#9c4a22" };

const L = (skin: string, hair: ManagerHair, hairColour: string, grey: number, beard: ManagerBeard, glasses: boolean, width: number, age: number): ManagerLook =>
  ({ skin, hair, hairColour, grey, beard, glasses, width, age });

/**
 * The managers the game names, by SURNAME (lower case, no accents). Broad
 * strokes only. A surname that two managers share gets the one look; it is a
 * cartoon.
 */
const KNOWN: Record<string, ManagerLook> = {
  arteta: L(SKIN.fair, "short", HAIR.darkBrown, 0.1, "none", false, 0.92, 0.2),
  guardiola: L(SKIN.fair, "bald", HAIR.darkBrown, 0.6, "stubble", false, 1, 0.45),
  slot: L(SKIN.pale, "short", HAIR.blond, 0.1, "none", false, 0.94, 0.25),
  howe: L(SKIN.fair, "short", HAIR.brown, 0.45, "none", false, 1, 0.35),
  klopp: L(SKIN.pale, "swept", HAIR.fair, 0.5, "full", true, 1.08, 0.5),
  ferguson: L(SKIN.pale, "swept", HAIR.fair, 0.95, "none", true, 1.06, 0.8),
  wenger: L(SKIN.pale, "swept", HAIR.fair, 0.85, "none", true, 0.96, 0.75),
  conte: L(SKIN.olive, "receding", HAIR.black, 0.3, "stubble", false, 0.98, 0.4),
  mourinho: L(SKIN.fair, "short", HAIR.darkBrown, 0.7, "stubble", false, 1, 0.5),
  southgate: L(SKIN.pale, "receding", HAIR.brown, 0.6, "none", false, 0.96, 0.4),
  tuchel: L(SKIN.fair, "bald", HAIR.brown, 0.5, "stubble", false, 1.02, 0.4),
  nagelsmann: L(SKIN.fair, "short", HAIR.chestnut, 0, "none", false, 0.94, 0.1),
  dyche: L(SKIN.pale, "bald", HAIR.brown, 0.5, "stubble", false, 1.08, 0.5),
  emery: L(SKIN.olive, "receding", HAIR.black, 0.55, "none", false, 0.98, 0.45),
  moyes: L(SKIN.pale, "short", HAIR.brown, 0.8, "none", false, 1, 0.55),
  frank: L(SKIN.pale, "short", HAIR.blond, 0.35, "none", false, 0.96, 0.3),
  postecoglou: L(SKIN.olive, "short", HAIR.black, 0.45, "stubble", false, 1.02, 0.4),
  maresca: L(SKIN.fair, "short", HAIR.black, 0.1, "stubble", false, 0.94, 0.2),
  amorim: L(SKIN.fair, "bald", HAIR.brown, 0.2, "stubble", false, 0.98, 0.2),
  pochettino: L(SKIN.olive, "bald", HAIR.brown, 0.3, "stubble", false, 1.02, 0.35),
  zidane: L(SKIN.olive, "bald", HAIR.darkBrown, 0.3, "stubble", false, 1.04, 0.35),
  koeman: L(SKIN.pale, "short", HAIR.fair, 0.85, "none", false, 1.06, 0.55),
  rangnick: L(SKIN.pale, "swept", HAIR.fair, 0.9, "none", true, 0.98, 0.6),
  bielsa: L(SKIN.fair, "bald", HAIR.brown, 0.7, "none", true, 0.98, 0.6),
  vieira: L(SKIN.dark, "buzz", HAIR.black, 0.15, "stubble", false, 1, 0.3),
  rosenior: L(SKIN.tan, "buzz", HAIR.black, 0, "short", false, 0.98, 0.15),
  persie: L(SKIN.pale, "short", HAIR.brown, 0, "stubble", false, 0.94, 0.1),
  gerrard: L(SKIN.pale, "short", HAIR.fair, 0.15, "none", false, 1, 0.2),
  allardyce: L(SKIN.pale, "short", HAIR.fair, 0.9, "none", false, 1.1, 0.75),
  parker: L(SKIN.pale, "buzz", HAIR.brown, 0.2, "stubble", false, 0.96, 0.2),
  solskjaer: L(SKIN.pale, "short", HAIR.blond, 0.4, "none", false, 0.94, 0.25),
  ranieri: L(SKIN.fair, "short", HAIR.fair, 0.95, "none", true, 1, 0.8),
  gaal: L(SKIN.pale, "ring", HAIR.fair, 0.95, "none", true, 1.04, 0.85),
  mccarthy: L(SKIN.pale, "short", HAIR.fair, 0.9, "none", false, 1.06, 0.7),
  bruce: L(SKIN.pale, "short", HAIR.fair, 0.9, "none", false, 1.08, 0.65),
  benitez: L(SKIN.fair, "short", HAIR.brown, 0.8, "none", false, 1, 0.55),
  hasenhuttl: L(SKIN.pale, "short", HAIR.darkBrown, 0.2, "stubble", false, 0.98, 0.3),
  marcelino: L(SKIN.fair, "receding", HAIR.brown, 0.8, "none", false, 1, 0.55),
  valverde: L(SKIN.fair, "receding", HAIR.brown, 0.8, "none", true, 0.96, 0.5),
  deschamps: L(SKIN.fair, "short", HAIR.brown, 0.8, "none", false, 0.98, 0.5),
  low: L(SKIN.pale, "swept", HAIR.brown, 0.7, "none", false, 0.96, 0.5),
  sarri: L(SKIN.fair, "swept", HAIR.fair, 0.9, "none", false, 1.02, 0.7),
  xavi: L(SKIN.olive, "short", HAIR.darkBrown, 0.1, "stubble", false, 0.94, 0.15),
  andrews: L(SKIN.pale, "short", HAIR.ginger, 0.05, "none", false, 0.96, 0.2),
  gattuso: L(SKIN.olive, "short", HAIR.black, 0.2, "stubble", false, 1.04, 0.3),
  motta: L(SKIN.olive, "short", HAIR.black, 0.1, "stubble", false, 0.94, 0.2),
  mckenna: L(SKIN.pale, "short", HAIR.chestnut, 0, "none", false, 0.96, 0.1),
  iraola: L(SKIN.fair, "short", HAIR.black, 0.2, "stubble", false, 0.98, 0.25),
  glasner: L(SKIN.pale, "short", HAIR.brown, 0.25, "stubble", false, 0.98, 0.25),
  nuno: L(SKIN.olive, "short", HAIR.black, 0.3, "stubble", false, 0.96, 0.3),
  silva: L(SKIN.fair, "short", HAIR.brown, 0.6, "none", false, 0.98, 0.4),
};

/** Lower case, no accents or marks: "Solskjær" → "solskjaer"-ish, "Hütter" → "hutter". */
function slug(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "o").replace(/ö/g, "o").replace(/[^a-z ]/g, "").trim();
}

function hash(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
/** A 0-1 number from the key and a salt: a different one per trait. */
const roll = (key: string, salt: string) => hash(`${key}#${salt}`) / 4294967296;
const pick = <T,>(key: string, salt: string, list: T[]): T => list[Math.floor(roll(key, salt) * list.length) % list.length];

/** His look: the one we know, or one made from his name. Same name, same face. */
export function managerLook(name: string): ManagerLook {
  const words = slug(name).split(/\s+/).filter(Boolean);
  // "Sir Alex Ferguson" → ferguson; "Louis van Gaal" → gaal; "Robin van Persie" → persie.
  const last = words[words.length - 1] ?? "";
  const known = KNOWN[last];
  if (known) return known;
  const key = slug(name) || "manager";
  // Mostly fair and olive, some brown and dark: the dugouts are not all one man.
  const skin = pick(key, "skin", [SKIN.pale, SKIN.fair, SKIN.fair, SKIN.olive, SKIN.olive, SKIN.tan, SKIN.brown, SKIN.deep, SKIN.dark]);
  const age = 0.15 + roll(key, "age") * 0.7;
  const hair = pick<ManagerHair>(key, "hair", ["short", "short", "short", "swept", "receding", "bald", "buzz", "curly", "ring"]);
  const dark = skin === SKIN.dark || skin === SKIN.deep || skin === SKIN.brown;
  const hairColour = dark ? HAIR.black : pick(key, "colour", [HAIR.black, HAIR.darkBrown, HAIR.brown, HAIR.chestnut, HAIR.fair, HAIR.blond, HAIR.ginger]);
  return {
    skin, hair, hairColour,
    grey: Math.min(1, Math.max(0, (age - 0.25) * 1.3)),
    beard: pick<ManagerBeard>(key, "beard", ["none", "none", "none", "stubble", "stubble", "short", "full"]),
    glasses: roll(key, "glasses") < 0.2,
    width: 0.92 + roll(key, "width") * 0.2,
    age,
  };
}

// ── Drawing ─────────────────────────────────────────────────────────────────

function rgbOf(c: string): number[] {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const n = c.match(/[\d.]+/g);
  return n && n.length >= 3 ? n.slice(0, 3).map(Number) : [128, 128, 128];
}
function mix(a: string, b: string, t: number): string {
  const A = rgbOf(a), B = rgbOf(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
}
function shade(c: string, amt: number): string {
  const t = amt > 0 ? 255 : 0, k = Math.abs(amt);
  return `rgb(${rgbOf(c).map((v) => Math.round(v + (t - v) * k)).join(",")})`;
}
function rgba(c: string, a: number): string {
  const [r, g, b] = rgbOf(c);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Paint his head, chin at (cx, chinY), `faceH` from eyebrow to chin (the same
 * scale as figure3d's drawStyledHead, so it drops into the same figure).
 */
export function drawManagerHead(ctx: CanvasRenderingContext2D, cx: number, chinY: number, faceH: number, look: ManagerLook): void {
  const rx = faceH * 0.68 * look.width, ry = faceH * 0.93;
  const cy = chinY - ry;
  const hair = mix(look.hairColour, "#d8d8d8", look.grey * 0.9);
  const hairLit = shade(hair, 0.25), hairDark = shade(hair, -0.35);
  const skin = look.skin;
  const facePath = () => {
    ctx.beginPath();
    ctx.moveTo(cx, chinY);
    ctx.bezierCurveTo(cx - rx * 0.75, chinY, cx - rx, cy + ry * 0.45, cx - rx, cy);
    ctx.bezierCurveTo(cx - rx, cy - ry * 0.62, cx - rx * 0.55, cy - ry, cx, cy - ry);
    ctx.bezierCurveTo(cx + rx * 0.55, cy - ry, cx + rx, cy - ry * 0.62, cx + rx, cy);
    ctx.bezierCurveTo(cx + rx, cy + ry * 0.45, cx + rx * 0.75, chinY, cx, chinY);
    ctx.closePath();
  };

  // Ears, then the face lit from the left.
  ctx.fillStyle = shade(skin, -0.12);
  ctx.beginPath(); ctx.ellipse(cx - rx * 0.97, cy + ry * 0.12, rx * 0.17, ry * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + rx * 0.97, cy + ry * 0.12, rx * 0.17, ry * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  const fg = ctx.createLinearGradient(cx - rx, cy - ry * 0.3, cx + rx, cy + ry * 0.3);
  fg.addColorStop(0, shade(skin, 0.16)); fg.addColorStop(0.5, skin); fg.addColorStop(1, shade(skin, -0.26));
  ctx.fillStyle = fg;
  facePath(); ctx.fill();

  // Beard: clipped to the face so it follows the jaw.
  if (look.beard !== "none") {
    ctx.save();
    facePath(); ctx.clip();
    const up = look.beard === "full" ? 0.28 : look.beard === "short" ? 0.38 : 0.45;
    ctx.fillStyle = look.beard === "stubble" ? rgba(mix(hair, "#000000", 0.35), 0.3) : rgba(hair, look.beard === "full" ? 0.95 : 0.85);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.1, cy + ry * up);
    ctx.quadraticCurveTo(cx - rx * 0.55, cy + ry * (up + 0.14), cx - rx * 0.3, cy + ry * (up + 0.1));
    ctx.quadraticCurveTo(cx, cy + ry * (up + 0.2), cx + rx * 0.3, cy + ry * (up + 0.1));
    ctx.quadraticCurveTo(cx + rx * 0.55, cy + ry * (up + 0.14), cx + rx * 1.1, cy + ry * up);
    ctx.lineTo(cx + rx * 1.1, chinY + ry * 0.2); ctx.lineTo(cx - rx * 1.1, chinY + ry * 0.2);
    ctx.closePath(); ctx.fill();
    if (look.beard !== "stubble") {
      // Moustache.
      ctx.fillStyle = rgba(hair, 0.95);
      ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.6, rx * 0.34, ry * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Eyes, brows, nose, mouth.
  const eyeY = cy + ry * 0.12, ex = rx * 0.38;
  ctx.fillStyle = "#1a1210";
  ctx.beginPath(); ctx.ellipse(cx - ex, eyeY, rx * 0.1, ry * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + ex, eyeY, rx * 0.1, ry * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = look.hair === "bald" ? shade(hair, -0.2) : hairDark; ctx.lineCap = "round"; ctx.lineWidth = Math.max(0.6, ry * (0.06 + look.age * 0.03));
  ctx.beginPath(); ctx.moveTo(cx - ex - rx * 0.16, eyeY - ry * 0.16); ctx.lineTo(cx - ex + rx * 0.14, eyeY - ry * 0.19); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + ex - rx * 0.14, eyeY - ry * 0.19); ctx.lineTo(cx + ex + rx * 0.16, eyeY - ry * 0.16); ctx.stroke();
  ctx.fillStyle = rgba(shade(skin, -0.5), 0.35);
  ctx.beginPath(); ctx.ellipse(cx + rx * 0.06, eyeY + ry * 0.3, rx * 0.08, ry * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(look.beard === "none" ? shade(skin, -0.55) : "#2a1410", 0.6); ctx.lineWidth = Math.max(0.5, ry * 0.05);
  ctx.beginPath(); ctx.moveTo(cx - rx * 0.2, eyeY + ry * 0.62); ctx.quadraticCurveTo(cx, eyeY + ry * 0.68, cx + rx * 0.2, eyeY + ry * 0.62); ctx.stroke();

  // Age: forehead lines and cheek lines.
  if (look.age > 0.45) {
    ctx.strokeStyle = rgba(shade(skin, -0.5), 0.2 + (look.age - 0.45) * 0.4); ctx.lineWidth = Math.max(0.4, ry * 0.03);
    for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(cx - rx * 0.4, eyeY - ry * (0.42 + k * 0.1)); ctx.quadraticCurveTo(cx, eyeY - ry * (0.46 + k * 0.1), cx + rx * 0.4, eyeY - ry * (0.42 + k * 0.1)); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - rx * 0.28, eyeY + ry * 0.36); ctx.quadraticCurveTo(cx - rx * 0.36, eyeY + ry * 0.55, cx - rx * 0.3, eyeY + ry * 0.68); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + rx * 0.28, eyeY + ry * 0.36); ctx.quadraticCurveTo(cx + rx * 0.36, eyeY + ry * 0.55, cx + rx * 0.3, eyeY + ry * 0.68); ctx.stroke();
  }

  // Glasses.
  if (look.glasses) {
    ctx.strokeStyle = "#1b1b1f"; ctx.lineWidth = Math.max(0.7, ry * 0.055); ctx.lineJoin = "round";
    const gr = rx * 0.26;
    ctx.beginPath(); ctx.ellipse(cx - ex, eyeY, gr, gr * 0.85, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + ex, eyeY, gr, gr * 0.85, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - ex + gr, eyeY); ctx.lineTo(cx + ex - gr, eyeY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - ex - gr, eyeY); ctx.lineTo(cx - rx * 1.0, eyeY - ry * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + ex + gr, eyeY); ctx.lineTo(cx + rx * 1.0, eyeY - ry * 0.02); ctx.stroke();
  }

  // Hair.
  const hg = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy);
  hg.addColorStop(0, hairLit); hg.addColorStop(0.5, hair); hg.addColorStop(1, hairDark);
  ctx.fillStyle = hg;
  if (look.hair === "bald" || look.hair === "ring") {
    // Just the sides, round the ears.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * rx * 1.0, cy - ry * 0.12);
      ctx.quadraticCurveTo(cx + s * rx * 1.14, cy + ry * 0.05, cx + s * rx * 1.02, cy + ry * 0.32);
      ctx.quadraticCurveTo(cx + s * rx * 0.96, cy + ry * 0.1, cx + s * rx * 0.97, cy - ry * 0.12);
      ctx.closePath(); ctx.fill();
    }
    if (look.hair === "bald") {
      ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = Math.max(0.6, ry * 0.07); ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx - rx * 0.12, cy - ry * 0.18, ry * 0.8, Math.PI * 1.22, Math.PI * 1.44); ctx.stroke();
      return;
    }
  }
  const line = look.hair === "buzz" ? 0.62 : look.hair === "receding" ? 0.74 : look.hair === "ring" ? 0.82 : look.hair === "swept" ? 0.5 : 0.42;
  const top = look.hair === "swept" ? 1.2 : look.hair === "curly" ? 1.12 : look.hair === "buzz" ? 1.01 : look.hair === "ring" ? 0.98 : 1.07;
  const a0 = ctx.globalAlpha;
  if (look.hair === "buzz") ctx.globalAlpha = a0 * 0.85;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 1.02, cy + ry * 0.05);
  ctx.bezierCurveTo(cx - rx * 1.06, cy - ry * 0.8, cx - rx * 0.6, cy - ry * top, cx, cy - ry * top);
  ctx.bezierCurveTo(cx + rx * 0.6, cy - ry * top, cx + rx * 1.06, cy - ry * 0.8, cx + rx * 1.02, cy + ry * 0.05);
  if (look.hair === "receding") {
    // A widow's peak: the hairline pulls back at the temples.
    ctx.quadraticCurveTo(cx + rx * 0.9, cy - ry * 0.3, cx + rx * 0.55, cy - ry * line);
    ctx.quadraticCurveTo(cx, cy - ry * (line - 0.1), cx - rx * 0.55, cy - ry * line);
    ctx.quadraticCurveTo(cx - rx * 0.9, cy - ry * 0.3, cx - rx * 1.02, cy + ry * 0.05);
  } else {
    ctx.quadraticCurveTo(cx + rx * 0.7, cy - ry * line, cx + rx * 0.2, cy - ry * line);
    ctx.quadraticCurveTo(cx - rx * 0.25, cy - ry * (line - 0.08), cx - rx * 0.75, cy - ry * (line - 0.1));
    ctx.quadraticCurveTo(cx - rx * 0.95, cy - ry * 0.15, cx - rx * 1.02, cy + ry * 0.05);
  }
  ctx.closePath(); ctx.fill();
  if (look.hair === "curly") {
    for (let i = 0; i <= 5; i++) {
      const a = Math.PI * (1.17 + i * 0.132);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx * 0.92, cy + Math.sin(a) * ry * 0.95, rx * 0.24, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = a0;
}
