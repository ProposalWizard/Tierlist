/**
 * HOW A PLAYER IS DRAWN ON THE PHONE'S PITCH — one small function, so the
 * real drawings (phone/src/draw/, another builder) can replace it in one place.
 * Until then: a shadow, a shirt-coloured body and a head, seen from above.
 */
import { Skia, PaintStyle, type SkCanvas, type SkPaint } from "@shopify/react-native-skia";

export type FigureRole = "you" | "mate" | "opp" | "keeper";
export interface FigureLook { shirt: string; trim: string }

const paints = new Map<string, SkPaint>();
function paint(color: string, stroke = 0): SkPaint {
  const key = color + "|" + stroke;
  let p = paints.get(key);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color(color));
    if (stroke > 0) { p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(stroke); }
    paints.set(key, p);
  }
  return p;
}

/** Draw one man at screen (x, y) (his feet), `r` px his body radius. */
export function drawFigure(c: SkCanvas, x: number, y: number, r: number, role: FigureRole, look: FigureLook, highlight = false) {
  c.drawOval(Skia.XYWHRect(x - r * 1.1, y - r * 0.35, r * 2.2, r * 0.7), paint("rgba(0,0,0,0.28)"));
  c.drawCircle(x, y - r * 0.9, r, paint(look.shirt));
  c.drawCircle(x, y - r * 0.9, r, paint(look.trim, Math.max(1, r * 0.18)));
  c.drawCircle(x, y - r * 2.05, r * 0.55, paint(role === "keeper" ? "#f1c27d" : "#e0ac69"));
  if (highlight) c.drawCircle(x, y - r * 0.9, r * 1.45, paint("#f5c542", Math.max(1.5, r * 0.22)));
}
