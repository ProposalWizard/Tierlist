// The strike screen's picture (the website's ContactBall.tsx look): sky, grass, the ball where it is now, the power bar, the countdown.
import { Skia, PaintStyle, StrokeCap, createPicture, type SkPaint, type SkPicture } from "@shopify/react-native-skia";
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

/** Where the strike screen's ball is drawn (its centre) and its radius, px. */
export function contactBallBox(d: MatchDriver, W: number, H: number) {
  const at = d.contactBallNow();
  const r = Math.min(W * 0.2, H * 0.16);
  return { x: W / 2 + at.x * W, y: H * 0.64 + at.y * H, r };
}

export function drawContact(d: MatchDriver, W: number, H: number): SkPicture {
  return createPicture((c) => {
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const r = Math.round(0x4a + (0xa8 - 0x4a) * t), g = Math.round(0x71 + (0xc4 - 0x71) * t), b = Math.round(0xb8 + (0xe8 - 0xb8) * t);
      c.drawRect(Skia.XYWHRect(0, (H * i) / 12, W, H / 12 + 1), paint(`rgb(${r},${g},${b})`));
    }
    c.drawRect(Skia.XYWHRect(0, H * 0.76, W, H * 0.24), paint("#16a34a"));
    const bb = contactBallBox(d, W, H);
    const motion = d.strikeMotion();
    if (motion !== "still") {
      const lift = Math.max(0, Math.min(1, (H * 0.64 - bb.y) / (H * 0.5)));
      const k = 1 - 0.45 * lift;
      c.drawOval(Skia.XYWHRect(bb.x - bb.r * k, H * 0.64 + bb.r * 0.85, bb.r * 2 * k, bb.r * 0.4 * k), paint("rgba(0,0,0,0.3)"));
    } else c.drawOval(Skia.XYWHRect(bb.x - bb.r, bb.y + bb.r * 0.85, bb.r * 2, bb.r * 0.4), paint("rgba(0,0,0,0.3)"));
    c.drawCircle(bb.x, bb.y, bb.r, paint("#ffffff"));
    c.drawCircle(bb.x, bb.y, bb.r, paint("#1f2937", 3));
    // A few panels so the spin reads.
    c.drawCircle(bb.x, bb.y, bb.r * 0.3, paint("#1f2937"));
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      c.drawLine(bb.x + Math.cos(a) * bb.r * 0.3, bb.y + Math.sin(a) * bb.r * 0.3, bb.x + Math.cos(a) * bb.r * 0.95, bb.y + Math.sin(a) * bb.r * 0.95, paint("#1f2937", 2));
    }
    // The countdown ring.
    const cd = d.contactCountdown();
    if (cd) {
      const ring = Skia.PathBuilder.Make();
      ring.addArc(Skia.XYWHRect(bb.x - bb.r * 1.14, bb.y - bb.r * 1.14, bb.r * 2.28, bb.r * 2.28), -90, 360 * cd.left);
      c.drawPath(ring.build(), paint(cd.left > 0.4 ? "#fde047" : cd.left > 0.15 ? "#fb923c" : "#ef4444", 6));
    }
    if (d.contactSpark) c.drawCircle(bb.x + d.contactSpark.cx * bb.r, bb.y + d.contactSpark.cy * bb.r, 9, paint("#f97316"));
    // The power bar on the right.
    const pw = d.aim?.power ?? 0;
    const bx = W - 30, by = H * 0.22, bh = H * 0.5;
    c.drawRect(Skia.XYWHRect(bx, by, 14, bh), paint("rgba(0,0,0,0.35)"));
    const col = pw < 0.4 ? "#22c55e" : pw < 0.75 ? "#eab308" : "#ef4444";
    c.drawRect(Skia.XYWHRect(bx, by + bh * (1 - pw), 14, bh * pw), paint(col));
  }, { width: W, height: H });
}
