/**
 * The strike screen's picture, in the website's look (components/star/ContactBall.tsx):
 * the blue sky, the green strip, the club's own ball (the photo, public/star/ball.webp)
 * resting on the grass with its shadows, the countdown ring round it, and the spark
 * where you hit it; its header (WHERE DO YOU / the brushed-steel STRIKE IT? / the air hint /
 * the draining countdown bar) and a volley's HEIGHT meter, all moving per frame.
 * The POWER bar and TOO SLOW are plain views over it (MatchPitch.tsx).
 *
 * Cheap per frame: the sky and the grass are ONE picture per size; each frame only
 * stamps it and draws the ball where it is now.
 */
import { Skia, PaintStyle, StrokeCap, createPicture, type SkPaint, type SkPicture, type SkImage } from "@shopify/react-native-skia";
import { Dimensions } from "react-native";
import type { MatchDriver } from "./driver";
import { liftOf } from "./contactBall";
import { createCtx2D } from "../draw/ctx2d";
import { phoneFontFor } from "../draw/useDrawing";
import { airCentreR, VOLLEY_SWEET } from "@/lib/star/airborneChance";
import { airTapCleanR, airTapOn, AIR_TAP_POST_CX } from "@/lib/star/airTap";
import { isAirKind, airZOf, HEADER_Z } from "@/lib/star/airDrawings";
import { headerJump } from "@/lib/star/aerial";

const P = new Map<string, SkPaint>();
function paint(color: string, stroke = 0): SkPaint {
  const k = color + stroke;
  let p = P.get(k);
  if (!p) {
    p = Skia.Paint(); p.setAntiAlias(true); p.setColor(Skia.Color(color));
    if (stroke) { p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(stroke); p.setStrokeCap(StrokeCap.Round); }
    P.set(k, p);
  }
  return p;
}

/** The ball's photo (set once by MatchPitch when it has loaded). */
let ballImage: SkImage | null = null;
export function setContactBallImage(img: SkImage | null) { ballImage = img; }

/** The play area under the header, as ContactBall's flex-1 area (fractions of the screen). */
const AREA_TOP = 0.16;

/** Where the strike screen's ball is drawn (its centre) and its radius, px. */
export function contactBallBox(d: MatchDriver, W: number, H: number) {
  const at = d.contactBallNow();
  const still = d.strikeMotion() === "still";
  // ContactBall: 56% of the width at rest (40% when it moves), sitting on the grass 10% of the width up.
  const r = Math.min(W * (still ? 0.28 : 0.2), H * (still ? 0.24 : 0.17));
  const areaH = H * (1 - AREA_TOP);
  const restY = H - W * 0.1 - r;
  return { x: W / 2 + at.x * W, y: restY + at.y * areaH, r };
}

/** A soft round shadow: a radial gradient (no blur). */
function softShadow(cx: number, cy: number, rx: number, ry: number, alpha: number): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeRadialGradient({ x: cx, y: cy }, rx,
    [Skia.Color(`rgba(0,0,0,${alpha})`), Skia.Color("rgba(0,0,0,0)")], [0, 0.72], 0,
    Skia.Matrix().translate(cx, cy).scale(1, ry / rx).translate(-cx, -cy)));
  return p;
}

let backdrop: { key: string; pic: SkPicture } | null = null;
function backdropPic(W: number, H: number): SkPicture {
  const key = `${W}x${H}`;
  if (backdrop && backdrop.key === key) return backdrop.pic;
  const pic = createPicture((c) => {
    const sky = Skia.Paint();
    sky.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: H }, [Skia.Color("#4a71b8"), Skia.Color("#a8c4e8")], null, 0));
    c.drawRect(Skia.XYWHRect(0, 0, W, H), sky);
    const g = Skia.Paint();
    g.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: H * 0.76 }, { x: 0, y: H }, [Skia.Color("#16a34a"), Skia.Color("#15803d")], null, 0));
    c.drawRect(Skia.XYWHRect(0, H * 0.76, W, H * 0.24), g);
  }, { width: W, height: H });
  backdrop = { key, pic };
  return pic;
}

/** The countdown ring's colour: yellow, orange by 60%, red at the end (ContactBall kibCountRing). */
function ringColour(left: number): string {
  const t = 1 - left;
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const c = t < 0.6 ? mix([0xfd, 0xe0, 0x47], [0xfb, 0x92, 0x3c], t / 0.6) : mix([0xfb, 0x92, 0x3c], [0xef, 0x44, 0x44], (t - 0.6) / 0.4);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

type G = CanvasRenderingContext2D;
const SHADOW = (g: G, y: number, blur: number, a: number) => { g.shadowColor = `rgba(0,0,0,${a})`; g.shadowOffsetX = 0; g.shadowOffsetY = y; g.shadowBlur = blur; };
const NO_SHADOW = (g: G) => { g.shadowColor = "rgba(0,0,0,0)"; g.shadowBlur = 0; g.shadowOffsetY = 0; };
function roundRect(g: G, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r);
  g.closePath();
}
/** Words that may not fit across: split onto two lines (the website's block wraps). */
function lines(g: G, text: string, maxW: number): string[] {
  if (g.measureText(text).width <= maxW) return [text];
  const words = text.split(" ");
  let best = 1;
  for (let i = 1; i < words.length; i++) if (g.measureText(words.slice(0, i).join(" ")).width <= maxW) best = i;
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/**
 * ContactBall's header, drawn: "Where do you" (13 px, white 90%), the title in
 * brushed steel (italic black, clamp(28px, 9vw, 40px), a white → #cfd8e6 →
 * #8f9bb0 fill down the line, a soft drop shadow), a ball in the air's one
 * line of how to hit it, a header's jump, and the countdown bar under it that
 * drains from the right and turns yellow → orange → red with the ring.
 */
function paintHeader(g: G, d: MatchDriver, W: number, motion: string, air: boolean, aimFromTap: boolean) {
  const vw = Dimensions.get("window").width || W;
  const fs = Math.max(28, Math.min(40, vw * 0.09));
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  let y = 12;
  g.font = "900 13px sans-serif";
  SHADOW(g, 2, 4, 0.8);
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fillText("WHERE DO YOU", W / 2, y + 11);
  y += 13 + 2;
  // The title, brushed steel.
  const title = motion === "float" ? "HEAD IT?" : motion === "bounce" ? "VOLLEY IT?" : "STRIKE IT?";
  const lh = fs * 0.95;
  // Black weight, slanted by a skew (a phone or browser may have no black italic face; the slant is Roboto Italic's 12°).
  g.font = `900 ${fs}px sans-serif`;
  SHADOW(g, 3, 6, 0.6);
  g.save();
  g.translate(W / 2, y + lh * 0.83);
  g.transform(1, 0, -0.21, 1, 0, 0);
  // The steel runs down the line box (CSS background-clip: text), in the slanted text's own space.
  const steel = g.createLinearGradient(0, -lh * 0.83, 0, lh * 0.17);
  steel.addColorStop(0, "#ffffff");
  steel.addColorStop(0.55, "#cfd8e6");
  steel.addColorStop(1, "#8f9bb0");
  g.fillStyle = steel;
  g.fillText(title, 0, 0);
  g.restore();
  y += lh;
  if (air) {
    y += 6;
    g.font = "700 11px sans-serif";
    SHADOW(g, 1, 3, 0.8);
    g.fillStyle = "rgba(255,255,255,0.9)";
    const hint = aimFromTap
      ? (motion === "float" ? "Hit its left side to send it right · top nods it down" : "Hit its left side to send it right · as it drops through the green")
      : motion === "float" ? "Top nods it down · the sides glance it · under loops it up" : "Hit the middle as it drops through the green";
    for (const l of lines(g, hint, W - 24)) { g.fillText(l, W / 2, y + 10); y += 13; }
  }
  const aerial = d.airAerialNow();
  if (motion === "float" && aerial !== undefined) {
    const ballZ = d.sc.kind === "header" ? airZOf(d.sc) : HEADER_Z;
    const jump = headerJump(ballZ, aerial);
    y += 4;
    g.font = "900 12px sans-serif";
    SHADOW(g, 1, 3, 0.85);
    g.fillStyle = jump.overM > 0.02 ? "#fca5a5" : "#bbf7d0";
    g.fillText((jump.jumpM < 0.03 ? "No jump needed" : `Jump ${jump.jumpM.toFixed(2)} m`)
      + (jump.overM > 0.02 ? ` · ${jump.overM.toFixed(2)} m over your reach` : ` · max ${jump.maxJumpM.toFixed(2)} m`), W / 2, y + 11);
    y += 15;
  }
  NO_SHADOW(g);
  const cd = d.contactCountdown();
  if (cd) {
    y += 8;
    const bw = W * 0.6, bx = (W - bw) / 2;
    roundRect(g, bx, y, bw, 8, 4);
    g.fillStyle = "rgba(0,0,0,0.4)"; g.fill();
    g.strokeStyle = "rgba(255,255,255,0.15)"; g.lineWidth = 1; g.stroke();
    const left = d.contactTimedOut ? 0 : cd.left;
    if (left > 0.002) {
      g.save();
      roundRect(g, bx, y, bw, 8, 4); g.clip();
      roundRect(g, bx, y, bw * left, 8, 4);
      g.fillStyle = ringColour(left); g.fill();
      g.restore();
    }
  }
}

/** A volley's HEIGHT meter (ContactBall data-volley-meter): left edge, the green sweet band, the marker at the ball's height. */
function paintHeightMeter(g: G, H: number, lift: number) {
  const barH = 112, colH = 13 + 6 + barH;
  const cx = 10 + 10, top = H / 2 - colH / 2;
  g.textAlign = "center";
  g.font = "900 9px sans-serif";
  SHADOW(g, 1, 3, 0.8);
  g.fillStyle = "#ffffff";
  g.fillText("HEIGHT", cx, top + 10);
  NO_SHADOW(g);
  const by = top + 13 + 6, bx = cx - 6;
  roundRect(g, bx, by, 12, barH, 6);
  g.fillStyle = "rgba(0,0,0,0.5)"; g.fill();
  g.strokeStyle = "rgba(255,255,255,0.1)"; g.lineWidth = 1; g.stroke();
  const b0 = by + barH * (1 - VOLLEY_SWEET[1]), b1 = by + barH * (1 - VOLLEY_SWEET[0]);
  roundRect(g, bx, b0, 12, b1 - b0, 2);
  g.fillStyle = "rgba(52,211,153,0.7)"; g.fill();
  const my = by + barH * (1 - lift) - 3;
  SHADOW(g, 1, 3, 0.3);
  roundRect(g, bx - 4, my, 20, 6, 3);
  g.fillStyle = "#ffffff"; g.fill();
  NO_SHADOW(g);
}

/** The clean middle of a ball in the air, on the ball (ContactBall data-air-band / data-air-centre). */
function paintAirBand(g: G, bb: { x: number; y: number; r: number }, kind: "header" | "volley", aerial: number | undefined, aimFromTap: boolean) {
  const r = bb.r;
  const dash = [0.07 * r, 0.05 * r];
  g.save();
  g.translate(bb.x, bb.y);
  if (aimFromTap) {
    const w = airTapCleanR(kind, aerial) * r, h = (airCentreR(aerial) + 0.08) * r;
    roundRect(g, -w, -h, 2 * w, 2 * h, h);
    g.strokeStyle = "rgba(0,0,0,0.55)"; g.lineWidth = 0.06 * r; g.stroke();
    g.setLineDash(dash);
    g.strokeStyle = "rgba(253,224,71,0.95)"; g.lineWidth = 0.035 * r; g.stroke();
    g.setLineDash([]);
    g.strokeStyle = "rgba(253,224,71,0.9)"; g.lineWidth = 0.03 * r;
    for (const x of [-AIR_TAP_POST_CX * r, AIR_TAP_POST_CX * r]) { g.beginPath(); g.moveTo(x, -h - 0.1 * r); g.lineTo(x, h + 0.1 * r); g.stroke(); }
  } else {
    const rr = (airCentreR(aerial) + 0.08) * r;
    g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2);
    g.strokeStyle = "rgba(0,0,0,0.55)"; g.lineWidth = 0.06 * r; g.stroke();
    g.setLineDash(dash);
    g.strokeStyle = "rgba(253,224,71,0.95)"; g.lineWidth = 0.035 * r; g.stroke();
    g.setLineDash([]);
  }
  g.restore();
}

export function drawContact(d: MatchDriver, W: number, H: number): SkPicture {
  return createPicture((c) => {
    c.drawPicture(backdropPic(W, H));
    const g = createCtx2D(Skia, c, { width: W, height: H, fontFor: phoneFontFor }) as unknown as G;
    {
      const m = d.strikeMotion();
      paintHeader(g, d, W, m, m === "float" || m === "bounce", isAirKind(d.sc.kind) && airTapOn());
    }
    const aimFromTap = isAirKind(d.sc.kind) && airTapOn();
    const bb = contactBallBox(d, W, H);
    const motion = d.strikeMotion();
    const air = motion === "float" || motion === "bounce";
    if (air) {
      // The shadow stays on the grass under the ball, smaller and fainter the higher it is.
      const restY = H - W * 0.1;
      const k = 1 - 0.45 * Math.min(1, Math.max(0, (restY - bb.r - bb.y) / ((H * (1 - AREA_TOP)) * 0.5)));
      const rx = W * 0.16 * k, ry = H * 0.03 * k;
      c.drawOval(Skia.XYWHRect(bb.x - rx, restY - ry * 0.4, rx * 2, ry * 2), softShadow(bb.x, restY + ry * 0.6, rx, ry, 0.6 * (0.35 + 0.65 * k)));
    } else {
      const rx = bb.r * 0.78, ry = bb.r * 0.16;
      const cy = bb.y + bb.r * 1.18 - ry;
      c.drawOval(Skia.XYWHRect(bb.x - rx, cy - ry, rx * 2, ry * 2), softShadow(bb.x, cy, rx, ry, 0.55));
    }
    // The ball's own shadow behind it (ContactBall: 0 10px 14px rgba(0,0,0,.55)), as a soft disc.
    c.drawCircle(bb.x, bb.y + 10, bb.r + 12, softShadow(bb.x, bb.y + 10, bb.r + 14, bb.r + 14, 0.5));
    if (ballImage) {
      const iw = ballImage.width(), ih = ballImage.height();
      c.drawImageRect(ballImage, Skia.XYWHRect(0, 0, iw, ih), Skia.XYWHRect(bb.x - bb.r, bb.y - bb.r, bb.r * 2, bb.r * 2), paint("#ffffff"));
    } else {
      c.drawCircle(bb.x, bb.y, bb.r, paint("#f8fafc"));
      c.drawCircle(bb.x, bb.y, bb.r, paint("#1f2937", 2));
    }
    if (air) paintAirBand(g, bb, motion === "float" ? "header" : "volley", d.airAerialNow(), aimFromTap);
    if (motion === "bounce") paintHeightMeter(g, H, liftOf(motion, d.contactBallNow().y));
    // The countdown ring round the ball, draining clockwise from the top.
    const cd = d.contactCountdown();
    if (cd) {
      const R = bb.r * 1.14 * 0.94, sw = bb.r * 2.28 * (air ? 0.08 : 0.045);
      c.drawCircle(bb.x, bb.y, R, paint("rgba(0,0,0,0.35)", bb.r * 2.28 * (air ? 0.08 : 0.04)));
      if (cd.left > 0.002) {
        const ring = Skia.PathBuilder.Make();
        ring.addArc(Skia.XYWHRect(bb.x - R, bb.y - R, R * 2, R * 2), -90, 360 * cd.left);
        c.drawPath(ring.build(), paint(ringColour(cd.left), sw));
      }
    }
    // Where you hit it: a lightning spark (ContactBall's ⚡).
    if (d.contactSpark) {
      const x = bb.x + d.contactSpark.cx * bb.r, y = bb.y + d.contactSpark.cy * bb.r, s = Math.max(10, bb.r * 0.16);
      const bolt = Skia.PathBuilder.Make();
      bolt.moveTo(x + s * 0.15, y - s); bolt.lineTo(x - s * 0.55, y + s * 0.12); bolt.lineTo(x - s * 0.02, y + s * 0.12);
      bolt.lineTo(x - s * 0.2, y + s); bolt.lineTo(x + s * 0.6, y - s * 0.2); bolt.lineTo(x + s * 0.05, y - s * 0.2); bolt.close();
      const path = bolt.build();
      c.drawPath(path, paint("#facc15"));
      c.drawPath(path, paint("#7c2d12", 1.5));
    }
  }, { width: W, height: H });
}
