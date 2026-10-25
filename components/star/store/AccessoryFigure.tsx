"use client";

/**
 * A player wearing store accessories — for the store's Accessories cards and
 * the "Your player" try-on (/star-store-dev).
 *
 * The body is the game's own footballer (`drawFigureAt`, the one figure every
 * screen draws), with a fake face so no head is ever a blank circle. The
 * accessories are drawn on top at the same anatomy points `paintBody` uses.
 *
 * A still picture: drawn once, and again when the face photo arrives. No
 * animation loop.
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { drawFigureAt, FEET_Y, ROLE_KIT, type BodyPose } from "@/lib/star/fiveASide/render";
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import type { AccessoryItem, Celebration } from "@/lib/star/store/catalogue";
import { signatureText, type SignatureWho } from "@/lib/star/signatureBoots";

// ── The anatomy, in units of r from the figure's local origin. These mirror
// paintBody in lib/star/fiveASide/render.ts (not exported there); the
// accessories only need to land on the same shoulders, hands and feet.
const SHOULDER_Y = -1.0;
const NECK_Y = -1.1;
const HEAD_ANCHOR = -1.184;
const HEAD_BASE_R = 0.114;

const KIT = { shirt: ROLE_KIT.you, shorts: "#064e3b", trim: ROLE_KIT.youRim };

/** Radians the whole man leans back on his knees. */
const CELEBRATION_LEAN: Partial<Record<Celebration, number>> = { knee_slide: -0.28 };

export const CELEBRATION_POSE: Record<Celebration, BodyPose> = {
  hands_up: { armLift: 1, armSpread: 0.12 },
  arms_out: { armSpread: 1, armLift: 0.1 },
  knee_slide: { crouch: 1, armSpread: 0.45, armLift: 1 },
  fist_pump: { armLift: 0.75, armSpread: 0.2, armLead: 1 },
  jump: { armLift: 1, armSpread: 0.35, crouch: 0.25 },
  roar: { armLift: -0.55, armSpread: 0.7 },
};

/**
 * Whose name Signature Boots carry, for every AccessoryFigure inside (the
 * career's store and the Locker set it from the career; absent: a placeholder).
 */
export const SignatureContext = createContext<SignatureWho | null>(null);

// One face photo for every preview, loaded once.
let faceImg: HTMLImageElement | null = null;
const waiting = new Set<() => void>();
function useFace(): HTMLImageElement | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!faceImg) {
      faceImg = new Image();
      faceImg.onload = () => { waiting.forEach((f) => f()); };
      faceImg.src = DEFAULT_FAKE_FACE;
    }
    const f = () => bump((n) => n + 1);
    waiting.add(f);
    return () => { waiting.delete(f); };
  }, []);
  return faceImg && faceImg.complete && faceImg.naturalWidth > 0 ? faceImg : undefined;
}

interface ArmGeom { shoulder: [number, number]; hand: [number, number] }

/** Where the shoulders and hands are for this pose — paintBody's arithmetic. */
function arms(r: number, pose: BodyPose): ArmGeom[] {
  const spread = pose.armSpread ?? 0;
  const lift = pose.armLift ?? -0.55;
  const sink = (pose.crouch ?? 0) * r * 0.16;
  const shY = SHOULDER_Y * r + sink;
  const shW = r * 0.42;
  const armFromY = shY + r * 0.02;
  const armLen = r * (0.42 + spread * 0.5);
  const outX = r * 0.3 + armLen * (0.35 + spread * 0.65);
  const handY = armFromY + armLen * (0.62 - lift * 0.85) * (1 - spread * 0.45);
  return [-1, 1].map((s) => ({ shoulder: [s * shW * 0.82, armFromY], hand: [s * outX, handY] }));
}

function along(a: ArmGeom, t: number): [number, number] {
  return [a.shoulder[0] + (a.hand[0] - a.shoulder[0]) * t, a.shoulder[1] + (a.hand[1] - a.shoulder[1]) * t];
}

function seg(ctx: CanvasRenderingContext2D, a: ArmGeom, t0: number, t1: number, width: number, color: string) {
  const p0 = along(a, t0), p1 = along(a, t1);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
}

function drawAccessories(ctx: CanvasRenderingContext2D, r: number, pose: BodyPose, wear: AccessoryItem[], face: HTMLImageElement | undefined) {
  const sink = (pose.crouch ?? 0) * r * 0.16;
  const style = face ? DEFAULT_FAKE_FACE_STYLE : DEFAULT_FACE_STYLE;
  const headR = HEAD_BASE_R * r * style.scale;
  const headX = style.offsetX * HEAD_BASE_R * r;
  const headY = HEAD_ANCHOR * r + sink + style.offsetY * HEAD_BASE_R * r;
  const armG = arms(r, pose);
  const by = (slot: AccessoryItem["slot"]) => wear.find((w) => w.slot === slot);

  const sleeves = by("arms");
  if (sleeves) {
    for (const a of armG) {
      seg(ctx, a, 0.05, 0.9, Math.max(1.4, r * 0.13), sleeves.color);
      seg(ctx, a, 0, 0.42, Math.max(1.4, r * 0.145), KIT.shirt); // the shirt's own sleeve over the top
    }
  }
  const tape = by("wrists");
  if (tape) {
    for (const a of armG) {
      seg(ctx, a, 0.76, 0.9, Math.max(1.6, r * 0.14), tape.color);
      seg(ctx, a, 0.83, 0.84, Math.max(1.6, r * 0.14), "rgba(15,23,42,0.35)");
    }
  }
  const band = by("armband");
  if (band) {
    const a = armG[0]; // his left arm, which is screen-left from behind
    if (band.stripes) {
      const n = band.stripes.length;
      band.stripes.forEach((c, i) => seg(ctx, a, 0.14 + (i * 0.2) / n, 0.14 + ((i + 1) * 0.2) / n, Math.max(2, r * 0.17), c));
    } else {
      seg(ctx, a, 0.14, 0.34, Math.max(2, r * 0.17), band.color);
      if (r > 40 && band.color2) {
        const [cx, cy] = along(a, 0.24);
        ctx.fillStyle = band.color2;
        ctx.font = `900 ${Math.round(r * 0.13)}px system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("C", cx, cy + r * 0.005);
      }
    }
  }
  const gloves = by("hands");
  if (gloves) {
    for (const a of armG) {
      ctx.fillStyle = gloves.color;
      ctx.strokeStyle = gloves.color2 ?? "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath(); ctx.arc(a.hand[0], a.hand[1], r * 0.105, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  const boots = by("boots");
  if (boots?.signature) {
    // Two-tone on the small figure: white boots, a gold stripe along each.
    const footY = FEET_Y * r;
    for (const fx of [-r * 0.19, r * 0.19]) {
      ctx.fillStyle = boots.color;
      ctx.beginPath(); ctx.ellipse(fx, footY, r * 0.125, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = boots.color2 ?? "#d4a017";
      ctx.lineWidth = Math.max(1.2, r * 0.035);
      ctx.beginPath(); ctx.moveTo(fx - r * 0.1, footY + r * 0.01); ctx.lineTo(fx + r * 0.1, footY - r * 0.015); ctx.stroke();
      ctx.strokeStyle = "rgba(15,23,42,0.45)";
      ctx.lineWidth = Math.max(0.8, r * 0.012);
      ctx.beginPath(); ctx.ellipse(fx, footY, r * 0.125, r * 0.07, 0, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (boots) {
    const footY = FEET_Y * r;
    for (const fx of [-r * 0.19, r * 0.19]) {
      ctx.fillStyle = boots.color;
      ctx.beginPath(); ctx.ellipse(fx, footY, r * 0.125, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = boots.color2 ?? "rgba(255,255,255,0.5)";
      ctx.lineWidth = Math.max(1, r * 0.022);
      ctx.beginPath(); ctx.moveTo(fx - r * 0.08, footY); ctx.lineTo(fx + r * 0.08, footY - r * 0.01); ctx.stroke();
    }
  }
  const snood = by("neck");
  if (snood) {
    const y = NECK_Y * r + sink;
    ctx.fillStyle = snood.color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-r * 0.19, y - r * 0.06, r * 0.38, r * 0.15, r * 0.06);
    else ctx.rect(-r * 0.19, y - r * 0.06, r * 0.38, r * 0.15);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = Math.max(1, r * 0.015);
    for (const k of [0.33, 0.66]) {
      ctx.beginPath(); ctx.moveTo(-r * 0.17, y - r * 0.06 + r * 0.15 * k); ctx.lineTo(r * 0.17, y - r * 0.06 + r * 0.15 * k); ctx.stroke();
    }
  }
  const head = by("head");
  if (head) {
    // A band across the forehead, clipped to the head so it wraps round it.
    // The face photo's head is narrower than its circle, so the band is kept
    // to the middle two thirds and sits on the forehead, under the hair.
    const bx = headR * 0.62, top = headY - headR * 0.6, h = headR * 0.2;
    ctx.fillStyle = head.color;
    ctx.beginPath();
    ctx.moveTo(headX - bx, top + h * 0.35);
    ctx.quadraticCurveTo(headX, top - h * 0.35, headX + bx, top + h * 0.35);
    ctx.lineTo(headX + bx, top + h * 1.35);
    ctx.quadraticCurveTo(headX, top + h * 0.65, headX - bx, top + h * 1.35);
    ctx.closePath(); ctx.fill();
    if (head.color2) {
      // Ninja tails, flowing off the side.
      ctx.fillStyle = head.color2;
      for (const k of [0, 1]) {
        ctx.beginPath();
        ctx.moveTo(headX + bx * 0.95, top + h * 0.4);
        ctx.lineTo(headX + bx + headR * (0.55 + k * 0.2), top + headR * (0.25 + k * 0.3));
        ctx.lineTo(headX + bx + headR * (0.42 + k * 0.2), top + headR * (0.4 + k * 0.3));
        ctx.lineTo(headX + bx * 0.95, top + h * 1.2);
        ctx.closePath(); ctx.fill();
      }
    }
  }
}

/**
 * Signature Boots, close up: one boot side-on, white with a gold stripe, the
 * name along its side and the number on the heel. `x, y` is the bottom of
 * the heel, `L` the boot's length, toe to the right.
 */
export function drawSignatureBoot(ctx: CanvasRenderingContext2D, x: number, y: number, L: number, item: AccessoryItem, who?: SignatureWho | null) {
  const H = L * 0.4;
  const gold = item.color2 ?? "#d4a017";
  const { name, number } = signatureText(who);
  ctx.save();
  ctx.translate(x, y);
  // The upper.
  const upper = () => {
    ctx.beginPath();
    ctx.moveTo(L * 0.02, -H * 0.16);
    ctx.lineTo(L * 0.9, -H * 0.16);
    ctx.quadraticCurveTo(L * 1.02, -H * 0.2, L * 0.99, -H * 0.42);
    ctx.quadraticCurveTo(L * 0.86, -H * 0.62, L * 0.58, -H * 0.7);
    ctx.quadraticCurveTo(L * 0.42, -H * 0.76, L * 0.34, -H * 1.02);
    ctx.lineTo(L * 0.1, -H * 1.02);
    ctx.quadraticCurveTo(-L * 0.02, -H * 0.8, L * 0.02, -H * 0.16);
    ctx.closePath();
  };
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = L * 0.06; ctx.shadowOffsetY = L * 0.02;
  upper();
  const fill = ctx.createLinearGradient(0, -H, 0, 0);
  fill.addColorStop(0, "#ffffff"); fill.addColorStop(1, item.color);
  ctx.fillStyle = fill; ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  upper(); ctx.clip();
  // The gold stripe, sweeping from the heel down toward the toe.
  ctx.strokeStyle = gold;
  ctx.lineWidth = H * 0.16;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(L * 0.12, -H * 0.42); ctx.quadraticCurveTo(L * 0.5, -H * 0.24, L * 0.92, -H * 0.36); ctx.stroke();
  // A gold heel counter.
  ctx.fillStyle = gold;
  ctx.fillRect(0, -H * 1.05, L * 0.1, H * 0.9);
  ctx.restore();
  ctx.strokeStyle = "rgba(15,23,42,0.55)"; ctx.lineWidth = Math.max(1, L * 0.012);
  upper(); ctx.stroke();
  // The sole and studs.
  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, -H * 0.18, L * 0.94, H * 0.12, H * 0.05); else ctx.rect(0, -H * 0.18, L * 0.94, H * 0.12);
  ctx.fill();
  ctx.fillStyle = gold;
  for (const k of [0.1, 0.3, 0.58, 0.8]) { ctx.beginPath(); ctx.rect(L * k, -H * 0.07, L * 0.06, H * 0.08); ctx.fill(); }
  // The name along the side, above the stripe, shrunk to fit.
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  let fs = H * 0.26;
  ctx.font = `900 italic ${fs.toFixed(1)}px system-ui, sans-serif`;
  const room = L * 0.5;
  const w = ctx.measureText(name).width;
  if (w > room) { fs *= room / w; ctx.font = `900 italic ${fs.toFixed(1)}px system-ui, sans-serif`; }
  ctx.fillStyle = "#1e293b";
  ctx.fillText(name, L * 0.58, -H * 0.5);
  // The number on the heel.
  if (number && name !== number) {
    ctx.font = `900 ${(H * 0.24).toFixed(1)}px system-ui, sans-serif`;
    ctx.fillStyle = "#a16207";
    ctx.fillText(number, L * 0.22, -H * 0.72);
  }
  ctx.restore();
}

export default function AccessoryFigure({
  wear, width, height, className = "", signature: signatureProp,
}: {
  wear: AccessoryItem[]; width: number; height: number; className?: string;
  /** Whose name / number Signature Boots carry (lib/star/signatureBoots.ts). Absent: a placeholder. */
  signature?: SignatureWho | null;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const face = useFace();
  const fromContext = useContext(SignatureContext);
  const signature = signatureProp ?? fromContext;
  const key = wear.map((w) => w.id).join(",") + `|${signature?.name ?? ""}|${signature?.number ?? ""}`;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const celeb = wear.find((w) => w.slot === "celebration")?.celebration;
    const pose = celeb ? CELEBRATION_POSE[celeb] : {};
    // Arms up reach above the head and arms out reach 1.2r to each side, so
    // leave room for both.
    const r = Math.min(width / 2.7, height * (celeb === "hands_up" || celeb === "knee_slide" ? 0.36 : 0.42));
    const facing = celeb ? CELEBRATION_LEAN[celeb] ?? 0 : 0;
    // Signature Boots: the man stands left to leave room for the close-up boot.
    const sigBoot = wear.some((w) => w.slot === "boots" && w.signature) && width >= 70 && height >= 60;
    const x = sigBoot ? width * 0.34 : width / 2;
    const ground = height * (celeb === "knee_slide" ? 0.86 : 0.9);

    drawFigureAt(ctx, x, ground, r, { ...KIT, face }, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { pose, facing });
    ctx.save();
    ctx.translate(x, ground - r * FEET_Y);
    if (facing) ctx.rotate(facing);
    drawAccessories(ctx, r, pose, wear, face);
    ctx.restore();
    // Signature Boots: a close-up of one boot in the corner, big enough to
    // read the name (the feet on the figure are too small for it).
    const sig = wear.find((w) => w.slot === "boots" && w.signature);
    if (sig && width >= 70 && height >= 60) {
      const L = Math.min(width * 0.5, height * 0.55);
      drawSignatureBoot(ctx, width - L - width * 0.03, height * 0.97, L, sig, signature);
    }
  }, [key, width, height, face, wear, signature]);

  return <canvas ref={ref} style={{ width, height }} className={className} aria-hidden />;
}
