/**
 * The strike screen's picture, in the website's look (components/star/ContactBall.tsx):
 * the blue sky, the green strip, the club's own ball (the photo, public/star/ball.webp)
 * resting on the grass with its shadows, the countdown ring round it, and the spark
 * where you hit it. The words and the POWER bar are plain views over it (MatchPitch.tsx).
 *
 * Cheap per frame: the sky and the grass are ONE picture per size; each frame only
 * stamps it and draws the ball where it is now.
 */
import { Skia, PaintStyle, StrokeCap, createPicture, type SkPaint, type SkPicture, type SkImage } from "@shopify/react-native-skia";
import type { MatchDriver } from "./driver";

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

export function drawContact(d: MatchDriver, W: number, H: number): SkPicture {
  return createPicture((c) => {
    c.drawPicture(backdropPic(W, H));
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
