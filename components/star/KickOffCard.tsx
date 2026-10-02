"use client";

/**
 * THE KICK-OFF BEAT — the screen between the line-up and the first chance:
 * the two sides, in their colours, about to walk out.
 *
 * v0.23 drew a flat striped pitch with two name bars (Harry, 1 Oct 2026,
 * P94). v0.24 (Harry, 2 Oct 2026, P1-52: "this page before you actually kick
 * off, I don't love it … something different here would be nice"): you look
 * out of the players' tunnel onto a floodlit pitch at dusk
 * (public/matchday/kickoff-bg.webp, generated). Both crests and names sit in
 * the dark lower third like a broadcast graphic; KICK OFF sits in the dark
 * top quarter. The floodlights breathe and the line glints once; both stop
 * for a phone set to reduce motion. With no picture (still loading, or
 * missing) the card is a dark night gradient, never an empty box.
 */
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { labelInk, type Kit } from "@/lib/star/kits";
import ClubBadge from "./ClubBadge";

export const KICKOFF_BG = "/matchday/kickoff-bg.webp";

const shortName = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

export default function KickOffCard({ homeTeam, awayTeam, homeKit, awayKit }: { homeTeam: string; awayTeam: string; homeKit: Kit; awayKit: Kit }) {
  return (
    <div
      data-kickoff-pitch
      className="relative my-2 mr-3 flex min-h-[230px] flex-1 flex-col overflow-hidden text-center"
      style={{
        marginLeft: 12,
        paddingRight: 0, // the feed gives its rows a right gutter for the minute plate; this runs full width
        // Shown until (or instead of) the picture: a night sky over a dark tunnel.
        background: "radial-gradient(70% 40% at 50% 38%, #2b4a7a 0%, transparent 70%), linear-gradient(180deg, #0a1020 0%, #0b1a14 55%, #05070d 100%)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14), 0 10px 24px -12px rgba(0,0,0,.9)",
      }}
    >
      <style>{`
        @keyframes kib-ko-lights { 0%, 100% { opacity: .55; } 50% { opacity: .95; } }
        @keyframes kib-ko-glint { 0% { transform: translateX(-120%); } 60%, 100% { transform: translateX(120%); } }
        @keyframes kib-ko-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { [data-kickoff-pitch] * { animation: none !important; } }
      `}</style>
      {/* the tunnel, looking out at the pitch */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: `url(${KICKOFF_BG})`, backgroundSize: "cover", backgroundPosition: "50% 42%" }}
      />
      {/* the floodlights breathing over the pitch */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[18%] h-[40%]"
        style={{ background: "radial-gradient(45% 55% at 50% 45%, rgba(255,236,190,.22), transparent 70%)", mixBlendMode: "screen", animation: "kib-ko-lights 3.2s ease-in-out infinite" }}
      />
      {/* darker at the top and the bottom, where the words sit */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(3,6,12,.75) 0%, rgba(3,6,12,0) 26%, rgba(3,6,12,0) 52%, rgba(3,6,12,.85) 100%)" }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-between px-3 pb-3 pt-3">
        <div style={{ animation: "kib-ko-in .5s ease-out both" }}>
          <div className="text-[9px] font-black uppercase tracking-[0.32em] text-amber-200/90" style={{ textShadow: "0 1px 3px rgba(0,0,0,.9)" }}>The teams walk out</div>
          <div className="relative mt-1 overflow-hidden px-1 text-[22px] font-black uppercase italic leading-none tracking-[0.12em] text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,.9), 0 0 18px rgba(255,214,140,.35)" }}>
            Kick off
            <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(100deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%)", mixBlendMode: "overlay", animation: "kib-ko-glint 2.8s ease-in-out .6s infinite" }} />
          </div>
        </div>

        <div className="flex w-full items-end gap-2" style={{ animation: "kib-ko-in .6s ease-out .15s both" }}>
          <Side club={homeTeam} kit={homeKit} />
          <span className="shrink-0 pb-2 text-[18px] font-black italic leading-none text-white" style={{ textShadow: "0 2px 6px rgba(0,0,0,.9)" }}>v</span>
          <Side club={awayTeam} kit={awayKit} />
        </div>
      </div>
    </div>
  );
}

/** One side: the crest over a name bar in the club's shirt colour. */
function Side({ club, kit }: { club: string; kit: Kit }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <div style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,.75))" }}>
        <ClubBadge club={club} kit={kit} size={40} />
      </div>
      <div
        className="w-full truncate px-2 py-1.5 text-[12px] font-black uppercase leading-none"
        style={{
          backgroundColor: kit.shirt, color: labelInk(kit.shirt), borderRadius: 2,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,.3), inset 0 -2px 0 ${kit.trim}, 0 6px 14px -6px rgba(0,0,0,.9)`,
        }}
      >
        {shortName(club)}
      </div>
    </div>
  );
}
