"use client";
/**
 * components/teamRoom/PushedJob.tsx — one job that arrived by push
 * (team/jobs.json, lib/teamRoom/jobs.ts) in the To-do list: tick box, the
 * job, "from a push · <who asked>", and Copy prompt when it has one.
 *
 * No delete: the job lives in the repo. The tick is saved for you in the
 * shared database (store.ts tickJob).
 */
import { useEffect, useRef, useState } from "react";
import type { PushedJob } from "@/lib/teamRoom/jobs";
import { stamp } from "@/lib/teamRoom/logic";
import { tickJob } from "@/lib/teamRoom/store";

export default function PushedJobRow({ j, now }: { j: PushedJob; now: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "done" | "manual">("idle");
  const box = useRef<HTMLTextAreaElement>(null);

  // Copy didn't work: the prompt shows in a box, already selected, to copy by hand.
  useEffect(() => {
    const el = box.current;
    if (copy !== "manual" || !el) return;
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length);
  }, [copy]);

  const tick = async () => {
    setBusy(true);
    const r = await tickJob(j, !j.done_at);
    setBusy(false);
    setErr(r.ok ? null : r.error);
  };
  // The clipboard is asked inside the tap itself, or phones refuse it.
  const copyPrompt = () => {
    const text = j.prompt ?? "";
    const manual = () => setCopy("manual");
    try {
      if (!navigator.clipboard?.writeText) { manual(); return; }
      navigator.clipboard.writeText(text).then(() => {
        setCopy("done");
        setTimeout(() => setCopy((c) => (c === "done" ? "idle" : c)), 2500);
      }, manual);
    } catch { manual(); }
  };

  return (
    <div data-pushed-job={j.id}>
      <div className={`tr-task tr-job${j.done_at ? " done" : ""}`}
        title="This job came from a push (team/jobs.json in the repo), so it can't be deleted here. Tick it when it's done.">
        <button className="tr-check" data-compact role="checkbox" aria-checked={!!j.done_at} aria-label={j.done_at ? "Not done" : "Done"} disabled={busy} onClick={tick}>
          {j.done_at && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden><path d="m5 12 5 5 9-10" /></svg>}
        </button>
        <span className="tx">
          {j.title}
          <small><span className="tr-pushtag">from a push · {j.from}</span> {stamp(j.added, now)}</small>
          {j.prompt && !j.done_at && (
            <span className="tr-jobacts">
              <button className={`tr-btn ghost tr-copy${copy === "done" ? " ok" : ""}`} onClick={copyPrompt} data-copy-prompt>
                {copy === "done" ? "Copied ✓" : "Copy prompt"}
              </button>
            </span>
          )}
        </span>
      </div>
      {copy === "manual" && j.prompt && (
        <div className="tr-copybox">
          <p>Copy didn&apos;t work here. The prompt is selected below: press Ctrl+C, or hold it and choose Copy.</p>
          <textarea ref={box} readOnly value={j.prompt} rows={6} aria-label="The prompt, to copy by hand" onFocus={(e) => e.currentTarget.select()} />
          <button className="tr-x" onClick={() => setCopy("idle")}>Close</button>
        </div>
      )}
      {err && <p className="tr-err">{err}</p>}
    </div>
  );
}
