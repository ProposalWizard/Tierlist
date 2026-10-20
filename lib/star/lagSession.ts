/**
 * The Lag test's state: start screen → the guided route (the pill) →
 * results (B18 step 0, 20 Oct 2026). One store for the page, outside React,
 * so the pill (components/star/LagTest.tsx, mounted in the /star-dev layout)
 * outlives every screen change in the game.
 *
 * Kept in sessionStorage after every change, so a reload mid-test (a phone
 * short of memory does this) or the jump to the cut-scene page carries on at
 * the same step. A step that was recording when the page went starts again.
 *
 * Nothing is measured until Start: the recorder (lib/star/lagRecorder.ts)
 * runs only while a step records. Nothing here touches the career.
 */
import {
  LAG_STEPS, estimateRefresh, newRunId, refineRefresh, resultsText,
  type LagRun, type LagStepResult, type LagTier,
} from "./lagTest";
import { deviceFacts, sampleIdleGaps, start3dCounters, startRecording, type Recording } from "./lagRecorder";
import { saveLagRun } from "./lagRuns";

export type LagStage = "off" | "setup" | "measuring" | "route" | "end";
export type LagStepState = "go" | "rec" | "done";

export interface LagSessionState {
  stage: LagStage;
  run: LagRun | null;
  stepIndex: number;
  stepState: LagStepState;
  /** Seconds left in the step being recorded. */
  leftS: number;
  dock: "top" | "bottom";
  /** The page reloaded mid-step: say so once on the pill. */
  reloaded: boolean;
  save: { status: "idle" | "saving" | "shared" | "device"; message: string };
}

const OFF: LagSessionState = {
  stage: "off", run: null, stepIndex: 0, stepState: "go", leftS: 0, dock: "top", reloaded: false,
  save: { status: "idle", message: "" },
};

const STORE_KEY = "star-lag-test-session-v1";
const WHO_KEY = "star-lag-test-who";
const TIER_KEY = "star-lag-test-tier";

let state: LagSessionState = OFF;
const listeners = new Set<() => void>();
let recording: Recording | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

function emit() { listeners.forEach((f) => f()); }
function persist() {
  try {
    if (state.stage === "route" || state.stage === "end") {
      const { stage, run, stepIndex, stepState, dock, save } = state;
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ stage, run, stepIndex, stepState, dock, save }));
    } else sessionStorage.removeItem(STORE_KEY);
  } catch { /* private mode: the test still runs, it just won't survive a reload */ }
}
function set(patch: Partial<LagSessionState>, save = true) {
  state = { ...state, ...patch };
  if (save) persist();
  emit();
}

export const lagSubscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const lagState = () => state;
export const lagServerState = () => OFF;

/** Open the start screen (Settings → 🛠 Dev → Lag test, or ?lagtest=1). */
export function openLagTest() {
  if (state.stage === "off") set({ ...OFF, stage: "setup" });
}

/** Close everything and forget the run on this tab (a saved or copied run is kept where it went). */
export function closeLagTest() {
  stopTicker();
  if (recording) { recording.stop(); recording = null; }
  set({ ...OFF });
}

/** Back after a reload or the jump to the cut-scene page. Only when nothing is running here. */
export function restoreLagTest() {
  if (state.stage !== "off") return;
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as Partial<LagSessionState>;
    if (!s.run || (s.stage !== "route" && s.stage !== "end")) return;
    const wasRecording = s.stepState === "rec";
    const run = wasRecording ? { ...s.run, reloads: (s.run.reloads ?? 0) + 1 } : s.run;
    set({
      ...OFF, stage: s.stage, run, stepIndex: s.stepIndex ?? 0,
      stepState: wasRecording ? "go" : (s.stepState ?? "go"), dock: s.dock === "bottom" ? "bottom" : "top",
      reloaded: wasRecording, save: s.save ?? OFF.save,
    });
    // reloaded while it was sending: send again
    if (s.stage === "end" && s.save?.status === "saving") void lagSend();
  } catch { /* a broken copy: start clean */ }
}

export function lastWho(): string { try { return localStorage.getItem(WHO_KEY) ?? ""; } catch { return ""; } }
export function lastTier(): LagTier | "" { try { return (localStorage.getItem(TIER_KEY) as LagTier | null) ?? ""; } catch { return ""; } }

/** Start: note the device, measure the screen's refresh while it sits still (2 s), then step 1. */
export async function beginLagRun(o: { person: string; tier: LagTier; device: string }) {
  if (state.stage !== "setup") return;
  try { localStorage.setItem(WHO_KEY, o.person); localStorage.setItem(TIER_KEY, o.tier); } catch { /* fine */ }
  set({ stage: "measuring" }, false);
  start3dCounters();
  const facts = deviceFacts();
  const idle = await sampleIdleGaps(2000);
  if ((lagState().stage as LagStage) !== "measuring") return; // closed while measuring
  const run: LagRun = {
    v: 1, id: newRunId(), person: o.person.trim().slice(0, 40), tier: o.tier, device: o.device.trim().slice(0, 120),
    startedAt: Date.now(), endedAt: null, facts, refresh: estimateRefresh(idle), steps: [], reloads: 0, complete: false,
  };
  set({ stage: "route", run, stepIndex: 0, stepState: "go", reloaded: false });
}

function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }

/** "I'm there": record this step for its set time. */
export function lagImThere() {
  if (state.stage !== "route" || state.stepState !== "go") return;
  const def = LAG_STEPS[state.stepIndex];
  if (!def) return;
  recording = startRecording();
  set({ stepState: "rec", leftS: def.seconds, reloaded: false });
  stopTicker();
  ticker = setInterval(() => {
    if (!recording) return;
    const left = Math.max(0, Math.ceil(def.seconds - recording.visibleMs() / 1000));
    if (left <= 0) { finishStep("done"); return; }
    if (left !== state.leftS) set({ leftS: left }, false);
  }, 250);
}

function putStep(result: LagStepResult) {
  const run = state.run!;
  const steps = run.steps.filter((s) => s.id !== result.id);
  steps.push(result);
  steps.sort((a, b) => LAG_STEPS.findIndex((d) => d.id === a.id) - LAG_STEPS.findIndex((d) => d.id === b.id));
  return { ...run, steps };
}

function finishStep(status: "done" | "stopped") {
  stopTicker();
  const def = LAG_STEPS[state.stepIndex];
  if (!recording || !def || !state.run) return;
  const r = recording.stop();
  recording = null;
  set({ run: putStep({ id: def.id, title: def.title, status, three: def.three, ...r }), stepState: status === "done" ? "done" : state.stepState, leftS: 0 });
}

/** Next step, or the results after the last one. */
export function lagNext() {
  if (state.stage !== "route") return;
  if (state.stepIndex + 1 < LAG_STEPS.length) set({ stepIndex: state.stepIndex + 1, stepState: "go", reloaded: false });
  else void endRun();
}

/** "Can't get there → Skip". */
export function lagSkip() {
  if (state.stage !== "route" || !state.run) return;
  if (state.stepState === "rec") return;
  const def = LAG_STEPS[state.stepIndex];
  if (state.stepState === "go") {
    set({
      run: putStep({
        id: def.id, title: def.title, status: "skipped", three: def.three, seconds: 0, frames: null, longTasks: null, loaf: null,
        heartbeat: null, frame3d: [], heapMB: null, phases: [], hiddenMs: 0,
      }),
    });
  }
  lagNext();
}

/** Stop: keep what's recorded and go to the results. */
export function lagStop() {
  if (state.stage !== "route") return;
  if (state.stepState === "rec") finishStep("stopped");
  void endRun();
}

export function lagToggleDock() { set({ dock: state.dock === "top" ? "bottom" : "top" }); }

async function endRun() {
  const run0 = state.run;
  if (!run0) { set({ ...OFF }); return; }
  const complete = LAG_STEPS.every((d) => run0.steps.some((s) => s.id === d.id && s.status !== "stopped"));
  const run = { ...run0, endedAt: Date.now(), complete, refresh: refineRefresh(run0.refresh, run0.steps) };
  const anything = run.steps.some((s) => s.status !== "skipped");
  set({ stage: "end", run, stepState: "go", save: anything ? { status: "saving", message: "Sending to the team…" } : { status: "idle", message: "Nothing was recorded." } });
  if (anything) await lagSend();
}

/** Send (again). */
export async function lagSend() {
  const run = state.run;
  if (!run) return;
  set({ save: { status: "saving", message: "Sending to the team…" } });
  const res = await saveLagRun(run);
  if (state.run?.id !== run.id) return;
  set({ save: { status: res.where, message: res.message } });
}

/** The text for the Team chat. */
export function lagResultsText(): string { return state.run ? resultsText(state.run) : ""; }
