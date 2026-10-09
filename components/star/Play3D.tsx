"use client";

/**
 * A FULLY 3D DRILL — any drill in lib/star/play3d/drills.ts with
 * kind "play3d" (Two Touch, Free Roam, and the next ones).
 *
 * 3D games are the one-engine rule's exception (Harry, 8 Oct 2026): they run
 * the shared 3D engine in lib/star/play3d, never the 2D match. This screen
 * only: builds the drill's World from the career, draws it
 * (lib/star/play3d/scene.ts), feeds it your thumbs or keys, and shows the score.
 *
 * Controls — one scheme per device (lib/star/play3d/controlScheme.ts; Harry,
 * 9 Oct 2026). The camera is never turned by the stick or the mouse; the
 * stick is read against the way the camera looks right now.
 *   Phone: a stick appears under the left thumb (left half; push further,
 *     run faster). The right half is the action: a swipe kicks (direction
 *     aims, length is power), a tap is the touch / pass. Two fingers on the
 *     right peek round, then spring back.
 *   PC: WASD or arrows move, Shift sprints. The mouse is only the action:
 *     hold and let go kicks towards the pointer (hold longer or drag further
 *     = harder), a click touches / passes. Q/E look round. Space taps.
 *   Two Touch on a phone (session.stick "corner"; Harry, 9 Oct 2026: "the
 *     joy stick gets in the way"): no stick under the thumb. The whole screen
 *     is the touch/swipe; a small nudge stick sits in the bottom-left corner
 *     only, and a tap near the ball is always a touch, never the stick.
 *   Call for it (session.call, Free Roam): a CALL button on the right edge
 *     on a phone, F on a PC (World.callForBall); the answer shows as a tick
 *     or a cross over you and the team-mate.
 */
import { look3dStyle } from "@/lib/star/look3dStyle";
import { motionLook } from "@/lib/star/motionLook";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { kitsOf } from "@/lib/star/kits";
import { realMatchHeight } from "@/lib/star/engineProfile";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { faceFromUrl } from "@/lib/star/three3d/faceFromUrl";
import { stickToPitch, PEEK_MAX } from "@/lib/star/three3d/practiceCam";
import { makeRng } from "@/lib/star/play3d/rng";
import { skillsOf, type Skills3 } from "@/lib/star/play3d/player";
import { controlScheme, useControlChoice, type ControlScheme } from "@/lib/star/play3d/controlScheme";
import type { DrillDef, DrillSession, DrillTrain } from "@/lib/star/play3d/drills";
import { applyLevelResult, highestUnlocked, starsOf } from "@/lib/star/trainingLevels";
import type { Person3 } from "@/lib/star/play3d/freeRoam";
import type { Play3DController, Play3DPerson } from "@/lib/star/play3d/scene";
import { GameShell, ResultPanel, type GameResult } from "./relgames/Shell";
import BackPill3D from "./BackPill3D";

const SKINS = ["#8d5524", "#c68642", "#e0ac69", "#5c3a1e", "#f1c27d"];
const HAIRS = ["#1b120c", "#2b1b10", "#4a2e1c", "#0f0b08"];

/** A swipe is longer than the 2D game's drag-back: this share of it counts (full power ≈ twice the 2D drag). */
export const SWIPE_SCALE = 0.5;
/** PC: holding the button this long (s) is full power (the 2D game's full pull, 0.14). */
export const HOLD_FULL_S = 1.0;
const FULL_PULL = 0.14;
/** A press shorter than this (ms) and moving less than TAP_PX is a tap / click. */
const TAP_MS = 220;
const TAP_PX = 12;
/** Two Touch's corner nudge stick: its size against the floating stick, where it sits (px from the left and the bottom of the picture). */
export const CORNER_STICK = { scale: 0.6, left: 54, bottom: 92, opacity: 0.4 };
/** A tap this close (px) to the ball is always the touch, never the corner stick. */
export const BALL_GUARD_PX = 70;
/** How long a call's tick or cross stays up (world seconds). */
const CALL_SHOW = 1.8;

export interface Play3DResult extends GameResult { drill: string; /** A training drill (Pace Sprint): the level and stars for the career to bank. */ train?: DrillTrain }

/** A squad player as a 3D man: his real numbers (missing ones from his overall), his photo, his position. */
function personOf(p: NonNullable<CareerState["squad"]>[number], i: number): Person3 {
  const ov = p.overall ?? 65;
  const sk: Skills3 = { overall: ov, pace: p.pace ?? ov, power: p.shooting ?? ov, technique: p.dribbling ?? ov, passing: p.passing, shooting: p.shooting, dribbling: p.dribbling, defending: p.defending, physical: p.physical };
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
    skills: { overall: Math.round((s.pace + s.power + s.technique) / 3), pace: s.pace, power: s.power, technique: s.technique, passing: s.vision, shooting: Math.round((s.power + s.technique) / 2), dribbling: s.technique,
      // the career has no physical/stamina stat for you: your strength (power) stands in for fitness (the sprint bar)
      physical: s.power },
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
  const session = useMemo<DrillSession>(() => drill.start!({
    seed, you: cast.you, mates: cast.mates, squad: cast.squad, mode, options,
    paceLevel: highestUnlocked(starsOf(career, "pace")),
    previewTrain: (t) => applyLevelResult(career, t.skill, t.level, t.stars).gained,
  }), [drill, seed, cast, mode, options]);
  const [hud, setHud] = useState(() => session.hud());
  // which controls: this device's own, or the Settings override (read after mount: matchMedia is browser-only)
  const choice = useControlChoice();
  const [scheme, setScheme] = useState<ControlScheme>("touch");
  useEffect(() => { setScheme(controlScheme()); }, [choice]);
  const schemeRef = useRef(scheme);
  schemeRef.current = scheme;
  // team-mates for the pass: a name over the one a tap passes to, and an edge marker for any out of the picture
  const [marks, setMarks] = useState<{ id: string; name: string; x: number; y: number; off: boolean; aim: boolean }[]>([]);
  const mateMarks = () => {
    const c = ctrl.current, w0 = session.world, you = w0.you();
    if (!c || !you || !you.active) return [];
    return w0.players.filter((p) => p.active && !p.human && !p.keeper && p.team === you.team).flatMap((p) => {
      const s = c.screen(p.id);
      return s ? [{ id: p.id, name: p.name, x: s.x, y: s.y, off: s.off, aim: w0.aimMate === p.id }] : [];
    }).filter((m) => m.off || m.aim);
  };
  const [three, setThree] = useState<"loading" | "ready" | "off">("loading");
  /** Call for it: the cooldown left, and the last answer with where you and he are on screen. */
  const [callUi, setCallUi] = useState<{ cd: number; ans?: { ok: boolean; why: string; you?: { x: number; y: number }; mate?: { x: number; y: number; off: boolean } } }>({ cd: 0 });
  const callView = () => {
    const c = ctrl.current, w0 = session.world, a = w0.call;
    const cd = w0.callReady();
    if (!c || !a || w0.t - a.at > CALL_SHOW) return { cd };
    const you = c.screen(w0.you()?.id ?? "");
    const mate = a.mate ? c.screen(a.mate) : null;
    return { cd, ans: { ok: a.ok, why: a.why, you: you && !you.off ? you : undefined, mate: mate ?? undefined } };
  };
  /** Your sprint bar (Free Roam, new feel): null while it isn't in use. */
  const [stam, setStam] = useState<{ v: number; tired: boolean } | null>(null);
  // Settings → Look → Motion: Mocap = the new walk/jog/run/sprint feel; Old = as before
  useEffect(() => { session.world.newFeel = motionLook() === "mocap"; }, [session.world]);
  const [result, setResult] = useState<Play3DResult | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const ctrl = useRef<Play3DController | null>(null);
  const hRef = useRef<{ dispose(): void } | null>(null);

  // ── input state: the stick (screen units, length 0–1) and the keys; turned into pitch directions every frame ──
  const w = session.world;
  const stickVec = useRef({ x: 0, y: 0, sprint: false });
  const keys = useRef(new Set<string>());
  /** The stick and keys against the camera as it looks NOW (the camera turns on its own; the stick never turns it). */
  const applyInput = () => {
    const k = keys.current;
    const s = stickVec.current;
    let sx = s.x, sy = s.y, sprint = s.sprint;
    if (Math.hypot(sx, sy) < 0.01) {
      const kx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
      const ky = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
      const d = Math.hypot(kx, ky);
      // new feel (Motion: Mocap): keys alone run, Shift sprints (a full stick push would sprint)
      const kk = w.newFeel && !k.has("shift") ? 0.85 : 1;
      sx = d ? kx / d * kk : 0; sy = d ? ky / d * kk : 0; sprint = k.has("shift");
    }
    // the chase camera (Wembley) turns with you, so there the direction is fixed when the stick or keys change (as before)
    const sig = `${sx.toFixed(3)},${sy.toFixed(3)}`;
    if (session.camera === "chase" && sig === lastSig.current) { w.input = { ...w.input, sprint }; return; }
    lastSig.current = sig;
    const h = ctrl.current?.heading() ?? -Math.PI / 2;
    w.input = { move: Math.hypot(sx, sy) > 0.01 ? stickToPitch(h, sx, sy) : { x: 0, y: 0 }, sprint };
  };
  const lastSig = useRef("");
  const applyRef = useRef(applyInput);
  applyRef.current = applyInput;

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
        // Settings → Look → "3D look": H puts the drill in a full stadium (lib/star/style3d/real); Old as before
        const hLook = look3dStyle() === "h"
          ? await import("@/lib/star/style3d/real/play3dH").then((m) => m.play3dH(session.world, { colours: { home: kit.shirt, home2: kit.trim, away: "#1d4ed8" } })).catch((e) => { console.error("look H failed", e); return null; })
          : null;
        if (dead) { hLook?.dispose(); return; }
        hRef.current = hLook;
        const c = await createPlay3DScene(el, session.world, { kit: { shirt: kit.shirt, trim: kit.trim }, people, teamKits: session.bibs ? bibsFor(kit.shirt) : undefined }, {
          camera: session.camera,
          practice: session.frame,
          ...(hLook ? hLook.opts : {}),
          onFrame: (dt) => {
            hLook?.frame(dt);
            applyRef.current();
            acc += dt;
            if (acc > 0.1) {
              acc = 0; setHud(session.hud()); setMarks(mateMarks());
              if (session.call) setCallUi(callView());
              const sw = session.world;
              setStam(sw.newFeel && sw.rules.stamina && (sw.stamina.v < 0.995 || sw.stamina.tired) ? { v: sw.stamina.v, tired: sw.stamina.tired } : null);
            }
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
    return () => { dead = true; hRef.current?.dispose(); hRef.current = null; ctrl.current?.dispose(); ctrl.current = null; };
    // built once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (result) ctrl.current?.setActive(false); }, [result]);

  // ── thumbs and the mouse ──
  const stick = useRef<{ id: number; x0: number; y0: number; t0: number; r: number; corner?: boolean } | null>(null);
  const aim = useRef<{ id: number; x0: number; y0: number; t0: number } | null>(null);
  const peekT = useRef<{ ids: number[]; x0: number } | null>(null);
  const [knob, setKnob] = useState<{ x0: number; y0: number; x: number; y: number; r: number } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number; t0: number } | null>(null);
  const [now, setNow] = useState(0);
  const toWorld = (sx: number, sy: number) => stickToPitch(ctrl.current?.heading() ?? -Math.PI / 2, sx, sy);
  const STICK_R = 56;
  /** Two Touch on a phone: the stick only lives in the corner (CORNER_STICK). */
  const cornerStick = scheme === "touch" && session.stick === "corner";
  const cornerR = STICK_R * CORNER_STICK.scale;
  const cornerAt = (boxH: number) => ({ x: CORNER_STICK.left, y: boxH - CORNER_STICK.bottom });
  /** A tap near the ball (px in the picture): always the touch. */
  const nearBall = (x: number, y: number) => { const b = ctrl.current?.ballScreen(); return !!b && Math.hypot(b.x - x, b.y - y) < BALL_GUARD_PX; };
  /** A team-mate drawn under a tap (px in the picture), else null: a tap on him passes to him. */
  const mateAt = (x: number, y: number): string | null => {
    const id = ctrl.current?.pick(x, y) ?? null;
    const p = w.get(id), you = w.you();
    return p && you && p !== you && !p.keeper && p.team === you.team ? p.id : null;
  };
  /** PC: how hard a hold-and-release kicks (the hold, or the drag, whichever is more). */
  const pcPull = (d: { x0: number; y0: number; x: number; y: number; t0: number }, t: number) => {
    const hold = Math.max(0, Math.min(1, (t - d.t0 - TAP_MS) / 1000 / HOLD_FULL_S)) * FULL_PULL;
    const dragged = Math.hypot(d.x - d.x0, d.y - d.y0) / realMatchHeight(window.innerWidth) * SWIPE_SCALE;
    return Math.min(FULL_PULL * 1.6, Math.max(hold, dragged));
  };
  /** PC: the way to kick — from you towards the pitch point under the pointer. */
  const pcDir = (x: number, y: number) => {
    const you = w.you(), g = ctrl.current?.ground(x, y);
    if (you && g && Math.hypot(g.x - you.x, g.y - you.y) > 0.3) return { x: g.x - you.x, y: g.y - you.y };
    // above the horizon: straight ahead of the camera, bent by where the pointer is across the screen
    const box = holder.current?.getBoundingClientRect();
    return toWorld((x - (box?.width ?? 400) / 2) / 200, -1);
  };
  useEffect(() => {
    if (!drag) return;
    const id = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(id);
  }, [drag]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = performance.now();
    if (schemeRef.current === "pc") {
      if (e.button !== 0 || aim.current) return;
      aim.current = { id: e.pointerId, x0: x, y0: y, t0: t };
      setDrag({ x0: x, y0: y, x, y, t0: t }); setNow(t);
      return;
    }
    if (cornerStick) {
      // the corner nudge stick: only a press on it (and never one near the ball); everything else is the action
      const c = cornerAt(box.height);
      if (!stick.current && Math.hypot(x - c.x, y - c.y) < cornerR + 22 && !nearBall(x, y)) {
        stick.current = { id: e.pointerId, x0: c.x, y0: c.y, t0: t, r: cornerR, corner: true }; setKnob({ x0: c.x, y0: c.y, x, y, r: cornerR });
        return;
      }
    } else if (x < box.width * 0.5 && !stick.current) { stick.current = { id: e.pointerId, x0: x, y0: y, t0: t, r: STICK_R }; setKnob({ x0: x, y0: y, x, y, r: STICK_R }); return; }
    if (x >= box.width * 0.5 && aim.current && !peekT.current && Math.hypot(x - aim.current.x0, y - aim.current.y0) < 120) {
      // a second finger on the right: peek round (the first finger's swipe is called off)
      peekT.current = { ids: [aim.current.id, e.pointerId], x0: (x + aim.current.x0) / 2 };
      aim.current = null; setDrag(null);
      return;
    }
    if (!aim.current && !peekT.current) { aim.current = { id: e.pointerId, x0: x, y0: y, t0: t }; setDrag({ x0: x, y0: y, x, y, t0: t }); }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    if (stick.current?.id === e.pointerId) {
      const R = stick.current.r;
      const dx = x - stick.current.x0, dy = y - stick.current.y0, d = Math.hypot(dx, dy);
      const k = Math.min(1, d / R);
      stickVec.current = d > 1 ? { x: dx / d * k, y: dy / d * k, sprint: d > R * 0.92 } : { x: 0, y: 0, sprint: false };
      setKnob({ x0: stick.current.x0, y0: stick.current.y0, x, y, r: R });
    } else if (peekT.current?.ids.includes(e.pointerId)) {
      ctrl.current?.peek(Math.max(-PEEK_MAX, Math.min(PEEK_MAX, -(x - peekT.current.x0) * 0.006)));
    } else if (aim.current?.id === e.pointerId) setDrag((d) => d && { ...d, x, y });
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    const t = performance.now();
    if (stick.current?.id === e.pointerId) {
      const s = stick.current;
      stick.current = null; stickVec.current = { x: 0, y: 0, sprint: false }; setKnob(null);
      // a quick tap on the corner stick is still a touch (Two Touch); on a team-mate on the left, a pass to him
      if (s.corner) { if (Math.hypot(x - s.x0, y - s.y0) < s.r * 0.6 && t - s.t0 < TAP_MS) w.act({ kind: "tap" }); return; }
      if (Math.hypot(x - s.x0, y - s.y0) < TAP_PX && t - s.t0 < TAP_MS) { const to = mateAt(x, y); if (to) w.act({ kind: "tap", to }); }
      return;
    }
    if (peekT.current?.ids.includes(e.pointerId)) { peekT.current = null; ctrl.current?.peek(0); return; }
    if (aim.current?.id === e.pointerId) {
      const a = aim.current;
      aim.current = null; setDrag(null);
      const dx = x - a.x0, dy = y - a.y0;
      const tap = Math.hypot(dx, dy) < TAP_PX && t - a.t0 < TAP_MS;
      if (schemeRef.current === "pc") {
        if (tap) { w.act({ kind: "tap", to: mateAt(x, y) ?? undefined }); return; }
        w.act({ kind: "shoot", dir: pcDir(x, y), pull: pcPull({ ...a, x, y }, t) });
        return;
      }
      if (Math.hypot(dx, dy) < 14) { w.act({ kind: "tap", to: mateAt(x, y) ?? undefined }); return; }
      // a swipe: the ball goes the way the thumb went; its length is the power
      const pull = Math.hypot(dx, dy) / realMatchHeight(window.innerWidth) * SWIPE_SCALE;
      w.act({ kind: "shoot", dir: toWorld(dx, dy), pull });
    }
  };
  // keyboard: WASD/arrows move (read every frame against the camera), Shift sprints, Space taps, Q/E look round
  useEffect(() => {
    const ks = keys.current;
    const peekKeys = () => ctrl.current?.peek((ks.has("e") ? PEEK_MAX : 0) - (ks.has("q") ? PEEK_MAX : 0));
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === " ") { e.preventDefault(); if (!e.repeat) w.act({ kind: "tap" }); return; }
      if (k === "f" && session.call) { if (!e.repeat) w.act({ kind: "call" }); return; }
      if (k.startsWith("arrow")) e.preventDefault();
      ks.add(k);
      if (k === "q" || k === "e") peekKeys();
    };
    const up = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); ks.delete(k); if (k === "shift") ks.delete("shift"); if (k === "q" || k === "e") peekKeys(); };
    const blur = () => { ks.clear(); peekKeys(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [w, session.call]);

  const [vw, setVw] = useState(0);
  useEffect(() => { setVw(window.innerWidth); }, []);
  const [vh, setVh] = useState(0);
  useEffect(() => { setVh(window.innerHeight); }, []);
  const h = vw ? Math.max(360, Math.min(realMatchHeight(vw), 640, vh - 310)) : 560;
  const mins = hud.timeLeft !== undefined ? `${Math.floor(hud.timeLeft / 60)}:${String(Math.floor(hud.timeLeft % 60)).padStart(2, "0")}` : null;
  const hint = session.hints ? session.hints[scheme] : scheme === "pc" && session.hintKeys ? session.hintKeys : session.hint;
  // the aim line: phone — the swipe itself; PC — from you to the pointer, with the power filling up
  const youOnScreen = drag && scheme === "pc" ? ctrl.current?.screen(w.you()?.id ?? "") ?? null : null;
  const pcPower = drag && scheme === "pc" ? pcPull(drag, Math.max(now, drag.t0)) / FULL_PULL : 0;

  return (
    <GameShell title={drill.name} who="Team" current={team} tone="#38bdf8">
      <BackPill3D onBack={onExit} />
      <div className="mb-2 flex items-end justify-between gap-2" data-play3d-hud={drill.id}>
        <div>
          <div className="text-[34px] font-black leading-none" data-play3d-score>{hud.big}</div>
          <div className="text-[12px] font-bold uppercase tracking-wide text-sky-200">{hud.small}</div>
        </div>
        {mins && <div className="text-[22px] font-black tabular-nums" data-play3d-time>{mins}</div>}
      </div>
      <div className="relative select-none overflow-hidden" style={{ height: h, borderRadius: 4, touchAction: "none" }} data-play3d={three} data-play3d-controls={scheme}>
        <div ref={holder} className="absolute inset-0" />
        <div
          className="absolute inset-0 z-20"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onContextMenu={(e) => e.preventDefault()}
          data-play3d-pad
        />
        {cornerStick && !knob && three === "ready" && !result && (
          // the corner nudge stick at rest: small and faint, always in the same place
          <div className="pointer-events-none absolute z-30 rounded-full ring-2 ring-white/50" data-play3d-corner-stick
            style={{ left: CORNER_STICK.left - cornerR, top: h - CORNER_STICK.bottom - cornerR, width: cornerR * 2, height: cornerR * 2, background: "rgba(0,0,0,0.18)", opacity: CORNER_STICK.opacity }}>
            <div className="absolute rounded-full bg-white/80" style={{ left: cornerR * 0.68, top: cornerR * 0.68, width: cornerR * 0.64, height: cornerR * 0.64 }} />
          </div>
        )}
        {knob && (
          <div className="pointer-events-none absolute z-30 rounded-full ring-2 ring-white/50" style={{ left: knob.x0 - knob.r, top: knob.y0 - knob.r, width: knob.r * 2, height: knob.r * 2, background: "rgba(0,0,0,0.18)", opacity: knob.r < STICK_R ? 0.7 : 1 }}>
            <div className="absolute rounded-full bg-white/80" style={{ width: knob.r * 0.64, height: knob.r * 0.64, left: knob.r * 0.68 + Math.max(-knob.r, Math.min(knob.r, knob.x - knob.x0)), top: knob.r * 0.68 + Math.max(-knob.r, Math.min(knob.r, knob.y - knob.y0)) }} />
          </div>
        )}
        {stam && (
          // the sprint bar: small, by the stick, only while it isn't full
          <div className="pointer-events-none absolute z-40" data-play3d-stamina={stam.v.toFixed(2)} data-tired={stam.tired ? 1 : 0}
            style={knob ? { left: knob.x0 - 30, top: knob.y0 - STICK_R - 16 } : { left: 14, bottom: 84 }}>
            <div className="h-[6px] w-[60px] overflow-hidden rounded-full bg-black/55 ring-1 ring-white/40">
              <div className="h-full rounded-full" style={{ width: `${Math.round(stam.v * 100)}%`, background: stam.tired ? "#f87171" : stam.v < 0.3 ? "#fbbf24" : "#4ade80", transition: "width 0.1s linear" }} />
            </div>
          </div>
        )}
        {drag && scheme === "touch" && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 14 && (
          <svg className="pointer-events-none absolute inset-0 z-30" width="100%" height="100%">
            <line x1={drag.x0} y1={drag.y0} x2={drag.x} y2={drag.y} stroke="#fb923c" strokeWidth={6} strokeLinecap="round" />
            <circle cx={drag.x} cy={drag.y} r={9} fill="rgba(255,255,255,0.7)" />
          </svg>
        )}
        {drag && scheme === "pc" && (
          <svg className="pointer-events-none absolute inset-0 z-30" width="100%" height="100%" data-play3d-charge={pcPower.toFixed(2)}>
            {youOnScreen && !youOnScreen.off && <line x1={youOnScreen.x} y1={youOnScreen.y + 30} x2={drag.x} y2={drag.y} stroke="#fb923c" strokeWidth={4} strokeDasharray="8 6" strokeLinecap="round" />}
            <circle cx={drag.x} cy={drag.y} r={12} fill="none" stroke="white" strokeWidth={2} />
            <rect x={drag.x + 18} y={drag.y - 30} width={8} height={60} rx={3} fill="rgba(0,0,0,0.5)" />
            <rect x={drag.x + 18} y={drag.y + 30 - 60 * Math.min(1, pcPower)} width={8} height={60 * Math.min(1, pcPower)} rx={3} fill={pcPower > 1 ? "#f87171" : "#fb923c"} />
          </svg>
        )}
        {hud.flash && !hud.banner && <div className="pointer-events-none absolute inset-x-0 top-[8%] z-30 px-2 text-center text-[20px] font-black uppercase" style={{ textShadow: "0 2px 8px #000" }}>{hud.flash}</div>}
        {hud.pop && (
          <div className="pointer-events-none absolute inset-x-0 top-[38%] z-30 text-center" data-play3d-pop>
            <span className="rounded-full px-3 py-1 text-[17px] font-black uppercase" style={{ background: "rgba(0,0,0,0.55)", color: hud.pop.tone === "good" ? "#4ade80" : hud.pop.tone === "bad" ? "#f87171" : "#fde047" }}>{hud.pop.text}</span>
          </div>
        )}
        {hud.banner && (
          <div className="pointer-events-none absolute inset-x-0 top-[24%] z-30 px-2 text-center text-[44px] font-black uppercase leading-none" data-play3d-banner style={{ color: hud.banner.tone === "good" ? "#4ade80" : hud.banner.tone === "bad" ? "#f87171" : "#fde047", textShadow: "0 3px 12px #000" }}>
            {hud.banner.text}
          </div>
        )}
        {hud.note && <div className="pointer-events-none absolute inset-x-0 top-2 z-30 px-2 text-center text-[13px] font-black uppercase text-amber-200" style={{ textShadow: "0 1px 4px #000" }} data-play3d-note>{hud.note}</div>}
        {!!hud.roster?.length && (
          <div className="pointer-events-none absolute left-2 top-[60px] z-30 flex flex-col gap-0.5" data-play3d-roster>
            {hud.roster.map((r) => (
              <div key={r.name} className={`rounded px-1.5 py-0.5 text-[11px] font-black ${r.you ? "ring-1 ring-sky-300" : ""}`} style={{ background: "rgba(0,0,0,0.55)", color: r.state === "out" ? "#f87171" : r.state === "safe" ? "#4ade80" : "#fff" }}>
                {r.state === "safe" ? "✓" : r.state === "out" ? "✗" : "•"} {r.name}
              </div>
            ))}
          </div>
        )}
        {three === "ready" && !result && marks.map((m) => (
          <div key={m.id} className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2" style={{ left: m.x, top: m.off ? m.y : m.y - 34 }} data-play3d-mate={m.id} data-aim={m.aim ? 1 : 0}>
            <div className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-black uppercase leading-tight ${m.aim ? "bg-white text-slate-900" : "bg-black/60 text-white ring-1 ring-white/40"}`} style={{ textShadow: m.aim ? "none" : "0 1px 3px #000" }}>
              {m.off ? (m.x < 40 ? "◀ " : m.x > (holder.current?.clientWidth ?? 400) - 40 ? "" : m.y < 40 ? "▲ " : "▼ ") : ""}{m.aim ? "Pass · " : ""}{m.name}{m.off && m.x > (holder.current?.clientWidth ?? 400) - 40 ? " ▶" : ""}
            </div>
          </div>
        ))}
        {session.call && three === "ready" && !result && callUi.ans && (
          <>
            {callUi.ans.you && (
              <div className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full" style={{ left: callUi.ans.you.x, top: callUi.ans.you.y - 46 }} data-play3d-shout={callUi.ans.ok ? "yes" : "no"}>
                <div className="relative whitespace-nowrap rounded-xl bg-white px-2.5 py-1 text-[14px] font-black uppercase text-slate-900 shadow">
                  Here! <span style={{ color: callUi.ans.ok ? "#16a34a" : "#dc2626" }}>{callUi.ans.ok ? "✓" : "✗"}</span>
                  <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "7px solid white" }} />
                </div>
              </div>
            )}
            {callUi.ans.mate && (
              <div className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2" style={{ left: Math.max(60, Math.min((holder.current?.clientWidth ?? 400) - 60, callUi.ans.mate.x)), top: callUi.ans.mate.off ? callUi.ans.mate.y : callUi.ans.mate.y - 58 }} data-play3d-call-answer={callUi.ans.ok ? "yes" : "no"}>
                <div className="whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-black uppercase" style={{ background: callUi.ans.ok ? "#16a34a" : "#dc2626", color: "white", boxShadow: "0 1px 4px #000" }}>
                  {callUi.ans.ok ? "✓" : "✗"} {callUi.ans.why}
                </div>
              </div>
            )}
            {!callUi.ans.mate && (
              <div className="pointer-events-none absolute inset-x-0 top-[18%] z-30 text-center" data-play3d-call-answer="no">
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[12px] font-black uppercase text-white">✗ {callUi.ans.why}</span>
              </div>
            )}
          </>
        )}
        {session.call && scheme === "touch" && three === "ready" && !result && (
          // Call for it: top-right, above the edge markers and the swipe's usual ground; its own button (a press on it never starts a swipe)
          <button
            className="absolute right-2 z-40 grid h-[58px] w-[58px] place-items-center rounded-full text-[11px] font-black uppercase leading-none text-white ring-2 ring-white/60"
            style={{ top: "15%", background: callUi.cd > 0 ? "rgba(0,0,0,0.35)" : "rgba(14,165,233,0.75)", touchAction: "none" }}
            data-play3d-call={callUi.cd > 0 ? "cooling" : "ready"}
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); w.act({ kind: "call" }); setCallUi(callView()); }}
          >
            <span>📣<br />Call</span>
            {callUi.cd > 0 && <span className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(rgba(0,0,0,0.45) ${Math.round(callUi.cd / 2.5 * 360)}deg, transparent 0)` }} />}
          </button>
        )}
        {three === "loading" &&<div className="pointer-events-none absolute inset-0 z-30 grid place-items-center text-[13px] font-bold text-white/80">Loading the training pitch…</div>}
        {three === "off" && <div className="absolute inset-0 z-30 grid place-items-center px-6 text-center text-[14px] font-bold text-amber-200">This phone can&apos;t show the 3D pitch, and this drill is 3D only. Pick the Crossbar Challenge instead.</div>}
        {cornerStick && !knob && !drag && three === "ready" && !result && (
          <>
            <div className="pointer-events-none absolute left-3 z-30 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase text-white/70" style={{ top: h - CORNER_STICK.bottom - cornerR - 22 }} data-play3d-zone="nudge">Nudge</div>
            <div className="pointer-events-none absolute bottom-[76px] right-3 z-30 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase text-white/80" data-play3d-zone="action">Tap · Swipe anywhere</div>
          </>
        )}
        {scheme === "touch" && session.hints && !cornerStick && !knob && !drag && three === "ready" && !result && (
          <>
            <div className="pointer-events-none absolute bottom-[76px] left-3 z-30 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase text-white/80" data-play3d-zone="move">◉ Move</div>
            <div className="pointer-events-none absolute bottom-[76px] right-3 z-30 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase text-white/80" data-play3d-zone="action">Tap · Swipe ➚</div>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-black/45 px-3 py-1.5 text-center text-[12px] font-bold leading-snug text-white" style={{ textShadow: "0 1px 4px #000" }} data-play3d-hint={scheme}>
          {scheme === "pc" && session.hints ? <KeyHint text={hint} /> : hint}
        </div>
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

/** A PC hint line with its keys drawn as keycaps (WASD, Shift, Space, Q/E). */
function KeyHint({ text }: { text: string }) {
  const parts = text.split(/\b(WASD|Shift|Space|Q\/E|F)\b/);
  return (
    <>
      {parts.map((p, i) => (/^(WASD|Shift|Space|Q\/E|F)$/.test(p)
        ? <kbd key={i} className="mx-0.5 rounded border border-white/50 bg-white/15 px-1 font-mono text-[11px]">{p}</kbd>
        : <span key={i}>{p}</span>))}
    </>
  );
}
