"use client";

/**
 * /star-sprites-dev — the baked 3D match figures, on their own.
 *
 * Twenty-two men at the real match size (a standing man 22 px tall on a
 * phone) on a flat checker pitch: two clubs in their real kits, jogging,
 * sprinting, standing, one striking a ball over and over, one celebrating,
 * a keeper diving left and right. A 4x zoom panel under it shows one of each.
 *
 * No football is played here: nothing kicks a ball, nothing scores. The men
 * are plain page elements moved along fixed paths, which is why this page has
 * no canvas loop of its own (see the one-engine guard).
 *
 * Gated like the other dev sandboxes: admins, or a local development build.
 */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageGuide from "@/components/admin/PageGuide";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { kitsOf, keeperKit } from "@/lib/star/kits";
import {
  loadSprites, spriteCell, spriteAtlasUrl, spriteKitOf, keeperDiveClip,
  type SpriteChar, type SpriteClip, type SpriteKit,
} from "@/lib/star/sprites";

const W = 390;
const H = 560;
const FIG = 22;

interface Man {
  id: string;
  char: SpriteChar;
  kit: SpriteKit;
  /** Position and what he is doing at time t (seconds). */
  at: (t: number) => { x: number; y: number; clip: SpriteClip; ct: number; facing: number };
}

const TAU = Math.PI * 2;
const facingOf = (dx: number, dy: number, fallback: number) =>
  Math.hypot(dx, dy) < 1e-4 ? fallback : Math.atan2(dy, dx);

/** A man running laps of an ellipse: jog or sprint by speed. */
function lapper(id: string, kit: SpriteKit, cx: number, cy: number, rx: number, ry: number, period: number, phase: number): Man {
  return {
    id, char: "player", kit,
    at: (t) => {
      const a = (t / period) * TAU + phase;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      const dx = -Math.sin(a) * rx, dy = Math.cos(a) * ry;
      const speed = (Math.hypot(dx, dy) * TAU) / period; // px per second
      return { x, y, clip: speed > 55 ? "sprint" : "jog", ct: t, facing: facingOf(dx, dy, 0) };
    },
  };
}
function stander(id: string, kit: SpriteKit, x: number, y: number, facing: number): Man {
  return { id, char: "player", kit, at: (t) => ({ x, y, clip: "idle", ct: t, facing }) };
}
function kicker(id: string, kit: SpriteKit, x: number, y: number, facing: number): Man {
  return { id, char: "player", kit, at: (t) => { const c = t % 2.2; return { x, y, clip: c < 0.75 ? "kick" : "idle", ct: c < 0.75 ? c : t, facing }; } };
}
function celebrator(id: string, kit: SpriteKit, x: number, y: number): Man {
  return { id, char: "player", kit, at: (t) => ({ x, y, clip: "celebrate", ct: t, facing: Math.PI / 2 }) };
}
/** A keeper on his line: shuffles, then dives one way, then the other. */
function keeper(id: string, kit: SpriteKit, x: number, y: number, facing: number): Man {
  return {
    id, char: "keeper", kit,
    at: (t) => {
      const c = t % 4;
      if (c < 1.3) return { x, y, clip: "ready", ct: t, facing };
      if (c < 2) {
        const side = Math.floor(t / 4) % 2 ? 1 : -1;
        return { x: x + side * Math.min(1, (c - 1.3) / 0.5) * 14, y, clip: keeperDiveClip(facing, side, 0), ct: c - 1.3, facing };
      }
      if (c < 3) return { x, y, clip: "ready", ct: t, facing };
      const dx = Math.sin((c - 3) * Math.PI) * 10;
      return { x: x + dx, y, clip: "jog", ct: t, facing: dx >= 0 ? 0 : Math.PI };
    },
  };
}

export default function StarSpritesDevPage() {
  const [gate, setGate] = useState<"loading" | "ok" | "denied">("loading");
  const [ready, setReady] = useState(false);
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (offlineDevPlayEnabled()) { setGate("ok"); return; }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setGate("denied"); return; }
      try {
        const res = await fetch("/api/profile/admin-check");
        const d = res.ok ? await res.json() : { isAdmin: false };
        setGate(d.isAdmin ? "ok" : "denied");
      } catch { setGate("denied"); }
    });
  }, []);

  useEffect(() => {
    if (gate !== "ok") return;
    let live = true;
    loadSprites().then((ok) => { if (live) setReady(ok); });
    return () => { live = false; };
  }, [gate]);

  // The clock (a page timer, not a canvas loop).
  useEffect(() => {
    if (!ready || paused) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      setT((v) => v + Math.min(0.05, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, paused]);

  const men = useMemo<Man[]>(() => {
    const red = spriteKitOf(kitsOf("Manchester United").home);
    const sky = spriteKitOf(kitsOf("Manchester City").home);
    const gk1 = spriteKitOf(keeperKit(red.shirt, sky.shirt));
    const gk2 = spriteKitOf({ shirt: "#1F2937", trim: "#9CA3AF" });
    const out: Man[] = [
      keeper("gkTop", gk1, W / 2, 46, Math.PI / 2),
      keeper("gkBot", gk2, W / 2, H - 40, -Math.PI / 2),
    ];
    // Red: five lappers, a kicker, a celebrator, three standing.
    out.push(lapper("r1", red, 110, 170, 60, 40, 5, 0));
    out.push(lapper("r2", red, 280, 200, 70, 50, 3.2, 1));
    out.push(lapper("r3", red, 120, 330, 50, 70, 6, 2));
    out.push(lapper("r4", red, 290, 380, 40, 40, 2.6, 3));
    out.push(lapper("r5", red, 200, 260, 120, 20, 4.5, 4));
    out.push(kicker("r6", red, 195, 150, -Math.PI / 2));
    out.push(celebrator("r7", red, 60, 470));
    out.push(stander("r8", red, 330, 110, Math.PI / 2));
    out.push(stander("r9", red, 40, 250, 0));
    out.push(stander("r10", red, 350, 300, Math.PI));
    // Sky blue: five lappers, a kicker, four standing.
    out.push(lapper("b1", sky, 160, 420, 70, 30, 4, 0.5));
    out.push(lapper("b2", sky, 250, 300, 50, 60, 2.8, 1.5));
    out.push(lapper("b3", sky, 90, 230, 40, 50, 5.5, 2.5));
    out.push(lapper("b4", sky, 300, 470, 60, 30, 3.6, 3.5));
    out.push(lapper("b5", sky, 210, 200, 30, 80, 3, 4.5));
    out.push(kicker("b6", sky, 250, 120, Math.PI / 2 + 0.4));
    out.push(stander("b7", sky, 140, 520, -Math.PI / 2));
    out.push(stander("b8", sky, 360, 200, Math.PI * 0.75));
    out.push(stander("b9", sky, 30, 380, Math.PI / 4));
    out.push(stander("b10", sky, 230, 500, -Math.PI / 4));
    return out;
  }, []);

  if (gate === "loading") return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-sm">Loading…</div>;
  if (gate === "denied") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-center px-4">
        <div><div className="text-lg font-black mb-1">Admin only</div><div className="text-sm text-gray-400">This is a development sandbox.</div></div>
      </div>
    );
  }

  const drawn = men.map((m) => ({ m, s: m.at(t) })).sort((a, b) => a.s.y - b.s.y);
  const zoomRow: { char: SpriteChar; clip: SpriteClip; kit: SpriteKit; facing: number; label: string }[] = [
    { char: "player", clip: "idle", kit: men[2].kit, facing: Math.PI / 2, label: "idle" },
    { char: "player", clip: "jog", kit: men[2].kit, facing: 0, label: "jog" },
    { char: "player", clip: "sprint", kit: men[12].kit, facing: -Math.PI / 2, label: "sprint" },
    { char: "player", clip: "kick", kit: men[12].kit, facing: Math.PI / 2, label: "kick" },
    { char: "keeper", clip: (Math.floor(t / 1.2) % 2 ? "diveL" : "diveR"), kit: men[0].kit, facing: Math.PI / 2, label: "dive" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto" style={{ width: W }}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="text-sm font-black">3D match figures</div>
          <button onClick={() => setPaused((p) => !p)} className="min-h-[36px] rounded-md bg-white/10 px-3 text-sm font-bold">
            {paused ? "Play" : "Pause"}
          </button>
        </div>
        {!ready ? (
          <div className="p-6 text-center text-sm text-white/80">Loading the figures…</div>
        ) : (
          <>
            <div
              data-testid="sprite-pitch"
              className="relative overflow-hidden"
              style={{
                width: W, height: H,
                backgroundColor: "#3a9a3f",
                backgroundImage: "repeating-conic-gradient(#3fa344 0% 25%, #379139 0% 50%)",
                backgroundSize: "56px 56px",
              }}
            >
              <div className="absolute left-0 right-0 border-t-2 border-white/70" style={{ top: H / 2 }} />
              <div className="absolute rounded-full border-2 border-white/70" style={{ left: W / 2 - 46, top: H / 2 - 46, width: 92, height: 92 }} />
              {drawn.map(({ m, s }) => (
                <Figure key={m.id} char={m.char} clip={s.clip} t={s.ct} facing={s.facing} kit={m.kit} x={s.x} y={s.y} height={FIG} shadow />
              ))}
            </div>
            <div className="px-3 pt-3 text-xs font-bold text-white/80">4x zoom</div>
            <div className="flex flex-wrap items-end gap-2 px-3 py-2" style={{ background: "#3a9a3f" }}>
              {zoomRow.map((z) => (
                <div key={z.label} className="relative" style={{ width: 92, height: 140 }}>
                  <Figure char={z.char} clip={z.clip} t={t % 1.2} facing={z.facing} kit={z.kit} x={46} y={118} height={FIG * 4} pixelated />
                  <div className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-bold">{z.label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <PageGuide page="/star-sprites-dev" />
    </div>
  );
}

function Figure(p: {
  char: SpriteChar; clip: SpriteClip; t: number; facing: number; kit: SpriteKit;
  x: number; y: number; height: number; shadow?: boolean; pixelated?: boolean;
}) {
  const cell = spriteCell(p.char, p.clip, p.t, p.facing, p.height);
  const url = spriteAtlasUrl(p.kit);
  if (!cell || !url) return null;
  const s = cell.scale;
  return (
    <>
      {p.shadow && (
        <div
          className="absolute rounded-full"
          style={{
            left: p.x + p.height * 0.12 - p.height * 0.36, top: p.y + p.height * 0.02 - p.height * 0.13,
            width: p.height * 0.72, height: p.height * 0.26,
            background: "radial-gradient(closest-side, rgba(0,0,0,0.38), rgba(0,0,0,0.18) 60%, rgba(0,0,0,0))",
          }}
        />
      )}
      <div
        className="absolute"
        style={{
          left: p.x - cell.ax * s, top: p.y - cell.ay * s,
          width: cell.sw * s, height: cell.sh * s,
          backgroundImage: `url(${url})`,
          backgroundPosition: `${-cell.sx * s}px ${-cell.sy * s}px`,
          backgroundSize: `${cell.atlasW * s}px ${cell.atlasH * s}px`,
          imageRendering: p.pixelated ? "pixelated" : "auto",
        }}
      />
    </>
  );
}
