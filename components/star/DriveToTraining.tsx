"use client";

/**
 * THE DRIVE TO TRAINING, IN THE CAREER (driving phase 2, 28 Nov 2026; behind the setting in
 * lib/star/drive3d/careerFlag.ts, OFF by default). Phase "drive-3d" in app/star-dev/page.tsx.
 *
 *   start "in":       the drive (components/star/Drive3D.tsx) → the real compound with the arrival
 *                     (components/star/World3D.tsx, options.arrive): you at your car; the gym door opens the gym
 *   start "compound": back at the compound from the gym (you at your car, no arrival)
 *   start "back":     the drive home, ending at the fork: Home / Casino / Shop
 *
 * Dressed from the career: your best car (the shop's order; the Hatchback when you own none), your club's kit and
 * number, your team-mates' names, your wage (a speed camera's fine). Saved: only an event's small effect
 * (lib/star/drive3d/events.ts, through dilemmas.ts applyEffects). The calls change nothing yet.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import Drive3D from "./Drive3D";
import World3D from "./World3D";
import { kitsOf } from "@/lib/star/kits";
import { baseIdOf } from "@/lib/star/shopData";
import { applyEffects } from "@/lib/star/dilemmas";
import { carFromShop, DRIVE_CARS } from "@/lib/star/drive3d/cars";
import { driveSeed } from "@/lib/star/drive3d/careerFlag";
import { clockOf } from "@/lib/star/life/clock";
import type { DriveSceneOptions } from "@/lib/star/drive3d/scene";
import type { ForkChoice } from "@/lib/star/drive3d/drive";
import type { SteerMode } from "@/lib/star/drive3d/car";
import type { WorldOptions } from "@/lib/star/world3d/testScene";

const STEER_KEY = "star-drive-steer";
const readSteer = (): SteerMode => { try { const v = localStorage.getItem(STEER_KEY); return v === "stick" || v === "tilt" ? v : "lanes"; } catch { return "lanes"; } };

export interface DriveToTrainingProps {
  career: CareerState;
  start: "in" | "compound" | "back";
  /** The career after an event's effect. */
  onCareer: (c: CareerState) => void;
  /** The compound's gym door. */
  onGym: () => void;
  /** The end of the drive home: where the fork took you. */
  onFork: (f: ForkChoice) => void;
  /** Back out of the compound without driving (the corner pill's long way round is "Drive home"). */
  onBack: () => void;
}

export default function DriveToTraining({ career, start, onCareer, onGym, onFork, onBack }: DriveToTrainingProps) {
  const [stage, setStage] = useState<"in" | "compound" | "back">(start);
  const [arrival, setArrival] = useState<{ skipped: boolean } | null>(null);
  // the corner pills only once you are out of the car
  const [out, setOut] = useState(false);
  const careerRef = useRef(career);
  careerRef.current = career;

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // dressed once per visit, from the career on the way in
  const dress = useMemo(() => {
    const c = career;
    const kit = kitsOf(c.player.club).home;
    const mates = (c.squad ?? []).filter((p) => p.position !== "GK").slice(0, 4).map((p, i) => ({ id: p.id, name: p.shortName || p.name, number: [8, 14, 21, 4][i] }));
    const car = carFromShop(c.ownedItems.map((it) => baseIdOf(it)));
    const day = clockOf(c).d;
    return { kit: { shirt: kit.shirt, trim: kit.trim }, mates, car, day, mate: mates[0]?.name ?? "Your team-mate", mate2: mates[1]?.name ?? "the lads" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const driveOpts = (leg: "in" | "back"): DriveSceneOptions => ({
    car: dress.car, leg, mode: readSteer(),
    seed: driveSeed(career.season, career.week, dress.day, leg),
    names: { mate: dress.mate, mate2: dress.mate2, car: DRIVE_CARS[dress.car].name.toLowerCase(), club: career.player.club },
    kit: dress.kit, wage: career.contract.wage,
  });
  const inOpts = useMemo(() => driveOpts("in"), []); // eslint-disable-line react-hooks/exhaustive-deps
  const backOpts = useMemo(() => driveOpts("back"), []); // eslint-disable-line react-hooks/exhaustive-deps
  const worldOpts = useMemo<WorldOptions>(() => ({
    place: "compound", number: career.squadNumber ?? 10, club: career.player.club, kit: dress.kit, mates: dress.mates,
    arrive: { car: dress.car, mate: dress.mate, skip: arrival ? arrival.skipped : true },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [arrival]);

  const takeEffects = (effects: Parameters<typeof applyEffects>[1][]) => {
    if (!effects.length) return;
    let c = careerRef.current;
    for (const e of effects) c = applyEffects(c, e);
    careerRef.current = c;
    onCareer(c);
  };

  if (stage === "in") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "#0b0d12" }} data-drive-career="in">
        <Drive3D options={inOpts} onDone={(r) => { takeEffects(r.effects); setArrival({ skipped: r.skipped }); setStage("compound"); }} />
      </div>
    );
  }
  if (stage === "back") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "#0b0d12" }} data-drive-career="back">
        <Drive3D options={backOpts} onDone={(r) => { takeEffects(r.effects); onFork(r.fork ?? "home"); }} />
      </div>
    );
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "#0b0d12" }} data-drive-career="compound">
      <World3D options={worldOpts} noStatus onGo={(p) => { if (p === "gym") onGym(); }} onArrival={(a) => { if (a.phase === "done" || a.phase === "out") setOut(true); }} />
      {out && <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, zIndex: 2 }}>
        <button data-drive-home onClick={() => setStage("back")} style={PILL}>‹ Drive home</button>
        <button data-drive-leave onClick={onBack} style={{ ...PILL, background: "rgba(8,10,16,.5)" }}>Training page</button>
      </div>}
    </div>
  );
}

const PILL: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 34, padding: "0 12px", borderRadius: 999,
  background: "rgba(8,10,16,.78)", color: "#f8fafc", fontWeight: 800, fontSize: 13, border: "1px solid rgba(255,255,255,.14)", cursor: "pointer",
};
