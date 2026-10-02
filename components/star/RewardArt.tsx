"use client";

/**
 * A catalogue card's picture, at any size — the one place that knows how to
 * draw a reward, used by the Star Pass reveal, the Locker and
 * /admin/star-pass so a card looks the same everywhere.
 *
 *   live 3D → Podium3D (spin it)     scene → the podium picture/animation
 *   a run-up with no art → the store's looping run-up sketch
 *   an accessory with no art → the store's figure wearing it
 *   anything else → its emoji tile
 */
import type { CatalogueItem } from "@/lib/star/rewardCatalogue";
import { ACCESSORIES } from "@/lib/star/store/catalogue";
import type { AnimationId } from "@/lib/star/store/catalogue";
import Podium3D from "./Podium3D";
import RunupPreview from "./store/RunupPreview";
import AccessoryFigure from "./store/AccessoryFigure";

export default function RewardArt({ card, w, h, live = true }: {
  card: CatalogueItem;
  w: number;
  h: number;
  /** false: a still stand-in for live 3D (a grid of many cards). */
  live?: boolean;
}) {
  const a = card.art;
  if (a.live && live) {
    // Same camera, bigger or smaller canvas: the picture scales with it.
    const k = Math.min(w / a.live.w, h / a.live.h);
    return <Podium3D cfg={{ ...a.live, w: Math.round(a.live.w * k), h: Math.round(a.live.h * k) }} />;
  }
  if (a.scene) return <img src={a.scene} alt={card.name} draggable={false} style={{ maxWidth: w, maxHeight: h, objectFit: "contain" }} />;
  if (a.image) return <img src={a.image} alt={card.name} draggable={false} style={{ maxWidth: w, maxHeight: h, objectFit: "contain" }} />;
  const g = card.grant;
  if (g.kind === "penaltyRunup" || g.kind === "freeKickRunup") {
    return <div style={{ width: w, height: h }} className="grid place-items-center"><RunupPreview style={g.id as AnimationId} className="h-full w-full" /></div>;
  }
  if (g.kind === "accessory") {
    const item = ACCESSORIES.find((x) => x.id === g.id);
    if (item) return <AccessoryFigure wear={[item]} width={w} height={h} />;
  }
  return (
    <div className="grid place-items-center" style={{ width: w, height: h, background: `radial-gradient(closest-side, ${a.color ?? "#64748b"}55, transparent)` }}>
      <span style={{ fontSize: Math.min(w, h) * 0.42 }}>{a.icon ?? (a.live ? "🧊" : "🎁")}</span>
    </div>
  );
}
