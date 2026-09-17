"use client";
import { useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { horseRating } from "@/lib/star/horse";

/**
 * THE GARDEN — YOUR OWN PLACE.
 *
 * Rebuilt after direct feedback on the first pass, which used a real
 * licensed photo as a backdrop and full sentences of prose (a plain-
 * English trophy heading, "no horse yet" copy, and so on). That's wrong on
 * both counts: this needs to read as an actual drawn GAME scene, not a
 * photograph with UI on top of it, and it should carry no written words at
 * all — icons, numbers and real photos/silhouettes for faces, nothing you
 * have to read a sentence to understand. Three scenes, swiped between like
 * a real place rather than picked from a menu: the stable (left), the
 * garden itself (center, where you land), and the bench (right) — plus a
 * small figure ambling around the garden on its own, since "you don't
 * really do anything, but it should feel more like a game" was said
 * directly.
 *
 * Every real thing shown here already exists elsewhere in the game — this
 * only displays it. Trophies: `career.trophies`. The horse: `career.horse`
 * (lib/star/horse.ts). Teammates: a few real `career.squad` entries. No new
 * game data, no new mechanics — this is a display, not a feature.
 *
 * Entirely drawn (SVG + CSS), not photographic — no Adobe imagery, no image
 * assets on disk at all. A licensed photo was tried first and rejected
 * directly ("not some real image of a garden... a game version").
 */

const SCENES = ["stable", "garden", "bench"] as const;
type Scene = (typeof SCENES)[number];

/** A stable pick of a few real teammates to sit on the bench — seeded off
 *  the save so the same trio holds for a while rather than reshuffling on
 *  every render. */
function pickVisitors(career: CareerState): CareerState["squad"] {
  const squad = career.squad ?? [];
  if (squad.length <= 3) return squad;
  const start = (career.week + career.season * 7) % squad.length;
  const out: CareerState["squad"] = [];
  for (let i = 0; i < 3; i++) out.push(squad[(start + i) % squad.length]);
  return out;
}

/** A flat sky-over-grass ground, shared by all three scenes so the swipe
 *  reads as one continuous place rather than three unrelated cards. */
function Ground({ groundColor }: { groundColor: string }) {
  return (
    <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
      <rect x="0" y="0" width="300" height="220" fill="#8fd3f4" />
      <rect x="0" y="210" width="300" height="290" fill={groundColor} />
      <rect x="0" y="205" width="300" height="10" fill="rgba(0,0,0,0.08)" />
    </svg>
  );
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-4" y="0" width="8" height="26" fill="#7a5230" />
      <circle cx="0" cy="-14" r="24" fill="#3f9142" />
      <circle cx="-14" cy="-4" r="16" fill="#4aa64d" />
      <circle cx="14" cy="-6" r="17" fill="#357a38" />
    </g>
  );
}

function Flower({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map(a => (
        <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3} cy={Math.sin((a * Math.PI) / 180) * 3} r="2.4" fill={color} />
      ))}
      <circle r="1.6" fill="#fff7c2" />
    </g>
  );
}

/** A tiny figure — head, body, two legs — reused for the walker and the
 *  fence-post scarecrow-free stable, drawn rather than an emoji so it reads
 *  as part of the scene's own art rather than a sticker on top of it. */
function Figure({ skin = "#e8b593", shirt = "#2b6cb0" }: { skin?: string; shirt?: string }) {
  return (
    <g>
      <circle cx="0" cy="-16" r="5" fill={skin} />
      <rect x="-4.5" y="-11" width="9" height="12" rx="2" fill={shirt} />
      <rect x="-4" y="1" width="3" height="8" fill="#2b2b40" />
      <rect x="1" y="1" width="3" height="8" fill="#2b2b40" />
    </g>
  );
}

/** The garden scene: grass, trees, flowers, a real trophy-count HUD (a
 *  cabinet glyph + a number, never a sentence) and a small figure ambling
 *  between a few fixed spots on its own — "someone walking around the
 *  garden" — via a slow CSS animation, not free-roam pathfinding. */
function GardenScene({ trophyCount, ballonDors }: { trophyCount: number; ballonDors: number }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Ground groundColor="#4f9d3a" />
      <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <Tree x={48} y={300} scale={1.1} />
        <Tree x={252} y={280} scale={0.9} />
        <Tree x={230} y={400} scale={0.75} />
        <Flower x={90} y={360} color="#f4728a" />
        <Flower x={130} y={420} color="#f4c542" />
        <Flower x={190} y={340} color="#e857e8" />
        <Flower x={220} y={450} color="#f4728a" />
        {/* the trophy cabinet, drawn — a wooden case with however many real
            trophies (career.trophies) fit on its shelf, capped visually at
            six so the case never overflows its own frame */}
        <g transform="translate(150 250)">
          <rect x="-34" y="-30" width="68" height="60" rx="4" fill="#6b4a2b" stroke="#4a3319" strokeWidth="3" />
          <rect x="-28" y="-24" width="56" height="48" fill="#3a2818" />
          {Array.from({ length: Math.min(trophyCount, 6) }).map((_, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            return <text key={i} x={-18 + col * 18} y={-2 + row * 20} fontSize="14">🏆</text>;
          })}
        </g>
        <g className="garden-walker" style={{ transformOrigin: "150px 400px" }}>
          <g transform="translate(150 400)">
            <Figure shirt="#e0a020" />
          </g>
        </g>
      </svg>

      {(trophyCount > 0 || ballonDors > 0) && (
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          {trophyCount > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-1">
              <span className="text-sm">🏆</span>
              <span className="text-xs font-black text-white">{trophyCount}</span>
            </div>
          )}
          {ballonDors > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-1">
              <span className="text-sm">🥇</span>
              <span className="text-xs font-black text-white">{ballonDors}</span>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .garden-walker {
          animation: stroll 14s ease-in-out infinite;
        }
        @keyframes stroll {
          0%, 100% { transform: translateX(-60px) scaleX(-1); }
          45% { transform: translateX(-60px) scaleX(-1); }
          50% { transform: translateX(-60px) scaleX(1); }
          95% { transform: translateX(60px) scaleX(1); }
        }
      `}</style>
    </div>
  );
}

/** The stable: a fenced paddock. A real horse (career.horse) if you own
 *  one, drawn as a simple silhouette with a rating badge; an empty pen with
 *  a padlock glyph otherwise — the state is the picture, not a caption. */
function StableScene({ horse }: { horse: CareerState["horse"] }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Ground groundColor="#a9793f" />
      <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={10 + i * 36} y={230} width="8" height="60" fill="#7a5230" />
        ))}
        <rect x="0" y="250" width="300" height="8" fill="#7a5230" />
        <rect x="0" y="285" width="300" height="8" fill="#7a5230" />
        <Tree x={40} y={260} scale={0.6} />
        <Tree x={264} y={255} scale={0.55} />
        {horse ? (
          <g transform="translate(150 400)">
            <ellipse cx="0" cy="0" rx="46" ry="20" fill="#5a3a22" />
            <rect x="-38" y="-14" width="18" height="30" fill="#5a3a22" />
            <rect x="24" y="-14" width="18" height="30" fill="#5a3a22" />
            <ellipse cx="44" cy="-24" rx="16" ry="12" fill="#6b4429" />
            <ellipse cx="-46" cy="-4" rx="8" ry="14" fill="#3a2515" transform="rotate(20 -46 -4)" />
            <text x="0" y="-46" fontSize="16" textAnchor="middle">🐴</text>
          </g>
        ) : (
          <g transform="translate(150 380)" opacity="0.6">
            <rect x="-20" y="-14" width="40" height="30" rx="4" fill="#3a2818" />
            <text x="0" y="8" fontSize="20" textAnchor="middle">🔒</text>
          </g>
        )}
      </svg>
      {horse && (
        <div className="absolute left-1/2 top-[68%] -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-xs font-black text-white">
          {horseRating(horse)}
        </div>
      )}
    </div>
  );
}

const SHIRT_COLORS = ["#d4342c", "#2b6cb0", "#1f9142"];

/** A teammate who actually stands up and walks a lap when tapped, rather
 *  than sitting frozen forever — requested directly, pointing at the match
 *  engine's own real moving/controllable characters as proof this game
 *  already knows how to do it. Idle, he sways gently in place (a real,
 *  small, always-on animation so the bench never reads as a still image);
 *  tapped, he walks off the bench, out and back, then sits back down. Real
 *  identity is kept — the number is his real overall (career.squad) — but
 *  the figure itself is drawn, matching the rest of this scene, not a
 *  photo cutout floating over it. */
function BenchFigure({ seatX, shirt, overall }: { seatX: number; shirt: string; overall?: number }) {
  const [walking, setWalking] = useState(false);
  return (
    <g
      transform={`translate(${seatX} 400)`}
      onClick={() => {
        if (walking) return;
        setWalking(true);
        setTimeout(() => setWalking(false), 2600);
      }}
      style={{ cursor: "pointer" }}
      className={walking ? "bench-figure walking" : "bench-figure idle"}
    >
      {/* Reported directly from a live check: at y=-30 this sat right on
          top of the bench's own backrest rail (which spans roughly -46 to
          -26 in this same local space), reading as if it were part of the
          bench rather than a label floating clearly above the figure's
          head. Moved to -60, comfortably above the backrest's top edge. */}
      {typeof overall === "number" && (
        <text x="0" y="-60" fontSize="9" textAnchor="middle" fill="#fff" fontWeight="700">{overall}</text>
      )}
      <g className="bench-figure-body">
        <Figure shirt={shirt} />
      </g>
      <style jsx>{`
        .bench-figure.idle .bench-figure-body { animation: sway 3.6s ease-in-out infinite; }
        .bench-figure.walking .bench-figure-body { animation: lap 2.6s ease-in-out; }
        @keyframes sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(2.5deg); }
        }
        @keyframes lap {
          0% { transform: translateY(0) translateX(0); }
          15% { transform: translateY(-6px) translateX(-14px); }
          50% { transform: translateY(-6px) translateX(-40px); }
          85% { transform: translateY(-6px) translateX(14px); }
          100% { transform: translateY(0) translateX(0); }
        }
      `}</style>
    </g>
  );
}

/** The bench: real teammates (career.squad), drawn as small figures rather
 *  than static photos — see BenchFigure for why. No names, no sentences —
 *  a real overall rating is the only text, the same "a number, never a
 *  caption" rule the rest of this screen already keeps. */
function BenchScene({ visitors }: { visitors: CareerState["squad"] }) {
  const seats = [90, 150, 210];
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Ground groundColor="#4f9d3a" />
      <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <Tree x={36} y={280} scale={0.85} />
        <Tree x={264} y={310} scale={0.7} />
        <g transform="translate(150 400)">
          <rect x="-90" y="-6" width="180" height="10" fill="#8a5a34" />
          <rect x="-90" y="-34" width="180" height="8" fill="#8a5a34" />
          <rect x="-80" y="4" width="8" height="24" fill="#5a3a22" />
          <rect x="72" y="4" width="8" height="24" fill="#5a3a22" />
          <rect x="-84" y="-46" width="8" height="20" fill="#5a3a22" />
          <rect x="76" y="-46" width="8" height="20" fill="#5a3a22" />
        </g>
        {(visitors.length ? visitors : []).slice(0, 3).map((p, i) => (
          <BenchFigure key={p.id} seatX={seats[i]!} shirt={SHIRT_COLORS[i % SHIRT_COLORS.length]!} overall={p.overall} />
        ))}
      </svg>
    </div>
  );
}

export default function GardenScreen({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const [scene, setScene] = useState<Scene>("garden");
  const touchX = useRef<number | null>(null);

  const index = SCENES.indexOf(scene);
  const goTo = (i: number) => setScene(SCENES[Math.max(0, Math.min(SCENES.length - 1, i))]);

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 40) return;
    goTo(dx < 0 ? index + 1 : index - 1);
  };

  const trophyCount = (career.trophies ?? []).length;
  const visitors = pickVisitors(career);

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-lg text-white">←</button>
        <div className="flex gap-1.5">
          {SCENES.map((s, i) => (
            <button
              key={s}
              onClick={() => setScene(s)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
            />
          ))}
        </div>
        <div className="w-9" />
      </div>

      <div
        className="relative flex-1 min-h-0 touch-pan-y overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* `absolute inset-0` (not a percentage `h-full`) so this track gets
            a real, definite box straight from this positioned parent —
            reported directly as a real bug: a chain of `height: 100%`
            through a flex-grow ancestor rendered as a totally blank black
            screen on the reporter's device, a known cross-browser flexbox/
            percentage-height fragility. Children no longer need `h-full`
            either — a flex row's default `align-items: stretch` already
            gives every child the track's own real height for free. */}
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-out"
          style={{ width: `${SCENES.length * 100}%`, transform: `translateX(-${index * (100 / SCENES.length)}%)` }}
        >
          <div style={{ width: `${100 / SCENES.length}%` }}>
            <StableScene horse={career.horse} />
          </div>
          <div style={{ width: `${100 / SCENES.length}%` }}>
            <GardenScene trophyCount={trophyCount} ballonDors={career.ballonDorWins} />
          </div>
          <div style={{ width: `${100 / SCENES.length}%` }}>
            <BenchScene visitors={visitors} />
          </div>
        </div>

        {index > 0 && (
          <button
            onClick={() => goTo(index - 1)}
            className="absolute left-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white"
          >‹</button>
        )}
        {index < SCENES.length - 1 && (
          <button
            onClick={() => goTo(index + 1)}
            className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white"
          >›</button>
        )}
      </div>
    </div>
  );
}
