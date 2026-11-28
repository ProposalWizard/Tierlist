"use client";

/**
 * THE GYM IN THE REAL CAREER (Harry, 28 Nov 2026: "for now just make it that you can click into it from the
 * training page because I just want to test it actually in game"). Training → the Gym card opens this,
 * full screen (phase "gym-3d" in app/star-dev/page.tsx). The scene is the world kit's gym
 * (lib/star/world3d/testScene.ts, place "gym"; the same room, the 13 exercises and the team-mate as
 * /star-world3d-dev?place=gym), dressed from the career: your club's gym kit, your number, a real team-mate.
 *
 * Saved: the gym's own numbers (career.gym, lib/star/gym/progress.ts gymExercise). Nothing else: the gym
 * effect flag (progress.ts GYM_CAREER_EFFECT) is "off", so no Power, Pace or energy changes and no week
 * action is taken; the HUD says so in small words. With the flag on, gymExercise takes the week's action.
 *
 * HOME GYMS (28 Nov 2026): `home` set = your house's gym of that level (lib/star/gym/homeGym.ts): only its
 * machines, inside its own walls in the house's look, no team-mate, the same saved numbers and limits
 * (homeGymExercise = the club's gymExercise on career.gym), and each exercise costs game minutes on the career
 * clock (the clock pill shows it; `onTime` sends the minutes that pass while you stand about). Back → the house.
 *
 * Later (not now): the gym at the training compound in the career (today on /star-world3d-dev only).
 *
 * A lost 3D rebuilds itself (three3d/autoHeal.ts): twice in a minute, Low after the first, then a plain
 * screen with "Tap to reload 3D" and the way back.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { InteractCard } from "@/lib/star/world3d/interact";
import type { WorldController, WorldOptions, WorldStatus } from "@/lib/star/world3d/testScene";
import { GymHud, type GymHudHandle } from "./GymHud";
import ViewToggle3D from "./ViewToggle3D";
import Reload3dPill from "./Reload3d";
import LoadingCurtain from "./loading/LoadingCurtain";
import { kitsOf } from "@/lib/star/kits";
import { gapOf, gymExercise } from "@/lib/star/gym/progress";
import { gymEffectMode } from "@/lib/star/gym/effect";
import { afterLoss, newHealState, HEAL_DELAY_MS } from "@/lib/star/three3d/autoHeal";
import { parseQuality3d } from "@/lib/star/three3d/quality";
import type { HomeTier } from "@/lib/star/home3d/homes";
import { homeGymExercise, homeGymOf } from "@/lib/star/gym/homeGym";
import { useLiveClock } from "./ClockPill";
import { hhmm, passTime } from "@/lib/star/life/clock";

const BG = "#0b0d12";
const PILL: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 36, padding: "0 12px", borderRadius: 999,
  background: "rgba(8,10,16,.78)", color: "#f8fafc", fontWeight: 800, fontSize: 14, border: "1px solid rgba(255,255,255,.14)",
  boxShadow: "0 6px 18px rgba(0,0,0,.35)",
};

export interface Gym3DProps {
  career: CareerState;
  onBack: () => void;
  backLabel?: string;
  /** A new career after an exercise (the gym's numbers; with the effect on, the week's action too). */
  onCareer: (c: CareerState) => void;
  /** Your HOME gym of this house level (gym/homeGym.ts). Absent: the club gym. */
  home?: HomeTier;
  /** A home gym: game minutes that passed while you were in it (the career clock, as the house's). */
  onTime?: (mins: number) => void;
}

export default function Gym3D({ career, onBack, backLabel = "Training", onCareer, home, onTime }: Gym3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const ctrl = useRef<WorldController | null>(null);
  const hud = useRef<GymHudHandle>(null);
  const [card, setCard] = useState<InteractCard | null>(null);
  const [status, setStatus] = useState<WorldStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [gymOn, setGymOn] = useState(false);
  const [build, setBuild] = useState(0);
  const heal = useRef(newHealState());
  const careerRef = useRef(career);
  careerRef.current = career;
  const saveRef = useRef(onCareer);
  saveRef.current = onCareer;
  const effectOff = gymEffectMode() === "off";
  // a home gym runs the career clock like the house does (stopped while loading and during a set)
  const live = useLiveClock(career, home ? onTime : undefined, { paused: !home || state !== "ready" || gymOn });
  const liveRef = useRef(live.clock);
  liveRef.current = live.clock;
  const timeRef = useRef(onTime);
  timeRef.current = onTime;

  // built once per visit, from the career as it was on the way in (the gym's numbers then follow the saves)
  const options = useMemo<WorldOptions>(() => {
    const c = career;
    const kit = kitsOf(c.player.club).home;
    const mates = (c.squad ?? []).filter((p) => p.position !== "GK").slice(0, 3)
      .map((p, i) => ({ id: p.id, name: p.shortName || p.name, number: [8, 14, 21][i] }));
    return {
      place: "gym",
      homeGym: home ?? null,
      fadeIn: !!home,
      number: c.squadNumber ?? 10,
      club: c.player.club,
      kit: { shirt: kit.shirt, trim: kit.trim },
      mates,
      gym: c.gym,
      gap: gapOf(c),
      onExercise: (r) => {
        if (home) {
          // the minutes that ticked by first (sent before the set), then the set's own minutes on top
          const pend = liveRef.current.flush(1);
          if (pend) timeRef.current?.(pend);
          const hr = homeGymExercise(passTime(careerRef.current, pend), r, gymEffectMode());
          careerRef.current = hr.career;
          saveRef.current(hr.career);
          return hr.out;
        }
        const res = gymExercise(careerRef.current, r, gymEffectMode());
        careerRef.current = res.career;
        saveRef.current(res.career);
        return res.out;
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    let wait = 0;
    setState("loading");
    setCard(null);
    setGymOn(false);
    const lost = () => {
      if (gone) return;
      console.error("3D gym: the phone took the 3D away");
      ctrl.current?.dispose();
      ctrl.current = null;
      if (afterLoss(heal.current, Date.now()) === "give-up") { setState("failed"); return; }
      setState("loading");
      wait = window.setTimeout(async () => {
        const m = await import("@/lib/star/three3d/perf");
        if (gone) return;
        m.dropSharedRenderer();
        el.replaceChildren();
        setBuild((n) => n + 1);
      }, HEAL_DELAY_MS);
    };
    const q = new URLSearchParams(window.location.search);
    const quality = build > 0 ? "low" : parseQuality3d(q.get("q")) ?? undefined;
    // a tick later, so React's dev double-mount never builds a second scene
    const go = window.setTimeout(() => import("@/lib/star/world3d/testScene")
      .then(({ startWorld3d }) => startWorld3d(el, {
        onCard: (c) => { if (!gone) setCard(c); },
        onStatus: (s) => { if (!gone) setStatus(s); },
        onContextLost: lost,
        onGym: (f) => { if (gone) return; hud.current?.frame(f); const on = !!f.kind; setGymOn((was) => (was === on ? was : on)); },
      }, { ...options, quality }))
      .then((c) => { if (gone) { c.dispose(); return; } ctrl.current = c; setState("ready"); })
      .catch((e) => { console.error("3D gym failed to load", e); lost(); }), 0);
    return () => { gone = true; window.clearTimeout(go); window.clearTimeout(wait); ctrl.current?.dispose(); ctrl.current = null; };
  }, [build, options]);

  // on a computer the space bar is your thumb
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); ctrl.current?.gymHold(true); } };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") ctrl.current?.gymHold(false); };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  if (state === "failed") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 80, background: BG, color: "#f8fafc", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif" }} data-gym3d="failed">
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>The gym could not open its 3D on this phone</div>
          <button onClick={onBack} style={{ ...PILL, marginTop: 16, cursor: "pointer" }}>&#8249; {backLabel}</button>
        </div>
        <Reload3dPill onReload={() => { heal.current = newHealState(); setBuild((n) => n + 1); }} />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: BG, overflow: "hidden", fontFamily: "system-ui, sans-serif", touchAction: "none", userSelect: "none" }} data-gym3d={state}>
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
      {state === "loading" && <div style={{ position: "absolute", inset: 0, background: BG }} />}
      <LoadingCurtain section={home ? "house" : "gym"} loading={state === "loading"} />

      {state === "ready" && (
        <GymHud ref={hud} inGame fitness={status?.fitness} body={null}
          note={effectOff ? "Gym effects are switched off while we test" : undefined}
          onHold={(on) => ctrl.current?.gymHold(on)} onAct={(id) => ctrl.current?.act(id)} />
      )}

      {/* the top bar: back to Training and the clock (hidden while a set is on: the game has the screen) */}
      {state === "ready" && !gymOn && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "max(12px, env(safe-area-inset-top)) 12px 0", pointerEvents: "none" }}>
          <button onClick={onBack} aria-label="Back" data-gym-back style={{ ...PILL, pointerEvents: "auto", cursor: "pointer", gap: 4, paddingLeft: 10 }}>
            <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>&#8249;</span>{backLabel}
          </button>
          <div style={{ flex: 1 }} />
          {home && <div style={{ ...PILL }} data-gym-home>{homeGymOf(home).label}</div>}
          {(home || status) && <div style={{ ...PILL, gap: 6 }} aria-label="Clock"><span aria-hidden>🕒</span><b style={{ color: "#facc15" }}>{home ? hhmm(Math.floor(live.abs) % 1440) : status!.clock}</b></div>}
        </div>
      )}

      {state === "ready" && !gymOn && <ViewToggle3D onChange={(m) => ctrl.current?.setView(m)} style={{ top: "auto", bottom: card ? 200 : 16 }} />}

      {state === "ready" && card && !gymOn && (
        <div data-world3d-card style={{ position: "absolute", left: 12, right: 12, bottom: "max(16px, env(safe-area-inset-bottom))", maxWidth: 460, margin: "0 auto", padding: "12px 14px", borderRadius: 14, background: "rgba(8,10,16,.9)", color: "#f8fafc", borderTop: "3px solid #facc15", boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>
          {card.sub && <div style={{ fontSize: 11, fontWeight: 900, color: "#facc15", textTransform: "uppercase", letterSpacing: 0.5 }}>{card.sub}</div>}
          <div style={{ fontSize: 18, fontWeight: 900 }}>{card.title}</div>
          {card.lines.map((l, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.35, marginTop: 4, color: i ? "#cbd5e1" : "#f8fafc" }}>{l}</div>)}
          {card.change && <div style={{ fontSize: 12, fontWeight: 800, color: "#86efac", marginTop: 6 }}>{card.change}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {card.actions.map((a) => (
              <button key={a.id} onClick={() => ctrl.current?.act(a.id)} data-act={a.id}
                style={{ flex: a.primary ? 2 : 1, height: 44, borderRadius: 10, border: a.primary ? "none" : "1px solid rgba(255,255,255,.25)", background: a.primary ? "#facc15" : "transparent", color: a.primary ? "#111" : "#f8fafc", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
