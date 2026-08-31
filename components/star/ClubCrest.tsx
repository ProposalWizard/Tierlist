"use client";
import { labelInk, type Kit } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";

/**
 * A CLUB, AS A BADGE.
 *
 * There are no crest files, and a wrong crest is worse than none — so it is
 * the club's own shirt with its initials on it, which is the same device the
 * shortlist tiles use and is at least always right. Shared between the
 * team-sheet screen and the match-day header — one badge, everywhere a club
 * needs to be shown as more than a name.
 */
export default function ClubCrest({ club, kit, size = 36 }: { club: string; kit: Kit; size?: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <div
        className="grid place-items-center rounded-full border-2 font-black"
        style={{
          height: size, width: size, backgroundColor: kit.shirt, borderColor: kit.trim,
          color: labelInk(kit.shirt), fontSize: Math.max(9, Math.round(size * 0.3)),
        }}
      >
        {initials(club)}
      </div>
      <div className="w-full truncate text-center text-[10px] font-black leading-tight text-white">
        {shortClub(club)}
      </div>
    </div>
  );
}

export function initials(club: string): string {
  const skip = new Set(["fc", "afc", "united", "city", "the", "and", "&", "hove", "albion"]);
  const words = club.split(/\s+/).filter(w => !skip.has(w.toLowerCase()));
  if (words.length >= 2) return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
  return club.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
