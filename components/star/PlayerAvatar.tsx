"use client";

/**
 * YOUR PLAYER, IN HIS CLUB KIT — the hero of the home screen.
 *
 * Harry, 27 Sep 2026: the middle home screen should have "maybe your player
 * in the club kit". 28 Sep: "the avatar being so 2D is also making it look
 * not as good, and it just has no flash to it" — so there are now two looks,
 * both in lib/star/heroFigure.ts, for him to pick between by eye:
 *
 *   A1 "2D"        — the game's own flat figure (drawFigureAt), drawn exactly
 *                    as in the match (no rim lights — 1 Oct 2026, they made
 *                    him look cut out).
 *   A2 "Pseudo-3D" — a more solid figure drawn for this screen: shaded limbs,
 *                    kit folds, a 3/4 turn, the crest on the chest and the
 *                    squad number on the shorts.
 *
 * AVATAR_STYLE below is the one line that picks. For comparing on a phone,
 * localStorage "star-avatar-style" = "A1" | "A2" overrides it (dev only —
 * see useAvatarStyle).
 *
 * A still picture: it draws once, and again when the face photo arrives or a
 * celebration starts/ends. No animation loop — a canvas that animates itself
 * is exactly what the one-engine guard watches for. The breathing and the
 * win hop are CSS on the element (HomeFx.tsx).
 */
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { drawFigureAt, drawBall, bodyPoseFor, FIGURE_HEIGHT_R, FEET_Y } from "@/lib/star/fiveASide/render";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { loadFaceStyle } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { createFaceImageCache } from "@/lib/star/faceImageCache";
import { paintHeroBack } from "@/lib/star/heroBack";
import { compositeLit, paintHeroFigure, paintHeroShadow, HERO_W, HERO_H, HERO_TOP, HERO_CREST, type AvatarStyle } from "@/lib/star/heroFigure";
import { fitImage, getFittedHead } from "@/lib/star/faceFit";
import ClubBadge from "./ClubBadge";
import { useScannedPortrait } from "./useScannedPortrait";

/** The colour of the rim light on the far side: the shirt, or the trim when
 *  the shirt is white (a white rim on a white shirt is invisible). */
function rimOf(kit: { shirt: string; trim: string }): string {
  return /^#?f{6}$/i.test(kit.shirt.trim()) ? kit.trim : kit.shirt;
}

/** THE ONE LINE: which avatar the home screen shows. */
export const AVATAR_STYLE: AvatarStyle = "A2";

/** AVATAR_STYLE, unless this browser has asked for the other one (for
 *  filming both side by side). Read after mount so the server render and the
 *  first client render agree. */
export function useAvatarStyle(): AvatarStyle {
  const [s, setS] = useState<AvatarStyle>(AVATAR_STYLE);
  useEffect(() => {
    try {
      const v = localStorage.getItem("star-avatar-style");
      if (v === "A1" || v === "A2") setS(v);
    } catch { /* private mode: the constant stands */ }
  }, []);
  return s;
}

/** Face fit on (the default) or off — localStorage "star-avatar-facefit" =
 *  "0" turns it off in this browser, for filming before and after. */
export function useFaceFit(): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem("star-avatar-facefit") === "0") setOn(false); } catch { /* the default stands */ }
  }, []);
  return on;
}

/** The A2 figure's scale in a box: the empty strip above the raised hands
 *  (HERO_TOP) is cropped off so he is as big as the box allows. */
function heroScale(width: number, height: number): number {
  return Math.min(width / HERO_W, height / (HERO_H - HERO_TOP));
}

/** Where the A1 (2D) man stands in a box: ground line, size, centre. */
function a1Geometry(width: number, height: number, ball: boolean) {
  const groundY = height - Math.max(8, height * 0.07);
  const r = Math.min((groundY - height * 0.1) / FIGURE_HEIGHT_R, width / 1.45);
  const x = width / 2 - (ball ? r * 0.2 : 0);
  return { groundY, r, x };
}

export default function PlayerAvatar({ career, width, height, ball = true, className, look = AVATAR_STYLE, celebrate = false, view = "front" }: {
  career: CareerState; width: number; height: number; ball?: boolean; className?: string;
  look?: AvatarStyle;
  /** Arms up — the win celebration (HomeHub decides when). */
  celebrate?: boolean;
  /** "back": the same A2 man from behind — surname and number on the shirt,
   *  the back of his head (lib/star/heroBack.ts). Spin your player uses it. */
  view?: "front" | "back";
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cache = useRef(createFaceImageCache());
  const club = career.player.club;
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const skin = skinToneHex(career.player.skinTone);
  // An old save's photo is face-scanned once, the first time it is shown
  // (useScannedPortrait); until then the old photo is used as before.
  const scanned = useScannedPortrait(career.player.portrait);
  const faceUrl = scanned ?? career.player.portrait ?? DEFAULT_FAKE_FACE;
  const number = career.squadNumber ?? null;
  const fitOn = useFaceFit() && look === "A2";
  // Bumped when the readable copy of the face has loaded, so the fitted
  // head is built and drawn.
  const [fitTick, setFitTick] = useState(0);
  useEffect(() => {
    if (!fitOn) return;
    const img = fitImage(faceUrl);
    let alive = true;
    const ready = () => { if (alive) setFitTick((t) => t + 1); };
    if (img.complete && img.naturalWidth) ready();
    else img.addEventListener("load", ready, { once: true });
    return () => { alive = false; img.removeEventListener("load", ready); };
  }, [faceUrl, fitOn]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const face = cache.current.get(faceUrl);
    const faceStyle = loadFaceStyle();
    const fakeFaceStyle = loadFakeFaceStyle();

    const drawA1 = (ctx: CanvasRenderingContext2D) => {
      // The figure on its own layer first, so it can be lit and rimmed
      // without touching anything behind it.
      const layer = document.createElement("canvas");
      layer.width = canvas.width; layer.height = canvas.height;
      const lx = layer.getContext("2d");
      if (!lx) return;
      lx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { groundY, r, x } = a1Geometry(width, height, ball);
      // A soft floor shadow on the main canvas, under the lit layer.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fs = ctx.createRadialGradient(x, groundY, 2, x, groundY, r * 0.75);
      fs.addColorStop(0, "rgba(0,0,0,0.55)"); fs.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fs;
      ctx.beginPath(); ctx.ellipse(x, groundY, r * 0.75, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      const pose = celebrate
        ? { armSpread: 0.15, armLift: 2.2 } // a V above the head (armLift past 1 lifts the hands over the shoulders)
        : { ...bodyPoseFor("idle", 0), armSpread: 0.12 };
      drawFigureAt(
        lx, x, groundY, r,
        { shirt: kit.shirt, shorts: kit.trim, trim: kit.trim, skin, face },
        // No white ring traced round the head either: blown up to hero size
        // it is the thick white "cut-out" edge, not a thin line as on the pitch.
        { ...faceStyle, outlineEnabled: false }, fakeFaceStyle,
        // Always the flat match figure here: A1 is what the 2D pill shows.
        { pose, shadowR: 0.001, liftPx: celebrate ? r * 0.05 : 0, skin: "classic", edge: 0.35 },
      );
      if (ball) {
        const unit = r / 1.05;
        drawBall(lx, { px: (v) => v, py: (v) => v, unit, W: width, H: height }, { x: x + r * 0.62, y: groundY - r * 0.02 }, 0, 0.42);
      }
      // Drawn exactly as the match draws him — no rim lights. Harry, 1 Oct
      // 2026: the warm-white rim round the 2D man made him look "cut out",
      // not like the players on the pitch.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(layer, 0, 0);
    };

    const drawA2 = (ctx: CanvasRenderingContext2D) => {
      // Painted on its own layer too, so it gets the same rim lights as A1
      // (it does its own shading, so no shading pass on top).
      const layer = document.createElement("canvas");
      layer.width = canvas.width; layer.height = canvas.height;
      const lx = layer.getContext("2d");
      if (!lx) return;
      const s = heroScale(width, height);
      // FACE FIT: the head built from the photo for this body, and the
      // body's skin taken from the face (faceFit.ts). Until the photo has
      // loaded readably this is null and the plain pasted head is drawn.
      const fitted = fitOn ? getFittedHead(faceUrl) : null;
      lx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (width - HERO_W * s) / 2, dpr * (height - HERO_H * s));
      const heroLook = { shirt: kit.shirt, shorts: kit.trim, trim: kit.trim, skin: fitted?.skin ?? skin, face, number, fitted };
      if (view === "back") paintHeroBack(lx, { ...heroLook, surname: career.player.lastName, key: `${career.player.firstName} ${career.player.lastName}` });
      else paintHeroFigure(lx, heroLook, faceStyle, fakeFaceStyle, { armsUp: celebrate, shadow: false });
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (width - HERO_W * s) / 2, dpr * (height - HERO_H * s));
      paintHeroShadow(ctx);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      compositeLit(ctx, layer, { rim: rimOf(kit), d: Math.max(3, 2 * dpr), shade: false });
    };

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // The back exists only as the A2 figure.
      if (look === "A2" || view === "back") drawA2(ctx); else drawA1(ctx);
    };
    draw();
    if (face && !(face.complete && face.naturalWidth > 0)) {
      face.addEventListener("load", draw, { once: true });
      return () => face.removeEventListener("load", draw);
    }
  }, [width, height, kit.shirt, kit.trim, skin, faceUrl, ball, look, celebrate, number, fitOn, fitTick, view, career.player.lastName, career.player.firstName]);

  // A2's crest sits on the chest as a real badge (the game's ClubBadge), not
  // a drawing of one. Hidden while the arms are up — it would float.
  const s = heroScale(width, height);
  // The 2D man wears the crest too, on the left breast, so he is in his
  // club's kit rather than a plain shirt (Harry, 1 Oct 2026).
  const a1 = a1Geometry(width, height, ball);
  const crest = celebrate || view !== "front" ? null : look === "A2" ? {
    left: (width - HERO_W * s) / 2 + HERO_CREST.x * HERO_W * s,
    top: (height - HERO_H * s) + HERO_CREST.y * HERO_H * s,
    size: Math.max(12, Math.round(HERO_CREST.size * HERO_W * s)),
  } : {
    left: a1.x + a1.r * 0.17,
    top: a1.groundY - a1.r * (FEET_Y + 0.78),
    size: Math.max(12, Math.round(a1.r * 0.2)),
  };

  return (
    <div className={className} style={{ position: "relative", width, height }}>
      <canvas
        ref={ref}
        style={{ width, height, display: "block" }}
        aria-label={`${career.player.firstName} ${career.player.lastName} in the ${club} kit`}
      />
      {crest && (
        <div style={{ position: "absolute", left: crest.left - crest.size / 2, top: crest.top - crest.size / 2, transform: "rotate(-4deg)", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.45))" }}>
          <ClubBadge club={club} kit={kit} size={crest.size} />
        </div>
      )}
    </div>
  );
}
