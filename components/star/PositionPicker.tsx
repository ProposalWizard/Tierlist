"use client";
import { offeredPositions, POSITION_NAMES, formationForClub } from "@/lib/star/teamsheet";
import type { Role } from "@/lib/star/formations";

/**
 * ASK TO PLAY SOMEWHERE ELSE, BEFORE MATCH WEEK.
 *
 * Used to live on the versus screen, right before kick-off — which put a
 * decision that belongs to the build-up on the one screen designed to be
 * looked at once and left. It lives on the dashboard now: set it any day of
 * the week, and it is waiting for you when the team sheets are drawn.
 *
 * Only your own club's shape matters here — the opposition's has no bearing on
 * which slot you can occupy — so this needs nothing about the next fixture,
 * only the club you play for and the position you nominally play.
 */

interface Props {
  club: string;
  realPosition: string;
  playAs: Role | null;
  onChange: (role: Role | null) => void;
  /** Drop the card's own border/background/heading and just render the
   *  chips — for embedding inside another card (the pre-match "Your role"
   *  box) that already provides all three. */
  embedded?: boolean;
}

export default function PositionPicker({ club, realPosition, playAs, onChange, embedded = false }: Props) {
  const alternates = offeredPositions(realPosition, formationForClub(club));
  if (!alternates.length) return null;

  const realName = POSITION_NAMES[realPosition as Role] ?? realPosition;

  const chips = (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase transition ${
          !playAs ? "bg-emerald-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
      >
        {realName}
      </button>
      {alternates.map(({ role, label }) => (
        <button
          key={role}
          onClick={() => onChange(role)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase transition ${
            playAs === role ? "bg-amber-400 text-gray-950" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (embedded) return <div className="mt-2.5">{chips}</div>;

  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/85">
        Choose your position
      </div>
      <div className="mt-2">{chips}</div>
    </div>
  );
}
