"use client";

/**
 * The Golden Ball night and the season awards night, while their room is
 * built: the gala. Three sets: the golden ball on its plinth under two
 * sweeping spotlights; your invitation card, gold-edged, turning in the
 * light; the red carpet with the cameras going off. No input.
 */
import type { CSSProperties } from "react";
import type { LoadSection, LoadVariant } from "@/lib/star/loading/pick";
import type { LoadContext } from "@/lib/star/loading/context";

const SPARKS: [number, number, number][] = [[18, 22, 0], [80, 18, .7], [30, 64, 1.3], [72, 58, .4], [52, 14, 1.8], [12, 48, 1.1], [88, 40, 1.6], [64, 76, .2]];
const FLASHES: [number, number, number][] = [[10, 52, 0], [88, 46, .6], [16, 70, 1.3], [84, 66, 1.9], [6, 38, 2.2], [94, 30, 1.0], [26, 82, .3], [74, 84, 1.6]];

export default function Gala({ variant, ctx, section }: { variant: LoadVariant; ctx: LoadContext; section: LoadSection }) {
  const g = ctx.gala;
  const title = g?.title ?? (section === "awards" ? "Season Awards" : "The Golden Ball");
  const kicker = g ? `Season ${g.season}` : "Tonight";
  const look = variant.look ?? "ball";
  return (
    <>
      <div className="lc-ga-room" />
      {look !== "carpet" && <div className="lc-ga-curtain" />}
      <div className="lc-ga-spot l" />
      <div className="lc-ga-spot r" />
      {look === "ball" && (
        <div className="lc-ga-ball">
          <div className="glow" />
          <div className="plinth" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/star/loading/ball-gold.webp" alt="" />
          <div className="shine" />
          <div className="rim" />
        </div>
      )}
      {look === "invite" && (
        <div className="lc-ga-card">
          <div className="c">
            <div className="emb" />
            <div className="t1">The pleasure of your company is requested</div>
            <div className="nm lc-display">{g?.name ?? "You"}</div>
            <div className="t1">at</div>
            <div className="t2 lc-display">{title}</div>
            <div className="t3">{kicker} · Black tie</div>
          </div>
        </div>
      )}
      {look === "carpet" && (
        <>
          <div className="lc-ga-carpet" />
          <div className="lc-ga-rope l" />
          <div className="lc-ga-rope r" />
          {FLASHES.map(([x, y, d], i) => <div key={i} className="lc-ga-flash" style={{ left: `${x}%`, top: `${y}%`, "--d": `${d}s` } as CSSProperties} />)}
        </>
      )}
      {look !== "carpet" && SPARKS.map(([x, y, d], i) => <div key={i} className="lc-ga-spark" style={{ left: `${x}%`, top: `${y}%`, "--d": `${d}s` } as CSSProperties} />)}
      {look !== "invite" && (
        <div className="lc-ga-head">
          <div className="lc-caps">{look === "carpet" ? "Arrivals" : kicker}</div>
          <h1 className="lc-display">{title}</h1>
        </div>
      )}
    </>
  );
}
