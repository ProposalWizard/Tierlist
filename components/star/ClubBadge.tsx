"use client";
import { useEffect, useState } from "react";
import { kitsOf, labelInk, type Kit } from "@/lib/star/kits";
import { getClubLogoMap, lookupClubLogo } from "@/lib/star/clubLogos";

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
export default function ClubBadge({ club, kit, size = 28 }: { club: string; kit?: Kit; size?: number }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    let alive = true;
    getClubLogoMap().then(map => {
      if (alive) setLogoUrl(lookupClubLogo(map, club) ?? null);
    });
    return () => { alive = false; };
  }, [club]);

  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full bg-white/10 object-contain p-0.5"
        style={{ height: size, width: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  const shirt = kit ?? kitsOf(club).home;
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full border font-black"
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
