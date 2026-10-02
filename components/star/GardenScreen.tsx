"use client";
import { useState, useRef } from "react";
import type { CareerState } from "@/lib/star/types";
import { DEFAULT_FACE_STYLE, loadFaceStyle, type FaceStyle } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE, loadFakeFaceStyle, type FakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { DEFAULT_FAKE_FACE, fakeFaceFor } from "@/lib/star/fakeFaces";
import { createFaceImageCache, type FaceImageCache } from "@/lib/star/faceImageCache";
import { shuffle } from "@/lib/star/cups";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { homeSkyFor, type HomeSky } from "@/lib/star/kickoff";
import { nextFixtureFor } from "@/lib/star/competitions";
import { trophyArt } from "@/lib/star/trophyArt";
import { gardenData, type GardenTier, type ShelfTrophy } from "@/lib/star/gardenLevel";
import { SkyAndDistance, Stadium, Tint, Glow, Fireflies, LOOKS, GARDEN_CSS, W, H, HORIZON, type SkyLook } from "./garden/sky";
import { House, houseLights, houseWidth } from "./garden/house";
import {
  Lawn, Boundary, Tree, Topiary, FlowerBed, Butterfly, GardenPath, Patio, Lamp, WaterFeature, TrophyHouse,
  ForegroundGrass, BACK,
} from "./garden/parts";
import { HorseDefs, StableBlock, stallLamps, PaddockFence, HayBale, Trough, Horse, STABLE_CSS } from "./garden/stable";
import { Walker, SeatedMate, shade, PEOPLE_CSS, type FaceKit, type Outfit } from "./garden/people";

/**
 * THE GARDEN — YOUR OWN PLACE.
 *
 * The standing rules for this screen (each set by direct feedback on an
 * earlier pass — keep them):
 *  - It is a drawn GAME scene, not a photograph with UI on top of it.
 *  - No sentences of text. Icons, numbers and faces only.
 *  - Three scenes, swiped between like a real place rather than picked from
 *    a menu: the stable (left), the garden (centre, where you land) and the
 *    bench (right).
 *  - A small figure walks around the garden on its own ("you don't really
 *    do anything, but it should feel more like a game").
 *  - Real data only. Trophies: `career.trophies` (+ `ballonDorWins`). The
 *    horse: `career.horse`. Team-mates on the bench: three real
 *    `career.squad` players, picked at random each visit, with real faces
 *    (or the game's fake face when a photo is missing). Tap one and he gets
 *    up for a walk. No new game data, no new mechanics: a display.
 *
 * ── v0.25 rebuild (Harry, 2 Oct 2026: "upgrade the garden … garden looking
 * ass") ──
 * The last pass was single shapes on a stretched canvas: the 300 x 500 art
 * was squashed to fit the phone (preserveAspectRatio="none"), so the horse,
 * trees and faces came out tall and thin; half the screen was empty sky over
 * flat grass; the walker was a 40px stick man in a random orange shirt; the
 * trophy cabinet showed six tiny emoji-sized cups; team-mates' heads were as
 * big as their bodies and they floated in front of the bench.
 *
 * Now each scene is one 390 x 780 picture that keeps its shape (sliced to
 * the phone, never stretched), built in depth: sky → far hills → tree line →
 * the back of the garden → lawn → you. The pieces live in
 * components/star/garden/:
 *  - sky.tsx      the light. It follows Home's own sky (`homeSkyFor`, the
 *                 time of your next kick-off): day, sunset or night, with a
 *                 matching tint, long sunset shadows, stars, lit windows,
 *                 lamps and fireflies after dark.
 *  - house.tsx    YOUR HOUSE at the end of the garden, which grows with the
 *                 best home you own (lib/star/gardenLevel.ts): terrace →
 *                 semi → detached → mansion → manor with columns.
 *  - parts.tsx    mown stripes, the boundary (fence → hedge → stone pillars),
 *                 the path, flower beds, lamps, the water feature (bird bath
 *                 → pond → fountain → big fountain), and the trophy
 *                 summer-house: every competition you have won on lit
 *                 shelves, with its real trophy picture and a count.
 *  - stable.tsx   the stable yard: a stable block that grows with the Horse
 *                 Stable you bought, a paddock fence, hay and water, your
 *                 horse grazing (or its faded outline when there is none).
 *  - people.tsx   you, in your own club kit and skin tone with your own
 *                 face, strolling the lawn with a ball; team-mates sitting
 *                 on the bench in the club tracksuit.
 * Life: drifting clouds, birds, swaying flowers and grass, butterflies, a
 * robin on the bird bath, rippling water, a fountain's spray, a fire pit,
 * fairy lights. All CSS transform animations (cheap on a phone); no canvas,
 * no animation loop.
 */

const SCENES = ["stable", "garden", "bench"] as const;
type Scene = (typeof SCENES)[number];

/** A genuinely random pick of a few real teammates to sit on the bench —
 *  requested directly ("the 3 players... should be randomly picked each
 *  time you go into the garden area"). Computed once per visit (see the
 *  lazy useState below), so swiping between scenes never reshuffles who is
 *  sitting there. */
function pickRandomVisitors(career: CareerState): CareerState["squad"] {
  const squad = career.squad ?? [];
  if (squad.length <= 3) return squad;
  return shuffle(squad, Math.random).slice(0, 3);
}

/** One SVG frame per scene: 390 x 780, keeps its shape, anchored at the
 *  bottom so the ground always meets the bottom of the phone. A taller phone
 *  sees more sky above it (the sky is drawn well past the top edge) rather
 *  than losing the sides. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" overflow="visible" className="absolute inset-0 h-full w-full">
      {children}
    </svg>
  );
}

/** A small number badge in the top corner, led by a picture. */
function Chip({ img, icon, n }: { img?: string; icon?: React.ReactNode; n: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-black/45 py-1 pl-1.5 pr-2.5 shadow-lg ring-1 ring-white/15 backdrop-blur-sm">
      {img ? <img src={img} alt="" className="h-6 w-6 object-contain" /> : icon}
      <span className="text-sm font-black tabular-nums text-white">{n}</span>
    </div>
  );
}

// ── The garden (centre) ──────────────────────────────────────────────────

function GardenScene({ look, tier, shelf, outfit, faceUrl, faces }: {
  look: SkyLook; tier: GardenTier; shelf: ShelfTrophy[]; outfit: Outfit; faceUrl: string; faces: FaceKit;
}) {
  const hw = houseWidth(tier);
  const hs = Math.min(1, 372 / hw);
  const patioHalf = Math.min(170, (hw * hs) / 2);
  const water = tier <= 1 ? { x: 318, y: 520 } : tier === 2 ? { x: 300, y: 560 } : { x: 306, y: 548 };
  return (
    <Frame>
      <SkyAndDistance look={look} seed={1} stadium={52} />
      <Tree x={22} y={BACK - 40} s={0.8} dark />
      <Tree x={372} y={BACK - 36} s={0.85} dark />
      <Boundary tier={tier} />
      <Lawn tier={tier} />
      <g transform={`translate(${W / 2} ${BACK}) scale(${hs})`}>
        <House tier={tier} layer="base" />
      </g>
      <Patio halfW={patioHalf} tier={tier} />
      {tier >= 1 && (
        <>
          <FlowerBed x={W / 2 - patioHalf - 30} y={BACK + 30} w={70} seed={11} flowers={10} />
          <FlowerBed x={W / 2 + patioHalf + 30} y={BACK + 30} w={70} seed={12} flowers={10} />
        </>
      )}
      {tier >= 3 && (
        <>
          <Topiary x={W / 2 - patioHalf + 8} y={BACK + 40} s={0.62} />
          <Topiary x={W / 2 + patioHalf - 8} y={BACK + 40} s={0.62} />
        </>
      )}
      <GardenPath tier={tier} />
      {tier >= 2 && (
        <>
          <Lamp x={134} y={520} s={0.95} />
          <Lamp x={256} y={520} s={0.95} />
        </>
      )}
      <Tree x={372} y={452} s={0.95} />
      <WaterFeature x={water.x} y={water.y} tier={tier} look={look} />
      <TrophyHouse x={106} y={566} shelf={shelf} layer="shell" look={look} />
      <g transform="translate(205 690)">
        <g className="gdn-walker">
          <Walker outfit={outfit} faceUrl={faceUrl} faceKey="you" faces={faces} ball shadow={look.shadow} />
        </g>
      </g>
      <FlowerBed x={46} y={752} w={150} seed={3} flowers={tier >= 1 ? 26 : 14} />
      <FlowerBed x={346} y={756} w={150} seed={5} flowers={tier >= 1 ? 26 : 14} />
      {!look.moon && (
        <>
          <Butterfly x={40} y={700} color="#ffd23f" delay={0} />
          <Butterfly x={300} y={690} color="#ff8fc8" delay={6} />
        </>
      )}
      <ForegroundGrass />
      <Tint look={look} />
      {look.lightsOn && (
        <g>
          <g transform={`translate(${W / 2} ${BACK}) scale(${hs})`}>
            <House tier={tier} layer="glow" />
            {houseLights(tier).map((l, i) => <Glow key={i} x={l.x} y={l.y} r={l.r} strength={0.45} />)}
          </g>
          <TrophyHouse x={106} y={566} shelf={shelf} layer="inside" look={look} />
          <Glow x={104} y={500} r={110} strength={0.35} />
          {tier >= 2 && (
            <>
              <Glow x={134} y={448} r={42} />
              <Glow x={256} y={448} r={42} />
              <circle cx="134" cy="447" r="4" fill="#fff4cc" />
              <circle cx="256" cy="447" r="4" fill="#fff4cc" />
            </>
          )}
          <Stadium x={52} look={look} glow />
          <Fireflies look={look} area={[20, 420, 370, 720]} />
        </g>
      )}
    </Frame>
  );
}

// ── The stable (left) ────────────────────────────────────────────────────

function StableScene({ look, horse, level }: { look: SkyLook; horse: CareerState["horse"]; level: number }) {
  const yardY = 404;
  return (
    <Frame>
      <HorseDefs />
      <SkyAndDistance look={look} seed={2} stadium={300} />
      <Tree x={20} y={yardY - 30} s={0.75} dark />
      <Tree x={372} y={yardY - 24} s={0.9} dark />
      {/* the field behind, the sandy yard in front of the stable, then the paddock */}
      <rect x="0" y={HORIZON - 4} width={W} height={H - HORIZON + 4} fill="#6cb04a" />
      <rect x="0" y={HORIZON - 4} width={W} height={yardY - HORIZON} fill="#5c9f40" />
      <path d={`M 0,${yardY - 6} L ${W},${yardY - 6} L ${W},${yardY + 52} C 260,${yardY + 62} 130,${yardY + 40} 0,${yardY + 56} Z`} fill="#cdb07a" />
      <path d={`M 0,${yardY - 6} L ${W},${yardY - 6} L ${W},${yardY + 4} L 0,${yardY + 4} Z`} fill="rgba(0,0,0,0.10)" />
      <StableBlock level={level} y={yardY} />
      <PaddockFence y={500} level={level} />
      <HayBale x={58} y={548} s={0.9} />
      <HayBale x={96} y={560} s={0.75} />
      <Trough x={316} y={556} look={look} />
      {[[30, 640], [120, 610], [250, 620], [350, 660], [70, 720], [200, 760], [330, 740]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g className="gdn-sway" style={{ animationDelay: `-${i * 0.6}s` }}>
            <path d="M -5,0 C -6,-8 -4,-12 -3,-16 M 0,0 C 0,-10 1,-14 2,-19 M 5,0 C 6,-7 5,-11 3,-15" stroke="#3f8a34" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        </g>
      ))}
      {horse ? (
        <g transform="translate(195 704) scale(2.05)">
          <g className="horse-roam">
            <Horse />
          </g>
        </g>
      ) : (
        <g transform="translate(195 704) scale(2.05)">
          <Horse faded />
        </g>
      )}
      <ForegroundGrass />
      <Tint look={look} />
      {look.lightsOn && (
        <g>
          {stallLamps(level, yardY).map((l, i) => (
            <g key={i}>
              <Glow x={l.x} y={l.y} r={40} />
              <circle cx={l.x} cy={l.y} r="3" fill="#fff4cc" />
            </g>
          ))}
          <Stadium x={300} look={look} glow />
          <Fireflies look={look} area={[20, 560, 370, 740]} />
        </g>
      )}
    </Frame>
  );
}

// ── The bench (right) ────────────────────────────────────────────────────

const BENCH_SEATS = [113, 195, 277];
const BENCH_SEAT_Y = 600;

function BenchScene({ look, tier, visitors, kit, faces }: {
  look: SkyLook; tier: GardenTier; visitors: CareerState["squad"]; kit: { shirt: string; trim: string }; faces: FaceKit;
}) {
  const [walking, setWalking] = useState<Record<string, boolean>>({});
  const hands = "#a8774f";
  const top = kit.shirt;
  const trim = kit.trim;
  const VPy = 220;
  const rows = [470, 488, 510, 538, 574, 620, 680, 760, 860];
  const tap = (id: string) => {
    if (walking[id]) return;
    setWalking((w) => ({ ...w, [id]: true }));
    window.setTimeout(() => setWalking((w) => ({ ...w, [id]: false })), 4400);
  };
  const bulbs = Array.from({ length: 17 }, (_, i) => {
    const x = 22 + i * 21.6, t = i / 16;
    return { x, y: 276 + Math.sin(t * Math.PI) * 40 };
  });
  return (
    <Frame>
      <SkyAndDistance look={look} seed={3} />
      <Tree x={36} y={350} s={0.9} dark />
      <Tree x={350} y={340} s={1} dark />
      {/* the tall hedge at the back of the patio, roses climbing it */}
      <rect x="0" y="352" width={W} height="122" fill="#2c6531" />
      {Array.from({ length: 27 }, (_, i) => (
        <circle key={i} cx={i * 15} cy={352 + (i % 2) * 3} r="10" fill="#2c6531" />
      ))}
      {Array.from({ length: 60 }, (_, i) => (
        <circle key={`l${i}`} cx={(i * 37) % W} cy={362 + ((i * 53) % 100)} r="4" fill="#3a7d3e" opacity="0.8" />
      ))}
      {tier >= 1 && Array.from({ length: 22 }, (_, i) => (
        <circle key={`r${i}`} cx={(i * 61 + 17) % W} cy={370 + ((i * 29) % 80)} r="3" fill={i % 3 ? "#e8436e" : "#ff9ab5"} />
      ))}
      {/* the patio: stone slabs running away from you */}
      <rect x="0" y="470" width={W} height={H - 470} fill="#cbbfa9" />
      {rows.map((y, i) => i % 2 === 0 && i < rows.length - 1 && (
        <rect key={y} x="0" y={y} width={W} height={rows[i + 1] - y} fill="#c2b59d" />
      ))}
      {rows.map((y) => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="rgba(0,0,0,0.13)" strokeWidth={0.6 + (y - 470) * 0.004} />)}
      {Array.from({ length: 15 }, (_, i) => {
        const xb = -500 + i * 100;
        const xt = 195 + (xb - 195) * ((470 - VPy) / (H - VPy));
        return <line key={i} x1={xt} y1="470" x2={xb} y2={H} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />;
      })}
      <rect x="0" y="470" width={W} height="6" fill="rgba(0,0,0,0.18)" />
      {/* the pergola: back beam on two posts, rafters running forward */}
      <rect x="54" y="300" width="10" height="174" fill="#7a5233" />
      <rect x="326" y="300" width="10" height="174" fill="#7a5233" />
      <rect x="40" y="296" width="310" height="10" fill="#8b5f3b" />
      {/* the bench */}
      <g>
        <ellipse cx="195" cy="652" rx="160" ry="10" fill={look.shadow} />
        {Array.from({ length: 4 }, (_, i) => (
          <rect key={`b${i}`} x="52" y={530 + i * 13} width="286" height="10" rx="2" fill="#a8703c" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
        ))}
        {[60, 330].map((x) => <rect key={x} x={x - 4} y="524" width="8" height="128" rx="2" fill="#1f1f22" />)}
        {Array.from({ length: 3 }, (_, i) => (
          <rect key={`s${i}`} x="44" y={BENCH_SEAT_Y - 6 + i * 6} width="302" height="5.4" rx="1.6" fill={i === 2 ? "#8f5d31" : "#b47c45"} stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
        ))}
        {[56, 334].map((x) => <rect key={`l${x}`} x={x - 3.5} y={BENCH_SEAT_Y + 10} width="7" height="42" fill="#1f1f22" />)}
      </g>
      {visitors.slice(0, 3).map((p, i) => {
        const url = p.imageUrl ?? fakeFaceFor(p.id);
        return walking[p.id] ? (
          <g key={p.id} transform={`translate(${BENCH_SEATS[i]} 652)`}>
            <g className="gdn-walkoff">
              <Walker
                outfit={{ shirt: top, trim, shorts: shade(top, 0.55), socks: shade(top, 0.55), skin: hands, legs: shade(top, 0.55), sleeves: top }}
                faceUrl={url} faceKey={p.id} faces={faces} shadow={look.shadow}
              />
            </g>
          </g>
        ) : (
          <g key={p.id} transform={`translate(${BENCH_SEATS[i]} ${BENCH_SEAT_Y}) scale(1.08)`} onClick={() => tap(p.id)} style={{ cursor: "pointer" }}>
            <SeatedMate top={top} trim={trim} faceUrl={url} faceKey={p.id} faces={faces} hands={hands} shadow={look.shadow} delay={i * 0.8} />
          </g>
        );
      })}
      {/* armrests in front of the seated legs */}
      {[48, 342].map((x) => (
        <path key={x} d={`M ${x},${BENCH_SEAT_Y - 30} L ${x},${BENCH_SEAT_Y + 4}`} stroke="#1f1f22" strokeWidth="6" strokeLinecap="round" />
      ))}
      {/* a side table with KIB cans, a big pot, and a fire pit on the bigger patios */}
      <g transform="translate(336 700)">
        <ellipse cx="0" cy="34" rx="30" ry="6" fill={look.shadow} />
        <rect x="-3" y="0" width="6" height="34" fill="#2a2a2e" />
        <ellipse cx="0" cy="0" rx="28" ry="7" fill="#3a3a40" />
        <ellipse cx="0" cy="-1.5" rx="26" ry="5.6" fill="#52525a" />
        <image href="/star/kib-premium.png" x="-20" y="-30" width="18" height="30" preserveAspectRatio="xMidYMax meet" />
        <image href="/star/kib-basic.png" x="2" y="-27" width="16" height="27" preserveAspectRatio="xMidYMax meet" />
      </g>
      <g transform="translate(38 744)">
        <ellipse cx="4" cy="2" rx="34" ry="6" fill={look.shadow} />
        <g className="gdn-sway-slow">
          {[-60, -35, -10, 15, 40, 65].map((a, i) => (
            <path key={a} d={`M 0,-44 Q ${Math.sin((a * Math.PI) / 180) * 30},${-80 - (i % 2) * 14} ${Math.sin((a * Math.PI) / 180) * 56},${-62 + Math.abs(a) * 0.3}`} stroke={i % 2 ? "#3f8f3f" : "#2f7a35"} strokeWidth="7" fill="none" strokeLinecap="round" />
          ))}
        </g>
        <path d="M -26,-46 L 26,-46 L 20,0 L -20,0 Z" fill="#c4683c" />
        <rect x="-29" y="-50" width="58" height="7" rx="2" fill="#d97a4a" />
      </g>
      {tier >= 2 && (
        <g transform="translate(195 740)">
          <ellipse cx="0" cy="8" rx="56" ry="10" fill={look.shadow} />
          <ellipse cx="0" cy="0" rx="50" ry="13" fill="#6c6a66" />
          <ellipse cx="0" cy="-2" rx="40" ry="9" fill="#2a2420" />
          {[-14, 0, 14].map((x, i) => (
            <g key={x} transform={`translate(${x} -4)`}>
              <path className="gdn-flame" style={{ animationDelay: `-${i * 0.15}s` }} d="M -9,0 C -10,-14 -2,-18 0,-32 C 4,-20 11,-14 9,0 Z" fill="#ff8a1f" />
              <path className="gdn-flame" style={{ animationDelay: `-${i * 0.2}s` }} d="M -5,0 C -6,-8 -1,-11 0,-20 C 3,-12 6,-8 5,0 Z" fill="#ffd34d" />
            </g>
          ))}
        </g>
      )}
      <Tint look={look} />
      {/* the front of the pergola frames the picture; its lights glow over the tint */}
      <rect x="6" y="248" width="16" height={H - 248} fill={look.lightsOn ? "#3b2a1c" : "#6f4a2d"} />
      <rect x="368" y="248" width="16" height={H - 248} fill={look.lightsOn ? "#3b2a1c" : "#6f4a2d"} />
      <rect x="0" y="244" width={W} height="16" fill={look.lightsOn ? "#45311f" : "#7e5534"} />
      {tier >= 1 && Array.from({ length: 14 }, (_, i) => (
        <g key={`v${i}`} transform={`translate(${12 + i * 28} 258)`}>
          <g className="gdn-sway-slow" style={{ animationDelay: `-${i * 0.5}s` }}>
            <path d={`M 0,0 C -4,${14 + (i % 3) * 8} 4,${22 + (i % 3) * 8} 0,${32 + (i % 4) * 10}`} stroke={look.lightsOn ? "#25502a" : "#3a8a3e"} strokeWidth="3" fill="none" />
            {[8, 18, 28].map((ly) => <ellipse key={ly} cx={ly % 2 ? 3 : -3} cy={ly} rx="4" ry="2.4" fill={look.lightsOn ? "#2c5e31" : "#47a04a"} />)}
          </g>
        </g>
      ))}
      <path d={`M 22,276 Q 195,356 368,276`} stroke="#222" strokeWidth="1" fill="none" />
      {bulbs.map((b, i) => (
        <g key={i}>
          {look.lightsOn && <Glow x={b.x} y={b.y + 3} r={14} strength={0.9} />}
          <circle cx={b.x} cy={b.y + 3} r="2.6" fill={look.lightsOn ? "#fff1b8" : "#f4f1e6"} stroke="#555" strokeWidth="0.4" />
        </g>
      ))}
      {look.lightsOn && tier >= 2 && <Glow x={195} y={720} r={110} color="255,150,60" strength={0.8} />}
    </Frame>
  );
}

/** The face images, face styles and cache every head in the garden shares. */
function useFaceKit(): FaceKit {
  const [cache] = useState<FaceImageCache>(() => createFaceImageCache());
  const [style] = useState<FaceStyle>(() => (typeof window !== "undefined" ? loadFaceStyle() : DEFAULT_FACE_STYLE));
  const [fakeStyle] = useState<FakeFaceStyle>(() => (typeof window !== "undefined" ? loadFakeFaceStyle() : DEFAULT_FAKE_FACE_STYLE));
  return { cache, style, fakeStyle };
}

export default function GardenScreen({ career, onBack, sky }: {
  career: CareerState;
  onBack: () => void;
  /** The light to draw. Absent = the same sky Home shows: your next kick-off. */
  sky?: HomeSky;
}) {
  const [scene, setScene] = useState<Scene>("garden");
  const touchX = useRef<number | null>(null);
  const faces = useFaceKit();

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

  const [visitors] = useState<CareerState["squad"]>(() => pickRandomVisitors(career));
  const [lightOf] = useState<HomeSky>(() => sky ?? homeSkyFor(career, nextFixtureFor(career)));
  const look = LOOKS[sky ?? lightOf];
  const { tier, stable, shelf, trophyCount } = gardenData(career);
  const club = career.player.club;
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const outfit: Outfit = { shirt: kit.shirt, trim: kit.trim, shorts: kit.trim, socks: kit.shirt, skin: skinToneHex(career.player.skinTone) };
  const faceUrl = career.player.portrait ?? DEFAULT_FAKE_FACE;
  const ballonDors = career.ballonDorWins ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <style>{GARDEN_CSS + PEOPLE_CSS + STABLE_CSS + WALK_CSS}</style>
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col" style={{ minHeight: "100dvh" }}>
        <div
          className="relative flex-1 touch-pan-y overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="absolute inset-0 flex transition-transform duration-300 ease-out"
            style={{ width: `${SCENES.length * 100}%`, transform: `translateX(-${index * (100 / SCENES.length)}%)` }}
          >
            <div className="relative h-full" style={{ width: `${100 / SCENES.length}%` }}>
              <StableScene look={look} horse={career.horse} level={stable} />
              {career.horse && (
                <div className="absolute right-3 top-14 flex flex-col items-end gap-1.5">
                  <Chip n={career.horse.racesWon} icon={<Rosette />} />
                </div>
              )}
            </div>
            <div className="relative h-full" style={{ width: `${100 / SCENES.length}%` }}>
              <GardenScene look={look} tier={tier} shelf={shelf} outfit={outfit} faceUrl={faceUrl} faces={faces} />
              {(trophyCount > 0 || ballonDors > 0) && (
                <div className="absolute right-3 top-14 flex flex-col items-end gap-1.5">
                  {trophyCount > 0 && <Chip img={trophyArt("Premier League") ?? undefined} n={trophyCount} />}
                  {ballonDors > 0 && <Chip img={trophyArt("Ballon d'Or") ?? undefined} n={ballonDors} />}
                </div>
              )}
            </div>
            <div className="relative h-full" style={{ width: `${100 / SCENES.length}%` }}>
              <BenchScene look={look} tier={tier} visitors={visitors} kit={kit} faces={faces} />
            </div>
          </div>

          {/* back and the three scene dots, floating over the sky */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2.5">
            <button onClick={onBack} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-lg text-white ring-1 ring-white/20 backdrop-blur-sm">←</button>
            <div className="flex gap-1.5 rounded-full bg-black/30 px-2.5 py-2 backdrop-blur-sm">
              {SCENES.map((s, i) => (
                <button
                  key={s}
                  data-garden-dot={s}
                  aria-label={s}
                  onClick={() => setScene(s)}
                  className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/45"}`}
                />
              ))}
            </div>
            <div className="w-10" />
          </div>

          {index > 0 && (
            <button
              onClick={() => goTo(index - 1)}
              aria-label="Previous"
              className="absolute left-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-xl text-white ring-1 ring-white/20 backdrop-blur-sm"
            >‹</button>
          )}
          {index < SCENES.length - 1 && (
            <button
              onClick={() => goTo(index + 1)}
              aria-label="Next"
              className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-xl text-white ring-1 ring-white/20 backdrop-blur-sm"
            >›</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A winner's rosette — the horse's wins. */
function Rosette() {
  return (
    <svg viewBox="-12 -12 24 30" className="h-6 w-6">
      <path d="M -6,6 L -9,17 L -4,14 L -2,18 L 0,7 Z" fill="#c0262d" />
      <path d="M 6,6 L 9,17 L 4,14 L 2,18 L 0,7 Z" fill="#9e1d24" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={Math.cos(a) * 7.5} cy={Math.sin(a) * 7.5} r="3.6" fill="#1f5fbf" />;
      })}
      <circle r="6" fill="#f4c542" />
      <circle r="3.6" fill="#ffe08a" />
    </svg>
  );
}

const WALK_CSS = `
.gdn-walker { animation: gdnWalker 18s ease-in-out infinite; }
@keyframes gdnWalker {
  0% { transform: translateX(-88px) scaleX(1); }
  44% { transform: translateX(88px) scaleX(1); }
  50% { transform: translateX(88px) scaleX(-1); }
  94% { transform: translateX(-88px) scaleX(-1); }
  100% { transform: translateX(-88px) scaleX(1); }
}
.gdn-walkoff { animation: gdnWalkOff 4.4s ease-in-out forwards; }
@keyframes gdnWalkOff {
  0% { transform: translate(0, 0) scaleX(-1); }
  45% { transform: translate(-150px, 40px) scaleX(-1); }
  55% { transform: translate(-150px, 40px) scaleX(1); }
  100% { transform: translate(0, 0) scaleX(1); }
}
`;

