"use client";
import type { Kit } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import ClubBadge, { initials } from "./ClubBadge";

/**
 * A CLUB, AS A BADGE.
 *
 * The circle itself is `ClubBadge` (real crest when one exists, the club's
 * own shirt-with-initials otherwise — see that file's own header for why
 * this used to be "there are no crest files" and now isn't). This wrapper
 * is what adds the club-name row underneath — shared between the
 * team-sheet screen and the match-day header, one badge-plus-name,
 * everywhere a club needs to be shown as more than a bare name.
 */
export default function ClubCrest({ club, kit, size = 36 }: { club: string; kit: Kit; size?: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <ClubBadge club={club} kit={kit} size={size} />
      <div className="w-full truncate text-center text-[10px] font-black leading-tight text-white">
        {shortClub(club)}
      </div>
    </div>
  );
}

export { initials };
