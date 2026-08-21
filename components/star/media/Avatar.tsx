"use client";
import type { AvatarGlyph } from "@/lib/star/media/types";

/**
 * AN ACCOUNT'S PROFILE PICTURE.
 *
 * Forty accounts used to share one design: two letters on a flat colour. So a
 * feed carrying a broadsheet, a stats page, a rival supporter and the league
 * itself looked like one spreadsheet with different words in it. Reported as
 * exactly that — "every account's profile picture is just the initials of
 * their name which is very boring."
 *
 * Everything here is drawn, not fetched: a handful of simple shapes on a
 * two-stop gradient, picked by what the account IS. No image files, no
 * network, nothing to 404 — which is the same constraint the rest of this
 * feed works under, and the reason the initials were there in the first
 * place.
 *
 * A club keeps its lettering, because a club badge IS lettering; what makes it
 * theirs is that both gradient stops are that club's real kit colours (see
 * accounts.ts's avatarFor).
 */

/** Drawn on a 24×24 viewBox, so every glyph shares one coordinate space. */
function Glyph({ kind }: { kind: AvatarGlyph }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "trophy":
      return (
        <g {...stroke}>
          <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
          <path d="M8 5.5H5.5a2.5 2.5 0 0 0 2.5 4M16 5.5h2.5a2.5 2.5 0 0 1-2.5 4" />
          <path d="M12 13v3M9 19h6M10 16h4l.6 3h-5.2z" />
        </g>
      );
    case "ball":
      return (
        <g {...stroke}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 7.2l3.2 2.3-1.2 3.7h-4L8.8 9.5z" />
          <path d="M12 4.5v2.7M18.6 9.9l-3.4-.4M16.2 17.6l-2.2-4.4M7.8 17.6l2.2-4.4M5.4 9.9l3.4-.4" />
        </g>
      );
    case "newspaper":
      return (
        <g {...stroke}>
          <path d="M4.5 6h12v13h-12z" />
          <path d="M16.5 9H19v8a2 2 0 0 1-2.5 2" />
          <path d="M7 9.5h7M7 12.5h7M7 15.5h4" />
        </g>
      );
    case "megaphone":
      return (
        <g {...stroke}>
          <path d="M5 10.5v3a1.5 1.5 0 0 0 1.5 1.5H9l7 4V5l-7 4H6.5A1.5 1.5 0 0 0 5 10.5z" />
          <path d="M9 15v3.5M18.5 10a3 3 0 0 1 0 4" />
        </g>
      );
    case "chart":
      return (
        <g {...stroke}>
          <path d="M5 19h14" />
          <path d="M7.5 19v-5M12 19V6.5M16.5 19v-8" />
        </g>
      );
    case "scoop":
      return (
        <g {...stroke}>
          <path d="M12 4.2l2.1 4.6 5 .6-3.7 3.4 1 4.9L12 15.3l-4.4 2.4 1-4.9L4.9 9.4l5-.6z" />
        </g>
      );
    case "play":
      return (
        <g {...stroke}>
          <rect x="3.5" y="6" width="17" height="12" rx="3" />
          <path d="M10.5 9.8l4.5 2.2-4.5 2.2z" fill="currentColor" />
        </g>
      );
    case "mic":
      return (
        <g {...stroke}>
          <rect x="9.5" y="3.5" width="5" height="9.5" rx="2.5" />
          <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3M9.5 20h5" />
        </g>
      );
    case "scarf":
      return (
        <g {...stroke}>
          <path d="M6 5.5h12v4H6z" />
          <path d="M8 9.5v7l2 1.5 2-1.5V9.5M14 9.5v6" />
        </g>
      );
    case "shirt":
      return (
        <g {...stroke}>
          <path d="M9 4.5L5 6.5l1.2 3.4 1.8-.6V19h8V9.3l1.8.6L19 6.5l-4-2" />
          <path d="M9 4.5a3 3 0 0 0 6 0" />
        </g>
      );
    case "grin":
      return (
        <g {...stroke}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0z" fill="currentColor" />
          <path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.4" />
        </g>
      );
    case "cup":
      return (
        <g {...stroke}>
          <path d="M8.5 4h7v6.5a3.5 3.5 0 0 1-7 0V4z" />
          <path d="M9 20h6M12 17.5v2.5" />
          <path d="M8.5 5H6a3 3 0 0 0 3 4M15.5 5H18a3 3 0 0 1-3 4" />
        </g>
      );
    case "flag":
      return (
        <g {...stroke}>
          <path d="M6 3.5v17" />
          <path d="M6 5l6 2.2L6 9.4V5z" fill="currentColor" />
          <path d="M6 5h9l-2 3.5 2 3.5H6" />
        </g>
      );
    case "quote":
      return (
        <g {...stroke}>
          <path d="M5.5 8.5c0-2.2 1.6-3.8 4-4M5.5 8.5v4.3h4V9.2H6.2M14 8.5c0-2.2 1.6-3.8 4-4M14 8.5v4.3h4V9.2h-3.3" />
        </g>
      );
    case "grid":
      return (
        <g {...stroke}>
          <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" />
          <path d="M4.5 10h15M4.5 15h15M10 4.5v15M15 4.5v15" />
        </g>
      );
    case "drum":
      return (
        <g {...stroke}>
          <ellipse cx="12" cy="8" rx="7.5" ry="3.2" />
          <path d="M4.5 8v6.5c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2V8" />
          <path d="M6 5.5L3 3M18 5.5l3-2.5" />
        </g>
      );
    case "boot":
      return (
        <g {...stroke}>
          <path d="M8 4.5v6.2l-4.3 3.3c-.8.6-1.2 1.5-1.2 2.5v1.5h15.5c1.1 0 2-.9 2-2 0-2.4-1.7-4.4-4-4.9l-4-.9V4.5H8z" />
          <path d="M8 8h4M2.5 17h17" />
        </g>
      );
    default:
      return null;
  }
}

export default function Avatar({
  initials, tint, tint2, glyph, size = 36,
}: {
  initials: string;
  tint: string;
  tint2?: string;
  glyph?: AvatarGlyph;
  size?: number;
}) {
  const to = tint2 ?? tint;
  // A crest keeps its letters; so does an account with no glyph at all, which
  // is what a save made before glyphs existed carries.
  const lettered = !glyph || glyph === "crest";
  return (
    <div
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${tint}, ${to})`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
      }}
    >
      {/* A soft highlight, so forty discs are not forty flat circles. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 30% 12%, rgba(255,255,255,0.28), transparent 60%)" }}
      />
      {lettered ? (
        <span
          className="relative font-black leading-none"
          style={{ fontSize: size * 0.32, textShadow: "0 1px 2px rgba(0,0,0,0.45)" }}
        >
          {initials}
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="relative"
          style={{ width: size * 0.62, height: size * 0.62, filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.45))" }}
          aria-hidden
        >
          <Glyph kind={glyph} />
        </svg>
      )}
    </div>
  );
}
