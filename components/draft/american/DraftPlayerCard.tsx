"use client";
import { useState } from "react";
import { getFlagUrl } from "@/lib/nationalities";
import type { AmPlayer } from "@/lib/americanDraft";
import { SILHOUETTE_SRC } from "@/lib/silhouette";

/**
 * The draft card, shared by every board that offers players to pick.
 *
 * Extracted from AmericanDraftRoom so the Challenge draft could reuse the exact
 * same card rather than growing a near-copy that would drift.
 */

// Position accent colors — used for the diagonal streak overlay and the
// small position label at top-right of each card. Deliberately kept as
// hex so we can compose gradients and alpha values from them.
export const POS_ACCENT: Record<string, string> = {
  GK: "#facc15",   RB: "#3b82f6",  RWB: "#3b82f6",
  CB: "#3b82f6",   LB: "#3b82f6",  LWB: "#3b82f6",
  CDM: "#22c55e",  CM: "#22c55e",  CAM: "#22c55e",
  RM: "#22c55e",   LM: "#22c55e",
  RW: "#ef4444",   LW: "#ef4444",  ST: "#ef4444",  CF: "#ef4444",
  ANY: "#a855f7",
};

export const POS_TEXT: Record<string, string> = {
  GK: "text-yellow-400", RB: "text-blue-400", RWB: "text-blue-400",
  CB: "text-blue-400", LB: "text-blue-400", LWB: "text-blue-400",
  CDM: "text-green-400", CM: "text-green-400", CAM: "text-green-400",
  RM: "text-green-400", LM: "text-green-400",
  RW: "text-red-400", LW: "text-red-400", ST: "text-red-400", CF: "text-red-400",
  ANY: "text-purple-400",
};

// OVR is styled as a clean bright number over a subtle dark chip — the
// tier color leaks through as a soft text glow rather than a solid pill.
export function ovrTextColor(ovr: number): string {
  if (ovr >= 85) return "text-amber-400";
  if (ovr >= 80) return "text-emerald-400";
  if (ovr >= 75) return "text-sky-400";
  return "text-white";
}

export default function DraftPlayerCard({
  player, canPick, onPick, slotPosition, hideRatings, displayPosition,
}: {
  player: AmPlayer;
  canPick: boolean;
  onPick: (id: string) => void | Promise<void>;
  /** Formation slot being filled, or "ANY" for a bench/free pick. */
  slotPosition: string;
  hideRatings?: boolean;
  /**
   * Overrides the position shown on the card. The Challenge draft passes the
   * position that actually satisfied the round's brief — a centre back who can
   * also play left back belongs on a FULL BACKS board, and labelling him "CB"
   * there just looks like a bug.
   */
  displayPosition?: string | null;
}) {
  const [picking, setPicking] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [clubLogoFailed, setClubLogoFailed] = useState(false);
  const [flagFailed, setFlagFailed] = useState(false);

  async function handlePick() {
    if (picking || !canPick) return;
    setPicking(true);
    await onPick(player.sofifa_id);
    setPicking(false);
  }

  // A mixed pool has no slot to fill, so the badge shows what the player
  // actually plays. In the initial draft it shows the slot being filled, and
  // "ANY" there means a substitute.
  const naturalPos = (player.positions || "").split(",")[0]?.trim().toUpperCase() || "";
  const badgePos = displayPosition
    ? displayPosition.toUpperCase()
    : slotPosition === "ANY" && naturalPos ? naturalPos : slotPosition;
  const accent = POS_ACCENT[badgePos] || "#64748b";
  const badgeLabel = badgePos === "ANY" ? "SUB" : badgePos;
  const showImage = !!player.image_url && !imgFailed;
  const showClubLogo = !!player.club_logo_url && !clubLogoFailed;
  const flagUrl = getFlagUrl(player.nationality);
  const showFlag = !!flagUrl && !flagFailed;

  return (
    <div
      onClick={canPick ? handlePick : undefined}
      className={`relative rounded-2xl overflow-hidden border flex flex-col aspect-[3/4] transition-all duration-150 select-none ${
        canPick
          ? "border-white/10 hover:border-cyan-400/50 hover:shadow-[0_0_24px_rgba(6,182,212,0.20)] cursor-pointer active:scale-[0.98]"
          : "border-white/[0.05] opacity-60"
      }`}
      style={{ background: "linear-gradient(180deg,#0d1a2b 0%,#08121f 100%)" }}
    >
      {/* ── Image area — top two-thirds ── */}
      <div className="relative flex-[2] overflow-hidden">
        {/* Two subtle diagonal streaks in the position color — spaced out,
            not a repeating pattern. */}
        <div
          className="absolute -right-4 top-4 h-40 w-24 rotate-[35deg] rounded-full blur-2xl opacity-25 pointer-events-none"
          style={{ background: accent }}
        />
        <div
          className="absolute right-1 top-8 h-24 w-[2px] rotate-[35deg] opacity-40 pointer-events-none"
          style={{ background: accent }}
        />
        <div
          className="absolute right-4 top-2 h-16 w-[1px] rotate-[35deg] opacity-25 pointer-events-none"
          style={{ background: accent }}
        />

        {/* The silhouette is a STAND-IN, not a backdrop. It shows when a player
            has no photo, and while one is still downloading so the card is
            never blank — but it is removed the moment the real face paints.
            Leaving it underneath meant every player was drawn on top of a
            second, larger shadow figure, because the photos are transparent
            cut-outs. */}
        {(!showImage || !imgLoaded) && (
          <img
            src={SILHOUETTE_SRC}
            alt=""
            aria-hidden
            className="absolute inset-x-0 bottom-0 w-full h-full object-contain object-bottom opacity-45"
          />
        )}
        {showImage && (
          <img
            src={player.image_url!}
            alt={player.name}
            referrerPolicy="no-referrer"
            decoding="async"
            className={`absolute inset-x-0 bottom-0 w-full h-full object-contain object-bottom transition-opacity duration-200 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        )}

        {/* OVR — masked entirely when the room hides ratings, including the
            tier colour, which would otherwise give the rating away. */}
        <div className={`absolute top-2 left-2.5 ${hideRatings ? "text-white/70" : ovrTextColor(player.ovr)} text-xl sm:text-2xl font-black leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tabular-nums`}>
          {hideRatings ? "?" : player.ovr}
        </div>

        {/* Position — clean bold text with a thin outlined chip */}
        <div
          className="absolute top-2 right-2 text-[11px] font-black uppercase tracking-wider leading-none px-1.5 py-1 rounded-md border"
          style={{
            color: accent,
            borderColor: `${accent}66`,
            background: "rgba(0,0,0,0.35)",
          }}
        >
          {badgeLabel}
        </div>
      </div>

      {/* ── Info + pick — bottom third ── */}
      <div className="relative flex-1 px-2 pt-1.5 pb-2 flex flex-col justify-between border-t border-white/[0.04]">
        <div>
          {/* Name — centred */}
          <div className="text-[13px] font-black text-white leading-tight line-clamp-1 text-center">
            {player.name}
          </div>

          {/* Club badge left · season centre · nation flag right */}
          <div className="mt-1 flex items-center justify-between gap-1">
            {showClubLogo ? (
              <img
                src={player.club_logo_url!}
                alt={player.club}
                title={player.club}
                referrerPolicy="no-referrer"
                className="w-7 h-7 shrink-0 object-contain"
                onError={() => setClubLogoFailed(true)}
              />
            ) : (
              <span className="w-7 h-7 shrink-0" />
            )}

            <span className="text-[11px] font-bold text-white/85 tabular-nums leading-none">
              {player.season}
            </span>

            {showFlag ? (
              <img
                src={flagUrl!}
                alt={player.nationality}
                title={player.nationality}
                className="w-7 h-[21px] shrink-0 rounded-sm object-cover"
                onError={() => setFlagFailed(true)}
              />
            ) : (
              <span className="w-7 h-[21px] shrink-0" />
            )}
          </div>
        </div>

        {canPick && (
          <button
            onClick={e => { e.stopPropagation(); handlePick(); }}
            disabled={picking}
            className="mt-1.5 w-full py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}
          >
            {picking ? "…" : "PICK"}
          </button>
        )}
      </div>
    </div>
  );
}
