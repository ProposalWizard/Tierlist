// GAMECAP: the temporary patches to the game's own files, applied for one
// capture run and reverted after it (capture.mjs). Every replacement must find
// its anchor exactly once, or the run stops before it starts and nothing is
// changed. Each patched file carries the marker below, so a cleanup only ever
// reverts a file that holds our patch.
//
// 1. lib/star/sprites.ts — skin and hair colour per man (the baked figures have
//    plain skin and hair; we recolour the unmasked pixels by brightness), and a
//    bigger tinted-atlas cache (every man with his own look is his own "kit").
// 2. lib/star/goalClip/render.ts — pass skin/hair through to the sprite kit,
//    and draw the ball as a real football (black panels, rolling).
export const MARKER = "GAMECAP-TMP";

export const PATCHES = [
  {
    file: "lib/star/sprites.ts",
    edits: [
      {
        find: `export interface SpriteKit {
  shirt: string;
  shorts: string;
  socks: string;
}`,
        replace: `export interface SpriteKit {
  shirt: string;
  shorts: string;
  socks: string;
  // ${MARKER}: skin and hair colour (tools/video-factory/gamecap)
  skin?: string;
  hair?: string;
}`,
      },
      {
        find: `    const sum = mr + mg + mb;
    if (sum < 8) continue;`,
        replace: `    const sum = mr + mg + mb;
    if (sum < 8) {
      // ${MARKER}: recolour skin and hair by brightness.
      if (kit.skin || kit.hair) {
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (kit.skin && r > g && g >= b - 4 && r - b > 22 && L > 64) {
          const [sr, sg, sb] = hexRgb(kit.skin); const k = Math.min(1.2, L / 108);
          o[i] = Math.min(255, sr * k); o[i + 1] = Math.min(255, sg * k); o[i + 2] = Math.min(255, sb * k);
        } else if (kit.hair && r >= b && r - b >= 8 && L >= 24 && L <= 64) {
          const [hr, hg, hb] = hexRgb(kit.hair); const k = 0.6 + 0.5 * (L / 50);
          o[i] = Math.min(255, hr * k); o[i + 1] = Math.min(255, hg * k); o[i + 2] = Math.min(255, hb * k);
        }
      }
      continue;
    }`,
      },
      {
        find: "function kitKey(kit: SpriteKit, n: number): string { return `${n}|${kit.shirt}|${kit.shorts}|${kit.socks}`; }",
        replace: "function kitKey(kit: SpriteKit, n: number): string { return `${n}|${kit.shirt}|${kit.shorts}|${kit.socks}|${kit.skin ?? \"\"}|${kit.hair ?? \"\"}`; } // " + MARKER,
      },
      {
        find: "  if (tinted.size > 24) tinted.delete(tinted.keys().next().value as string);",
        replace: `  if (tinted.size > 72) tinted.delete(tinted.keys().next().value as string); // ${MARKER}`,
      },
    ],
  },
  {
    file: "lib/star/goalClip/render.ts",
    edits: [
      {
        find: "const kit = { shirt: body.kit.shirt, shorts: body.kit.shorts, socks: body.kit.socks ?? body.kit.shirt };",
        replace: `const kit = { shirt: body.kit.shirt, shorts: body.kit.shorts, socks: body.kit.socks ?? body.kit.shirt, skin: (body.kit as { skin?: string }).skin, hair: (body.kit as { hair?: string }).hair }; // ${MARKER}`,
      },
      {
        // The old ball: from its dark rim to the end of drawBall.
        findBetween: [`      ctx.fillStyle = "rgba(15,15,15,0.85)";
      ctx.beginPath(); ctx.arc(p.px, p.py, r * 1.12`, `    },
  };
}

/** The scene at clip time`],
        replace: `      drawFootball(ctx, cam, track, t, p.px, p.py, r * 1.15); // ${MARKER}
`,
        keepEnd: true,
      },
      {
        find: "/** The scene at clip time",
        replace: `// ${MARKER}: a real football, white with black panels on an icosahedron, rolling with the distance travelled.
const GC_ICO: [number, number, number][] = (() => {
  const f = (1 + Math.sqrt(5)) / 2, v: [number, number, number][] = [];
  for (const a of [-1, 1]) for (const b of [-f, f]) { v.push([0, a, b]); v.push([a, b, 0]); v.push([b, 0, a]); }
  return v.map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l] as [number, number, number]; });
})();
function gcRolled(track: GoalTrack, t: number): number {
  let d = 0; let prev = frameAt(track, 0).ball;
  for (let u = 1 / 30; u <= t; u += 1 / 30) { const b = frameAt(track, u).ball; d += Math.hypot(b.x - prev.x, b.y - prev.y, b.z - prev.z); prev = b; }
  return d / 0.11;
}
function drawFootball(ctx: CanvasRenderingContext2D, cam: FpCamera, track: GoalTrack, t: number, x: number, y: number, r: number): void {
  const a = frameAt(track, Math.max(0, t - 1 / 30)).ball, b = frameAt(track, t).ball;
  const pa = project(cam, a.x, a.y, a.z), pb = project(cam, b.x, b.y, b.z);
  let dx = pb && pa ? pb.px - pa.px : 0, dy = pb && pa ? pb.py - pa.py : 1; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const ang = gcRolled(track, t);
  const ax = -dy, ay = dx, c = Math.cos(ang), s = Math.sin(ang);
  const rot = ([px, py, pz]: [number, number, number]): [number, number, number] => {
    const dot = ax * px + ay * py; const cx = ay * pz, cy = -ax * pz, cz = ax * py - ay * px;
    return [px * c + cx * s + ax * dot * (1 - c), py * c + cy * s + ay * dot * (1 - c), pz * c + cz * s];
  };
  ctx.save();
  ctx.fillStyle = "rgba(20,20,20,0.9)"; ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.7, "#eef0f2"); g.addColorStop(1, "#b9bfc6");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  for (const v of GC_ICO) {
    const [px, py, pz] = rot(v); if (pz < -0.15) continue;
    const cxp = x + px * r, cyp = y + py * r;
    const k = Math.max(0.25, pz), tilt = Math.atan2(py, px);
    ctx.fillStyle = \`rgba(18,18,22,\${0.75 + 0.25 * pz})\`; ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const q = j * Math.PI * 2 / 5 + ang * 0.2; let ux = Math.cos(q) * r * 0.32, uy = Math.sin(q) * r * 0.32;
      const al = ux * Math.cos(tilt) + uy * Math.sin(tilt), ac = -ux * Math.sin(tilt) + uy * Math.cos(tilt);
      ux = al * k * Math.cos(tilt) - ac * Math.sin(tilt); uy = al * k * Math.sin(tilt) + ac * Math.cos(tilt);
      if (j) ctx.lineTo(cxp + ux, cyp + uy); else ctx.moveTo(cxp + ux, cyp + uy);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = Math.max(0.6, r * 0.12);
  ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.45, Math.PI * 1.05, Math.PI * 1.5); ctx.stroke(); ctx.restore();
}

/** The scene at clip time`,
      },
    ],
  },
];

/** Apply the edits to a file's text. Throws (naming the anchor) when one is missing or not unique. */
export function applyEdits(file, text, edits) {
  let s = text;
  for (const e of edits) {
    if (e.findBetween) {
      const [a, b] = e.findBetween;
      const i = s.indexOf(a);
      if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error(`${file}: anchor not found once: ${a.slice(0, 60)}`);
      const j = s.indexOf(b, i);
      if (j < 0) throw new Error(`${file}: end anchor not found: ${b.slice(0, 60)}`);
      s = s.slice(0, i) + e.replace + s.slice(j);
      continue;
    }
    const n = s.split(e.find).length - 1;
    if (n !== 1) throw new Error(`${file}: anchor found ${n} times (need 1): ${e.find.slice(0, 70)}`);
    s = s.replace(e.find, () => e.replace);
  }
  return s;
}
