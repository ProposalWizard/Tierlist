"use client";

/**
 * YOUR PLAYER ON HOME AND THE TITLE SCREEN — the one hook.
 *
 * Harry, 9 Oct 2026: "I think we just need the players to look really fun
 * and good." The stylised Style A body is being built elsewhere
 * (lib/star/style3d/toon, human3d, people3d). When it is ready it drops in
 * HERE, in `HomePlayerFigure` below, and nothing else on either screen moves:
 * both screens give this component a box (width × height, his boots on the
 * box's bottom edge) and never draw the player themselves.
 *
 * Today it draws the current figure: on Home the drag-to-turn, tap-to-
 * celebrate SpinPlayer; on the title the PlayerAvatar with the ball. Around
 * it (New Home look only): a pool of club-coloured light on the grass, a
 * soft glow behind him and a gentle idle bounce, so he reads as the star of
 * the screen rather than a cut-out.
 */
import "./ui/kit.css";
import type { CareerState } from "@/lib/star/types";
import type { AvatarStyle } from "@/lib/star/heroFigure";
import PlayerAvatar from "./PlayerAvatar";
import SpinPlayer from "./SpinPlayer";
import { rgba } from "./ui";
import ToonHomePlayer from "./ToonHomePlayer";
import { usePlayerStyleLook } from "@/lib/star/style3d/toon/look";

export interface HomePlayerProps {
  career: CareerState;
  /** The box he stands in; his boots sit on its bottom edge. */
  width: number;
  height: number;
  /** Home: drag to turn, tap to celebrate. Title: stands with the ball. */
  where: "home" | "title";
  look: AvatarStyle;
  kitShirt: string;
  kitTrim: string;
  /** The club's glow colour (useClubTheme). */
  glow: string;
  /** Play a celebration on its own (a win in your last match). Home only. */
  celebrate?: boolean;
}

/** THE SWAP POINT: the figure itself. Replace the body of this function with
 *  the Style A render when it lands; keep the same box. */
export function HomePlayerFigure({ career, width, height, where, look, kitShirt, kitTrim, celebrate = false }: HomePlayerProps) {
  const style = usePlayerStyleLook();
  const old = where === "home"
    ? <SpinPlayer career={career} width={width} height={height} look={look} kitShirt={kitShirt} kitTrim={kitTrim} autoCelebrate={celebrate} />
    : <PlayerAvatar career={career} width={width} height={height} look={look} />;
  // Settings → Look → "Player style: New": your Style A player (same box); Old: today's figure.
  if (style === "new") return <ToonHomePlayer career={career} width={width} height={height} where={where} kitShirt={kitShirt} kitTrim={kitTrim} fallback={old} />;
  return old;
}

/* hp-bob / hp-pool live in ./ui/kit.css (loaded once). */

/** The player plus his light. Same box as the figure, nothing outside it is
 *  laid out (the light is absolutely placed), so a layout never shifts. */
export default function HomePlayer(p: HomePlayerProps) {
  const { width, height, glow } = p;
  return (
    <div className="relative" style={{ width, height }}>
      {/* soft glow behind his chest */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full blur-2xl"
        style={{ width: width * 0.95, height: height * 0.55, background: `radial-gradient(closest-side, ${rgba(glow, 0.55)}, transparent)` }} />
      {/* (No coloured pool of light under his feet: Harry, 20 Nov 2026, "I don't like this coloured
          shadow under the player". The 3D player keeps his own soft dark shadow, lib/star/homeSet3d.ts.) */}
      <div className="hp-bob relative" style={{ width, height }}>
        <HomePlayerFigure {...p} />
      </div>
    </div>
  );
}
