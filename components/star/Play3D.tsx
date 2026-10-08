"use client";

/**
 * A FULLY 3D DRILL — any drill in lib/star/play3d/drills.ts with
 * kind "play3d" (Two Touch, Free Roam, and the next ones).
 *
 * 3D games are the one-engine rule's exception (Harry, 8 Oct 2026): they run
 * the shared 3D engine in lib/star/play3d, never the 2D match. This screen
 * only: builds the drill's World from the career, draws it
 * (lib/star/play3d/scene.ts), feeds it your thumbs, and shows the score.
 *
 * Controls (phone first; mouse works the same; WASD/arrows + space on a keyboard):
 *   left thumb anywhere on the left 40% → a stick: move (push far to sprint)
 *   tap on the right → pass / touch / keepy-up touch
 *   drag back on the right and let go → shoot (the 2D game's drag: same power for the same thumb movement)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { kitsOf } from "@/lib/star/kits";
import { realMatchHeight } from "@/lib/star/engineProfile";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { faceFromUrl } from "@/lib/star/three3d/faceFromUrl";
import { makeRng } from "@/lib/star/play3d/rng";
import { skillsOf, type Skills3 } from "@/lib/star/play3d/player";
import type { DrillDef, DrillSession } from "@/lib/star/play3d/drills";
import type { Person3 } from "@/lib/star/play3d/freeRoam";
import type { Play3DController, Play3DPerson } from "@/lib/star/play3d/scene";
import { GameShell, ResultPanel, type GameResult } from "./relgames/Shell";

const SKINS = ["#8d5524", "#c68642", "#e0ac69", "#5c3a1e", "#f1c27d"];
const HAIRS = ["#1b120c", "#2b1b10", "#4a2e1c", "#0f0b08"];

export interface Play3DResult extends GameResult { drill: string }

/** A squad player as a 3D man: his real numbers (missing ones from his overall), his photo, his position. */
function personOf(p: NonNullable<CareerState["squad"]>[number], i: number): Person3 {
  const ov = p.overall ?? 65;
  const sk: Skills3 = { overall: ov, pace: p.pace ?? ov, power: p.shooting ?? ov, technique: p.dribbling ?? ov, passing: p.passing, shooting: p.shooting, dribbling: p.dribbling, defending: p.defending };
  return { id: p.id ?? `mate${i}`, name: p.name.split(" ").slice(-1)[0], skills: sk, photo: p.imageUrl ?? fakeFaceFor(p.id ?? `mate${i}`), position: p.position };
}

/** Bib colours for a free-for-all (Wembley): every other side its own. */
const BIBS = [
  { shirt: "#f59e0b", trim: "#1f2937" }, { shirt: "#7c3aed", trim: "#ffffff" }, { shirt: "#0891b2", trim: "#ffffff" },
  { shirt: "#db2777", trim: "#ffffff" }, { shirt: "#84cc16", trim: "#1f2937" }, { shirt: "#dc2626", trim: "#ffffff" },
  { shirt: "#1d4ed8", trim: "#ffffff" }, { shirt: "#f8fafc", trim: "#1f2937" },
];
const rgb = (h: string) => { const n = parseInt(h.replace("#", "").padEnd(6, "0").slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Five bibs, none close to your own kit's shirt (so you never look like the man you're playing against). */
function bibsFor(shirt: string): Record<number, { shirt: string; trim: string }> {
  const [r, g, b] = /^#[0-9a-f]{6}$/i.test(shirt) ? rgb(shirt) : [0, 0, 0];
  const far = BIBS.filter((x) => { const [r2, g2, b2] = rgb(x.shirt); return Math.hypot(r - r2, g - g2, b - b2) > 130; });
  return Object.fromEntries(far.slice(0, 5).map((x, i) => [i + 1, x]));
}

/** Your numbers, up to five real team-mates (random from the squad, outfielders), and the whole outfield squad. */
function castFrom(career: CareerState, seed: number): { you: Person3; mates: Person3[]; squad: Person3[] } {
  const s = career.skills;
  const you: Person3 = {
    id: "you", name: career.player.lastName || "You",
    skills: { overall: Math.round((s.pace + s.power + s.technique) / 3), pace: s.pace, power: s.power, technique: s.technique, passing: s.vision, shooting: Math.round((s.power + s.technique) / 2), dribbling: s.technique },
    photo: career.player.portrait,
  };
  const rng = makeRng(seed);
  const pool = (career.squad ?? []).filter((p) => p.position !== "GK");
  const mates: Person3[] = [];
  const squad = pool.map(personOf);
  // the first two picks are the same as before (Two Touch and Free Roam's team-mates); then up to three more (Wembley)
  for (let i = 0; i < 5; i++) {
    if (!pool.length) { mates.push({ id: `mate${i}`, name: `Team-mate ${i + 1}`, skills: skillsOf(65) }); continue; }
    const p = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    mates.push(personOf(p, i));
  }
  return { you, mates, squad };
}

export default function Play3D({ career, drill, seed, onExit, onFinish, mode, options }: {
  career: CareerState;
  drill: DrillDef;
  seed: number;
  /** The picker row's mode and the pre-screen's choices (Wembley). */
  mode?: string;
  options?: Record<string, string>;
  onExit: () => void;
  onFinish: (r: Play3DResult) => void;
}) {
  const team = career.relationships.team;
  const cast = useMemo(() => castFrom(career, seed), [career, seed]);
  const session = useMemo<DrillSession>(() => drill.start!({ seed, you: cast.you, mates: cast.mates, squad: cast.squad, mode, options }), [drill, seed, cast, mode, options]);
  const [hud, setHud] = useState(() => session.hud());
  const [three, setThree] = useState<"loading" | "ready" | "off">("loading");
  const [result, setResult] = useState<Play3DResult | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const ctrl = useRef<Play3DController | null>(null);

  // ── the 3D picture (and the World's clock) ──
  useEffect(() => {
    let dead = false;
    const el = holder.current;
    if (!el) return;
    (async () => {
      try {
        const people: Record<string, Play3DPerson> = {};
        const rng = makeRng(seed + 99);
        people[cast.you.id] = { skin: skinToneHex(career.player.skinTone), hair: hairColourHex(career.player.hairColour), hairStyle: resolveHairStyle(career.player.hairStyle) };
        // everyone the drill put on its pitch (team-mates, full-backs, a defender …), faces from their photos
        await Promise.all(session.world.players.filter((p) => !p.human && !p.keeper && !people[p.id]).map(async (p) => {
          const fitted = await faceFromUrl(p.photo);
          people[p.id] = { skin: fitted?.skin ?? SKINS[Math.floor(rng() * SKINS.length)], hair: HAIRS[Math.floor(rng() * HAIRS.length)], hairStyle: "short", face: fitted?.face ?? null };
        }));
        for (const k of session.world.players.filter((p) => p.keeper)) people[k.id] = { skin: SKINS[Math.floor(rng() * SKINS.length)], hair: HAIRS[0], hairStyle: "buzz" };
        if (dead) return;
        const { createPlay3DScene } = await import("@/lib/star/play3d/scene");
        const kit = kitsOf(career.player.club).home;
        let acc = 0;
        const c = await createPlay3DScene(el, session.world, { kit: { shirt: kit.shirt, trim: kit.trim }, people, teamKits: session.bibs ? bibsFor(kit.shirt) : undefined }, {
          camera: session.camera,
          onFrame: (dt) => {
            acc += dt;
            if (acc > 0.1) { acc = 0; setHud(session.hud()); }
            if (session.done()) setResult((r) => r ?? { ...session.result(team, Math.random()), drill: drill.id });
          },
        });
        if (dead) { c.dispose(); return; }
        ctrl.current = c;
        setThree("ready");
      } catch (e) {
        console.error("3D drill failed to load", e);
        if (!dead) setThree("off");
      }
    })();
    return () => { dead = true; ctrl.current?.dispose(); ctrl.current = null; };
    // built once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (result) ctrl.current?.setActive(false); }, [result]);

  // ── thumbs ──
  const w = session.world;
  const stick = useRef<{ id: number; x0: number; y0: number } | null>(null);
  const aim = useRef<{ id: number; x0: number; y0: number; t0: number } | null>(null);
  const [knob, setKnob] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const toWorld = (sx: number, sy: number) => {
    const h = ctrl.current?.heading() ?? -Math.PI / 2;
    const f = { x: Math.cos(h), y: Math.sin(h) }, r = { x: -Math.sin(h), y: Math.cos(h) };
    return { x: r.x * sx + f.x * -sy, y: r.y * sx + f.y * -sy };
  };
  const STICK_R = 56;
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (x < box.width * 0.4 && !stick.current) { stick.current = { id: e.pointerId, x0: x, y0: y }; setKnob({ x0: x, y0: y, x, y }); }
    else if (!aim.current) { aim.current = { id: e.pointerId, x0: x, y0: y, t0: performance.now() }; setDrag({ x0: x, y0: y, x, y }); }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    if (stick.current?.id === e.pointerId) {
      const dx = x - stick.current.x0, dy = y - stick.current.y0, d = Math.hypot(dx, dy);
      const k = Math.min(1, d / STICK_R);
      const m = d > 1 ? toWorld(dx / d * k, dy / d * k) : { x: 0, y: 0 };
      w.input = { move: m, sprint: d > STICK_R * 0.92 };
      setKnob({ x0: stick.current.x0, y0: stick.current.y0, x, y });
    } else if (aim.current?.id === e.pointerId) setDrag({ x0: aim.current.x0, y0: aim.current.y0, x, y });
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    if (stick.current?.id === e.pointerId) { stick.current = null; w.input = { move: { x: 0, y: 0 }, sprint: false }; setKnob(null); return; }
    if (aim.current?.id === e.pointerId) {
      const a = aim.current;
      aim.current = null; setDrag(null);
      const dx = x - a.x0, dy = y - a.y0;
      if (Math.hypot(dx, dy) < 14) { w.act({ kind: "tap" }); return; }
      // slingshot: the ball goes the other way to the drag; the pull is the 2D game's (a fraction of the real match's canvas height)
      const pull = Math.hypot(dx, dy) / realMatchHeight(window.innerWidth);
      w.act({ kind: "shoot", dir: toWorld(-dx, -dy), pull });
    }
  };
  // keyboard
  useEffect(() => {
    const keys = new Set<string>();
    const sync = () => {
      const sx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const sy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      if (stick.current) return;
      const d = Math.hypot(sx, sy);
      w.input = { move: d ? toWorld(sx / d, sy / d) : { x: 0, y: 0 }, sprint: keys.has("shift") };
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === " ") { e.preventDefault(); w.act({ kind: "tap" }); return; }
      keys.add(k); sync();
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); sync(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);

  const [vw, setVw] = useState(0);
  useEffect(() => { setVw(window.innerWidth); }, []);
  const [vh, setVh] = useState(0);
  useEffect(() => { setVh(window.innerHeight); }, []);
  const h = vw ? Math.max(360, Math.min(realMatchHeight(vw), 640, vh - 310)) : 560;
  const mins = hud.timeLeft !== undefined ? `${Math.floor(hud.timeLeft / 60)}:${String(Math.floor(hud.timeLeft % 60)).padStart(2, "0")}` : null;

  return (
    <GameShell title={drill.name} who="Team" current={team} tone="#38bdf8" onBack={!result ? onExit : undefined}>
      <div className="mb-2 flex items-end justify-between gap-2" data-play3d-hud={drill.id}>
        <div>
          <div className="text-[34px] font-black leading-none" data-play3d-score>{hud.big}</div>
          <div className="text-[12px] font-bold uppercase tracking-wide text-sky-200">{hud.small}</div>
        </div>
        {mins && <div className="text-[22px] font-black tabular-nums" data-play3d-time>{mins}</div>}
      </div>
      <div className="relative select-none overflow-hidden" style={{ height: h, borderRadius: 4, touchAction: "none" }} data-play3d={three}>
        <div ref={holder} className="absolute inset-0" />
        <div
          className="absolute inset-0 z-20"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          data-play3d-pad
        />
        {knob && (
          <div className="pointer-events-none absolute z-30 rounded-full ring-2 ring-white/50" style={{ left: knob.x0 - STICK_R, top: knob.y0 - STICK_R, width: STICK_R * 2, height: STICK_R * 2, background: "rgba(0,0,0,0.18)" }}>
            <div className="absolute h-[36px] w-[36px] rounded-full bg-white/80" style={{ left: STICK_R - 18 + Math.max(-STICK_R, Math.min(STICK_R, knob.x - knob.x0)), top: STICK_R - 18 + Math.max(-STICK_R, Math.min(STICK_R, knob.y - knob.y0)) }} />
          </div>
        )}
        {drag && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 14 && (
          <svg className="pointer-events-none absolute inset-0 z-30" width="100%" height="100%">
            <line x1={drag.x0} y1={drag.y0} x2={drag.x0 - (drag.x - drag.x0)} y2={drag.y0 - (drag.y - drag.y0)} stroke="#fb923c" strokeWidth={6} strokeLinecap="round" />
            <circle cx={drag.x} cy={drag.y} r={9} fill="rgba(255,255,255,0.7)" />
          </svg>
        )}
        {hud.flash && !hud.banner && <div className="pointer-events-none absolute inset-x-0 top-[8%] z-30 px-2 text-center text-[20px] font-black uppercase" style={{ textShadow: "0 2px 8px #000" }}>{hud.flash}</div>}
        {hud.banner && (
          <div className="pointer-events-none absolute inset-x-0 top-[24%] z-30 px-2 text-center text-[44px] font-black uppercase leading-none" data-play3d-banner style={{ color: hud.banner.tone === "good" ? "#4ade80" : hud.banner.tone === "bad" ? "#f87171" : "#fde047", textShadow: "0 3px 12px #000" }}>
            {hud.banner.text}
          </div>
        )}
        {hud.note && <div className="pointer-events-none absolute inset-x-0 top-2 z-30 px-2 text-center text-[13px] font-black uppercase text-amber-200" style={{ textShadow: "0 1px 4px #000" }} data-play3d-note>{hud.note}</div>}
        {!!hud.roster?.length && (
          <div className="pointer-events-none absolute left-2 top-9 z-30 flex flex-col gap-0.5" data-play3d-roster>
            {hud.roster.map((r) => (
              <div key={r.name} className={`rounded px-1.5 py-0.5 text-[11px] font-black ${r.you ? "ring-1 ring-sky-300" : ""}`} style={{ background: "rgba(0,0,0,0.55)", color: r.state === "out" ? "#f87171" : r.state === "safe" ? "#4ade80" : "#fff" }}>
                {r.state === "safe" ? "✓" : r.state === "out" ? "✗" : "•"} {r.name}
              </div>
            ))}
          </div>
        )}
        {three === "loading" && <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center text-[13px] font-bold text-white/80">Loading the training pitch…</div>}
        {three === "off" && <div className="absolute inset-0 z-30 grid place-items-center px-6 text-center text-[14px] font-bold text-amber-200">This phone can&apos;t show the 3D pitch, and this drill is 3D only. Pick the Crossbar Challenge instead.</div>}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-black/45 px-3 py-1.5 text-center text-[12px] font-bold leading-snug text-white" style={{ textShadow: "0 1px 4px #000" }} data-play3d-hint>{session.hint}</div>
      </div>
      {!!session.buttons?.length && !result && (
        <div className="mt-2 flex gap-2">
          {session.buttons.map((b) => (
            <button key={b.label} onClick={() => (b.onPress ? b.onPress() : b.action && w.act(b.action))} className="kib-press flex-1 rounded bg-white/10 py-3 text-[13px] font-black uppercase ring-1 ring-white/25">{b.label}</button>
          ))}
        </div>
      )}
      {result && <ResultPanel result={result} who="Team" current={team} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}
