"use client";

/**
 * MATCH FEEL — the Feel card on /star-animations-dev: the switch, every dial,
 * and a still-frame preview of each effect at soft / medium / full power,
 * painted once with the match's own drawing (lib/star/matchFeelDraw.ts) and
 * stepped by CSS like the animation strips. No loop of its own.
 */
import { useEffect, useRef } from "react";
import {
  useMatchFeelLook, setMatchFeelLook, useFeelDials, setFeelDial, resetFeelDials,
  FEEL_DIAL_INFO, FEEL_DIAL_KEYS, DEFAULT_FEEL_DIALS, strikeFeel, squashAt, streakMetres, speedStretch,
  keeperSetHop, keeperDiveArc, feelHaptic, type FeelDials,
} from "@/lib/star/matchFeel";
import { drawImpactBurst, drawSpeedStreak, drawGloveSpark, drawDustPuff, drawNetBulge, drawClang } from "@/lib/star/matchFeelDraw";
import { primeMatchSound, playStrike, playThud, playClang, playGlove } from "@/lib/star/matchSound";

const W = 150, H = 96, FPS = 30, LOOP = 1.2;
/** Shown at two-thirds size so three fit across a phone. */
const K = 0.66;
const MUTED = "#8a97aa";

type Scene = "strike" | "glove" | "landing" | "net" | "post" | "keeper";

function paint(ctx: CanvasRenderingContext2D, scene: Scene, speed: number, t: number, D: FeelDials, ox: number) {
  ctx.fillStyle = "#2c8a4b";
  ctx.fillRect(ox, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 5; i++) ctx.fillRect(ox + i * 32, 0, 16, H);
  const f = strikeFeel(speed, "clean", D);
  const R = 5.5;
  const ball = (x: number, y: number, sx = 1, sy = 1, h = 0) => {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(x + 2, y + 3 + h, R * 1.1, R * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(1, -1, R * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const x0 = ox + 26, y0 = H - 26;
  if (scene === "strike") {
    // Wind-up, freeze at the contact, then away.
    const hold = f.windUpS + f.hitStopS;
    const tf = Math.max(0, t - hold);
    const v = speed * 3.2; // px/s on this little picture
    const bx = x0 + Math.min(W - 40, tf * v), by = y0 - Math.min(30, tf * v * 0.25);
    const along = speedStretch(speed, D);
    const q = t >= f.windUpS ? squashAt(t - f.windUpS, f.squash) : 0;
    // The striker's boot: drawn back through the wind-up.
    const w = t < f.windUpS && f.windUpS > 0 ? t / f.windUpS : 1;
    ctx.strokeStyle = "#e2b04a"; ctx.lineWidth = 4; ctx.lineCap = "round";
    const bootX = x0 - 9 - (t < f.windUpS ? 10 * Math.sin(Math.PI / 2 * w) : Math.max(-14, -6 + tf * 40));
    ctx.beginPath(); ctx.moveTo(x0 - 14, y0 - 24); ctx.lineTo(bootX, y0 + 2); ctx.stroke();
    if (tf > 0 && streakMetres(speed, D) > 0) {
      const len = Math.min(tf * v, 8 + streakMetres(speed, D) * 9);
      drawSpeedStreak(ctx, [{ x: bx - len, y: by + len * 0.25 }, { x: bx - len / 2, y: by + len * 0.12 }, { x: bx, y: by }], R, Math.min(1, (speed - 9) / 14));
    }
    ball(bx, by, (tf > 0 ? along : 1) * (1 - 0.38 * q), (tf > 0 ? 1 / Math.sqrt(along) : 1) * (1 + 0.28 * q));
    if (t >= f.windUpS) drawImpactBurst(ctx, x0, y0, 5.5 * 3.2 * f.flash, (t - f.windUpS) / (0.28 + 0.14 * f.power), 1, -0.25, f.power, true, f.scuff);
  } else if (scene === "glove") {
    const tHit = 0.35;
    const bx = t < tHit ? x0 + t * 250 : x0 + tHit * 250 - (t - tHit) * 120;
    const by = y0 - 20 - (t < tHit ? 0 : (t - tHit) * 60);
    ctx.fillStyle = "#facc15"; ctx.fillRect(x0 + tHit * 250 + 4, y0 - 34, 8, 26);
    const q = t >= tHit ? squashAt(t - tHit, Math.min(1, speed / 22)) : 0;
    ball(bx, by, 1 - 0.38 * q, 1 + 0.28 * q);
    if (t >= tHit) drawGloveSpark(ctx, x0 + tHit * 250, y0 - 20, 5.5 * 3.2 * 0.8 * D.gloveImpact, (t - tHit) / 0.36, 7);
  } else if (scene === "landing") {
    const tl = 0.5;
    const h = t < tl ? 40 * (1 - (t / tl) ** 2) : Math.max(0, 10 * Math.sin(Math.PI * Math.min(1, (t - tl) / 0.35)));
    const bx = x0 + t * 70;
    const q = t >= tl ? squashAt(t - tl, 0.35 * D.squash) : 0;
    ball(bx, y0 - h, 1 + 0.28 * q, 1 - 0.38 * q, h);
    if (t >= tl) drawDustPuff(ctx, x0 + tl * 70, y0 + 3, 5.5 * 3.2 * 0.8 * (0.55 + 0.6) * D.landing, (t - tl) / 0.45, 6, 3);
  } else if (scene === "net") {
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 0.8;
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(ox + 20 + i * 10, 14); ctx.lineTo(ox + 20 + i * 10, 70); ctx.stroke(); }
    for (let j = 0; j < 6; j++) { ctx.beginPath(); ctx.moveTo(ox + 20, 14 + j * 11); ctx.lineTo(ox + 130, 14 + j * 11); ctx.stroke(); }
    const tg = 0.2;
    const env = t < tg ? 0 : t - tg < 0.1 ? Math.sin((Math.PI / 2) * ((t - tg) / 0.1)) : 0.55 + 0.45 * Math.cos((t - tg - 0.1) * 16) * Math.exp(-(t - tg - 0.1) * 5);
    drawNetBulge(ctx, ox + 75, 42, ox + 75, 30, 5.5 * 4.2, env * D.netBulge * Math.min(1, speed / 25));
    ball(ox + 75, t < tg ? 80 - t * 190 : 42 - env * 4, 1, 1);
  } else if (scene === "post") {
    ctx.fillStyle = "#f6faf7"; ctx.fillRect(ox + 70, 10, 5, 70);
    const tp = 0.3;
    const bx = t < tp ? ox + 20 + t * 170 : ox + 71 - (t - tp) * 110;
    const q = t >= tp ? squashAt(t - tp, Math.min(1, speed / 22)) : 0;
    ball(bx, 50, 1 - 0.38 * q, 1 + 0.28 * q);
    if (t >= tp) drawClang(ctx, ox + 70, 50, 5.5 * 3.2 * 1.1 * D.gloveImpact, (t - tp) / 0.55);
  } else {
    // The keeper: set hop at the strike, then a dive with a flight.
    const hop = keeperSetHop(t, D) * 22;
    const lunge = Math.max(0, Math.min(1, (t - 0.3) / 0.5));
    const arc = keeperDiveArc(lunge, false, D) * 22;
    const kx = ox + 75 + lunge * 40, ky = y0 - hop - arc;
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(ox + 75 + lunge * 40, y0 + 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(kx, ky); ctx.rotate(lunge * 1.2);
    ctx.fillStyle = "#facc15"; ctx.fillRect(-5, -26, 10, 18);
    ctx.fillStyle = "#222"; ctx.fillRect(-5, -8, 10, 8);
    ctx.fillStyle = "#c68642"; ctx.beginPath(); ctx.arc(0, -31, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function FeelStrip({ scene, speed, D, paused }: { scene: Scene; speed: number; D: FeelDials; paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const n = Math.round(LOOP * FPS);
  const key = JSON.stringify(D);
  useEffect(() => {
    const id = setTimeout(() => {
      const c = ref.current;
      if (!c) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      c.width = Math.round(W * n * dpr); c.height = Math.round(H * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let i = 0; i < n; i++) {
        ctx.save(); ctx.beginPath(); ctx.rect(i * W, 0, W, H); ctx.clip();
        paint(ctx, scene, speed, (i / n) * LOOP, D, i * W);
        ctx.restore();
      }
    }, 40);
    return () => clearTimeout(id);
  }, [scene, speed, key, n, D]);
  return (
    <div style={{ width: W * K, height: H * K, overflow: "hidden", borderRadius: 8 }}>
      <canvas ref={ref} style={{
        width: W * n * K, height: H * K, display: "block",
        ...(paused ? { transform: `translateX(${-Math.round(n * 0.3) * W * K}px)` } : { animation: `kibAnimStrip ${LOOP * 1.6}s steps(${n}) infinite` }),
      }} />
    </div>
  );
}

const SCENES: { id: Scene; label: string }[] = [
  { id: "strike", label: "Your strike" },
  { id: "glove", label: "Glove save" },
  { id: "landing", label: "Landing" },
  { id: "net", label: "Net bulge" },
  { id: "post", label: "Off the post" },
  { id: "keeper", label: "Keeper hop + dive" },
];

export default function FeelPreview({ pill, card }: { pill: (on: boolean) => React.CSSProperties; card: React.CSSProperties }) {
  const look = useMatchFeelLook();
  const D = useFeelDials();
  const test = (fn: () => void) => { primeMatchSound(); fn(); };
  return (
    <div id="feel" style={{ ...card, display: "grid", gap: 10 }} data-feel-card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>Match feel</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={pill(look === "new")} onClick={() => setMatchFeelLook("new")} data-feel="new">New</button>
          <button style={pill(look === "old")} onClick={() => setMatchFeelLook("old")} data-feel="old">Old</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
        The same switch as Match feel on the Oct 13 update page (/star-update-dev). Looks and sound only. Each picture: soft · medium · full power, 0.6× speed.
      </div>
      {SCENES.map((sc) => (
        <div key={sc.id} style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>{sc.label}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[9, 18, 28].map((sp) => <FeelStrip key={sp} scene={sc.id} speed={sp} D={D} paused={false} />)}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={pill(false)} onClick={() => test(() => { const f = strikeFeel(9, "clean", D); playStrike(f.power, f.gain, f.bass, false); })}>▶ Soft kick</button>
        <button style={pill(false)} onClick={() => test(() => { const f = strikeFeel(28, "clean", D); playStrike(f.power, f.gain, f.bass, false); feelHaptic(f.hapticMs); })}>▶ Full kick + buzz</button>
        <button style={pill(false)} onClick={() => test(() => { const f = strikeFeel(18, "scuffed", D); playStrike(f.power, f.gain, f.bass, true); })}>▶ Scuff</button>
        <button style={pill(false)} onClick={() => test(() => playThud(0.8, D.soundGain))}>▶ Thud</button>
        <button style={pill(false)} onClick={() => test(() => playGlove(0.9, D.soundGain, true))}>▶ Glove</button>
        <button style={pill(false)} onClick={() => test(() => playClang(0.9, D.soundGain))}>▶ Clang</button>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {FEEL_DIAL_KEYS.map((k) => {
          const info = FEEL_DIAL_INFO[k];
          return (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>{info.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {D[k]}{info.unit ?? ""}<span style={{ color: MUTED, fontWeight: 600 }}> · default {DEFAULT_FEEL_DIALS[k]}</span>
              </span>
              <input aria-label={info.label} type="range" min={info.min} max={info.max} step={info.step} value={D[k]}
                onChange={(e) => setFeelDial(k, Number(e.target.value))} style={{ gridColumn: "1 / -1", width: "100%" }} />
            </div>
          );
        })}
      </div>
      <div><button style={pill(false)} onClick={() => resetFeelDials()}>Reset feel to defaults</button></div>
    </div>
  );
}
