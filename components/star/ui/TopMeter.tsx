"use client";
import type React from "react";
import { useId, useState } from "react";
import { SquareBar } from "./Flat";

/**
 * THE TOP-OF-SCREEN METER (Harry, 2 Oct 2026, v0.24, P1-37/P1-38: "have the
 * lightning sit above, like in 3D above it, kind of like an overlay", "a 3D
 * Earth … sit above the bar", "the same treatment for every other top bar").
 *
 * Every bar at the top of a screen is the same thing: a SQUARE bar with a
 * white edge (P1-10, P1-35) and its icon standing on the bar's left end, big
 * enough to rise above it, like a 3D badge laid over the bar.
 *
 *   <TopMeter icon={<HudIcon name="energy" />} value={energy} colors={levelColors(energy)}>{energy}</TopMeter>
 *   <TopMeter icon={<FillStar fraction={0.2}>12</FillStar>} value={20} colors={GOLD} />
 *
 * Icons come from public/icons3d/<name>.png (rendered in Blender); until a
 * picture exists, or if it fails to load, a drawn icon stands in.
 */
export function TopMeter({ icon, value, colors, children, className = "", barClass = "h-[18px]", tour, label, after }: {
  icon: React.ReactNode;
  /** 0-100. */
  value: number;
  colors: [string, string];
  /** Over the bar, centred (a number). */
  children?: React.ReactNode;
  className?: string;
  /** The bar's height. */
  barClass?: string;
  tour?: string;
  label?: string;
  /** Anything after the bar (a lock). */
  after?: React.ReactNode;
}) {
  return (
    <span data-tour={tour} aria-label={label} data-top-meter className={`relative flex min-w-0 items-center gap-1 pl-[30px] pr-2 ${className}`}>
      <SquareBar value={value} colors={colors} className={`${barClass} min-w-0 flex-1`} animate square>{children}</SquareBar>
      {after}
      {/* The icon stands on the bar's left end and rises above it. */}
      <span aria-hidden data-top-icon className="pointer-events-none absolute bottom-[1px] left-[1px] z-10 h-[44px] w-[44px]">{icon}</span>
    </span>
  );
}

/** The Blender icons builder F renders into public/icons3d/<name>.png (happiness is the smiley; heart is spare). Until a picture loads, happiness draws a heart. */
export type HudIconName = "energy" | "world" | "fame" | "happiness" | "heart" | "money";

/** Pictures that failed once this session: don't ask for them again. */
const missing = new Set<string>();

/**
 * A 3D icon from public/icons3d/<name>.png, with a drawn stand-in underneath
 * that shows until the picture has loaded (and stays if it never does), so
 * the HUD never shows a broken image.
 */
export function HudIcon({ name, className = "h-full w-full" }: { name: HudIconName; className?: string }) {
  const src = `/icons3d/${name}.png`;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(missing.has(src));
  return (
    <span data-hud-icon={name} data-hud-icon-3d={loaded ? "true" : "false"} className={`relative block ${className}`}>
      {!loaded && <DrawnIcon name={name} />}
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => { missing.add(src); setFailed(true); }}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ opacity: loaded ? 1 : 0, filter: "drop-shadow(0 2px 2px rgba(0,0,0,.6))" }}
        />
      )}
    </span>
  );
}

/** The drawn stand-ins: shaded so they read as solid, with a dark edge. */
function DrawnIcon({ name }: { name: HudIconName }) {
  const id = useId().replace(/:/g, "");
  const shadow = { filter: "drop-shadow(0 2px 2px rgba(0,0,0,.65))" };
  if (name === "energy") return (
    <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full" style={shadow}>
      <defs><linearGradient id={`e${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff7b0" /><stop offset=".45" stopColor="#facc15" /><stop offset="1" stopColor="#ea580c" /></linearGradient></defs>
      <path d="M18.5 2 6 18h8.2L11.5 30 26 12.6h-8.4L18.5 2Z" fill={`url(#e${id})`} stroke="#5b2a03" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M17 5.5 9.4 15.6h5.3" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (name === "world") return (
    <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full" style={shadow}>
      <defs>
        <radialGradient id={`w${id}`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#7dd3fc" /><stop offset=".6" stopColor="#0284c7" /><stop offset="1" stopColor="#0c4a6e" /></radialGradient>
        <clipPath id={`wc${id}`}><circle cx="16" cy="16" r="12.5" /></clipPath>
      </defs>
      <circle cx="16" cy="16" r="13" fill={`url(#w${id})`} stroke="#082f49" strokeWidth="1.6" />
      <g clipPath={`url(#wc${id})`} fill="#4ade80" stroke="#166534" strokeWidth=".7">
        <path d="M6 9c3-1 5 0 6 2s-1 3 1 5 1 4-1 5-4 0-5-2-3-2-2-5 0-4 1-5Z" />
        <path d="M17 6c2-1 5 0 7 2s1 3-1 4-2 2 0 4 2 4 0 6-3 2-4 0 0-4-2-5-1-3 0-5-1-5 0-6Z" />
      </g>
      <ellipse cx="11.5" cy="10" rx="4.5" ry="2.6" fill="#fff" opacity=".45" transform="rotate(-30 11.5 10)" />
    </svg>
  );
  if (name === "happiness" || name === "heart") return (
    <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full" style={shadow}>
      <defs><linearGradient id={`h${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbcfe8" /><stop offset=".45" stopColor="#ec4899" /><stop offset="1" stopColor="#9d174d" /></linearGradient></defs>
      <path d="M16 28S3.5 20.5 3.5 11.5C3.5 7.4 6.6 4.5 10.2 4.5c2.6 0 4.6 1.4 5.8 3.4 1.2-2 3.2-3.4 5.8-3.4 3.6 0 6.7 2.9 6.7 7 0 9-12.5 16.5-12.5 16.5Z" fill={`url(#h${id})`} stroke="#500724" strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse cx="10" cy="10" rx="3.2" ry="2" fill="#fff" opacity=".6" transform="rotate(-25 10 10)" />
    </svg>
  );
  if (name === "fame") return (
    <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full" style={shadow}>
      <defs><linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fef9c3" /><stop offset=".5" stopColor="#fbbf24" /><stop offset="1" stopColor="#b45309" /></linearGradient></defs>
      <path d="M16 2.5 19.2 12.8 29.5 16 19.2 19.2 16 29.5 12.8 19.2 2.5 16 12.8 12.8Z" fill={`url(#f${id})`} stroke="#5b3a00" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="3" fill="#fff" opacity=".8" />
    </svg>
  );
  // money: a gold coin with the game's ★.
  return (
    <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full" style={shadow}>
      <defs><radialGradient id={`m${id}`} cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#fef08a" /><stop offset=".6" stopColor="#f59e0b" /><stop offset="1" stopColor="#92400e" /></radialGradient></defs>
      <circle cx="16" cy="16" r="13" fill={`url(#m${id})`} stroke="#5b3a00" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff7d6" strokeOpacity=".55" strokeWidth="1" />
      <path d="M16 9.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L16 19.3l-3.8 2 .7-4.3-3.1-3 4.3-.6Z" fill="#fffbeb" stroke="#92400e" strokeWidth=".8" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * THE STAR THAT FILLS (Harry, 2 Oct 2026, P1-39/P1-40: "a full star that fills
 * up along with the bar, how much you are into that level. If it was like 20%
 * up, you'd be 20% full in that star").
 *
 * A yellow star that fills from the bottom with your way through the level,
 * glows and breathes, with a light that sweeps across it. The level number
 * sits on it (children). Stills (reduced motion) keep the fill and the glow.
 */
export function FillStar({ fraction, children, className = "h-full w-full", duration }: {
  /** 0-1 of the way through the level. */
  fraction: number;
  /** How long the gold takes to rise to a new fraction, in ms (1100 by default); 0 jumps. */
  duration?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const f = Math.max(0, Math.min(1, fraction));
  const [ok, setOk] = useState(0);
  const [failed, setFailed] = useState(missing.has(STAR_FULL) || missing.has(STAR_EMPTY));
  const fail = (src: string) => { missing.add(src); setFailed(true); };
  // Blender's pair (builder F): the grey star, and the gold one cut off at
  // your way through the level. The star's body runs from 6.6% to 93.4% of
  // the picture's height (measured from its alpha), so 0 and 1 land exactly
  // on its bottom and top points.
  const cut = 6.6 + 86.8 * (1 - f);
  const glide = duration === undefined ? undefined : duration === 0 ? "none" : `clip-path ${duration}ms cubic-bezier(.45, .05, .35, 1)`;
  const shown = ok >= 2 && !failed;
  const mask = `url(${STAR_FULL})`;
  return (
    <span data-fill-star={Math.round(f * 100)} data-fill-star-3d={shown ? "true" : "false"} className={`sk-star relative block ${className}`}>
      {!shown && <DrawnFillStar fraction={f} duration={duration} />}
      {!failed && (
        <span className="sk-star-glow absolute inset-0" style={{ opacity: shown ? 1 : 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={STAR_EMPTY} alt="" draggable={false} onLoad={() => setOk((n) => n + 1)} onError={() => fail(STAR_EMPTY)} className="absolute inset-0 h-full w-full object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={STAR_FULL} alt="" draggable={false} onLoad={() => setOk((n) => n + 1)} onError={() => fail(STAR_FULL)} className="sk-star-cut absolute inset-0 h-full w-full object-contain" style={{ clipPath: `inset(${cut}% 0 0 0)`, transition: glide }} />
          {/* A light that sweeps across the gold. */}
          <span aria-hidden className="sk-star-sweep absolute inset-0" style={{ clipPath: `inset(${cut}% 0 0 0)`, transition: glide, WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
        </span>
      )}
      {children != null && (
        <span className="sk-num absolute inset-0 flex items-center justify-center pt-[4px] text-[14px] font-black leading-none tabular-nums text-white"
          style={{ textShadow: "-1px -1px 0 #5b3a00, 1px -1px 0 #5b3a00, -1px 1px 0 #5b3a00, 1px 1px 0 #5b3a00, 0 1px 3px rgba(0,0,0,.8)" }}>
          {children}
        </span>
      )}
    </span>
  );
}

const STAR_FULL = "/icons3d/star-full.png";
const STAR_EMPTY = "/icons3d/star-empty.png";

/** The drawn stand-in for FillStar, until (or unless) the Blender pair loads. */
function DrawnFillStar({ fraction, duration }: { fraction: number; duration?: number }) {
  const id = useId().replace(/:/g, "");
  const f = Math.max(0, Math.min(1, fraction));
  // The star's body runs from y=1.6 to y=22.6 in its 24-unit box.
  const top = 1.6, h = 21;
  const fillY = top + h * (1 - f);
  const glide = duration === undefined ? undefined : duration === 0 ? "none" : `transform ${duration}ms cubic-bezier(.45, .05, .35, 1)`;
  const STAR = "M12 1.6l3.2 6.5 7.2 1-5.2 5.1 1.2 7.2L12 18l-6.4 3.4 1.2-7.2L1.6 9.1l7.2-1Z";
  return (
      <svg viewBox="0 0 24 24" className="sk-star-glow absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <clipPath id={`sc${id}`}><path d={STAR} /></clipPath>
          <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff7b0" /><stop offset=".45" stopColor="#fde047" /><stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id={`ss${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* The empty star. */}
        <path d={STAR} fill="rgba(20,14,2,.78)" />
        <g clipPath={`url(#sc${id})`}>
          {/* The gold, filled from the bottom to your way through the level. */}
          <rect x="0" y="0" width="24" height="24" fill={`url(#sg${id})`} className="sk-star-fill" style={{ transform: `translateY(${fillY}px)`, transition: glide }} />
          {/* The surface of the gold. */}
          {f > 0.02 && f < 0.98 && <rect x="0" y="0" width="24" height=".9" fill="#fffbe0" opacity=".9" className="sk-star-fill" style={{ transform: `translateY(${fillY}px)`, transition: glide }} />}
          {/* A light that sweeps across. */}
          <rect x="-12" y="0" width="10" height="24" fill={`url(#ss${id})`} className="sk-star-sheen" />
        </g>
        <path d={STAR} fill="none" stroke="#fde047" strokeWidth="1.1" strokeLinejoin="round" />
        <path d={STAR} fill="none" stroke="#5b3a00" strokeWidth=".45" strokeLinejoin="round" />
      </svg>
  );
}
