/**
 * THE SHARE CARD'S PICTURE, ON THE PHONE: one picture of a whole career (1080 x 1350).
 *
 * The drawing below the line is the website's components/star/shareCardDraw.ts
 * (drawCareerCard and its helpers), unchanged, so the phone's card is the same card:
 * it draws through the phone's canvas (draw/ctx2d.ts on Skia). What differs is only
 * where the pictures come from: the crests are the phone's drawn badges, the trophies
 * the pictures kept in the app (both handed in as CardAssets).
 */
import type { CareerOverviewData } from "@/lib/star/careerOverview";
import type { FarewellRecord } from "@/lib/star/types";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf, labelInk } from "@/lib/star/kits";
import { clubGlow } from "../screens/career/lookBits";

/** A picture the card can draw: a Skia image with its size (what the website reads off an <img>). */
export interface CardImage { skImage: unknown; naturalWidth: number; naturalHeight: number }
export interface CardFonts { display: string; body: string }
export interface CardAssets {
  crests: Map<string, CardImage | null>;
  trophies: Map<string, CardImage | null>;
  fonts: CardFonts;
}
const clubTheme = (club: string) => ({ glow: clubGlow(club) });
/** components/star/ClubBadge.tsx initials. */
function initials(club: string): string {
  const skip = new Set(["fc", "afc", "united", "city", "the", "and", "&", "hove", "albion"]);
  const words = club.split(/\s+/).filter(w => !skip.has(w.toLowerCase()));
  if (words.length >= 2) return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
  return club.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

// ── components/star/shareCardDraw.ts from here on ──────────────────────────
export const CARD_W = 540;
export const CARD_H = 675;
const SCALE = 2;
const GOLD = "#fbbf24";
const GOLD_LIGHT = "#fde68a";
const WHITE = "#ffffff";
const PAD = 24;

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "").replace(/^(FC|AFC)\s+/i, "");

/** "#1d4ed8" → "rgba(29,78,216,a)". Anything else is passed through. */
function rgbaOf(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}


// ── Drawing helpers ─────────────────────────────────────────────────────────
type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, weight: number | string, size: number, family: string) {
  ctx.font = `${weight} ${size}px ${family}`;
}

/** Text with letter spacing (em), drawn a character at a time; returns its width. */
function spaced(ctx: Ctx, text: string, x: number, y: number, em: number, align: "left" | "right" | "center" = "left"): number {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? "12");
  const gap = em * size;
  const chars = Array.from(text);
  const width = chars.reduce((w, ch) => w + ctx.measureText(ch).width + gap, 0) - gap;
  let cx = align === "left" ? x : align === "right" ? x - width : x - width / 2;
  const before = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + gap;
  }
  ctx.textAlign = before;
  return width;
}

/** Shrink a font until `text` fits `maxW`. */
function fit(ctx: Ctx, text: string, weight: number | string, size: number, family: string, maxW: number, min = 10): number {
  let s = size;
  for (; s > min; s -= 1) {
    font(ctx, weight, s, family);
    if (ctx.measureText(text).width <= maxW) break;
  }
  return s;
}

/** Word-wrap `text` into at most `lines` lines of `maxW`. */
function wrap(ctx: Ctx, text: string, maxW: number, lines: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else { out.push(cur); cur = w; if (out.length === lines) break; }
  }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && words.join(" ") !== out.join(" ")) {
    let last = out[lines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    out[lines - 1] = `${last}…`;
  }
  return out;
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient, stroke?: string, r = 0) {
  ctx.beginPath();
  if (r > 0 && typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function heading(ctx: Ctx, f: CardFonts, text: string, y: number) {
  ctx.fillStyle = GOLD;
  font(ctx, 900, 10.5, f.body);
  ctx.textBaseline = "alphabetic";
  spaced(ctx, text, PAD, y, 0.24);
}

function crest(ctx: Ctx, img: CardImage | null | undefined, club: string, cx: number, top: number, size: number, f: CardFonts) {
  if (img) {
    const k = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img as unknown as CanvasImageSource, cx - w / 2, top + (size - h) / 2, w, h);
    return;
  }
  const kit = kitsOf(club).home;
  ctx.beginPath();
  ctx.arc(cx, top + size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = kit.shirt;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = kit.trim;
  ctx.stroke();
  ctx.fillStyle = labelInk(kit.shirt);
  font(ctx, 900, Math.round(size * 0.3), f.body);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials(club), cx, top + size / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/**
 * Draw the card. `ctx` is a 1080 × 1350 canvas; everything below is in
 * 540 × 675 units.
 */
export function drawCareerCard(ctx: Ctx, o: CareerOverviewData, farewell: FarewellRecord | undefined, a: CardAssets) {
  const f = a.fonts;
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  // ── The background: the main club's colour washing down into the night ──
  const mainClub = [...o.clubs].sort((x, y) => y.seasons - x.seasons)[0]?.club ?? o.finalClub;
  const glow = clubTheme(mainClub).glow;
  const bg = ctx.createLinearGradient(CARD_W * 0.2, 0, CARD_W * 0.8, CARD_H);
  bg.addColorStop(0, rgbaOf(glow, 0.62));
  bg.addColorStop(0.42, "#0b1220");
  bg.addColorStop(1, "#05080f");
  ctx.fillStyle = "#05080f";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── The kicker ──
  font(ctx, 900, 10.5, f.body);
  ctx.fillStyle = GOLD_LIGHT;
  spaced(ctx, "KNOWITBALL · CAREER", PAD, 32, 0.26);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  spaced(ctx, o.years, CARD_W - PAD, 32, 0.26, "right");

  // ── The name ──
  ctx.fillStyle = WHITE;
  const name = o.name.toUpperCase();
  fit(ctx, name, 400, 46, f.display, CARD_W - PAD * 2, 26);
  ctx.fillText(name, PAD, 86);
  font(ctx, 700, 13, f.body);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${o.position} · ${o.nation} · ${o.seasonsPlayed} seasons · retired at ${o.ageAtEnd}`, PAD, 108);

  // ── The Legacy ring and the verdict ──
  const ringX = PAD + 44, ringY = 120 + 44, ringR = 44 - 8;
  const score = Math.max(0, Math.min(100, Math.round(o.verdict.score)));
  ctx.beginPath(); ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
  ctx.fillStyle = "#070b14"; ctx.fill();
  ctx.lineWidth = 9; ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.stroke();
  ctx.beginPath(); ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + (score / 100) * Math.PI * 2);
  ctx.lineCap = "round"; ctx.strokeStyle = GOLD; ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = WHITE;
  font(ctx, 400, 30, f.display);
  ctx.textAlign = "center";
  ctx.fillText(String(score), ringX, ringY + 7);
  ctx.textAlign = "left";
  ctx.fillStyle = GOLD_LIGHT;
  font(ctx, 900, 8, f.body);
  spaced(ctx, "LEGACY", ringX, ringY + 21, 0.26, "center");

  const vx = PAD + 88 + 16, vw = CARD_W - PAD - vx;
  ctx.fillStyle = GOLD_LIGHT;
  const title = o.verdict.title.toUpperCase();
  fit(ctx, title, 400, 25, f.display, vw, 16);
  ctx.fillText(title, vx, 152);
  font(ctx, 600, 12, f.body);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  wrap(ctx, o.verdict.summary, vw, 2).forEach((line, i) => ctx.fillText(line, vx, 171 + i * 16));

  // ── The big numbers ──
  const t = o.totals;
  const tiles: [number, string, boolean][] = [
    [t.apps, "APPS", false], [t.goals, "GOALS", false], [t.assists, "ASSISTS", false],
    [t.trophies, "TROPHIES", t.trophies > 0], [t.ballonDors, "GOLDEN BALL", t.ballonDors > 0],
  ];
  const ty = 220, th = 60, gap = 6, tw = (CARD_W - PAD * 2 - gap * 4) / 5;
  tiles.forEach(([v, label, gold], i) => {
    const x = PAD + i * (tw + gap);
    if (gold) {
      const g = ctx.createLinearGradient(0, ty, 0, ty + th);
      g.addColorStop(0, "rgba(251,191,36,0.28)"); g.addColorStop(1, "rgba(251,191,36,0.06)");
      rect(ctx, x, ty, tw, th, g, "rgba(251,191,36,0.55)");
    } else {
      rect(ctx, x, ty, tw, th, "rgba(255,255,255,0.06)", "rgba(255,255,255,0.1)");
    }
    ctx.fillStyle = gold ? GOLD_LIGHT : WHITE;
    fit(ctx, String(v), 400, 30, f.display, tw - 8, 16);
    ctx.textAlign = "center";
    ctx.fillText(String(v), x + tw / 2, ty + 36);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    font(ctx, 900, 9, f.body);
    spaced(ctx, label, x + tw / 2, ty + 51, 0.1, "center");
  });

  // ── The journey ──
  heading(ctx, f, "THE JOURNEY", 306);
  const spells = o.spells.length > 6 ? o.spells.slice(0, 5) : o.spells;
  const more = o.spells.length - spells.length;
  const step = 82;
  spells.forEach((sp, i) => {
    const cx = PAD + 35 + i * step;
    if (i > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      font(ctx, 900, 12, f.body);
      ctx.textAlign = "center";
      ctx.fillText("›", cx - step / 2, 340);
      ctx.textAlign = "left";
    }
    crest(ctx, a.crests.get(sp.club), sp.club, cx, 316, 40, f);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "center";
    const label = short(sp.club);
    fit(ctx, label, 900, 10.5, f.body, step - 6, 8);
    ctx.fillText(label, cx, 370);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    font(ctx, 700, 9.5, f.body);
    ctx.fillText(sp.years.split(" · ")[0], cx, 383);
    ctx.textAlign = "left";
  });
  if (more > 0) {
    const cx = PAD + 35 + spells.length * step;
    rect(ctx, cx - 26, 316, 52, 40, "rgba(255,255,255,0.05)", "rgba(255,255,255,0.18)");
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    font(ctx, 900, 14, f.body);
    ctx.textAlign = "center";
    ctx.fillText(`+${more}`, cx, 341);
    ctx.textAlign = "left";
  }

  // ── Goals by season ──
  heading(ctx, f, "GOALS BY SEASON", 410);
  const bx = PAD, bw = CARD_W - PAD * 2, bTop = 420, bBottom = 486;
  const n = Math.max(1, o.arc.length);
  const max = Math.max(1, ...o.arc.map(p => p.goals ?? 0));
  const slot = bw / n;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  font(ctx, 800, 9, f.body);
  ctx.fillText(String(max), bx, bTop + 8);
  o.arc.forEach((p, k) => {
    const x = bx + k * slot + slot * 0.14, w = slot * 0.72;
    if (p.goals === undefined) { rect(ctx, x, bBottom - 4, w, 4, "rgba(0,0,0,0.6)"); return; }
    const h = Math.max(2, (bBottom - bTop - 12) * (p.goals / max));
    const club = o.seasons[k]?.club ?? o.finalClub;
    rect(ctx, x, bBottom - h, w, h, o.peak?.season === p.season ? GOLD : clubTheme(club).glow);
  });
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  font(ctx, 800, 9, f.body);
  ctx.fillText(`age ${o.seasons[0]?.age ?? ""}`, bx, bBottom + 13);
  ctx.textAlign = "right";
  ctx.fillText(`age ${o.ageAtEnd}`, bx + bw, bBottom + 13);
  ctx.textAlign = "left";

  // ── The cabinet ──
  heading(ctx, f, "THE CABINET", 524);
  const cab = o.honours.slice(0, 7);
  if (cab.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    font(ctx, 700, 12, f.body);
    ctx.fillText("No trophies", PAD, 548);
  }
  cab.forEach((h, i) => {
    const x = PAD + i * 70, y = 532, w = 64, hh = 56;
    const g = ctx.createLinearGradient(0, y, 0, y + hh);
    g.addColorStop(0, "rgba(255,255,255,0.08)"); g.addColorStop(1, "rgba(0,0,0,0.35)");
    rect(ctx, x, y, w, hh, g);
    rect(ctx, x, y + hh - 3, w, 3, "rgba(120,72,24,0.9)");
    const img = a.trophies.get(h.competition);
    if (img) {
      const ih = 36, iw = img.naturalWidth * (ih / img.naturalHeight);
      ctx.drawImage(img as unknown as CanvasImageSource, x + (w - iw) / 2, y + hh - 6 - ih, iw, ih);
    } else {
      font(ctx, 400, 26, f.body);
      ctx.textAlign = "center";
      ctx.fillText("🏆", x + w / 2, y + hh - 12);
      ctx.textAlign = "left";
    }
    const label = `×${h.count}`;
    font(ctx, 900, 11, f.body);
    const lw = Math.max(20, ctx.measureText(label).width + 6);
    rect(ctx, x + w - 2 - lw, y + 2, lw, 15, GOLD, undefined, 2);
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w - 2 - lw / 2, y + 10);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
  });

  // ── The farewell, when there was one ──
  if (farewell?.played && farewell.yourScore !== undefined && farewell.theirScore !== undefined) {
    ctx.fillStyle = GOLD_LIGHT;
    font(ctx, 800, 12, f.body);
    const goals = farewell.goals ? ` · ${farewell.goals} goal${farewell.goals === 1 ? "" : "s"}` : "";
    ctx.fillText(`Farewell: ${farewell.yourScore}–${farewell.theirScore} v ${farewell.opponent}${goals}`, PAD, 612);
  }

  // ── The footer ──
  rect(ctx, 0, CARD_H - 40, CARD_W, 40, "rgba(0,0,0,0.45)");
  rect(ctx, 0, CARD_H - 40, CARD_W, 2, GOLD);
  font(ctx, 400, 17, f.display);
  ctx.fillStyle = WHITE;
  ctx.fillText("KNOWITBALL", PAD, CARD_H - 14);
  const kw = ctx.measureText("KNOWITBALL").width;
  ctx.fillStyle = GOLD;
  ctx.fillText(".CO.UK", PAD + kw, CARD_H - 14);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  font(ctx, 900, 9.5, f.body);
  spaced(ctx, "ROAD TO THE GOLDEN BALL", CARD_W - PAD, CARD_H - 16, 0.22, "right");

  ctx.restore();
}

