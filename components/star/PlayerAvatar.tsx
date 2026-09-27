"use client";

/**
 * YOUR PLAYER, IN HIS CLUB KIT — for the home screen.
 *
 * Harry, 27 Sep 2026: the middle home screen should have "maybe your player
 * in the club kit" — and, asked, "yes, in the first version".
 *
 * Drawn with the game's own figure (`drawFigureAt`, lib/star/fiveASide/
 * render.ts) — the same anatomy, the same head, the same face styling every
 * man on the pitch is drawn with — in your club's real home kit (kits.ts, or
 * the design your boardroom voted in), with your photo or the fake face the
 * match already gives you, and your chosen skin tone.
 *
 * A still picture: it draws once, and again when the face photo arrives. No
 * animation loop — a canvas that animates itself is exactly what the
 * one-engine guard watches for. The gentle bob is a CSS animation on the
 * element, which moves the picture, not anything in it.
 */
import { useEffect, useRef } from "react";
import type { CareerState } from "@/lib/star/types";
import { drawFigureAt, drawBall, bodyPoseFor, FIGURE_HEIGHT_R } from "@/lib/star/fiveASide/render";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { loadFaceStyle } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { createFaceImageCache } from "@/lib/star/faceImageCache";

export default function PlayerAvatar({ career, width, height, ball = true, className }: {
  career: CareerState; width: number; height: number; ball?: boolean; className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cache = useRef(createFaceImageCache());
  const club = career.player.club;
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const skin = skinToneHex(career.player.skinTone);
  const faceUrl = career.player.portrait ?? DEFAULT_FAKE_FACE;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const face = cache.current.get(faceUrl);
    const faceStyle = loadFaceStyle();
    const fakeFaceStyle = loadFakeFaceStyle();

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const groundY = height - Math.max(6, height * 0.06);
      // Head room above, and his arms kept inside the frame at any width.
      const r = Math.min((groundY - height * 0.08) / FIGURE_HEIGHT_R, width / 1.45);
      const x = width / 2 - (ball ? r * 0.2 : 0);
      drawFigureAt(
        ctx, x, groundY, r,
        { shirt: kit.shirt, shorts: kit.trim, trim: kit.trim, skin, face },
        faceStyle, fakeFaceStyle,
        { pose: { ...bodyPoseFor("idle", 0), armSpread: 0.12 }, shadowR: r * 0.5 },
      );
      if (ball) {
        // The game's own ball, at his feet. `unit` is pixels per metre at
        // this figure's size (drawFigure's FIGURE_R is 1.05 m per r). The
        // match draws the ball 2.6x life size so it can be found on a pitch;
        // next to one big figure that reads as a beach ball, so 0.42 of it.
        const unit = r / 1.05;
        drawBall(ctx, { px: (v) => v, py: (v) => v, unit, W: width, H: height }, { x: x + r * 0.62, y: groundY - r * 0.02 }, 0, 0.42);
      }
    };
    draw();
    if (face && !(face.complete && face.naturalWidth > 0)) {
      face.addEventListener("load", draw, { once: true });
      return () => face.removeEventListener("load", draw);
    }
  }, [width, height, kit.shirt, kit.trim, skin, faceUrl, ball]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width, height, display: "block" }}
      aria-label={`${career.player.firstName} ${career.player.lastName} in the ${club} kit`}
    />
  );
}
