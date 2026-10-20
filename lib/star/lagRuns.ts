/**
 * Sending a finished Lag test to the team (B18 step 0, 20 Oct 2026).
 *
 * POST /api/star/lag-runs commits the run as one JSON file to the `lag-runs`
 * branch (no database: Harry, 20 Oct 2026, "why are we using sql's ... just
 * use pushes"). Testers and admins, signed in. When that can't happen
 * (signed out, GITHUB_TOKEN not set, GitHub said no, no signal) the run is
 * kept on this device, the screen says "Saved on this device only", and the
 * next run that gets through sends the kept ones too. "Copy results"
 * (lib/star/lagTest.ts resultsText) is the way round it: paste into the Team chat.
 *
 * Same keep-and-resend pattern as lib/star/tuningNotes.ts.
 */
import { isLagRun, type LagRun } from "./lagTest";

const LOCAL_KEY = "star-lag-runs-pending-v1";
const KEEP = 10;

export function pendingLagRuns(): LagRun[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter(isLagRun) : [];
  } catch {
    return [];
  }
}

function setPending(list: LagRun[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-KEEP))); } catch { /* nowhere to keep it */ }
}

export type LagSaveResult = { where: "shared" | "device"; message: string };

/** Send one run (and any kept ones). Never throws: a failure keeps it on this device. */
export async function saveLagRun(run: LagRun): Promise<LagSaveResult> {
  const waiting = pendingLagRuns().filter((r) => r.id !== run.id);
  const batch = [...waiting, run].slice(-KEEP);
  try {
    const r = await fetch("/api/star/lag-runs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runs: batch }),
    });
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; signIn?: boolean; error?: string; files?: string[] };
    if (r.ok && d.ok) {
      setPending([]);
      return { where: "shared", message: waiting.length ? `Sent to the team ✓ (and ${waiting.length} kept from before)` : "Sent to the team ✓" };
    }
    // Some were saved before a failure: keep only the ones that weren't.
    setPending(batch.slice(d.files?.length ?? 0));
    return {
      where: "device",
      message: d.signIn
        ? "Saved on this device only — sign in to send it to the team. Or copy the results into the Team chat."
        : `Saved on this device only — ${d.error ?? `the server said ${r.status}`}. Copy the results into the Team chat.`,
    };
  } catch {
    setPending(batch);
    return { where: "device", message: "Saved on this device only — couldn't reach the server. Copy the results into the Team chat." };
  }
}
