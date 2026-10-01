"use client";

/**
 * THE HOME PITCH — you on a football pitch, the goal behind you (Harry,
 * 1 Oct 2026, P75/P82: "It needs to just be like he's on a football pitch.
 * You can see the goal in the background, maybe. And it's flush, it's like a
 * fade, rather than a pill, a 3D pill on top").
 *
 * Fills its `relative` parent, edge to edge. The grass fades up into the
 * night stand above it (and into the page, in the Pitch look) rather than
 * ending on a line, and a mown pitch runs under the player with chalk lines.
 * The goal stands on the goal line behind him, on his side of the screen
 * (the stat blocks sit over open grass on the right): posts, bar and a net.
 * Pure CSS/SVG — nothing animates, nothing loads.
 */
import { rgba } from "./ui";

export default function HomeBackdrop({ glow, centered = false }: { glow: string; centered?: boolean }) {
  // 12 mown bands, widening towards the viewer (perspective), 100x100 box.
  const bands: { y: number; h: number; dark: boolean }[] = [];
  let y = 0, h = 4.2;
  for (let i = 0; y < 100; i++) { bands.push({ y, h, dark: i % 2 === 0 }); y += h; h *= 1.2; }
  return (
    <div aria-hidden className="home-pitch pointer-events-none absolute inset-0 overflow-hidden" style={{ maskImage: "linear-gradient(180deg, transparent 0, #000 12%)", WebkitMaskImage: "linear-gradient(180deg, transparent 0, #000 12%)" }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hp-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity=".55" />
            <stop offset=".5" stopColor="#000" stopOpacity=".12" />
            <stop offset="1" stopColor="#000" stopOpacity=".38" />
          </linearGradient>
          <radialGradient id="hp-spot" cx=".5" cy=".62" r=".55">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".16" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* the grass starts at the goal line (y = 27) */}
        <g transform="translate(0 27) scale(1 .73)">
          {bands.map((b, i) => <rect key={i} x="0" y={b.y} width="100" height={b.h + 0.2} fill={b.dark ? "#1b6b34" : "#23803f"} />)}
        </g>
        <rect x="0" y="27" width="100" height="73" fill="url(#hp-shade)" />
        <rect x="0" y="27" width="100" height="73" fill="url(#hp-spot)" />
        {/* chalk: the goal line only (the boxes and the spot crossed the stat blocks) */}
        <g stroke="rgba(255,255,255,.7)" strokeWidth=".5" fill="none" vectorEffect="non-scaling-stroke">
          <line x1="0" y1="27" x2="100" y2="27" />
        </g>
      </svg>
      {/* The goal, standing on the goal line behind him (left, over his head). */}
      <svg className={`absolute top-[3%] h-[24%] ${centered ? "left-[14%] w-[72%]" : "left-[2%] w-[54%]"}`} viewBox="0 0 200 74" preserveAspectRatio="none" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.55))" }}>
        <rect x="6" y="6" width="188" height="68" fill="rgba(10,16,24,.5)" />
        <g stroke="rgba(255,255,255,.34)" strokeWidth=".8">
          {Array.from({ length: 18 }, (_, i) => <line key={`v${i}`} x1={6 + i * 11} y1="6" x2={6 + i * 11} y2="74" />)}
          {Array.from({ length: 6 }, (_, i) => <line key={`h${i}`} x1="6" y1={6 + i * 12} x2="194" y2={6 + i * 12} />)}
        </g>
        <path d="M6 74 V6 H194 V74" fill="none" stroke="#f8fafc" strokeWidth="4.5" strokeLinejoin="miter" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[46%]" style={{ background: `linear-gradient(180deg, transparent, ${rgba(glow, 0.12)})` }} />
    </div>
  );
}
