"use client";
import { useEffect, useState } from "react";
import { kitsOf, labelInk, type Kit } from "@/lib/star/kits";
import { getClubLogoMap, lookupClubLogo } from "@/lib/star/clubLogos";
import { badgeSvg, type BadgeOverride } from "@/lib/star/clubBadge";
import { useBadgeLook, type BadgeLook } from "@/lib/star/badgeLook";
import { useBadgeOverrides } from "@/lib/star/badgeOverrides";

/**
 * THE CIRCLE ITSELF — REAL BADGE WHEN ONE EXISTS, THE OLD KIT-COLOUR-PLUS-
 * INITIALS DEVICE OTHERWISE.
 *
 * Every "club as a circle" spot in the star game (`ClubCrest`, the cup-draw
 * `TeamBadge`, the scout report's `MiniCrest`, the transfers panel's dot)
 * used to hand-roll the same kit-colour-and-initials circle independently,
 * because — as `ClubCrest`'s own header used to say — "there are no crest
 * files, and a wrong crest is worse than none." Told directly that's no
 * longer true: real badges now live in `club_logos` (see
 * `lib/star/clubLogos.ts`). This is the one place that tries the real
 * badge first, and falls back to the exact same colour-and-initials circle
 * every one of those call sites already trusted — a missing row or a
 * broken image URL still can't ever show something wrong, only fall back
 * to something plain.
 */
export default function ClubBadge({ club, kit, size = 28, look: forced }: {
  club: string; kit?: Kit; size?: number;
  /** Force New or Old (the /admin/badges preview); otherwise the device setting. */
  look?: BadgeLook;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const deviceLook = useBadgeLook();
  const look = forced ?? deviceLook;
  // A redo made on /admin/badges on this device (lib/star/badgeOverrides.ts).
  const override = useBadgeOverrides()[club];

  useEffect(() => {
    setFailed(false);
    let alive = true;
    getClubLogoMap().then(map => {
      if (alive) setLogoUrl(lookupClubLogo(map, club) ?? null);
    });
    return () => { alive = false; };
  }, [club]);

  // New (default): every club gets the drawn badge from Mikey's club data —
  // shape, colours, pattern, emblem, no letters (lib/star/clubBadge.ts) —
  // even one with a real crest saved, so they all match (Harry, 6 Oct 2026).
  // Old: the real crest when there is one, else the initials.
  if (look === "new") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={drawnBadgeUrl(club, override)}
        alt=""
        className="shrink-0"
        style={{ height: size, width: size }}
      />
    );
  }

  if (logoUrl && !failed) {
    // Reported four times now, from three different screens, as a stray
    // white/oval shape around the crest. Three earlier attempts each
    // chased a different partial cause and only ever got rid of one of
    // them: a decorative glow effect on VersusScreen's header (removed,
    // never the actual cause), a `bg-white/10` fill on this very `<img>`
    // showing through the crest's own transparent pixels (removed, real
    // but only HALF the bug), and VersusScreen's own separate ring wrapper
    // around this component (also its own real, independent circle — see
    // that file). The other half of THIS component's bug: `rounded-full`
    // was still on the image itself, clipping a real crest that is almost
    // never circular — Forest's tree, United's shield — into a circle
    // regardless of any fill behind it. No clipping at all, now — the
    // crest keeps its own real shape, same as it does everywhere else a
    // transparent badge already sits directly on the page.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="shrink-0 object-contain p-0.5"
        style={{ height: size, width: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  const shirt = kit ?? kitsOf(club).home;
  return (
    <div
      className="grid shrink-0 place-items-center sk-num rounded-full border font-black overflow-hidden"
      style={{
        height: size, width: size, backgroundColor: shirt.shirt, borderColor: shirt.trim,
        color: labelInk(shirt.shirt), fontSize: Math.max(6, Math.round(size * 0.3)),
      }}
    >
      {initials(club)}
    </div>
  );
}

export function initials(club: string): string {
  const skip = new Set(["fc", "afc", "united", "city", "the", "and", "&", "hove", "albion"]);
  const words = club.split(/\s+/).filter(w => !skip.has(w.toLowerCase()));
  if (words.length >= 2) return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
  return club.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

const drawnCache = new Map<string, string>();
/** The drawn badge as a data URL, built once per club (and redo) per page. */
export function drawnBadgeUrl(club: string, override?: BadgeOverride): string {
  const key = override ? `${club}|${JSON.stringify(override)}` : club;
  let u = drawnCache.get(key);
  if (!u) {
    u = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg(club, "b", override))}`;
    drawnCache.set(key, u);
  }
  return u;
}
