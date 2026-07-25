// Artwork for the History / Hall of Fame cards on the draft setup screen.
//
// SWAPPING IN REAL ARTWORK
// ------------------------
// These are hand-authored SVG stand-ins. To use proper rendered artwork instead,
// drop the files into /public and set the two constants below to their paths —
// nothing else needs changing, the cards pick them up automatically.
//
//   HISTORY_ICON_SRC = "/draft-icon-history.png"
//   HOF_ICON_SRC     = "/draft-icon-hof.png"
//
// Ideal source files: square, transparent PNG (or WebP), at least 160x160 —
// 256x256 is better for high-DPI phones. The subject should fill most of the
// frame with only a little padding, since it renders at ~38px.

export const HISTORY_ICON_SRC: string | null = null;
export const HOF_ICON_SRC: string | null = null;

export function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="trophyBody" x1="14" y1="6" x2="34" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d1fae5" />
          <stop offset="38%" stopColor="#6ee7b7" />
          <stop offset="72%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="trophyBase" x1="16" y1="34" x2="32" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#065f46" />
        </linearGradient>
      </defs>

      {/* handles */}
      <path d="M15 11H10.5a4.5 4.5 0 0 0 0 9H13.4" stroke="#34d399" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M33 11h4.5a4.5 4.5 0 0 1 0 9H34.6" stroke="#34d399" strokeWidth="2.6" strokeLinecap="round" />

      {/* cup */}
      <path d="M14.5 6h19v9.5c0 5.8-4.25 10.5-9.5 10.5s-9.5-4.7-9.5-10.5V6Z" fill="url(#trophyBody)" />
      {/* specular highlight down the left of the cup */}
      <path d="M18.4 8.4h3.1v13.2c0 1.5-.7 2.6-1.55 2.6s-1.55-1.1-1.55-2.6V8.4Z" fill="#ffffff" opacity="0.4" />
      {/* rim */}
      <rect x="13.2" y="5" width="21.6" height="3.1" rx="1.55" fill="#a7f3d0" />

      {/* stem + base */}
      <path d="M22.4 26h3.2v6h-3.2z" fill="url(#trophyBase)" />
      <path d="M18 32h12v3H18z" rx="1" fill="url(#trophyBase)" />
      <rect x="15" y="35.6" width="18" height="4.2" rx="1.6" fill="url(#trophyBase)" />

      {/* sparkle accents */}
      <path d="M38.5 8.5l.85 2.15L41.5 11.5l-2.15.85L38.5 14.5l-.85-2.15L35.5 11.5l2.15-.85z" fill="#ffffff" opacity="0.85" />
      <circle cx="11" cy="27" r="1.15" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

export function StarBadgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="starGold" x1="12" y1="6" x2="34" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="35%" stopColor="#fcd34d" />
          <stop offset="70%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="plinth" x1="14" y1="34" x2="34" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>

      {/* light rays behind the star */}
      <g opacity="0.5">
        <path d="M24 1.5v4.2M24 30v3.4M6.5 17.5h4M37.5 17.5h4" stroke="#fde68a" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M11 6l2.7 2.7M37 6l-2.7 2.7" stroke="#fde68a" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* star */}
      <path
        d="M24.0 6.0 L27.47 16.23 L38.27 16.36 L29.61 22.82 L32.82 33.14 L24.0 26.9 L15.18 33.14 L18.39 22.82 L9.73 16.36 L20.53 16.23 Z"
        fill="url(#starGold)"
      />
      {/* inner facet — gives the star a folded, three-dimensional read */}
      <path d="M24 6v20.9l-8.82 6.24L18.39 22.82 9.73 16.36l10.8-.13z" fill="#ffffff" opacity="0.26" />

      {/* plinth */}
      <path d="M20 33.6h8v3.2h-8z" fill="url(#plinth)" />
      <rect x="14.5" y="36.6" width="19" height="4.4" rx="1.7" fill="url(#plinth)" />

      {/* sparkle */}
      <path d="M39 26l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 5.5 15.5 12 9 18.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5.5" y="10.5" width="13" height="9" rx="2" fill="currentColor" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
