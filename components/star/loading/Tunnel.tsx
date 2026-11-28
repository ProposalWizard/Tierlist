"use client";

/**
 * The tunnel, in the walk-out cut scene's look (Harry, 27 Nov 2026: "should
 * probably just be a cut-scene vibe if you use it as loading … we already
 * have a tunnel cut scene"). Its own frames (lib/star/cutscene/fixtures.ts
 * walkout, shot by scripts/loading-stills/shoot.mjs) cross-fade with a slow
 * push-in between the film's black bars, and the fixture as a TV caption.
 * No input. The wide shots only: no close face or shirt that isn't yours.
 */
import type { CSSProperties } from "react";
import type { ProgrammeData } from "@/lib/star/loading/programme";

/** The film's two wide shots of the tunnel (its later shots are close on one man in one kit). */
export const TUNNEL_SHOTS = ["tunnel-1", "tunnel-2"];

export default function Tunnel({ data }: { data?: ProgrammeData }) {
  const vars = { "--club": data?.home.shirt ?? "#10b981", "--ink": data?.home.ink ?? "#fff" } as CSSProperties;
  return (
    <div className="absolute inset-0" style={vars}>
      {TUNNEL_SHOTS.map((id, i) => (
        <div key={id} className={`lc-tn-shot ${i === 1 ? "b" : ""}`} style={{ backgroundImage: `url(/star/loading/${id}.webp)`, "--at": `${-i * 3.2}s` } as CSSProperties} />
      ))}
      <div className="lc-tn-glow" />
      <div className="lc-tn-vig" />
      <div className="lc-tn-bar t" />
      <div className="lc-tn-bar b" />
      {data && (
        <div className="lc-tn-low">
          <span className="k">{data.comp}</span>
          <div className="h lc-display">{data.home.short} v {data.away.short}</div>
          <div className="s">{data.venue ? `Walking out at ${data.venue}` : "Walking out"}{data.date ? ` · ${data.date}` : ""}</div>
        </div>
      )}
    </div>
  );
}
