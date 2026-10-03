"use client";
/**
 * The people in the garden: you, strolling the lawn with a ball in your own
 * club kit and skin tone, and real team-mates sitting on the bench in the
 * club's training tracksuit. Every face is a real photo (or the game's fake
 * face when there is none) drawn with the same crop/scale the match uses
 * (FaceStyle / FakeFaceStyle), just sized to these bodies.
 *
 * All motion is CSS on inner groups (never on an element that also carries
 * an SVG `transform`, which CSS would override).
 */
import { useEffect, useRef, useState } from "react";
import { CROP_VIEWPORT, type FaceStyle } from "@/lib/star/faceStyle";
import type { FakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { FAKE_FACES, fakeFaceFor } from "@/lib/star/fakeFaces";
import { sourceRect } from "@/lib/star/portrait";
import type { FaceImageCache } from "@/lib/star/faceImageCache";

export interface FaceKit {
  style: FaceStyle;
  fakeStyle: FakeFaceStyle;
  cache: FaceImageCache;
}

/** A real face in a circle of radius `r` at (cx, cy). A photo that fails to
 *  load falls back to the player's fake face, never a blank circle. */
export function PhotoHead({ cx, cy, r, url, fallbackKey, faces, skin }: {
  cx: number; cy: number; r: number; url: string | undefined; fallbackKey: string; faces: FaceKit; skin: string;
}) {
  const { style, fakeStyle, cache } = faces;
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [broken, setBroken] = useState(false);
  const clipId = useRef(`gdn-face-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    setBroken(false);
    if (!url || (FAKE_FACES as readonly string[]).includes(url)) return;
    const img = cache.get(url);
    if (!img || (img.complete && img.naturalWidth > 0)) return;
    const onError = () => window.setTimeout(() => setBroken(true), 1200);
    img.addEventListener("error", onError);
    return () => img.removeEventListener("error", onError);
  }, [url, cache]);

  const effectiveUrl = broken ? fakeFaceFor(fallbackKey) : url;
  const usingFake = !!effectiveUrl && (FAKE_FACES as readonly string[]).includes(effectiveUrl);

  useEffect(() => {
    setNatural(null);
    const img = cache.get(effectiveUrl);
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) { setNatural({ w: img.naturalWidth, h: img.naturalHeight }); return; }
    const onLoad = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [effectiveUrl, cache]);

  const eff = usingFake
    ? { ...style, scale: fakeStyle.scale, offsetX: fakeStyle.offsetX, offsetY: fakeStyle.offsetY, crop: fakeStyle.crop }
    : style;
  // The circle sits exactly on this body's neck: the style's scale/offsets
  // exist to fit a big head on the tiny match figure, so only its crop (what
  // part of the photo shows) and its on/off switches apply here.
  const hx = cx;
  const hy = cy;
  const hasPhoto = eff.facesEnabled && !!effectiveUrl && !!natural;

  let img: { x: number; y: number; w: number; h: number } | null = null;
  if (hasPhoto && natural) {
    const rect = sourceRect(eff.crop, natural.w, natural.h, CROP_VIEWPORT);
    const k = (r * 2) / rect.sw;
    img = { w: natural.w * k, h: natural.h * k, x: hx - r - rect.sx * k, y: hy - r - rect.sy * k };
  }
  return (
    <g>
      <circle cx={hx} cy={hy} r={r} fill={hasPhoto && !eff.showBacking ? "rgba(0,0,0,0.12)" : skin} />
      {img && (
        <>
          <clipPath id={clipId}><circle cx={hx} cy={hy} r={r} /></clipPath>
          <image href={effectiveUrl!} x={img.x} y={img.y} width={img.w} height={img.h} clipPath={`url(#${clipId})`} preserveAspectRatio="none" />
        </>
      )}
      {eff.outlineEnabled && (
        <circle cx={hx} cy={hy} r={r} fill="none" stroke={eff.outlineColor} strokeOpacity="0.85" strokeWidth={Math.max(0.6, r * 0.07)} />
      )}
    </g>
  );
}

export interface Outfit {
  shirt: string;
  trim: string;
  shorts: string;
  socks: string;
  skin: string;
  /** Long trousers / long sleeves instead of bare legs and arms (a team-mate
   *  in his tracksuit). Absent = the skin colour. */
  legs?: string;
  sleeves?: string;
}

/**
 * You, walking, side-on (feet at y = 0, about 96 tall). `walking` swings the
 * legs and arms; the caller moves the whole figure. Holds a ball at his feet
 * when `ball` is set — you, having a kick-about in your own garden.
 */
export function Walker({ outfit, faceUrl, faceKey, faces, ball = false, walking = true, shadow }: {
  outfit: Outfit; faceUrl: string | undefined; faceKey: string; faces: FaceKit; ball?: boolean; walking?: boolean; shadow: string;
}) {
  const leg = (back: boolean) => (
    <g className={walking ? (back ? "gdn-leg-b" : "gdn-leg-f") : undefined}>
      <path d="M -4,-40 L 4,-40 L 3.4,-14 L -3.2,-14 Z" fill={back ? shade(outfit.legs ?? outfit.skin) : outfit.legs ?? outfit.skin} />
      <path d="M -3.4,-17 L 3.6,-17 L 3.4,-4 L -3.2,-4 Z" fill={back ? shade(outfit.socks) : outfit.socks} />
      <path d="M -3.6,-5 L 4,-5 C 8,-5 10,-2 10,0.5 L -3.8,0.5 Z" fill={back ? "#111" : "#1d1d1d"} />
      <path d="M 1,-3 L 8,-2" stroke={outfit.trim} strokeWidth="0.9" />
    </g>
  );
  const arm = (back: boolean) => (
    <g className={walking ? (back ? "gdn-arm-b" : "gdn-arm-f") : undefined}>
      <path d="M -3.6,-70 L 3.6,-70 L 3,-59 L -3,-59 Z" fill={back ? shade(outfit.shirt) : outfit.shirt} />
      <rect x="-3.1" y="-60.5" width="6.2" height="2" fill={outfit.trim} />
      <path d="M -2.6,-58.5 L 2.6,-58.5 L 2.2,-46 L -2.2,-46 Z" fill={back ? shade(outfit.sleeves ?? outfit.skin) : outfit.sleeves ?? outfit.skin} />
      <circle cx="0" cy="-45" r="2.6" fill={back ? shade(outfit.skin) : outfit.skin} />
    </g>
  );
  return (
    <g>
      <ellipse cx="0" cy="1" rx="16" ry="3.2" fill={shadow} />
      <g className={walking ? "gdn-stride" : "gdn-bob"}>
        {leg(true)}
        {arm(true)}
        {/* shorts */}
        <path d="M -8,-46 L 8,-46 L 8.5,-34 L 0.5,-33 L 0,-37 L -0.5,-33 L -8.5,-34 Z" fill={outfit.shorts} />
        {leg(false)}
        {/* shirt */}
        <path d="M -9,-71 C -6,-73 6,-73 9,-71 L 8,-45 L -8,-45 Z" fill={outfit.shirt} />
        <path d="M -9,-71 C -6,-73 6,-73 9,-71 L 8.6,-62 C 4,-66 -4,-66 -8.6,-62 Z" fill="rgba(255,255,255,0.12)" />
        <path d="M 2,-71 L 8,-45 L 8,-71 Z" fill="rgba(0,0,0,0.12)" />
        <path d="M -4,-72 Q 0,-67 4,-72" stroke={outfit.trim} strokeWidth="1.8" fill="none" />
        <rect x="-8" y="-47.5" width="16" height="2.4" fill={outfit.trim} />
        {/* neck */}
        <rect x="-2.6" y="-76" width="5.2" height="5" fill={outfit.skin} />
        {arm(false)}
        <PhotoHead cx={0} cy={-84} r={11.5} url={faceUrl} fallbackKey={faceKey} faces={faces} skin={outfit.skin} />
      </g>
      {ball && (
        <g transform="translate(15 -5)">
          <ellipse cx="0" cy="5.4" rx="6" ry="1.4" fill={shadow} />
          <g className="gdn-roll">
            <image href="/star/ball.png" x="-5.5" y="-5.5" width="11" height="11" />
          </g>
        </g>
      )}
    </g>
  );
}

/** A colour, a little darker — the far leg and arm. */
export function shade(hex: string, k = 0.78): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = (v: number) => Math.round(v * k).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** A team-mate sitting on the bench, facing you (seat top at y = 0, the
 *  floor at y = 46). Knees up at seat height, shins down, forearms resting
 *  on his knees — so he reads as sitting, not standing in front of it. */
export function SeatedMate({ top, trim, faceUrl, faceKey, faces, hands, shadow, delay }: {
  top: string; trim: string; faceUrl: string | undefined; faceKey: string; faces: FaceKit; hands: string; shadow: string; delay: number;
}) {
  const trousers = shade(top, 0.5);
  const knee = shade(trousers, 1.35);
  return (
    <g>
      <ellipse cx="0" cy="46" rx="22" ry="3.4" fill={shadow} />
      {/* shins, a little apart, then trainers */}
      <path d="M -15,10 L -6,10 L -6.5,42 L -14,42 Z" fill={trousers} />
      <path d="M 6,10 L 15,10 L 14,42 L 6.5,42 Z" fill={trousers} />
      <path d="M -15.5,41 L -5,41 C -4,45 -5,47 -7,47 L -16,47 C -18,47 -18,43 -15.5,41 Z" fill="#f4f4f4" />
      <path d="M 5,41 L 15.5,41 C 18,43 18,47 16,47 L 7,47 C 5,47 4,45 5,41 Z" fill="#f4f4f4" />
      <rect x="-16" y="45.5" width="11" height="1.6" fill="#c9c9c9" />
      <rect x="5" y="45.5" width="11" height="1.6" fill="#c9c9c9" />
      <g className="gdn-bob" style={{ animationDelay: `-${delay}s` }}>
        {/* tracksuit top, sitting into the seat */}
        <path d="M -14,-36 C -10,-40 10,-40 14,-36 L 13,-1 L -13,-1 Z" fill={top} />
        <path d="M 5,-38 L 13,-1 L 14,-36 Z" fill="rgba(0,0,0,0.14)" />
        <path d="M -14,-36 C -10,-40 -2,-40 0,-39 L -2,-20 L -13,-24 Z" fill="rgba(255,255,255,0.10)" />
        <line x1="0" y1="-38" x2="0" y2="-2" stroke={trim} strokeWidth="1.3" />
        <path d="M -6,-39 L 0,-33 L 6,-39" stroke={trim} strokeWidth="2.2" fill="none" />
        {/* thighs coming towards you: short, wide, the knees catching the light */}
        <path d="M -16,-4 L -1,-4 L -2,12 C -6,14 -13,14 -16,12 Z" fill={trousers} />
        <path d="M 16,-4 L 1,-4 L 2,12 C 6,14 13,14 16,12 Z" fill={trousers} />
        <ellipse cx="-9.5" cy="10" rx="6.5" ry="3.6" fill={knee} />
        <ellipse cx="9.5" cy="10" rx="6.5" ry="3.6" fill={knee} />
        {/* arms: down to the elbow, forearms forward onto the knees */}
        <path d="M -14,-35 L -20,-31 L -19,-10 L -13,-10 Z" fill={shade(top, 0.88)} />
        <path d="M 14,-35 L 20,-31 L 19,-10 L 13,-10 Z" fill={shade(top, 0.88)} />
        <line x1="-18.5" y1="-31" x2="-17" y2="-11" stroke={trim} strokeWidth="1.2" />
        <line x1="18.5" y1="-31" x2="17" y2="-11" stroke={trim} strokeWidth="1.2" />
        <path d="M -19,-12 L -13,-12 L -9,5 L -15,6 Z" fill={top} />
        <path d="M 19,-12 L 13,-12 L 9,5 L 15,6 Z" fill={top} />
        <circle cx="-11.5" cy="7" r="3.4" fill={hands} />
        <circle cx="11.5" cy="7" r="3.4" fill={hands} />
        <rect x="-3.2" y="-45" width="6.4" height="7" fill={hands} />
        <PhotoHead cx={0} cy={-56} r={15} url={faceUrl} fallbackKey={faceKey} faces={faces} skin={hands} />
      </g>
    </g>
  );
}

export const PEOPLE_CSS = `
.gdn-stride { animation: gdnStride 0.36s ease-in-out infinite alternate; }
@keyframes gdnStride { from { transform: translateY(0); } to { transform: translateY(-1.8px); } }
.gdn-leg-f, .gdn-leg-b, .gdn-arm-f, .gdn-arm-b { transform-box: view-box; }
.gdn-leg-f { transform-origin: 0px -40px; animation: gdnLeg 0.72s ease-in-out infinite; }
.gdn-leg-b { transform-origin: 0px -40px; animation: gdnLeg 0.72s ease-in-out infinite reverse; }
.gdn-arm-f { transform-origin: 0px -69px; animation: gdnLeg 0.72s ease-in-out infinite reverse; }
.gdn-arm-b { transform-origin: 0px -69px; animation: gdnLeg 0.72s ease-in-out infinite; }
@keyframes gdnLeg { 0%,100% { transform: rotate(24deg); } 50% { transform: rotate(-24deg); } }
.gdn-roll { animation: gdnRoll 0.9s linear infinite; transform-box: fill-box; transform-origin: center; }
@keyframes gdnRoll { to { transform: rotate(360deg); } }
`;
