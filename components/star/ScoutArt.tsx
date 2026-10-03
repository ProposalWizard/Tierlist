"use client";

/**
 * THE SCOUT, AND THE NIGHT HE SAW YOU (Harry, 2 Oct 2026, v0.25 point 9:
 * "a tiny box in the middle, the rest blank — make it full screen").
 *
 * Shared by the trial's closing beat (TrialSequence.tsx) and the scout's
 * offer (ManagerTalk.tsx): the floodlit stadium already used on Home
 * (public/home/tall-night.webp) behind a dark fade, and a drawn scout in a
 * long coat with his notebook. Better art (Higgsfield/Blender) comes later;
 * swap the drawing here and both screens get it.
 */

export const SCOUT_BG = "/home/tall-night.webp";

/** The floodlit stand behind the whole screen, faded to dark at the bottom. */
export function ScoutBackdrop({ glow = "#10b981" }: { glow?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${SCOUT_BG})`, filter: "saturate(1.1)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(90% 55% at 50% 30%, ${glow}55 0%, transparent 65%), linear-gradient(180deg, rgba(5,7,13,.35) 0%, rgba(5,7,13,.55) 40%, rgba(5,7,13,.93) 72%, #05070d 100%)`,
        }}
      />
    </div>
  );
}

/** A scout in a long coat and flat cap, writing in his notebook. */
export function ScoutFigure({ className = "h-40 w-40", coat = "#1f2937" }: { className?: string; coat?: string }) {
  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden>
      <defs>
        <linearGradient id="scoutCoat" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={coat} />
          <stop offset="1" stopColor="#0b1020" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="134" rx="34" ry="5" fill="rgba(0,0,0,.45)" />
      {/* legs */}
      <rect x="47" y="104" width="10" height="28" rx="3" fill="#111827" />
      <rect x="63" y="104" width="10" height="28" rx="3" fill="#111827" />
      {/* coat */}
      <path d="M36 52 Q60 42 84 52 L92 112 Q60 120 28 112 Z" fill="url(#scoutCoat)" stroke="#000" strokeOpacity=".35" strokeWidth="1.5" />
      <path d="M60 50 L60 114" stroke="#000" strokeOpacity=".3" strokeWidth="1.5" />
      {/* scarf */}
      <path d="M46 50 Q60 58 74 50 L72 56 Q60 63 48 56 Z" fill="#b91c1c" />
      <rect x="62" y="56" width="6" height="18" rx="2" fill="#991b1b" />
      {/* head */}
      <circle cx="60" cy="34" r="13" fill="#e0b08a" />
      {/* flat cap */}
      <path d="M45 30 Q60 15 75 29 L78 32 Q60 27 44 32 Z" fill="#374151" />
      {/* arm + notebook */}
      <path d="M78 60 Q90 76 74 84" stroke={coat} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M42 60 Q32 78 50 84" stroke={coat} strokeWidth="9" strokeLinecap="round" fill="none" />
      <rect x="50" y="74" width="22" height="16" rx="2" fill="#f8fafc" transform="rotate(-8 61 82)" />
      <path d="M54 79 h13 M54 83 h10 M54 87 h12" stroke="#64748b" strokeWidth="1.2" transform="rotate(-8 61 82)" />
      <path d="M72 70 L80 82" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
