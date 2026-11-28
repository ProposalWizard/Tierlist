"use client";

/**
 * THE DRIVE — the test page (driving phase 1, 28 Nov 2026; docs/plans/DRIVING_PLAN.md). Garden gate →
 * your car → your street, a roundabout, a country lane → the compound gate: the barrier lifts, you
 * park, two team-mates turn to look. The way back ends at a fork: Home / Casino / Shop. Not in the
 * career yet (RUL-UI-002).
 *
 * ?car=hatch|family|suv|sports|classic|super · ?leg=in|back · ?steer=lanes|stick|tilt ·
 * ?call=borrow-car|borrow-watch|agent-interest|agent-photo|mate-casino|none · ?q=low|medium|high ·
 * ?film=1 (full screen; with ?demo=1 a scripted thumb: holds, an overtake, answers the call) ·
 * ?clean=1 (no buttons) · ?nopeople=1. Nothing is saved.
 */
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn, Pill } from "@/components/admin/broadcast/BroadcastPage";
import Drive3D from "@/components/star/Drive3D";
import World3D from "@/components/star/World3D";
import { parseQuality3d } from "@/lib/star/three3d/quality";
import { kitsOf } from "@/lib/star/kits";
import { DRIVE_CARS, DRIVE_CAR_IDS, type DriveCarId } from "@/lib/star/drive3d/cars";
import { DRIVE_CALLS } from "@/lib/star/drive3d/calls";
import { DRIVE_EVENT_IDS, type DriveEffect } from "@/lib/star/drive3d/events";
import type { DriveSceneOptions } from "@/lib/star/drive3d/scene";
import type { SteerMode } from "@/lib/star/drive3d/car";
import type { CallMemory } from "@/lib/star/drive3d/calls";
import "../star-3d-area-dev/stage3d.css";

const STEER_KEY = "star-drive-steer";
const readSteer = (): SteerMode => { try { const v = localStorage.getItem(STEER_KEY); return v === "stick" || v === "tilt" ? v : "lanes"; } catch { return "lanes"; } };

export default function Drive3DTestPage() {
  return <Suspense><Drive3DTest /></Suspense>;
}

function Drive3DTest() {
  const params = useSearchParams();
  const pc = params.get("car") as DriveCarId | null;
  const [car, setCar] = useState<DriveCarId>(pc && DRIVE_CAR_IDS.includes(pc) ? pc : "hatch");
  const [leg, setLeg] = useState<"in" | "back">(params.get("leg") === "back" ? "back" : "in");
  const ps = params.get("steer");
  const [mode, setModeState] = useState<SteerMode>(ps === "stick" || ps === "tilt" || ps === "lanes" ? ps : typeof window === "undefined" ? "lanes" : readSteer());
  const setMode = (m: SteerMode) => { setModeState(m); try { localStorage.setItem(STEER_KEY, m); } catch { /* fine */ } };
  const [call, setCall] = useState<string | undefined>(params.get("call") ?? undefined);
  const [event, setEvent] = useState<string | undefined>(params.get("event") ?? undefined);
  const [effects, setEffects] = useState<DriveEffect[] | null>(null);
  const [run, setRun] = useState(0);
  const [memories, setMemories] = useState<CallMemory[]>([]);
  // the drive in hands over to the real compound (its own arrival: lib/star/drive3d/arrival.ts); null = still driving
  const [atCompound, setAtCompound] = useState<{ skipped: boolean } | null>(null);
  const [walked, setWalked] = useState<string | null>(null);
  const quality = parseQuality3d(params.get("q")) ?? undefined;
  const demo = params.get("demo") === "1";
  const options = useMemo<DriveSceneOptions>(() => {
    const kit = kitsOf("Arsenal").home;
    return {
      car, leg, mode, quality, call, event, seed: 7 + run, wage: 24000,
      names: { mate: "Kai", mate2: "Marcus", car: DRIVE_CARS[car].name.toLowerCase(), club: "Aston Villa" },
      kit: { shirt: kit.shirt, trim: kit.trim },
      noPeople: params.get("nopeople") === "1",
      film: params.get("film") === "1",
      // the film: hold down the street, overtake the learner, answer the call, the fork
      script: demo ? { hold: [[3, 9], [17, 24]], answer: [13.2, "yes"], fork: [2, "casino"], event: [1.6, "yes"] } : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car, leg, mode, quality, call, event, run, demo]);
  const bare = params.get("bare") === "1" || params.get("film") === "1";
  const kitH = kitsOf("Arsenal").home;
  const stage = atCompound
    ? (
      <div style={{ position: "absolute", inset: 0 }}>
        <World3D key={`c-${run}`} clean={params.get("clean") === "1"} onGo={(p) => setWalked(p)}
          options={{ place: "compound", quality, number: 9, club: "Aston Villa", kit: { shirt: kitH.shirt, trim: kitH.trim },
            mates: [{ id: "m1", name: "Kai", number: 8 }, { id: "m2", name: "Marcus", number: 14 }, { id: "m3", name: "Theo", number: 21 }, { id: "m4", name: "Dion", number: 4 }],
            arrive: { car, mate: "Kai", skip: atCompound.skipped } }} />
        {walked && <div data-drive-walked style={{ position: "absolute", left: 0, right: 0, top: "45%", textAlign: "center", color: "#fff", fontWeight: 900, fontSize: 22 }}>→ The {walked} (the career opens it)</div>}
      </div>
    )
    : <Drive3D key={run} options={options} clean={params.get("clean") === "1"} onMemory={(m) => setMemories((x) => [...x, m])}
        onDone={(r) => { setEffects(r.effects); if (r.handover) setAtCompound({ skipped: r.skipped }); }} />;
  if (bare) {
    return (
      <>
        <div style={{ position: "fixed", inset: 0 }}>{stage}</div>
        {params.get("clean") !== "1" && <PageGuide page="/star-drive3d-dev" corner="bottom-left" />}
      </>
    );
  }
  return (
    <>
      <BroadcastPage title="The drive" sub="Garden gate → your car → the lane → the compound. Hold to go faster, tap a side to change lane." width={1440}>
        <div className="s3-bar" data-drive3d-dev>
          {DRIVE_CAR_IDS.map((c) => <Pill key={c} on={car === c} onClick={() => setCar(c)}>{DRIVE_CARS[c].name}</Pill>)}
        </div>
        <div className="s3-bar">
          <Pill on={leg === "in"} onClick={() => { setLeg("in"); setAtCompound(null); }}>Drive in</Pill>
          <Pill on={leg === "back"} onClick={() => { setLeg("back"); setAtCompound(null); }}>Drive back</Pill>
          <span style={{ width: 12 }} />
          <Pill on={mode === "lanes"} onClick={() => setMode("lanes")}>Steer: Lanes</Pill>
          <Pill on={mode === "stick"} onClick={() => setMode("stick")}>Thumb stick</Pill>
          <Pill on={mode === "tilt"} onClick={() => setMode("tilt")}>Tilt</Pill>
          <span style={{ width: 12 }} />
          <Pill on={!call} onClick={() => setCall(undefined)}>Call: by chance</Pill>
          <Pill on={call === "none"} onClick={() => setCall("none")}>No call</Pill>
          {DRIVE_CALLS.map((c) => <Pill key={c.id} on={call === c.id} onClick={() => setCall(c.id)}>{c.id}</Pill>)}
          <Btn onClick={() => { setRun((k) => k + 1); setMemories([]); setAtCompound(null); setWalked(null); setEffects(null); }}>↻ Restart</Btn>
        </div>
        <div className="s3-bar">
          <Pill on={!event} onClick={() => setEvent(undefined)}>Event: by chance</Pill>
          <Pill on={event === "none"} onClick={() => setEvent("none")}>No event</Pill>
          {DRIVE_EVENT_IDS.map((e) => <Pill key={e} on={event === e} onClick={() => setEvent(e)}>{e}</Pill>)}
        </div>
        <div className="s3-stage">{stage}</div>
        {effects && (
          <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 8 }} data-drive-effects>
            What the drive would change in the career (not saved here): {effects.length ? effects.map((e) => Object.entries(e).map(([k, v]) => `${k} ${Number(v) > 0 ? "+" : ""}${v}`).join(", ")).join("; ") : "nothing"}
          </div>
        )}
        {memories.length > 0 && (
          <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 8 }} data-drive-memories>
            Memories for the people plan (not saved): {memories.map((m) => `${m.who} · ${m.about} · ${m.answer}`).join("; ")}
          </div>
        )}
      </BroadcastPage>
      <PageGuide page="/star-drive3d-dev" corner="bottom-left" />
    </>
  );
}
