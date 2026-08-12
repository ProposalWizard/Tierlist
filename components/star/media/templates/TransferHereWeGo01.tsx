"use client";
import { useId } from "react";
import { crestInitials, paletteFor } from "@/lib/star/media/graphics/palette";

/**
 * TRANSFER_HERE_WE_GO_01
 *
 * The signing announcement. Six layers, and the order is the whole design:
 *
 *   1. ground        club-coloured night, near-black at the bottom
 *   2. floodlight    a radial wash and two angled shafts
 *   3. crest         one enormous ghosted badge, the real subject of the poster
 *   4. figure        the pose, bottom-anchored, pushed through a duotone
 *   5. fade          darkness climbing the bottom third so type has somewhere to sit
 *   6. type          byline, the headline, the from → to strip
 *
 * The duotone on layer 4 is the load-bearing trick. The figure is a stock pose
 * in a blank white kit and the face is a 120px portrait from somewhere else
 * entirely; once both are pushed through the same two-colour ramp in the club's
 * palette, they stop reading as two images stuck together and start reading as
 * one treated photograph. Without it this template does not work at all.
 */

export interface TransferHereWeGoProps {
  playerName: string;
  toClub: string;
  fromClub?: string;
  fee?: string;
  headline?: string;
  byline?: string;
  /** The pose. Bottom-anchored; anything from waist-up to full-body works. */
  poseSrc?: string;
  /** The player's face, dropped at the pose's anchor. */
  faceSrc?: string;
  /** Where the face sits on THIS pose, as fractions of the frame. */
  faceAnchor?: { x: number; y: number; size: number };
  /**
   * Where this pose's neck is, as a fraction down the figure layer.
   *
   * THE thing that makes a face swap work or not. Laying a face over an
   * existing head leaves the original head showing round the edges — different
   * hair, different jaw, different ears, a halo of the wrong person — which no
   * amount of feathering hides. So the pose's own head is not covered, it is
   * REMOVED: everything above this line fades out, and the face supplies the
   * whole head rather than a patch of one.
   */
  neckY?: number;
  /**
   * Luminance correction on the face alone, before the duotone.
   *
   * The pose and the face are two photographs taken by different people under
   * different lights, and the duotone unifies hue but not exposure — a face two
   * stops darker than the arms it sits on still reads as pasted. This lifts or
   * drops the face until the two match, and then the tint lands on both equally.
   */
  faceLift?: number;
  kitPrimary: string;
  kitSecondary?: string;
  /** 0 = untouched photo, 1 = full duotone. */
  treatment?: number;
}

export default function TransferHereWeGo01({
  playerName, toClub, fromClub, fee,
  headline = "HERE WE GO",
  byline = "TRANSFER CONFIRMED",
  poseSrc, faceSrc, faceAnchor = { x: 0.5, y: 0.17, size: 0.135 },
  neckY = 0.235, faceLift = 1,
  kitPrimary, kitSecondary, treatment = 0.85,
}: TransferHereWeGoProps) {
  const c = paletteFor(kitPrimary, kitSecondary);
  const uid = useId().replace(/:/g, "");
  const initials = crestInitials(toClub);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{ aspectRatio: "4 / 5", background: c.ground, isolation: "isolate", containerType: "inline-size" }}
    >
      {/* 1–2 — the ground, and the lights above it */}
      <div className="absolute inset-0" style={{
        background:
          `radial-gradient(120% 70% at 50% -10%, ${c.groundLift} 0%, transparent 62%),`
          + `linear-gradient(180deg, transparent 40%, #000 130%)`,
      }} />
      <div className="absolute inset-0 opacity-[0.16]" style={{
        background:
          `linear-gradient(104deg, transparent 34%, #fff 40%, transparent 46%),`
          + `linear-gradient(76deg, transparent 56%, #fff 61%, transparent 67%)`,
        filter: "blur(9px)",
      }} />

      {/* 3 — the crest. Procedural, because the career has no badge files: a
             double ring and the club's initials, blown up and ghosted. It is
             the largest object on the poster and it is barely visible, which is
             exactly the job it is doing. */}
      <div className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2" style={{ width: "82%" }}>
        <svg viewBox="0 0 100 100" className="w-full" style={{ opacity: 0.17 }}>
          <circle cx="50" cy="50" r="47" fill="none" stroke="#fff" strokeWidth="1.4" />
          <circle cx="50" cy="50" r="41" fill="none" stroke="#fff" strokeWidth="0.6" />
          <circle cx="50" cy="50" r="34" fill="#fff" fillOpacity="0.06" />
          <text
            x="50" y="50" textAnchor="middle" dominantBaseline="central"
            fill="#fff" fontSize={initials.length > 2 ? 26 : 34}
            style={{ fontWeight: 900, letterSpacing: "0.02em" }}
          >
            {initials}
          </text>
        </svg>
      </div>

      {/* 4 — the figure, duotoned.
             greyscale first so the ramp has a clean luminance to work from,
             then the club colour multiplied into the shadows and a near-white
             screened into the highlights. Two blend layers, one figure. */}
      <div className="absolute inset-x-0 bottom-0 top-[6%]" style={{ isolation: "isolate" }}>
        <div className="relative h-full w-full">
          {poseSrc ? (
            <img
              src={poseSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-contain object-bottom"
              style={{
                filter: `grayscale(${treatment}) contrast(${1 + treatment * 0.25}) brightness(1.06)`,
                // The head is cut off, not covered. A short fade rather than a
                // hard line, so the join reads as shadow under a jaw.
                ...(faceSrc ? {
                  WebkitMaskImage: `linear-gradient(180deg, transparent ${(neckY - 0.055) * 100}%, #000 ${neckY * 100}%)`,
                  maskImage: `linear-gradient(180deg, transparent ${(neckY - 0.055) * 100}%, #000 ${neckY * 100}%)`,
                } : {}),
              }}
            />
          ) : (
            <StandIn />
          )}

          {faceSrc && (
            <img
              src={faceSrc}
              alt=""
              className="absolute rounded-full object-cover"
              style={{
                left: `${faceAnchor.x * 100}%`,
                top: `${faceAnchor.y * 100}%`,
                width: `${faceAnchor.size * 100}%`,
                transform: "translate(-50%, -50%)",
                aspectRatio: "1 / 1",
                filter: `grayscale(${treatment}) contrast(${1 + treatment * 0.25}) brightness(${(1.06 * faceLift).toFixed(3)})`,
                // Generous and soft at the bottom only. The sides and top are
                // left alone — with the pose's head already gone there is
                // nothing behind the face to hide, and a tight circular crop was
                // cutting off hair and ears and making it look like a sticker.
                WebkitMaskImage: "radial-gradient(115% 92% at 50% 40%, #000 62%, transparent 88%)",
                maskImage: "radial-gradient(115% 92% at 50% 40%, #000 62%, transparent 88%)",
              }}
            />
          )}

          {/* ── The two ends of the ramp, and they go the way round you would
                 not guess ──
                 SCREEN with the dark colour lifts the blacks up to it; MULTIPLY
                 with the light colour pulls the whites down to it. Written the
                 obvious way round — multiply the dark, screen the light — both
                 layers darken and the figure disappears into the background,
                 which is exactly what the first pass did. */}
          <div className="pointer-events-none absolute inset-0" style={{
            background: c.duoDark, mixBlendMode: "screen", opacity: treatment,
          }} />
          <div className="pointer-events-none absolute inset-0" style={{
            background: c.duoLight, mixBlendMode: "multiply", opacity: treatment,
          }} />
        </div>
      </div>

      {/* 5 — darkness climbing the bottom third */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]" style={{
        background: `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 52%, rgba(0,0,0,0.94) 100%)`,
      }} />
      <div className="pointer-events-none absolute inset-0" style={{
        boxShadow: "inset 0 0 70px 12px rgba(0,0,0,0.45)",
      }} />

      {/* 6 — type */}
      <div className="absolute left-3 top-3 leading-none">
        <div className="text-[8px] font-black uppercase tracking-[0.28em] text-white/85">{byline}</div>
        {fromClub && (
          <div className="mt-1 text-[9px] font-black uppercase tracking-wider" style={{ color: c.accent }}>
            {fromClub} <span className="text-white/60">→</span> {toClub}
          </div>
        )}
      </div>

      {fee && (
        <div
          className="absolute right-3 top-3 rounded px-1.5 py-0.5 text-[10px] font-black text-white"
          style={{ background: c.primary }}
        >
          {fee}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/90">
          {playerName}
        </div>
        {/* ── The headline, drawn as SVG so it always fits ──
               A fixed font size cannot work here: the headline is a slot, and
               "HERE WE GO", "BREAKING" and "CHAMPIONS OF ENGLAND" are wildly
               different widths. Any number tuned for one clips or strands the
               others — the first pass was tuned for one and clipped the O.
               `textLength` with `lengthAdjust="spacingAndGlyphs"` squeezes the
               glyphs to exactly the width available, which is also precisely
               how a condensed poster face behaves. It fits by construction. */}
        <svg
          viewBox="0 0 100 17"
          preserveAspectRatio="none"
          className="mt-[2px] block w-full"
          style={{ filter: "drop-shadow(0 3px 9px rgba(0,0,0,0.75))" }}
        >
          <defs>
            <linearGradient id={`metal-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="42%" stopColor="#ffffff" />
              <stop offset="52%" stopColor="#9fb3c8" />
              <stop offset="64%" stopColor="#f2f7fd" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          <text
            x="0" y="14.6"
            textLength="100"
            lengthAdjust="spacingAndGlyphs"
            fontSize="15.5"
            fill={`url(#metal-${uid})`}
            style={{ fontWeight: 900, fontFamily: "inherit" }}
          >
            {headline.toUpperCase()}
          </text>
        </svg>
        <div className="mt-2 h-[3px] w-14 rounded-full" style={{ background: c.accent }} />
      </div>

      {/* grain */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-overlay" style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>"
          + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter>"
          + "<rect width='120' height='120' filter='url(%23n)'/></svg>\")",
      }} />
    </div>
  );
}

/**
 * What sits there until a real pose is dropped in.
 *
 * Deliberately a figure with tonal range rather than a flat silhouette — a flat
 * shape has nothing for the duotone to act on, so a silhouette stand-in would
 * make the treatment look like it does nothing.
 */
function StandIn() {
  return (
    <svg viewBox="0 0 200 320" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id="sk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c9a184" /><stop offset="45%" stopColor="#e7c3a6" />
          <stop offset="100%" stopColor="#a67b5f" />
        </linearGradient>
        <linearGradient id="kt" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#cfd6dd" /><stop offset="42%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#aab4bf" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="46" rx="25" ry="30" fill="url(#sk)" />
      <path d="M88 70h24v16H88z" fill="url(#sk)" />
      <path d="M62 86q38-14 76 0l10 92H52z" fill="url(#kt)" />
      <path d="M62 88 44 176l16 5 14-78z" fill="url(#kt)" />
      <path d="M138 88l18 88-16 5-14-78z" fill="url(#kt)" />
      <rect x="44" y="176" width="17" height="46" rx="8" fill="url(#sk)" />
      <rect x="139" y="176" width="17" height="46" rx="8" fill="url(#sk)" />
      <path d="M56 178h88l6 62H50z" fill="url(#kt)" />
      <rect x="62" y="240" width="30" height="66" rx="10" fill="url(#sk)" />
      <rect x="108" y="240" width="30" height="66" rx="10" fill="url(#sk)" />
    </svg>
  );
}
