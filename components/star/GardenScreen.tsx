"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { DEFAULT_FACE_STYLE, loadFaceStyle, CROP_VIEWPORT, type FaceStyle } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE, loadFakeFaceStyle, type FakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { FAKE_FACES, fakeFaceFor } from "@/lib/star/fakeFaces";
import { sourceRect } from "@/lib/star/portrait";
import { createFaceImageCache, type FaceImageCache } from "@/lib/star/faceImageCache";

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
 * (lib/star/horse.ts). Teammates: a few real `career.squad` entries — now
 * with real faces (see BenchFigure below). No new game data, no new
 * mechanics — this is a display, not a feature.
 *
 * Entirely drawn (SVG + CSS), not photographic — no Adobe imagery, no image
 * assets on disk at all for the backdrop/scenery. A licensed photo was
 * tried first and rejected directly ("not some real image of a garden... a
 * game version"). The one deliberate exception is real teammate PHOTOS on
 * the bench — those are existing, already-live game data (career.squad's
 * own imageUrl / the established fake-face fallback), not new licensed
 * imagery, so reusing them here is the same "display, not a feature" rule
 * as the trophy count or the horse.
 *
 * ── Live feedback incorporated this round ──
 * - The whole screen now renders inside the same `max-w-md w-full mx-auto`
 *   centered column every other screen in this game uses (DashboardShell)
 *   — it used to be full-bleed, which was reported as not matching.
 * - The stable is now an open grazing field (no fence/pen), with a real
 *   drawn bay horse (brown body, black mane/tail/socks) that ambles back
 *   and forth and occasionally lowers its head to graze — no emoji, no
 *   rating-number badge.
 * - Bench teammates are bigger and show a real face/photo (or the game's
 *   own fake-face fallback), no rating-number label, and tapping one now
 *   sends them off toward the garden (the scene to the bench's own left)
 *   before they come back and sit down.
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

/** A tuft of longer grass — the open field's own decoration, replacing the
 *  stable's old fence posts/rails now that the horse roams free rather
 *  than being penned in. */
function GrassTuft({ x, y, color = "#3f8a34" }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none">
      <path d="M -6,0 C -8,-10 -5,-16 -3,-20" />
      <path d="M 0,0 C 0,-12 1,-18 2,-24" />
      <path d="M 6,0 C 8,-9 6,-15 4,-19" />
    </g>
  );
}

/** A tiny figure — head, body, two legs — reused for the walker, drawn
 *  rather than an emoji so it reads as part of the scene's own art rather
 *  than a sticker on top of it. */
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

/**
 * A real bay horse, drawn — the old ellipse-plus-🐴-emoji was reported
 * directly as not good enough ("what even is that, get rid of it"). Bay
 * colouring: a warm chestnut-brown body/neck/head, with a BLACK mane, tail,
 * and lower-leg "socks" — standing in profile with an arched neck and
 * alert ears, not a cartoon blob.
 *
 * `grazing` toggles a slow, occasional head-down dip (via CSS, see the
 * `.horse-head` keyframes below) — "eating grass every now and again."
 * `faded` draws the same shape as a soft outline instead of a solid fill,
 * for the empty "no horse yet" state — a picture, not a caption or a lock.
 */
function Horse({ faded = false }: { faded?: boolean }) {
  const body = "#8a4a2c";
  const bodyDark = "#6e3a22";
  const black = "#1c1712";
  const fill = faded ? "none" : body;
  const fillDark = faded ? "none" : bodyDark;
  const fillBlack = faded ? "none" : black;
  const stroke = faded ? "rgba(60,40,25,0.35)" : "none";
  const strokeBlack = faded ? "rgba(20,15,10,0.3)" : "none";
  const sw = faded ? 2 : 0;

  return (
    <g opacity={faded ? 1 : 1}>
      {/* back legs (drawn first, sit behind the barrel) */}
      <g fill={fillDark} stroke={stroke} strokeWidth={sw}>
        <rect x="10" y="-40" width="7" height="34" rx="2" />
        <rect x="22" y="-40" width="7" height="34" rx="2" />
      </g>
      <g fill={fillBlack} stroke={strokeBlack} strokeWidth={sw}>
        <rect x="10" y="-14" width="7" height="14" rx="1.5" />
        <rect x="22" y="-14" width="7" height="14" rx="1.5" />
      </g>

      {/* tail */}
      <path
        d="M 30,-58 C 42,-52 46,-30 38,-4 C 44,-28 40,-46 28,-54 Z"
        fill={fillBlack}
        stroke={strokeBlack}
        strokeWidth={sw}
      />

      {/* barrel */}
      <ellipse cx="6" cy="-46" rx="34" ry="19" fill={fill} stroke={stroke} strokeWidth={sw} />

      {/* front legs */}
      <g fill={fill} stroke={stroke} strokeWidth={sw}>
        <rect x="-24" y="-38" width="7" height="32" rx="2" />
        <rect x="-12" y="-38" width="7" height="32" rx="2" />
      </g>
      <g fill={fillBlack} stroke={strokeBlack} strokeWidth={sw}>
        <rect x="-24" y="-14" width="7" height="14" rx="1.5" />
        <rect x="-12" y="-14" width="7" height="14" rx="1.5" />
      </g>

      {/* neck + head, grouped so the whole thing can nod down to graze */}
      <g className="horse-head">
        {/* mane, behind the neck/head */}
        <path
          d="M -18,-58 C -30,-62 -40,-72 -46,-84 C -40,-78 -30,-70 -20,-64 C -14,-68 -8,-70 -2,-70 C -10,-64 -16,-60 -18,-58 Z"
          fill={fillBlack}
          stroke={strokeBlack}
          strokeWidth={sw}
        />
        {/* neck */}
        <path
          d="M -8,-52 C -22,-60 -36,-72 -44,-86 L -34,-92 C -26,-78 -14,-66 2,-58 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
        {/* head */}
        <path
          d="M -44,-86 C -50,-92 -50,-100 -44,-104 C -37,-108 -28,-106 -22,-100 C -18,-96 -18,-90 -22,-86 L -34,-80 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
        {/* ear */}
        <path d="M -38,-102 L -34,-112 L -29,-101 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
        {/* forelock, a small tuft of mane between the ears */}
        <path d="M -36,-104 C -39,-108 -37,-112 -33,-112 C -35,-109 -35,-106 -36,-104 Z" fill={fillBlack} stroke={strokeBlack} strokeWidth={sw} />
      </g>
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

/**
 * The stable — redesigned into an open grazing FIELD, not a fenced pen: a
 * real horse (career.horse) should look like it's roaming free, not penned
 * in. A real drawn bay horse (see Horse above) ambles back and forth and
 * occasionally grazes when one is owned; an empty field shows the same
 * horse shape as a soft, faded outline instead — "no horse yet" read from
 * the picture alone, no caption, no number, no emoji.
 */
function StableScene({ horse }: { horse: CareerState["horse"] }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Ground groundColor="#5aa645" />
      <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <Tree x={38} y={270} scale={0.65} />
        <Tree x={266} y={245} scale={0.5} />
        {[
          [30, 460], [70, 480], [120, 470], [175, 485], [230, 465], [270, 478],
          [50, 420], [200, 430], [255, 415], [95, 495],
        ].map(([gx, gy], i) => (
          <GrassTuft key={i} x={gx!} y={gy!} />
        ))}

        {horse ? (
          <g className="horse-roam">
            <g transform="translate(150 420) scale(1.1)">
              <Horse />
            </g>
          </g>
        ) : (
          <g transform="translate(150 420) scale(1.1)">
            <Horse faded />
          </g>
        )}
      </svg>

      <style jsx>{`
        .horse-roam {
          animation: horseStroll 20s ease-in-out infinite;
        }
        @keyframes horseStroll {
          0%, 100% { transform: translateX(-55px) scaleX(1); }
          45% { transform: translateX(55px) scaleX(1); }
          50% { transform: translateX(55px) scaleX(-1); }
          95% { transform: translateX(-55px) scaleX(-1); }
        }
        /* Grazing — a slow, occasional head-down dip, separate from and
           slower than the walk cycle so it reads as "every now and again"
           rather than every stride. */
        :global(.horse-head) {
          transform-origin: -8px -52px;
          animation: horseGraze 11s ease-in-out infinite;
          animation-delay: 2.5s;
        }
        @keyframes horseGraze {
          0%, 72%, 100% { transform: rotate(0deg) translateY(0); }
          82%, 90% { transform: rotate(22deg) translateY(8px); }
        }
      `}</style>
    </div>
  );
}

const SHIRT_COLORS = ["#d4342c", "#2b6cb0", "#1f9142"];

/** Draws just the body/legs of a bench teammate — the head is handled
 *  separately below so a real photo/face can be composited onto it via the
 *  same crop/scale/outline math `drawPlayerHead.ts` uses for every other
 *  figure in this game, instead of the plain flat-colour circle `Figure`
 *  draws for its head. Scaled up from `Figure`'s own proportions so a bench
 *  teammate reads as an actual player, not a doll. */
function BenchBody({ shirt }: { shirt: string }) {
  return (
    <g>
      <rect x="-8" y="-19" width="16" height="20" rx="3" fill={shirt} />
      <rect x="-7" y="2" width="5.5" height="15" fill="#2b2b40" />
      <rect x="1.5" y="2" width="5.5" height="15" fill="#2b2b40" />
    </g>
  );
}

/**
 * A real teammate face on a bench figure — reusing the game's own real
 * crop/scale/outline convention (FaceStyle/FakeFaceStyle, faceStyle.ts /
 * fakeFaceStyle.ts) rather than inventing new geometry, so a face here
 * looks consistent with how the same photo looks everywhere else in the
 * game. `drawPlayerHead.ts` itself is a canvas-2d function (used by
 * CanvasMatch.tsx and the Face Editor) and this whole screen is pure SVG
 * with no canvas anywhere — rather than layering an HTML <canvas> on top of
 * an SVG that's stretched non-uniformly (`preserveAspectRatio="none"`,
 * whose real on-screen scale depends on the container's own aspect ratio
 * and can't be matched by a plain HTML element without a resize observer),
 * this re-expresses drawPlayerHead's core geometry as SVG: a backing
 * circle, a cropped `<image>` (using the same `sourceRect` math
 * drawPlayerHead itself calls) clipped to a circle, and a circular outline
 * stroke. The one piece deliberately NOT reproduced here is the real alpha-
 * silhouette outline trace (stamping the photo's own cutout shape at 12
 * ring points) — that's a canvas-only technique (offscreen compositing),
 * and a plain circular stroke is what drawPlayerHead itself already falls
 * back to for a figure with no photo, so this is a reasonable, honestly
 * simplified substitute for a small decorative bench figure rather than a
 * silent departure from a real rule.
 */
function BenchHead({
  cx0,
  cy0,
  headBaseR,
  imageUrl,
  style,
  fakeStyle,
  cache,
}: {
  cx0: number;
  cy0: number;
  headBaseR: number;
  imageUrl: string | undefined;
  style: FaceStyle;
  fakeStyle: FakeFaceStyle;
  cache: FaceImageCache;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const clipId = useRef(`bench-face-clip-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    setNatural(null);
    const img = cache.get(imageUrl);
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      return;
    }
    const onLoad = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [imageUrl, cache]);

  const usingFake = !!imageUrl && (FAKE_FACES as readonly string[]).includes(imageUrl);
  const effective = usingFake
    ? { ...style, scale: fakeStyle.scale, offsetX: fakeStyle.offsetX, offsetY: fakeStyle.offsetY, crop: fakeStyle.crop }
    : style;

  const r = headBaseR * effective.scale;
  const cx = cx0 + effective.offsetX * headBaseR;
  const cy = cy0 + effective.offsetY * headBaseR;
  const hasPhoto = effective.facesEnabled && !!imageUrl && !!natural;

  let img: { href: string; x: number; y: number; w: number; h: number } | null = null;
  if (hasPhoto && natural) {
    const rect = sourceRect(effective.crop, natural.w, natural.h, CROP_VIEWPORT);
    const scale = (r * 2) / rect.sw;
    img = {
      href: imageUrl!,
      w: natural.w * scale,
      h: natural.h * scale,
      x: cx - r - rect.sx * scale,
      y: cy - r - rect.sy * scale,
    };
  }

  const strokeWidth = Math.max(0.6, headBaseR * 0.12 * effective.outlineWidth);

  return (
    <g>
      {(effective.showBacking || !hasPhoto) && (
        <circle cx={cx} cy={cy} r={r} fill={effective.backingColor} />
      )}
      {img && (
        <>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
          <image
            href={img.href}
            x={img.x}
            y={img.y}
            width={img.w}
            height={img.h}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="none"
          />
        </>
      )}
      {effective.outlineEnabled && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={effective.outlineColor} strokeWidth={strokeWidth} />
      )}
    </g>
  );
}

/** A teammate who actually stands up and walks when tapped, rather than
 *  sitting frozen forever — requested directly, pointing at the match
 *  engine's own real moving/controllable characters as proof this game
 *  already knows how to do it. Idle, he sways gently in place; tapped, he
 *  walks off the LEFT edge of this scene's own viewBox — toward the garden,
 *  which sits immediately to the bench's own left in the scene order
 *  (stable, garden, bench) — pauses briefly as if now over there, then
 *  walks back and sits down. A literal cross-scene walk isn't practical
 *  here (the three scenes are separate SVGs in a swiped flex track, not one
 *  shared canvas), so this is the honest equivalent: visibly leaving toward
 *  the garden and coming back, not a bigger cross-component restructure.
 *
 *  Shows the teammate's real face/photo (career.squad's imageUrl, or the
 *  game's own fake-face fallback so nobody is ever a blank circle) instead
 *  of the old flat-colour head — see BenchHead. The old small overall-
 *  rating number above the head is gone entirely, per direct feedback. */
function BenchFigure({
  seatX,
  shirt,
  imageUrl,
  style,
  fakeStyle,
  cache,
}: {
  seatX: number;
  shirt: string;
  imageUrl: string | undefined;
  style: FaceStyle;
  fakeStyle: FakeFaceStyle;
  cache: FaceImageCache;
}) {
  const [walking, setWalking] = useState(false);
  return (
    <g
      transform={`translate(${seatX} 400) scale(1.7)`}
      onClick={() => {
        if (walking) return;
        setWalking(true);
        setTimeout(() => setWalking(false), 4200);
      }}
      style={{ cursor: "pointer" }}
      className={walking ? "bench-figure walking" : "bench-figure idle"}
    >
      <g className="bench-figure-body">
        <BenchBody shirt={shirt} />
        <BenchHead cx0={0} cy0={-25} headBaseR={9} imageUrl={imageUrl} style={style} fakeStyle={fakeStyle} cache={cache} />
      </g>
      <style jsx>{`
        .bench-figure.idle .bench-figure-body { animation: sway 3.6s ease-in-out infinite; }
        .bench-figure.walking .bench-figure-body { animation: walkToGarden 4.2s ease-in-out; }
        @keyframes sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(2.5deg); }
        }
        @keyframes walkToGarden {
          0% { transform: translateY(0) translateX(0) scaleX(1); }
          10% { transform: translateY(-4px) translateX(-40px) scaleX(-1); }
          40% { transform: translateY(-4px) translateX(-160px) scaleX(-1); }
          65% { transform: translateY(-4px) translateX(-160px) scaleX(-1); }
          90% { transform: translateY(-4px) translateX(-40px) scaleX(1); }
          100% { transform: translateY(0) translateX(0) scaleX(1); }
        }
      `}</style>
    </g>
  );
}

/** The bench: real teammates (career.squad), drawn bigger, with a real
 *  face/photo apiece — see BenchFigure/BenchHead for why. No numbers, no
 *  sentences at all now — the old overall-rating label is gone. */
function BenchScene({ visitors }: { visitors: CareerState["squad"] }) {
  const seats = [80, 150, 220];
  const [cache] = useState<FaceImageCache>(() => createFaceImageCache());
  const [style] = useState<FaceStyle>(() => (typeof window !== "undefined" ? loadFaceStyle() : DEFAULT_FACE_STYLE));
  const [fakeStyle] = useState<FakeFaceStyle>(() => (typeof window !== "undefined" ? loadFakeFaceStyle() : DEFAULT_FAKE_FACE_STYLE));

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Ground groundColor="#4f9d3a" />
      <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <Tree x={30} y={280} scale={0.85} />
        <Tree x={270} y={310} scale={0.7} />
        <g transform="translate(150 400)">
          <rect x="-90" y="-6" width="180" height="10" fill="#8a5a34" />
          <rect x="-90" y="-34" width="180" height="8" fill="#8a5a34" />
          <rect x="-80" y="4" width="8" height="24" fill="#5a3a22" />
          <rect x="72" y="4" width="8" height="24" fill="#5a3a22" />
          <rect x="-84" y="-46" width="8" height="20" fill="#5a3a22" />
          <rect x="76" y="-46" width="8" height="20" fill="#5a3a22" />
        </g>
        {(visitors.length ? visitors : []).slice(0, 3).map((p, i) => (
          <BenchFigure
            key={p.id}
            seatX={seats[i]!}
            shirt={SHIRT_COLORS[i % SHIRT_COLORS.length]!}
            imageUrl={p.imageUrl ?? fakeFaceFor(p.id)}
            style={style}
            fakeStyle={fakeStyle}
            cache={cache}
          />
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
  const visitors = useMemo(() => pickVisitors(career), [career]);

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {/* Same centered column every other screen uses (DashboardShell) —
          this used to be full-bleed, reported directly as not matching. */}
      <div className="flex-1 min-h-0 flex flex-col max-w-md w-full mx-auto">
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
    </div>
  );
}
