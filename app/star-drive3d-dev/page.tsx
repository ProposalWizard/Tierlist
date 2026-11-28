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
import { parseQuality3d } from "@/lib/star/three3d/quality";
import { kitsOf } from "@/lib/star/kits";
import { DRIVE_CARS, DRIVE_CAR_IDS, type DriveCarId } from "@/lib/star/drive3d/cars";
import { DRIVE_CALLS } from "@/lib/star/drive3d/calls";
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
  const [run, setRun] = useState(0);
  const [memories, setMemories] = useState<CallMemory[]>([]);
  const quality = parseQuality3d(params.get("q")) ?? undefined;
  const demo = params.get("demo") === "1";
  const options = useMemo<DriveSceneOptions>(() => {
    const kit = kitsOf("Arsenal").home;
    return {
      car, leg, mode, quality, call, seed: 7 + run,
      names: { mate: "Kai", mate2: "Marcus", car: DRIVE_CARS[car].name.toLowerCase(), club: "Aston Villa" },
      kit: { shirt: kit.shirt, trim: kit.trim },
      noPeople: params.get("nopeople") === "1",
      film: params.get("film") === "1",
      // the film: hold down the street, overtake the learner, answer the call, the fork
      script: demo ? { hold: [[3, 9], [17, 24]], answer: [13.2, "yes"], fork: [2, "casino"] } : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car, leg, mode, quality, call, run, demo]);
  const bare = params.get("bare") === "1" || params.get("film") === "1";
  const stage = <Drive3D key={run} options={options} clean={params.get("clean") === "1"} onMemory={(m) => setMemories((x) => [...x, m])} />;
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
          <Pill on={leg === "in"} onClick={() => setLeg("in")}>Drive in</Pill>
          <Pill on={leg === "back"} onClick={() => setLeg("back")}>Drive back</Pill>
          <span style={{ width: 12 }} />
          <Pill on={mode === "lanes"} onClick={() => setMode("lanes")}>Steer: Lanes</Pill>
          <Pill on={mode === "stick"} onClick={() => setMode("stick")}>Thumb stick</Pill>
          <Pill on={mode === "tilt"} onClick={() => setMode("tilt")}>Tilt</Pill>
          <span style={{ width: 12 }} />
          <Pill on={!call} onClick={() => setCall(undefined)}>Call: by chance</Pill>
          <Pill on={call === "none"} onClick={() => setCall("none")}>No call</Pill>
          {DRIVE_CALLS.map((c) => <Pill key={c.id} on={call === c.id} onClick={() => setCall(c.id)}>{c.id}</Pill>)}
          <Btn onClick={() => { setRun((k) => k + 1); setMemories([]); }}>↻ Restart</Btn>
        </div>
        <div className="s3-stage">{stage}</div>
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
