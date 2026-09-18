"use client";
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { DEFAULT_FACE_STYLE, loadFaceStyle, CROP_VIEWPORT, type FaceStyle } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE, loadFakeFaceStyle, type FakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { FAKE_FACES, fakeFaceFor } from "@/lib/star/fakeFaces";
import { sourceRect } from "@/lib/star/portrait";
import { createFaceImageCache, type FaceImageCache } from "@/lib/star/faceImageCache";
import { shuffle } from "@/lib/star/cups";

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
 * ── A dedicated visual-quality pass (this round) ──
 * This screen used to be flat, single-colour SVG shapes on purpose — an
 * earlier round's own rule was "no image assets on disk, nothing
 * photographic." That constraint was explicitly LIFTED by direct
 * instruction for this pass: "use real image textures, gradients, shadows,
 * whatever gets the best look — don't restrict yourself to flat hand-drawn
 * shapes." Real raster/photo assets still can't be sourced into this repo
 * from this sandboxed session, so the actual approach taken (agreed with
 * the user) is to stay in SVG/CSS but use it far more richly: real
 * multi-stop linear/radial gradients for material and volume (sky, grass,
 * honey wood grain, glass, muscle shading), soft drop-shadows for depth
 * (a single shared `<filter>`, reused rather than duplicated), layered
 * highlight/shadow shapes, and real considered proportions on the tree,
 * horse, trophy cabinet, stable building and bench — all built against the
 * user's own real reference photos, described in words in this round's own
 * brief. Every real game-data mechanism (trophy count, Ballon d'Or badge,
 * horse ownership state, the walker figure, the bench's real teammate
 * faces/tap-to-walk, the random bench trio, the centered-column layout, the
 * swipe/dot navigation) is untouched — this is scenery and material quality
 * only. `<SceneDefs>` holds the one shared set of gradients/filters, reused
 * (not redefined per shape) across all three scenes for both consistency
 * and performance on a real phone.
 *
 * The one deliberate exception to "not photographic" remains real teammate
 * PHOTOS on the bench — those are existing, already-live game data
 * (career.squad's own imageUrl / the established fake-face fallback), not
 * new licensed imagery, so reusing them here is the same "display, not a
 * feature" rule as the trophy count or the horse.
 */

const SCENES = ["stable", "garden", "bench"] as const;
type Scene = (typeof SCENES)[number];

/** A genuinely random pick of a few real teammates to sit on the bench —
 *  requested directly ("the 3 players... should be randomly picked each
 *  time you go into the garden area"), replacing an earlier version that
 *  deliberately seeded off the save (week/season) so the same trio held
 *  for a while. Reuses the same real Fisher-Yates `shuffle` the cup draw
 *  itself uses, fed `Math.random` rather than a seeded rng — a real reroll
 *  every time, not a stable one. Computed once per mount of GardenScreen
 *  (see its own `useState` lazy initializer below), not on every re-render
 *  while already on the screen, so swiping between scenes never reshuffles
 *  who's sitting there mid-visit. */
function pickRandomVisitors(career: CareerState): CareerState["squad"] {
  const squad = career.squad ?? [];
  if (squad.length <= 3) return squad;
  return shuffle(squad, Math.random).slice(0, 3);
}

/**
 * The one shared set of gradients/filters every scene draws from. Kept as a
 * single reused `<defs>` block per scene's own `<svg>` document (SVG ids
 * only need to be unique within their own document, so the same id string
 * in three separate `<svg>`s is fine) rather than inventing a fresh gradient
 * per shape — real material variety, without asking a phone to composite
 * dozens of unique gradient/filter definitions.
 */
function SceneDefs() {
  return (
    <defs>
      {/* Sky — a real reference: a thin pale band right at the horizon,
          blending smoothly up into a rich, saturated blue at the top. */}
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2f6fb0" />
        <stop offset="52%" stopColor="#5b9bd9" />
        <stop offset="86%" stopColor="#bfe4f5" />
        <stop offset="100%" stopColor="#eef8fb" />
      </linearGradient>

      {/* Grass — darker/cooler further away (top of the grass band),
          lighter/warmer close to camera (bottom), plus a fine blade-texture
          pattern laid on top so it never reads as a flat rectangle. */}
      <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3d7a34" />
        <stop offset="100%" stopColor="#6fbf4a" />
      </linearGradient>
      <pattern id="grassTexture" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(4)">
        <path d="M2,16 C2,11 3,8 3,3" stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" fill="none" />
        <path d="M9,16 C9,11 8,7 9,2" stroke="rgba(0,35,0,0.14)" strokeWidth="0.9" fill="none" />
        <path d="M13,16 C13,12 14,8 13,4" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" fill="none" />
      </pattern>

      {/* Honey wood — trophy cabinet, bench slats, plinth. */}
      <linearGradient id="woodGrad" x1="0" y1="0" x2="1" y2="0.15">
        <stop offset="0%" stopColor="#a8703c" />
        <stop offset="16%" stopColor="#8f5a2d" />
        <stop offset="32%" stopColor="#b17b42" />
        <stop offset="50%" stopColor="#96602f" />
        <stop offset="68%" stopColor="#bd8750" />
        <stop offset="84%" stopColor="#8a5629" />
        <stop offset="100%" stopColor="#a8703c" />
      </linearGradient>
      <linearGradient id="woodDarkGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#5c3a1e" />
        <stop offset="50%" stopColor="#734524" />
        <stop offset="100%" stopColor="#4a2c16" />
      </linearGradient>

      {/* Glass — cabinet front/shelves. */}
      <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(214,232,242,0.32)" />
        <stop offset="50%" stopColor="rgba(255,255,255,0.10)" />
        <stop offset="100%" stopColor="rgba(180,205,220,0.26)" />
      </linearGradient>
      <radialGradient id="spotGlow" cx="50%" cy="0%" r="80%">
        <stop offset="0%" stopColor="rgba(255,236,180,0.55)" />
        <stop offset="100%" stopColor="rgba(255,236,180,0)" />
      </radialGradient>

      {/* Tree — bark shading, layered sunlit/shadowed canopy tones. */}
      <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#43290f" />
        <stop offset="45%" stopColor="#7a5230" />
        <stop offset="100%" stopColor="#583a1e" />
      </linearGradient>
      <radialGradient id="canopyLight" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#75c95d" />
        <stop offset="100%" stopColor="#3f8a3a" />
      </radialGradient>
      <radialGradient id="canopyDark" cx="60%" cy="65%" r="75%">
        <stop offset="0%" stopColor="#357a38" />
        <stop offset="100%" stopColor="#1e4a22" />
      </radialGradient>

      {/* Stable building — painted board wall, corrugated metal roof. */}
      <linearGradient id="stableWallGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#436260" />
        <stop offset="100%" stopColor="#28403e" />
      </linearGradient>
      <linearGradient id="metalGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#d3dbde" />
        <stop offset="55%" stopColor="#9aa6ab" />
        <stop offset="100%" stopColor="#78868b" />
      </linearGradient>

      {/* Horse — chestnut-bay muscle shading. */}
      <linearGradient id="horseBodyGrad" x1="0" y1="0" x2="0.15" y2="1">
        <stop offset="0%" stopColor="#af6b41" />
        <stop offset="50%" stopColor="#8a4a2c" />
        <stop offset="100%" stopColor="#5c2f16" />
      </linearGradient>
      <linearGradient id="horseDarkGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7a4024" />
        <stop offset="100%" stopColor="#472312" />
      </linearGradient>

      {/* Black metal — bench frame legs. */}
      <linearGradient id="metalDarkGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#0f0f0f" />
        <stop offset="50%" stopColor="#2c2c2c" />
        <stop offset="100%" stopColor="#0a0a0a" />
      </linearGradient>

      {/* One shared soft drop-shadow, reused everywhere something needs to
          lift off the grass (trees, cabinet, stable, bench, horse). */}
      <filter id="softShadow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.28" />
      </filter>
    </defs>
  );
}

/** A gradient sky-over-textured-grass ground, shared by all three scenes so
 *  the swipe reads as one continuous place rather than three unrelated
 *  cards, and now carries the real gradient/texture treatment described in
 *  this round's brief instead of two flat colour rects. */
function Ground() {
  return (
    <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="skyGradG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6fb0" />
          <stop offset="52%" stopColor="#5b9bd9" />
          <stop offset="86%" stopColor="#bfe4f5" />
          <stop offset="100%" stopColor="#eef8fb" />
        </linearGradient>
        <linearGradient id="grassGradG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d7a34" />
          <stop offset="100%" stopColor="#6fbf4a" />
        </linearGradient>
        <pattern id="grassTextureG" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(4)">
          <path d="M2,16 C2,11 3,8 3,3" stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" fill="none" />
          <path d="M9,16 C9,11 8,7 9,2" stroke="rgba(0,35,0,0.14)" strokeWidth="0.9" fill="none" />
          <path d="M13,16 C13,12 14,8 13,4" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" fill="none" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="300" height="220" fill="url(#skyGradG)" />
      <rect x="0" y="210" width="300" height="290" fill="url(#grassGradG)" />
      <rect x="0" y="210" width="300" height="290" fill="url(#grassTextureG)" opacity="0.4" />
      <rect x="0" y="205" width="300" height="10" fill="rgba(0,0,0,0.10)" />
    </svg>
  );
}

/** A real, layered tree — a shaded bark trunk with a couple of asymmetric
 *  branch strokes, and a full rounded canopy built from several overlapping
 *  sunlit/shadowed tones instead of three flat same-colour circles, so it
 *  reads as elegant and strong without dominating the scene. */
function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="1" rx="15" ry="3.5" fill="rgba(0,0,0,0.18)" />
      <path d="M -3,0 C -5,-11 -3,-19 -2,-30 C -1,-19 1,-11 3,0 Z" fill="url(#trunkGrad)" />
      <path d="M -2,-15 C -8,-17 -10,-11 -15,-13" stroke="#43290f" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M 2,-17 C 7,-20 9,-14 14,-16" stroke="#43290f" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <g filter="url(#softShadow)">
        <circle cx="-7" cy="-31" r="17" fill="url(#canopyDark)" />
        <circle cx="8" cy="-33" r="16" fill="url(#canopyLight)" />
        <circle cx="0" cy="-42" r="15" fill="url(#canopyLight)" opacity="0.92" />
        <circle cx="-11" cy="-41" r="12" fill="url(#canopyDark)" opacity="0.88" />
        <circle cx="7" cy="-46" r="11" fill="url(#canopyLight)" />
      </g>
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

/** A tuft of longer grass — the open field's own decoration. */
function GrassTuft({ x, y, color = "#3f8a34" }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none">
      <path d="M -6,0 C -8,-10 -5,-16 -3,-20" />
      <path d="M 0,0 C 0,-12 1,-18 2,-24" />
      <path d="M 6,0 C 8,-9 6,-15 4,-19" />
    </g>
  );
}

/** A tiny figure — head, body, two legs — reused for the walker. */
function Figure({ skin = "#e8b593", shirt = "#2b6cb0" }: { skin?: string; shirt?: string }) {
  return (
    <g>
      <ellipse cx="0" cy="9" rx="6" ry="1.6" fill="rgba(0,0,0,0.16)" />
      <circle cx="0" cy="-16" r="5" fill={skin} />
      <rect x="-4.5" y="-11" width="9" height="12" rx="2" fill={shirt} />
      <rect x="-4" y="1" width="3" height="8" fill="#2b2b40" />
      <rect x="1" y="1" width="3" height="8" fill="#2b2b40" />
    </g>
  );
}

/**
 * A real bay horse, rebuilt this round for real gradient muscle shading and
 * a leaner, more athletic racehorse-like build (a taller barrel, more
 * forward lean through the neck) while keeping a soft, warm, loved-pet
 * expression in the eye rather than a fierce one — per the user's own
 * explicit "powerful and quick... but also loving, pet-like" brief.
 *
 * `grazing` toggles a slow, occasional head-down dip (via CSS, see the
 * `.horse-head` keyframes below). `faded` draws the same shape as a soft
 * outline instead of a solid fill, for the empty "no horse yet" state.
 */
function Horse({ faded = false }: { faded?: boolean }) {
  const black = "#1c1712";
  const fill = faded ? "none" : "url(#horseBodyGrad)";
  const fillBlack = faded ? "none" : black;
  const stroke = faded ? "rgba(60,40,25,0.35)" : "none";
  const strokeBlack = faded ? "rgba(20,15,10,0.3)" : "none";
  const sw = faded ? 2 : 0;

  // Reported directly against the real reference photo: the previous build
  // "kind of looked like a horse" but wasn't one — a short, disconnected
  // neck jutting off at a steep angle from a plain oval body, with legs set
  // too close together near the centre rather than under the body's own
  // front/back ends. Rebuilt on real horse proportions instead of guessed
  // ones: one continuous body mass (a barrel PLUS a rounded rump at the
  // back and a chest bulge at the front, all overlapping into one shape,
  // the way a real horse's torso reads in silhouette), legs planted
  // directly under the chest and the rump rather than bunched centrally,
  // and a neck that's a real, single, continuously-widening arch running
  // from the chest up into the head — not two disconnected pieces stapled
  // together at an angle. Also asked for directly: more muscular/beefy —
  // the rump and chest masses are deliberately large and rounded, and a
  // rump-shading ellipse reads as real hindquarter muscle, matching a
  // racehorse's build rather than a slim, spindly one.
  return (
    <g filter={faded ? undefined : "url(#softShadow)"}>
      <ellipse cx="2" cy="2" rx="44" ry="6" fill="rgba(0,0,0,0.2)" />

      {/* back legs — planted directly under the rump */}
      <g fill={fill} stroke={stroke} strokeWidth={sw}>
        <rect x="12" y="-27" width="8" height="25" rx="2.5" />
        <rect x="25" y="-27" width="8" height="25" rx="2.5" />
      </g>
      <g fill={fillBlack} stroke={strokeBlack} strokeWidth={sw}>
        <rect x="12" y="-11" width="8" height="12" rx="1.5" />
        <rect x="25" y="-11" width="8" height="12" rx="1.5" />
      </g>

      {/* tail, flowing from the rump */}
      <path
        d="M 33,-42 C 47,-34 49,-10 39,12 C 43,-10 39,-30 27,-38 Z"
        fill={fillBlack}
        stroke={strokeBlack}
        strokeWidth={sw}
      />

      {/* one continuous body mass — barrel, a rounded rump behind it, a
          chest bulge in front — rather than a single plain oval, so the
          silhouette actually reads as a muscular horse's torso */}
      <ellipse cx="0" cy="-32" rx="30" ry="14" fill={fill} stroke={stroke} strokeWidth={sw} />
      <ellipse cx="20" cy="-35" rx="16" ry="15" fill={fill} stroke={stroke} strokeWidth={sw} />
      <ellipse cx="-22" cy="-33" rx="12" ry="13" fill={fill} stroke={stroke} strokeWidth={sw} />
      {!faded && <ellipse cx="-4" cy="-41" rx="22" ry="6" fill="rgba(255,255,255,0.13)" />}
      {!faded && <ellipse cx="22" cy="-30" rx="10" ry="9" fill="rgba(0,0,0,0.12)" />}
      {!faded && <ellipse cx="6" cy="-22" rx="20" ry="6" fill="rgba(0,0,0,0.1)" />}

      {/* front legs — planted directly under the chest */}
      <g fill={fill} stroke={stroke} strokeWidth={sw}>
        <rect x="-33" y="-26" width="8" height="24" rx="2.5" />
        <rect x="-21" y="-26" width="8" height="24" rx="2.5" />
      </g>
      <g fill={fillBlack} stroke={strokeBlack} strokeWidth={sw}>
        <rect x="-33" y="-11" width="8" height="12" rx="1.5" />
        <rect x="-21" y="-11" width="8" height="12" rx="1.5" />
      </g>

      {/* neck + head, grouped so the whole thing can nod down to graze — a
          single arch from the chest's own top, widening smoothly into the
          head rather than two pieces meeting at a hard angle */}
      <g className="horse-head">
        {/* mane, behind the neck/head */}
        <path
          d="M -16,-42 C -27,-49 -37,-60 -42,-75 C -37,-66 -28,-57 -18,-51 C -14,-55 -9,-58 -3,-58 C -10,-53 -14,-47 -16,-42 Z"
          fill={fillBlack}
          stroke={strokeBlack}
          strokeWidth={sw}
        />
        {/* neck — a real single arch, base wide at the chest, tapering
            smoothly up into the head */}
        <path
          d="M -6,-40 C -18,-49 -30,-61 -37,-76 C -34,-80 -30,-82 -25,-83 C -20,-68 -10,-55 5,-46 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
        {/* head — a real elongated wedge: poll high at the back, muzzle
            reaching forward and slightly down */}
        <path
          d="M -37,-76 C -42,-83 -43,-91 -37,-96 C -30,-100 -20,-98 -14,-91 C -10,-87 -11,-82 -18,-78 L -26,-75 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
        {/* ear */}
        <path d="M -32,-95 L -29,-105 L -23,-93 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d="M -30,-97 C -32,-101 -30,-105 -26,-105 C -28,-102 -28,-99 -30,-97 Z" fill={fillBlack} stroke={strokeBlack} strokeWidth={sw} />
        {!faded && (
          <>
            {/* a warm, soft, pet-like eye — not a fierce one */}
            <ellipse cx="-24" cy="-88" rx="2.6" ry="2.9" fill="#241408" />
            <circle cx="-23.2" cy="-89.1" r="1" fill="#fff" opacity="0.9" />
            <path d="M -27,-91 C -25,-93 -22,-93 -20,-91" stroke="#3a2314" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.6" />
          </>
        )}
      </g>
    </g>
  );
}

/** The garden scene: rich gradient grass, layered trees, a real elevated
 *  glass-and-wood trophy cabinet (a real trophy-count HUD — a cabinet glyph
 *  + a number, never a sentence) and a small figure ambling between a few
 *  fixed spots on its own via a slow CSS animation. */
function GardenScene({ trophyCount, ballonDors }: { trophyCount: number; ballonDors: number }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Ground />
      <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <SceneDefs />
        <Tree x={48} y={300} scale={1.1} />
        <Tree x={252} y={280} scale={0.9} />
        <Tree x={230} y={400} scale={0.75} />
        <Flower x={90} y={360} color="#f4728a" />
        <Flower x={130} y={420} color="#f4c542" />
        <Flower x={190} y={340} color="#e857e8" />
        <Flower x={220} y={450} color="#f4728a" />

        {/* the trophy cabinet — a real elevated wood-and-glass display case:
            warm honey wood-grain frame, a solid plinth with cupboard doors
            and small round handles, glass panels with diagonal reflective
            highlight streaks, and a warm top-spotlight glow pooling onto
            the shelves. However many real trophies (career.trophies) fit,
            capped visually at six so the case never overflows its frame. */}
        <g transform="translate(150 250)">
          <ellipse cx="0" cy="48" rx="42" ry="6" fill="rgba(0,0,0,0.22)" />
          {/* plinth / base with cupboard doors */}
          <rect x="-38" y="26" width="76" height="20" rx="2" fill="url(#woodDarkGrad)" filter="url(#softShadow)" />
          <line x1="0" y1="27" x2="0" y2="45" stroke="#3f2711" strokeWidth="1.4" />
          <circle cx="-13" cy="36" r="1.5" fill="#e8c98a" />
          <circle cx="13" cy="36" r="1.5" fill="#e8c98a" />
          {/* cabinet frame */}
          <rect x="-34" y="-34" width="68" height="62" rx="4" fill="url(#woodGrad)" stroke="#4a3319" strokeWidth="2.5" filter="url(#softShadow)" />
          {/* warm spotlight glow from recessed top lights */}
          <rect x="-30" y="-31" width="60" height="26" fill="url(#spotGlow)" />
          {/* glass + interior */}
          <rect x="-28" y="-28" width="56" height="50" fill="#241a10" />
          <rect x="-28" y="-28" width="56" height="50" fill="url(#glassGrad)" />
          {/* Reported directly: the diagonal reflective streaks used above
              were steep enough (much taller than wide) that they read as
              vertical glass-pane dividers cutting the case up, not as a
              reflection — "don't have any vertical glass panes there."
              Removed outright. Three real horizontal shelf lines, evenly
              spaced with real headroom between them, take their place —
              "just have three horizontal ones that have enough space to
              fit trophies into." */}
          <rect x="-26" y="-15.5" width="52" height="1.6" fill="rgba(255,255,255,0.26)" />
          <rect x="-26" y="0" width="52" height="1.6" fill="rgba(255,255,255,0.22)" />
          <rect x="-26" y="15.5" width="52" height="1.6" fill="rgba(255,255,255,0.18)" />
          {Array.from({ length: Math.min(trophyCount, 6) }).map((_, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            return <text key={i} x={-18 + col * 18} y={-9 + row * 15.5} fontSize="14">🏆</text>;
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

/** A real wooden stable building — painted board wall, white trim, a
 *  corrugated metal roof, and a few split stable doors with the white
 *  X-brace pattern — as a background element in the stable scene. */
function StableBuilding({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} filter="url(#softShadow)">
      <ellipse cx="0" cy="12" rx="70" ry="7" fill="rgba(0,0,0,0.2)" />
      {/* wall */}
      <rect x="-55" y="-60" width="110" height="70" fill="url(#stableWallGrad)" />
      {/* roof */}
      <polygon points="-63,-60 63,-60 50,-79 -50,-79" fill="url(#metalGrad)" stroke="#647377" strokeWidth="1" />
      {/* Reported directly: the old fixed x1/x2 step (15 vs the roof's own
          eave-to-ridge run of ~12.5) drifted apart line by line, so the
          8th ridge line's own end point (x2=59) landed past the ridge
          edge's real right corner (x=50) — a stray line visibly poking out
          past the roof outline. Each line's endpoints are now interpolated
          exactly along the polygon's own two real edges (the eave from
          -63..63, the ridge from -50..50), so the last one always lands
          precisely on the roof's own top-right corner, never past it. */}
      {Array.from({ length: 8 }).map((_, i) => {
        const t = i / 7;
        return <line key={i} x1={-63 + t * 126} y1={-60} x2={-50 + t * 100} y2={-79} stroke="rgba(0,0,0,0.15)" strokeWidth="1" />;
      })}
      {/* trim */}
      <rect x="-56" y="-62" width="112" height="4" fill="#f2f0e6" />
      <rect x="-56" y="8" width="112" height="4" fill="#f2f0e6" />
      {/* three split stable doors, each with a white X-brace */}
      {[-34, 0, 34].map((dx, i) => (
        <g key={i} transform={`translate(${dx} 0)`}>
          <rect x="-13" y="-40" width="26" height="40" fill="#f2f0e6" stroke="#c9c6b8" strokeWidth="0.6" />
          <rect x="-11" y="-38" width="22" height="17" fill="#33504d" />
          <rect x="-11" y="-19" width="22" height="19" fill="#2b4744" />
          <path d="M -11,-38 L 11,-21 M 11,-38 L -11,-21" stroke="#f2f0e6" strokeWidth="1.4" />
          <path d="M -11,-19 L 11,0 M 11,-19 L -11,0" stroke="#f2f0e6" strokeWidth="1.4" />
        </g>
      ))}
    </g>
  );
}

/**
 * The stable — an open grazing FIELD, not a fenced pen: a real horse
 * (career.horse) roams free rather than being penned in, with the real
 * stable BUILDING now sitting in the background rather than fence posts.
 * A real drawn bay horse (see Horse above) ambles back and forth and
 * occasionally grazes when one is owned; an empty field shows the same
 * horse shape as a soft, faded outline instead.
 */
function StableScene({ horse }: { horse: CareerState["horse"] }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Ground />
      <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <SceneDefs />
        <StableBuilding x={68} y={260} scale={0.85} />
        <Tree x={252} y={255} scale={0.7} />
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
 *  separately below so a real photo/face can be composited onto it. */
function BenchBody({ shirt }: { shirt: string }) {
  const skin = "#e8b593";
  return (
    <g>
      <path d="M -8.5,-19 L 8.5,-19 L 6.5,1 C 6.5,2.6 3.6,3.4 0,3.4 C -3.6,3.4 -6.5,2.6 -6.5,1 Z" fill={shirt} />
      <path d="M -8.5,-19 L -6,-18 L -9.5,-6.5 L -12,-7 Z" fill={shirt} />
      <path d="M 8.5,-19 L 6,-18 L 9.5,-6.5 L 12,-7 Z" fill={shirt} />
      <circle cx="-11.5" cy="-6" r="1.5" fill={skin} />
      <circle cx="11.5" cy="-6" r="1.5" fill={skin} />
      <path d="M -6,4 L -1,4 L -1.5,18 L -5,18 Z" fill="#2b2b40" />
      <path d="M 6,4 L 1,4 L 1.5,18 L 5,18 Z" fill="#2b2b40" />
    </g>
  );
}

/**
 * A real teammate face on a bench figure — reusing the game's own real
 * crop/scale/outline convention (FaceStyle/FakeFaceStyle, faceStyle.ts /
 * fakeFaceStyle.ts) rather than inventing new geometry. Unchanged this
 * round, per the brief's own instruction not to touch the bench figures'
 * faces/bodies/interactions — only the surrounding scenery and the bench
 * object itself were in scope.
 */
function BenchHead({
  cx0,
  cy0,
  headBaseR,
  imageUrl,
  fallbackKey,
  style,
  fakeStyle,
  cache,
}: {
  cx0: number;
  cy0: number;
  headBaseR: number;
  imageUrl: string | undefined;
  fallbackKey: string;
  style: FaceStyle;
  fakeStyle: FakeFaceStyle;
  cache: FaceImageCache;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [broken, setBroken] = useState(false);
  const clipId = useRef(`bench-face-clip-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    setBroken(false);
    if (!imageUrl || (FAKE_FACES as readonly string[]).includes(imageUrl)) return;
    const img = cache.get(imageUrl);
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) return;
    const onError = () => {
      window.setTimeout(() => setBroken(true), 1200);
    };
    img.addEventListener("error", onError);
    return () => img.removeEventListener("error", onError);
  }, [imageUrl, cache]);

  const effectiveUrl = broken ? fakeFaceFor(fallbackKey) : imageUrl;
  const usingFake = !!effectiveUrl && (FAKE_FACES as readonly string[]).includes(effectiveUrl);

  useEffect(() => {
    setNatural(null);
    const img = cache.get(effectiveUrl);
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      return;
    }
    const onLoad = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [effectiveUrl, cache]);
  const effective = usingFake
    ? { ...style, scale: fakeStyle.scale, offsetX: fakeStyle.offsetX, offsetY: fakeStyle.offsetY, crop: fakeStyle.crop }
    : style;

  const r = headBaseR * effective.scale;
  const cx = cx0 + effective.offsetX * headBaseR;
  const cy = cy0 + effective.offsetY * headBaseR;
  const hasPhoto = effective.facesEnabled && !!effectiveUrl && !!natural;

  let img: { href: string; x: number; y: number; w: number; h: number } | null = null;
  if (hasPhoto && natural) {
    const rect = sourceRect(effective.crop, natural.w, natural.h, CROP_VIEWPORT);
    const scale = (r * 2) / rect.sw;
    img = {
      href: effectiveUrl!,
      w: natural.w * scale,
      h: natural.h * scale,
      x: cx - r - rect.sx * scale,
      y: cy - r - rect.sy * scale,
    };
  }

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
    </g>
  );
}

/** A teammate who actually stands up and walks when tapped. Unchanged this
 *  round — scenery/material only, per the brief. */
function BenchFigure({
  seatX,
  shirt,
  imageUrl,
  fallbackKey,
  style,
  fakeStyle,
  cache,
}: {
  seatX: number;
  shirt: string;
  imageUrl: string | undefined;
  fallbackKey: string;
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
        <BenchHead cx0={0} cy0={-25} headBaseR={9} imageUrl={imageUrl} fallbackKey={fallbackKey} style={style} fakeStyle={fakeStyle} cache={cache} />
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

/** A real park bench — horizontal honey wood-grain slats with visible gaps,
 *  and a black painted metal A-frame of legs/armrests, per the user's own
 *  reference photo. */
function BenchStructure() {
  return (
    <g transform="translate(150 400)" filter="url(#softShadow)">
      <ellipse cx="0" cy="30" rx="96" ry="7" fill="rgba(0,0,0,0.22)" />
      {/* black metal A-frame: two side frames with an angled armrest */}
      {[-84, 84].map((lx, i) => (
        <g key={i}>
          <path d={`M ${lx},-46 L ${lx},28`} stroke="url(#metalDarkGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d={`M ${lx * 0.86},-6 L ${lx},-6 L ${lx},4`} stroke="url(#metalDarkGrad)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d={`M ${lx * 0.9},-46 L ${lx},-38`} stroke="url(#metalDarkGrad)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </g>
      ))}
      {/* Reported directly: the backrest (ending at -14.6) and the seat
          (starting at -4) used to leave a real 10-unit empty gap between
          them, with nothing bridging it — two floating slat-blocks stacked
          with daylight in between, not a bench anyone could sit on. The
          backrest now runs straight down to meet the seat's own top slat,
          matching where the frame's armrest bend (below) actually sits. */}
      {/* backrest slats — horizontal, with real gaps between them */}
      {Array.from({ length: 4 }).map((_, i) => (
        <rect key={`back-${i}`} x={-88} y={-46 + i * 7} width="176" height="6" rx="1.4" fill="url(#woodGrad)" stroke="rgba(0,0,0,0.18)" strokeWidth="0.5" />
      ))}
      {/* seat slats — starts right where the backrest ends, at the frame's
          own armrest height, not floating below it with a gap */}
      {Array.from({ length: 4 }).map((_, i) => (
        <rect key={`seat-${i}`} x={-92} y={-18 + i * 6} width="184" height="5.4" rx="1.2" fill="url(#woodGrad)" stroke="rgba(0,0,0,0.18)" strokeWidth="0.5" />
      ))}
    </g>
  );
}

/** The bench scene: two trees in the right background, the real park bench
 *  above near the front of the grass, with real teammates (career.squad)
 *  sitting on it — see BenchFigure/BenchHead, both unchanged this round. */
function BenchScene({ visitors }: { visitors: CareerState["squad"] }) {
  const seats = [80, 150, 220];
  const [cache] = useState<FaceImageCache>(() => createFaceImageCache());
  const [style] = useState<FaceStyle>(() => (typeof window !== "undefined" ? loadFaceStyle() : DEFAULT_FACE_STYLE));
  const [fakeStyle] = useState<FakeFaceStyle>(() => (typeof window !== "undefined" ? loadFakeFaceStyle() : DEFAULT_FAKE_FACE_STYLE));

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Ground />
      <svg viewBox="0 0 300 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <SceneDefs />
        <Tree x={228} y={250} scale={0.68} />
        <Tree x={268} y={300} scale={0.8} />
        <BenchStructure />
        {(visitors.length ? visitors : []).slice(0, 3).map((p, i) => (
          <BenchFigure
            key={p.id}
            seatX={seats[i]!}
            shirt={SHIRT_COLORS[i % SHIRT_COLORS.length]!}
            imageUrl={p.imageUrl ?? fakeFaceFor(p.id)}
            fallbackKey={p.id}
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
  const [visitors] = useState<CareerState["squad"]>(() => pickRandomVisitors(career));

  return (
    <div className="flex min-h-screen flex-col bg-black">
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
